/**
 * Ironclaw Event Store
 *
 * Phase 67 Plan 01: PostgreSQL-backed event persistence for the Ironclaw
 * SSE streaming infrastructure. Stores events in the ironclaw_events table
 * in the main Bastion DB and emits SSE chunks to connected clients.
 *
 * Key responsibilities:
 *  - ensureTable(): idempotent table creation on startup
 *  - append(): persist events and push to connected SSE clients
 *  - getEventsSince(): Last-Event-ID replay for reconnecting clients
 *  - registerClient() / removeClient(): in-memory SSE client registry
 *
 * IMPORTANT: uses getPool() from lib/database.js (main Bastion DB),
 * NOT getIronclawPool() from ironclaw-client.ts. Events are stored in
 * the Bastion DB per RESEARCH.md A3.
 */

import { getPool } from '../lib/database.js';
import type { Response } from 'express';
import type { IronclawEventType } from './ironclaw-event-types.js';

// ---------------------------------------------------------------------------
// Event Store
// ---------------------------------------------------------------------------

export class IronclawEventStore {
  /**
   * In-memory SSE client registry keyed by scopeId.
   * Each scope maps to a Set of active Express Response objects.
   */
  private clients = new Map<string, Set<Response>>();

  // -------------------------------------------------------------------------
  // Table lifecycle
  // -------------------------------------------------------------------------

  /**
   * Creates the ironclaw_events table and indexes idempotently.
   * Called on router startup — safe to call multiple times.
   */
  async ensureTable(): Promise<void> {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ironclaw_events (
        id         BIGSERIAL PRIMARY KEY,
        scope_id   TEXT NOT NULL,
        user_did   TEXT NOT NULL,
        thread_id  UUID,
        event_type TEXT NOT NULL,
        payload    JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ironclaw_events_scope_id ON ironclaw_events (scope_id, id);
      CREATE INDEX IF NOT EXISTS idx_ironclaw_events_thread ON ironclaw_events (thread_id, id);
    `);
  }

  // -------------------------------------------------------------------------
  // Event persistence
  // -------------------------------------------------------------------------

  /**
   * Persists an event to the ironclaw_events table, then emits it to all
   * connected SSE clients for the given scopeId.
   *
   * @returns The auto-generated numeric event id.
   */
  async append(
    scopeId: string,
    userDid: string,
    eventType: IronclawEventType,
    payload: unknown,
    threadId?: string,
  ): Promise<number> {
    const pool = getPool();
    const result = await pool.query<{ id: number }>(
      `INSERT INTO ironclaw_events (scope_id, user_did, thread_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [scopeId, userDid, threadId ?? null, eventType, JSON.stringify(payload)],
    );
    const id = result.rows[0].id;
    this.emit(scopeId, eventType, payload, id);

    // Notify other processes (e.g. bastion-mcp → bastion-backend) via pg NOTIFY
    // so they can relay to their own in-memory SSE clients.
    try {
      const notification = JSON.stringify({ id, scopeId, eventType, payload });
      await pool.query('SELECT pg_notify($1, $2)', ['ironclaw_event', notification]);
    } catch {
      // Non-critical — local emit already handled above
    }

    return id;
  }

  /**
   * Subscribe to PostgreSQL NOTIFY channel for cross-process SSE relay.
   * When another process (e.g. bastion-mcp) inserts an event, this process
   * receives the notification and pushes it to its local SSE clients.
   */
  async startListening(): Promise<void> {
    const pool = getPool();
    const client = await pool.connect();
    await client.query('LISTEN ironclaw_event');
    client.on('notification', (msg) => {
      if (msg.channel !== 'ironclaw_event' || !msg.payload) return;
      try {
        const { id, scopeId, eventType, payload } = JSON.parse(msg.payload);
        // Only emit if we have local SSE clients for this scope
        // (avoids duplicate emission in the process that wrote the event)
        const clientSet = this.clients.get(scopeId);
        if (clientSet && clientSet.size > 0) {
          this.emit(scopeId, eventType, payload, id);
        }
      } catch {
        // Malformed notification — ignore
      }
    });
    console.log('[IronclawEventStore] Listening for cross-process SSE relay via pg NOTIFY');
  }

  // -------------------------------------------------------------------------
  // SSE emission
  // -------------------------------------------------------------------------

  /**
   * Writes an SSE chunk to all registered clients for the given scopeId.
   * Clients that throw on write are removed from the registry.
   */
  private emit(
    scopeId: string,
    eventType: string,
    payload: unknown,
    id: number,
  ): void {
    const clientSet = this.clients.get(scopeId);
    if (!clientSet || clientSet.size === 0) return;

    const chunk = `id: ${id}\nevent: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    const dead: Response[] = [];

    for (const res of clientSet) {
      try {
        res.write(chunk);
      } catch {
        dead.push(res);
      }
    }

    for (const res of dead) {
      clientSet.delete(res);
    }
    if (clientSet.size === 0) {
      this.clients.delete(scopeId);
    }
  }

  // -------------------------------------------------------------------------
  // Client registry
  // -------------------------------------------------------------------------

  /**
   * Registers an SSE client Response for the given scopeId.
   * After registration, the client will receive all future events for the scope.
   */
  registerClient(scopeId: string, res: Response): void {
    let set = this.clients.get(scopeId);
    if (!set) {
      set = new Set();
      this.clients.set(scopeId, set);
    }
    set.add(res);
  }

  /**
   * Removes an SSE client from the registry (called on request close).
   */
  removeClient(scopeId: string, res: Response): void {
    const set = this.clients.get(scopeId);
    if (!set) return;
    set.delete(res);
    if (set.size === 0) {
      this.clients.delete(scopeId);
    }
  }

  /**
   * Returns the number of connected clients for a given scopeId.
   * Used for connection limit enforcement.
   */
  getClientCount(scopeId: string): number {
    return this.clients.get(scopeId)?.size ?? 0;
  }

  // -------------------------------------------------------------------------
  // Last-Event-ID replay
  // -------------------------------------------------------------------------

  /**
   * Returns events with id > lastId for the given scopeId, ordered ASC.
   * Optionally filtered by threadId for thread-scoped replays.
   */
  async getEventsSince(
    scopeId: string,
    lastId: number,
    threadId?: string,
  ): Promise<Array<{ id: number; event_type: string; payload: unknown }>> {
    const pool = getPool();

    if (threadId) {
      const result = await pool.query<{ id: number; event_type: string; payload: unknown }>(
        `SELECT id, event_type, payload
         FROM ironclaw_events
         WHERE scope_id = $1 AND id > $2 AND thread_id = $3
         ORDER BY id ASC`,
        [scopeId, lastId, threadId],
      );
      return result.rows;
    }

    const result = await pool.query<{ id: number; event_type: string; payload: unknown }>(
      `SELECT id, event_type, payload
       FROM ironclaw_events
       WHERE scope_id = $1 AND id > $2
       ORDER BY id ASC`,
      [scopeId, lastId],
    );
    return result.rows;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const ironclawEventStore = new IronclawEventStore();
