/**
 * Frontend IPFS API Client
 *
 * Proxies IPFS operations to secure backend API.
 * Large data (documents, intelligence products, sensor data) stored off-chain in IPFS.
 * CIDs stored on-chain in NEAR blockchain for provenance and auditability.
 */

// Use environment variable or empty string for relative URLs (Vite proxy)
const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';
const PINATA_GATEWAY = import.meta.env.VITE_PINATA_GATEWAY!;

export interface IPFSUploadResult {
  cid: string;
  size: number;
  encrypted_key: string;
  nonce: string;
}

/**
 * Upload and encrypt document via backend API
 *
 * @param file - File to upload (documents, intelligence products, sensor data)
 * @param ownerAccountId - NEAR account ID of document owner
 * @returns Upload result with CID, encryption key, and nonce
 */
export async function uploadDocument(
  file: File,
  ownerAccountId: string
): Promise<IPFSUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('owner_account_id', ownerAccountId);

  const response = await fetch(`${BACKEND_URL}/api/documents/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Upload failed: ${error.error || response.statusText}`);
  }

  return response.json();
}

/**
 * Retrieve file from IPFS via public gateway
 *
 * @param cid - IPFS content identifier
 * @returns File data as Blob
 */
export async function retrieveFromIPFS(cid: string): Promise<Blob> {
  const response = await fetch(`${PINATA_GATEWAY}/ipfs/${cid}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
  }

  return response.blob();
}
