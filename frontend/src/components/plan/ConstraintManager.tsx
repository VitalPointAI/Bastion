/**
 * ConstraintManager
 *
 * Phase 36 Plan 03: Reusable constraint/restraint/assumption/limitation editor.
 * Groups entries by JP 5-0 doctrinal type with color coding.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ConstraintType = 'constraint' | 'restraint' | 'assumption' | 'limitation';
type ConstraintApplicability = 'standing' | 'phase_bounded';

interface ConstraintEntry {
  id: string;
  type: ConstraintType;
  description: string;
  sourceAuthority: string;
  applicability: ConstraintApplicability;
  applicablePhases?: string[];
  inheritedFrom?: string;
  canDelete: boolean;
}

interface ConstraintManagerProps {
  constraints: ConstraintEntry[];
  onChange: (updated: ConstraintEntry[]) => void;
  readOnlyInherited?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GROUPS: { type: ConstraintType; label: string; subtitle: string; borderColor: string }[] = [
  { type: 'constraint', label: 'Constraints', subtitle: 'Must Do', borderColor: 'rgba(59, 130, 246, 0.6)' },
  { type: 'restraint', label: 'Restraints', subtitle: 'Must Not Do', borderColor: 'rgba(239, 68, 68, 0.6)' },
  { type: 'assumption', label: 'Assumptions', subtitle: '', borderColor: 'rgba(234, 179, 8, 0.6)' },
  { type: 'limitation', label: 'Limitations', subtitle: '', borderColor: 'rgba(107, 114, 128, 0.6)' },
];

const PHASES = ['Competition', 'Crisis', 'Conflict', 'Transition', 'Negotiation'];

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  marginBottom: '1rem',
};

const groupHeaderStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#d1d5db',
  marginBottom: '0.5rem',
  paddingBottom: '0.25rem',
  borderBottom: '1px solid rgba(107, 114, 128, 0.2)',
};

const entryStyle = (borderColor: string): React.CSSProperties => ({
  backgroundColor: 'rgba(17, 24, 39, 0.5)',
  borderLeft: `3px solid ${borderColor}`,
  borderRadius: '0.25rem',
  padding: '0.625rem',
  marginBottom: '0.375rem',
});

const labelStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: 500,
  color: '#9ca3af',
  marginBottom: '0.125rem',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '3rem',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  padding: '0.375rem 0.5rem',
  color: '#d1d5db',
  fontSize: '0.8rem',
  resize: 'vertical',
  fontFamily: 'inherit',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  padding: '0.25rem 0.5rem',
  color: '#d1d5db',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
};

const addBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.7rem',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
  cursor: 'pointer',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '0.125rem 0.375rem',
  fontSize: '0.65rem',
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '0.25rem',
  color: '#fca5a5',
  cursor: 'pointer',
};

const inheritedBadgeStyle: React.CSSProperties = {
  fontSize: '0.65rem',
  padding: '0.125rem 0.375rem',
  backgroundColor: 'rgba(107, 114, 128, 0.2)',
  border: '1px solid rgba(107, 114, 128, 0.3)',
  borderRadius: '0.25rem',
  color: '#9ca3af',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ConstraintManager({
  constraints,
  onChange,
  readOnlyInherited = true,
}: ConstraintManagerProps) {
  const updateEntry = (id: string, patch: Partial<ConstraintEntry>) => {
    onChange(
      constraints.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  };

  const removeEntry = (id: string) => {
    onChange(constraints.filter((c) => c.id !== id));
  };

  const addEntry = (type: ConstraintType) => {
    const newEntry: ConstraintEntry = {
      id: crypto.randomUUID(),
      type,
      description: '',
      sourceAuthority: '',
      applicability: 'standing',
      canDelete: true,
    };
    onChange([...constraints, newEntry]);
  };

  return (
    <div>
      {GROUPS.map((group) => {
        const groupEntries = constraints.filter((c) => c.type === group.type);

        return (
          <div key={group.type} style={sectionStyle}>
            <h4 style={groupHeaderStyle}>
              {group.label}
              {group.subtitle && (
                <span style={{ fontWeight: 400, fontSize: '0.75rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                  ({group.subtitle})
                </span>
              )}
              <span style={{ fontWeight: 400, fontSize: '0.7rem', color: '#6b7280', marginLeft: '0.5rem' }}>
                ({groupEntries.length})
              </span>
            </h4>

            {groupEntries.map((entry) => {
              const isInherited = entry.inheritedFrom !== undefined;
              const isReadOnly = isInherited && readOnlyInherited;

              return (
                <div key={entry.id} style={entryStyle(group.borderColor)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {isInherited && (
                        <span style={inheritedBadgeStyle}>
                          Inherited from {entry.inheritedFrom}
                        </span>
                      )}
                    </div>
                    {entry.canDelete && (
                      <button style={removeBtnStyle} onClick={() => removeEntry(entry.id)}>
                        Remove
                      </button>
                    )}
                  </div>

                  {/* Description */}
                  <div style={{ marginBottom: '0.375rem' }}>
                    <label style={labelStyle}>Description</label>
                    <textarea
                      style={textareaStyle}
                      value={entry.description}
                      placeholder={`Describe the ${group.type}...`}
                      readOnly={isReadOnly}
                      onChange={(e) => updateEntry(entry.id, { description: e.target.value })}
                    />
                  </div>

                  {/* Source Authority + Applicability row */}
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={labelStyle}>Source Authority</label>
                      <input
                        style={inputStyle}
                        value={entry.sourceAuthority}
                        placeholder="e.g., SECDEF, CCDR"
                        readOnly={isReadOnly}
                        onChange={(e) => updateEntry(entry.id, { sourceAuthority: e.target.value })}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: '150px' }}>
                      <label style={labelStyle}>Applicability</label>
                      <select
                        style={{ ...inputStyle, cursor: isReadOnly ? 'default' : 'pointer' }}
                        value={entry.applicability}
                        disabled={isReadOnly}
                        onChange={(e) => {
                          const applicability = e.target.value as ConstraintApplicability;
                          updateEntry(entry.id, {
                            applicability,
                            applicablePhases: applicability === 'standing' ? undefined : entry.applicablePhases ?? [],
                          });
                        }}
                      >
                        <option value="standing">Standing</option>
                        <option value="phase_bounded">Phase Bounded</option>
                      </select>
                    </div>
                  </div>

                  {/* Phase selection (if phase_bounded) */}
                  {entry.applicability === 'phase_bounded' && (
                    <div style={{ marginTop: '0.375rem' }}>
                      <label style={labelStyle}>Applicable Phases</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                        {PHASES.map((phase) => {
                          const isSelected = entry.applicablePhases?.includes(phase) ?? false;
                          return (
                            <label
                              key={phase}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                fontSize: '0.75rem',
                                color: isSelected ? '#d1d5db' : '#6b7280',
                                cursor: isReadOnly ? 'default' : 'pointer',
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={isReadOnly}
                                onChange={(e) => {
                                  const phases = entry.applicablePhases ?? [];
                                  const updated = e.target.checked
                                    ? [...phases, phase]
                                    : phases.filter((p) => p !== phase);
                                  updateEntry(entry.id, { applicablePhases: updated });
                                }}
                              />
                              {phase}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            <button style={addBtnStyle} onClick={() => addEntry(group.type)}>
              + Add {group.label.slice(0, -1)}
            </button>
          </div>
        );
      })}
    </div>
  );
}
