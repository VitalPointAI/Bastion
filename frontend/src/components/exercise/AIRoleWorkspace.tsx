/**
 * AIRoleWorkspace
 *
 * Phase 16 Plan 04: Main AI workspace container.
 * Phase 16 Plan 06: Replaced placeholder divs with real ChannelFeed + ProductReviewPanel.
 *                   Wired Pause/Resume/Open Review buttons. handleReviewRequired fetches
 *                   the pending product and opens ProductReviewPanel (only when canControl).
 *
 * Renders one of three states:
 *   1. Initial — AgentRosterCard shown before agents start (no active run)
 *   2. Active  — Side-by-side layout: product panel (flex:1, left) + channel feed (320px, right)
 *   3. Error   — Error message + Try Again (only shown when isControllerView is true)
 *
 * Access control:
 *   isControllerView === true  → full control: Begin, Pause, Resume, Open Review
 *   isControllerView === false → read-only observer: workspace visible, actions hidden
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { StaffAgentDef, AIRoleRun } from '../../types/exercise';
import { AgentRosterCard } from './AgentRosterCard';
import { ChannelFeed } from './ChannelFeed';
import { ProductReviewPanel } from './ProductReviewPanel';
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

// ─── Status label helper ──────────────────────────────────────────────────────

function getStatusLabel(status?: AIRoleRun['status']): string {
  const labels: Record<string, string> = {
    queued: 'Queued',
    running: 'Running',
    paused: 'Paused',
    awaiting_review: 'Awaiting Review',
    complete: 'Complete',
    failed: 'Failed',
  };
  return labels[status ?? ''] ?? '';
}

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

  // Review context state — set when review_required event fires (Plan 06)
  const [reviewContext, setReviewContext] = useState<{
    runId: string;
    productId: string;
    productContent: string;
    productType: string;
    draftVersion: number;
  } | null>(null);

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

  // ── Review required handler (Plan 06) ───────────────────────────────────────
  // Called by ChannelFeed when a review_required event fires.
  // Any user viewing the AI workspace can review products.

  const handleReviewRequired = async (runId: string) => {
    try {
      const products = await exerciseService.getStaffProducts(scenarioId, roleKey);
      const pendingProduct = products.find(
        (p) => p.status === 'pending_review' || p.status === 'draft'
      );
      if (pendingProduct) {
        setReviewContext({
          runId,
          productId: pendingProduct.id,
          productContent: pendingProduct.content || '',
          productType: pendingProduct.productType,
          draftVersion: pendingProduct.version ?? 1,
        });
      }
    } catch (err) {
      console.error('[AIRoleWorkspace] Failed to load product for review:', err);
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
            {/* Pending Review badge */}
            {activeRun?.status === 'awaiting_review' && !reviewContext && (
              <div className="aip-review-badge">
                <span className="aip-badge-label">Pending Review</span>
                <button
                  className="aip-review-btn"
                  type="button"
                  onClick={() => { void handleReviewRequired(activeRun.id); }}
                >
                  Open Review
                </button>
              </div>
            )}
            {/* Status indicator with Pause/Resume controls */}
            <div className="aip-status">
              <span className={`aip-status-dot aip-status-${activeRun?.status ?? ''}`} />
              <span>{getStatusLabel(activeRun?.status)}</span>
              {/* Pause — supervisor/commander only */}
              {canControl && activeRun?.status === 'running' && (
                <button
                  className="aip-pause-btn"
                  type="button"
                  onClick={() => {
                    void exerciseService
                      .pauseAIRun(scenarioId, roleKey, activeRun.id)
                      .then(() => setActiveRun((r) => (r ? { ...r, status: 'paused' } : r)));
                  }}
                >
                  Pause
                </button>
              )}
              {/* Resume — supervisor/commander only */}
              {canControl && activeRun?.status === 'paused' && (
                <button
                  className="aip-resume-btn"
                  type="button"
                  onClick={() => {
                    void exerciseService
                      .resumeAIRun(scenarioId, roleKey, activeRun.id)
                      .then(() => setActiveRun((r) => (r ? { ...r, status: 'running' } : r)));
                  }}
                >
                  Resume
                </button>
              )}
            </div>
            <p className="aip-products-label">Agent products will appear here as they are generated.</p>
          </div>

          {/* Channel Panel (narrower, right) */}
          <div className="ai-channel-panel">
            <ChannelFeed
              scenarioId={scenarioId}
              roleKey={roleKey}
              activeRunId={activeRun?.id}
              onReviewRequired={handleReviewRequired}
            />
          </div>

          {/* ProductReviewPanel modal */}
          {reviewContext && (
            <ProductReviewPanel
              scenarioId={scenarioId}
              roleKey={roleKey}
              runId={reviewContext.runId}
              productId={reviewContext.productId}
              productContent={reviewContext.productContent}
              productType={reviewContext.productType}
              draftVersion={reviewContext.draftVersion}
              onReviewComplete={() => {
                setReviewContext(null);
                // Refresh run status after review
                exerciseService.getAIRuns(scenarioId, roleKey).then((runs) => {
                  const active =
                    runs.find((r) => ACTIVE_STATUSES.has(r.status)) ?? null;
                  setActiveRun(active);
                }).catch(console.error);
              }}
              onClose={() => setReviewContext(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
