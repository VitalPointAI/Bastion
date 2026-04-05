/**
 * Sidecar Sync Service
 *
 * Phase 66 Plan 07: Bidirectional sync between BASTION concept store and
 * Ironclaw sidecar. Pushes consolidated concepts via REPL /memory commands
 * and triggers memory forget on thread deletion.
 *
 * All operations are best-effort — sidecar unavailability never blocks
 * primary BASTION operations.
 *
 * Threat model:
 * - T-66-16: Sidecar communication is internal Docker network; HMAC auth on webhook
 * - T-66-17: 100ms delay between bulk pushes; consolidation runs every 6h
 */

import { ironclawClient } from './ironclaw-client.js';
import type { ConceptEntry } from './concept-types.js';

// ---------------------------------------------------------------------------
// Memory support detection (cached after first check)
// ---------------------------------------------------------------------------

let sidecarMemorySupported: boolean | null = null;

async function checkSidecarMemorySupport(): Promise<boolean> {
  if (sidecarMemorySupported !== null) return sidecarMemorySupported;
  try {
    const result = await ironclawClient.sendMessage('system', '/memory list');
    sidecarMemorySupported =
      result.response !== null && !result.response.includes('unknown command');
    console.log(
      `[ironclaw] sidecar memory support: ${sidecarMemorySupported ? 'YES' : 'NO'}`,
    );
  } catch {
    sidecarMemorySupported = false;
    console.warn(
      '[ironclaw] sidecar memory support check failed — assuming not supported',
    );
  }
  return sidecarMemorySupported;
}

// ---------------------------------------------------------------------------
// Push a single concept to sidecar
// ---------------------------------------------------------------------------

async function pushConceptToSidecar(concept: ConceptEntry): Promise<void> {
  try {
    const supported = await checkSidecarMemorySupport();
    if (!supported) {
      console.log(
        `[ironclaw] sidecar sync skipped (memory commands not supported): ${concept.conceptKey}`,
      );
      return;
    }

    const value =
      typeof concept.currentValue === 'object' && concept.currentValue !== null
        ? ((concept.currentValue as Record<string, unknown>).text as string) ??
          JSON.stringify(concept.currentValue)
        : String(concept.currentValue);

    await ironclawClient.sendMessage(
      'system',
      `/memory update ${concept.conceptKey} ${value}`,
    );
  } catch (err) {
    console.error(
      `[ironclaw] sidecar push failed for ${concept.conceptKey}:`,
      err,
    );
    // Non-blocking — sidecar sync is best-effort
  }
}

// ---------------------------------------------------------------------------
// Forget a thread from sidecar memory
// ---------------------------------------------------------------------------

async function forgetThread(threadId: string): Promise<void> {
  try {
    const supported = await checkSidecarMemorySupport();
    if (!supported) return;
    await ironclawClient.sendMessage('system', `/memory forget ${threadId}`);
  } catch (err) {
    console.error(
      `[ironclaw] sidecar forget failed for thread ${threadId}:`,
      err,
    );
  }
}

// ---------------------------------------------------------------------------
// Bulk push concepts (used after consolidation)
// ---------------------------------------------------------------------------

/**
 * Push multiple concepts to sidecar with 100ms delay between calls
 * to avoid flooding. Returns count of successfully pushed concepts.
 */
async function pushBulkConcepts(concepts: ConceptEntry[]): Promise<number> {
  let pushed = 0;
  for (const concept of concepts) {
    try {
      await pushConceptToSidecar(concept);
      pushed++;
      // 100ms delay between pushes (T-66-17)
      if (concepts.indexOf(concept) < concepts.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    } catch {
      // Individual push failure logged inside pushConceptToSidecar
    }
  }
  return pushed;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export const sidecarSyncService = {
  pushConceptToSidecar,
  forgetThread,
  pushBulkConcepts,
  checkSidecarMemorySupport,
};
