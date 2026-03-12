/**
 * ResourceDetailPanel
 *
 * Slide-over detail panel shared across all Resources sub-views.
 * Opens from the right edge when a resource is selected.
 *
 * Two sections:
 *   1. DID Master Record — read-only, authoritative record from registry
 *   2. Local Editable — problem-set-level annotations and status overrides
 *
 * Actual data fetching will be wired in Plan 42-06 when registry service
 * is integrated. For now uses placeholder data structure.
 *
 * Phase 42 Plan 02: Initial slide-over shell.
 */

import type { ReactNode } from 'react';

interface ResourceDetailPanelProps {
  resourceId: string | null;
  onClose: () => void;
}

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

export function ResourceDetailPanel({ resourceId, onClose }: ResourceDetailPanelProps) {
  const isOpen = resourceId !== null;

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
            </>
          )}
        </div>
      </div>
    </>
  );
}
