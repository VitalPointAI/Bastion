export type EntityType =
  | 'Human'
  | 'AiAgent'
  | 'Vehicle'
  | 'Mission'
  | 'DataObject'
  | 'Organization'
  | 'Resource';

export interface DIDDocument {
  '@context': string[];
  id: string;
  entityType: EntityType;
  publicKey: Array<{
    id: string;
    type: string;
    controller: string;
    publicKeyBase58: string;
  }>;
  authentication: string[];
  controller: string[];
  service?: Array<{
    id: string;
    type: string;
    serviceEndpoint: string;
  }>;
  created: string;
  updated: string;
  deactivated?: boolean;
}

export interface DIDResolutionResult {
  didDocument: DIDDocument | null;
  didResolutionMetadata: {
    error?: string;
  };
  didDocumentMetadata: {
    created?: string;
    updated?: string;
    deactivated?: boolean;
  };
}

export interface EntityRegistration {
  entityType: EntityType;
  name: string;
  description?: string;
  attributes?: Record<string, unknown>;
}
