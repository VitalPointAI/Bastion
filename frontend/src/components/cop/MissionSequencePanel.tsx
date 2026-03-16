/**
 * MissionSequencePanel
 *
 * Floating overlay on the COP map for triggering and monitoring
 * the Iron Bastion mission sequence. Shows current phase, event log,
 * and a launch button.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Types ──────────────────────────────────────────────────────────────────

type SequencePhase =
  | 'idle'
  | 'hold'
  | 'recon'
  | 'contact'
  | 'overwatch'
  | 'advance'
  | 'set'
  | 'authorize'
  | 'engage'
  | 'bda'
  | 'withdraw'
  | 'complete';

interface LogEntry {
  ts: string;
  msg: string;
}

interface SequenceStatus {
  id: string;
  phase: SequencePhase;
  startedAt: string;
  phaseStartedAt: string;
  detectedThreats: string[];
  gateId?: string;
  log: LogEntry[];
}

// ─── Phase styling ──────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<SequencePhase, { color: string; bg: string; label: string }> = {
  idle: { color: '#6b7280', bg: 'rgba(107,114,128,0.15)', label: 'IDLE' },
  hold: { color: '#3b82f6', bg: 'rgba(59,130,246,0.15)', label: 'HOLD' },
  recon: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.15)', label: 'RECON' },
  contact: { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'CONTACT' },
  overwatch: { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)', label: 'OVERWATCH' },
  advance: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'ADVANCE' },
  set: { color: '#eab308', bg: 'rgba(234,179,8,0.15)', label: 'SET' },
  authorize: { color: '#f97316', bg: 'rgba(249,115,22,0.15)', label: 'AUTHORIZE' },
  engage: { color: '#dc2626', bg: 'rgba(220,38,38,0.25)', label: 'ENGAGE' },
  bda: { color: '#a855f7', bg: 'rgba(168,85,247,0.15)', label: 'BDA' },
  withdraw: { color: '#6366f1', bg: 'rgba(99,102,241,0.15)', label: 'WITHDRAW' },
  complete: { color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'COMPLETE' },
};

// ─── Component ──────────────────────────────────────────────────────────────

export function MissionSequencePanel() {
  const [collapsed, setCollapsed] = useState(true);
  const [sequenceId, setSequenceId] = useState<string | null>(null);
  const [status, setStatus] = useState<SequenceStatus | null>(null);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Poll sequence status
  useEffect(() => {
    if (!sequenceId) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/robot/scenarios/${sequenceId}`);
        if (res.ok && !cancelled) {
          const data = await res.json();
          setStatus(data);
        }
      } catch { /* silent */ }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sequenceId]);

  // Auto-scroll log
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
            setCollapsed(false);
          }
        }
      } catch { /* silent */ }
    }
    checkExisting();
  }, []);

  const handleLaunch = useCallback(async () => {
    setLaunching(true);
    setError(null);

    try {
      const res = await fetch('/api/robot/scenarios/iron-bastion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start scenario');
      }

      const data = await res.json();
      setSequenceId(data.sequenceId);
      setCollapsed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLaunching(false);
    }
  }, []);

  const phase = status?.phase ?? 'idle';
  const phaseCfg = PHASE_CONFIG[phase];
  const isActive = sequenceId && phase !== 'idle' && phase !== 'complete';

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      left: '12px',
      zIndex: 950,
      width: collapsed ? 'auto' : '340px',
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
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid #374151',
          color: '#e0e0e8',
          cursor: 'pointer',
          fontSize: '0.6875rem',
          fontWeight: 600,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.5px',
        }}
      >
        {/* Status indicator */}
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: isActive ? phaseCfg.color : '#6b7280',
          boxShadow: isActive ? `0 0 8px ${phaseCfg.color}` : 'none',
          animation: isActive ? 'msp-pulse 2s ease-in-out infinite' : 'none',
        }} />
        <span>Iron Bastion</span>
        {isActive && (
          <span style={{
            padding: '1px 6px',
            borderRadius: '9999px',
            backgroundColor: phaseCfg.bg,
            color: phaseCfg.color,
            fontSize: '0.5625rem',
            fontWeight: 700,
          }}>
            {phaseCfg.label}
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#6b7280' }}>
          {collapsed ? '+' : '-'}
        </span>
      </button>

      <style>{`
        @keyframes msp-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* Expanded content */}
      {!collapsed && (
        <div style={{ padding: '10px 12px' }}>
          {/* Phase progress bar */}
          {isActive && <PhaseProgressBar phase={phase} />}

          {/* Launch button */}
          {(!sequenceId || phase === 'complete' || phase === 'idle') && (
            <button
              onClick={handleLaunch}
              disabled={launching}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                backgroundColor: launching ? 'rgba(127, 29, 29, 0.3)' : 'rgba(239, 68, 68, 0.15)',
                color: '#fca5a5',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: launching ? 'not-allowed' : 'pointer',
                textTransform: 'uppercase' as const,
                letterSpacing: '0.5px',
                transition: 'background-color 0.15s',
                marginBottom: '8px',
              }}
            >
              {launching ? 'Deploying...' : 'Launch Iron Bastion'}
            </button>
          )}

          {error && (
            <div style={{
              padding: '6px 8px',
              borderRadius: '4px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              fontSize: '0.6875rem',
              marginBottom: '8px',
            }}>
              {error}
            </div>
          )}

          {/* Threat detections */}
          {status && status.detectedThreats.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <span style={{
                fontSize: '0.5625rem',
                color: '#ef4444',
                textTransform: 'uppercase',
                fontWeight: 600,
                letterSpacing: '0.5px',
              }}>
                Threats Detected: {status.detectedThreats.length}
              </span>
            </div>
          )}

          {/* Event log */}
          {status && status.log.length > 0 && (
            <div style={{
              maxHeight: '180px',
              overflowY: 'auto',
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              border: '1px solid #1f2937',
              padding: '4px',
            }}>
              {status.log.map((entry, i) => (
                <div key={i} style={{
                  display: 'flex',
                  gap: '6px',
                  padding: '2px 4px',
                  fontSize: '0.625rem',
                  lineHeight: '1.4',
                  borderBottom: i < status.log.length - 1 ? '1px solid rgba(31, 41, 55, 0.5)' : 'none',
                }}>
                  <span style={{
                    color: '#4b5563',
                    fontFamily: "'Fira Code', monospace",
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
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

const PHASE_ORDER: SequencePhase[] = [
  'hold', 'recon', 'contact', 'overwatch', 'advance', 'set', 'authorize', 'engage', 'bda', 'withdraw', 'complete',
];

function PhaseProgressBar({ phase }: { phase: SequencePhase }) {
  const currentIdx = PHASE_ORDER.indexOf(phase);
  const phaseCfg = PHASE_CONFIG[phase];

  return (
    <div style={{
      display: 'flex',
      gap: '2px',
      marginBottom: '10px',
    }}>
      {PHASE_ORDER.map((p, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        const cfg = PHASE_CONFIG[p];

        return (
          <div
            key={p}
            title={cfg.label}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: isComplete
                ? '#22c55e'
                : isCurrent
                ? phaseCfg.color
                : 'rgba(75, 85, 99, 0.4)',
              transition: 'background-color 0.5s',
              boxShadow: isCurrent ? `0 0 6px ${phaseCfg.color}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}
