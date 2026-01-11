/**
 * IPFS Client for Decentralized Storage
 *
 * Uses Pinata for managed IPFS pinning and gateway access.
 * Large data (documents, intelligence products, sensor data) stored off-chain in IPFS.
 * CIDs stored on-chain in NEAR blockchain for provenance and auditability.
 */

import { PinataSDK } from "pinata";

export interface IPFSUploadResult {
  cid: string;
  size: number;
  timestamp: number;
}

export interface IPFSClient {
  uploadFile: (file: File) => Promise<IPFSUploadResult>;
  retrieveFile: (cid: string) => Promise<Uint8Array>;
}

let pinataClient: PinataSDK | null = null;

/**
 * Initialize Pinata IPFS client with JWT authentication
 */
export function initialize(): IPFSClient {
  const jwt = import.meta.env.VITE_PINATA_JWT;

  if (!jwt) {
    throw new Error('VITE_PINATA_JWT environment variable not set');
  }

  pinataClient = new PinataSDK({
    pinataJwt: jwt,
  });

  return {
    uploadFile,
    retrieveFile,
  };
}

/**
 * Upload file to IPFS via Pinata
 *
 * @param file - File to upload (documents, intelligence products, sensor data)
 * @returns Upload result with CID (content identifier)
 */
async function uploadFile(file: File): Promise<IPFSUploadResult> {
  if (!pinataClient) {
    throw new Error('IPFS client not initialized. Call initialize() first.');
  }

  try {
    // Upload file to IPFS with Pinata (uses public upload for accessibility)
    const upload = await pinataClient.upload.public.file(file);

    return {
      cid: upload.cid,
      size: file.size,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Failed to upload file to IPFS:', error);
    throw new Error(`IPFS upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Retrieve file from IPFS via Pinata gateway
 *
 * @param cid - IPFS content identifier
 * @returns File data as Uint8Array
 */
async function retrieveFile(cid: string): Promise<Uint8Array> {
  if (!pinataClient) {
    throw new Error('IPFS client not initialized. Call initialize() first.');
  }

  try {
    // Fetch file from Pinata gateway
    const gateway = import.meta.env.VITE_PINATA_GATEWAY || 'https://gateway.pinata.cloud';
    const url = `${gateway}/ipfs/${cid}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch from IPFS: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error('Failed to retrieve file from IPFS:', error);
    throw new Error(`IPFS retrieval failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the initialized IPFS client
 * Initializes automatically if not already initialized
 */
export function getIPFSClient(): IPFSClient {
  if (!pinataClient) {
    return initialize();
  }

  return {
    uploadFile,
    retrieveFile,
  };
}
