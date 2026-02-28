/**
 * GateControl
 *
 * Phase 14 Plan 10: Exercise controller gate management panel.
 * Controls information release and phase transitions through explicit gate openings.
 *
 * Per CONTEXT.md: Phase transitions are explicit decisions, not automatic time-based triggers.
 * The "Advance Phase" button is prominently displayed and ONLY enabled when all gates
 * for the current phase are open.
 *
 * Role behavior:
 * - exercise_control: Full gate management (create, open, advance phase)
 * - Other roles: Read-only gate status view
 */

import { useState, useEffect, useCallback } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { ExerciseGate, CreateGateInput } from '../../types/exercise';
import './GateControl.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface GateControlProps {
  scenarioId: string;
  exercisePhase: string;
  exercisePhases?: string[];
  isController?: boolean;
  onPhaseAdvanced?: () => void;
}

// ─── Gate Type Config ──────────────────────────────────────────────────────────

type GateType = 'info_release' | 'phase_transition' | 'order_required';

const GATE_TYPE_CONFIG: Record<GateType, { label: string; colorClass: string }> = {
  info_release: { label: 'Info Release', colorClass: 'gate-type--info' },
  phase_transition: { label: 'Phase Transition', colorClass: 'gate-type--transition' },
  order_required: { label: 'Order Required', colorClass: 'gate-type--order' },
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatTimestamp(ts: string | null): string {
  if (!ts) return '';
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Confirmation Dialog ───────────────────────────────────────────────────────

interface ConfirmDialogProps {
  gate: ExerciseGate;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing: boolean;
}

function ConfirmDialog({ gate, onConfirm, onCancel, isProcessing }: ConfirmDialogProps) {
  const typeConfig = GATE_TYPE_CONFIG[gate.gateType];
  return (
    <div className="gate-confirm-overlay" onClick={onCancel}>
      <div className="gate-confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="gate-confirm-title">Open Gate?</h3>
        <p className="gate-confirm-body">
          Opening this gate will release{' '}
          <strong>{typeConfig.label}</strong> for phase{' '}
          <strong>{gate.exercisePhase}</strong>.
        </p>
        <p className="gate-confirm-condition">{gate.conditionDescription}</p>
        <p className="gate-confirm-warning">This action cannot be undone.</p>
        <div className="gate-confirm-actions">
          <button
            className="gate-btn gate-btn--cancel"
            onClick={onCancel}
            disabled={isProcessing}
          >
            Cancel
          </button>
          <button
            className="gate-btn gate-btn--open"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? 'Opening...' : 'Open Gate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Gate Card ─────────────────────────────────────────────────────────────────

interface GateCardProps {
  gate: ExerciseGate;
  isController: boolean;
  onOpenGate: (gate: ExerciseGate) => void;
  openingId: string | null;
}

function GateCard({ gate, isController, onOpenGate, openingId }: GateCardProps) {
  const typeConfig = GATE_TYPE_CONFIG[gate.gateType];

  return (
    <div className={`gate-card ${gate.isOpen ? 'gate-card--open' : 'gate-card--closed'}`}>
      {/* Header row */}
      <div className="gate-card-header">
        <span className={`gate-type-badge ${typeConfig.colorClass}`}>
          {typeConfig.label}
        </span>
        <span className={`gate-status-badge ${gate.isOpen ? 'gate-status-badge--open' : 'gate-status-badge--closed'}`}>
          {gate.isOpen ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      {/* Condition */}
      <p className="gate-condition">{gate.conditionDescription}</p>

      {/* Opened info */}
      {gate.isOpen && gate.openedBy && (
        <div className="gate-opened-info">
          <span className="gate-opened-by">Opened by: {gate.openedBy}</span>
          {gate.openedAt && (
            <span className="gate-opened-at">{formatTimestamp(gate.openedAt)}</span>
          )}
        </div>
      )}

      {/* Open action (controller only, closed gates only) */}
      {isController && !gate.isOpen && (
        <button
          className="gate-btn gate-btn--open"
          onClick={() => onOpenGate(gate)}
          disabled={openingId === gate.id}
        >
          {openingId === gate.id ? 'Opening...' : 'Open Gate'}
        </button>
      )}
    </div>
  );
}

// ─── Phase Readiness ───────────────────────────────────────────────────────────

interface PhaseReadinessProps {
  phase: string;
  gates: ExerciseGate[];
}

function PhaseReadiness({ phase, gates }: PhaseReadinessProps) {
  const openCount = gates.filter((g) => g.isOpen).length;
  const total = gates.length;
  const isReady = total > 0 && openCount === total;
  const pct = total > 0 ? Math.round((openCount / total) * 100) : 0;

  return (
    <div className={`phase-readiness ${isReady ? 'phase-readiness--ready' : 'phase-readiness--blocked'}`}>
      <div className="phase-readiness-header">
        <span className="phase-readiness-name">{phase}</span>
        <span className={`phase-readiness-badge ${isReady ? 'phase-readiness-badge--ready' : 'phase-readiness-badge--blocked'}`}>
          {isReady ? 'Phase Ready' : 'Phase Blocked'}
        </span>
        <span className="phase-readiness-count">{openCount}/{total} gates open</span>
      </div>

      {/* Progress bar */}
      <div className="phase-readiness-bar">
        <div
          className={`phase-readiness-fill ${isReady ? 'phase-readiness-fill--ready' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Remaining gates list */}
      {!isReady && gates.filter((g) => !g.isOpen).length > 0 && (
        <ul className="phase-readiness-remaining">
          {gates.filter((g) => !g.isOpen).map((gate) => (
            <li key={gate.id} className="phase-readiness-gate">
              <span className={`gate-type-badge gate-type-badge--sm ${GATE_TYPE_CONFIG[gate.gateType].colorClass}`}>
                {GATE_TYPE_CONFIG[gate.gateType].label}
              </span>
              {gate.conditionDescription}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Create Gate Form ──────────────────────────────────────────────────────────

interface CreateGateFormProps {
  exercisePhases: string[];
  currentPhase: string;
  onCreate: (data: CreateGateInput) => Promise<void>;
  onClose: () => void;
  isCreating: boolean;
}

function CreateGateForm({
  exercisePhases,
  currentPhase,
  onCreate,
  onClose,
  isCreating,
}: CreateGateFormProps) {
  const [phase, setPhase] = useState(currentPhase);
  const [gateType, setGateType] = useState<GateType>('info_release');
  const [condition, setCondition] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!condition.trim()) {
      setError('Condition description is required.');
      return;
    }
    setError(null);
    await onCreate({
      exercisePhase: phase,
      gateType,
      conditionDescription: condition.trim(),
    });
  };

  return (
    <div className="gate-form-overlay" onClick={onClose}>
      <div className="gate-form" onClick={(e) => e.stopPropagation()}>
        <h3 className="gate-form-title">Create Gate</h3>

        <div className="gate-form-field">
          <label className="gate-form-label">Exercise Phase</label>
          <select
            className="gate-form-select"
            value={phase}
            onChange={(e) => setPhase(e.target.value)}
            disabled={isCreating}
          >
            {exercisePhases.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div className="gate-form-field">
          <label className="gate-form-label">Gate Type</label>
          <select
            className="gate-form-select"
            value={gateType}
            onChange={(e) => setGateType(e.target.value as GateType)}
            disabled={isCreating}
          >
            <option value="info_release">Information Release</option>
            <option value="phase_transition">Phase Transition</option>
            <option value="order_required">Order Required</option>
          </select>
        </div>

        <div className="gate-form-field">
          <label className="gate-form-label">Condition Description</label>
          <textarea
            className="gate-form-textarea"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Describe the condition required before opening this gate..."
            rows={3}
            disabled={isCreating}
          />
        </div>

        {error && <div className="gate-form-error">{error}</div>}

        <div className="gate-form-actions">
          <button
            className="gate-btn gate-btn--cancel"
            onClick={onClose}
            disabled={isCreating}
          >
            Cancel
          </button>
          <button
            className="gate-btn gate-btn--create"
            onClick={handleSubmit}
            disabled={isCreating || !condition.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Gate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── GateControl ───────────────────────────────────────────────────────────────

export function GateControl({
  scenarioId,
  exercisePhase,
  exercisePhases = [],
  isController = false,
  onPhaseAdvanced,
}: GateControlProps) {
  // ── State ──────────────────────────────────────────────────────────────────

  const [gates, setGates] = useState<ExerciseGate[]>([]);
  const [phaseFilter, setPhaseFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Gate opening flow
  const [confirmingGate, setConfirmingGate] = useState<ExerciseGate | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  // Create gate form
  const [creatingGate, setCreatingGate] = useState(false);
  const [isCreatingGate, setIsCreatingGate] = useState(false);

  // Phase advance
  const [advancingPhase, setAdvancingPhase] = useState(false);

  // ── Load Gates ────────────────────────────────────────────────────────────

  const loadGates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allGates = await exerciseService.getGates(scenarioId);
      setGates(allGates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load gates');
    } finally {
      setLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    loadGates();
  }, [loadGates, exercisePhase]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleOpenGateRequest = (gate: ExerciseGate) => {
    setConfirmingGate(gate);
  };

  const handleConfirmOpenGate = async () => {
    if (!confirmingGate) return;
    setOpeningId(confirmingGate.id);
    setError(null);
    try {
      await exerciseService.openGate(confirmingGate.id);
      setGates((prev) =>
        prev.map((g) =>
          g.id === confirmingGate.id
            ? { ...g, isOpen: true, openedAt: new Date().toISOString() }
            : g
        )
      );
      setSuccessMsg(`Gate opened: ${confirmingGate.conditionDescription}`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open gate');
    } finally {
      setOpeningId(null);
      setConfirmingGate(null);
    }
  };

  const handleCreateGate = async (data: CreateGateInput) => {
    setIsCreatingGate(true);
    setError(null);
    try {
      const newGate = await exerciseService.createGate(scenarioId, data);
      setGates((prev) => [...prev, newGate]);
      setCreatingGate(false);
      setSuccessMsg('Gate created successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create gate');
    } finally {
      setIsCreatingGate(false);
    }
  };

  const handleAdvancePhase = async () => {
    setAdvancingPhase(true);
    setError(null);
    try {
      await exerciseService.advancePhase(scenarioId);
      setSuccessMsg('Phase advanced successfully. Refresh to see updated scenario state.');
      setTimeout(() => setSuccessMsg(null), 5000);
      onPhaseAdvanced?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to advance phase');
    } finally {
      setAdvancingPhase(false);
    }
  };

  // ── Derived ───────────────────────────────────────────────────────────────

  // Group gates by phase
  const gatesByPhase: Record<string, ExerciseGate[]> = {};
  for (const gate of gates) {
    if (!gatesByPhase[gate.exercisePhase]) {
      gatesByPhase[gate.exercisePhase] = [];
    }
    gatesByPhase[gate.exercisePhase].push(gate);
  }

  // Current phase gates for advance check
  const currentPhaseGates = gatesByPhase[exercisePhase] ?? [];
  const currentPhaseAllOpen =
    currentPhaseGates.length > 0 && currentPhaseGates.every((g) => g.isOpen);

  // Filtered gates display
  const filteredGates = phaseFilter === 'all' ? gates : gates.filter((g) => g.exercisePhase === phaseFilter);

  // Phases with gates
  const phasesWithGates = Object.keys(gatesByPhase).sort((a, b) => {
    const ai = exercisePhases.indexOf(a);
    const bi = exercisePhases.indexOf(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="gate-control">

      {/* Advance Phase — prominent at top, controller only */}
      {isController && (
        <div className="gate-advance-panel">
          <div className="gate-advance-info">
            <span className="gate-advance-label">Advance Phase</span>
            <span className="gate-advance-desc">
              {currentPhaseAllOpen
                ? 'All gates for the current phase are open. Ready to advance.'
                : `${currentPhaseGates.filter((g) => !g.isOpen).length} gate(s) must be opened before advancing.`}
            </span>
          </div>
          <button
            className={`gate-btn gate-btn--advance ${currentPhaseAllOpen ? 'gate-btn--advance-ready' : ''}`}
            onClick={handleAdvancePhase}
            disabled={!currentPhaseAllOpen || advancingPhase}
            title={currentPhaseAllOpen ? 'Advance to next phase' : 'Open all gates for current phase first'}
          >
            {advancingPhase ? 'Advancing...' : 'Advance Phase'}
          </button>
        </div>
      )}

      {/* Header with controls */}
      <div className="gate-control-header">
        <div className="gate-control-title">
          <h3>Gate Management</h3>
          {!isController && (
            <span className="gate-readonly-badge">Read Only</span>
          )}
        </div>

        <div className="gate-control-actions">
          {/* Phase filter */}
          <select
            className="gate-filter-select"
            value={phaseFilter}
            onChange={(e) => setPhaseFilter(e.target.value)}
          >
            <option value="all">All Phases</option>
            {phasesWithGates.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Refresh */}
          <button className="gate-btn gate-btn--secondary" onClick={loadGates}>
            Refresh
          </button>

          {/* Create gate (controller only) */}
          {isController && (
            <button
              className="gate-btn gate-btn--create"
              onClick={() => setCreatingGate(true)}
            >
              + Create Gate
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && <div className="gate-error">{error}</div>}
      {successMsg && <div className="gate-success">{successMsg}</div>}

      {/* Loading state */}
      {loading ? (
        <div className="gate-loading">Loading gates...</div>
      ) : (
        <div className="gate-content">

          {/* Phase readiness summaries */}
          {phasesWithGates.length > 0 && (
            <div className="gate-readiness-section">
              <h4 className="gate-section-title">Phase Readiness</h4>
              <div className="gate-readiness-list">
                {phasesWithGates.map((phase) => (
                  <PhaseReadiness
                    key={phase}
                    phase={phase}
                    gates={gatesByPhase[phase]}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Gate list */}
          <div className="gate-list-section">
            <h4 className="gate-section-title">
              Gates
              {phaseFilter !== 'all' && (
                <span className="gate-section-filter"> — {phaseFilter}</span>
              )}
              <span className="gate-section-count">({filteredGates.length})</span>
            </h4>

            {filteredGates.length === 0 ? (
              <div className="gate-empty">
                {phaseFilter === 'all'
                  ? 'No gates defined. Create gates to control phase transitions and information release.'
                  : `No gates for phase "${phaseFilter}".`}
              </div>
            ) : (
              <div className="gate-list">
                {filteredGates.map((gate) => (
                  <GateCard
                    key={gate.id}
                    gate={gate}
                    isController={isController}
                    onOpenGate={handleOpenGateRequest}
                    openingId={openingId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation dialog */}
      {confirmingGate && (
        <ConfirmDialog
          gate={confirmingGate}
          onConfirm={handleConfirmOpenGate}
          onCancel={() => setConfirmingGate(null)}
          isProcessing={openingId !== null}
        />
      )}

      {/* Create gate form */}
      {creatingGate && (
        <CreateGateForm
          exercisePhases={exercisePhases.length > 0 ? exercisePhases : [exercisePhase]}
          currentPhase={exercisePhase}
          onCreate={handleCreateGate}
          onClose={() => setCreatingGate(false)}
          isCreating={isCreatingGate}
        />
      )}
    </div>
  );
}
