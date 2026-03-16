/**
 * Swarm Graph Writer — Brain Graph Write Path for Swarm Lifecycle Events
 *
 * Persists the complete mission lifecycle to the Neo4j knowledge graph with:
 *   - PROV-O provenance (prov:wasGeneratedBy, prov:wasAttributedTo national DID)
 *   - MERGE-based dedup with deterministic IDs (5-second window)
 *   - CCO JSON-LD typing (cco:Process)
 *
 * Supports 9 event types covering the full swarm mission lifecycle from
 * mission_authorized through mission_complete.
 *
 * Used by RobotMissionService to write swarm lifecycle events to the
 * knowledge graph for timeline playback and coalition information filtering.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type SwarmEventType =
  | 'mission_authorized'
  | 'mission_dispatched'
  | 'swarm_formed'
  | 'formation_changed'
  | 'detection_shared'
  | 'escalation_requested'
  | 'authorization_granted'
  | 'authorization_denied'
  | 'mission_complete';

export interface SwarmEventContext {
  swarmId: string;
  eventType: SwarmEventType;
  timestamp: string;       // ISO string
  nationalDid: string;     // Asserting nation's DID
  daoTxHash?: string;      // NEAR blockchain tx hash if DAO-authorized
  members?: string[];      // Robot IDs involved
  payload: Record<string, unknown>;
  workspaceId: string;
}

// ── Dedup ID Generation ────────────────────────────────────────────────────

/**
 * Build a deterministic event ID with 5-second dedup window.
 *
 * Rounds the timestamp epoch to the nearest 5-second window boundary,
 * which deduplicates reconnection bursts where multiple robots report the
 * same swarm event within a few seconds of each other.
 *
 * @param swarmId  - Swarm identifier
 * @param eventType - Event type string
 * @param timestamp - ISO timestamp string
 * @returns Deterministic ID like "EVT-swarm-1-swarm_formed-1710590400000"
 */
export function buildSwarmEventId(
  swarmId: string,
  eventType: string,
  timestamp: string,
): string {
  const epoch = new Date(timestamp).getTime(); // milliseconds
  const rounded = Math.floor(epoch / 5000) * 5000;
  return `EVT-${swarmId}-${eventType}-${rounded}`;
}

// ── Graph Write ────────────────────────────────────────────────────────────

/**
 * Write a swarm lifecycle event to the Neo4j brain graph.
 *
 * Uses MERGE on deterministic event ID to prevent duplicate nodes.
 * ON CREATE sets all PROV-O provenance fields.
 * ON MATCH updates validThrough to extend the event's time window.
 */
export async function writeSwarmEventToGraph(
  event: SwarmEventContext,
): Promise<void> {
  const { executeWriteQuery } = await import('../graph/neo4j-client.js');

  const eventId = buildSwarmEventId(event.swarmId, event.eventType, event.timestamp);

  const params: Record<string, unknown> = {
    eventId,
    eventType: event.eventType,
    swarmId: event.swarmId,
    timestamp: event.timestamp,
    nationalDid: event.nationalDid,
    workspaceId: event.workspaceId,
    payload: JSON.stringify(event.payload),
    members: event.members ?? [],
  };

  if (event.daoTxHash !== undefined) {
    params.daoTxHash = event.daoTxHash;
  }

  // Build the MERGE query with PROV-O provenance
  const daoTxHashSet = event.daoTxHash !== undefined
    ? '\n          e["bastion:daoTxHash"] = $daoTxHash,'
    : '';

  await executeWriteQuery(`
    MERGE (e:Event {id: $eventId})
    ON CREATE SET
      e["@type"] = "cco:Process",
      e["@context"] = "bastion:v1",
      e["cco:process_type"] = $eventType,
      e["prov:wasGeneratedBy"] = "swarm_coordinator",
      e["prov:wasAttributedTo"] = $nationalDid,
      e["bastion:swarmId"] = $swarmId,
      e["bastion:members"] = $members,
      e["bastion:payload"] = $payload,
      e["xsd:validFrom"] = $timestamp,
      e.workspaceId = $workspaceId${daoTxHashSet}
    ON MATCH SET
      e["xsd:validThrough"] = $timestamp
  `, params);

  console.log(
    `[SwarmGraph] Wrote event ${event.eventType} for swarm ${event.swarmId} (id: ${eventId})`,
  );
}

// ── Convenience Wrappers ───────────────────────────────────────────────────

/**
 * Write an escalation_requested event when the swarm detects a threat and
 * requests engagement authority from the commander.
 */
export async function writeEscalationRequestedEvent(
  workspaceId: string,
  missionId: string,
  swarmId: string,
  threatEntityId: string,
  nationalDid: string,
): Promise<void> {
  await writeSwarmEventToGraph({
    swarmId,
    eventType: 'escalation_requested',
    timestamp: new Date().toISOString(),
    nationalDid,
    workspaceId,
    payload: {
      mission_id: missionId,
      threat_entity_id: threatEntityId,
    },
  });
}

/**
 * Write an authorization_granted or authorization_denied event after a
 * commander makes a lethal escalation decision. The DAO tx hash anchors
 * the decision to the NEAR blockchain for full provenance.
 */
export async function writeAuthorizationDecisionEvent(
  workspaceId: string,
  missionId: string,
  swarmId: string,
  decision: 'granted' | 'denied',
  daoTxHash: string,
  commanderDid: string,
  nationalDid: string,
): Promise<void> {
  const eventType: SwarmEventType = decision === 'granted'
    ? 'authorization_granted'
    : 'authorization_denied';

  await writeSwarmEventToGraph({
    swarmId,
    eventType,
    timestamp: new Date().toISOString(),
    nationalDid,
    daoTxHash: daoTxHash || undefined,
    workspaceId,
    payload: {
      mission_id: missionId,
      commander_did: commanderDid,
      decision,
      escalation_type: 'lethal_force',
    },
  });
}

/**
 * Write a mission_dispatched event when a mission is sent to a robot/swarm.
 */
export async function writeMissionDispatchedEvent(
  workspaceId: string,
  missionId: string,
  swarmId: string,
  missionType: string,
  nationalDid: string,
): Promise<void> {
  await writeSwarmEventToGraph({
    swarmId,
    eventType: 'mission_dispatched',
    timestamp: new Date().toISOString(),
    nationalDid,
    workspaceId,
    payload: {
      mission_id: missionId,
      mission_type: missionType,
    },
  });
}

/**
 * Write a mission_complete event when a swarm mission concludes (success or failure).
 */
export async function writeMissionCompleteEvent(
  workspaceId: string,
  missionId: string,
  swarmId: string,
  outcome: string,
  nationalDid: string,
): Promise<void> {
  await writeSwarmEventToGraph({
    swarmId,
    eventType: 'mission_complete',
    timestamp: new Date().toISOString(),
    nationalDid,
    workspaceId,
    payload: {
      mission_id: missionId,
      outcome,
    },
  });
}
