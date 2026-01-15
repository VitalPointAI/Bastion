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

export interface DIDDocument {
  '@context': string[];
  id: string;
  entityType: EntityType;
  publicKey: PublicKeyEntry[];
  authentication: string[];
  controller: string[];
  service?: ServiceEndpoint[];
  created: string;
  updated: string;
}

export interface EncryptedDIDEntry {
  encryptedDocument: Uint8Array;
  encryptedEntityType: Uint8Array;
  nonce: Uint8Array;
  createdAt: number;
  updatedAt: number;
  active: boolean;
  owner: string;
}
