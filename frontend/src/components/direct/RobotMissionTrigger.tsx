/**
 * RobotMissionTrigger
 *
 * Phase 06 Plan 05: Mission trigger UI for the Direct tab.
 * Supports all 9 mission types with appropriate parameter forms.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CoalitionCaveatDashboard } from './CoalitionCaveatDashboard.js';

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
  command?: string;
}

interface CaveatCheckResult {
  allowed: boolean;
  blockedRobots: Array<{
    robotId: string;
    nationalDid: string;
    nation: string;
    reason: string;
  }>;
}

interface Waypoint {
  x: number;
  y: number;
}

interface AreaBounds {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

interface RobotMissionTriggerProps {
  problemSetId: string;
}

// ─── Mission type definitions ────────────────────────────────────────────────

type MissionCommand =
  | 'find_engage'
  | 'patrol_route'
  | 'recon_area'
  | 'visual_search'
  | 'overwatch'
  | 'resupply_route'
  | 'swarm_patrol'
  | 'swarm_recon'
  | 'swarm_advance';

interface MissionTypeInfo {
  label: string;
  description: string;
  capability: string;
  group: 'solo' | 'swarm';
}

const MISSION_TYPES: Record<MissionCommand, MissionTypeInfo> = {
  find_engage: {
    label: 'Find & Engage',
    description: 'Navigate to target location and engage',
    capability: 'find_engage',
    group: 'solo',
  },
  patrol_route: {
    label: 'Patrol Route',
    description: 'Follow waypoints in a patrol pattern',
    capability: 'patrol',
    group: 'solo',
  },
  recon_area: {
    label: 'Recon Area',
    description: 'Sweep a bounded area with ISR sensors',
    capability: 'ISR',
    group: 'solo',
  },
  visual_search: {
    label: 'Visual Search',
    description: 'Search for object matching reference image',
    capability: 'ISR',
    group: 'solo',
  },
  overwatch: {
    label: 'Overwatch',
    description: 'Hold position and observe target location',
    capability: 'patrol',
    group: 'solo',
  },
  resupply_route: {
    label: 'Resupply Route',
    description: 'Follow waypoints to deliver supplies',
    capability: 'resupply',
    group: 'solo',
  },
  swarm_patrol: {
    label: 'Swarm Patrol',
    description: 'Formation patrol along waypoints',
    capability: 'swarm_leader',
    group: 'swarm',
  },
  swarm_recon: {
    label: 'Swarm Recon',
    description: 'Formation sweep of area with shared vision',
    capability: 'swarm_leader',
    group: 'swarm',
  },
  swarm_advance: {
    label: 'Swarm Advance',
    description: 'Doctrinal advance toward target in formation',
    capability: 'swarm_leader',
    group: 'swarm',
  },
};

const FORMATIONS = ['wedge', 'line', 'column', 'echelon_left', 'echelon_right', 'vee'] as const;
const TECHNIQUES = ['traveling', 'traveling_overwatch', 'bounding_overwatch'] as const;

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
  const [resourceMatches, setResourceMatches] = useState<Map<string, ResourceMatch>>(new Map());

  // Form state
  const [command, setCommand] = useState<MissionCommand>('find_engage');
  const [robotId, setRobotId] = useState('alpha');
  const [speed, setSpeed] = useState(50);

  // Target location (find_engage, overwatch, swarm_advance)
  const [targetX, setTargetX] = useState(2.5);
  const [targetY, setTargetY] = useState(3.0);

  // Waypoints (patrol_route, resupply_route, swarm_patrol)
  const [waypoints, setWaypoints] = useState<Waypoint[]>([
    { x: 1, y: 1 },
    { x: 4, y: 1 },
    { x: 2.5, y: 4 },
  ]);

  // Area bounds (recon_area, swarm_recon)
  const [area, setArea] = useState<AreaBounds>({ x_min: 0, y_min: 0, x_max: 5, y_max: 5 });

  // Duration (overwatch)
  const [durationSec, setDurationSec] = useState(60);

  // Reference image (visual_search)
  const [referenceImageB64, setReferenceImageB64] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Swarm params
  const [formation, setFormation] = useState<string>('wedge');
  const [spacingM, setSpacingM] = useState(1.0);
  const [technique, setTechnique] = useState<string>('traveling');

  // Status
  const [dispatching, setDispatching] = useState(false);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [missionState, setMissionState] = useState<string | null>(null);
  const [missionCommand, setMissionCommand] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Collapsed state
  const [expanded, setExpanded] = useState(true);

  // Coalition caveat check result (swarm missions only)
  const [caveatResult, setCaveatResult] = useState<CaveatCheckResult | null>(null);

  // Track DIDs that returned 404 to avoid repeated polling
  const notFoundDidsRef = useRef(new Set<string>());

  // Fetch connected robots and their resource registry status
  const fetchRobots = useCallback(async () => {
    try {
      const res = await fetch('/api/robot/robots');
      if (!res.ok) return;
      const robotList = await res.json() as RobotInfo[];
      setRobots(robotList);

      const matches = new Map<string, ResourceMatch>();
      for (const r of robotList) {
        if (!r.did) continue;
        // Skip DIDs already known to be unregistered
        if (notFoundDidsRef.current.has(r.did)) continue;
        try {
          const didRes = await fetch(`/api/resources/did/${encodeURIComponent(r.did)}`);
          if (didRes.ok) {
            const resource = await didRes.json() as ResourceMatch;
            matches.set(r.robot_id, resource);
            // Clear from not-found if it was previously missing but now registered
            notFoundDidsRef.current.delete(r.did);
          } else if (didRes.status === 404) {
            notFoundDidsRef.current.add(r.did);
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
          if (data.command) setMissionCommand(data.command);
          if (data.state === 'complete' || data.state === 'failed' || data.state === 'rejected') {
            clearInterval(interval);
          }
        }
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, [activeMissionId]);

  // Handle reference image file selection
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip data:image/...;base64, prefix
      const b64 = result.includes(',') ? result.split(',')[1] : result;
      setReferenceImageB64(b64);
    };
    reader.readAsDataURL(file);
  }

  // Build params based on command type
  function buildParams(): Record<string, unknown> {
    const params: Record<string, unknown> = { speed };

    switch (command) {
      case 'find_engage':
        params.target_location = { x: targetX, y: targetY };
        break;

      case 'patrol_route':
      case 'resupply_route':
        params.waypoints = waypoints;
        break;

      case 'recon_area':
        params.area = area;
        break;

      case 'visual_search':
        params.reference_image_b64 = referenceImageB64;
        break;

      case 'overwatch':
        params.target_location = { x: targetX, y: targetY };
        params.duration_sec = durationSec;
        break;

      case 'swarm_patrol':
        params.waypoints = waypoints;
        params.formation = formation;
        params.spacing_m = spacingM;
        params.technique = technique;
        break;

      case 'swarm_recon':
        params.area = area;
        params.formation = formation;
        params.spacing_m = spacingM;
        params.technique = technique;
        break;

      case 'swarm_advance':
        params.target_location = { x: targetX, y: targetY };
        params.formation = formation;
        params.spacing_m = spacingM;
        params.technique = technique;
        break;
    }

    return params;
  }

  // Launch mission
  async function handleLaunch() {
    setDispatching(true);
    setMessage(null);

    try {
      const res = await fetch('/api/robot/missions/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          robot_id: robotId,
          command,
          params: buildParams(),
          problem_set_id: problemSetId,
        }),
      });

      const data = await res.json() as { mission_id?: string; error?: string; reason?: string };

      if (res.status === 201 && data.mission_id) {
        setActiveMissionId(data.mission_id);
        setMissionState('pending');
        setMissionCommand(command);
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

  // Waypoint helpers
  function updateWaypoint(index: number, field: 'x' | 'y', value: number) {
    setWaypoints((prev) => prev.map((wp, i) => (i === index ? { ...wp, [field]: value } : wp)));
  }

  function addWaypoint() {
    setWaypoints((prev) => [...prev, { x: 0, y: 0 }]);
  }

  function removeWaypoint(index: number) {
    setWaypoints((prev) => prev.filter((_, i) => i !== index));
  }

  // Which param sections to show
  const needsTarget = ['find_engage', 'overwatch', 'swarm_advance'].includes(command);
  const needsWaypoints = ['patrol_route', 'resupply_route', 'swarm_patrol'].includes(command);
  const needsArea = ['recon_area', 'swarm_recon'].includes(command);
  const needsDuration = command === 'overwatch';
  const needsRefImage = command === 'visual_search';
  const needsSwarmParams = command.startsWith('swarm_') || command === 'find_engage';
  const isSwarmMission = command.startsWith('swarm_') || command === 'find_engage';
  const missionInfo = MISSION_TYPES[command];

  // Build swarm member list from known robots for the caveat check
  // Only include robots that have a DID (coalition robots)
  const swarmMembersForCaveat = robots
    .filter((r) => r.did)
    .map((r) => ({ robotId: r.robot_id, nationalDid: r.did as string }));

  // Determine if dispatch should be blocked by caveats
  const caveatBlocked = isSwarmMission && swarmMembersForCaveat.length > 0
    && caveatResult !== null
    && !caveatResult.allowed;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      background: 'var(--surface-secondary, #1e293b)',
      border: '1px solid var(--border-color, #334155)',
      borderRadius: '0.5rem',
      marginTop: '1rem',
      overflow: 'auto',
      maxHeight: 'calc(100vh - 8rem)',
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
            <div style={sectionLabel}>Connected Robots</div>
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
                      {r.did && (
                        <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                          {r.did.length > 40 ? `${r.did.slice(0, 20)}...${r.did.slice(-12)}` : r.did}
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginTop: '0.375rem', fontSize: '0.6875rem' }}>
                        {resource ? (
                          <>
                            <span style={registeredBadge}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Registered
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
                          <span style={registeringBadge}>
                            <span style={spinner} />
                            Registering...
                          </span>
                        )}
                      </div>
                      {(r.capabilities ?? resource?.capabilities)?.length ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem' }}>
                          {(r.capabilities ?? resource?.capabilities ?? []).map((cap) => (
                            <span key={cap} style={capBadge}>{cap}</span>
                          ))}
                        </div>
                      ) : null}
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

          {/* Mission Type — grouped by solo / swarm */}
          <div>
            <label style={sectionLabel}>Mission Type</label>
            <select
              value={command}
              onChange={(e) => setCommand(e.target.value as MissionCommand)}
              style={selectStyle}
            >
              <optgroup label="Solo Missions">
                {Object.entries(MISSION_TYPES)
                  .filter(([, info]) => info.group === 'solo')
                  .map(([cmd, info]) => (
                    <option key={cmd} value={cmd}>{info.label}</option>
                  ))}
              </optgroup>
              <optgroup label="Swarm Missions">
                {Object.entries(MISSION_TYPES)
                  .filter(([, info]) => info.group === 'swarm')
                  .map(([cmd, info]) => (
                    <option key={cmd} value={cmd}>{info.label}</option>
                  ))}
              </optgroup>
            </select>
            <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.25rem' }}>
              {missionInfo.description}
              <span style={{ marginLeft: '0.5rem', color: '#475569' }}>
                (requires: {missionInfo.capability})
              </span>
            </div>
          </div>

          {/* Robot ID */}
          <div>
            <label style={sectionLabel}>Robot ID</label>
            <select
              value={robotId}
              onChange={(e) => setRobotId(e.target.value)}
              style={selectStyle}
            >
              <option value="alpha">alpha (default)</option>
              {robots.map((r) => (
                <option key={r.robot_id} value={r.robot_id}>{r.robot_id}</option>
              ))}
            </select>
          </div>

          {/* Target Location */}
          {needsTarget && (
            <div>
              <label style={sectionLabel}>
                Target Location (room meters)
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="number" value={targetX} onChange={(e) => setTargetX(Number(e.target.value))} step={0.1} placeholder="X" style={inputStyle} />
                <input type="number" value={targetY} onChange={(e) => setTargetY(Number(e.target.value))} step={0.1} placeholder="Y" style={inputStyle} />
              </div>
            </div>
          )}

          {/* Waypoints */}
          {needsWaypoints && (
            <div>
              <label style={sectionLabel}>Waypoints</label>
              {waypoints.map((wp, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.375rem', marginBottom: '0.375rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.6875rem', color: '#64748b', width: '1rem' }}>{i + 1}.</span>
                  <input type="number" value={wp.x} onChange={(e) => updateWaypoint(i, 'x', Number(e.target.value))} step={0.1} placeholder="X" style={{ ...inputStyle, flex: 1 }} />
                  <input type="number" value={wp.y} onChange={(e) => updateWaypoint(i, 'y', Number(e.target.value))} step={0.1} placeholder="Y" style={{ ...inputStyle, flex: 1 }} />
                  {waypoints.length > 2 && (
                    <button onClick={() => removeWaypoint(i)} style={removeBtn}>x</button>
                  )}
                </div>
              ))}
              <button onClick={addWaypoint} style={addWaypointBtn}>+ Add Waypoint</button>
            </div>
          )}

          {/* Area Bounds */}
          {needsArea && (
            <div>
              <label style={sectionLabel}>Area Bounds (room meters)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem' }}>
                <div>
                  <div style={fieldLabel}>X Min</div>
                  <input type="number" value={area.x_min} onChange={(e) => setArea((a) => ({ ...a, x_min: Number(e.target.value) }))} step={0.1} style={inputStyle} />
                </div>
                <div>
                  <div style={fieldLabel}>Y Min</div>
                  <input type="number" value={area.y_min} onChange={(e) => setArea((a) => ({ ...a, y_min: Number(e.target.value) }))} step={0.1} style={inputStyle} />
                </div>
                <div>
                  <div style={fieldLabel}>X Max</div>
                  <input type="number" value={area.x_max} onChange={(e) => setArea((a) => ({ ...a, x_max: Number(e.target.value) }))} step={0.1} style={inputStyle} />
                </div>
                <div>
                  <div style={fieldLabel}>Y Max</div>
                  <input type="number" value={area.y_max} onChange={(e) => setArea((a) => ({ ...a, y_max: Number(e.target.value) }))} step={0.1} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          {/* Duration */}
          {needsDuration && (
            <div>
              <label style={sectionLabel}>Duration: {durationSec}s</label>
              <input type="range" min={10} max={600} value={durationSec} onChange={(e) => setDurationSec(Number(e.target.value))} style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#475569' }}>
                <span>10s</span><span>10min</span>
              </div>
            </div>
          )}

          {/* Reference Image */}
          {needsRefImage && (
            <div>
              <label style={sectionLabel}>Reference Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  ...addWaypointBtn,
                  marginBottom: referenceImageB64 ? '0.5rem' : 0,
                }}
              >
                {referenceImageB64 ? 'Change Image' : 'Upload Reference Image'}
              </button>
              {referenceImageB64 && (
                <div style={{ borderRadius: '0.375rem', overflow: 'hidden', border: '1px solid var(--border-color, #334155)' }}>
                  <img
                    src={`data:image/jpeg;base64,${referenceImageB64}`}
                    alt="Reference"
                    style={{ width: '100%', height: 'auto', display: 'block', maxHeight: '120px', objectFit: 'cover' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Swarm Parameters */}
          {needsSwarmParams && (
            <div style={{
              padding: '0.75rem',
              background: 'rgba(234, 179, 8, 0.05)',
              border: '1px solid rgba(234, 179, 8, 0.2)',
              borderRadius: '0.375rem',
            }}>
              <div style={{ ...sectionLabel, color: '#eab308', marginBottom: '0.5rem' }}>Swarm Parameters</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div>
                  <div style={fieldLabel}>Formation</div>
                  <select value={formation} onChange={(e) => setFormation(e.target.value)} style={selectStyle}>
                    {FORMATIONS.map((f) => (
                      <option key={f} value={f}>{f.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={fieldLabel}>Movement Technique</div>
                  <select value={technique} onChange={(e) => setTechnique(e.target.value)} style={selectStyle}>
                    {TECHNIQUES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={fieldLabel}>Spacing: {spacingM.toFixed(1)}m</div>
                  <input type="range" min={0.3} max={3.0} step={0.1} value={spacingM} onChange={(e) => setSpacingM(Number(e.target.value))} style={{ width: '100%' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: '#475569' }}>
                    <span>0.3m</span><span>3.0m</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Coalition Caveat Pre-Flight Check — swarm missions only */}
          {isSwarmMission && swarmMembersForCaveat.length > 0 && (
            <CoalitionCaveatDashboard
              swarmMembers={swarmMembersForCaveat}
              missionType={command}
              areaType="urban"
              onCaveatResult={setCaveatResult}
            />
          )}

          {/* Speed */}
          <div>
            <label style={sectionLabel}>Speed: {speed}</label>
            <input type="range" min={0} max={255} value={speed} onChange={(e) => setSpeed(Number(e.target.value))} style={{ width: '100%' }} />
          </div>

          {/* Launch Button */}
          <button
            onClick={handleLaunch}
            disabled={dispatching || (needsRefImage && !referenceImageB64) || caveatBlocked}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              width: '100%',
              padding: '0.625rem',
              background: caveatBlocked ? '#374151' : dispatching ? '#1e3a5f' : '#2563eb',
              border: caveatBlocked ? '1px solid rgba(239,68,68,0.4)' : 'none',
              borderRadius: '0.375rem',
              color: caveatBlocked ? '#9ca3af' : 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: dispatching || caveatBlocked ? 'not-allowed' : 'pointer',
              opacity: dispatching || (needsRefImage && !referenceImageB64) || caveatBlocked ? 0.7 : 1,
            }}
          >
            {dispatching ? (
              <>
                <span style={spinner} />
                Dispatching...
              </>
            ) : caveatBlocked ? (
              `Blocked — Caveat Violation`
            ) : (
              `Launch ${missionInfo.label}`
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
              <div style={sectionLabel}>Active Mission</div>
              {missionCommand && (
                <div style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.25rem' }}>
                  {missionCommand.replace(/_/g, ' ')}
                </div>
              )}
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

// ─── Shared styles ──────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem',
  background: 'var(--surface-primary, #0f172a)',
  border: '1px solid var(--border-color, #334155)',
  borderRadius: '0.375rem',
  color: '#e2e8f0',
  fontSize: '0.8125rem',
};

const selectStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  background: 'var(--surface-primary, #0f172a)',
  border: '1px solid var(--border-color, #334155)',
  borderRadius: '0.375rem',
  color: '#e2e8f0',
  fontSize: '0.8125rem',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '0.75rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  display: 'block',
  marginBottom: '0.375rem',
};

const fieldLabel: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: '#64748b',
  marginBottom: '0.125rem',
};

const capBadge: React.CSSProperties = {
  fontSize: '0.625rem',
  padding: '0.0625rem 0.375rem',
  background: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
};

const registeredBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.125rem 0.5rem',
  borderRadius: '0.25rem',
  background: 'rgba(34, 197, 94, 0.1)',
  border: '1px solid rgba(34, 197, 94, 0.3)',
  color: '#86efac',
};

const registeringBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.125rem 0.5rem',
  borderRadius: '0.25rem',
  background: 'rgba(234, 179, 8, 0.1)',
  border: '1px solid rgba(234, 179, 8, 0.3)',
  color: '#fde047',
};

const spinner: React.CSSProperties = {
  display: 'inline-block',
  width: '14px',
  height: '14px',
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: 'white',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
};

const removeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  fontSize: '0.75rem',
  padding: '0.25rem',
};

const addWaypointBtn: React.CSSProperties = {
  background: 'none',
  border: '1px dashed #334155',
  borderRadius: '0.375rem',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.75rem',
  padding: '0.25rem 0.5rem',
  width: '100%',
};
