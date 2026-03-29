/**
 * StrategicAlignment — Step 2 content component
 *
 * Phase 49 Plan 01: Replaced OperationalApproach in Strategic Guidance.
 * Maps national and political objectives to operational-level ends.
 * CoG analysis and operational approach now live exclusively in Design tab.
 *
 * AI agent (strategic-analyst) proposes linkages between national objectives
 * and operational ends. Staff review, edit, and confirm the alignment mapping.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { sgService } from '../../../lib/strategic-guidance-service.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AlignmentLinkage {
  id: string;
  nationalObjective: string;
  operationalEnd: string;
  rationale: string;
}

interface AlignmentGap {
  id: string;
  nationalObjective: string;
  gapDescription: string;
}

interface StrategicAlignmentContent {
  nationalObjectives: string[];
  linkages: AlignmentLinkage[];
  gaps: AlignmentGap[];
  alignmentConfirmed: boolean;
  confirmedAt?: string;
  confirmedBy?: string;
}

const EMPTY_CONTENT: StrategicAlignmentContent = {
  nationalObjectives: [],
  linkages: [],
  gaps: [],
  alignmentConfirmed: false,
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

function NationalObjectivesList({
  objectives,
  onChange,
}: {
  objectives: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {objectives.length === 0 && (
        <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: 0 }}>
          No national objectives added. Add from strategic documents or type directly.
        </p>
      )}
      {objectives.map((obj, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <div
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              minWidth: '1.5rem',
              textAlign: 'right',
            }}
          >
            {idx + 1}.
          </div>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={obj}
            placeholder="e.g., Maintain stability in the operational theater..."
            onChange={(e) => {
              const updated = [...objectives];
              updated[idx] = e.target.value;
              onChange(updated);
            }}
          />
          <button
            style={removeBtnStyle}
            onClick={() => onChange(objectives.filter((_, i) => i !== idx))}
          >
            X
          </button>
        </div>
      ))}
      <button
        style={{ ...addBtnStyle, alignSelf: 'flex-start' }}
        onClick={() => onChange([...objectives, ''])}
      >
        + Add Objective
      </button>
    </div>
  );
}

function LinkageRow({
  linkage,
  index,
  nationalObjectives,
  onChange,
  onRemove,
}: {
  linkage: AlignmentLinkage;
  index: number;
  nationalObjectives: string[];
  onChange: (updated: AlignmentLinkage) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '0.25rem',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        borderLeft: '3px solid rgba(59, 130, 246, 0.4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <label style={{ ...labelStyle, margin: 0 }}>Linkage {index + 1}</label>
        <button style={removeBtnStyle} onClick={onRemove}>
          Remove
        </button>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>National Objective</label>
          {nationalObjectives.length > 0 ? (
            <select
              style={{ ...inputStyle, cursor: 'pointer' }}
              value={linkage.nationalObjective}
              onChange={(e) => onChange({ ...linkage, nationalObjective: e.target.value })}
            >
              <option value="">-- Select national objective --</option>
              {nationalObjectives.map((obj, i) => (
                <option key={i} value={obj}>
                  {obj || `Objective ${i + 1}`}
                </option>
              ))}
              <option value="__custom__">Custom / Type directly...</option>
            </select>
          ) : (
            <input
              style={inputStyle}
              value={linkage.nationalObjective}
              placeholder="National or political objective..."
              onChange={(e) => onChange({ ...linkage, nationalObjective: e.target.value })}
            />
          )}
        </div>

        <div style={{ flex: 1, minWidth: '200px' }}>
          <label style={labelStyle}>Operational End</label>
          <input
            style={inputStyle}
            value={linkage.operationalEnd}
            placeholder="Operational-level end or condition..."
            onChange={(e) => onChange({ ...linkage, operationalEnd: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label style={labelStyle}>Rationale</label>
        <textarea
          style={{ ...textareaStyle, minHeight: '2.5rem' }}
          value={linkage.rationale}
          placeholder="How does this operational end support the national objective?"
          onChange={(e) => onChange({ ...linkage, rationale: e.target.value })}
        />
      </div>
    </div>
  );
}

function GapCard({
  gap,
  index,
  onChange,
  onRemove,
}: {
  gap: AlignmentGap;
  index: number;
  onChange: (updated: AlignmentGap) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        borderRadius: '0.25rem',
        padding: '0.75rem',
        marginBottom: '0.5rem',
        borderLeft: '3px solid rgba(234, 179, 8, 0.5)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.375rem',
        }}
      >
        <label style={{ ...labelStyle, color: '#fbbf24', margin: 0 }}>
          Gap / Misalignment {index + 1}
        </label>
        <button style={removeBtnStyle} onClick={onRemove}>
          Remove
        </button>
      </div>

      <div style={{ marginBottom: '0.375rem' }}>
        <label style={labelStyle}>Unlinked National Objective</label>
        <input
          style={inputStyle}
          value={gap.nationalObjective}
          placeholder="Which national objective lacks operational linkage?"
          onChange={(e) => onChange({ ...gap, nationalObjective: e.target.value })}
        />
      </div>

      <div>
        <label style={labelStyle}>Gap Description</label>
        <textarea
          style={{ ...textareaStyle, minHeight: '2.5rem' }}
          value={gap.gapDescription}
          placeholder="Describe the alignment gap or misalignment..."
          onChange={(e) => onChange({ ...gap, gapDescription: e.target.value })}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface StrategicAlignmentProps {
  problemSetId: string;
  instanceId: string;
}

export function StrategicAlignment({
  problemSetId: _problemSetId,
  instanceId,
}: StrategicAlignmentProps) {
  const [content, setContent] = useState<StrategicAlignmentContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load step content on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await sgService.getStepContent(instanceId, 'strategic_alignment');
        if (!cancelled && result.content) {
          setContent(result.content as StrategicAlignmentContent);
        }
      } catch {
        // No content yet — use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [instanceId]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback(
    (updated: StrategicAlignmentContent) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await sgService.saveStepContent(instanceId, 'strategic_alignment', updated);
        } catch (err) {
          console.error('[StrategicAlignment] Auto-save failed:', err);
        } finally {
          setSaving(false);
        }
      }, 500);
    },
    [instanceId],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const updateContent = useCallback(
    (patch: Partial<StrategicAlignmentContent>) => {
      setContent((prev) => {
        const updated = { ...prev, ...patch };
        scheduleAutoSave(updated);
        return updated;
      });
    },
    [scheduleAutoSave],
  );

  const handleConfirmAlignment = useCallback(() => {
    updateContent({
      alignmentConfirmed: true,
      confirmedAt: new Date().toISOString(),
    });
  }, [updateContent]);

  if (loading) {
    return (
      <div style={{ padding: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
        Loading strategic alignment...
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Save indicator */}
      {saving && (
        <div style={{ fontSize: '0.7rem', color: '#60a5fa', textAlign: 'right' }}>
          Saving...
        </div>
      )}

      {/* Section A: National Objectives (read-only source, editable for manual entry) */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>National Objectives</h3>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem', marginTop: 0 }}>
          Enter the national and political objectives from strategic guidance documents. These drive
          the operational-level ends defined in the Design tab.
        </p>
        <NationalObjectivesList
          objectives={content.nationalObjectives}
          onChange={(objectives) => updateContent({ nationalObjectives: objectives })}
        />
      </div>

      {/* Section B: Operational Linkage Panel */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Operational Linkage Panel</h3>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem', marginTop: 0 }}>
          Map each national objective to an operational-level end. The AI strategic analyst agent
          can propose linkages — review and adjust as needed.
        </p>
        {content.linkages.map((linkage, idx) => (
          <LinkageRow
            key={linkage.id}
            linkage={linkage}
            index={idx}
            nationalObjectives={content.nationalObjectives}
            onChange={(updated) => {
              const linkages = [...content.linkages];
              linkages[idx] = updated;
              updateContent({ linkages });
            }}
            onRemove={() =>
              updateContent({
                linkages: content.linkages.filter((_, i) => i !== idx),
              })
            }
          />
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            updateContent({
              linkages: [
                ...content.linkages,
                {
                  id: crypto.randomUUID(),
                  nationalObjective: '',
                  operationalEnd: '',
                  rationale: '',
                },
              ],
            })
          }
        >
          + Add Linkage
        </button>
      </div>

      {/* Section C: Gaps & Misalignments */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Gaps &amp; Misalignments</h3>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.75rem', marginTop: 0 }}>
          Document national objectives without adequate operational linkages. These represent
          planning gaps that must be addressed before the Commander's Directive.
        </p>
        {content.gaps.length === 0 && (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            No gaps identified. If all national objectives are linked to operational ends, alignment
            is complete.
          </p>
        )}
        {content.gaps.map((gap, idx) => (
          <GapCard
            key={gap.id}
            gap={gap}
            index={idx}
            onChange={(updated) => {
              const gaps = [...content.gaps];
              gaps[idx] = updated;
              updateContent({ gaps });
            }}
            onRemove={() =>
              updateContent({
                gaps: content.gaps.filter((_, i) => i !== idx),
              })
            }
          />
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            updateContent({
              gaps: [
                ...content.gaps,
                {
                  id: crypto.randomUUID(),
                  nationalObjective: '',
                  gapDescription: '',
                },
              ],
            })
          }
        >
          + Add Gap
        </button>
      </div>

      {/* Section D: Staff Confirmation */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Staff Confirmation</h3>
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 0.5rem 0' }}>
            Alignment summary:
          </p>
          <ul style={{ fontSize: '0.8rem', color: '#d1d5db', margin: 0, paddingLeft: '1.25rem' }}>
            <li>{content.nationalObjectives.length} national objectives entered</li>
            <li>{content.linkages.length} operational linkages mapped</li>
            <li>
              {content.gaps.length} gap{content.gaps.length !== 1 ? 's' : ''} identified
            </li>
          </ul>
        </div>

        {content.alignmentConfirmed ? (
          <div
            style={{
              padding: '0.75rem',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '0.25rem',
              fontSize: '0.85rem',
              color: '#86efac',
            }}
          >
            Alignment confirmed
            {content.confirmedAt
              ? ` on ${new Date(content.confirmedAt).toLocaleDateString()}`
              : ''}
            . Proceed to Commander's Planning Guidance.
          </div>
        ) : (
          <button
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              backgroundColor: 'rgba(59, 130, 246, 0.2)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '0.25rem',
              color: '#93c5fd',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
            onClick={handleConfirmAlignment}
          >
            Confirm Alignment
          </button>
        )}
      </div>
    </div>
  );
}
