export type EntityType =
  | 'Human'
  | 'AiAgent'
  | 'Vehicle'
  | 'Mission'
  | 'DataObject'
  | 'Organization'
  | 'Resource';

export interface PublicKeyEntry {
  id: string;
  type: string;
  controller: string;
  publicKeyBase58: string;
}

export interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

/** Per-agent governance policy — stored inside encrypted DID document.
 * Phase 53: replaces hardcoded ACTION_RISK as per-agent overrides.
 * Only present on AiAgent entity type DIDs. */
export interface AgentGovernancePolicy {
  /** Action risk level overrides — maps action type to risk level.
   * Can ONLY elevate risk, never downgrade (enforced by ActionPipeline). */
  actionRiskOverrides?: Record<string, 'low' | 'medium' | 'high'>;
  /** Rate limit overrides by risk bucket */
  rateLimitOverrides?: {
    low?: { max: number; window_seconds: number };
    medium?: { max: number; window_seconds: number };
    high?: { max: number; window_seconds: number };
  };
  /** Additional protected config keys for this agent */
  additionalProtectedKeys?: string[];
  /** Allowed action types (empty = use defaults from ACTION_RISK) */
  allowedActions?: string[];
  /** Explicitly blocked action types */
  blockedActions?: string[];
  /** Schema version for forward compatibility */
  policyVersion: number;
}

export interface DIDDocument {
  '@context': string[];
  id: string;
  entityType: EntityType;
  publicKey: PublicKeyEntry[];
  authentication: string[];
  controller: string[];
  service?: ServiceEndpoint[];
  /** Per-agent governance policy. Only present on AiAgent entity type DIDs.
   * Encrypted along with the rest of the DID document — no separate step needed. */
  governance?: AgentGovernancePolicy;
  created: string;
  updated: string;
}

export interface EncryptedDIDEntry {
  encryptedDocument: Uint8Array;
  encryptedEntityType: Uint8Array;
  nonce: Uint8Array;
  entityTypeNonce: Uint8Array;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  owner: string;
}
