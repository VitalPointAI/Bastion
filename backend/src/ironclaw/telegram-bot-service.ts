/**
 * Telegram Bot Service
 *
 * Handles Telegram pairing for Ironclaw Agent Config.
 * Uses the Telegram Bot API directly via fetch — no library needed.
 *
 * Flow:
 *   1. User clicks "Start Pairing" → generatePairingCode(did)
 *   2. Service sends 6-digit code to user's Telegram (user must /start the bot first)
 *   3. User enters code in UI → confirmPairingCode(did, code)
 *   4. Service validates and returns chatId for storage in AgentConfig
 *
 * Limitation: The user must have already sent /start to the bot so we know their
 * chat ID. We use getUpdates polling to discover chat IDs from /start messages.
 */

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
    console.log('[TelegramBot] Initialized — polling for /start messages');

    // Poll for new messages every 5 seconds to learn chat IDs
    this.pollTimer = setInterval(() => void this.pollUpdates(), 5000);
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

    // Success — clean up and return chat ID
    this.pairingSessions.delete(did);
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

        // Auto-reply to /start
        if (msg.text === '/start') {
          void this.sendMessage(
            chatId,
            '👋 *Welcome to Bastion Ironclaw Bot*\n\nThis bot delivers notifications from your Ironclaw Chief of Staff.\n\nTo pair your account, go to the Agent Config panel in Bastion and click "Pair Telegram" in the Channels tab.',
          );
        }
      }
    } catch {
      // Silent — polling failures are transient
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
