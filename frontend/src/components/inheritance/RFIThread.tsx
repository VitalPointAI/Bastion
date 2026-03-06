/**
 * RFIThread & RFIList
 *
 * Phase 26 Plan 04: Request for Information components that mirror military
 * RFI workflows. RFIThread supports creation and threaded conversation
 * between echelons. RFIList shows sent/received RFIs with status indicators.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { InheritanceRFI, RFIMessage } from '../../lib/inheritance-service.ts';
import { inheritanceApi, ECHELON_COLORS } from '../../lib/inheritance-service.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Echelon = 'strategic' | 'operational' | 'tactical';

interface RFIThreadProps {
  problemSetId: string;
  /** If provided, creating a new RFI to this target */
  targetProblemSetId?: string;
  /** Inherited item being questioned */
  targetItemId?: string;
  targetItemType?: string;
  /** If provided, viewing an existing RFI thread */
  rfiId?: string;
  /** Display names for context */
  problemSetName?: string;
  targetProblemSetName?: string;
  sourceEchelon?: Echelon;
  targetEchelon?: Echelon;
  onClose?: () => void;
}

interface RFIListProps {
  problemSetId: string;
  direction: 'sent' | 'received';
  onSelectRFI: (rfiId: string) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abbreviateDid(did: string): string {
  if (!did) return 'Unknown';
  if (did.length <= 16) return did;
  return `${did.slice(0, 8)}...${did.slice(-6)}`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

const STATUS_STYLES: Record<
  InheritanceRFI['status'],
  { bg: string; color: string; label: string }
> = {
  open: { bg: '#1e40af', color: '#93c5fd', label: 'Open' },
  'in-progress': { bg: '#065f46', color: '#6ee7b7', label: 'In Progress' },
  resolved: { bg: '#166534', color: '#86efac', label: 'Resolved' },
  closed: { bg: '#374151', color: '#9ca3af', label: 'Closed' },
};

const PRIORITY_STYLES: Record<
  InheritanceRFI['priority'],
  { color: string; label: string }
> = {
  routine: { color: '#9ca3af', label: 'Routine' },
  priority: { color: '#f59e0b', label: 'Priority' },
  immediate: { color: '#ef4444', label: 'Immediate' },
};

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

// ---------------------------------------------------------------------------
// RFIThread Component
// ---------------------------------------------------------------------------

export function RFIThread({
  problemSetId,
  targetProblemSetId,
  targetItemId,
  targetItemType,
  rfiId: initialRfiId,
  problemSetName,
  targetProblemSetName,
  sourceEchelon = 'tactical',
  targetEchelon = 'strategic',
  onClose,
}: RFIThreadProps) {
  // Mode: create vs thread
  const [rfiId, setRfiId] = useState<string | null>(initialRfiId || null);
  const [rfi, setRfi] = useState<InheritanceRFI | null>(null);
  const [messages, setMessages] = useState<RFIMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create form
  const [subject, setSubject] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [priority, setPriority] = useState<InheritanceRFI['priority']>('routine');
  const [creating, setCreating] = useState(false);

  // Reply form
  const [replyContent, setReplyContent] = useState('');
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sourceColors = ECHELON_COLORS[sourceEchelon];
  const targetColors = ECHELON_COLORS[targetEchelon];

  // -------------------------------------------------------------------------
  // Fetch thread data
  // -------------------------------------------------------------------------

  const fetchThread = useCallback(async () => {
    if (!rfiId) return;
    try {
      setLoading(true);
      setError(null);
      const [rfis, msgs] = await Promise.all([
        inheritanceApi.getRFIs(problemSetId, 'sent'),
        inheritanceApi.getRFIMessages(problemSetId, rfiId),
      ]);
      // Find this specific RFI
      const found = rfis.find((r) => r.id === rfiId);
      if (!found) {
        // Try received direction
        const received = await inheritanceApi.getRFIs(problemSetId, 'received');
        const foundReceived = received.find((r) => r.id === rfiId);
        if (foundReceived) setRfi(foundReceived);
      } else {
        setRfi(found);
      }
      setMessages(msgs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load RFI thread');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, rfiId]);

  useEffect(() => {
    if (rfiId) {
      fetchThread();
    }
  }, [fetchThread, rfiId]);

  // Auto-refresh
  useEffect(() => {
    if (rfiId && rfi && rfi.status !== 'closed') {
      refreshTimerRef.current = setInterval(fetchThread, AUTO_REFRESH_INTERVAL);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [rfiId, rfi, fetchThread]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // -------------------------------------------------------------------------
  // Create RFI
  // -------------------------------------------------------------------------

  async function handleCreate() {
    if (!subject.trim() || !initialMessage.trim() || !targetProblemSetId) return;
    try {
      setCreating(true);
      setError(null);
      const newRfi = await inheritanceApi.createRFI(problemSetId, {
        toProblemSetId: targetProblemSetId,
        subject: subject.trim(),
        content: initialMessage.trim(),
        priority,
      });
      setRfi(newRfi);
      setRfiId(newRfi.id);
      // Clear create form
      setSubject('');
      setInitialMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RFI');
    } finally {
      setCreating(false);
    }
  }

  // -------------------------------------------------------------------------
  // Send reply
  // -------------------------------------------------------------------------

  async function handleSendReply() {
    if (!rfiId || !replyContent.trim()) return;
    try {
      setSending(true);
      setError(null);
      await inheritanceApi.addRFIMessage(problemSetId, rfiId, replyContent.trim());
      setReplyContent('');
      await fetchThread();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  }

  // -------------------------------------------------------------------------
  // Status updates
  // -------------------------------------------------------------------------

  async function handleStatusUpdate(newStatus: InheritanceRFI['status']) {
    if (!rfiId) return;
    try {
      setError(null);
      const updated = await inheritanceApi.updateRFIStatus(problemSetId, rfiId, newStatus);
      setRfi(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status');
    }
  }

  // -------------------------------------------------------------------------
  // Determine message alignment
  // -------------------------------------------------------------------------

  function isFromRequester(msg: RFIMessage): boolean {
    if (!rfi) return true;
    return msg.senderProblemSetId === rfi.fromProblemSetId;
  }

  // -------------------------------------------------------------------------
  // Determine if user can perform status actions
  // -------------------------------------------------------------------------

  const isRequester = rfi?.fromProblemSetId === problemSetId;
  const isResponder = rfi?.toProblemSetId === problemSetId;

  // -------------------------------------------------------------------------
  // Render: Create Mode
  // -------------------------------------------------------------------------

  if (!rfiId) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '440px',
          height: '100vh',
          backgroundColor: '#1a1a2e',
          borderLeft: `3px solid ${targetColors.border}`,
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          color: '#e0e0e0',
          fontFamily: 'monospace',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid #333',
            backgroundColor: 'rgba(255,255,255,0.02)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>
              New Request for Information
            </h3>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 4px',
                }}
              >
                x
              </button>
            )}
          </div>

          {/* Target info */}
          <div style={{ fontSize: '12px', color: '#aaa', marginTop: '8px' }}>
            <span style={{ color: '#777' }}>To: </span>
            <span
              style={{
                display: 'inline-block',
                padding: '1px 6px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                backgroundColor: targetColors.border,
                color: '#000',
                marginRight: '6px',
              }}
            >
              {targetColors.label}
            </span>
            {targetProblemSetName || targetProblemSetId || 'Parent PS'}
          </div>
          {targetItemId && (
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              Re: {targetItemType?.replace('_', ' ')} | {targetItemId.slice(0, 20)}
            </div>
          )}
        </div>

        {/* Create form */}
        <div style={{ flex: 1, padding: '16px', overflowY: 'auto' }}>
          {error && (
            <div
              style={{
                padding: '8px 12px',
                backgroundColor: 'rgba(239,68,68,0.15)',
                border: '1px solid #7f1d1d',
                borderRadius: '4px',
                color: '#fca5a5',
                fontSize: '12px',
                marginBottom: '12px',
              }}
            >
              {error}
            </div>
          )}

          {/* Subject */}
          <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of information needed..."
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#0d0d1a',
              border: '1px solid #444',
              borderRadius: '3px',
              color: '#e0e0e0',
              fontSize: '13px',
              fontFamily: 'monospace',
              marginBottom: '12px',
            }}
          />

          {/* Priority */}
          <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Priority
          </label>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            {(['routine', 'priority', 'immediate'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriority(p)}
                style={{
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  backgroundColor: priority === p ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: `1px solid ${priority === p ? PRIORITY_STYLES[p].color : '#444'}`,
                  borderRadius: '3px',
                  color: PRIORITY_STYLES[p].color,
                  cursor: 'pointer',
                }}
              >
                {PRIORITY_STYLES[p].label}
              </button>
            ))}
          </div>

          {/* Initial message */}
          <label style={{ display: 'block', fontSize: '11px', color: '#888', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Message
          </label>
          <textarea
            value={initialMessage}
            onChange={(e) => setInitialMessage(e.target.value)}
            placeholder="Describe what information you need and why..."
            rows={6}
            style={{
              width: '100%',
              backgroundColor: '#0d0d1a',
              border: '1px solid #444',
              borderRadius: '3px',
              color: '#e0e0e0',
              padding: '8px',
              fontSize: '12px',
              fontFamily: 'monospace',
              resize: 'vertical',
            }}
          />

          <button
            onClick={handleCreate}
            disabled={creating || !subject.trim() || !initialMessage.trim()}
            style={{
              marginTop: '12px',
              width: '100%',
              padding: '10px 16px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'monospace',
              backgroundColor:
                creating || !subject.trim() || !initialMessage.trim()
                  ? '#333'
                  : '#2563eb',
              border: 'none',
              borderRadius: '4px',
              color:
                creating || !subject.trim() || !initialMessage.trim()
                  ? '#666'
                  : '#fff',
              cursor:
                creating || !subject.trim() || !initialMessage.trim()
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            {creating ? 'Sending RFI...' : 'Send RFI'}
          </button>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render: Thread Mode
  // -------------------------------------------------------------------------

  const statusStyle = rfi ? STATUS_STYLES[rfi.status] : STATUS_STYLES.open;
  const priorityStyle = rfi ? PRIORITY_STYLES[rfi.priority] : PRIORITY_STYLES.routine;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '440px',
        height: '100vh',
        backgroundColor: '#1a1a2e',
        borderLeft: `3px solid ${targetColors.border}`,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        color: '#e0e0e0',
        fontFamily: 'monospace',
        overflow: 'hidden',
      }}
    >
      {/* Thread Header */}
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #333',
          backgroundColor: 'rgba(255,255,255,0.02)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, flex: 1 }}>
            {rfi?.subject || 'RFI Thread'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Status badge */}
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontWeight: 600,
                backgroundColor: statusStyle.bg,
                color: statusStyle.color,
              }}
            >
              {statusStyle.label}
            </span>
            {/* Priority indicator */}
            <span
              style={{
                fontSize: '10px',
                color: priorityStyle.color,
                fontWeight: 600,
              }}
            >
              {priorityStyle.label}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#999',
                  cursor: 'pointer',
                  fontSize: '18px',
                  padding: '0 4px',
                }}
              >
                x
              </button>
            )}
          </div>
        </div>

        {/* Echelon info */}
        {rfi && (
          <div style={{ fontSize: '11px', color: '#777', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 600,
                  backgroundColor: sourceColors.border,
                  color: '#000',
                  marginRight: '4px',
                }}
              >
                {sourceColors.label}
              </span>
              {rfi.fromProblemSetName || problemSetName || 'Requesting PS'}
            </span>
            <span style={{ color: '#555' }}>&#8594;</span>
            <span>
              <span
                style={{
                  display: 'inline-block',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 600,
                  backgroundColor: targetColors.border,
                  color: '#000',
                  marginRight: '4px',
                }}
              >
                {targetColors.label}
              </span>
              {rfi.toProblemSetName || targetProblemSetName || 'Target PS'}
            </span>
          </div>
        )}
      </div>

      {/* Messages area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        }}
      >
        {loading && messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
            Loading messages...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'rgba(239,68,68,0.15)',
              border: '1px solid #7f1d1d',
              borderRadius: '4px',
              color: '#fca5a5',
              fontSize: '12px',
              marginBottom: '12px',
            }}
          >
            {error}
          </div>
        )}

        {/* RFI initial content (if available from the RFI itself) */}
        {rfi?.content && (
          <div
            style={{
              padding: '10px 12px',
              marginBottom: '12px',
              backgroundColor: 'rgba(59,130,246,0.06)',
              border: '1px solid #1e40af',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#bbb',
              fontStyle: 'italic',
            }}
          >
            <div style={{ fontSize: '10px', color: '#666', marginBottom: '4px' }}>
              Initial request | {rfi.createdAt ? formatTimestamp(rfi.createdAt) : ''}
            </div>
            {rfi.content}
          </div>
        )}

        {/* Message list */}
        {messages.map((msg) => {
          const fromRequester = isFromRequester(msg);
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: fromRequester ? 'flex-start' : 'flex-end',
                marginBottom: '10px',
              }}
            >
              <div
                style={{
                  maxWidth: '85%',
                  padding: '10px 12px',
                  borderRadius: fromRequester
                    ? '4px 12px 12px 4px'
                    : '12px 4px 4px 12px',
                  backgroundColor: fromRequester
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(59,130,246,0.1)',
                  border: `1px solid ${fromRequester ? '#333' : '#1e40af'}`,
                }}
              >
                {/* Sender info */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: '#777',
                    marginBottom: '4px',
                    gap: '8px',
                  }}
                >
                  <span>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '0px 4px',
                        borderRadius: '2px',
                        fontSize: '9px',
                        fontWeight: 600,
                        backgroundColor: fromRequester
                          ? sourceColors.border
                          : targetColors.border,
                        color: '#000',
                        marginRight: '4px',
                      }}
                    >
                      {fromRequester ? sourceColors.label : targetColors.label}
                    </span>
                    {msg.senderProblemSetName || abbreviateDid(msg.createdBy)}
                  </span>
                  <span>{formatRelativeTime(msg.createdAt)}</span>
                </div>

                {/* Message content */}
                <div
                  style={{
                    fontSize: '13px',
                    color: '#ddd',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Status controls and reply form */}
      <div
        style={{
          borderTop: '1px solid #333',
          padding: '12px 16px',
          flexShrink: 0,
          backgroundColor: 'rgba(255,255,255,0.02)',
        }}
      >
        {/* Status action buttons */}
        {rfi && rfi.status !== 'closed' && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
            {isResponder && rfi.status === 'open' && (
              <button
                onClick={() => handleStatusUpdate('in-progress')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(6,95,70,0.3)',
                  border: '1px solid #065f46',
                  borderRadius: '3px',
                  color: '#6ee7b7',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Mark In Progress
              </button>
            )}
            {isResponder && (rfi.status === 'open' || rfi.status === 'in-progress') && (
              <button
                onClick={() => handleStatusUpdate('resolved')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(22,101,52,0.3)',
                  border: '1px solid #166534',
                  borderRadius: '3px',
                  color: '#86efac',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Mark Resolved
              </button>
            )}
            {isRequester && (
              <button
                onClick={() => handleStatusUpdate('closed')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  backgroundColor: 'rgba(55,65,81,0.3)',
                  border: '1px solid #374151',
                  borderRadius: '3px',
                  color: '#9ca3af',
                  cursor: 'pointer',
                  fontFamily: 'monospace',
                }}
              >
                Close RFI
              </button>
            )}
            <button
              onClick={fetchThread}
              style={{
                marginLeft: 'auto',
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: 'transparent',
                border: '1px solid #444',
                borderRadius: '3px',
                color: '#888',
                cursor: 'pointer',
                fontFamily: 'monospace',
              }}
              title="Refresh messages"
            >
              Refresh
            </button>
          </div>
        )}

        {/* Reply form */}
        {rfi?.status !== 'closed' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea
              value={replyContent}
              onChange={(e) => setReplyContent(e.target.value)}
              placeholder="Type a reply..."
              rows={2}
              style={{
                flex: 1,
                backgroundColor: '#0d0d1a',
                border: '1px solid #444',
                borderRadius: '3px',
                color: '#e0e0e0',
                padding: '8px',
                fontSize: '12px',
                fontFamily: 'monospace',
                resize: 'none',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendReply();
                }
              }}
            />
            <button
              onClick={handleSendReply}
              disabled={sending || !replyContent.trim()}
              style={{
                padding: '8px 16px',
                fontSize: '12px',
                fontFamily: 'monospace',
                backgroundColor:
                  sending || !replyContent.trim() ? '#333' : '#2563eb',
                border: 'none',
                borderRadius: '3px',
                color: sending || !replyContent.trim() ? '#666' : '#fff',
                cursor:
                  sending || !replyContent.trim() ? 'not-allowed' : 'pointer',
                alignSelf: 'flex-end',
              }}
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        )}

        {rfi?.status === 'closed' && (
          <div
            style={{
              textAlign: 'center',
              padding: '8px',
              color: '#666',
              fontSize: '12px',
              fontStyle: 'italic',
            }}
          >
            This RFI has been closed.
            {rfi.updatedAt && ` Closed ${formatTimestamp(rfi.updatedAt)}`}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RFIList Component
// ---------------------------------------------------------------------------

export function RFIList({ problemSetId, direction, onSelectRFI }: RFIListProps) {
  const [rfis, setRfis] = useState<InheritanceRFI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      try {
        setLoading(true);
        setError(null);
        const data = await inheritanceApi.getRFIs(problemSetId, direction);
        setRfis(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load RFIs');
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [problemSetId, direction]);

  if (loading) {
    return (
      <div style={{ padding: '12px', color: '#666', fontSize: '12px', fontFamily: 'monospace' }}>
        Loading RFIs...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(239,68,68,0.15)',
          border: '1px solid #7f1d1d',
          borderRadius: '4px',
          color: '#fca5a5',
          fontSize: '12px',
          fontFamily: 'monospace',
        }}
      >
        {error}
      </div>
    );
  }

  if (rfis.length === 0) {
    return (
      <div
        style={{
          padding: '16px',
          color: '#555',
          fontSize: '12px',
          fontFamily: 'monospace',
          fontStyle: 'italic',
          textAlign: 'center',
        }}
      >
        No {direction} RFIs
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'monospace' }}>
      {rfis.map((rfi) => {
        const statusStyle = STATUS_STYLES[rfi.status];
        const priorityStyle = PRIORITY_STYLES[rfi.priority];
        const isUnresponded = rfi.status === 'open' && direction === 'received';
        const counterpartName =
          direction === 'sent' ? rfi.toProblemSetName : rfi.fromProblemSetName;

        return (
          <div
            key={rfi.id}
            onClick={() => onSelectRFI(rfi.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectRFI(rfi.id);
            }}
            style={{
              padding: '10px 12px',
              marginBottom: '4px',
              backgroundColor: isUnresponded
                ? 'rgba(239,68,68,0.05)'
                : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isUnresponded ? '#7f1d1d' : '#333'}`,
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              {/* Unresponded red dot */}
              {isUnresponded && (
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    flexShrink: 0,
                  }}
                />
              )}
              {/* Subject */}
              <span
                style={{
                  fontSize: '13px',
                  color: '#ddd',
                  fontWeight: 500,
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {rfi.subject}
              </span>
              {/* Status badge */}
              <span
                style={{
                  padding: '1px 6px',
                  borderRadius: '3px',
                  fontSize: '9px',
                  fontWeight: 600,
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.color,
                  flexShrink: 0,
                }}
              >
                {statusStyle.label}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '10px',
                color: '#777',
              }}
            >
              <span>
                {direction === 'sent' ? 'To' : 'From'}: {counterpartName || 'Unknown PS'}
                {' | '}
                <span style={{ color: priorityStyle.color }}>{priorityStyle.label}</span>
              </span>
              <span>{formatRelativeTime(rfi.createdAt)}</span>
            </div>

            {rfi.messageCount > 0 && (
              <div style={{ fontSize: '10px', color: '#555', marginTop: '2px' }}>
                {rfi.messageCount} message{rfi.messageCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
