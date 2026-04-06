/**
 * IronclawDrawer -- Slide-out drawer panel with chat interface
 *
 * Fixed right side panel with message list, loading state, and @mention input.
 * z-index 950. Slides in from right with overlay backdrop.
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type {
  IronclawChatMessage,
  IronclawTaskData,
  TrustDecision,
} from '../../types/ironclaw.ts';
import { IronclawMessage } from './IronclawMessage.tsx';
import { IronclawSuggestion } from './IronclawSuggestion.tsx';
import { IronclawTaskPanel } from './IronclawTaskPanel.tsx';
import { IronclawMemoryPanel } from './IronclawMemoryPanel.tsx';
import { IronclawActivityFeed } from './IronclawActivityFeed.tsx';
import type { Decision, ActOnDecisionParams } from '../../lib/decision-service.ts';
import { AgentConfigPanel } from '../agent-config/AgentConfigPanel.tsx';
import { IronclawConceptsPanel } from './IronclawConceptsPanel.tsx';
import { IronclawDirectivesPanel } from './IronclawDirectivesPanel.tsx';
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
  /** Thread management */
  threads?: Array<{ id: string; name: string; message_count: number; last_message_at: string | null; created_at: string }>;
  currentThreadId?: string | null;
  onSelectThread?: (threadId: string) => Promise<void>;
  onCreateThread?: (name: string) => Promise<void>;
  onRenameThread?: (threadId: string, name: string) => Promise<void>;
  onDeleteThread?: (threadId: string) => Promise<void>;
  /** Active problem set ID — required for autonomous activity feed */
  problemSetId?: string | null;
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
  threads,
  currentThreadId,
  onSelectThread,
  onCreateThread,
  onDeleteThread,
  problemSetId,
}: IronclawDrawerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [topOffset, setTopOffset] = useState(56);
  const [version, setVersion] = useState<string | null>(null);
  const prevMessageCountRef = useRef(0);
  const userScrolledUpRef = useRef(false);
  /** Controls which content area is shown: 'chat', 'activity', 'memory', 'knowledge', or 'config' */
  const [drawerTab, setDrawerTab] = useState<'chat' | 'activity' | 'memory' | 'knowledge' | 'config'>('chat');

  // Fetch version from /api/ironclaw/status on mount + after updates
  const fetchVersion = useCallback(() => {
    fetch('/api/ironclaw/status', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: { version?: string | null; currentVersion?: string | null } | null) => {
        if (d) setVersion(d.version ?? d.currentVersion ?? 'unknown');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchVersion();
    const handler = () => fetchVersion();
    window.addEventListener('ironclaw-version-changed', handler);
    return () => window.removeEventListener('ironclaw-version-changed', handler);
  }, [fetchVersion]);

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

  // Track whether user has scrolled up from bottom
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Consider "at bottom" if within 80px of bottom
      userScrolledUpRef.current = scrollHeight - scrollTop - clientHeight > 80;
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-scroll only when a NEW message arrives and user hasn't scrolled up
  useEffect(() => {
    const newCount = messages.length;
    const isNewMessage = newCount > prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    if (isOpen && messagesEndRef.current && (isNewMessage || isLoading) && !userScrolledUpRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, messages.length, isLoading]);

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
      {/* Overlay backdrop — hidden on push-layout tabs (design/plan) where content is pushed, not covered */}
      {!(currentTab && ['design', 'plan'].includes(currentTab)) && (
        <div
          className="ironclaw-overlay fixed inset-0 bg-black/30"
          style={{ zIndex: 949 }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Drawer panel — top offset clears the app-header */}
      <div
        className="ironclaw-drawer fixed right-0 bg-slate-900 border-l border-slate-700
          flex flex-col shadow-2xl"
        style={{ zIndex: 950, top: `${topOffset}px`, height: `calc(100dvh - ${topOffset}px)` }}
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

        {/* Drawer tab bar — icon-only with tooltips */}
        <div className="flex items-center justify-center gap-1 px-2 py-1.5 border-b border-slate-700/60 bg-slate-800/30">
          <button
            onClick={() => setDrawerTab('chat')}
            title="Chat"
            aria-label="Chat"
            className={`relative p-2 rounded-md transition-colors ${
              drawerTab === 'chat'
                ? 'bg-blue-500/15 text-blue-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </button>
          {!isGlobalMode && problemSetId && (
            <button
              onClick={() => setDrawerTab('activity')}
              title="Activity"
              aria-label="Activity"
              className={`relative p-2 rounded-md transition-colors ${
                drawerTab === 'activity'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setDrawerTab('memory')}
            title="Memory"
            aria-label="Memory"
            className={`relative p-2 rounded-md transition-colors ${
              drawerTab === 'memory'
                ? 'bg-purple-500/15 text-purple-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </button>
          <button
            onClick={() => setDrawerTab('knowledge')}
            title="Knowledge"
            aria-label="Knowledge"
            className={`relative p-2 rounded-md transition-colors ${
              drawerTab === 'knowledge'
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </button>
          <button
            onClick={() => setDrawerTab('config')}
            title="Config"
            aria-label="Config"
            className={`relative p-2 rounded-md transition-colors ${
              drawerTab === 'config'
                ? 'bg-slate-500/15 text-slate-300'
                : 'text-slate-500 hover:text-slate-300 hover:bg-slate-700/40'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        {/* Thread selector bar — always show in problem set mode so user can create first thread */}
        {!isGlobalMode && threads && drawerTab === 'chat' && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-slate-700/60 bg-slate-800/30 overflow-x-auto">
            {threads.slice(0, 5).map((t) => (
              <button
                key={t.id}
                onClick={() => onSelectThread?.(t.id)}
                className={`text-[10px] px-2 py-1 rounded whitespace-nowrap transition-colors ${
                  t.id === currentThreadId
                    ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                }`}
                title={`${t.message_count} messages`}
              >
                {t.name}
              </button>
            ))}
            <button
              onClick={() => {
                const name = prompt('Thread name:');
                if (name?.trim()) onCreateThread?.(name.trim());
              }}
              className="text-[10px] px-1.5 py-1 rounded bg-slate-800 border border-slate-700
                text-slate-500 hover:text-slate-300 hover:bg-slate-700 transition-colors shrink-0"
              title="New thread"
            >
              +
            </button>
            {currentThreadId && (
              <button
                onClick={() => {
                  if (confirm('Delete this thread and all its messages?')) {
                    onDeleteThread?.(currentThreadId);
                  }
                }}
                className="text-[10px] px-1.5 py-1 rounded text-slate-600 hover:text-red-400 transition-colors shrink-0"
                title="Delete current thread"
              >
                &times;
              </button>
            )}
          </div>
        )}

        {/* Activity tab content — autonomous operations log */}
        {drawerTab === 'activity' && problemSetId && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <IronclawActivityFeed problemSetId={problemSetId} />
          </div>
        )}

        {/* Memory tab content */}
        {drawerTab === 'memory' && (
          <div className="flex-1 overflow-y-auto">
            <IronclawMemoryPanel />
          </div>
        )}

        {/* Config tab content */}
        {drawerTab === 'config' && (
          <div className="flex-1 overflow-y-auto">
            <AgentConfigPanel showPreview={false} />
          </div>
        )}

        {/* Knowledge tab content — concepts learned by Ironclaw + commander priorities */}
        {drawerTab === 'knowledge' && (
          <div className="flex-1 overflow-y-auto">
            <IronclawConceptsPanel problemSetId={problemSetId ?? null} userDid={null} />
            <div className="border-t border-slate-700/60 mt-4">
              <IronclawDirectivesPanel problemSetId={problemSetId ?? null} userDid={null} />
            </div>
          </div>
        )}

        {/* Chat tab content — all chat-specific UI */}
        {drawerTab === 'chat' && <>

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

        {/* Pinned action/suggestion cards — above scroll area so they don't get buried */}
        {(() => {
          const pinnedSuggestions = messages.filter((m) => m.suggestion);
          if (pinnedSuggestions.length === 0 || !onAcceptSuggestion || !onDismissSuggestion) return null;
          return (
            <div className="px-3 py-2 border-b border-slate-700/60 bg-slate-800/40 flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
              {pinnedSuggestions.map((msg) => (
                <IronclawSuggestion
                  key={msg.id}
                  suggestion={msg.suggestion!}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              ))}
            </div>
          );
        })()}

        {/* Message list */}
        <div ref={messagesContainerRef} className="ironclaw-messages flex-1 overflow-y-auto px-4 py-3">

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
            if (msg.suggestion) return null;
            return (
              <IronclawMessage
                key={msg.id}
                message={msg}
                onActionDecision={onActionDecision}
              />
            );
          })}

          {isLoading && <ThinkingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="relative border-t border-slate-700 px-4 py-4 bg-slate-900/95">
          {isGlobalMode && (
            <div className="text-center pb-2">
              <span className="text-[10px] text-gray-500 bg-slate-800 px-2 py-0.5 rounded-full">
                General conversation — select a problem set for specialist access
              </span>
            </div>
          )}

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

        </> /* end drawerTab === 'chat' */}
      </div>
    </>
  );
}

// ── Thinking Indicator ──────────────────────────────────────────────────────

const THINKING_PHRASES = [
  'Analyzing situation...',
  'Assessing threat posture...',
  'Evaluating courses of action...',
  'Reviewing intelligence...',
  'Considering operational factors...',
  'Cross-referencing doctrine...',
  'Synthesizing assessment...',
  'Developing recommendation...',
  'Checking mission parameters...',
  'Correlating indicators...',
  'Reviewing commander\'s intent...',
  'Applying operational art...',
  'Evaluating risk factors...',
  'Coordinating staff input...',
  'Processing information...',
  'Examining decision space...',
  'Analyzing center of gravity...',
  'Reviewing decisive points...',
  'Assessing force ratios...',
  'Formulating response...',
];

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(() => Math.floor(Math.random() * THINKING_PHRASES.length));

  useEffect(() => {
    const interval = setInterval(() => {
      setPhraseIndex((prev) => (prev + 1) % THINKING_PHRASES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const phrase = useMemo(() => THINKING_PHRASES[phraseIndex], [phraseIndex]);

  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
      <span
        className="text-xs text-amber-400/80 italic"
        style={{ transition: 'opacity 0.3s', minWidth: 160 }}
      >
        {phrase}
      </span>
    </div>
  );
}
