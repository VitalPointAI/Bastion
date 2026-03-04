/**
 * CreateWorkspaceWizard
 *
 * Multi-step form for workspace creation:
 * - Step 1: Name, description, workspace type, optional parent
 * - Step 2: Classification, invite mode, discoverability
 * - Step 3: Review and confirm
 *
 * Uses workspaceService.createWorkspace on submit.
 * Styled with CreateWorkspaceWizard.css (plain CSS, no Tailwind).
 */

import { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';
import { workspaceService, type CreateWorkspaceInput } from '../../lib/workspace-service';
import './CreateWorkspaceWizard.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkspaceType = 'Organization' | 'Unit' | 'Team';
type Classification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
type InviteMode = 'open' | 'gated';
type Discoverability = 'discoverable' | 'private';

interface WizardState {
  // Step 1
  name: string;
  description: string;
  workspaceType: WorkspaceType;
  parentWorkspaceId: string;
  // Step 2
  classification: Classification;
  inviteMode: InviteMode;
  discoverability: Discoverability;
}

const INITIAL_STATE: WizardState = {
  name: '',
  description: '',
  workspaceType: 'Organization',
  parentWorkspaceId: '',
  classification: 'UNCLASSIFIED',
  inviteMode: 'gated',
  discoverability: 'private',
};

interface Props {
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
  parentWorkspaceId?: string;
}

// ─── Helper labels ────────────────────────────────────────────────────────────

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
            {step < current ? '✓' : step}
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

export function CreateWorkspaceWizard({ onClose, onCreated, parentWorkspaceId }: Props) {
  const { memberships } = useWorkspace();
  const { userDID } = useUser();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>({
    ...INITIAL_STATE,
    parentWorkspaceId: parentWorkspaceId ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<WizardState>) => setState((s) => ({ ...s, ...patch }));

  // Workspaces eligible to be parents (Orgs can parent Units, Orgs/Units can parent Teams)
  const parentEligible = memberships.filter((m) => {
    if (state.workspaceType === 'Unit') return m.workspaceType === 'Organization';
    if (state.workspaceType === 'Team') return m.workspaceType === 'Organization' || m.workspaceType === 'Unit';
    return false;
  });

  const needsParent = state.workspaceType === 'Unit' || state.workspaceType === 'Team';

  // Step 1 validation
  const step1Valid = state.name.trim().length >= 2 && (!needsParent || state.parentWorkspaceId !== '');

  const handleCreate = async () => {
    if (!userDID) {
      setError('Not authenticated. Please reload.');
      return;
    }

    setLoading(true);
    setError(null);

    const input: CreateWorkspaceInput = {
      name: state.name.trim(),
      description: state.description.trim() || undefined,
      workspaceType: state.workspaceType,
      classification: state.classification,
      parentWorkspaceId: state.parentWorkspaceId || undefined,
      inviteMode: state.inviteMode,
      discoverability: state.discoverability,
    };

    try {
      const workspace = await workspaceService.createWorkspace(input, userDID);
      onCreated(workspace.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workspace. Please try again.');
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
        aria-label="Create workspace"
      >
        {/* Header */}
        <div className="wizard-header">
          <h2>Create Workspace</h2>
          <button
            onClick={onClose}
            className="wizard-close-btn"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <StepIndicator current={step} total={3} />

        {/* ─── Step 1: Name / Type / Parent ─────────────────────────────── */}
        {step === 1 && (
          <div className="wizard-section">
            <div>
              <label className="wizard-label" htmlFor="ws-name">
                Workspace Name <span className="required">*</span>
              </label>
              <input
                id="ws-name"
                type="text"
                className="wizard-input"
                placeholder="e.g. Alpha Company"
                value={state.name}
                onChange={(e) => update({ name: e.target.value })}
                maxLength={80}
                autoFocus
              />
            </div>

            <div>
              <label className="wizard-label" htmlFor="ws-desc">
                Description
              </label>
              <textarea
                id="ws-desc"
                className="wizard-textarea"
                placeholder="Brief description of this workspace's purpose"
                value={state.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
                maxLength={500}
              />
            </div>

            <div>
              <span className="wizard-group-label">Workspace Type</span>
              <div className="type-card-group">
                {(['Organization', 'Unit', 'Team'] as WorkspaceType[]).map((type) => (
                  <label
                    key={type}
                    className={`type-card${state.workspaceType === type ? ' selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="workspaceType"
                      value={type}
                      checked={state.workspaceType === type}
                      onChange={() => update({ workspaceType: type, parentWorkspaceId: '' })}
                      className="sr-only"
                    />
                    <span className="type-card-name">{type}</span>
                    <span className="type-card-desc">
                      {type === 'Organization' ? 'Top-level' : type === 'Unit' ? 'Within org' : 'Smallest unit'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Parent workspace selector (only for Unit/Team) */}
            {needsParent && (
              <div>
                <label className="wizard-label" htmlFor="ws-parent">
                  Parent Workspace <span className="required">*</span>
                </label>
                {parentEligible.length === 0 ? (
                  <div className="wizard-warning">
                    You have no eligible parent workspaces. Create an Organization first.
                  </div>
                ) : (
                  <select
                    id="ws-parent"
                    className="wizard-select"
                    value={state.parentWorkspaceId}
                    onChange={(e) => update({ parentWorkspaceId: e.target.value })}
                  >
                    <option value="">Select parent workspace</option>
                    {parentEligible.map((m) => (
                      <option key={m.workspaceId} value={m.workspaceId}>
                        {m.name} ({m.workspaceType})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Step 2: Classification / Invite Mode / Discoverability ───── */}
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
                        {d === 'discoverable' ? 'Visible in workspace directory' : 'Hidden from non-members'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Review ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="wizard-section">
            <p className="wizard-review-title">Review Your Workspace</p>

            <div className="wizard-review-panel">
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
                <span className="review-key">Type</span>
                <span className="review-val">{state.workspaceType}</span>
              </div>
              {state.parentWorkspaceId && (
                <div className="review-row">
                  <span className="review-key">Parent</span>
                  <span className="review-val">
                    {memberships.find((m) => m.workspaceId === state.parentWorkspaceId)?.name ?? state.parentWorkspaceId}
                  </span>
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

        {/* ─── Navigation Buttons ───────────────────────────────────────── */}
        <div className="wizard-footer">
          <button
            onClick={onClose}
            className="wizard-btn-cancel"
          >
            Cancel
          </button>

          <div className="wizard-footer-right">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="wizard-btn-back"
                disabled={loading}
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !step1Valid}
                className="wizard-btn-next"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={loading}
                className="wizard-btn-create"
              >
                {loading ? 'Creating...' : 'Create Workspace'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
