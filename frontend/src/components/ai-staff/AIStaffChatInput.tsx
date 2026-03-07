/**
 * AIStaffChatInput
 *
 * Compact chat input at the bottom of the AI staff panel.
 * Sends messages via REST and dispatches into context for immediate display.
 * Agent responses arrive as feed items via WebSocket.
 *
 * - Single-line text input with send button
 * - Enter submits, disabled while sending
 * - Optimistic: message appears immediately, marked pending
 * - 40px height, border-top separator, bg-secondary background
 */

import { useState, useCallback, type FormEvent, type KeyboardEvent } from 'react';
import { useAIStaffDispatch } from '../../context/AIStaffContext.tsx';
import { aiStaffService } from '../../lib/ai-staff-service.ts';
import type { ChatMessage } from '../../types/ai-staff.ts';

// ─── Props ───────────────────────────────────────────────────────────────────

interface AIStaffChatInputProps {
  problemSetId: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AIStaffChatInput({ problemSetId }: AIStaffChatInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const dispatch = useAIStaffDispatch();

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      e?.preventDefault();

      const trimmed = message.trim();
      if (!trimmed || sending) return;

      // Optimistic: show message in chat immediately
      const optimisticMessage: ChatMessage = {
        id: `pending-${Date.now()}`,
        content: trimmed,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };
      dispatch.addChatMessage(optimisticMessage);
      setMessage('');
      setSending(true);

      try {
        await aiStaffService.sendChat(problemSetId, {
          content: trimmed,
          sender: 'user',
        });
        // Agent response will arrive via WebSocket as a feed item
      } catch (err) {
        console.error('[AIStaffChatInput] send failed:', err);
        // Message is already in UI; user can retry
      } finally {
        setSending(false);
      }
    },
    [message, sending, problemSetId, dispatch],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSubmit();
      }
    },
    [handleSubmit],
  );

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '40px',
        borderTop: '1px solid var(--border-color, #333)',
        background: 'var(--bg-secondary, #1a1a2e)',
        padding: '0 8px',
        gap: '6px',
        flexShrink: 0,
      }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask the AI staff..."
        disabled={sending}
        style={{
          flex: 1,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: 'var(--text-primary, #e0e0e0)',
          fontSize: '13px',
          fontFamily: 'inherit',
        }}
        aria-label="Chat with AI staff"
      />
      <button
        type="submit"
        disabled={sending || !message.trim()}
        style={{
          background: 'none',
          border: 'none',
          cursor: sending || !message.trim() ? 'default' : 'pointer',
          color:
            sending || !message.trim()
              ? 'var(--text-muted, #666)'
              : 'var(--accent-blue, #4a9eff)',
          fontSize: '16px',
          padding: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: sending || !message.trim() ? 0.4 : 1,
        }}
        aria-label="Send message"
        title="Send message"
      >
        {/* Right arrow icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M2 8H14M14 8L9 3M14 8L9 13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </form>
  );
}
