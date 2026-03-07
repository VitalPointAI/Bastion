/**
 * Resource Management Domain Types
 *
 * Phase 4.4 Plan 01: Resource catalogs, personnel, and consumables
 * Phase 27 Plan 01: Extended with DID fields, plugin support, resource groups
 */

/**
 * Resource category types — 6 canonical categories aligned with frontend
 */
export type ResourceCategory = 'vehicles' | 'weapons' | 'communications' | 'sensors' | 'medical' | 'other';

/**
 * Resource status per military readiness reporting
 * - FMC: Fully Mission Capable
 * - PMC: Partially Mission Capable
 * - NMC: Non-Mission Capable
 */
export type ResourceStatus = 'FMC' | 'PMC' | 'NMC';

/**
 * Resource trust tier — mirrors agent tier concept for autonomous resources
 */
export type ResourceTrustTier = 'observer' | 'participant' | 'autonomous';

/**
 * Resource catalog item
 *
 * Tracks physical equipment and systems with readiness status
 */
export interface Resource {
  id: string; // Format: RES-{uuid}
  missionId: string;
  name: string;
  category: ResourceCategory;
  serialNumber?: string;
  sidc?: string; // Optional MIL-STD-2525D code for map rendering
  status: ResourceStatus;
  specifications: Record<string, unknown>; // JSONB for flexible specifications
  location?: {
    lat: number;
    lng: number;
  };
  did?: string;
  blindedKey?: string;
  publicKey?: string;
  isAutonomous: boolean;
  capabilities: string[];
  groupId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A resource that has been registered with a DID — all DID fields required
 */
export interface RegisteredResource extends Resource {
  did: string;
  blindedKey: string;
  publicKey: string;
  trustTier: ResourceTrustTier;
}

/**
 * Input manifest for registering a new resource
 */
export interface ResourceManifest {
  name: string;
  category: ResourceCategory;
  missionId: string;
  specifications: Record<string, unknown>;
  isAutonomous: boolean;
  capabilities: string[];
}

/**
 * Resource group for organizing resources into units, formations, etc.
 */
export interface ResourceGroup {
  id: string;
  missionId: string;
  name: string;
  description?: string;
  groupType: 'unit' | 'formation' | 'task_force' | 'custom';
  parentGroupId?: string;
  aggregateCapabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Personnel tracking
 *
 * Tracks individual personnel assigned to units with clearance and readiness
 */
export interface Personnel {
  id: string; // Format: PER-{uuid}
  missionId: string;
  unitId?: string; // Optional unit assignment
  name: string;
  rank: string;
  specialty: string; // MOS, AFSC, rating, etc.
  readinessStatus: 'ready' | 'limited' | 'unavailable';
  clearanceLevel: 'UNCLASS' | 'SECRET' | 'TOPSECRET';
  createdAt: Date;
}

/**
 * Consumable category types
 */
export type ConsumableCategory =
  | 'ammunition'
  | 'fuel'
  | 'medical'
  | 'rations'
  | 'other';

/**
 * Consumable inventory item
 *
 * Tracks consumable supplies with quantity levels and alerts
 */
export interface Consumable {
  id: string; // Format: CON-{uuid}
  missionId: string;
  category: ConsumableCategory;
  name: string;
  quantity: number;
  unit: string; // e.g., 'rounds', 'gallons', 'doses', 'meals'
  minimumLevel: number; // Alert threshold
  currentLevel: number;
  location?: {
    lat: number;
    lng: number;
  };
  createdAt: Date;
}
