/**
 * AIRoleWorkspace
 *
 * Phase 16 Plan 04: Main AI workspace container.
 *
 * Renders one of three states:
 *   1. Initial — AgentRosterCard shown before agents start (no active run)
 *   2. Active  — Side-by-side layout: product panel (flex:1, left) + channel feed (320px, right)
 *   3. Error   — Error message + Try Again (only shown when isControllerView is true)
 *
 * Access control:
 *   isControllerView === true  → full control: Begin, Pause, Resume, Open Review
 *   isControllerView === false → read-only observer: workspace visible, actions hidden
 *
 * Channel feed and full product review wired in Plans 05/06.
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { StaffAgentDef, AIRoleRun } from '../../types/exercise';
import { AgentRosterCard } from './AgentRosterCard';
import './AIRoleWorkspace.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface AIRoleWorkspaceProps {
  roleKey: string;
  scenarioId: string;
  exercisePhase?: string;
  isControllerView?: boolean;
}

// ─── Active run statuses ──────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(['queued', 'running', 'paused', 'awaiting_review']);
const TERMINAL_STATUSES = new Set(['complete', 'failed']);

// ─── Component ────────────────────────────────────────────────────────────────

export function AIRoleWorkspace({
  roleKey,
  scenarioId,
  exercisePhase: _exercisePhase,
  isControllerView,
}: AIRoleWorkspaceProps) {
  const [agents, setAgents] = useState<StaffAgentDef[]>([]);
  const [activeRun, setActiveRun] = useState<AIRoleRun | null>(null);
  const [isBeginning, setIsBeginning] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // isControllerView === false means read-only observer — cannot Begin, Pause, Resume, or Review
  const canControl = isControllerView === true;

  // ── Load agents and runs on mount / roleKey change ──────────────────────────

  useEffect(() => {
    setLoadError(null);

    Promise.all([
      exerciseService.getAgentsForRole(scenarioId, roleKey),
      exerciseService.getAIRuns(scenarioId, roleKey),
    ])
      .then(([agentList, runs]) => {
        setAgents(agentList);
        const active = runs.find((r) => ACTIVE_STATUSES.has(r.status)) ?? null;
        setActiveRun(active);
      })
      .catch((err: unknown) => {
        console.error('[AIRoleWorkspace] load error:', err);
        setLoadError(err instanceof Error ? err.message : 'Failed to load workspace');
      });
  }, [scenarioId, roleKey]);

  // ── Begin handler ───────────────────────────────────────────────────────────

  const handleBegin = async () => {
    if (!canControl) return;
    setIsBeginning(true);
    try {
      await exerciseService.triggerAIRole(scenarioId, roleKey);
      // Brief delay then poll for the newly created run
      setTimeout(async () => {
        try {
          const runs = await exerciseService.getAIRuns(scenarioId, roleKey);
          const active = runs.find((r) => ACTIVE_STATUSES.has(r.status)) ?? null;
          if (active) setActiveRun(active);
        } catch (err) {
          console.error('[AIRoleWorkspace] post-begin poll error:', err);
        } finally {
          setIsBeginning(false);
        }
      }, 1500);
    } catch (err) {
      console.error('[AIRoleWorkspace] trigger error:', err);
      setIsBeginning(false);
    }
  };

  // ── Try Again (error state re-trigger) ──────────────────────────────────────

  const handleTryAgain = () => {
    setLoadError(null);
    setActiveRun(null);
    handleBegin();
  };

  // ── Render states ───────────────────────────────────────────────────────────

  const hasActiveRun = activeRun !== null && !TERMINAL_STATUSES.has(activeRun.status);

  // Error state — only shown to controllers
  if (loadError && canControl) {
    return (
      <div className="ai-role-workspace">
        <div className="ai-workspace-error">
          <p className="ai-workspace-error-msg">{loadError}</p>
          <button
            className="ai-workspace-retry-btn"
            onClick={handleTryAgain}
            type="button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-role-workspace">
      {!hasActiveRun ? (
        /* ── Initial state: AgentRosterCard centered ── */
        <div className="ai-workspace-initial">
          <AgentRosterCard
            roleKey={roleKey}
            scenarioId={scenarioId}
            agents={agents}
            onBegin={handleBegin}
            isBeginning={isBeginning}
            isReadOnly={!canControl}
          />
        </div>
      ) : (
        /* ── Active state: side-by-side product + channel ── */
        <div className="ai-workspace-active">
          {/* Product Panel (wider, left) */}
          <div className="ai-product-panel">
            {/* Controller-only action buttons */}
            {canControl && activeRun?.status === 'running' && (
              <button
                className="aip-pause-btn"
                type="button"
                onClick={() => {
                  /* Wired in Plan 06 */
                }}
              >
                Pause
              </button>
            )}
            {canControl && activeRun?.status === 'paused' && (
              <button
                className="aip-resume-btn"
                type="button"
                onClick={() => {
                  /* Wired in Plan 06 */
                }}
              >
                Resume
              </button>
            )}
            {canControl && activeRun?.status === 'awaiting_review' && (
              <button
                className="aip-review-btn"
                type="button"
                onClick={() => {
                  /* Wired in Plan 06 */
                }}
              >
                Open Review
              </button>
            )}
            {/* Product panel content — wired in Plan 06 (StaffWorkspace extension) */}
            <div className="aip-placeholder">
              Agent products will appear here as they are generated.
            </div>
          </div>

          {/* Channel Panel (narrower, right) */}
          <div className="ai-channel-panel">
            {/* ChannelFeed placeholder — replaced by real ChannelFeed component in Plan 05 */}
            <div className="channel-feed-placeholder" id={`channel-${roleKey}`}>
              <span className="cfp-label">Channel feed</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
