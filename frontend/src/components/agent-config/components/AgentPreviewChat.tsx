/**
 * AgentPreviewChat
 *
 * Phase 60 Plan 04: Compact single-exchange preview chat showing how
 * Ironclaw will respond with the current AgentConfig settings.
 *
 * Features:
 * - Default test message ("Brief me on current operations") user can edit
 * - Sends to Ironclaw global endpoint with preview_mode context flag
 * - Streams response with typing indicator
 * - Shows persona summary ("Your Chief of Staff will...") above the chat
 * - Single exchange only — not a full conversation
 */

import { useState } from 'react';
import type { AgentConfig } from '../../../types/agent-config.ts';
import { useAgentPreview } from '../hooks/useAgentPreview.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentPreviewChatProps {
  config: AgentConfig;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPersonaSummary(config: AgentConfig): string {
  const parts: string[] = [];

  // Tone
  const toneMap: Record<string, string> = {
    FormalMilitary: 'use formal military language',
    Professional: 'maintain a professional tone',
    Direct: 'be direct and concise',
    Collaborative: 'take a collaborative approach',
  };
  parts.push(toneMap[config.tone] ?? 'communicate professionally');

  // BLUF
  if (config.blufEnforced) {
    parts.push('lead with the bottom line');
  }

  // Verbosity
  const verbosityMap: Record<number, string> = {
    1: 'keep responses terse',
    2: 'be concise',
    3: 'provide balanced detail',
    4: 'give detailed responses',
    5: 'provide comprehensive analysis',
  };
  const verbosityDesc = verbosityMap[config.verbosityLevel];
  if (verbosityDesc) parts.push(verbosityDesc);

  // Staff section persona
  const sectionMap: Record<string, string> = {
    Commander: 'frame decisions with command authority',
    S2: 'prioritize intelligence assessments',
    S3: 'focus on operational planning',
    S4: 'emphasize logistics and sustainment',
    S6: 'highlight comms and network considerations',
    XO: 'coordinate staff synchronization',
  };
  const sectionDesc = sectionMap[config.staffSection];
  if (sectionDesc) parts.push(sectionDesc);

  return parts.join(', ');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentPreviewChat({ config }: AgentPreviewChatProps) {
  const [testMessage, setTestMessage] = useState('Brief me on current operations');
  const { sendPreviewMessage, response, streaming, error, clearResponse } = useAgentPreview(config);

  const personaSummary = buildPersonaSummary(config);
  const displayName = config.displayName || 'You';
  const rankName = [config.rank, config.displayName].filter(Boolean).join(' ') || 'User';

  async function handleSend() {
    if (!testMessage.trim() || streaming) return;
    await sendPreviewMessage(testMessage.trim());
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/50">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-700/60">
        <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">
          Preview
        </p>
        <p className="text-[9px] text-slate-500 mt-0.5">
          See how your Chief of Staff will respond
        </p>
      </div>

      {/* Persona summary */}
      <div className="px-3 py-2 bg-blue-900/10 border-b border-blue-900/30">
        <p className="text-[9px] text-slate-400">
          <span className="text-blue-400 font-medium">Your Chief of Staff will: </span>
          {personaSummary}
        </p>
      </div>

      {/* Exchange area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* User message (preview) */}
        {(response !== null || streaming) && (
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-slate-700/60 border border-slate-600/40 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-500 mb-1">{rankName}</p>
              <p className="text-xs text-slate-200">{testMessage}</p>
            </div>
          </div>
        )}

        {/* Ironclaw response */}
        {(response !== null || streaming) && (
          <div className="flex justify-start">
            <div className="max-w-[90%] bg-slate-800/60 border border-slate-700/40 rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5 mb-1.5">
                {/* Ironclaw icon */}
                <div className="w-4 h-4 rounded-full bg-blue-600/30 border border-blue-500/40 flex items-center justify-center shrink-0">
                  <svg className="w-2.5 h-2.5 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
                  </svg>
                </div>
                <p className="text-[10px] text-slate-500">
                  Ironclaw
                  {config.rank || config.displayName
                    ? ` · Chief of Staff to ${[config.rank, config.displayName].filter(Boolean).join(' ')}`
                    : ''}
                </p>
              </div>
              {streaming && !response && (
                <div className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
              {response && (
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {response}
                  {streaming && (
                    <span className="inline-block w-1 h-3.5 bg-blue-400 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
            {error}
            <button
              onClick={clearResponse}
              className="ml-2 underline hover:no-underline text-[10px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Empty state */}
        {!streaming && response === null && !error && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg
              className="w-8 h-8 mb-2 text-slate-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            <p className="text-[10px] text-slate-600">
              Send a test message to preview how{' '}
              {displayName ? `${displayName}'s` : 'your'} Chief of Staff responds
            </p>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-3 py-3 border-t border-slate-700/60">
        <div className="flex gap-2 items-start">
          <textarea
            className={[
              'flex-1 px-2.5 py-1.5 text-xs bg-slate-800/80 border border-slate-700/60 rounded',
              'text-slate-200 placeholder-slate-600 resize-none',
              'focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30',
              'transition-colors',
            ].join(' ')}
            rows={2}
            value={testMessage}
            onChange={(e) => setTestMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a test message..."
            disabled={streaming}
          />
          <button
            onClick={() => void handleSend()}
            disabled={streaming || !testMessage.trim()}
            className={[
              'px-3 py-1.5 text-[10px] font-semibold rounded transition-colors shrink-0',
              streaming || !testMessage.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white',
            ].join(' ')}
          >
            {streaming ? 'Sending...' : 'Test'}
          </button>
        </div>
        {response !== null && !streaming && (
          <button
            onClick={clearResponse}
            className="text-[9px] text-slate-600 hover:text-slate-400 mt-1 transition-colors"
          >
            Clear response
          </button>
        )}
      </div>
    </div>
  );
}
