/**
 * IronclawDrawer -- Slide-out drawer panel with chat interface
 *
 * Fixed right side panel with message list, loading state, and @mention input.
 * z-index 950. Slides in from right with overlay backdrop.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  IronclawChatMessage,
  IronclawTaskData,
  TrustDecision,
} from '../../types/ironclaw.ts';
import { IronclawMessage } from './IronclawMessage.tsx';
import { IronclawSuggestion } from './IronclawSuggestion.tsx';
import { IronclawTaskPanel } from './IronclawTaskPanel.tsx';
import type { Decision, ActOnDecisionParams } from '../../lib/decision-service.ts';
import './IronclawDrawer.css';

// Hardcoded initial specialist list
const SPECIALISTS = [
  { id: 'j1-personnel', name: 'J1 Personnel' },
  { id: 'j2-intelligence', name: 'J2 Intelligence' },
  { id: 'j3-operations', name: 'J3 Operations' },
  { id: 'j4-logistics', name: 'J4 Logistics' },
  { id: 'j5-plans', name: 'J5 Plans' },
  { id: 'j6-communications', name: 'J6 Communications' },
];

interface IronclawDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: IronclawChatMessage[];
  onSendMessage: (content: string, mentionedAgent?: string) => void;
  onActionDecision: (actionId: string, decision: TrustDecision) => void;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;
  isLoading?: boolean;
  /** True when WebSocket is connected */
  isConnected?: boolean;
  /** True when no problem set is selected — chat works but in global/user-scoped mode */
  isGlobalMode?: boolean;
  /** Current UI tab derived from route pathname */
  currentTab?: string | null;
  /** Name of the active problem set */
  problemSetName?: string | null;
  /** User's role in the active problem set */
  userRole?: string | null;
  /** User's DID (for display, not auth) */
  userDid?: string | null;
  /** Active task for the current problem set (from context) */
  activeTask?: IronclawTaskData | null;
  /** Approve a task suggestion */
  onApproveTaskSuggestion?: (taskId: string, suggestionId: string) => void;
  /** Dismiss a task suggestion */
  onDismissTaskSuggestion?: (taskId: string, suggestionId: string) => void;
  /** Request refinement of a task */
  onRefineTask?: (taskId: string, feedback: string) => void;
  /** Pending decisions surfaced proactively by Ironclaw */
  pendingDecisions?: Decision[];
  /** Act on a pending decision from the drawer */
  onActOnDecision?: (decisionId: string, params: ActOnDecisionParams) => Promise<void>;
}

export function IronclawDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onActionDecision,
  onAcceptSuggestion,
  onDismissSuggestion,
  isLoading,
  isConnected,
  isGlobalMode,
  currentTab,
  problemSetName,
  userRole,
  activeTask,
  onApproveTaskSuggestion,
  onDismissTaskSuggestion,
  onRefineTask,
  pendingDecisions,
  onActOnDecision,
}: IronclawDrawerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [topOffset, setTopOffset] = useState(56);
  const [version, setVersion] = useState<string | null>(null);

  // Fetch version from /api/ironclaw/status on mount
  useEffect(() => {
    fetch('/api/ironclaw/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { currentVersion?: string | null } | null) => {
        if (d) setVersion(d.currentVersion ?? 'unknown');
      })
      .catch(() => {});
  }, []);

  // Measure actual header + banner height so the drawer clears them
  useEffect(() => {
    if (!isOpen) return;
    const header = document.querySelector('.app-header') as HTMLElement | null;
    if (!header) return;
    // Bottom of the header element accounts for any banners above it
    const update = () => {
      const rect = header.getBoundingClientRect();
      setTopOffset(rect.bottom);
    };
    update();
    // Re-measure on resize (banner may appear/disappear)
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive or drawer opens
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      // Use instant scroll on open, smooth scroll for new messages
      messagesEndRef.current.scrollIntoView({ behavior: 'instant' });
    }
  }, [isOpen, messages, isLoading]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      const maxHeight = 4 * 24; // 4 lines * ~24px line height
      ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Detect @mention
    const atIdx = value.lastIndexOf('@');
    if (atIdx !== -1) {
      const afterAt = value.slice(atIdx + 1);
      // Show dropdown if @ is at end or followed by non-space text
      if (!afterAt.includes(' ')) {
        setMentionFilter(afterAt.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);

    setTimeout(resizeTextarea, 0);
  };

  const handleMentionSelect = (specialist: typeof SPECIALISTS[0]) => {
    const atIdx = inputValue.lastIndexOf('@');
    if (atIdx !== -1) {
      const before = inputValue.slice(0, atIdx);
      setInputValue(`${before}@${specialist.name} `);
      setSelectedAgent(specialist.id);
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    onSendMessage(trimmed, selectedAgent);
    setInputValue('');
    setSelectedAgent(undefined);
    setShowMentions(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredSpecialists = SPECIALISTS.filter((s) =>
    s.name.toLowerCase().includes(mentionFilter)
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="ironclaw-overlay fixed inset-0 bg-black/30"
        style={{ zIndex: 949 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel — top offset clears the app-header */}
      <div
        className="ironclaw-drawer fixed right-0 bg-slate-900 border-l border-slate-700
          flex flex-col shadow-2xl"
        style={{ zIndex: 950, width: '420px', top: `${topOffset}px`, height: `calc(100vh - ${topOffset}px)` }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/95">
          <div className="flex items-center gap-2">
            {/* Shield icon */}
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div>
              <h2 className="text-sm font-semibold text-white" title={version ? `Ironclaw v${version}` : undefined}>Ironclaw</h2>
              <p className="text-[10px] text-gray-400">Chief of Staff</p>
            </div>
            {/* Connection status */}
            <span
              className={`w-2 h-2 rounded-full ml-1 ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}
              title={isConnected ? 'Connected' : 'Connecting...'}
            />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
            aria-label="Close Ironclaw panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Context banner — shows current tab / problem set / role */}
        {!isGlobalMode && (currentTab || problemSetName || userRole) && (
          <div className="px-4 py-1.5 border-b border-slate-700/60 bg-slate-800/40">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 flex-wrap">
              <svg className="w-3 h-3 text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {currentTab && (
                <span className="bg-slate-700/60 px-1.5 py-0.5 rounded text-slate-300 capitalize">
                  {currentTab}
                </span>
              )}
              {problemSetName && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="text-slate-400 truncate max-w-30" title={problemSetName}>
                    {problemSetName}
                  </span>
                </>
              )}
              {userRole && (
                <>
                  <span className="text-slate-600">|</span>
                  <span className="bg-amber-900/40 text-amber-400 px-1.5 py-0.5 rounded capitalize">
                    {userRole}
                  </span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Pending decisions panel — proactively surfaced by Ironclaw */}
        {pendingDecisions && pendingDecisions.length > 0 && (
          <div style={{ borderBottom: '1px solid #334155', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{ padding: '0.5rem 1rem 0.25rem', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ display: 'inline-block', width: '0.5rem', height: '0.5rem', borderRadius: '9999px', background: '#f59e0b', animation: 'pulse 2s infinite' }} />
              Pending Decisions ({pendingDecisions.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0 0.75rem' }}>
              {pendingDecisions.slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  style={{
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.2)',
                    borderRadius: '0.375rem',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.375rem' }}>{d.title}</div>
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: '0.375rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {d.decision_type.replace(/_/g, ' ')}
                  </div>
                  {onActOnDecision && (
                    <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                      {(['approve', 'reject', 'defer', 'info'] as const).map((action) => {
                        const colors: Record<string, { color: string; bg: string }> = {
                          approve: { color: '#10b981', bg: 'rgba(16,185,129,0.15)' },
                          reject: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
                          defer: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)' },
                          info: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
                        };
                        const c = colors[action];
                        return (
                          <button
                            key={action}
                            onClick={() => onActOnDecision(d.id, { action })}
                            style={{
                              padding: '0.125rem 0.5rem',
                              fontSize: '0.65rem',
                              fontWeight: 600,
                              background: c.bg,
                              color: c.color,
                              border: `1px solid ${c.color}40`,
                              borderRadius: '0.25rem',
                              cursor: 'pointer',
                              textTransform: 'capitalize',
                            }}
                          >
                            {action === 'info' ? 'Need Info' : action}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
              {pendingDecisions.length > 5 && (
                <div style={{ fontSize: '0.7rem', color: '#94a3b8', textAlign: 'center' }}>
                  +{pendingDecisions.length - 5} more — visit the Decide tab
                </div>
              )}
            </div>
          </div>
        )}

        {/* Active task panel — shown above chat messages when a task is running */}
        {activeTask && onApproveTaskSuggestion && onDismissTaskSuggestion && onRefineTask && (
          <div className="pt-3">
            <IronclawTaskPanel
              task={activeTask}
              onApprove={onApproveTaskSuggestion}
              onDismiss={onDismissTaskSuggestion}
              onRefine={onRefineTask}
            />
          </div>
        )}

        {/* Message list */}
        <div className="ironclaw-messages flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <p className="text-sm">Ironclaw is ready</p>
              <p className="text-xs mt-1">Ask anything or use @agent for specialists</p>
            </div>
          )}

          {messages.map((msg) => {
            // Render suggestion cards as IronclawSuggestion
            if (msg.suggestion && onAcceptSuggestion && onDismissSuggestion) {
              return (
                <IronclawSuggestion
                  key={msg.id}
                  suggestion={msg.suggestion}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              );
            }

            return (
              <IronclawMessage
                key={msg.id}
                message={msg}
                onActionDecision={onActionDecision}
              />
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-gray-400">Ironclaw is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="relative border-t border-slate-700 px-4 py-4 bg-slate-900/95">
          {/* Global mode indicator */}
          {isGlobalMode && (
            <div className="text-center pb-2">
              <span className="text-[10px] text-gray-500 bg-slate-800 px-2 py-0.5 rounded-full">
                General conversation — select a problem set for specialist access
              </span>
            </div>
          )}

          {/* Agent quick-action buttons — only in problem-set mode */}
          {!isGlobalMode && (
            <div className="flex gap-1.5 pb-2 flex-wrap">
              <button
                onClick={() => onSendMessage('List all active agents and their current status.')}
                className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700
                  text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                title="Ask Ironclaw to list active agents"
              >
                Show Active Agents
              </button>
              <button
                onClick={() => onSendMessage('What is the current health and availability of all agents assigned to this problem set?')}
                className="text-[10px] px-2 py-1 rounded bg-slate-800 border border-slate-700
                  text-slate-300 hover:bg-slate-700 hover:border-slate-600 transition-colors"
                title="Ask Ironclaw for agent status"
              >
                Agent Status
              </button>
            </div>
          )}

          {/* @mention dropdown — only in problem-set mode */}
          {!isGlobalMode && showMentions && filteredSpecialists.length > 0 && (
            <div className="ironclaw-mention-dropdown absolute bottom-full left-4 right-4 mb-1
              bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
              {filteredSpecialists.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleMentionSelect(s)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-200
                    hover:bg-slate-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={isGlobalMode
                ? 'Ask Ironclaw anything...'
                : 'Ask Ironclaw anything... Use @agent for direct specialist access'
              }
              rows={2}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5
                text-sm text-white placeholder-gray-500
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                resize-none"
              style={{ maxHeight: `${5 * 24}px` }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors shrink-0"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19V5m0 0l-7 7m7-7l7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
