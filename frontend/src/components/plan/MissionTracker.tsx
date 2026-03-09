/**
 * MissionTracker
 *
 * Phase 35 Plan 04: Panel showing all missions created from this OPORD.
 * Displays mission name, task statement, assigned unit, status, and navigation link.
 * Also provides CCIR/PIR request capability for child problem sets
 * and incoming request view for parent problem sets.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  missionCreationService,
  type MissionAssignment,
  type CcirRequest,
} from '../../lib/mission-creation-service';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface MissionTrackerProps {
  problemSetId: string;
  /** If set, this PS is a child and can request CCIR from parent */
  parentProblemSetId?: string | null;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.3)',
  borderRadius: '0.25rem',
  padding: '0.625rem',
  marginBottom: '0.375rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  fontWeight: 600,
};

const badgeBase: React.CSSProperties = {
  padding: '0.125rem 0.375rem',
  borderRadius: '0.25rem',
  fontSize: '0.65rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const STATUS_COLORS: Record<string, React.CSSProperties> = {
  planning: { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' },
  active: { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' },
  complete: { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: '1px solid rgba(59, 130, 246, 0.3)' },
  archived: { backgroundColor: 'rgba(107, 114, 128, 0.15)', color: '#9ca3af', border: '1px solid rgba(107, 114, 128, 0.3)' },
};

const CCIR_STATUS_COLORS: Record<string, React.CSSProperties> = {
  pending: { backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' },
  approved: { backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' },
  denied: { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' },
};

const buttonStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.75rem',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
  cursor: 'pointer',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '2.5rem',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.5)',
  borderRadius: '0.25rem',
  color: '#e5e7eb',
  padding: '0.5rem',
  fontSize: '0.8rem',
  resize: 'vertical',
};

// ─── Helper ─────────────────────────────────────────────────────────────────

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function MissionTracker({ problemSetId, parentProblemSetId = null }: MissionTrackerProps) {
  const [missions, setMissions] = useState<MissionAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // CCIR request form state (for child PS)
  const [showCcirForm, setShowCcirForm] = useState(false);
  const [ccirType, setCcirType] = useState<'ccir' | 'pir'>('ccir');
  const [ccirDescription, setCcirDescription] = useState('');
  const [ccirSubmitting, setCcirSubmitting] = useState(false);
  const [ccirFeedback, setCcirFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Incoming CCIR requests (for parent PS)
  const [incomingRequests, setIncomingRequests] = useState<CcirRequest[]>([]);
  const [incomingLoading, setIncomingLoading] = useState(false);

  const isChildPs = !!parentProblemSetId;

  const fetchMissions = useCallback(async () => {
    setLoading(true);
    try {
      const data = await missionCreationService.listMissions(problemSetId);
      setMissions(data);
    } catch (err) {
      console.error('[MissionTracker] Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  const fetchIncomingRequests = useCallback(async () => {
    if (isChildPs) return; // Only parent PS fetches incoming
    setIncomingLoading(true);
    try {
      const data = await missionCreationService.listIncomingCcirRequests(problemSetId);
      setIncomingRequests(data);
    } catch (err) {
      console.error('[MissionTracker] Failed to load incoming CCIR requests:', err);
    } finally {
      setIncomingLoading(false);
    }
  }, [problemSetId, isChildPs]);

  useEffect(() => {
    fetchMissions();
    fetchIncomingRequests();
  }, [fetchMissions, fetchIncomingRequests]);

  const handleCcirSubmit = async () => {
    if (!parentProblemSetId || !ccirDescription.trim()) return;
    setCcirSubmitting(true);
    setCcirFeedback(null);
    try {
      await missionCreationService.createCcirRequest(problemSetId, {
        targetPsId: parentProblemSetId,
        requestType: ccirType,
        description: ccirDescription.trim(),
      });
      setCcirFeedback({ type: 'success', message: `${ccirType.toUpperCase()} request submitted successfully.` });
      setCcirDescription('');
      setShowCcirForm(false);
    } catch (err) {
      setCcirFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to submit request',
      });
    } finally {
      setCcirSubmitting(false);
    }
  };

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: collapsed ? 0 : '0.5rem' }}>
        <button
          onClick={() => setCollapsed(!collapsed)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: 0,
            color: '#e5e7eb',
          }}
        >
          <span
            style={{
              fontSize: '0.65rem',
              transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.15s',
              display: 'inline-block',
            }}
          >
            &#9660;
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Missions Created from this OPORD
          </span>
          <span
            style={{
              ...badgeBase,
              backgroundColor: 'rgba(59, 130, 246, 0.15)',
              color: '#93c5fd',
              border: '1px solid rgba(59, 130, 246, 0.3)',
            }}
          >
            {missions.length} mission{missions.length !== 1 ? 's' : ''}
          </span>
        </button>
        <button onClick={fetchMissions} style={{ ...buttonStyle, padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}>
          Refresh
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Mission List */}
          {loading ? (
            <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Loading missions...</p>
          ) : missions.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center' }}>
              <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
                No missions created yet. Group subordinate tasks above and create missions.
              </p>
            </div>
          ) : (
            <div>
              {missions.map((m) => {
                // Determine mission state from metadata stored in the assignment
                const missionState = (m as MissionAssignment & { missionState?: string }).missionState || 'planning';
                const statusStyle = STATUS_COLORS[missionState] || STATUS_COLORS.planning;

                return (
                  <div key={m.id} style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                          <span style={{ color: '#e5e7eb', fontSize: '0.8rem', fontWeight: 600 }}>
                            {m.targetProblemSetId}
                          </span>
                          <span style={{ ...badgeBase, ...statusStyle }}>
                            {missionState}
                          </span>
                        </div>
                        <p style={{ color: '#d1d5db', fontSize: '0.75rem', marginBottom: '0.125rem' }}>
                          {truncate(m.taskStatement, 100)}
                        </p>
                        {m.taskOrganization && (
                          <span style={{ color: '#9ca3af', fontSize: '0.7rem' }}>
                            Unit: {typeof m.taskOrganization === 'object' ? JSON.stringify(m.taskOrganization).slice(0, 60) : String(m.taskOrganization)}
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <a
                          href={`/problem-sets/${m.targetProblemSetId}/plan`}
                          style={{
                            ...buttonStyle,
                            textDecoration: 'none',
                            padding: '0.25rem 0.5rem',
                            fontSize: '0.7rem',
                          }}
                        >
                          Open Mission
                        </a>
                        <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                          {formatDate(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CCIR/PIR Request (child PS only) */}
          {isChildPs && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                <span style={labelStyle}>Intelligence Requests</span>
                <button
                  onClick={() => setShowCcirForm(!showCcirForm)}
                  style={buttonStyle}
                >
                  {showCcirForm ? 'Cancel' : 'Request Additional CCIR/PIR'}
                </button>
              </div>

              {showCcirForm && (
                <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                  <div>
                    <label style={{ ...labelStyle, display: 'block', marginBottom: '0.125rem' }}>Request Type</label>
                    <select
                      value={ccirType}
                      onChange={(e) => setCcirType(e.target.value as 'ccir' | 'pir')}
                      style={{
                        backgroundColor: 'rgba(17, 24, 39, 0.6)',
                        border: '1px solid rgba(75, 85, 99, 0.5)',
                        borderRadius: '0.25rem',
                        color: '#e5e7eb',
                        padding: '0.375rem 0.5rem',
                        fontSize: '0.8rem',
                      }}
                    >
                      <option value="ccir">CCIR (Commander's Critical Information Requirement)</option>
                      <option value="pir">PIR (Priority Intelligence Requirement)</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ ...labelStyle, display: 'block', marginBottom: '0.125rem' }}>Description</label>
                    <textarea
                      value={ccirDescription}
                      onChange={(e) => setCcirDescription(e.target.value)}
                      placeholder="Describe the intelligence requirement..."
                      style={textareaStyle}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleCcirSubmit}
                      disabled={ccirSubmitting || !ccirDescription.trim()}
                      style={{
                        ...buttonStyle,
                        opacity: ccirSubmitting || !ccirDescription.trim() ? 0.5 : 1,
                        cursor: ccirSubmitting || !ccirDescription.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {ccirSubmitting ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              )}

              {ccirFeedback && (
                <div
                  style={{
                    padding: '0.375rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    marginTop: '0.25rem',
                    ...(ccirFeedback.type === 'success'
                      ? { backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#6ee7b7', border: '1px solid rgba(16, 185, 129, 0.3)' }
                      : { backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5', border: '1px solid rgba(239, 68, 68, 0.3)' }),
                  }}
                >
                  {ccirFeedback.message}
                </div>
              )}
            </div>
          )}

          {/* Incoming CCIR Requests (parent PS only) */}
          {!isChildPs && (
            <div style={{ marginTop: '0.75rem' }}>
              <span style={labelStyle}>Incoming Intelligence Requests</span>
              {incomingLoading ? (
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>Loading...</p>
              ) : incomingRequests.length === 0 ? (
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  No incoming CCIR/PIR requests from subordinate missions.
                </p>
              ) : (
                <div style={{ marginTop: '0.25rem' }}>
                  {incomingRequests.map((req) => {
                    const statusStyle = CCIR_STATUS_COLORS[req.status] || CCIR_STATUS_COLORS.pending;
                    return (
                      <div key={req.id} style={cardStyle}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                              <span style={{ ...badgeBase, backgroundColor: 'rgba(147, 51, 234, 0.15)', color: '#c084fc', border: '1px solid rgba(147, 51, 234, 0.3)' }}>
                                {req.requestType.toUpperCase()}
                              </span>
                              <span style={{ ...badgeBase, ...statusStyle }}>
                                {req.status}
                              </span>
                              <span style={{ color: '#6b7280', fontSize: '0.65rem' }}>
                                from {req.requestingPsId}
                              </span>
                            </div>
                            <p style={{ color: '#d1d5db', fontSize: '0.75rem' }}>
                              {req.description}
                            </p>
                          </div>
                          {req.status === 'pending' && (
                            <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                              <button
                                onClick={async () => {
                                  await missionCreationService.resolveCcirRequest(problemSetId, req.id, 'approved');
                                  fetchIncomingRequests();
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                                  border: '1px solid rgba(16, 185, 129, 0.3)',
                                  borderRadius: '0.25rem',
                                  color: '#6ee7b7',
                                  cursor: 'pointer',
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={async () => {
                                  await missionCreationService.resolveCcirRequest(problemSetId, req.id, 'denied');
                                  fetchIncomingRequests();
                                }}
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.7rem',
                                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  borderRadius: '0.25rem',
                                  color: '#fca5a5',
                                  cursor: 'pointer',
                                }}
                              >
                                Deny
                              </button>
                            </div>
                          )}
                        </div>
                        <span style={{ color: '#6b7280', fontSize: '0.6rem' }}>
                          {formatDate(req.createdAt)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
