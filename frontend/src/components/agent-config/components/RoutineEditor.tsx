/**
 * RoutineEditor
 *
 * Phase 60 Plan 06: Modal editor for creating and editing custom routines
 * in the Agent Config panel's Routines tab.
 *
 * Blueprint Phase 5 — Custom routines allow users to schedule recurring tasks
 * (e.g., daily intel summaries, weekly readiness checks) via cron expressions.
 *
 * Features:
 * - Name and description fields
 * - Cron schedule with preset dropdown ("Every hour", "Every 6 hours", etc.)
 * - Free-text cron input for advanced users
 * - Enable/disable toggle
 * - Save/Cancel buttons
 */

import { useState } from 'react';
import type { RoutineSpec } from '../../../types/agent-config.ts';

// ---------------------------------------------------------------------------
// Cron presets
// ---------------------------------------------------------------------------

interface CronPreset {
  label: string;
  value: string;
  description: string;
}

const CRON_PRESETS: CronPreset[] = [
  { label: 'Every hour',        value: '0 * * * *',     description: 'Runs at the start of every hour' },
  { label: 'Every 6 hours',     value: '0 */6 * * *',   description: 'Runs every 6 hours' },
  { label: 'Daily at 0600',     value: '0 6 * * *',     description: 'Runs every day at 06:00' },
  { label: 'Daily at 0800',     value: '0 8 * * *',     description: 'Runs every day at 08:00' },
  { label: 'Daily at 1800',     value: '0 18 * * *',    description: 'Runs every day at 18:00' },
  { label: 'Monday at 0900',    value: '0 9 * * 1',     description: 'Runs every Monday at 09:00' },
  { label: 'Monday & Thursday', value: '0 9 * * 1,4',   description: 'Runs Monday and Thursday at 09:00' },
  { label: 'Custom',            value: '',               description: 'Enter a custom cron expression' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoutineEditorProps {
  /** Initial routine to edit, or null for create mode. */
  routine: RoutineSpec | null;
  onSave: (routine: RoutineSpec) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoutineEditor({ routine, onSave, onCancel }: RoutineEditorProps) {
  const [name, setName] = useState(routine?.name ?? '');
  const [description, setDescription] = useState(routine?.description ?? '');
  const [cron, setCron] = useState(routine?.cron ?? '0 8 * * *');
  const [enabled, setEnabled] = useState(routine?.enabled ?? true);

  // Determine preset selection from current cron
  const initialPreset = CRON_PRESETS.find(
    (p) => p.value === (routine?.cron ?? '0 8 * * *'),
  )?.value ?? '';
  const [selectedPreset, setSelectedPreset] = useState<string>(initialPreset);

  const [errors, setErrors] = useState<Record<string, string>>({});

  // ─── Handlers ──────────────────────────────────────────────────────────

  function handlePresetChange(presetValue: string) {
    setSelectedPreset(presetValue);
    if (presetValue !== '') {
      setCron(presetValue);
    }
  }

  function handleCronChange(value: string) {
    setCron(value);
    // Mark as custom if it doesn't match any preset
    const matchingPreset = CRON_PRESETS.find((p) => p.value === value);
    if (!matchingPreset) {
      setSelectedPreset('');  // Custom
    } else {
      setSelectedPreset(matchingPreset.value);
    }
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!cron.trim()) errs.cron = 'Cron expression is required';
    // Basic cron validation: 5 fields
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) errs.cron = 'Cron must have 5 fields (min hour dom month dow)';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleSave() {
    if (!validate()) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      cron: cron.trim(),
      enabled,
    });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  /** Get a human-readable schedule description for the current cron. */
  function getScheduleDescription(): string {
    const preset = CRON_PRESETS.find((p) => p.value === cron);
    if (preset && preset.description) return preset.description;
    return `Custom schedule: ${cron}`;
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700">
          <h3 className="text-sm font-semibold text-slate-100">
            {routine ? 'Edit Routine' : 'Add Routine'}
          </h3>
          <button
            onClick={onCancel}
            className="text-slate-500 hover:text-slate-300 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Routine Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Morning Intel Summary"
              className={`w-full bg-slate-800 border rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 ${
                errors.name ? 'border-red-500' : 'border-slate-700'
              }`}
            />
            {errors.name && (
              <p className="mt-1 text-[10px] text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should Ironclaw do when this runs?"
              rows={2}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>

          {/* Schedule */}
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Schedule <span className="text-red-400">*</span>
            </label>
            {/* Preset dropdown */}
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 mb-2"
            >
              {CRON_PRESETS.map((preset) => (
                <option key={preset.label} value={preset.value}>
                  {preset.label}
                </option>
              ))}
              {/* Show custom option if user typed something not in presets */}
              {selectedPreset === '' && (
                <option value="">Custom</option>
              )}
            </select>
            {/* Cron input */}
            <input
              type="text"
              value={cron}
              onChange={(e) => handleCronChange(e.target.value)}
              placeholder="0 8 * * *"
              className={`w-full bg-slate-800 border rounded px-3 py-2 text-sm text-slate-200 font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500 ${
                errors.cron ? 'border-red-500' : 'border-slate-700'
              }`}
            />
            {errors.cron && (
              <p className="mt-1 text-[10px] text-red-400">{errors.cron}</p>
            )}
            {/* Schedule description */}
            <p className="mt-1.5 text-[10px] text-slate-500">
              {getScheduleDescription()}
            </p>
            <p className="text-[10px] text-slate-600 mt-0.5">
              Format: minute hour day-of-month month day-of-week
            </p>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-300">Enable Routine</p>
              <p className="text-[10px] text-slate-500">Active routines run on schedule</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              onClick={() => setEnabled((prev) => !prev)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
                enabled ? 'bg-blue-600' : 'bg-slate-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform ${
                  enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-700">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
          >
            {routine ? 'Save Changes' : 'Add Routine'}
          </button>
        </div>
      </div>
    </div>
  );
}
