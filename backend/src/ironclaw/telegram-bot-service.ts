/**
 * Telegram Bot Service
 *
 * Bidirectional Telegram ↔ Ironclaw bridge.
 * Uses the Telegram Bot API directly via fetch — no library needed.
 *
 * Features:
 *   - Pairing: 6-digit code flow to link Telegram chat → Bastion DID
 *   - Chat: Forward messages from Telegram to Ironclaw, send responses back
 *   - Notifications: Push alerts from Ironclaw routines to Telegram
 *
 * Paired users can chat with their Ironclaw Chief of Staff directly from
 * Telegram — same as the Bastion drawer, different channel.
 */

import { ironclawClient } from './ironclaw-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PairingSession {
  code: string;
  chatId: string;
  createdAt: number;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: { id: number };
    from?: { id: number; username?: string };
    text?: string;
    date: number;
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TELEGRAM_API = 'https://api.telegram.org/bot';
const CODE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const CLEANUP_INTERVAL_MS = 60 * 1000; // cleanup expired codes every minute

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

class TelegramBotService {
  private token: string | null = null;
  /** Maps DID → active pairing session */
  private pairingSessions = new Map<string, PairingSession>();
  /** Maps Telegram username (lowercase) → chat ID, learned from /start messages */
  private knownChats = new Map<string, string>();
  /** Maps Telegram chatId → DID for paired users (loaded from agent_config) */
  private pairedChats = new Map<string, string>();
  private lastUpdateId = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize with bot token. Starts polling for /start messages
   * so we can discover user chat IDs.
   */
  initialize(token?: string): boolean {
    this.token = token ?? process.env.TELEGRAM_BOT_TOKEN ?? null;
    if (!this.token) {
      console.warn('[TelegramBot] No TELEGRAM_BOT_TOKEN — Telegram pairing disabled');
      return false;
    }
    console.log('[TelegramBot] Initialized — polling for messages');

    // Load paired chats from database
    void this.loadPairedChats();

    // Poll for new messages every 3 seconds
    this.pollTimer = setInterval(() => void this.pollUpdates(), 3000);
    // Cleanup expired pairing sessions
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);

    // Initial poll
    void this.pollUpdates();
    return true;
  }

  get isEnabled(): boolean {
    return this.token !== null;
  }

  /**
   * Generate a pairing code and send it to the user's Telegram.
   * The user must provide their Telegram username so we can find their chat.
   */
  async generatePairingCode(did: string, telegramUsername: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.token) {
      return { ok: false, error: 'Telegram bot not configured' };
    }

    // Normalize username (strip @ prefix, lowercase)
    const normalized = telegramUsername.replace(/^@/, '').toLowerCase();

    // Look up chat ID from known /start messages
    const chatId = this.knownChats.get(normalized);
    if (!chatId) {
      return {
        ok: false,
        error: `No chat found for @${normalized}. Please open Telegram, search for the bot, and send /start first. Then try again.`,
      };
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store session
    this.pairingSessions.set(did, { code, chatId, createdAt: Date.now() });

    // Send code via Telegram
    const sent = await this.sendMessage(
      chatId,
      `🔐 *Bastion Pairing Code*\n\nYour Ironclaw pairing code is:\n\n\`${code}\`\n\nEnter this code in the Bastion Agent Config panel.\nThis code expires in 5 minutes.`,
    );

    if (!sent) {
      this.pairingSessions.delete(did);
      return { ok: false, error: 'Failed to send Telegram message. Make sure you have started a chat with the bot.' };
    }

    return { ok: true };
  }

  /**
   * Confirm a pairing code. Returns the chat ID if valid.
   * Registers the chatId → DID mapping for message forwarding.
   */
  confirmPairingCode(did: string, code: string): { ok: boolean; chatId?: string; error?: string } {
    const session = this.pairingSessions.get(did);
    if (!session) {
      return { ok: false, error: 'No active pairing session. Please start the pairing process again.' };
    }

    if (Date.now() - session.createdAt > CODE_EXPIRY_MS) {
      this.pairingSessions.delete(did);
      return { ok: false, error: 'Pairing code expired. Please start again.' };
    }

    if (session.code !== code.trim()) {
      return { ok: false, error: 'Invalid code. Please check and try again.' };
    }

    // Success — register for message forwarding and clean up
    this.pairedChats.set(session.chatId, did);
    this.pairingSessions.delete(did);

    void this.sendMessage(
      session.chatId,
      '✅ *Paired successfully!*\n\nYou can now chat with Ironclaw directly from here. Just type a message.',
    );

    return { ok: true, chatId: session.chatId };
  }

  /**
   * Send a notification to a user's Telegram chat.
   * Used by routines/heartbeat for pushing alerts.
   */
  async sendNotification(chatId: string, text: string): Promise<boolean> {
    return this.sendMessage(chatId, text);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  private async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.token) return false;
    try {
      const res = await fetch(`${TELEGRAM_API}${this.token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        console.error(`[TelegramBot] sendMessage failed: ${res.status} ${body}`);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[TelegramBot] sendMessage error:', err);
      return false;
    }
  }

  /**
   * Poll for new Telegram messages to discover chat IDs from /start commands.
   */
  private async pollUpdates(): Promise<void> {
    if (!this.token) return;
    try {
      const res = await fetch(
        `${TELEGRAM_API}${this.token}/getUpdates?offset=${this.lastUpdateId + 1}&timeout=0&allowed_updates=["message"]`,
      );
      if (!res.ok) return;

      const data = await res.json() as { ok: boolean; result: TelegramUpdate[] };
      if (!data.ok || !data.result.length) return;

      for (const update of data.result) {
        this.lastUpdateId = Math.max(this.lastUpdateId, update.update_id);

        const msg = update.message;
        if (!msg?.from?.username) continue;

        const username = msg.from.username.toLowerCase();
        const chatId = msg.chat.id.toString();

        // Remember this user's chat ID
        if (!this.knownChats.has(username)) {
          console.log(`[TelegramBot] Learned chat ID for @${username}`);
        }
        this.knownChats.set(username, chatId);

        // Handle commands
        if (msg.text === '/start') {
          void this.sendMessage(
            chatId,
            '👋 *Welcome to Bastion Ironclaw Bot*\n\nThis bot connects you to your Ironclaw Chief of Staff.\n\nTo pair your account, go to the Agent Config panel in Bastion and click "Pair Telegram" in the Channels tab.\n\nOnce paired, you can chat with Ironclaw directly from here.',
          );
          continue;
        }

        if (msg.text === '/status') {
          const paired = this.pairedChats.has(chatId);
          void this.sendMessage(chatId, paired
            ? '✅ Your Telegram is paired with Bastion. Send any message to chat with Ironclaw.'
            : '❌ Not paired. Open Bastion → Agent Config → Channels → Pair Telegram.');
          continue;
        }

        // Forward messages from paired users to Ironclaw
        if (msg.text && !msg.text.startsWith('/')) {
          void this.handleIncomingMessage(chatId, msg.text);
        }
      }
    } catch {
      // Silent — polling failures are transient
    }
  }

  /**
   * Forward a Telegram message to Ironclaw and send the response back.
   */
  private async handleIncomingMessage(chatId: string, text: string): Promise<void> {
    const did = this.pairedChats.get(chatId);
    if (!did) {
      void this.sendMessage(chatId, '❌ Your Telegram is not paired with Bastion. Open Bastion → Agent Config → Channels → Pair Telegram.');
      return;
    }

    try {
      // Send typing indicator
      void fetch(`${TELEGRAM_API}${this.token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      });

      // Forward to Ironclaw — use DID as thread ID for conversation continuity
      const response = await ironclawClient.sendMessage(did, text, did);

      // Send Ironclaw's response back to Telegram
      const reply = response.response ?? 'No response from Ironclaw.';

      // Telegram has a 4096 char limit — split long messages
      const chunks = this.splitMessage(reply, 4000);
      for (const chunk of chunks) {
        await this.sendMessage(chatId, chunk);
      }
    } catch (err) {
      console.error(`[TelegramBot] Error forwarding message for ${did}:`, err);
      void this.sendMessage(chatId, '⚠️ Could not reach Ironclaw. Please try again.');
    }
  }

  /**
   * Split a long message into chunks that fit Telegram's 4096 char limit.
   */
  private splitMessage(text: string, maxLen: number): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= maxLen) {
        chunks.push(remaining);
        break;
      }
      // Try to split at a newline
      let splitAt = remaining.lastIndexOf('\n', maxLen);
      if (splitAt < maxLen * 0.5) splitAt = maxLen;
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
  }

  /**
   * Load paired chatId → DID mappings from agent_config at startup.
   */
  private async loadPairedChats(): Promise<void> {
    try {
      const { getPool } = await import('../lib/database.js');
      const result = await getPool().query(
        "SELECT did, telegram_chat_id FROM agent_config WHERE telegram_enabled = true AND telegram_chat_id IS NOT NULL",
      );
      for (const row of result.rows) {
        this.pairedChats.set(row.telegram_chat_id as string, row.did as string);
      }
      if (this.pairedChats.size > 0) {
        console.log(`[TelegramBot] Loaded ${this.pairedChats.size} paired chat(s)`);
      }
    } catch (err) {
      console.warn('[TelegramBot] Could not load paired chats:', err instanceof Error ? err.message : err);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [did, session] of this.pairingSessions) {
      if (now - session.createdAt > CODE_EXPIRY_MS) {
        this.pairingSessions.delete(did);
      }
    }
  }

  shutdown(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const telegramBotService = new TelegramBotService();
