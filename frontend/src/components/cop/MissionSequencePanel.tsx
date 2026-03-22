/**
 * MissionSequencePanel
 *
 * Floating overlay on the COP map for triggering and monitoring mission
 * sequences. Supports both scripted (Iron Bastion) and autonomous
 * (AI-driven) missions. Shows current phase, event log, AI assessment,
 * policy blocks, and commander action buttons.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

// Union of all phases across both orchestrators
type Phase =
  | 'idle' | 'hold' | 'recon' | 'contact' | 'overwatch' | 'advance' | 'set'
  | 'authorize' | 'engage' | 'bda' | 'withdraw' | 'complete'
  // Autonomous-only phases
  | 'assess' | 'plan_submitted' | 'positioning' | 'engage_blocked' | 'shadow';

type MissionType = 'scripted' | 'autonomous';

interface LogEntry {
  ts: string;
  msg: string;
  phase?: string;
}

interface SequenceStatus {
  id: string;
  phase: Phase;
  startedAt: string;
  phaseStartedAt: string;
  detectedThreats: unknown[];
  gateId?: string;
  resourceGateId?: string;
  lethalGateId?: string;
  tacticalPlan?: { assessment: string; engagementRecommendation: string; planConfidence: number };
  planAssessment?: string;
  planRecommendation?: string;
  policyBlock?: { robotDid: string; reason: string };
  log: LogEntry[];
}

// ─── Phase styling ──────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<Phase, { color: string; bg: string; label: string }> = {
  idle:            { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'IDLE' },
  hold:            { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  label: 'HOLD' },
  recon:           { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)',  label: 'RECON' },
  contact:         { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',   label: 'CONTACT' },
  assess:          { color: '#e879f9', bg: 'rgba(232,121,249,0.15)', label: 'AI ASSESS' },
  plan_submitted:  { color: '#f472b6', bg: 'rgba(244,114,182,0.15)', label: 'PLAN SUBMITTED' },
  overwatch:       { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   label: 'OVERWATCH' },
  positioning:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'POSITIONING' },
  advance:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  label: 'ADVANCE' },
  set:             { color: '#eab308', bg: 'rgba(234,179,8,0.15)',   label: 'SET' },
  engage_blocked:  { color: '#fb923c', bg: 'rgba(251,146,60,0.2)',   label: 'BLOCKED' },
  authorize:       { color: '#f97316', bg: 'rgba(249,115,22,0.15)',  label: 'AUTHORIZE' },
  engage:          { color: '#dc2626', bg: 'rgba(220,38,38,0.25)',   label: 'ENGAGE' },
  bda:             { color: '#a855f7', bg: 'rgba(168,85,247,0.15)',  label: 'BDA' },
  shadow:          { color: '#64748b', bg: 'rgba(100,116,139,0.2)',  label: 'SHADOW' },
  withdraw:        { color: '#6366f1', bg: 'rgba(99,102,241,0.15)',  label: 'WITHDRAW' },
  complete:        { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',   label: 'COMPLETE' },
};

// ─── Component ──────────────────────────────────────────────────────────────

// AO bounds for the Iron Bastion scenario (Taipei Zhongzheng District)
// From calibration profile: 5m room → 25.042-25.048°N, 121.512-121.518°E
const AO_CENTER: [number, number] = [25.045, 121.515];
const AO_ZOOM = 17;

interface MissionSequencePanelProps {
  problemSetId: string;
  /** Callback to zoom the map to the robot AO on simulation start */
  onZoomToAO?: (lat: number, lng: number, zoom: number) => void;
  /** Callback to refresh COP layers after seeding */
  onLayersChanged?: () => void;
}

export function MissionSequencePanel({ problemSetId, onZoomToAO, onLayersChanged }: MissionSequencePanelProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [missionType, setMissionType] = useState<MissionType>('autonomous');
  const [status, setStatus] = useState<SequenceStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [simulate, setSimulate] = useState(true);
  const [simSessionId, setSimSessionId] = useState<string | null>(null);
  const [simPaused, setSimPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedStatus, setSeedStatus] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Poll sequence status
  useEffect(() => {
    if (!sequenceId) return;
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/robot/scenarios/${sequenceId}`);
        if (res.ok && !cancelled) setStatus(await res.json());
      } catch { /* silent */ }
    }
    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sequenceId]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [status?.log.length]);

  // Check for existing active sequences on mount
  useEffect(() => {
    async function checkExisting() {
      try {
        const res = await fetch('/api/robot/scenarios');
        if (res.ok) {
          const sequences = await res.json();
          const active = sequences.find(
            (s: { phase: string }) => s.phase !== 'complete' && s.phase !== 'idle',
          );
          if (active) {
            setSequenceId(active.id);
            setMissionType(active.type ?? 'scripted');
            setCollapsed(false);
          }
        }
      } catch { /* silent */ }
    }
    checkExisting();
  }, []);

  const handleLaunch = useCallback(async (type: MissionType) => {
    setLaunching(true);
    setError(null);
    setMissionType(type);

    const base = type === 'autonomous'
      ? '/api/robot/scenarios/autonomous'
      : '/api/robot/scenarios/iron-bastion';
    const endpoint = simulate ? `${base}?simulate=true` : base;

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemSetId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start scenario');
      }
      const data = await res.json();
      setSequenceId(data.sequenceId);
      if (data.simSessionId) setSimSessionId(data.simSessionId);
      setSimPaused(false);
      setCollapsed(false);
      // Auto-zoom from strategic view to robot AO
      onZoomToAO?.(AO_CENTER[0], AO_CENTER[1], AO_ZOOM);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunching(false);
    }
  }, [simulate, problemSetId, onZoomToAO]);

  const handleReturnToBase = useCallback(async () => {
    if (!sequenceId) return;
    try {
      await fetch(`/api/robot/scenarios/${sequenceId}/return-to-base`, { method: 'POST' });
    } catch { /* silent */ }
  }, [sequenceId]);

  const handlePause = useCallback(async () => {
    if (!sequenceId) return;
    const endpoint = simPaused ? 'resume' : 'pause';
    try {
      // Pause/resume the autonomous orchestrator sequence
      const res = await fetch(`/api/robot/scenarios/${sequenceId}/${endpoint}`, { method: 'POST' });
      if (res.ok) setSimPaused(!simPaused);
      // Also pause/resume simulation if running
      if (simSessionId) {
        await fetch(`/api/robot/simulations/${simSessionId}/${endpoint}`, { method: 'POST' }).catch(() => {});
      }
    } catch { /* silent */ }
  }, [sequenceId, simSessionId, simPaused]);

  const handleReset = useCallback(async () => {
    try {
      // Stop the autonomous orchestrator sequence (cancels mission + stops robot)
      if (sequenceId) {
        await fetch(`/api/robot/scenarios/${sequenceId}/stop`, { method: 'POST' }).catch(() => {});
      }
      // Stop simulation session if running
      if (simSessionId) {
        await fetch(`/api/robot/simulations/${simSessionId}/reset`, { method: 'POST' }).catch(() => {});
      }
      // Clear seeded strategic COP layers and vision detections
      await fetch('/api/robot/scenarios/clear-strategic-cop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problemSetId }),
      }).catch(() => { /* non-fatal */ });
      onLayersChanged?.();
      setSimSessionId(null);
      setSequenceId(null);
      setStatus(null);
      setSimPaused(false);
      setSeedStatus(null);
    } catch { /* silent */ }
  }, [sequenceId, simSessionId, problemSetId, onLayersChanged]);

  const phase = (status?.phase ?? 'idle') as Phase;
  const phaseCfg = PHASE_CONFIG[phase] ?? PHASE_CONFIG.idle;
  const isActive = sequenceId && phase !== 'idle' && phase !== 'complete';
  const isShadow = phase === 'shadow';

  const title = missionType === 'autonomous' ? 'Autonomous Mission' : 'Iron Bastion';

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '12px',
      zIndex: 950,
      width: collapsed ? 'auto' : '360px',
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      border: `1px solid ${isActive ? phaseCfg.color + '60' : '#374151'}`,
      borderRadius: '8px',
      overflow: 'hidden',
      backdropFilter: 'blur(12px)',
      transition: 'border-color 0.3s',
      fontSize: '0.8125rem',
      color: '#e0e0e8',
    }}>
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
          padding: '8px 12px', backgroundColor: 'transparent', border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid #374151',
          color: '#e0e0e8', cursor: 'pointer', fontSize: '0.6875rem',
          fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.5px',
        }}
      >
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: isActive ? phaseCfg.color : '#6b7280',
          boxShadow: isActive ? `0 0 8px ${phaseCfg.color}` : 'none',
          animation: isActive ? 'msp-pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span>{title}</span>
        {isActive && (
          <span style={{
            padding: '1px 6px', borderRadius: '9999px',
            backgroundColor: phaseCfg.bg, color: phaseCfg.color,
            fontSize: '0.5625rem', fontWeight: 700,
          }}>
            {phaseCfg.label}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6b7280' }}>
          {collapsed ? '+' : '-'}
        </span>
      </button>

      <style>{`@keyframes msp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>

      {!collapsed && (
        <div style={{ padding: '10px 12px' }}>
          {/* Phase progress bar */}
          {isActive && <PhaseProgressBar phase={phase} missionType={missionType} />}

          {/* Mission type selector + simulate toggle (shown when no active mission) */}
          {(!sequenceId || phase === 'complete' || phase === 'idle') && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <label style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                fontSize: '0.5625rem', color: '#9ca3af', cursor: 'pointer',
                textTransform: 'uppercase' as const, letterSpacing: '0.3px',
              }}>
                <input
                  type="checkbox"
                  checked={simulate}
                  onChange={(e) => setSimulate(e.target.checked)}
                  style={{ accentColor: '#6366f1', width: '12px', height: '12px' }}
                />
                Simulate
              </label>
              <span style={{ fontSize: '0.5rem', color: '#4b5563' }}>
                {simulate ? '(virtual robots)' : '(physical robots)'}
              </span>
              {/* Mission type selector */}
              <select
                value={missionType}
                onChange={(e) => setMissionType(e.target.value as MissionType)}
                style={{
                  marginLeft: 'auto', padding: '2px 6px', borderRadius: '4px',
                  border: '1px solid #374151', fontSize: '0.5625rem', fontWeight: 600,
                  backgroundColor: 'rgba(17, 24, 39, 0.9)', color: '#c4b5fd',
                  cursor: 'pointer', textTransform: 'uppercase' as const,
                }}
              >
                <option value="autonomous">Autonomous</option>
                <option value="scripted">Scripted</option>
              </select>
            </div>
          )}

          {/* START / PAUSE / RESET — always visible */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
            {/* START */}
            <button
              onClick={() => handleLaunch(missionType)}
              disabled={launching || seeding || (isActive && !simPaused)}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: '4px',
                border: `1px solid ${isActive && !simPaused ? '#374151' : 'rgba(34, 197, 94, 0.4)'}`,
                fontSize: '0.5625rem', fontWeight: 600,
                backgroundColor: isActive && !simPaused
                  ? 'rgba(75, 85, 99, 0.1)' : 'rgba(34, 197, 94, 0.15)',
                color: isActive && !simPaused ? '#6b7280' : '#86efac',
                cursor: isActive && !simPaused ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase' as const, letterSpacing: '0.3px',
                opacity: isActive && !simPaused ? 0.4 : 1,
              }}
            >
              {launching ? 'Deploying...' : 'Start'}
            </button>

            {/* PAUSE / RESUME */}
            <button
              onClick={handlePause}
              disabled={!isActive}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: '4px',
                border: `1px solid ${!isActive ? '#374151' : simPaused ? 'rgba(34, 197, 94, 0.3)' : 'rgba(234, 179, 8, 0.3)'}`,
                fontSize: '0.5625rem', fontWeight: 600,
                backgroundColor: simPaused ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                color: simPaused ? '#86efac' : '#fde047',
                cursor: isActive ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase' as const, letterSpacing: '0.3px',
                opacity: isActive ? 1 : 0.4,
              }}
            >
              {simPaused ? 'Resume' : 'Pause'}
            </button>

            {/* RESET */}
            <button
              onClick={handleReset}
              disabled={!sequenceId && !simSessionId}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: '4px',
                border: `1px solid ${!sequenceId ? '#374151' : 'rgba(239, 68, 68, 0.3)'}`,
                fontSize: '0.5625rem', fontWeight: 600,
                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#fca5a5',
                cursor: sequenceId || simSessionId ? 'pointer' : 'not-allowed',
                textTransform: 'uppercase' as const, letterSpacing: '0.3px',
                opacity: sequenceId || simSessionId ? 1 : 0.4,
              }}
            >
              Reset
            </button>
          </div>

          {/* Seed COP button */}
          {(!sequenceId || phase === 'complete' || phase === 'idle') && (
            <div style={{ marginBottom: '8px' }}>
              <button
                onClick={async () => {
                  setSeeding(true);
                  setSeedStatus(null);
                  try {
                    const res = await fetch('/api/robot/scenarios/seed-strategic-cop', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ problemSetId }),
                    });
                    const data = await res.json();
                    if (data.status === 'already_seeded') {
                      setSeedStatus('Already seeded');
                    } else {
                      setSeedStatus(`${data.friendlyCount + data.adversaryCount} symbols`);
                      onLayersChanged?.();
                    }
                  } catch {
                    setSeedStatus('Failed');
                  } finally {
                    setSeeding(false);
                    setTimeout(() => setSeedStatus(null), 3000);
                  }
                }}
                disabled={seeding || launching}
                style={{
                  width: '100%', padding: '6px 8px', borderRadius: '4px',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  backgroundColor: seeding ? 'rgba(22, 101, 52, 0.3)' : 'rgba(34, 197, 94, 0.08)',
                  color: '#86efac', fontSize: '0.5625rem', fontWeight: 600,
                  cursor: seeding ? 'not-allowed' : 'pointer',
                  textTransform: 'uppercase' as const, letterSpacing: '0.3px',
                }}
              >
                {seeding ? 'Seeding...' : seedStatus ?? 'Seed COP'}
              </button>
            </div>
          )}

          {error && (
            <div style={{
              padding: '6px 8px', borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5', fontSize: '0.6875rem', marginBottom: '8px',
            }}>
              {error}
            </div>
          )}

          {/* AI Assessment (autonomous only) */}
          {status?.planAssessment && (
            <div style={{
              padding: '6px 8px', borderRadius: '4px',
              backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.2)',
              marginBottom: '8px', fontSize: '0.625rem', color: '#c4b5fd',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.5625rem', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                AI Assessment
              </span>
              <div style={{ marginTop: '3px', color: '#d1d5db' }}>{status.planAssessment}</div>
              {status.planRecommendation && (
                <div style={{ marginTop: '2px', color: '#f59e0b', fontWeight: 600 }}>
                  Recommendation: {status.planRecommendation.toUpperCase()}
                </div>
              )}
            </div>
          )}

          {/* DID Policy Block (autonomous only) */}
          {status?.policyBlock && (
            <div style={{
              padding: '6px 8px', borderRadius: '4px',
              backgroundColor: 'rgba(251, 146, 60, 0.1)', border: '1px solid rgba(251, 146, 60, 0.3)',
              marginBottom: '8px', fontSize: '0.625rem',
            }}>
              <span style={{ fontWeight: 600, fontSize: '0.5625rem', color: '#fb923c', textTransform: 'uppercase' }}>
                Smart Contract Policy Block
              </span>
              <div style={{ marginTop: '3px', color: '#fed7aa', fontFamily: "'Fira Code', monospace", fontSize: '0.5625rem' }}>
                {status.policyBlock.robotDid}
              </div>
              <div style={{ marginTop: '2px', color: '#d1d5db' }}>{status.policyBlock.reason}</div>
            </div>
          )}

          {/* Shadow mode: Return to Base button */}
          {isShadow && (
            <button
              onClick={handleReturnToBase}
              style={{
                width: '100%', padding: '8px 12px', borderRadius: '6px',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#a5b4fc', fontSize: '0.6875rem', fontWeight: 600,
                cursor: 'pointer', textTransform: 'uppercase' as const,
                marginBottom: '8px',
              }}
            >
              Order Return to Base
            </button>
          )}

          {/* Threat count */}
          {status && (status.detectedThreats?.length ?? 0) > 0 && (
            <div style={{ marginBottom: '6px' }}>
              <span style={{
                fontSize: '0.5625rem', color: '#ef4444',
                textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px',
              }}>
                Threats: {Array.isArray(status.detectedThreats) ? status.detectedThreats.length : status.detectedThreats}
              </span>
            </div>
          )}

          {/* Event log */}
          {status && status.log.length > 0 && (
            <div style={{
              maxHeight: '200px', overflowY: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.3)', borderRadius: '4px',
              border: '1px solid #1f2937', padding: '4px',
            }}>
              {status.log.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex', gap: '6px', padding: '2px 4px',
                  fontSize: '0.5625rem', lineHeight: '1.4',
                  borderBottom: i < status.log.length - 1 ? '1px solid rgba(31, 41, 55, 0.5)' : 'none',
                }}>
                  <span style={{
                    color: '#4b5563', fontFamily: "'Fira Code', monospace",
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>
                    {new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span style={{ color: '#d1d5db' }}>{entry.msg}</span>
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Phase Progress Bar ─────────────────────────────────────────────────────

const SCRIPTED_PHASES: Phase[] = [
  'hold', 'recon', 'contact', 'overwatch', 'advance', 'set', 'authorize', 'engage', 'bda', 'withdraw', 'complete',
];

const AUTO_PHASES: Phase[] = [
  'recon', 'assess', 'plan_submitted', 'positioning', 'engage_blocked', 'authorize', 'engage', 'bda', 'withdraw', 'complete',
];

function PhaseProgressBar({ phase, missionType }: { phase: Phase; missionType: MissionType }) {
  const phases = missionType === 'autonomous' ? AUTO_PHASES : SCRIPTED_PHASES;
  // shadow branches off — show it separately
  const currentIdx = phase === 'shadow' ? phases.indexOf('authorize') + 1 : phases.indexOf(phase);
  const phaseCfg = PHASE_CONFIG[phase];

  return (
    <div style={{ display: 'flex', gap: '2px', marginBottom: '10px' }}>
      {phases.map((p, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx || (phase === 'shadow' && p === 'authorize');

        return (
          <div
            key={p}
            title={PHASE_CONFIG[p].label}
            style={{
              flex: 1, height: '4px', borderRadius: '2px',
              backgroundColor: isComplete ? '#22c55e' : isCurrent ? phaseCfg.color : 'rgba(75, 85, 99, 0.4)',
              transition: 'background-color 0.5s',
              boxShadow: isCurrent ? `0 0 6px ${phaseCfg.color}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
