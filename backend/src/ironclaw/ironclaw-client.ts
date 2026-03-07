/**
 * Ironclaw HTTP Client
 *
 * Phase 30 Plan 02: HTTP client to the Ironclaw sidecar runtime.
 * Uses native fetch (Node 18+). Supports SSE streaming for chat responses.
 * All requests are HMAC-signed when IRONCLAW_SHARED_SECRET is configured.
 */

import { signRequest } from './hmac-auth.js';

// ---------------------------------------------------------------------------
// SSE Event interface
// ---------------------------------------------------------------------------

export interface SSEEvent {
  event?: string;
  data: string;
}

// ---------------------------------------------------------------------------
// SSE Stream Parser
// ---------------------------------------------------------------------------

/**
 * Parse an SSE stream (ReadableStream<Uint8Array>) into an async generator
 * of parsed events. Follows the Server-Sent Events specification:
 * - Events separated by double newlines
 * - Lines prefixed with "event:" and "data:"
 * - Lines starting with ":" are comments (ignored)
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Split on double newlines (SSE event boundary)
      const parts = buffer.split('\n\n');
      // Last part may be incomplete — keep in buffer
      buffer = parts.pop() ?? '';

      for (const part of parts) {
        if (!part.trim()) continue;

        let event: string | undefined;
        const dataLines: string[] = [];

        for (const line of part.split('\n')) {
          if (line.startsWith(':')) {
            // Comment line, skip
            continue;
          }
          if (line.startsWith('event:')) {
            event = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim());
          }
        }

        if (dataLines.length > 0) {
          yield { event, data: dataLines.join('\n') };
        }
      }
    }

    // Flush any remaining data in buffer
    if (buffer.trim()) {
      const dataLines: string[] = [];
      let event: string | undefined;
      for (const line of buffer.split('\n')) {
        if (line.startsWith(':')) continue;
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (dataLines.length > 0) {
        yield { event, data: dataLines.join('\n') };
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ---------------------------------------------------------------------------
// IronclawClient
// ---------------------------------------------------------------------------

export class IronclawClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? process.env.IRONCLAW_URL ?? 'http://ironclaw:8080';
  }

  /**
   * Send a chat message to the Ironclaw sidecar.
   * Returns the raw ReadableStream for SSE streaming.
   */
  async sendMessage(
    sessionId: string,
    content: string,
    mentionedAgent?: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const path = '/api/chat';
    const body = JSON.stringify({
      session_id: sessionId,
      message: content,
      mentioned_agent: mentionedAgent,
    });
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signRequest('POST', path, body) },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Ironclaw sendMessage failed: ${response.status} ${response.statusText}`,
      );
    }

    if (!response.body) {
      throw new Error('Ironclaw sendMessage: response body is null');
    }

    return response.body;
  }

  /**
   * Create a new session on the Ironclaw sidecar with a system prompt.
   */
  async createSession(
    sessionId: string,
    systemPrompt: string,
  ): Promise<{ session_id: string }> {
    const path = '/api/sessions';
    const body = JSON.stringify({
      session_id: sessionId,
      system_prompt: systemPrompt,
    });
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signRequest('POST', path, body) },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Ironclaw createSession failed: ${response.status} ${response.statusText}`,
      );
    }

    return (await response.json()) as { session_id: string };
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

  /**
   * Register BASTION as an MCP server that Ironclaw can connect to.
   */
  async registerMCPServer(
    serverUrl: string,
    tools: Array<{
      name: string;
      description: string;
      inputSchema: Record<string, unknown>;
    }>,
  ): Promise<void> {
    const path = '/api/mcp/register';
    const body = JSON.stringify({ server_url: serverUrl, tools });
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...signRequest('POST', path, body) },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `Ironclaw registerMCPServer failed: ${response.status} ${response.statusText}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const ironclawClient = new IronclawClient();
