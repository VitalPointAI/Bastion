/**
 * CreateWorkspaceWizard
 *
 * Multi-step form for workspace creation:
 * - Step 1: Name, description, workspace type, optional parent
 * - Step 2: Classification, invite mode, discoverability
 * - Step 3: Review and confirm
 *
 * Uses workspaceService.createWorkspace on submit.
 */

import { useState } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';
import { workspaceService, type CreateWorkspaceInput } from '../../lib/workspace-service';

// ─── Types ───────────────────────────────────────────────────────────────────

type WorkspaceType = 'Organization' | 'Unit' | 'Team';
type Classification = 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
type InviteMode = 'open' | 'invite_only' | 'gated';
type Discoverability = 'public' | 'private';

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
  inviteMode: 'invite_only',
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

const CLASSIFICATION_DESC: Record<Classification, string> = {
  UNCLASSIFIED: 'Accessible to all cleared members.',
  SECRET: 'Restricted — requires SECRET clearance.',
  TOPSECRET: 'Highly restricted — requires TOP SECRET clearance.',
};

const INVITE_MODE_LABELS: Record<InviteMode, string> = {
  open: 'Open',
  invite_only: 'Invite Only',
  gated: 'Gated (approval required)',
};

const INVITE_MODE_DESC: Record<InviteMode, string> = {
  open: 'Anyone in the parent organization can join.',
  invite_only: 'Members must be explicitly invited.',
  gated: 'Invitees must be approved by an admin before joining.',
};

// ─── Step components ─────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => i + 1).map((step) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={[
              'flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold',
              step === current
                ? 'bg-blue-600 text-white'
                : step < current
                ? 'bg-blue-900 text-blue-300'
                : 'bg-gray-700 text-gray-400',
            ].join(' ')}
          >
            {step < current ? '✓' : step}
          </div>
          {step < total && <div className={`w-8 h-0.5 ${step < current ? 'bg-blue-600' : 'bg-gray-700'}`} />}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70">
      <div
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Create workspace"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-white text-lg font-bold">Create Workspace</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <StepIndicator current={step} total={3} />

        {/* ─── Step 1: Name / Type / Parent ─────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1" htmlFor="ws-name">
                Workspace Name <span className="text-red-400">*</span>
              </label>
              <input
                id="ws-name"
                type="text"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Alpha Company"
                value={state.name}
                onChange={(e) => update({ name: e.target.value })}
                maxLength={80}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1" htmlFor="ws-desc">
                Description
              </label>
              <textarea
                id="ws-desc"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Brief description of this workspace's purpose"
                value={state.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={2}
                maxLength={500}
              />
            </div>

            <div>
              <span className="block text-sm text-gray-300 mb-2">Workspace Type</span>
              <div className="flex gap-3">
                {(['Organization', 'Unit', 'Team'] as WorkspaceType[]).map((type) => (
                  <label
                    key={type}
                    className={[
                      'flex-1 flex flex-col items-center p-3 rounded-lg border cursor-pointer transition-colors',
                      state.workspaceType === type
                        ? 'border-blue-500 bg-blue-900 bg-opacity-30 text-white'
                        : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="workspaceType"
                      value={type}
                      checked={state.workspaceType === type}
                      onChange={() => update({ workspaceType: type, parentWorkspaceId: '' })}
                      className="sr-only"
                    />
                    <span className="font-semibold text-sm">{type}</span>
                    <span className="text-xs mt-0.5 text-center text-gray-500">
                      {type === 'Organization' ? 'Top-level' : type === 'Unit' ? 'Within org' : 'Smallest unit'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Parent workspace selector (only for Unit/Team) */}
            {needsParent && (
              <div>
                <label className="block text-sm text-gray-300 mb-1" htmlFor="ws-parent">
                  Parent Workspace <span className="text-red-400">*</span>
                </label>
                {parentEligible.length === 0 ? (
                  <p className="text-yellow-400 text-sm bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded px-3 py-2">
                    You have no eligible parent workspaces. Create an Organization first.
                  </p>
                ) : (
                  <select
                    id="ws-parent"
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
          <div className="space-y-5">
            {/* Classification */}
            <div>
              <span className="block text-sm text-gray-300 mb-2">Classification Level</span>
              <div className="space-y-2">
                {(['UNCLASSIFIED', 'SECRET', 'TOPSECRET'] as Classification[]).map((cls) => (
                  <label
                    key={cls}
                    className={[
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      state.classification === cls
                        ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                        : 'border-gray-600 bg-gray-800 hover:border-gray-500',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="classification"
                      value={cls}
                      checked={state.classification === cls}
                      onChange={() => update({ classification: cls })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">{CLASSIFICATION_LABELS[cls]}</div>
                      <div className="text-gray-400 text-xs">{CLASSIFICATION_DESC[cls]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Invite mode */}
            <div>
              <span className="block text-sm text-gray-300 mb-2">Invite Mode</span>
              <div className="space-y-2">
                {(['open', 'invite_only', 'gated'] as InviteMode[]).map((mode) => (
                  <label
                    key={mode}
                    className={[
                      'flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                      state.inviteMode === mode
                        ? 'border-blue-500 bg-blue-900 bg-opacity-20'
                        : 'border-gray-600 bg-gray-800 hover:border-gray-500',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="inviteMode"
                      value={mode}
                      checked={state.inviteMode === mode}
                      onChange={() => update({ inviteMode: mode })}
                      className="mt-0.5"
                    />
                    <div>
                      <div className="text-white text-sm font-medium">{INVITE_MODE_LABELS[mode]}</div>
                      <div className="text-gray-400 text-xs">{INVITE_MODE_DESC[mode]}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Discoverability */}
            <div>
              <span className="block text-sm text-gray-300 mb-2">Discoverability</span>
              <div className="flex gap-3">
                {(['public', 'private'] as Discoverability[]).map((d) => (
                  <label
                    key={d}
                    className={[
                      'flex-1 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors',
                      state.discoverability === d
                        ? 'border-blue-500 bg-blue-900 bg-opacity-20 text-white'
                        : 'border-gray-600 bg-gray-800 text-gray-400 hover:border-gray-500',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="discoverability"
                      value={d}
                      checked={state.discoverability === d}
                      onChange={() => update({ discoverability: d })}
                    />
                    <div>
                      <div className="text-sm font-medium capitalize">{d}</div>
                      <div className="text-xs text-gray-500">
                        {d === 'public' ? 'Visible in workspace directory' : 'Hidden from non-members'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Step 3: Review ───────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-gray-300 text-sm font-semibold uppercase tracking-wide mb-3">Review Your Workspace</h3>

            <div className="bg-gray-800 rounded-lg p-4 space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span className="text-white font-medium">{state.name}</span>
              </div>
              {state.description && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Description</span>
                  <span className="text-white text-right max-w-xs truncate">{state.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Type</span>
                <span className="text-white">{state.workspaceType}</span>
              </div>
              {state.parentWorkspaceId && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Parent</span>
                  <span className="text-white">
                    {memberships.find((m) => m.workspaceId === state.parentWorkspaceId)?.name ?? state.parentWorkspaceId}
                  </span>
                </div>
              )}
              <div className="border-t border-gray-700 pt-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Classification</span>
                  <span className="text-white">{CLASSIFICATION_LABELS[state.classification]}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-gray-400">Invite Mode</span>
                  <span className="text-white">{INVITE_MODE_LABELS[state.inviteMode]}</span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-gray-400">Discoverability</span>
                  <span className="text-white capitalize">{state.discoverability}</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900 bg-opacity-40 border border-red-700 rounded px-3 py-2 text-red-300 text-sm">
                {error}
              </div>
            )}
          </div>
        )}

        {/* ─── Navigation Buttons ───────────────────────────────────────── */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="px-4 py-2 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                disabled={loading}
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={() => setStep(step + 1)}
                disabled={step === 1 && !step1Valid}
                className={[
                  'px-5 py-2 text-sm rounded font-medium transition-colors',
                  step === 1 && !step1Valid
                    ? 'bg-blue-900 text-blue-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white',
                ].join(' ')}
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={loading}
                className={[
                  'px-5 py-2 text-sm rounded font-medium transition-colors',
                  loading
                    ? 'bg-blue-900 text-blue-600 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white',
                ].join(' ')}
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
