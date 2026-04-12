/**
 * Conversation Compaction Service
 *
 * Keeps Ironclaw's internal conversation history bounded without losing
 * semantic continuity. Addresses two problems:
 *
 * 1. User conversations (channel=http) grow linearly. Every webhook call
 *    replays the full history to Haiku. After hundreds of messages this
 *    becomes expensive and eventually exceeds the 200k token window.
 *    Solution: rolling summarization — when the conversation exceeds a
 *    threshold, summarize the oldest messages into a single synthetic
 *    "user" message and delete the originals. Recent messages are kept
 *    verbatim so short-term context is preserved.
 *
 * 2. Autonomous routine conversations (channel=routine) accumulate
 *    forever but don't need continuity between runs. Solution: purge
 *    routine conversation_messages older than 24 hours.
 *
 * Both operations run against Ironclaw's PostgreSQL DB directly since
 * Ironclaw has no external API for history management.
 *
 * IMPORTANT: BASTION's own ironclaw_chat table (user-visible chat history)
 * is UNTOUCHED. Only Ironclaw's internal conversation_messages table is
 * affected. The user sees their full chat; Ironclaw sees a compacted view.
 */

import pg from 'pg';
import { createAnthropicClient } from '../agents/langgraph/llm-factory.js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Trigger compaction when a user conversation exceeds this many messages. */
const COMPACTION_THRESHOLD = 30;

/** After compaction, keep this many recent messages verbatim. */
const RECENT_MESSAGES_TO_KEEP = 15;

/** Cap on individual message length when feeding the summarizer. */
const MAX_MSG_CHARS_FOR_SUMMARY = 2000;

/** Routine conversation messages older than this are purged on cleanup. */
const ROUTINE_MESSAGE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Marker prefix used to identify synthetic summary messages. */
const SUMMARY_MARKER = '[CONVERSATION SUMMARY]';

// ---------------------------------------------------------------------------
// Ironclaw DB pool (lazy-initialized, mirrors pattern from concept-store.ts)
// ---------------------------------------------------------------------------

let ironclawPool: pg.Pool | null = null;

function getIronclawPool(): pg.Pool | null {
  if (!ironclawPool) {
    const url = process.env.DATABASE_URL_IRONCLAW ?? process.env.IRONCLAW_DB_URL;
    if (!url) {
      return null;
    }
    ironclawPool = new pg.Pool({ connectionString: url, max: 3 });
  }
  return ironclawPool;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class ConversationCompactionService {
  /**
   * Check if the active user conversation needs compaction and compact it.
   * Fire-and-forget — errors are logged, never thrown.
   *
   * @param userId Ironclaw user_id whose active conversation should be checked.
   *               Webhook calls typically use 'default'.
   */
  async compactIfNeeded(userId = 'default'): Promise<void> {
    try {
      const pool = getIronclawPool();
      if (!pool) return;

      // Find the most recently active http conversation that exceeds threshold
      const convResult = await pool.query<{ id: string; message_count: string }>(
        `SELECT c.id, count(m.id)::text AS message_count
         FROM conversations c
         LEFT JOIN conversation_messages m ON m.conversation_id = c.id
         WHERE c.user_id = $1 AND c.channel = 'http'
         GROUP BY c.id
         HAVING count(m.id) > $2
         ORDER BY c.last_activity DESC
         LIMIT 1`,
        [userId, COMPACTION_THRESHOLD],
      );

      if (convResult.rows.length === 0) return;

      const conversationId = convResult.rows[0].id;
      const messageCount = parseInt(convResult.rows[0].message_count, 10);
      console.log(
        `[conversation-compaction] Conversation ${conversationId} has ${messageCount} messages — compacting`,
      );

      await this.compactConversation(conversationId);
    } catch (err) {
      console.warn(
        '[conversation-compaction] compactIfNeeded error:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Summarize the oldest messages of a conversation and replace them with
   * a single synthetic summary message. Recent messages are kept verbatim.
   */
  private async compactConversation(conversationId: string): Promise<void> {
    const pool = getIronclawPool();
    if (!pool) return;

    // Fetch all messages in chronological order
    const msgResult = await pool.query<ConversationMessage>(
      `SELECT id, role, content, created_at
       FROM conversation_messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );

    const messages = msgResult.rows;
    if (messages.length <= RECENT_MESSAGES_TO_KEEP) return;

    // Split: oldest → summarize, newest → keep
    const cutoffIdx = messages.length - RECENT_MESSAGES_TO_KEEP;
    const toSummarize = messages.slice(0, cutoffIdx);
    const toKeep = messages.slice(cutoffIdx);

    // If the first message is already a summary (from a prior compaction),
    // include it in the new summary so long-term context compounds.
    const priorSummary = toSummarize[0].content.startsWith(SUMMARY_MARKER)
      ? toSummarize[0].content
      : '';

    // Build the conversation text for the summarizer.
    // Skip the prior summary message since we're passing it separately,
    // and cap individual message length to keep the summarizer call bounded.
    const toSummarizeSkippingPrior = priorSummary ? toSummarize.slice(1) : toSummarize;
    const conversationText = toSummarizeSkippingPrior
      .map((m) => {
        const content = m.content.length > MAX_MSG_CHARS_FOR_SUMMARY
          ? m.content.slice(0, MAX_MSG_CHARS_FOR_SUMMARY) + '...[truncated]'
          : m.content;
        return `${m.role.toUpperCase()}: ${content}`;
      })
      .join('\n\n');

    const summaryText = await this.generateSummary(conversationText, priorSummary);
    if (!summaryText) {
      console.warn('[conversation-compaction] Summary generation returned empty — skipping');
      return;
    }

    // Replace old messages with the new summary in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const oldIds = toSummarize.map((m) => m.id);
      const deleted = await client.query(
        `DELETE FROM conversation_messages WHERE id = ANY($1::uuid[])`,
        [oldIds],
      );

      // Insert summary with created_at just before the first kept message
      // so Ironclaw's chronological replay puts it at position 0
      const summaryCreatedAt = new Date(toKeep[0].created_at.getTime() - 1000);
      await client.query(
        `INSERT INTO conversation_messages (id, conversation_id, role, content, created_at)
         VALUES (gen_random_uuid(), $1, 'user', $2, $3)`,
        [conversationId, summaryText, summaryCreatedAt],
      );

      await client.query('COMMIT');
      console.log(
        `[conversation-compaction] Compacted conversation ${conversationId}: ${deleted.rowCount} old messages → 1 summary (${summaryText.length} chars)`,
      );
    } catch (err) {
      await client.query('ROLLBACK');
      console.warn(
        '[conversation-compaction] Compaction transaction failed:',
        err instanceof Error ? err.message : err,
      );
    } finally {
      client.release();
    }
  }

  /**
   * Call Haiku to produce a dense briefing-style summary that Ironclaw can
   * use to pick up where it left off. Includes prior summary if present so
   * long-term context compounds across multiple compactions.
   */
  private async generateSummary(
    conversationText: string,
    priorSummary: string,
  ): Promise<string> {
    try {
      const anthropic = await createAnthropicClient();
      const priorSummarySection = priorSummary
        ? `Existing summary from earlier in this conversation (already compacted):\n${priorSummary}\n\n`
        : '';

      const result = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [
          {
            role: 'user',
            content: `You are producing a dense briefing summary of an earlier portion of a conversation between a military commander and Ironclaw (AI Chief of Staff). Ironclaw will read this summary at the start of the conversation to pick up where it left off — preserving context without replaying every message verbatim.

${priorSummarySection}New messages to fold into the summary:
${conversationText}

Produce a concise briefing (max 400 words) that preserves:
- Commander's stated intent, priorities, and decisions
- Key facts discovered (from tool calls, intel, or analysis)
- Outstanding tasks, refinements, or follow-ups the commander requested
- Any corrections or preferences the commander expressed
- Current state of any in-progress work (CoG analysis, problem framing, etc.)

If an existing summary is provided above, merge it with the new messages — your output should replace the existing summary, not append to it.

Start your response with the exact marker "${SUMMARY_MARKER}" on the first line. Then write the briefing in present tense, as a handoff note from past-Ironclaw to current-Ironclaw. Be direct and specific. Don't narrate the conversation; state the facts and decisions.`,
          },
        ],
      });

      const block = result.content[0];
      if (!block || block.type !== 'text') return '';
      const text = block.text.trim();
      if (!text.startsWith(SUMMARY_MARKER)) {
        console.warn(
          '[conversation-compaction] Summary missing marker, prepending',
        );
        return `${SUMMARY_MARKER}\n${text}`;
      }
      return text;
    } catch (err) {
      console.warn(
        '[conversation-compaction] generateSummary error:',
        err instanceof Error ? err.message : err,
      );
      return '';
    }
  }

  /**
   * Delete old messages from routine (autonomous) conversations.
   * Routines don't need continuity between runs — each cycle is independent.
   * Fire-and-forget — errors are logged, never thrown.
   */
  async purgeOldRoutineMessages(maxAgeMs: number = ROUTINE_MESSAGE_MAX_AGE_MS): Promise<void> {
    try {
      const pool = getIronclawPool();
      if (!pool) return;

      const cutoff = new Date(Date.now() - maxAgeMs);
      const result = await pool.query(
        `DELETE FROM conversation_messages
         WHERE conversation_id IN (
           SELECT id FROM conversations WHERE channel = 'routine'
         )
         AND created_at < $1`,
        [cutoff],
      );

      if (result.rowCount && result.rowCount > 0) {
        console.log(
          `[conversation-compaction] Purged ${result.rowCount} routine messages older than ${Math.round(maxAgeMs / 3_600_000)}h`,
        );
      }
    } catch (err) {
      console.warn(
        '[conversation-compaction] purgeOldRoutineMessages error:',
        err instanceof Error ? err.message : err,
      );
    }
  }
}

export const conversationCompactionService = new ConversationCompactionService();
