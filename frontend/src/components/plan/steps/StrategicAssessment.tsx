/**
 * StrategicAssessment — Step 1 content component
 *
 * Phase 36 Plan 03: Strategic environment summary, center of gravity analysis,
 * key assumptions, and strategic factors with auto-save.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { sgService } from '../../../lib/strategic-guidance-service.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface COGAnalysis {
  cog: string;
  criticalCapabilities: string[];
  criticalRequirements: string[];
  criticalVulnerabilities: string[];
}

interface Assumption {
  id: string;
  description: string;
  validityConditions: string[];
  isValid: boolean;
  invalidatedAt?: string;
  invalidatedReason?: string;
}

interface StrategicAssessmentContent {
  strategicEnvironmentSummary: string;
  centerOfGravityAnalysis: {
    friendly: COGAnalysis;
    adversary: COGAnalysis;
  };
  keyAssumptions: Assumption[];
  strategicFactors: string[];
  sourceContainerIds: string[];
}

const EMPTY_COG: COGAnalysis = {
  cog: '',
  criticalCapabilities: [],
  criticalRequirements: [],
  criticalVulnerabilities: [],
};

const EMPTY_CONTENT: StrategicAssessmentContent = {
  strategicEnvironmentSummary: '',
  centerOfGravityAnalysis: {
    friendly: { ...EMPTY_COG },
    adversary: { ...EMPTY_COG },
  },
  keyAssumptions: [],
  strategicFactors: [],
  sourceContainerIds: [],
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

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '5rem',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  padding: '0.5rem',
  color: '#d1d5db',
  fontSize: '0.85rem',
  resize: 'vertical',
  fontFamily: 'inherit',
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

function EditableStringList({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={item}
            placeholder={placeholder}
            onChange={(e) => {
              const updated = [...items];
              updated[idx] = e.target.value;
              onChange(updated);
            }}
          />
          <button
            style={removeBtnStyle}
            onClick={() => onChange(items.filter((_, i) => i !== idx))}
          >
            X
          </button>
        </div>
      ))}
      <button
        style={{ ...addBtnStyle, alignSelf: 'flex-start' }}
        onClick={() => onChange([...items, ''])}
      >
        + Add
      </button>
    </div>
  );
}

function COGSection({
  label,
  cog,
  onChange,
}: {
  label: string;
  cog: COGAnalysis;
  onChange: (updated: COGAnalysis) => void;
}) {
  return (
    <div style={{ flex: 1, minWidth: '280px' }}>
      <h4 style={{ ...labelStyle, fontSize: '0.85rem', color: '#d1d5db', marginBottom: '0.5rem' }}>
        {label}
      </h4>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={labelStyle}>Center of Gravity</label>
        <input
          style={inputStyle}
          value={cog.cog}
          placeholder="e.g., National will, military capability..."
          onChange={(e) => onChange({ ...cog, cog: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={labelStyle}>Critical Capabilities</label>
        <EditableStringList
          items={cog.criticalCapabilities}
          onChange={(caps) => onChange({ ...cog, criticalCapabilities: caps })}
          placeholder="Capability..."
        />
      </div>

      <div style={{ marginBottom: '0.5rem' }}>
        <label style={labelStyle}>Critical Requirements</label>
        <EditableStringList
          items={cog.criticalRequirements}
          onChange={(reqs) => onChange({ ...cog, criticalRequirements: reqs })}
          placeholder="Requirement..."
        />
      </div>

      <div>
        <label style={labelStyle}>Critical Vulnerabilities</label>
        <EditableStringList
          items={cog.criticalVulnerabilities}
          onChange={(vulns) => onChange({ ...cog, criticalVulnerabilities: vulns })}
          placeholder="Vulnerability..."
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

interface StrategicAssessmentProps {
  problemSetId: string;
  instanceId: string;
}

export function StrategicAssessment({ problemSetId: _problemSetId, instanceId }: StrategicAssessmentProps) {
  const [content, setContent] = useState<StrategicAssessmentContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load step content on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const result = await sgService.getStepContent(instanceId, 'strategic_assessment');
        if (!cancelled && result.content) {
          setContent(result.content as StrategicAssessmentContent);
        }
      } catch {
        // No content yet — use defaults
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [instanceId]);

  // Debounced auto-save
  const scheduleAutoSave = useCallback(
    (updated: StrategicAssessmentContent) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          setSaving(true);
          await sgService.saveStepContent(instanceId, 'strategic_assessment', updated);
        } catch (err) {
          console.error('[StrategicAssessment] Auto-save failed:', err);
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
    (patch: Partial<StrategicAssessmentContent>) => {
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
        Loading strategic assessment...
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

      {/* 1. Strategic Environment Summary */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Strategic Environment Summary</h3>
        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.5rem', marginTop: 0 }}>
          Pull from strategic document containers in the Understand tab for source material.
        </p>
        <textarea
          style={{ ...textareaStyle, minHeight: '8rem' }}
          value={content.strategicEnvironmentSummary}
          placeholder="Summarize the strategic environment, key trends, and factors affecting the operational context..."
          onChange={(e) => updateContent({ strategicEnvironmentSummary: e.target.value })}
        />
      </div>

      {/* 2. Center of Gravity Analysis */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Center of Gravity Analysis</h3>
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          <COGSection
            label="Friendly"
            cog={content.centerOfGravityAnalysis.friendly}
            onChange={(friendly) =>
              updateContent({
                centerOfGravityAnalysis: { ...content.centerOfGravityAnalysis, friendly },
              })
            }
          />
          <COGSection
            label="Adversary"
            cog={content.centerOfGravityAnalysis.adversary}
            onChange={(adversary) =>
              updateContent({
                centerOfGravityAnalysis: { ...content.centerOfGravityAnalysis, adversary },
              })
            }
          />
        </div>
      </div>

      {/* 3. Key Assumptions */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Key Assumptions</h3>
        {content.keyAssumptions.map((assumption, idx) => (
          <div
            key={assumption.id}
            style={{
              backgroundColor: 'rgba(17, 24, 39, 0.5)',
              borderRadius: '0.25rem',
              padding: '0.75rem',
              marginBottom: '0.5rem',
              borderLeft: `3px solid ${assumption.isValid ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
              <label style={labelStyle}>Assumption {idx + 1}</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label style={{ fontSize: '0.7rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={assumption.isValid}
                    onChange={(e) => {
                      const updated = [...content.keyAssumptions];
                      updated[idx] = { ...assumption, isValid: e.target.checked };
                      updateContent({ keyAssumptions: updated });
                    }}
                  />
                  Valid
                </label>
                <button
                  style={removeBtnStyle}
                  onClick={() =>
                    updateContent({
                      keyAssumptions: content.keyAssumptions.filter((_, i) => i !== idx),
                    })
                  }
                >
                  Remove
                </button>
              </div>
            </div>
            <textarea
              style={{ ...textareaStyle, minHeight: '3rem', marginBottom: '0.375rem' }}
              value={assumption.description}
              placeholder="Describe the assumption..."
              onChange={(e) => {
                const updated = [...content.keyAssumptions];
                updated[idx] = { ...assumption, description: e.target.value };
                updateContent({ keyAssumptions: updated });
              }}
            />
            <label style={labelStyle}>Validity Conditions</label>
            <EditableStringList
              items={assumption.validityConditions}
              onChange={(conditions) => {
                const updated = [...content.keyAssumptions];
                updated[idx] = { ...assumption, validityConditions: conditions };
                updateContent({ keyAssumptions: updated });
              }}
              placeholder="Condition that would invalidate..."
            />
          </div>
        ))}
        <button
          style={addBtnStyle}
          onClick={() =>
            updateContent({
              keyAssumptions: [
                ...content.keyAssumptions,
                {
                  id: crypto.randomUUID(),
                  description: '',
                  validityConditions: [],
                  isValid: true,
                },
              ],
            })
          }
        >
          + Add Assumption
        </button>
      </div>

      {/* 4. Strategic Factors */}
      <div style={sectionStyle}>
        <h3 style={sectionHeaderStyle}>Strategic Factors</h3>
        <EditableStringList
          items={content.strategicFactors}
          onChange={(factors) => updateContent({ strategicFactors: factors })}
          placeholder="Strategic factor..."
        />
      </div>
    </div>
  );
}
