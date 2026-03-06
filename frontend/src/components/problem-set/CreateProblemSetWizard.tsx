/**
 * CreateProblemSetWizard
 *
 * Multi-step form for problem set creation:
 * - Step 1: Name, description, echelon, optional parent, optional problem statement
 * - Step 2: Classification, invite mode, discoverability
 * - Step 3: Review and confirm
 *
 * Uses problemSetService.createProblemSet on submit.
 * Styled with CreateProblemSetWizard.css (plain CSS, no Tailwind).
 *
 * Phase 23 Plan 07: Renamed from CreateWorkspaceWizard; echelon replaces workspace type.
 */

import { useState, useEffect } from 'react';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { problemSetService, type CreateProblemSetInput } from '../../lib/problem-set-service';
import { exerciseService } from '../../services/exercise-service';
import type { ExerciseScenario } from '../../types/exercise';
import './CreateProblemSetWizard.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type Echelon = 'strategic' | 'operational' | 'tactical';
type Classification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
type InviteMode = 'open' | 'gated';
type Discoverability = 'discoverable' | 'private';

interface WizardState {
  // Step 1
  name: string;
  description: string;
  echelon: Echelon | '';
  parentProblemSetId: string;
  problemStatement: string;
  // Step 2
  classification: Classification;
  inviteMode: InviteMode;
  discoverability: Discoverability;
}

const INITIAL_STATE: WizardState = {
  name: '',
  description: '',
  echelon: '',
  parentProblemSetId: '',
  problemStatement: '',
  classification: 'UNCLASSIFIED',
  inviteMode: 'gated',
  discoverability: 'private',
};

interface Props {
  onClose: () => void;
  onCreated: (problemSetId: string, options?: { navigateTo?: string }) => void;
  parentProblemSetId?: string;
}

type SourceMode = 'fresh' | 'scenario' | null;

// ─── Helper labels ────────────────────────────────────────────────────────────

const ECHELON_SYMBOLS: Record<Echelon, string> = {
  strategic: 'XX',
  operational: 'III',
  tactical: 'II',
};

const ECHELON_LABELS: Record<Echelon, { name: string; symbol: string; desc: string }> = {
  strategic: { name: 'Strategic', symbol: 'XX', desc: 'Theater / combatant command level' },
  operational: { name: 'Operational', symbol: 'III', desc: 'Corps / division level' },
  tactical: { name: 'Tactical', symbol: 'II', desc: 'Brigade / battalion level' },
};

/** Determine valid child echelons based on parent echelon */
function getValidEchelons(parentEchelon: string | undefined): Echelon[] {
  if (!parentEchelon) return ['strategic'];
  switch (parentEchelon) {
    case 'strategic': return ['operational'];
    case 'operational': return ['tactical'];
    default: return [];
  }
}

const CLASSIFICATION_LABELS: Record<Classification, string> = {
  UNCLASSIFIED: 'Unclassified',
  SECRET: 'Secret',
  TOPSECRET: 'Top Secret',
};

const INVITE_MODE_LABELS: Record<InviteMode, string> = {
  open: 'Open',
  gated: 'Invite Only',
};

// ─── Step Indicator ───────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="step-indicator">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="step-item">
          <div
            className={[
              'step-circle',
              step === current ? 'active' : step < current ? 'completed' : 'upcoming',
            ].join(' ')}
          >
            {step < current ? '\u2713' : step}
          </div>
          {step < total && (
            <div className={`step-connector ${step < current ? 'done' : 'pending'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CreateProblemSetWizard({ onClose, onCreated, parentProblemSetId }: Props) {
  const { memberships } = useProblemSet();
  const { userDID } = useUser();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>({
    ...INITIAL_STATE,
    parentProblemSetId: parentProblemSetId ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 0: Source mode state
  const [sourceMode, setSourceMode] = useState<SourceMode>(null);
  const [scenarios, setScenarios] = useState<ExerciseScenario[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [selectedScenario, setSelectedScenario] = useState<ExerciseScenario | null>(null);
  const [loadingScenarios, setLoadingScenarios] = useState(false);

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));

  // Determine parent echelon from prop or selected parent
  const parentMembership = parentProblemSetId
    ? memberships.find((m) => m.problemSetId === parentProblemSetId)
    : state.parentProblemSetId
      ? memberships.find((m) => m.problemSetId === state.parentProblemSetId)
      : undefined;

  // Valid echelons based on parent (enforces hierarchy)
  const validEchelons = getValidEchelons(parentMembership?.echelon);

  // Auto-select echelon when only one option is valid
  useEffect(() => {
    if (validEchelons.length === 1 && state.echelon !== validEchelons[0]) {
      update({ echelon: validEchelons[0] });
    }
  }, [validEchelons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Problem sets eligible to be parents (strategic can parent operational, operational can parent tactical)
  const parentEligible = memberships.filter((m) => {
    if (state.echelon === 'operational') return m.echelon === 'strategic';
    if (state.echelon === 'tactical') return m.echelon === 'operational';
    return false;
  });

  const needsParent = state.echelon === 'operational' || state.echelon === 'tactical';

  // Step 1 validation: name required, echelon required, parent required if sub-level
  const step1Valid = state.name.trim().length >= 2 && state.echelon !== '' && (!needsParent || state.parentProblemSetId !== '');

  const handleSelectFromScenario = async () => {
    setSourceMode('scenario');
    if (scenarios.length === 0) {
      setLoadingScenarios(true);
      try {
        const [scenarioList, counts] = await Promise.all([
          exerciseService.getScenarios(),
          problemSetService.getScenarioUsageCounts(),
        ]);
        setScenarios(scenarioList);
        setUsageCounts(counts);
      } catch {
        // Non-fatal, show empty list
      } finally {
        setLoadingScenarios(false);
      }
    }
  };

  const handleScenarioSelect = (scenario: ExerciseScenario) => {
    setSelectedScenario(scenario);
    update({
      name: scenario.name,
      description: `Training exercise based on ${scenario.name}`,
      echelon: 'strategic',
      classification: 'UNCLASSIFIED',
      problemStatement: '',
    });
    setStep(1);
  };

  const handleCreate = async () => {
    if (!userDID) {
      setError('Not authenticated. Please reload.');
      return;
    }
    if (!state.echelon) {
      setError('Echelon is required.');
      return;
    }

    setLoading(true);
    setError(null);

    const input: CreateProblemSetInput = {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      echelon: state.echelon as Echelon,
      classification: state.classification,
      parentProblemSetId: state.parentProblemSetId || undefined,
      inviteMode: state.inviteMode,
      discoverability: state.discoverability,
      problemStatement: state.problemStatement.trim() || undefined,
    };

    try {
      if (sourceMode === 'scenario' && selectedScenario) {
        const result = await problemSetService.createFromScenario(selectedScenario.id, {
          name: state.name.trim(),
          description: state.description.trim() || undefined,
          echelon: state.echelon as Echelon,
          classification: state.classification,
          inviteMode: state.inviteMode,
          discoverability: state.discoverability,
          problemStatement: state.problemStatement.trim() || undefined,
        });
        onCreated(result.id, { navigateTo: 'understand' });
        return;
      }
      const problemSet = await problemSetService.createProblemSet(input, userDID);
      onCreated(problemSet.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create problemSet. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wizard-overlay">
      <div
        className="wizard-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Create problem set"
      >
        {/* Header */}
        <div className="wizard-header">
          <h2>Create Problem Set</h2>
          <button
            onClick={onClose}
            className="wizard-close-btn"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <StepIndicator current={step + 1} total={4} />

        {/* Step 0: Source Choice */}
        {step === 0 && (
          <div className="wizard-section">
            <p className="wizard-hint">How would you like to start?</p>
            <div className="source-choice-cards">
              <button
                className={`source-card${sourceMode === 'fresh' ? ' selected' : ''}`}
                onClick={() => { setSourceMode('fresh'); setStep(1); }}
                type="button"
              >
                <span className="source-card-icon">+</span>
                <span className="source-card-title">Start Fresh</span>
                <span className="source-card-desc">Create a new problem set from scratch</span>
              </button>
              <button
                className={`source-card${sourceMode === 'scenario' ? ' selected' : ''}`}
                onClick={handleSelectFromScenario}
                type="button"
              >
                <span className="source-card-icon">S</span>
                <span className="source-card-title">From Scenario</span>
                <span className="source-card-desc">Pre-fill from an exercise scenario</span>
              </button>
            </div>

            {sourceMode === 'scenario' && (
              <div className="scenario-picker">
                {loadingScenarios ? (
                  <p className="wizard-hint">Loading scenarios...</p>
                ) : scenarios.length === 0 ? (
                  <p className="wizard-hint">No scenarios available.</p>
                ) : (
                  <div className="scenario-list">
                    {scenarios.map((s) => (
                      <button
                        key={s.id}
                        className={`scenario-item${selectedScenario?.id === s.id ? ' selected' : ''}`}
                        onClick={() => handleScenarioSelect(s)}
                        type="button"
                      >
                        <div className="scenario-item-text">
                          <span className="scenario-item-name">{s.name}</span>
                          <span className="scenario-item-meta">{s.designation} &middot; {s.status}</span>
                        </div>
                        {(usageCounts[s.id] ?? 0) > 0 && (
                          <span className="scenario-badge">In use ({usageCounts[s.id]})</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 1: Name / Echelon / Parent / Problem Statement */}
        {step === 1 && (
          <div className="wizard-section">
            {sourceMode === 'scenario' && (
              <div className="mode-locked-indicator">
                <span className="mode-locked-badge">TRNG</span>
                <span className="mode-locked-text">Mode: Training (locked for scenario-based problem sets)</span>
              </div>
            )}
            <div>
              <label className="wizard-label" htmlFor="ps-name">
                Problem Set Name <span className="required">*</span>
              </label>
              <input
                id="ps-name"
                type="text"
                className="wizard-input"
                placeholder="e.g. Indo-Pacific Theater"
                value={state.name}
                onChange={(e) => update({ name: e.target.value })}
                maxLength={80}
                autoFocus
              />
            </div>

            <div>
              <label className="wizard-label" htmlFor="ps-desc">
                Description
              </label>
              <textarea
                id="ps-desc"
                className="wizard-textarea"
                placeholder="Brief description of this problem set's purpose"
                value={state.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
                maxLength={500}
              />
            </div>

            <div>
              <span className="wizard-group-label">Echelon <span className="required">*</span></span>
              <p className="wizard-hint">Strategic problem sets contain operational, which contain tactical.</p>
              {validEchelons.length === 1 ? (
                <div className="type-card selected" style={{ cursor: 'default' }}>
                  <span className="type-card-symbol">{ECHELON_LABELS[validEchelons[0]].symbol}</span>
                  <span className="type-card-name">{ECHELON_LABELS[validEchelons[0]].name}</span>
                  <span className="type-card-desc">{ECHELON_LABELS[validEchelons[0]].desc}</span>
                  <span className="type-card-auto">Auto-selected based on parent echelon</span>
                </div>
              ) : (
                <div className="type-card-group">
                  {validEchelons.map((echelon) => (
                    <label
                      key={echelon}
                      className={`type-card${state.echelon === echelon ? ' selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="echelon"
                        value={echelon}
                        checked={state.echelon === echelon}
                        onChange={() => update({ echelon, parentProblemSetId: '' })}
                        className="sr-only"
                      />
                      <span className="type-card-symbol">{ECHELON_LABELS[echelon].symbol}</span>
                      <span className="type-card-name">{ECHELON_LABELS[echelon].name}</span>
                      <span className="type-card-desc">{ECHELON_LABELS[echelon].desc}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Parent problem set selector (only for operational/tactical) */}
            {needsParent && (
              <div>
                <label className="wizard-label" htmlFor="ps-parent">
                  Parent Problem Set <span className="required">*</span>
                </label>
                {parentEligible.length === 0 ? (
                  <div className="wizard-warning">
                    You have no eligible parent problem sets. Create a strategic problem set first.
                  </div>
                ) : (
                  <select
                    id="ps-parent"
                    className="wizard-select"
                    value={state.parentProblemSetId}
                    onChange={(e) => update({ parentProblemSetId: e.target.value })}
                  >
                    <option value="">Select parent problem set</option>
                    {parentEligible.map((m) => (
                      <option key={m.problemSetId} value={m.problemSetId}>
                        {m.name} ({m.echelon})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Problem Statement (optional) */}
            <div>
              <label className="wizard-label" htmlFor="ps-statement">
                Problem Statement
              </label>
              <textarea
                id="ps-statement"
                className="wizard-textarea"
                placeholder="What operational problem does this set address? (Optional)"
                value={state.problemStatement}
                onChange={(e) => update({ problemStatement: e.target.value })}
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>
        )}

        {/* Step 2: Classification / Invite Mode / Discoverability */}
        {step === 2 && (
          <div className="wizard-section">
            {/* Classification */}
            <div>
              <span className="wizard-group-label">Classification Level</span>
              <div className="radio-option-group">
                {(['UNCLASSIFIED', 'SECRET', 'TOPSECRET'] as Classification[]).map((cls) => (
                  <label
                    key={cls}
                    className={`radio-option${state.classification === cls ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="classification"
                      value={cls}
                      checked={state.classification === cls}
                      onChange={() => update({ classification: cls })}
                      className="sr-only"
                    />
                    <div className="radio-dot-wrapper">
                      <div className={`radio-dot${state.classification === cls ? ' checked' : ''}`} />
                    </div>
                    <div className="radio-text">
                      <span className="radio-label">{CLASSIFICATION_LABELS[cls]}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Invite mode */}
            <div>
              <span className="wizard-group-label">Invite Mode</span>
              <div className="radio-option-group">
                {(['open', 'gated'] as InviteMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={`radio-option${state.inviteMode === mode ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="inviteMode"
                      value={mode}
                      checked={state.inviteMode === mode}
                      onChange={() => update({ inviteMode: mode })}
                      className="sr-only"
                    />
                    <div className="radio-dot-wrapper">
                      <div className={`radio-dot${state.inviteMode === mode ? ' checked' : ''}`} />
                    </div>
                    <div className="radio-text">
                      <span className="radio-label">{INVITE_MODE_LABELS[mode]}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Discoverability */}
            <div>
              <span className="wizard-group-label">Discoverability</span>
              <div className="radio-option-group horizontal">
                {(['discoverable', 'private'] as Discoverability[]).map((d) => (
                  <label
                    key={d}
                    className={`radio-option${state.discoverability === d ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="discoverability"
                      value={d}
                      checked={state.discoverability === d}
                      onChange={() => update({ discoverability: d })}
                      className="sr-only"
                    />
                    <div className="radio-text">
                      <span className="radio-label" style={{ textTransform: 'capitalize' }}>{d}</span>
                      <span className="radio-desc">
                        {d === 'discoverable' ? 'Visible in problem set directory' : 'Hidden from non-members'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="wizard-section">
            <p className="wizard-review-title">Review Your Problem Set</p>

            <div className="wizard-review-panel">
              {selectedScenario && (
                <div className="review-row">
                  <span className="review-key">Source Scenario</span>
                  <span className="review-val">{selectedScenario.name} ({selectedScenario.designation})</span>
                </div>
              )}
              <div className="review-row">
                <span className="review-key">Name</span>
                <span className="review-val">{state.name}</span>
              </div>
              {state.description && (
                <div className="review-row">
                  <span className="review-key">Description</span>
                  <span className="review-val">{state.description}</span>
                </div>
              )}
              <div className="review-row">
                <span className="review-key">Echelon</span>
                <span className="review-val">
                  {state.echelon ? `${ECHELON_SYMBOLS[state.echelon as Echelon]} ${ECHELON_LABELS[state.echelon as Echelon].name}` : ''}
                </span>
              </div>
              {state.parentProblemSetId && (
                <div className="review-row">
                  <span className="review-key">Parent</span>
                  <span className="review-val">
                    {memberships.find((m) => m.problemSetId === state.parentProblemSetId)?.name ?? state.parentProblemSetId}
                  </span>
                </div>
              )}
              {state.problemStatement && (
                <div className="review-row">
                  <span className="review-key">Problem Statement</span>
                  <span className="review-val">{state.problemStatement.slice(0, 80)}{state.problemStatement.length > 80 ? '...' : ''}</span>
                </div>
              )}
              <hr className="review-divider" />
              <div className="review-row">
                <span className="review-key">Classification</span>
                <span className="review-val">{CLASSIFICATION_LABELS[state.classification]}</span>
              </div>
              <div className="review-row">
                <span className="review-key">Invite Mode</span>
                <span className="review-val">{INVITE_MODE_LABELS[state.inviteMode]}</span>
              </div>
              <div className="review-row">
                <span className="review-key">Discoverability</span>
                <span className="review-val" style={{ textTransform: 'capitalize' }}>{state.discoverability}</span>
              </div>
            </div>

            {error && (
              <div className="wizard-error">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="wizard-footer">
          <button
            onClick={onClose}
            className="wizard-btn-cancel"
          >
            Cancel
          </button>

          <div className="wizard-footer-right">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="wizard-btn-back"
                disabled={loading}
              >
                Back
              </button>
            )}

            {step < 3 && step > 0 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !step1Valid}
                className="wizard-btn-next"
              >
                Next
              </button>
            ) : step === 3 ? (
              <button
                onClick={handleCreate}
                disabled={loading}
                className="wizard-btn-create"
              >
                {loading ? 'Creating...' : 'Create Problem Set'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
