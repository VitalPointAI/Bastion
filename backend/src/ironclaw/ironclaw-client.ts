/**
 * Ironclaw HTTP Client
 *
 * Phase 30 Plan 02: HTTP client to the Ironclaw sidecar runtime.
 * Phase 60 Plan 01: Added transactional SET LOCAL for per-user DID scope,
 *   MCP server registration, and didToSlug utility.
 *
 * Ironclaw exposes two HTTP surfaces:
 * - HTTP webhook channel (port 8080): POST /webhook with {content, secret, thread_id}
 * - Web gateway (port 3000): OpenAI-compatible /v1/chat/completions + web UI
 *
 * This client targets the HTTP webhook channel. Authentication is via the
 * shared secret passed in the request body (not HMAC headers).
 *
 * SECURITY: SET LOCAL must always be executed inside an explicit transaction
 * (BEGIN/COMMIT). In a connection pool, a plain SET (without LOCAL) persists
 * for the pooled connection lifetime, causing cross-user contamination.
 * withDIDScope acquires a dedicated client, begins a transaction, sets the
 * DID slug locally, runs the work, then commits and releases.
 */

import pg from 'pg';

// ---------------------------------------------------------------------------
// Webhook response from Ironclaw
// ---------------------------------------------------------------------------

export interface WebhookResponse {
  message_id: string;
  status: string;
  response: string | null;
}

// ---------------------------------------------------------------------------
// DID utility
// ---------------------------------------------------------------------------

/**
 * Convert a DID to a URL-safe slug used as the app.current_did_slug value.
 * Example: "did:near:alice.near" → "alice-near"
 */
export function didToSlug(did: string): string {
  return did.replace('did:near:', '').replace(/\./g, '-');
}

// ---------------------------------------------------------------------------
// IronclawClient
// ---------------------------------------------------------------------------

export class IronclawClient {
  private baseUrl: string;
  private secret: string | null;
  private pool: pg.Pool | null = null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.IRONCLAW_URL ?? 'http://ironclaw:8080';
    this.secret = process.env.IRONCLAW_SHARED_SECRET || null;

    // Lazily initialise the Ironclaw PostgreSQL pool only if DATABASE_URL_IRONCLAW
    // (or IRONCLAW_DB_URL) is provided. Without it, DID-scoped writes are no-ops.
    const ironclawDbUrl =
      process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL ?? null;
    if (ironclawDbUrl) {
      this.pool = new pg.Pool({ connectionString: ironclawDbUrl });
    }
  }

  // ---------------------------------------------------------------------------
  // DID scope helpers
  // ---------------------------------------------------------------------------

  /**
   * Execute `fn` inside a dedicated connection transaction scoped to `didSlug`.
   *
   * Protocol:
   *   1. Acquire dedicated connection from pool
   *   2. BEGIN
   *   3. SET LOCAL app.current_did_slug = $1  (parameterised — no SQL injection)
   *   4. Invoke fn(client)
   *   5. COMMIT
   *   6. release() in finally
   *
   * On error: ROLLBACK before release.
   *
   * CRITICAL: SET LOCAL outside a transaction is undefined behaviour in
   * connection pool mode — use this method whenever you need scoped writes.
   */
  async withDIDScope<T>(
    didSlug: string,
    fn: (client: pg.PoolClient) => Promise<T>,
  ): Promise<T> {
    if (!this.pool) {
      throw new Error(
        'IronclawClient: pool not initialised — set DATABASE_URL_IRONCLAW or IRONCLAW_DB_URL',
      );
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL app.current_did_slug = $1', [didSlug]);
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Execute only the SET LOCAL statement on a caller-managed transaction client.
   *
   * Use this when the caller already holds a BEGIN'd transaction and needs to
   * add DID scoping to it. The caller is responsible for BEGIN and COMMIT.
   */
  async setCurrentDID(didSlug: string, client: pg.PoolClient): Promise<void> {
    await client.query('SET LOCAL app.current_did_slug = $1', [didSlug]);
  }

  // ---------------------------------------------------------------------------
  // MCP registration
  // ---------------------------------------------------------------------------

  /**
   * Register Bastion as an MCP server with Ironclaw.
   * Called once at startup after Ironclaw health check passes.
   *
   * Sends the MCP add command via the webhook channel so Ironclaw discovers
   * all Bastion tools at the given URL (default: http://bastion-mcp:3334/mcp).
   */
  async registerMcpServer(
    mcpUrl: string = process.env.MCP_BASTION_URL ?? 'http://bastion-mcp:3334/mcp',
  ): Promise<WebhookResponse> {
    return this.sendMessage(
      'mcp-registration',
      `/mcp add bastion-core ${mcpUrl}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Webhook methods
  // ---------------------------------------------------------------------------

  /**
   * Send a message to the Ironclaw sidecar via the webhook channel.
   * Uses thread_id for conversation continuity across messages.
   * With wait_for_response=true, blocks until Ironclaw produces a reply.
   *
   * @param didSlug — when provided, the webhook dispatch runs inside a
   *   withDIDScope transaction so workspace writes are scoped to this DID.
   */
  async sendMessage(
    threadId: string,
    content: string,
    didSlug?: string,
    timeoutMs = 120_000,
  ): Promise<WebhookResponse> {
    const dispatch = async () => {
      const body = JSON.stringify({
        content,
        thread_id: threadId,
        user: threadId,  // Match thread owner to thread_id so Ironclaw doesn't reject
        secret: this.secret,
        wait_for_response: true,
      });

      const response = await fetch(`${this.baseUrl}/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(
          `Ironclaw sendMessage failed: ${response.status} ${response.statusText} ${text}`,
        );
      }

      return (await response.json()) as WebhookResponse;
    };

    if (didSlug && this.pool) {
      return this.withDIDScope(didSlug, async (_client) => dispatch());
    }

    return dispatch();
  }

  /**
   * Fire-and-forget: send a message without waiting for the response.
   * Returns immediately with the message_id and status "accepted".
   */
  async sendMessageAsync(
    threadId: string,
    content: string,
  ): Promise<WebhookResponse> {
    const body = JSON.stringify({
      content,
      thread_id: threadId,
      user: threadId,
      secret: this.secret,
      wait_for_response: false,
    });

    const response = await fetch(`${this.baseUrl}/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Ironclaw sendMessageAsync failed: ${response.status} ${response.statusText} ${text}`,
      );
    }

    return (await response.json()) as WebhookResponse;
  }

  /**
   * Health check against the Ironclaw sidecar.
   * Returns true if healthy, false otherwise.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`);
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const ironclawClient = new IronclawClient();
