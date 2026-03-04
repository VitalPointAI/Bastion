import { DIDDocument, EntityType, EncryptedDIDEntry } from './types.js';
import { deriveDIDBlindedKey, deriveUserSecret, blindedKeyToHex } from './blinded-keys.js';
import { encryptDIDDocument, decryptDIDDocument, deriveEncryptionKey } from './did-encryption.js';
import { storeDIDOnChain } from '../near/tx-signer.js';

const NEAR_RPC_URL = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
const DID_CONTRACT_ID = process.env.DID_CONTRACT_ID || 'did-registry.testnet';

/**
 * DID Service - handles encrypted DID operations
 */
export class DIDService {
  private rpcUrl: string;
  private contractId: string;

  constructor(rpcUrl?: string, contractId?: string) {
    this.rpcUrl = rpcUrl || NEAR_RPC_URL;
    this.contractId = contractId || DID_CONTRACT_ID;
  }

  /**
   * Create and store a new DID
   * Handles encryption, blinded key derivation, and on-chain storage.
   *
   * The DID is stored on-chain via a transaction signed by the user's
   * derived signing account (from tx-signer). This gives a proper audit trail:
   * the on-chain record shows the user's own key signed the store_did call.
   */
  async createDID(
    accountId: string,
    entityType: EntityType,
    userSecret: Uint8Array,
    publicKeyBase58: string
  ): Promise<{ did: string; blindedKey: string }> {
    // Build DID string
    const did = `did:near:${accountId}`;

    // Create DID document
    const document: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: did,
      entityType,
      publicKey: [{
        id: `${did}#key-1`,
        type: 'Ed25519VerificationKey2020',
        controller: did,
        publicKeyBase58
      }],
      authentication: [`${did}#key-1`],
      controller: [did],
      created: new Date().toISOString(),
      updated: new Date().toISOString()
    };

    // Derive keys
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);
    const encryptionKey = deriveEncryptionKey(userSecret);

    // Encrypt document
    const { encryptedDocument, encryptedEntityType, nonce, entityTypeNonce } = encryptDIDDocument(
      document,
      entityType,
      encryptionKey
    );

    // Store on-chain via user-signed transaction
    // The nonce field sent to the contract is the document nonce (entityTypeNonce is kept for local decryption)
    const chainResult = await storeDIDOnChain(
      userSecret,
      blindedKey,
      encryptedDocument,
      encryptedEntityType,
      nonce,
    );

    if (!chainResult.success) {
      // Log but don't fail — DID creation continues with local state
      // On-chain storage can be retried on next login
      console.warn(`[did-service] On-chain DID storage failed (will retry): ${chainResult.error}`);
    } else {
      console.log(`[did-service] DID stored on-chain: ${did} (tx: ${chainResult.txHash})`);
    }

    return { did, blindedKey: blindedKeyToHex(blindedKey) };
  }

  /**
   * Resolve a DID by account ID
   * Requires user's secret to derive blinded key and decrypt
   */
  async resolveDID(
    accountId: string,
    userSecret: Uint8Array
  ): Promise<DIDDocument | null> {
    // Derive blinded key
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);

    // Fetch encrypted entry from chain
    const encryptedEntry = await this.getEncryptedDID(blindedKey);
    if (!encryptedEntry) {
      return null;
    }

    // Decrypt
    const encryptionKey = deriveEncryptionKey(userSecret);
    const { document } = decryptDIDDocument(
      encryptedEntry.encryptedDocument,
      encryptedEntry.encryptedEntityType,
      encryptedEntry.nonce,
      encryptedEntry.entityTypeNonce,
      encryptionKey
    );

    return document;
  }

  /**
   * Check if a DID is active (without decryption)
   */
  async isDIDActive(accountId: string, userSecret: Uint8Array): Promise<boolean> {
    const blindedKey = deriveDIDBlindedKey(userSecret, accountId);
    return this.checkDIDActive(blindedKey);
  }

  // Private: NEAR RPC calls (read operations — no signing needed)

  private async getEncryptedDID(blindedKey: Uint8Array): Promise<EncryptedDIDEntry | null> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: this.contractId,
            method_name: 'get_did',
            args_base64: Buffer.from(JSON.stringify({
              blinded_key: Array.from(blindedKey)
            })).toString('base64')
          }
        })
      });

      const result = await response.json() as { result?: { result?: number[] } };
      if (result.result?.result) {
        const decoded = JSON.parse(Buffer.from(result.result.result).toString());
        if (!decoded) return null;

        return {
          encryptedDocument: new Uint8Array(decoded.encrypted_document),
          encryptedEntityType: new Uint8Array(decoded.encrypted_entity_type),
          nonce: new Uint8Array(decoded.nonce),
          entityTypeNonce: new Uint8Array(decoded.entity_type_nonce),
          createdAt: decoded.created_at,
          updatedAt: decoded.updated_at,
          active: decoded.active,
          owner: decoded.owner
        };
      }
      return null;
    } catch (error) {
      console.error('Failed to fetch DID:', error);
      return null;
    }
  }

  private async checkDIDActive(blindedKey: Uint8Array): Promise<boolean> {
    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'dontcare',
          method: 'query',
          params: {
            request_type: 'call_function',
            finality: 'final',
            account_id: this.contractId,
            method_name: 'is_did_active',
            args_base64: Buffer.from(JSON.stringify({
              blinded_key: Array.from(blindedKey)
            })).toString('base64')
          }
        })
      });

      const result = await response.json() as { result?: { result?: number[] } };
      if (result.result?.result) {
        return JSON.parse(Buffer.from(result.result.result).toString());
      }
      return false;
    } catch (error) {
      console.error('Failed to check DID status:', error);
      return false;
    }
  }
}

// Singleton instance
let serviceInstance: DIDService | null = null;

export function getDIDService(): DIDService {
  if (!serviceInstance) {
    serviceInstance = new DIDService();
  }
  return serviceInstance;
}
