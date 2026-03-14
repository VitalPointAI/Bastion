/**
 * COP Module Initialization & Barrel Exports
 *
 * Phase 21 Plan 07: Main entry point for the COP (Common Operational Picture) module.
 * Initializes all COP subsystems, wires event-driven triggers, and exports
 * the Express router for mounting on the application.
 *
 * Primary trigger model: Document commit events from strategic API approval
 * flow automatically trigger COP layer generation via handleCommitTrigger.
 */

// ─── Re-exports (barrel) ────────────────────────────────────────────────────

export { copRouter } from './api/cop-routes.js';
export { copEventBus } from './messaging/event-bus.js';
export { runCOPGeneration } from './agents/cop-coordinator.js';
export { layerStore } from './layers/layer-store.js';
export { linkageStore } from './linkage/linkage-store.js';

// ─── Internal imports ────────────────────────────────────────────────────────

import { loadCCOSchema } from './cco/cco-schema-loader.js';
import { layerStore } from './layers/layer-store.js';
import { versionStore } from './layers/version-store.js';
import { linkageStore } from './linkage/linkage-store.js';
import { copEventBus } from './messaging/event-bus.js';
import { TriggerHandler } from './messaging/trigger-handler.js';
import { ActivityBridge } from './messaging/activity-bridge.js';
import { runCOPGeneration } from './agents/cop-coordinator.js';
import { COP_AGENT_DEFINITIONS } from './agents/agent-definitions.js';
import { setHandlerDependencies } from './api/cop-handlers.js';
import { objectiveStore } from '../strategic/objectives/index.js';
import { actorStore } from '../graph/raft/actor-store.js';

// ─── Module State ────────────────────────────────────────────────────────────

let initialized = false;
let _triggerHandler: TriggerHandler;
let _activityBridge: ActivityBridge;

// ─── Agent Seeding ───────────────────────────────────────────────────────────

/**
 * Seed COP agent definitions into the database if not already present.
 * Follows the existing agent seeding pattern from agents/langgraph/agent-seeder.ts.
 */
async function seedCOPAgents(): Promise<void> {
  try {
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();

    // Check if agents table exists (created by langgraph agent-seeder)
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'staff_agent_defs'
      )
    `);

    if (!tableCheck.rows[0].exists) {
      console.log('[COP] staff_agent_defs table not found, skipping agent seeding');
      return;
    }

    // Upsert each COP agent definition
    for (const def of COP_AGENT_DEFINITIONS) {
      await pool.query(`
        INSERT INTO staff_agent_defs (id, role_key, name, rank, branch, specialty, focus, tools, personality, system_prompt_hint, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          role_key = EXCLUDED.role_key,
          name = EXCLUDED.name,
          focus = EXCLUDED.focus,
          tools = EXCLUDED.tools,
          system_prompt_hint = EXCLUDED.system_prompt_hint
      `, [
        def.id,
        def.roleKey,
        def.name,
        def.rank,
        def.branch,
        def.specialty,
        def.focus,
        JSON.stringify(def.tools),
        JSON.stringify(def.personality),
        def.systemPromptHint,
        def.isDefault,
      ]);
    }

    console.log(`[COP] Seeded ${COP_AGENT_DEFINITIONS.length} agent definitions`);
  } catch (error) {
    // Non-fatal: agent seeding can fail if database is not ready
    console.warn('[COP] Agent seeding failed (non-fatal):', error instanceof Error ? error.message : error);
  }
}

// ─── Event Wiring ────────────────────────────────────────────────────────────

/**
 * Wire the trigger handler to the COP coordinator.
 * When triggerHandler emits layer:generation:start, invoke runCOPGeneration.
 */
function wireGenerationTrigger(_triggerHandler: TriggerHandler): void {
  copEventBus.on('layer:generation:start', async (data) => {
    console.log(`[COP] Generation triggered: workspace=${data.workspaceId}, section=${data.sectionId}, by=${data.triggeredBy}`);
    try {
      // Fetch real documents (objectives) for sub-agent context
      let documents: Array<{ id: string; content: string; type: string }> = [];
      let graphEntities: Array<{ id: string; name: string; type: string; properties: Record<string, unknown> }> = [];

      try {
        const { objectives } = await objectiveStore.listObjectives({
          status: 'APPROVED',
        });
        documents = objectives.map(obj => ({
          id: obj.id,
          content: [obj.description, obj.sourceReference || ''].filter(Boolean).join('\n'),
          type: 'general',  // 'general' passes through all sub-agent doc filters
        }));
      } catch (err) {
        console.warn('[COP] Failed to fetch objectives:', err instanceof Error ? err.message : err);
      }

      // Fetch real graph entities (actors) for sub-agent context
      try {
        const actors = await actorStore.listActors(data.workspaceId);
        graphEntities = actors.map(actor => ({
          id: actor.id,
          name: actor.name,
          type: actor.type,
          properties: actor.attributes || {},
        }));
      } catch (err) {
        console.warn('[COP] Failed to fetch graph entities:', err instanceof Error ? err.message : err);
      }

      const layers = await runCOPGeneration(
        data.workspaceId,
        data.sectionId,
        data.triggeredBy,
        { documents, graphEntities },
      );
      if (layers.length > 0) {
        console.log(`[COP] ${layers.length} layers generated for workspace=${data.workspaceId}`);
      } else {
        console.warn(`[COP] No layers produced for workspace=${data.workspaceId}`);
      }
    } catch (error) {
      console.error('[COP] Layer generation failed:', error instanceof Error ? error.message : error);
    }
  });
}

/**
 * Wire document commit trigger: subscribe to copEventBus 'document:committed'
 * events. These are emitted by strategic.ts when documents are approved/committed.
 */
function wireDocumentCommitTrigger(): void {
  copEventBus.on('document:committed', (data) => {
    console.log(`[COP] Document committed: workspace=${data.workspaceId}, section=${data.sectionId}, doc=${data.documentId}`);
    // The trigger handler already emits layer:generation:start when handling commit triggers,
    // which is wired above to runCOPGeneration. The flow is:
    // strategic.ts approval -> copEventBus.emit('document:committed') -> this listener logs
    // strategic.ts also calls triggerHandler.handleCommitTrigger -> emits layer:generation:start
  });
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Initialize the COP module.
 *
 * 1. Load CCO schema for entity classification
 * 2. Ensure database tables exist (layers, versions, linkages)
 * 3. Create shared trigger handler and activity bridge
 * 4. Wire event bus listeners (generation trigger, activity bridge, document commits)
 * 5. Seed COP agent definitions into database
 * 6. Inject dependencies into API handlers
 *
 * Call once at application startup. Safe to call multiple times (idempotent).
 */
export async function initCOP(): Promise<void> {
  if (initialized) {
    console.log('[COP] Already initialized, skipping');
    return;
  }

  console.log('[COP] Initializing COP module...');

  // 1. Load CCO schema
  try {
    loadCCOSchema();
    console.log('[COP] CCO schema loaded');
  } catch (error) {
    console.warn('[COP] CCO schema load failed (non-fatal):', error instanceof Error ? error.message : error);
  }

  // 2. Ensure database tables exist
  try {
    await layerStore.ensureTable();
    await versionStore.ensureTable();
    await linkageStore.ensureTable();
    console.log('[COP] Database tables ensured');
  } catch (error) {
    console.warn('[COP] Table creation failed (non-fatal):', error instanceof Error ? error.message : error);
  }

  // 3. Create shared instances
  _triggerHandler = new TriggerHandler(copEventBus);
  _activityBridge = new ActivityBridge(copEventBus);

  // 4. Wire event bus listeners
  wireGenerationTrigger(_triggerHandler);
  wireDocumentCommitTrigger();
  console.log('[COP] Event bus wired: generation trigger, document commits, activity bridge');

  // 5. Seed agent definitions
  await seedCOPAgents();

  // 6. Inject dependencies into API handlers
  setHandlerDependencies(_triggerHandler, _activityBridge);

  initialized = true;
  console.log('[COP] Module initialized successfully');
}

/**
 * Get the trigger handler instance (for use by strategic.ts document commit wiring).
 * Returns null if COP module not yet initialized.
 */
export function getCOPTriggerHandler(): TriggerHandler | null {
  return _triggerHandler ?? null;
}

/**
 * Notify COP that a relevant change has occurred in the system.
 * This triggers layer regeneration for the affected workspace.
 * Safe to call even if COP module is not initialized (no-op).
 *
 * @param workspaceId - Problem set ID
 * @param source - What triggered the change (for logging)
 */
export function notifyCOPChange(workspaceId: string, source: string): void {
  if (!_triggerHandler) return;
  console.log(`[COP] Change notification from ${source} for workspace=${workspaceId}`);
  _triggerHandler.handleManualTrigger(workspaceId, 'default');
}
