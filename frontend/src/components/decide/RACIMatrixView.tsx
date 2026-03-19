/**
 * RACIMatrixView
 *
 * Displays the RACI matrix for decisions:
 *   Rows    = decision types
 *   Columns = positions (commander, xo, j2, j3, j4, j5, j6)
 *   Cells   = R / A / C / I badge
 *
 * Commander/XO roles can click cells to edit assignments.
 *
 * Phase 53 Plan 05.
 */

import { useState } from 'react';
import type { RACIAssignment } from '../../lib/decision-service.js';
import { decisionApiService } from '../../lib/decision-service.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const POSITIONS = ['commander', 'xo', 'j2', 'j3', 'j4', 'j5', 'j6'] as const;
const RACI_ROLES = ['R', 'A', 'C', 'I', '-'] as const;
type RaciRole = 'R' | 'A' | 'C' | 'I' | '-';

const RACI_CONFIG: Record<RaciRole, { color: string; bg: string; label: string }> = {
  R: { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Responsible' },
  A: { color: '#10b981', bg: 'rgba(16,185,129,0.15)', label: 'Accountable' },
  C: { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)', label: 'Consulted' },
  I: { color: '#94a3b8', bg: 'rgba(148,163,184,0.15)', label: 'Informed' },
  '-': { color: '#475569', bg: 'transparent', label: 'Not involved' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a lookup: decision_type → position → raci_role */
function buildMatrix(assignments: RACIAssignment[]): Record<string, Record<string, RaciRole>> {
  const matrix: Record<string, Record<string, RaciRole>> = {};
  for (const a of assignments) {
    if (!matrix[a.decision_type]) matrix[a.decision_type] = {};
    matrix[a.decision_type][a.position] = a.raci_role as RaciRole;
  }
  return matrix;
}

// ─── RACIMatrixView ───────────────────────────────────────────────────────────

interface RACIMatrixViewProps {
  problemSetId: string;
  raciMatrix: RACIAssignment[];
  userRole?: string | null;
  onRefresh: () => void;
}

export function RACIMatrixView({
  problemSetId,
  raciMatrix,
  userRole,
  onRefresh,
}: RACIMatrixViewProps) {
  const [editingCell, setEditingCell] = useState<{ decisionType: string; position: string } | null>(null);
  const [editValue, setEditValue] = useState<RaciRole>('-');
  const [saving, setSaving] = useState(false);

  const canEdit = userRole === 'commander' || userRole === 'xo';
  const matrix = buildMatrix(raciMatrix);
  const decisionTypes = Array.from(new Set(raciMatrix.map((a) => a.decision_type)));

  if (decisionTypes.length === 0) {
    return (
      <div style={{ color: 'var(--text-secondary, #94a3b8)', padding: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        No RACI assignments found for this problem set.
      </div>
    );
  }

  function startEdit(decisionType: string, position: string) {
    if (!canEdit) return;
    setEditingCell({ decisionType, position });
    setEditValue((matrix[decisionType]?.[position]) ?? '-');
  }

  async function saveEdit() {
    if (!editingCell) return;
    setSaving(true);
    try {
      const role = editValue === '-' ? 'I' : editValue; // Default to I if clearing
      await decisionApiService.updateRACIAssignment(problemSetId, {
        decision_type: editingCell.decisionType,
        position: editingCell.position,
        raci_role: role,
      });
      onRefresh();
    } catch (err) {
      console.error('[RACIMatrixView] Failed to save RACI assignment:', err);
    } finally {
      setSaving(false);
      setEditingCell(null);
    }
  }

  const thStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    fontSize: '0.7rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: 'var(--text-secondary, #94a3b8)',
    background: 'var(--surface-secondary, #1e293b)',
    borderBottom: '1px solid var(--border-color, #334155)',
    whiteSpace: 'nowrap',
  };

  const tdStyle: React.CSSProperties = {
    padding: '0.5rem 0.75rem',
    borderBottom: '1px solid var(--border-color, #334155)',
    textAlign: 'center',
    fontSize: '0.875rem',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left', minWidth: '180px' }}>Decision Type</th>
            {POSITIONS.map((pos) => (
              <th key={pos} style={thStyle}>{pos.toUpperCase()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {decisionTypes.map((dt) => (
            <tr key={dt}>
              <td style={{ ...tdStyle, textAlign: 'left', color: 'var(--text-primary, #e2e8f0)', fontWeight: 500 }}>
                {dt.replace(/_/g, ' ')}
              </td>
              {POSITIONS.map((pos) => {
                const role: RaciRole = (matrix[dt]?.[pos]) ?? '-';
                const cfg = RACI_CONFIG[role];
                const isEditing =
                  editingCell?.decisionType === dt && editingCell?.position === pos;

                return (
                  <td key={pos} style={tdStyle}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', justifyContent: 'center' }}>
                        <select
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value as RaciRole)}
                          style={{
                            padding: '0.125rem 0.25rem',
                            fontSize: '0.75rem',
                            background: 'var(--surface-primary, #0f172a)',
                            color: 'var(--text-primary, #e2e8f0)',
                            border: '1px solid var(--border-color, #334155)',
                            borderRadius: '0.25rem',
                          }}
                        >
                          {RACI_ROLES.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <button
                          onClick={saveEdit}
                          disabled={saving}
                          style={{ fontSize: '0.7rem', padding: '0.125rem 0.375rem', cursor: 'pointer', color: '#10b981', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '0.25rem' }}
                        >
                          {saving ? '...' : 'OK'}
                        </button>
                        <button
                          onClick={() => setEditingCell(null)}
                          style={{ fontSize: '0.7rem', padding: '0.125rem 0.375rem', cursor: 'pointer', color: '#94a3b8', background: 'transparent', border: '1px solid var(--border-color, #334155)', borderRadius: '0.25rem' }}
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <span
                        onClick={() => startEdit(dt, pos)}
                        title={canEdit ? `Click to edit — ${cfg.label}` : cfg.label}
                        style={{
                          display: 'inline-block',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          color: cfg.color,
                          background: cfg.bg,
                          cursor: canEdit ? 'pointer' : 'default',
                          minWidth: '1.75rem',
                          textAlign: 'center',
                        }}
                      >
                        {role}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {canEdit && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)' }}>
          Click any cell to edit RACI assignment (R = Responsible, A = Accountable, C = Consulted, I = Informed)
        </div>
      )}
    </div>
  );
}
