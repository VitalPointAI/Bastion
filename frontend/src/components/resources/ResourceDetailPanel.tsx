/**
 * ResourceDetailPanel
 *
 * Slide-over detail panel shared across all Resources sub-views.
 * Opens from the right edge when a resource is selected.
 *
 * Three sections:
 *   1. DID Master Record — read-only, authoritative record from registry
 *   2. Local Editable — problem-set-level annotations and status overrides
 *   3. Security & Caveats — caveat editor (commander/XO editable, read-only for others)
 *
 * Phase 42 Plan 02: Initial slide-over shell.
 * Phase 58 Plan 03: Security & Caveats section with on-chain sync badge.
 */

import { useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { updateResourceCaveats } from '../../lib/resource-service.js';
import type { ResourceCaveats, CaveatClassification } from '../../lib/resource-service.js';

interface ResourceDetailPanelProps {
  resourceId: string | null;
  problemSetId?: string;
  /** If true, the Security & Caveats section is editable (commander/XO). */
  canEditCaveats?: boolean;
  /** Current caveats for the resource, if known. */
  caveats?: ResourceCaveats | null;
  onClose: () => void;
}

// ============================================================================
// Icons
// ============================================================================

function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 inline mr-1"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 inline mr-1"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 inline mr-1"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

// ============================================================================
// Section helpers
// ============================================================================

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center px-4 py-2 bg-gray-750 border-b border-gray-600">
      <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
        {icon}
        {title}
      </span>
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-2">
      <div className="text-xs text-gray-500 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-sm text-gray-200">{value}</div>
    </div>
  );
}

// ============================================================================
// SecurityCaveatsSection
// ============================================================================

const CLASSIFICATION_OPTIONS: CaveatClassification[] = [
  'UNCLASSIFIED',
  'SECRET',
  'TOPSECRET',
  'TS_SCI',
];

const ROE_TIER_LABELS: Record<number, string> = {
  1: '1 — Restrictive',
  2: '2 — Defensive',
  3: '3 — Limited Offensive',
  4: '4 — Offensive',
  5: '5 — Unrestricted',
};

const COMMON_NATION_CODES = ['USA', 'GBR', 'AUS', 'CAN', 'NZL'];

interface SecurityCaveatsSectionProps {
  resourceId: string;
  problemSetId: string;
  canEdit: boolean;
  caveats: ResourceCaveats | null;
  onSave: (caveats: ResourceCaveats) => void;
}

function SecurityCaveatsSection({
  resourceId,
  problemSetId,
  canEdit,
  caveats,
  onSave,
}: SecurityCaveatsSectionProps) {
  const defaultCaveats: ResourceCaveats = caveats ?? {
    classification: 'UNCLASSIFIED',
    releasability: [],
    roeTier: 1,
    timeWindows: [],
    employmentConstraints: [],
  };

  const [classification, setClassification] = useState<CaveatClassification>(
    defaultCaveats.classification,
  );
  const [releasability, setReleasability] = useState<string[]>(defaultCaveats.releasability);
  const [roeTier, setRoeTier] = useState<number>(defaultCaveats.roeTier);
  const [timeWindows, setTimeWindows] = useState(defaultCaveats.timeWindows);
  const [geoBoundsEnabled, setGeoBoundsEnabled] = useState(!!defaultCaveats.geoBounds);
  const [geoBounds, setGeoBounds] = useState(
    defaultCaveats.geoBounds ?? { north: 0, south: 0, east: 0, west: 0 },
  );
  const [constraintsRaw, setConstraintsRaw] = useState<string>(
    defaultCaveats.employmentConstraints.join(', '),
  );
  const [customNation, setCustomNation] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveError, setSaveError] = useState('');

  const toggleNation = useCallback(
    (code: string) => {
      setReleasability((prev) =>
        prev.includes(code) ? prev.filter((n) => n !== code) : [...prev, code],
      );
    },
    [],
  );

  const addCustomNation = useCallback(() => {
    const code = customNation.trim().toUpperCase();
    if (code && !releasability.includes(code)) {
      setReleasability((prev) => [...prev, code]);
    }
    setCustomNation('');
  }, [customNation, releasability]);

  const addTimeWindow = useCallback(() => {
    setTimeWindows((prev) => [...prev, { startMs: Date.now(), endMs: Date.now() + 3600_000 }]);
  }, []);

  const removeTimeWindow = useCallback((idx: number) => {
    setTimeWindows((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const updateTimeWindow = useCallback(
    (idx: number, field: 'startMs' | 'endMs', value: string) => {
      const ms = new Date(value).getTime();
      if (isNaN(ms)) return;
      setTimeWindows((prev) =>
        prev.map((tw, i) => (i === idx ? { ...tw, [field]: ms } : tw)),
      );
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!canEdit) return;
    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      const constraints = constraintsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload: ResourceCaveats = {
        classification,
        releasability,
        roeTier,
        timeWindows,
        employmentConstraints: constraints,
        ...(geoBoundsEnabled ? { geoBounds } : {}),
      };
      await updateResourceCaveats(resourceId, problemSetId, payload);
      setSaveStatus('success');
      onSave(payload);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }, [
    canEdit,
    classification,
    releasability,
    roeTier,
    timeWindows,
    geoBoundsEnabled,
    geoBounds,
    constraintsRaw,
    resourceId,
    problemSetId,
    onSave,
  ]);

  const inputCls =
    'w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed';

  const labelCls = 'text-xs text-gray-500 uppercase tracking-wider block mb-1';

  return (
    <div className="pb-4">
      {/* On-chain sync badge */}
      <div className="px-4 pt-3 pb-1">
        {caveats?.onChainSyncedAt ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-400 bg-green-900/30 border border-green-800 rounded px-2 py-0.5">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            On-chain verified
            <span className="text-green-500 font-normal">
              {new Date(caveats.onChainSyncedAt).toLocaleDateString()}
            </span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-yellow-400 bg-yellow-900/30 border border-yellow-800 rounded px-2 py-0.5">
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Pending chain sync
          </span>
        )}
      </div>

      {/* Classification */}
      <div className="px-4 py-2">
        <label className={labelCls}>Classification</label>
        <select
          className={inputCls}
          value={classification}
          onChange={(e) => setClassification(e.target.value as CaveatClassification)}
          disabled={!canEdit}
        >
          {CLASSIFICATION_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </div>

      {/* Releasability */}
      <div className="px-4 py-2">
        <label className={labelCls}>Releasability</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {COMMON_NATION_CODES.map((code) => (
            <button
              key={code}
              type="button"
              disabled={!canEdit}
              onClick={() => toggleNation(code)}
              className={[
                'text-xs px-2 py-0.5 rounded border transition-colors',
                releasability.includes(code)
                  ? 'bg-blue-700 border-blue-500 text-white'
                  : 'bg-gray-700 border-gray-600 text-gray-400 hover:border-blue-500 disabled:hover:border-gray-600',
                !canEdit ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {code}
            </button>
          ))}
        </div>
        {releasability
          .filter((n) => !COMMON_NATION_CODES.includes(n))
          .map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 text-xs bg-gray-700 border border-gray-600 rounded px-2 py-0.5 mr-1 mb-1"
            >
              {code}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => toggleNation(code)}
                  className="text-gray-400 hover:text-red-400 ml-0.5"
                  aria-label={`Remove ${code}`}
                >
                  ×
                </button>
              )}
            </span>
          ))}
        {releasability.length === 0 && (
          <p className="text-xs text-gray-500 italic mb-1">No releasability restrictions</p>
        )}
        {canEdit && (
          <div className="flex gap-1 mt-1">
            <input
              type="text"
              placeholder="Add nation code..."
              value={customNation}
              onChange={(e) => setCustomNation(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomNation();
                }
              }}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              maxLength={10}
            />
            <button
              type="button"
              onClick={addCustomNation}
              className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-300 hover:text-white hover:border-blue-500 transition-colors"
            >
              Add
            </button>
          </div>
        )}
      </div>

      {/* ROE Tier */}
      <div className="px-4 py-2">
        <label className={labelCls}>ROE Tier</label>
        <select
          className={inputCls}
          value={roeTier}
          onChange={(e) => setRoeTier(Number(e.target.value))}
          disabled={!canEdit}
        >
          {Object.entries(ROE_TIER_LABELS).map(([tier, label]) => (
            <option key={tier} value={Number(tier)}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Time Windows */}
      <div className="px-4 py-2">
        <label className={labelCls}>Time Windows</label>
        {timeWindows.length === 0 && (
          <p className="text-xs text-gray-500 italic mb-1">No time restrictions</p>
        )}
        {timeWindows.map((tw, idx) => (
          <div key={idx} className="flex gap-1 items-center mb-1">
            <input
              type="datetime-local"
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              defaultValue={new Date(tw.startMs).toISOString().slice(0, 16)}
              onChange={(e) => updateTimeWindow(idx, 'startMs', e.target.value)}
              disabled={!canEdit}
            />
            <span className="text-gray-500 text-xs">to</span>
            <input
              type="datetime-local"
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
              defaultValue={new Date(tw.endMs).toISOString().slice(0, 16)}
              onChange={(e) => updateTimeWindow(idx, 'endMs', e.target.value)}
              disabled={!canEdit}
            />
            {canEdit && (
              <button
                type="button"
                onClick={() => removeTimeWindow(idx)}
                className="text-gray-400 hover:text-red-400 text-xs px-1"
                aria-label="Remove time window"
              >
                ×
              </button>
            )}
          </div>
        ))}
        {canEdit && (
          <button
            type="button"
            onClick={addTimeWindow}
            className="mt-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            + Add time window
          </button>
        )}
      </div>

      {/* Geographic Bounds */}
      <div className="px-4 py-2">
        <div className="flex items-center gap-2 mb-1">
          <label className={labelCls + ' mb-0'}>Geographic Bounds</label>
          {canEdit && (
            <input
              type="checkbox"
              checked={geoBoundsEnabled}
              onChange={(e) => setGeoBoundsEnabled(e.target.checked)}
              className="rounded border-gray-600 bg-gray-700 text-blue-500"
              aria-label="Enable geographic bounds"
            />
          )}
        </div>
        {!geoBoundsEnabled && (
          <p className="text-xs text-gray-500 italic">No geographic restrictions</p>
        )}
        {geoBoundsEnabled && (
          <div className="grid grid-cols-2 gap-1">
            {(['north', 'south', 'east', 'west'] as const).map((dir) => (
              <div key={dir}>
                <label className="text-xs text-gray-500 block mb-0.5 capitalize">{dir} (°)</label>
                <input
                  type="number"
                  step="0.000001"
                  min={dir === 'south' ? -90 : dir === 'north' ? -90 : -180}
                  max={dir === 'south' ? 90 : dir === 'north' ? 90 : 180}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  value={geoBounds[dir] / 1_000_000}
                  onChange={(e) =>
                    setGeoBounds((prev) => ({
                      ...prev,
                      [dir]: Math.round(parseFloat(e.target.value) * 1_000_000),
                    }))
                  }
                  disabled={!canEdit}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Employment Constraints */}
      <div className="px-4 py-2">
        <label className={labelCls}>Employment Constraints</label>
        <input
          type="text"
          placeholder="Comma-separated, e.g. KINETIC_ONLY_WITH_APPROVAL"
          value={constraintsRaw}
          onChange={(e) => setConstraintsRaw(e.target.value)}
          disabled={!canEdit}
          className={inputCls}
        />
        <p className="text-xs text-gray-500 mt-0.5">Separate multiple constraints with commas</p>
      </div>

      {/* Save button + feedback */}
      {canEdit && (
        <div className="px-4 pt-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white text-sm font-medium py-2 px-4 rounded transition-colors"
          >
            {saving ? 'Saving...' : 'Save Caveats'}
          </button>
          {saveStatus === 'success' && (
            <p className="mt-1 text-xs text-green-400 text-center">Caveats saved successfully</p>
          )}
          {saveStatus === 'error' && (
            <p className="mt-1 text-xs text-red-400 text-center">{saveError}</p>
          )}
        </div>
      )}

      {!canEdit && (
        <div className="px-4 pt-1">
          <p className="text-xs text-gray-500 italic">
            Read-only. Commander or XO role required to edit caveats.
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main component
// ============================================================================

export function ResourceDetailPanel({
  resourceId,
  problemSetId,
  canEditCaveats = false,
  caveats: initialCaveats,
  onClose,
}: ResourceDetailPanelProps) {
  const isOpen = resourceId !== null;
  const [caveats, setCaveats] = useState<ResourceCaveats | null>(initialCaveats ?? null);
  const [showCaveats, setShowCaveats] = useState(true);

  const handleCaveatSave = useCallback((saved: ResourceCaveats) => {
    setCaveats(saved);
  }, []);

  return (
    <>
      {/* Backdrop overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Slide-over panel */}
      <div
        className={[
          'fixed top-0 right-0 h-full w-96 bg-gray-800 border-l border-gray-600 z-40',
          'transform transition-transform duration-200 ease-in-out',
          'flex flex-col overflow-hidden',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label="Resource detail"
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-600 shrink-0">
          <h2 className="text-sm font-semibold text-gray-100">Resource Detail</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors p-1"
            aria-label="Close detail panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Panel body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {isOpen && (
            <>
              {/* Section 1: DID Master Record (read-only) */}
              <SectionHeader icon={<LockIcon />} title="DID Master Record" />
              <div className="bg-gray-750 pb-2">
                <ReadOnlyField label="Name / Designation" value="—" />
                <ReadOnlyField label="Category" value="—" />
                <ReadOnlyField label="DID Identifier" value={resourceId ?? '—'} />
                <ReadOnlyField label="Capabilities" value="—" />
                <div className="px-4 pt-1 pb-2">
                  <p className="text-xs text-gray-500 italic">
                    Data loading will be wired in Plan 42-06 when registry service is integrated.
                  </p>
                </div>
              </div>

              {/* Section 2: Local Editable (problem-set level) */}
              <SectionHeader icon={<EditIcon />} title="Local (Problem Set)" />
              <div className="pb-4">
                <div className="px-4 py-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Status
                  </label>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    defaultValue=""
                  >
                    <option value="">— select —</option>
                    <option value="available">Available</option>
                    <option value="in-use">In Use</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="damaged">Damaged</option>
                    <option value="disposed">Disposed</option>
                  </select>
                </div>

                <div className="px-4 py-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Group Assignment
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Alpha Company"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="px-4 py-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Operational Nickname
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., IRON FIST 6"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="px-4 py-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Current Location
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Grid 123456"
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="px-4 py-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Readiness Assessment
                  </label>
                  <select
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    defaultValue=""
                  >
                    <option value="">— select —</option>
                    <option value="C1">C1 — Fully Ready</option>
                    <option value="C2">C2 — Substantially Ready</option>
                    <option value="C3">C3 — Marginally Ready</option>
                    <option value="C4">C4 — Not Ready</option>
                  </select>
                </div>

                <div className="px-4 py-2">
                  <label className="text-xs text-gray-500 uppercase tracking-wider block mb-1">
                    Local Notes
                  </label>
                  <textarea
                    placeholder="Problem-set specific notes..."
                    rows={3}
                    className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                  />
                </div>

                <div className="px-4 pt-2">
                  <button
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium py-2 px-4 rounded transition-colors"
                    onClick={() => {
                      // TODO Plan 42-06: wire to save local overrides via registry service
                    }}
                  >
                    Save Local Changes
                  </button>
                </div>
              </div>

              {/* Section 3: Security & Caveats */}
              <div
                className="flex items-center justify-between px-4 py-2 bg-gray-750 border-b border-gray-600 cursor-pointer select-none"
                onClick={() => setShowCaveats((v) => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setShowCaveats((v) => !v);
                }}
                aria-expanded={showCaveats}
              >
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  <ShieldIcon />
                  Security &amp; Caveats
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className={`h-4 w-4 text-gray-500 transition-transform ${showCaveats ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {showCaveats && (
                <SecurityCaveatsSection
                  resourceId={resourceId}
                  problemSetId={problemSetId ?? ''}
                  canEdit={canEditCaveats}
                  caveats={caveats}
                  onSave={handleCaveatSave}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
