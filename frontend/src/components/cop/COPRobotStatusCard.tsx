/**
 * COPRobotStatusCard
 *
 * Phase 06 Plan 04: Detail panel showing robot mission status, state timeline,
 * telemetry snapshot, vision feed, and capability list.
 * Opens when a robot marker is clicked on the COP.
 */

import { useEffect, useState } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

interface VisionDetection {
  class_desc: string;
  confidence: number;
  bbox: { left: number; top: number; right: number; bottom: number };
}

interface LatestVision {
  timestamp: string;
  mission_id?: string;
  detections: VisionDetection[];
  scene_description?: string;
  keyframe_jpeg_b64?: string;
}

interface RobotInfo {
  robot_id: string;
  did: string;
  capabilities: string[];
  state: string;
  current_mission_id?: string;
  last_heartbeat: number;
  latest_telemetry?: {
    position: { x: number; y: number };
    heading: number;
    battery: number;
  };
  latest_vision?: LatestVision;
}

interface MissionStatus {
  state: string;
  command?: string;
}

interface COPRobotStatusCardProps {
  robotId: string;
  onClose: () => void;
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

// ─── State timeline order ───────────────────────────────────────────────────

const STATE_ORDER = ['pending', 'accepted', 'executing', 'awaiting_auth', 'complete', 'failed', 'rejected'];

// ─── Component ──────────────────────────────────────────────────────────────

export function COPRobotStatusCard({ robotId, onClose }: COPRobotStatusCardProps) {
  const [robot, setRobot] = useState<RobotInfo | null>(null);
  const [mission, setMission] = useState<MissionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const robotsRes = await fetch('/api/robot/robots');
        if (robotsRes.ok) {
          const robots = (await robotsRes.json()) as RobotInfo[];
          const found = robots.find((r) => r.robot_id === robotId);
          if (!cancelled && found) {
            setRobot(found);

            if (found.current_mission_id) {
              const missionRes = await fetch(`/api/robot/missions/${found.current_mission_id}`);
              if (missionRes.ok && !cancelled) {
                setMission(await missionRes.json() as MissionStatus);
              }
            } else {
              if (!cancelled) setMission(null);
            }
          }
        }
      } catch (err) {
        console.warn('[COPRobotStatusCard] Failed to fetch:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [robotId]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function batteryColor(pct: number): string {
    if (pct > 60) return '#22c55e';
    if (pct > 20) return '#eab308';
    return '#ef4444';
  }

  function confidenceColor(conf: number): string {
    if (conf >= 0.8) return '#22c55e';
    if (conf >= 0.5) return '#eab308';
    return '#ef4444';
  }

  function timeAgo(ts: string): string {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 1000) return 'just now';
    if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    return `${Math.floor(diff / 3_600_000)}h ago`;
  }

  // ─── Section label ────────────────────────────────────────────────────────

  const sectionLabel = {
    fontSize: '10px',
    color: '#6b7280',
    textTransform: 'uppercase' as const,
    marginBottom: '4px',
    letterSpacing: '0.5px',
  };

  // ─── State timeline ───────────────────────────────────────────────────────

  function renderTimeline(currentState: string) {
    const currentIdx = STATE_ORDER.indexOf(currentState);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {STATE_ORDER.filter((s) => {
          const idx = STATE_ORDER.indexOf(s);
          if (s === 'failed' || s === 'rejected') return s === currentState;
          return idx <= currentIdx;
        }).map((state) => {
          const color = STATE_COLORS[state] || '#6b7280';
          const isActive = state === currentState;
          return (
            <div key={state} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: color,
                opacity: isActive ? 1 : 0.5,
                boxShadow: isActive ? `0 0 6px ${color}` : 'none',
              }} />
              <span style={{
                fontSize: '11px',
                color: isActive ? '#e5e7eb' : '#6b7280',
                fontWeight: isActive ? 600 : 400,
                textTransform: 'capitalize',
              }}>
                {state.replace(/_/g, ' ')}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Vision feed ──────────────────────────────────────────────────────────

  function renderVision(vision: LatestVision) {
    return (
      <div>
        <div style={{ ...sectionLabel, marginBottom: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Vision Feed</span>
          <span style={{ fontSize: '9px', color: '#4b5563', fontWeight: 400, textTransform: 'none' }}>
            {timeAgo(vision.timestamp)}
          </span>
        </div>

        {/* Keyframe image */}
        {vision.keyframe_jpeg_b64 && (
          <div style={{
            marginBottom: '8px',
            borderRadius: '4px',
            overflow: 'hidden',
            border: '1px solid #374151',
          }}>
            <img
              src={`data:image/jpeg;base64,${vision.keyframe_jpeg_b64}`}
              alt="Robot camera feed"
              style={{
                width: '100%',
                height: 'auto',
                display: 'block',
              }}
            />
          </div>
        )}

        {/* Scene description */}
        {vision.scene_description && (
          <div style={{
            fontSize: '11px',
            color: '#9ca3af',
            fontStyle: 'italic',
            marginBottom: '6px',
            lineHeight: '1.4',
          }}>
            {vision.scene_description}
          </div>
        )}

        {/* Detections list */}
        {vision.detections.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {vision.detections.map((det, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  background: 'rgba(31, 41, 55, 0.6)',
                  border: '1px solid #374151',
                }}
              >
                <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
                  {det.class_desc}
                </span>
                <span style={{ color: confidenceColor(det.confidence), fontSize: '10px' }}>
                  {(det.confidence * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: '#4b5563' }}>No detections</div>
        )}
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      right: '340px',
      width: '280px',
      maxHeight: 'calc(100vh - 100px)',
      overflowY: 'auto',
      zIndex: 1000,
      background: 'rgba(17, 24, 39, 0.97)',
      border: '1px solid #374151',
      borderRadius: '8px',
      fontFamily: "'Fira Code', 'JetBrains Mono', monospace",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderBottom: '1px solid #374151',
        background: 'rgba(31, 41, 55, 0.5)',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e5e7eb' }}>
            {robotId}
          </div>
          {robot && (
            <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '2px' }}>
              DID: {robot.did.length > 20 ? `${robot.did.slice(0, 10)}...${robot.did.slice(-6)}` : robot.did}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px',
            lineHeight: 1,
          }}
          aria-label="Close robot status"
        >
          x
        </button>
      </div>

      {loading && !robot ? (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
          Loading...
        </div>
      ) : robot ? (
        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Connection state */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: robot.state === 'connected' ? '#22c55e' : '#ef4444',
            }} />
            <span style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'capitalize' }}>
              {robot.state}
            </span>
          </div>

          {/* Current Mission */}
          <div>
            <div style={sectionLabel}>Current Mission</div>
            {robot.current_mission_id ? (
              <div style={{ fontSize: '11px', color: '#d1d5db' }}>
                {mission?.command && (
                  <div style={{ fontWeight: 600, marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                    {mission.command.replace(/_/g, ' ')}
                  </div>
                )}
                <div style={{ color: '#6b7280', fontSize: '10px' }}>{robot.current_mission_id.slice(0, 8)}...</div>
                {mission && (
                  <div style={{ marginTop: '2px', color: STATE_COLORS[mission.state] || '#6b7280' }}>
                    {mission.state.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: '11px', color: '#6b7280' }}>Idle</div>
            )}
          </div>

          {/* State Timeline */}
          {mission && (
            <div>
              <div style={{ ...sectionLabel, marginBottom: '6px' }}>State Timeline</div>
              {renderTimeline(mission.state)}
            </div>
          )}

          {/* Vision Feed */}
          {robot.latest_vision && renderVision(robot.latest_vision)}

          {/* Telemetry */}
          {robot.latest_telemetry && (
            <div>
              <div style={sectionLabel}>Telemetry</div>
              <div style={{ fontSize: '11px', color: '#d1d5db', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                <div>X: {robot.latest_telemetry.position.x.toFixed(2)}</div>
                <div>Y: {robot.latest_telemetry.position.y.toFixed(2)}</div>
                <div>Heading: {robot.latest_telemetry.heading}°</div>
                <div style={{ color: batteryColor(robot.latest_telemetry.battery) }}>
                  Battery: {robot.latest_telemetry.battery}%
                </div>
              </div>
            </div>
          )}

          {/* Capabilities */}
          {robot.capabilities.length > 0 && (
            <div>
              <div style={sectionLabel}>Capabilities</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                {robot.capabilities.map((cap) => (
                  <span
                    key={cap}
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.15)',
                      color: '#93c5fd',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                    }}
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280', fontSize: '12px' }}>
          Robot not found
        </div>
      )}
    </div>
  );
}
