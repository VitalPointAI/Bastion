/**
 * RoutinesTab
 *
 * Phase 60 Plan 06: Scheduled routines and heartbeat directives configuration
 * for the Agent Config panel.
 *
 * Blueprint Phase 5 — Routines enable Ironclaw to perform scheduled tasks:
 *   - Knowledge sync (shared and user-specific)
 *   - Capability updates
 *   - Daily situation briefs
 *   - Custom user-defined routines
 *
 * Sections:
 *   1. Built-in Routines — always available, schedule editable where allowed
 *   2. Custom Routines — user-defined with cron scheduling via RoutineEditor
 *   3. Heartbeat Directives — free-text standing monitoring instructions
 */

import { useState, useCallback } from 'react';
import type { AgentConfig, RoutineSpec } from '../../../types/agent-config.ts';
import { RoutineEditor } from '../components/RoutineEditor.tsx';

// ---------------------------------------------------------------------------
// Built-in routine definitions (mirrors backend BUILT_IN_ROUTINES)
// These are static and only change on deploy — no API call needed.
// ---------------------------------------------------------------------------

interface BuiltInRoutine {
  id: string;
  name: string;
  description: string;
  defaultCron: string | null;
  editable: boolean;
  category: 'knowledge' | 'monitoring' | 'reporting';
}

const BUILT_IN_ROUTINES: BuiltInRoutine[] = [
  {
    id: 'bastion_knowledge_sync',
    name: 'Shared Knowledge Sync',
    description: 'Sync shared workspace data to Ironclaw — problem sets, active operations, available tools, and agent team list.',
    defaultCron: '0 */6 * * *',
    editable: true,
    category: 'knowledge',
  },
  {
    id: 'bastion_user_knowledge_sync',
    name: 'User Knowledge Sync (Login)',
    description: 'Sync user-specific context on login — problem set memberships, recent activity, and assigned tasks. Triggered automatically on session start.',
    defaultCron: null,
    editable: false,
    category: 'knowledge',
  },
  {
    id: 'weekly_capability_update',
    name: 'Weekly Capability Update',
    description: 'Update Ironclaw on available Bastion capabilities — new tools, agent updates, and system changes.',
    defaultCron: '0 9 * * 1',
    editable: true,
    category: 'monitoring',
  },
  {
    id: 'daily_situation_brief',
    name: 'Daily Situation Brief',
    description: 'Generate a morning situation brief summarizing overnight intelligence updates, pending decisions, and priority actions.',
    defaultCron: '0 6 * * *',
    editable: true,
    category: 'reporting',
  },
];

// ---------------------------------------------------------------------------
// Category badge colors
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  knowledge:  'text-emerald-400 bg-emerald-900/20 border-emerald-700/40',
  monitoring: 'text-blue-400 bg-blue-900/20 border-blue-700/40',
  reporting:  'text-amber-400 bg-amber-900/20 border-amber-700/40',
};

// ---------------------------------------------------------------------------
// Human-readable cron descriptions
// ---------------------------------------------------------------------------

function describeCron(cron: string | null): string {
  if (!cron) return 'Triggered on login';
  const presets: Record<string, string> = {
    '0 * * * *':   'Every hour',
    '0 */6 * * *': 'Every 6 hours',
    '0 6 * * *':   'Daily at 06:00',
    '0 8 * * *':   'Daily at 08:00',
    '0 18 * * *':  'Daily at 18:00',
    '0 9 * * 1':   'Weekly — Monday at 09:00',
    '0 9 * * 1,4': 'Mon & Thu at 09:00',
  };
  return presets[cron] ?? cron;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RoutinesTabProps {
  config: AgentConfig;
  updateConfig: (partial: Partial<AgentConfig>) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldGroupProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

function FieldGroup({ label, description, children }: FieldGroupProps) {
  return (
    <div className="mb-5">
      <div className="mb-2">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wide">{label}</p>
        {description && (
          <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoutinesTab({ config, updateConfig }: RoutinesTabProps) {
  const [editingRoutine, setEditingRoutine] = useState<{
    index: number | null;
    routine: RoutineSpec | null;
  } | null>(null);

  // ─── Built-in routine enable/disable state ──────────────────────────────
  // Stored in config as customRoutines entries with matching IDs
  // Built-in routines are tracked by their ID in enabledBuiltInRoutines
  const [enabledBuiltIns, setEnabledBuiltIns] = useState<Record<string, boolean>>(() => {
    const result: Record<string, boolean> = {};
    BUILT_IN_ROUTINES.forEach((r) => {
      // Default enabled for all except the always-on login trigger (editable: false)
      result[r.id] = r.defaultCron !== null;
    });
    return result;
  });

  // ─── Handlers ──────────────────────────────────────────────────────────

  const handleToggleBuiltIn = useCallback((id: string) => {
    setEnabledBuiltIns((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }, []);

  const handleAddRoutine = useCallback(() => {
    setEditingRoutine({ index: null, routine: null });
  }, []);

  const handleEditRoutine = useCallback((index: number, routine: RoutineSpec) => {
    setEditingRoutine({ index, routine });
  }, []);

  const handleDeleteRoutine = useCallback((index: number) => {
    const updated = config.customRoutines.filter((_, i) => i !== index);
    updateConfig({ customRoutines: updated });
  }, [config.customRoutines, updateConfig]);

  const handleToggleCustomRoutine = useCallback((index: number) => {
    const updated = config.customRoutines.map((r, i) =>
      i === index ? { ...r, enabled: !r.enabled } : r,
    );
    updateConfig({ customRoutines: updated });
  }, [config.customRoutines, updateConfig]);

  const handleSaveRoutine = useCallback((routine: RoutineSpec) => {
    if (!editingRoutine) return;
    if (editingRoutine.index !== null) {
      // Edit existing
      const updated = config.customRoutines.map((r, i) =>
        i === editingRoutine.index ? routine : r,
      );
      updateConfig({ customRoutines: updated });
    } else {
      // Add new
      updateConfig({ customRoutines: [...config.customRoutines, routine] });
    }
    setEditingRoutine(null);
  }, [editingRoutine, config.customRoutines, updateConfig]);

  const handleCancelEdit = useCallback(() => {
    setEditingRoutine(null);
  }, []);

  const handleHeartbeatChange = useCallback(
    (value: string) => updateConfig({ heartbeatDirectives: value }),
    [updateConfig],
  );

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-4">
      {/* Built-in Routines */}
      <FieldGroup
        label="Built-in Routines"
        description="Core routines managed by Bastion. Schedules can be adjusted for editable routines."
      >
        <div className="space-y-2">
          {BUILT_IN_ROUTINES.map((routine) => (
            <div
              key={routine.id}
              className="flex items-start gap-3 bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2.5"
            >
              {/* Toggle (only for editable routines with a cron) */}
              <div className="pt-0.5 shrink-0">
                {routine.editable && routine.defaultCron ? (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabledBuiltIns[routine.id]}
                    onClick={() => handleToggleBuiltIn(routine.id)}
                    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      enabledBuiltIns[routine.id] ? 'bg-blue-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${
                        enabledBuiltIns[routine.id] ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                ) : (
                  /* Non-editable — always-on indicator */
                  <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" title="Always active" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-slate-200">{routine.name}</span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${CATEGORY_COLORS[routine.category]}`}>
                    {routine.category}
                  </span>
                  {!routine.editable && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded border text-slate-500 bg-slate-800/40 border-slate-700/40">
                      system
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{routine.description}</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  Schedule: {describeCron(routine.defaultCron)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </FieldGroup>

      {/* Custom Routines */}
      <FieldGroup
        label="Custom Routines"
        description="User-defined scheduled tasks. Create routines for recurring reports, briefings, or monitoring tasks."
      >
        {config.customRoutines.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic mb-2">
            No custom routines configured. Add one below.
          </p>
        ) : (
          <div className="space-y-2 mb-2">
            {config.customRoutines.map((routine, index) => (
              <div
                key={`${routine.name}-${index}`}
                className="flex items-start gap-3 bg-slate-800/50 border border-slate-700/60 rounded-lg px-3 py-2.5"
              >
                {/* Toggle */}
                <div className="pt-0.5 shrink-0">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={routine.enabled}
                    onClick={() => handleToggleCustomRoutine(index)}
                    className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      routine.enabled ? 'bg-blue-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-3 w-3 rounded-full bg-white shadow transform transition-transform ${
                        routine.enabled ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-slate-200">{routine.name}</p>
                  {routine.description && (
                    <p className="text-[10px] text-slate-500 mt-0.5">{routine.description}</p>
                  )}
                  <p className="text-[10px] text-slate-600 mt-1">
                    Schedule: {describeCron(routine.cron)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => handleEditRoutine(index, routine)}
                    className="p-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Edit routine"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteRoutine(index)}
                    className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                    title="Delete routine"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleAddRoutine}
          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Routine
        </button>
      </FieldGroup>

      {/* Heartbeat Directives */}
      <FieldGroup
        label="Heartbeat Directives"
        description="Standing monitoring instructions — tell your Chief of Staff what to watch for proactively."
      >
        <textarea
          value={config.heartbeatDirectives}
          onChange={(e) => handleHeartbeatChange(e.target.value)}
          placeholder={`Enter standing monitoring directives. Example:\n- Alert me when intel reports mention adversary activity in the area of operations.\n- Flag any LOGSTAT below 70% readiness.\n- Notify me if a new SIGINT report references the primary maritime approaches.`}
          rows={5}
          className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
        />
        <p className="mt-1.5 text-[10px] text-slate-500">
          These directives are written into your HEARTBEAT.md and tell Ironclaw what to monitor
          across all intel, planning, and operational data. New items can be added anytime.
        </p>
      </FieldGroup>

      {/* RoutineEditor modal */}
      {editingRoutine !== null && (
        <RoutineEditor
          routine={editingRoutine.routine}
          onSave={handleSaveRoutine}
          onCancel={handleCancelEdit}
        />
      )}
    </div>
  );
}
