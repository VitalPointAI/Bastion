/**
 * RobotMissionTrigger
 *
 * Phase 06 Plan 05: Demo mission trigger UI for the Direct tab.
 * Allows operators to select a robot, choose a mission type, configure
 * parameters, and dispatch via POST /api/robot/missions/trigger.
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface RobotInfo {
  robot_id: string;
  did: string;
  state: string;
  current_mission_id?: string;
  capabilities?: string[];
  latest_telemetry?: {
    position: { x: number; y: number };
    heading: number;
    battery: number;
  };
}

interface ResourceMatch {
  id: string;
  did: string;
  status: string;
  name: string;
  category: string;
  capabilities: string[];
}

interface MissionStatus {
  state: string;
}

interface Waypoint {
  x: number;
  y: number;
}

interface RobotMissionTriggerProps {
  problemSetId: string;
}

// ─── State colors ───────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  executing: '#22c55e',
  awaiting_auth: '#eab308',
  failed: '#ef4444',
  accepted: '#3b82f6',
  pending: '#3b82f6',
  complete: '#6b7280',
  rejected: '#ef4444',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function RobotMissionTrigger({ problemSetId }: RobotMissionTriggerProps) {
  // Connected robots
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  // Resource registry matches (auto-discovered)
  const [resourceMatches, setResourceMatches] = useState<Map<string, ResourceMatch>>(new Map());

  // Form state
  const [command, setCommand] = useState<'find_engage' | 'patrol_route'>('find_engage');
  const [robotId, setRobotId] = useState('alpha');
  const [speed, setSpeed] = useState(50);
  const [targetX, setTargetX] = useState(2.5);
  const [targetY, setTargetY] = useState(3.0);
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { x: 1, y: 1 },
    { x: 4, y: 1 },
    { x: 2.5, y: 4 },
  ]);

  // Status
  const [dispatching, setDispatching] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [missionState, setMissionState] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Collapsed state
  const [expanded, setExpanded] = useState(true);

  // Fetch connected robots and their resource registry status
  const fetchRobots = useCallback(async () => {
    try {
      const res = await fetch('/api/robot/robots');
      if (!res.ok) return;
      const robotList = await res.json() as RobotInfo[];
      setRobots(robotList);

      // Look up each robot's DID in the resource registry
      const matches = new Map<string, ResourceMatch>();
      for (const r of robotList) {
        if (!r.did) continue;
        try {
          const didRes = await fetch(`/api/resources/did/${encodeURIComponent(r.did)}`);
          if (didRes.ok) {
            const resource = await didRes.json() as ResourceMatch;
            matches.set(r.robot_id, resource);
          }
        } catch { /* non-fatal */ }
      }
      setResourceMatches(matches);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchRobots();
    const interval = setInterval(fetchRobots, 5000);
    return () => clearInterval(interval);
  }, [fetchRobots]);

  // Poll active mission status
  useEffect(() => {
    if (!activeMissionId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/robot/missions/${activeMissionId}`);
        if (res.ok) {
          const data = await res.json() as MissionStatus;
          setMissionState(data.state);
          if (data.state === 'complete' || data.state === 'failed' || data.state === 'rejected') {
            clearInterval(interval);
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeMissionId]);

  // Launch mission
  async function handleLaunch() {
    setDispatching(true);
    setMessage(null);

    const params: Record<string, unknown> = { speed };
    if (command === 'find_engage') {
      params.target_location = { x: targetX, y: targetY };
    } else {
      params.waypoints = waypoints;
    }

    try {
      const res = await fetch('/api/robot/missions/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robot_id: robotId,
          command,
          params,
          problem_set_id: problemSetId,
        }),
      });

      const data = await res.json() as { mission_id?: string; error?: string; reason?: string };

      if (res.status === 201 && data.mission_id) {
        setActiveMissionId(data.mission_id);
        setMissionState('pending');
        setMessage({ type: 'success', text: `Mission dispatched: ${data.mission_id.slice(0, 8)}...` });
      } else if (res.status === 403) {
        setMessage({ type: 'error', text: `Policy violation: ${data.reason || data.error}` });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to dispatch mission' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setDispatching(false);
    }
  }

  // Update waypoint
  function updateWaypoint(index: number, field: 'x' | 'y', value: number) {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, [field]: value } : wp)));
  }

  function addWaypoint() {
    setWaypoints((prev) => [...prev, { x: 0, y: 0 }]);
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: 'var(--surface-secondary, #1e293b)',
      border: '1px solid var(--border-color, #334155)',
      borderRadius: '0.5rem',
      marginTop: '1rem',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          width: '100%',
          padding: '0.75rem 1rem',
          background: 'transparent',
          border: 'none',
          borderBottom: expanded ? '1px solid var(--border-color, #334155)' : 'none',
          color: '#e2e8f0',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
          <path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7v1H3v-1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM7.5 13a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm9 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM5 19v1a1 1 0 001 1h12a1 1 0 001-1v-1H5z"/>
        </svg>
        Robot Mission Control
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: '#64748b' }}>
          {expanded ? '▼' : '▶'}
        </span>
      </button>

      {expanded && (
        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Connected Robots & Discovery Status */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
              Connected Robots
            </div>
            {robots.length === 0 ? (
              <div style={{ fontSize: '0.8125rem', color: '#64748b', padding: '0.5rem', background: 'var(--surface-primary, #0f172a)', borderRadius: '0.375rem', border: '1px solid var(--border-color, #334155)' }}>
                <div>No robots connected</div>
                <div style={{ fontSize: '0.6875rem', color: '#475569', marginTop: '0.25rem' }}>
                  Robots auto-register when they connect via WebSocket
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {robots.map((r) => {
                  const resource = resourceMatches.get(r.robot_id);
                  return (
                    <div key={r.robot_id} style={{
                      padding: '0.5rem 0.625rem',
                      background: 'var(--surface-primary, #0f172a)',
                      borderRadius: '0.375rem',
                      border: '1px solid var(--border-color, #334155)',
                    }}>
                      {/* Robot identity row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem' }}>
                        <div style={{
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: r.state === 'connected' ? '#22c55e' : '#ef4444',
                          boxShadow: r.state === 'connected' ? '0 0 4px #22c55e' : 'none',
                        }} />
                        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{r.robot_id}</span>
                        {r.current_mission_id && (
                          <span style={{ fontSize: '0.6875rem', color: '#eab308', background: 'rgba(234,179,8,0.1)', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>active mission</span>
                        )}
                      </div>

                      {/* DID */}
                      {r.did && (
                        <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                          {r.did.length > 40 ? `${r.did.slice(0, 20)}...${r.did.slice(-12)}` : r.did}
                        </div>
                      )}

                      {/* Resource discovery status */}
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '0.375rem',
                        marginTop: '0.375rem', fontSize: '0.6875rem',
                      }}>
                        {resource ? (
                          <>
                            <span style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                              background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)',
                              color: '#86efac',
                            }}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Registered in Resource Registry
                            </span>
                            <span style={{
                              padding: '0.125rem 0.375rem', borderRadius: '0.25rem',
                              background: resource.status === 'FMC' ? 'rgba(34,197,94,0.15)' : resource.status === 'PMC' ? 'rgba(234,179,8,0.15)' : 'rgba(239,68,68,0.15)',
                              color: resource.status === 'FMC' ? '#86efac' : resource.status === 'PMC' ? '#fde047' : '#fca5a5',
                            }}>
                              {resource.status}
                            </span>
                          </>
                        ) : (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            padding: '0.125rem 0.5rem', borderRadius: '0.25rem',
                            background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.3)',
                            color: '#fde047',
                          }}>
                            <span style={{ display: 'inline-block', width: '8px', height: '8px', border: '2px solid rgba(253,224,71,0.5)', borderTopColor: '#fde047', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            Registering...
                          </span>
                        )}
                      </div>

                      {/* Capabilities */}
                      {(r.capabilities ?? resource?.capabilities)?.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem' }}>
                          {(r.capabilities ?? resource?.capabilities ?? []).map((cap) => (
                            <span key={cap} style={{
                              fontSize: '0.625rem', padding: '0.0625rem 0.375rem',
                              background: 'rgba(59, 130, 246, 0.15)', border: '1px solid rgba(59, 130, 246, 0.3)',
                              borderRadius: '0.25rem', color: '#93c5fd',
                            }}>
                              {cap}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {/* Telemetry snapshot */}
                      {r.latest_telemetry && (
                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.375rem', fontSize: '0.625rem', color: '#64748b' }}>
                          <span>pos: ({r.latest_telemetry.position.x.toFixed(1)}, {r.latest_telemetry.position.y.toFixed(1)})</span>
                          <span>hdg: {r.latest_telemetry.heading}°</span>
                          <span>bat: {r.latest_telemetry.battery}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mission Type */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
              Mission Type
            </label>
            <select
              value={command}
              onChange={(e) => setCommand(e.target.value as 'find_engage' | 'patrol_route')}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--surface-primary, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.8125rem',
              }}
            >
              <option value="find_engage">Find & Engage Target</option>
              <option value="patrol_route">Patrol Route</option>
            </select>
          </div>

          {/* Robot ID */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
              Robot ID
            </label>
            <select
              value={robotId}
              onChange={(e) => setRobotId(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem',
                background: 'var(--surface-primary, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: '0.375rem',
                color: '#e2e8f0',
                fontSize: '0.8125rem',
              }}
            >
              <option value="alpha">alpha (default)</option>
              {robots.map((r) => (
                <option key={r.robot_id} value={r.robot_id}>{r.robot_id}</option>
              ))}
            </select>
          </div>

          {/* Target / Waypoints */}
          {command === 'find_engage' ? (
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                Target Location (room meters)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="number"
                  value={targetX}
                  onChange={(e) => setTargetX(Number(e.target.value))}
                  step={0.1}
                  placeholder="X"
                  style={inputStyle}
                />
                <input
                  type="number"
                  value={targetY}
                  onChange={(e) => setTargetY(Number(e.target.value))}
                  step={0.1}
                  placeholder="Y"
                  style={inputStyle}
                />
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
                Waypoints
              </label>
              {waypoints.map((wp, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', width: '1rem' }}>{i + 1}.</span>
                  <input
                    type="number"
                    value={wp.x}
                    onChange={(e) => updateWaypoint(i, 'x', Number(e.target.value))}
                    step={0.1}
                    placeholder="X"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <input
                    type="number"
                    value={wp.y}
                    onChange={(e) => updateWaypoint(i, 'y', Number(e.target.value))}
                    step={0.1}
                    placeholder="Y"
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  {waypoints.length > 2 && (
                    <button
                      onClick={() => removeWaypoint(i)}
                      style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', padding: '0.25rem' }}
                    >
                      x
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={addWaypoint}
                style={{
                  background: 'none',
                  border: '1px dashed #334155',
                  borderRadius: '0.375rem',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.5rem',
                  width: '100%',
                }}
              >
                + Add Waypoint
              </button>
            </div>
          )}

          {/* Speed */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '0.375rem' }}>
              Speed: {speed}
            </label>
            <input
              type="range"
              min={0}
              max={255}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Launch Button */}
          <button
            onClick={handleLaunch}
            disabled={dispatching}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.625rem',
              background: dispatching ? '#1e3a5f' : '#2563eb',
              border: 'none',
              borderRadius: '0.375rem',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: dispatching ? 'not-allowed' : 'pointer',
              opacity: dispatching ? 0.7 : 1,
            }}
          >
            {dispatching ? (
              <>
                <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                Dispatching...
              </>
            ) : (
              'Launch Mission'
            )}
          </button>

          {/* Message */}
          {message && (
            <div style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.8125rem',
              background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
              color: message.type === 'success' ? '#86efac' : '#fca5a5',
            }}>
              {message.text}
            </div>
          )}

          {/* Active Mission Status */}
          {activeMissionId && missionState && (
            <div style={{
              padding: '0.75rem',
              background: 'var(--surface-primary, #0f172a)',
              borderRadius: '0.375rem',
              border: '1px solid var(--border-color, #334155)',
            }}>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.375rem' }}>
                Active Mission
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{
                  width: '10px',
                  height: '10px',
                  borderRadius: '50%',
                  background: STATE_COLORS[missionState] || '#6b7280',
                  boxShadow: missionState === 'awaiting_auth' ? `0 0 8px ${STATE_COLORS.awaiting_auth}` : 'none',
                }} />
                <span style={{
                  fontSize: '0.8125rem',
                  color: STATE_COLORS[missionState] || '#e2e8f0',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                }}>
                  {missionState.replace(/_/g, ' ')}
                </span>
              </div>
              <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.25rem' }}>
                {activeMissionId.slice(0, 8)}...
              </div>
              {missionState === 'awaiting_auth' && (
                <div style={{
                  marginTop: '0.5rem',
                  padding: '0.375rem 0.5rem',
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '0.25rem',
                  fontSize: '0.75rem',
                  color: '#fde047',
                }}>
                  Awaiting human authorization — check Governance panel
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem',
  background: 'var(--surface-primary, #0f172a)',
  border: '1px solid var(--border-color, #334155)',
  borderRadius: '0.375rem',
  color: '#e2e8f0',
  fontSize: '0.8125rem',
};
