/**
 * Ironclaw HTTP Client
 *
 * Phase 30 Plan 02: HTTP client to the Ironclaw sidecar runtime.
 * Uses native fetch (Node 18+).
 *
 * Ironclaw exposes two HTTP surfaces:
 * - HTTP webhook channel (port 8080): POST /webhook with {content, secret, thread_id}
 * - Web gateway (port 3000): OpenAI-compatible /v1/chat/completions + web UI
 *
 * This client targets the HTTP webhook channel. Authentication is via the
 * shared secret passed in the request body (not HMAC headers).
 */

// ---------------------------------------------------------------------------
// Webhook response from Ironclaw
// ---------------------------------------------------------------------------

export interface WebhookResponse {
  message_id: string;
  status: string;
  response: string | null;
}

// ---------------------------------------------------------------------------
// IronclawClient
// ---------------------------------------------------------------------------

export class IronclawClient {
  private baseUrl: string;
  private secret: string | null;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.IRONCLAW_URL ?? 'http://ironclaw:8080';
    this.secret = process.env.IRONCLAW_SHARED_SECRET || null;
  }

  /**
   * Send a message to the Ironclaw sidecar via the webhook channel.
   * Uses thread_id for conversation continuity across messages.
   * With wait_for_response=true, blocks until Ironclaw produces a reply.
   */
  async sendMessage(
    threadId: string,
    content: string,
  ): Promise<WebhookResponse> {
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
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(
        `Ironclaw sendMessage failed: ${response.status} ${response.statusText} ${text}`,
      );
    }

    return (await response.json()) as WebhookResponse;
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
