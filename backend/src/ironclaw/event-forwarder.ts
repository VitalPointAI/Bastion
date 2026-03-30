/**
 * Event Forwarder
 *
 * Phase 65 Plan 03: Batched event forwarding from Bastion pipelines to Ironclaw.
 *
 * Events from OSINT ingestion, document processing, and graph changes are
 * buffered per problem set and flushed to Ironclaw in 30-second windows.
 * This prevents forwarding storms from high-volume ingestion runs.
 *
 * Design principles:
 * - Fire-and-forget: sendMessageAsync is used so pipelines are never blocked
 * - Fault-isolated: all errors are caught and logged, never re-thrown
 * - Per-problem-set batching: each problem set has its own buffer and timer
 */

import { ironclawClient } from './ironclaw-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ForwardedEvent {
  /** Category of event */
  type: 'osint_ingested' | 'document_processed' | 'graph_changed';
  /** Problem set this event belongs to */
  problemSetId: string;
  /** Human-readable summary of what happened */
  summary: string;
  /** Optional entity IDs involved */
  entityIds?: string[];
}

interface EventSummary {
  type: ForwardedEvent['type'];
  summary: string;
  entityIds?: string[];
  enqueuedAt: number;
}

// ---------------------------------------------------------------------------
// Flush interval
// ---------------------------------------------------------------------------

/** Batch window: events within 30 seconds of the first event are grouped */
const FLUSH_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// EventForwarder class
// ---------------------------------------------------------------------------

export class EventForwarder {
  /** Buffered events, keyed by problemSetId */
  private buffers = new Map<string, EventSummary[]>();

  /** Active flush timers, keyed by problemSetId */
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  /**
   * Enqueue an event for batched forwarding to Ironclaw.
   * Starts the flush timer for this problem set if not already running.
   */
  enqueue(event: ForwardedEvent): void {
    const { problemSetId } = event;

    // Initialize buffer if needed
    if (!this.buffers.has(problemSetId)) {
      this.buffers.set(problemSetId, []);
    }

    this.buffers.get(problemSetId)!.push({
      type: event.type,
      summary: event.summary,
      entityIds: event.entityIds,
      enqueuedAt: Date.now(),
    });

    // Start flush timer if not already running for this problem set
    if (!this.timers.has(problemSetId)) {
      const timer = setTimeout(() => {
        this.flush(problemSetId);
      }, FLUSH_INTERVAL_MS);

      this.timers.set(problemSetId, timer);
    }
  }

  /**
   * Flush all buffered events for a problem set to Ironclaw.
   * Clears the buffer and timer. Called automatically after 30 seconds.
   */
  flush(problemSetId: string): void {
    // Clear timer reference
    const timer = this.timers.get(problemSetId);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(problemSetId);
    }

    const events = this.buffers.get(problemSetId);
    if (!events || events.length === 0) {
      this.buffers.delete(problemSetId);
      return;
    }

    // Clear buffer before async send so new events start a fresh window
    this.buffers.delete(problemSetId);

    // Build batched message
    const count = events.length;
    const lines = events.map((e) => `- ${e.type}: ${e.summary}`);
    const message = `[EVENTS] ${count} event${count === 1 ? '' : 's'} since last check:\n${lines.join('\n')}`;

    // Fire-and-forget to Ironclaw on the autonomous thread for this problem set
    const threadId = `autonomous-${problemSetId}`;
    ironclawClient.sendMessageAsync(threadId, message).catch((err) => {
      console.warn(
        `[event-forwarder] Failed to flush ${count} event(s) for problem set ${problemSetId}:`,
        err instanceof Error ? err.message : String(err),
      );
    });
  }

  /**
   * Immediately flush all buffered problem sets.
   * Useful for graceful shutdown.
   */
  flushAll(): void {
    for (const problemSetId of [...this.buffers.keys()]) {
      this.flush(problemSetId);
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const eventForwarder = new EventForwarder();

// ---------------------------------------------------------------------------
// Convenience wrapper
// ---------------------------------------------------------------------------

/**
 * Forward a pipeline event to Ironclaw (batched, fire-and-forget).
 *
 * Safe to call from any pipeline — errors are caught and logged,
 * never re-thrown. This function NEVER blocks or throws.
 */
export function forwardEventToIronclaw(event: ForwardedEvent): void {
  try {
    eventForwarder.enqueue(event);
  } catch (err) {
    console.warn(
      '[event-forwarder] forwardEventToIronclaw: unexpected error (swallowed):',
      err instanceof Error ? err.message : String(err),
    );
  }
}
