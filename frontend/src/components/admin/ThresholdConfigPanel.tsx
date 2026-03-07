/**
 * ThresholdConfigPanel Component
 *
 * Phase 31 Plan 05: Admin-configurable thresholds per category, agent, and team.
 * Inline editing with validation rules.
 */

import { useState, useEffect, useCallback } from 'react';
import { validationService } from '../../lib/validation-service';
import type { ThresholdConfigRow } from '../../lib/validation-service';

interface EditingCell {
  id: string;
  field: string;
  value: string;
}

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  category: 'Category',
  agent: 'Agent',
  team: 'Team',
};

export function ThresholdConfigPanel() {
  const [thresholds, setThresholds] = useState<ThresholdConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // New threshold form state
  const [newThreshold, setNewThreshold] = useState({
    scope_type: 'global' as 'global' | 'category' | 'agent' | 'team',
    scope_id: '',
    category: 'determinism',
    warning_threshold: '0.80',
    critical_threshold: '0.60',
    grace_period_runs: '3',
    immediate_disable: false,
  });

  const fetchThresholds = useCallback(async () => {
    try {
      const data = await validationService.getThresholds();
      setThresholds(data);
    } catch (err) {
      console.error('[ThresholdConfigPanel] Failed to load:', err);
      setError(err instanceof Error ? err.message : 'Failed to load thresholds');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  const handleCellClick = (id: string, field: string, currentValue: string | number | boolean) => {
    setEditing({ id, field, value: String(currentValue) });
  };

  const handleCellSave = async () => {
    if (!editing) return;

    const threshold = thresholds.find((t) => t.id === editing.id);
    if (!threshold) return;

    // Build the updated record
    const updated = { ...threshold };
    const field = editing.field as keyof ThresholdConfigRow;

    if (field === 'warning_threshold' || field === 'critical_threshold') {
      const numVal = parseFloat(editing.value);
      if (isNaN(numVal) || numVal < 0 || numVal > 1) {
        setError('Threshold must be between 0 and 1');
        return;
      }
      (updated as Record<string, unknown>)[field] = numVal;
    } else if (field === 'grace_period_runs') {
      const numVal = parseInt(editing.value, 10);
      if (isNaN(numVal) || numVal < 0) {
        setError('Grace period must be >= 0');
        return;
      }
      updated.grace_period_runs = numVal;
    } else if (field === 'immediate_disable') {
      updated.immediate_disable = editing.value === 'true';
    }

    // Validate: warning must be > critical
    if (updated.warning_threshold <= updated.critical_threshold) {
      setError('Warning threshold must be greater than critical threshold');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await validationService.updateThreshold({
        scope_type: updated.scope_type,
        scope_id: updated.scope_id,
        category: updated.category,
        warning_threshold: updated.warning_threshold,
        critical_threshold: updated.critical_threshold,
        grace_period_runs: updated.grace_period_runs,
        immediate_disable: updated.immediate_disable,
        updated_by: 'admin',
      });
      await fetchThresholds();
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save threshold');
    } finally {
      setSaving(false);
    }
  };

  const handleAddThreshold = async () => {
    const warning = parseFloat(newThreshold.warning_threshold);
    const critical = parseFloat(newThreshold.critical_threshold);
    const grace = parseInt(newThreshold.grace_period_runs, 10);

    if (isNaN(warning) || warning < 0 || warning > 1) {
      setError('Warning threshold must be between 0 and 1');
      return;
    }
    if (isNaN(critical) || critical < 0 || critical > 1) {
      setError('Critical threshold must be between 0 and 1');
      return;
    }
    if (warning <= critical) {
      setError('Warning threshold must be greater than critical threshold');
      return;
    }
    if (isNaN(grace) || grace < 0) {
      setError('Grace period must be >= 0');
      return;
    }

    setError(null);
    setSaving(true);

    try {
      await validationService.updateThreshold({
        scope_type: newThreshold.scope_type,
        scope_id: newThreshold.scope_id || null,
        category: newThreshold.category,
        warning_threshold: warning,
        critical_threshold: critical,
        grace_period_runs: grace,
        immediate_disable: newThreshold.immediate_disable,
        updated_by: 'admin',
      });
      await fetchThresholds();
      setShowAddForm(false);
      setNewThreshold({
        scope_type: 'global',
        scope_id: '',
        category: 'determinism',
        warning_threshold: '0.80',
        critical_threshold: '0.60',
        grace_period_runs: '3',
        immediate_disable: false,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create threshold');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-200">
          Threshold Configuration
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="text-xs px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors"
        >
          {showAddForm ? 'Cancel' : 'Add Threshold'}
        </button>
      </div>

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2 mb-3">
          {error}
        </div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="border border-gray-700/50 rounded p-3 mb-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400">Scope Type</label>
              <select
                value={newThreshold.scope_type}
                onChange={(e) =>
                  setNewThreshold({ ...newThreshold, scope_type: e.target.value as 'global' | 'category' | 'agent' | 'team' })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
              >
                <option value="global">Global</option>
                <option value="category">Category</option>
                <option value="agent">Agent</option>
                <option value="team">Team</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Scope ID</label>
              <input
                type="text"
                value={newThreshold.scope_id}
                onChange={(e) =>
                  setNewThreshold({ ...newThreshold, scope_id: e.target.value })
                }
                placeholder="Leave empty for global"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Category</label>
              <select
                value={newThreshold.category}
                onChange={(e) =>
                  setNewThreshold({ ...newThreshold, category: e.target.value })
                }
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
              >
                <option value="determinism">Determinism</option>
                <option value="reliability">Reliability</option>
                <option value="authority">Authority</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">Grace Period (runs)</label>
              <input
                type="number"
                value={newThreshold.grace_period_runs}
                onChange={(e) =>
                  setNewThreshold({
                    ...newThreshold,
                    grace_period_runs: e.target.value,
                  })
                }
                min="0"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Warning Threshold</label>
              <input
                type="number"
                value={newThreshold.warning_threshold}
                onChange={(e) =>
                  setNewThreshold({
                    ...newThreshold,
                    warning_threshold: e.target.value,
                  })
                }
                step="0.01"
                min="0"
                max="1"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400">Critical Threshold</label>
              <input
                type="number"
                value={newThreshold.critical_threshold}
                onChange={(e) =>
                  setNewThreshold({
                    ...newThreshold,
                    critical_threshold: e.target.value,
                  })
                }
                step="0.01"
                min="0"
                max="1"
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="immediate-disable"
              checked={newThreshold.immediate_disable}
              onChange={(e) =>
                setNewThreshold({
                  ...newThreshold,
                  immediate_disable: e.target.checked,
                })
              }
              className="rounded"
            />
            <label htmlFor="immediate-disable" className="text-xs text-gray-400">
              Immediate Disable (skip grace period)
            </label>
          </div>
          <button
            onClick={handleAddThreshold}
            disabled={saving}
            className="text-xs px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white rounded transition-colors"
          >
            {saving ? 'Saving...' : 'Save Threshold'}
          </button>
        </div>
      )}

      {/* Thresholds table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700/50">
              <th className="text-left py-2 px-2">Scope</th>
              <th className="text-left py-2 px-2">Scope ID</th>
              <th className="text-left py-2 px-2">Category</th>
              <th className="text-right py-2 px-2">Warning</th>
              <th className="text-right py-2 px-2">Critical</th>
              <th className="text-right py-2 px-2">Grace</th>
              <th className="text-center py-2 px-2">Imm. Disable</th>
            </tr>
          </thead>
          <tbody>
            {thresholds.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-gray-500 py-4">
                  No thresholds configured. Add one to get started.
                </td>
              </tr>
            ) : (
              thresholds.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-gray-700/20 hover:bg-gray-700/20"
                >
                  <td className="py-2 px-2 text-gray-300">
                    {SCOPE_LABELS[t.scope_type] || t.scope_type}
                  </td>
                  <td className="py-2 px-2 text-gray-400 truncate max-w-[120px]">
                    {t.scope_id || '--'}
                  </td>
                  <td className="py-2 px-2 text-gray-300">{t.category}</td>
                  <EditableCell
                    value={t.warning_threshold}
                    isEditing={
                      editing?.id === t.id &&
                      editing?.field === 'warning_threshold'
                    }
                    editValue={editing?.value || ''}
                    onStartEdit={() =>
                      handleCellClick(t.id, 'warning_threshold', t.warning_threshold)
                    }
                    onChangeEdit={(v) =>
                      setEditing((prev) => (prev ? { ...prev, value: v } : null))
                    }
                    onSave={handleCellSave}
                    onCancel={() => setEditing(null)}
                    format={(v) => Number(v).toFixed(3)}
                    className="text-yellow-400"
                  />
                  <EditableCell
                    value={t.critical_threshold}
                    isEditing={
                      editing?.id === t.id &&
                      editing?.field === 'critical_threshold'
                    }
                    editValue={editing?.value || ''}
                    onStartEdit={() =>
                      handleCellClick(t.id, 'critical_threshold', t.critical_threshold)
                    }
                    onChangeEdit={(v) =>
                      setEditing((prev) => (prev ? { ...prev, value: v } : null))
                    }
                    onSave={handleCellSave}
                    onCancel={() => setEditing(null)}
                    format={(v) => Number(v).toFixed(3)}
                    className="text-red-400"
                  />
                  <EditableCell
                    value={t.grace_period_runs}
                    isEditing={
                      editing?.id === t.id &&
                      editing?.field === 'grace_period_runs'
                    }
                    editValue={editing?.value || ''}
                    onStartEdit={() =>
                      handleCellClick(t.id, 'grace_period_runs', t.grace_period_runs)
                    }
                    onChangeEdit={(v) =>
                      setEditing((prev) => (prev ? { ...prev, value: v } : null))
                    }
                    onSave={handleCellSave}
                    onCancel={() => setEditing(null)}
                    format={(v) => String(v)}
                    className="text-gray-300"
                  />
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={async () => {
                        setSaving(true);
                        try {
                          await validationService.updateThreshold({
                            scope_type: t.scope_type,
                            scope_id: t.scope_id,
                            category: t.category,
                            warning_threshold: t.warning_threshold,
                            critical_threshold: t.critical_threshold,
                            grace_period_runs: t.grace_period_runs,
                            immediate_disable: !t.immediate_disable,
                            updated_by: 'admin',
                          });
                          await fetchThresholds();
                        } catch (err) {
                          setError(
                            err instanceof Error ? err.message : 'Failed to toggle',
                          );
                        } finally {
                          setSaving(false);
                        }
                      }}
                      className={`w-4 h-4 rounded border ${
                        t.immediate_disable
                          ? 'bg-red-500 border-red-400'
                          : 'bg-gray-700 border-gray-600'
                      }`}
                      title={
                        t.immediate_disable
                          ? 'Immediate disable ON'
                          : 'Immediate disable OFF'
                      }
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditableCell({
  value,
  isEditing,
  editValue,
  onStartEdit,
  onChangeEdit,
  onSave,
  onCancel,
  format,
  className,
}: {
  value: number;
  isEditing: boolean;
  editValue: string;
  onStartEdit: () => void;
  onChangeEdit: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  format: (v: number) => string;
  className: string;
}) {
  if (isEditing) {
    return (
      <td className="py-1 px-2 text-right">
        <input
          type="text"
          value={editValue}
          onChange={(e) => onChangeEdit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          onBlur={onSave}
          autoFocus
          className="w-16 bg-gray-700 border border-blue-500 rounded px-1 py-0.5 text-xs text-right text-gray-200"
        />
      </td>
    );
  }

  return (
    <td
      className={`py-2 px-2 text-right cursor-pointer hover:bg-gray-600/30 ${className}`}
      onClick={onStartEdit}
      title="Click to edit"
    >
      {format(value)}
    </td>
  );
}
