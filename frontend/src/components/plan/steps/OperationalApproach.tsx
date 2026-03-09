/**
 * OperationalApproach — Step 2 content component
 *
 * Phase 36 Plan 03: Lines of effort, objectives hierarchy, force apportionment,
 * and constraints/restraints/assumptions/limitations with auto-save.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { sgService } from '../../../lib/strategic-guidance-service.ts';
import { ForceApportionmentPanel } from '../ForceApportionmentPanel.tsx';
import { ConstraintManager } from '../ConstraintManager.tsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LineOfEffort {
  id: string;
  name: string;
  description: string;
  linkedObjectiveIds: string[];
  allocatedForces: never[];
}

interface ObjectiveNode {
  id: string;
  parentId?: string;
  title: string;
  description: string;
}

interface ConstraintEntry {
  id: string;
  type: 'constraint' | 'restraint' | 'assumption' | 'limitation';
  description: string;
  sourceAuthority: string;
  applicability: 'standing' | 'phase_bounded';
  applicablePhases?: string[];
  inheritedFrom?: string;
  canDelete: boolean;
}

interface Assumption {
  id: string;
  description: string;
  validityConditions: string[];
  isValid: boolean;
}

interface OperationalApproachContent {
  linesOfEffort: LineOfEffort[];
  objectivesHierarchy: ObjectiveNode[];
  forceApportionment: never[];
  constraints: ConstraintEntry[];
  restraints: ConstraintEntry[];
  assumptions: Assumption[];
  limitations: ConstraintEntry[];
}

const EMPTY_CONTENT: OperationalApproachContent = {
  linesOfEffort: [],
  objectivesHierarchy: [],
  forceApportionment: [],
  constraints: [],
  restraints: [],
  assumptions: [],
  limitations: [],
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.6)',
  borderRadius: '0.375rem',
  padding: '1rem',
  marginBottom: '1rem',
};

const sectionHeaderStyle: React.CSSProperties = {
  fontSize: '0.95rem',
  fontWeight: 600,
  color: '#e5e7eb',
  marginBottom: '0.75rem',
  paddingBottom: '0.5rem',
  borderBottom: '1px solid rgba(107, 114, 128, 0.3)',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.8rem',
  fontWeight: 500,
  color: '#9ca3af',
  marginBottom: '0.25rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  padding: '0.375rem 0.5rem',
  color: '#d1d5db',
  fontSize: '0.85rem',
  fontFamily: 'inherit',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '3rem',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  padding: '0.5rem',
  color: '#d1d5db',
  fontSize: '0.85rem',
  resize: 'vertical',
  fontFamily: 'inherit',
};

const addBtnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
  cursor: 'pointer',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '0.125rem 0.375rem',
  fontSize: '0.7rem',
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '0.25rem',
  color: '#fca5a5',
  cursor: 'pointer',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ObjectiveTree({
  objectives,
  onChange,
}: {
  objectives: ObjectiveNode[];
  onChange: (updated: ObjectiveNode[]) => void;
}) {
  // Build tree structure for indentation
  const getDepth = (obj: ObjectiveNode): number => {
    if (!obj.parentId) return 0;
    const parent = objectives.find((o) => o.id === obj.parentId);
    return parent ? getDepth(parent) + 1 : 0;
  };

  // Sort: top-level first, then children grouped under parents
  const sortedObjectives = [...objectives].sort((a, b) => {
    const depthA = getDepth(a);
    const depthB = getDepth(b);
    if (depthA !== depthB) return depthA - depthB;
    return 0;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {sortedObjectives.map((obj) => {
        const depth = getDepth(obj);
        const idx = objectives.findIndex((o) => o.id === obj.id);

        return (
          <div
            key={obj.id}
            style={{
              marginLeft: `${depth * 1.5}rem`,
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderRadius: '0.25rem',
              padding: '0.5rem',
              borderLeft: depth === 0
                ? '3px solid rgba(59, 130, 246, 0.5)'
                : '3px solid rgba(107, 114, 128, 0.3)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={obj.title}
                  placeholder="Objective title..."
                  onChange={(e) => {
                    const updated = [...objectives];
                    updated[idx] = { ...obj, title: e.target.value };
                    onChange(updated);
                  }}
                />
                <select
                  style={{ ...inputStyle, width: 'auto', minWidth: '120px', cursor: 'pointer' }}
                  value={obj.parentId ?? ''}
                  onChange={(e) => {
                    const updated = [...objectives];
                    updated[idx] = { ...obj, parentId: e.target.value || undefined };
                    onChange(updated);
                  }}
                >
                  <option value="">Top-level</option>
                  {objectives
                    .filter((o) => o.id !== obj.id)
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        Under: {o.title || '(untitled)'}
                      </option>
                    ))}
                </select>
              </div>
              <button
                style={{ ...removeBtnStyle, marginLeft: '0.375rem' }}
                onClick={() => onChange(objectives.filter((_, i) => i !== idx))}
              >
                Remove
              </button>
            </div>
            <textarea
              style={{ ...textareaStyle, minHeight: '2rem' }}
              value={obj.description}
              placeholder="Describe the objective..."
              onChange={(e) => {
                const updated = [...objectives];
                updated[idx] = { ...obj, description: e.target.value };
                onChange(updated);
              }}
            />
          </div>
        );
      })}
      <button
        style={{ ...addBtnStyle, alignSelf: 'flex-start' }}
        onClick={() =>
          onChange([
            ...objectives,
            { id: crypto.randomUUID(), title: '', description: '' },
          ])
        }
      >
        + Add Objective
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface OperationalApproachProps {
  problemSetId: string;
  instanceId: string;
}

export function OperationalApproach({ problemSetId: _problemSetId, instanceId }: OperationalApproachProps) {
  const [content, setContent] = useState<OperationalApproachContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load step content
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await sgService.getStepContent(instanceId, 'operational_approach');
        if (!cancelled && result.content) {
          setContent(result.content as OperationalApproachContent);
        }
      } catch {
        // No content yet
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback(
    (updated: OperationalApproachContent) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await sgService.saveStepContent(instanceId, 'operational_approach', updated);
        } catch (err) {
          console.error('[OperationalApproach] Auto-save failed:', err);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [instanceId],
  );

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateContent = useCallback(
    (patch: Partial<OperationalApproachContent>) => {
      setContent((prev) => {
        const updated = { ...prev, ...patch };
        scheduleAutoSave(updated);
        return updated;
      });
    },
    [scheduleAutoSave],
  );

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
        Loading operational approach...
      </div>
    );
  }

  // Combine all constraint types for ConstraintManager
  const allConstraintEntries: ConstraintEntry[] = [
    ...content.constraints,
    ...content.restraints.map((r) => ({ ...r, type: 'restraint' as const })),
    ...content.limitations,
  ];

  const handleConstraintChange = (updated: ConstraintEntry[]) => {
    const constraints = updated.filter((c) => c.type === 'constraint');
    const restraints = updated.filter((c) => c.type === 'restraint');
    const limitations = updated.filter((c) => c.type === 'limitation');
    // Assumptions from ConstraintManager are typed as 'assumption'
    const assumptionEntries = updated.filter((c) => c.type === 'assumption');
    const assumptions: Assumption[] = assumptionEntries.map((a) => ({
      id: a.id,
      description: a.description,
      validityConditions: [],
      isValid: true,
    }));
    updateContent({ constraints, restraints, assumptions, limitations });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Save indicator */}
      {saving && (
        <div style={{ fontSize: '0.7rem', color: '#60a5fa', textAlign: 'right' }}>
          Saving...
        </div>
      )}

      {/* 1. Lines of Effort */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Lines of Effort</h3>
        {content.linesOfEffort.map((loe, idx) => (
          <div
            key={loe.id}
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderRadius: '0.25rem',
              padding: '0.625rem',
              marginBottom: '0.5rem',
              borderLeft: '3px solid rgba(59, 130, 246, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label style={{ ...labelStyle, margin: 0 }}>LOE {idx + 1}</label>
              <button
                style={removeBtnStyle}
                onClick={() =>
                  updateContent({
                    linesOfEffort: content.linesOfEffort.filter((_, i) => i !== idx),
                  })
                }
              >
                Remove
              </button>
            </div>
            <div style={{ marginBottom: '0.375rem' }}>
              <label style={labelStyle}>Name</label>
              <input
                style={inputStyle}
                value={loe.name}
                placeholder="e.g., Deter aggression in the Indo-Pacific"
                onChange={(e) => {
                  const updated = [...content.linesOfEffort];
                  updated[idx] = { ...loe, name: e.target.value };
                  updateContent({ linesOfEffort: updated });
                }}
              />
            </div>
            <div style={{ marginBottom: '0.375rem' }}>
              <label style={labelStyle}>Description</label>
              <textarea
                style={textareaStyle}
                value={loe.description}
                placeholder="Describe the line of effort..."
                onChange={(e) => {
                  const updated = [...content.linesOfEffort];
                  updated[idx] = { ...loe, description: e.target.value };
                  updateContent({ linesOfEffort: updated });
                }}
              />
            </div>
            <div>
              <label style={labelStyle}>Linked Objective IDs</label>
              <input
                style={inputStyle}
                value={loe.linkedObjectiveIds.join(', ')}
                placeholder="Comma-separated objective IDs..."
                onChange={(e) => {
                  const ids = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                  const updated = [...content.linesOfEffort];
                  updated[idx] = { ...loe, linkedObjectiveIds: ids };
                  updateContent({ linesOfEffort: updated });
                }}
              />
            </div>
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            updateContent({
              linesOfEffort: [
                ...content.linesOfEffort,
                {
                  id: crypto.randomUUID(),
                  name: '',
                  description: '',
                  linkedObjectiveIds: [],
                  allocatedForces: [],
                },
              ],
            })
          }
        >
          + Add Line of Effort
        </button>
      </div>

      {/* 2. Objectives Hierarchy */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Objectives Hierarchy</h3>
        <ObjectiveTree
          objectives={content.objectivesHierarchy}
          onChange={(objectives) => updateContent({ objectivesHierarchy: objectives })}
        />
      </div>

      {/* 3. Force Apportionment */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Force Apportionment</h3>
        <ForceApportionmentPanel
          instanceId={instanceId}
          linesOfEffort={content.linesOfEffort}
          onAllocationsChange={() => {
            // Refresh step content after force changes
          }}
        />
      </div>

      {/* 4. Constraints & Restraints */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Constraints, Restraints, Assumptions & Limitations</h3>
        <ConstraintManager
          constraints={allConstraintEntries}
          onChange={handleConstraintChange}
        />
      </div>
    </div>
  );
}
