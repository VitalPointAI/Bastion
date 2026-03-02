/**
 * ManageRolesModal
 *
 * Phase 16 Plan 04: Human|AI|Disabled three-state role assignment toggle.
 *
 * Displayed in the Staff Workspace when the controller opens role management.
 * Each enabled role row shows a three-state toggle: Human | AI | Disabled.
 * Changes are applied optimistically then persisted via updateRoleAssignments.
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { RoleAssignment } from '../../types/exercise';
import { STAFF_ROLE_CONFIG } from '../../types/exercise';
import './ManageRolesModal.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface ManageRolesModalProps {
  scenarioId: string;
  enabledRoles: string[];
  initialAssignments?: Record<string, RoleAssignment>;
  onSave?: (assignments: Record<string, RoleAssignment>) => void;
  onClose: () => void;
}

// ─── RoleAssignmentToggle ──────────────────────────────────────────────────────

interface RoleAssignmentToggleProps {
  roleKey: string;
  current: RoleAssignment;
  onChange: (mode: RoleAssignment) => void;
  saving?: boolean;
}

function RoleAssignmentToggle({ roleKey, current, onChange, saving }: RoleAssignmentToggleProps) {
  return (
    <div
      className="role-assignment-toggle"
      role="group"
      aria-label={`Assignment for ${roleKey}`}
    >
      {(['human', 'ai', 'disabled'] as const).map((mode) => (
        <button
          key={mode}
          className={`toggle-btn${current === mode ? ' active' : ''} toggle-${mode}`}
          onClick={() => onChange(mode)}
          aria-pressed={current === mode}
          disabled={saving}
          type="button"
        >
          {mode === 'human' ? 'Human' : mode === 'ai' ? 'AI' : 'Disabled'}
        </button>
      ))}
    </div>
  );
}

// ─── ManageRolesModal ──────────────────────────────────────────────────────────

export function ManageRolesModal({
  scenarioId,
  enabledRoles,
  initialAssignments,
  onSave,
  onClose,
}: ManageRolesModalProps) {
  const [assignments, setAssignments] = useState<Record<string, RoleAssignment>>(
    initialAssignments ?? {}
  );
  const [loading, setLoading] = useState(!initialAssignments);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load current assignments if not provided via props
  useEffect(() => {
    if (initialAssignments) return;
    setLoading(true);
    exerciseService
      .getRoleAssignments(scenarioId)
      .then((data) => {
        setAssignments(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load role assignments');
        setLoading(false);
      });
  }, [scenarioId, initialAssignments]);

  function handleToggleChange(roleKey: string, mode: RoleAssignment) {
    setAssignments((prev) => ({ ...prev, [roleKey]: mode }));
    setSaveSuccess(false);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await exerciseService.updateRoleAssignments(scenarioId, assignments);
      setAssignments(updated);
      setSaveSuccess(true);
      onSave?.(updated);
      // Brief success flash then close
      setTimeout(() => {
        onClose();
      }, 800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save role assignments');
    } finally {
      setSaving(false);
    }
  }

  // Count AI-assigned roles for sub-label context
  const aiCount = Object.values(assignments).filter((v) => v === 'ai').length;

  return (
    <div
      className="manage-roles-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Manage Role Assignments"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="manage-roles-modal">
        {/* Header */}
        <div className="mrm-header">
          <div className="mrm-title-block">
            <h2 className="mrm-title">Role Assignments</h2>
            <p className="mrm-subtitle">
              Set each role to Human, AI, or Disabled. AI-assigned roles will use an agent team to
              generate products autonomously.
            </p>
          </div>
          <button className="mrm-close-btn" onClick={onClose} type="button" aria-label="Close">
            ×
          </button>
        </div>

        {/* Body */}
        <div className="mrm-body">
          {loading && (
            <div className="mrm-loading">Loading role assignments...</div>
          )}

          {error && (
            <div className="mrm-error" role="alert">
              {error}
            </div>
          )}

          {!loading && (
            <div className="mrm-roles-list">
              {enabledRoles.map((roleKey) => {
                const roleEntry = STAFF_ROLE_CONFIG[roleKey];
                const currentMode: RoleAssignment = assignments[roleKey] ?? 'human';
                return (
                  <div key={roleKey} className="mrm-role-row">
                    <div className="mrm-role-info">
                      <span className="mrm-role-label">
                        {roleEntry?.label ?? roleKey}
                      </span>
                      {currentMode === 'ai' && (
                        <span className="mrm-role-ai-hint">
                          AI-assigned — agent team will generate products
                        </span>
                      )}
                    </div>
                    <RoleAssignmentToggle
                      roleKey={roleKey}
                      current={currentMode}
                      onChange={(mode) => handleToggleChange(roleKey, mode)}
                      saving={saving}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mrm-footer">
          {aiCount > 0 && (
            <span className="mrm-ai-summary">
              {aiCount} role{aiCount !== 1 ? 's' : ''} assigned to AI
            </span>
          )}
          {saveSuccess && (
            <span className="mrm-save-success">Saved</span>
          )}
          <div className="mrm-footer-actions">
            <button
              className="mrm-btn mrm-btn-cancel"
              onClick={onClose}
              type="button"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              className="mrm-btn mrm-btn-save"
              onClick={handleSave}
              type="button"
              disabled={saving || loading}
            >
              {saving ? 'Saving...' : 'Save Assignments'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
