/**
 * Mission Domain Types
 *
 * Phase 4.4 Plan 01: Mission workspaces, participants, and invitations
 */

/**
 * Mission lifecycle states
 */
export type MissionState = 'planning' | 'active' | 'complete' | 'archived';

/**
 * GeoJSON Polygon type definition
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // Array of LinearRings (array of positions)
}

/**
 * Mission workspace definition
 *
 * Links to existing workspace (Phase 4.3) and adds mission-specific context
 * including area of operations, lifecycle, and command structure.
 */
export interface Mission {
  id: string; // Format: MSN-{uuid}
  name: string;
  description?: string;
  classification: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
  areaOfOperations?: GeoJSONPolygon; // GeoJSON Polygon for area of operations
  workspaceId?: string; // Links to workspace from Phase 4.3
  state: MissionState;
  createdBy: string; // DID of creator
  createdAt: Date;
  updatedAt: Date;
  activatedAt?: Date;
  completedAt?: Date;
}

/**
 * Mission participant role types
 */
export type ParticipantRole = 'commander' | 'staff' | 'observer';

/**
 * Mission participant - links users to missions with specific roles
 */
export interface MissionParticipant {
  id: string;
  missionId: string;
  userDid: string;
  role: ParticipantRole;
  joinedAt: Date;
  invitedBy: string; // DID of inviter
}

/**
 * Mission invitation for secure participant onboarding
 *
 * Uses hashed tokens for security with optional email/DID targeting
 */
export interface MissionInvite {
  id: string; // Format: INV-{uuid}
  missionId: string;
  token: string; // Hashed token for lookup
  inviteeEmail?: string; // Optional email for notification
  inviteeDid?: string; // Optional DID for targeted invite
  role: ParticipantRole;
  expiresAt: Date;
  acceptedAt?: Date;
  createdBy: string; // DID of creator
  createdAt: Date;
}
