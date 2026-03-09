/**
 * COAAnalysis
 *
 * Phase 33 Plan 07: JPP Step 4 - COA Analysis (Wargame).
 * Displays COAs from Step 3 as reference cards, then provides
 * wargame result entry per COA with Red Team fields: adversary actions,
 * vulnerabilities, counter-actions, outcome assessment, confidence score.
 * Also captures key decision points identified during wargaming.
 */

import { useState, useEffect, useCallback } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type JPPStepProduct, type StepStatus } from '../../lib/jpp-service.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface COASummary {
  id: string;
  name: string;
  description: string;
  scheme: string;
}

interface WargameEntry {
  coaId: string;
  adversaryActions: string[];
  vulnerabilities: string[];
  counterActions: string[];
  outcomeAssessment: string;
  confidenceScore: number;
}

interface DecisionPoint {
  description: string;
  triggerCondition: string;
  recommendedAction: string;
}

interface COAAnalysisProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Parse list field: string[] or fallback to empty array */
function parseListField(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  return [];
}

/** Extract COA summaries from Step 3 products */
function extractCOAs(products: JPPStepProduct[]): COASummary[] {
  const coas: COASummary[] = [];
  for (const p of products) {
    const c = p.content;
    if (c && typeof c === 'object' && 'coaId' in c) {
      coas.push({
        id: (c.coaId as string) || p.id,
        name: (c.name as string) || `COA ${coas.length + 1}`,
        description: (c.description as string) || '',
        scheme: (c.scheme as string) || '',
      });
    }
  }
  return coas;
}

/** Extract existing wargame entries from Step 4 products */
function extractWargameEntries(products: JPPStepProduct[]): WargameEntry[] {
  const entries: WargameEntry[] = [];
  for (const p of products) {
    const c = p.content;
    if (c && typeof c === 'object' && 'coaId' in c && 'adversaryActions' in c) {
      entries.push({
        coaId: c.coaId as string,
        adversaryActions: parseListField(c.adversaryActions),
        vulnerabilities: parseListField(c.vulnerabilities),
        counterActions: parseListField(c.counterActions),
        outcomeAssessment: (c.outcomeAssessment as string) || '',
        confidenceScore: typeof c.confidenceScore === 'number' ? c.confidenceScore : 50,
      });
    }
  }
  return entries;
}

/** Extract decision points from Step 4 products */
function extractDecisionPoints(products: JPPStepProduct[]): DecisionPoint[] {
  for (const p of products) {
    const c = p.content;
    if (c && typeof c === 'object' && 'decisionPoints' in c && Array.isArray(c.decisionPoints)) {
      return c.decisionPoints as DecisionPoint[];
    }
  }
  return [];
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.5rem',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '3rem',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.5)',
  borderRadius: '0.25rem',
  color: '#e5e7eb',
  padding: '0.5rem',
  fontSize: '0.8rem',
  resize: 'vertical',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.5)',
  borderRadius: '0.25rem',
  color: '#e5e7eb',
  padding: '0.375rem 0.5rem',
  fontSize: '0.8rem',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#9ca3af',
  marginBottom: '0.25rem',
  fontWeight: 500,
};

const buttonStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  fontSize: '0.75rem',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
  cursor: 'pointer',
};

const saveButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  fontSize: '0.8rem',
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  borderRadius: '0.25rem',
  color: '#6ee7b7',
  cursor: 'pointer',
  fontWeight: 500,
};

// ─── List Editor (reusable inline list) ─────────────────────────────────────

function ListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');

  const addItem = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onChange([...items, trimmed]);
      setDraft('');
    }
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div>
      {items.map((item, idx) => (
        <div
          key={idx}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '0.25rem',
            fontSize: '0.8rem',
            color: '#d1d5db',
          }}
        >
          <span style={{ flex: 1 }}>{item}</span>
          <button
            onClick={() => removeItem(idx)}
            style={{
              background: 'none',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0 0.25rem',
            }}
          >
            x
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
          placeholder={placeholder}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={addItem} style={buttonStyle}>
          Add
        </button>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COAAnalysis({ problemSetId, jppInstanceId, currentRole }: COAAnalysisProps) {
  const [coas, setCoas] = useState<COASummary[]>([]);
  const [wargameEntries, setWargameEntries] = useState<WargameEntry[]>([]);
  const [decisionPoints, setDecisionPoints] = useState<DecisionPoint[]>([]);
  const [expandedCoa, setExpandedCoa] = useState<string | null>(null);
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');
  const [saving, setSaving] = useState(false);

  // Load COAs from Step 3 and existing wargame data from Step 4
  const loadData = useCallback(async () => {
    try {
      const [step3Products, step4Products, instance] = await Promise.all([
        jppService.getStepProducts(jppInstanceId, 'coa_development'),
        jppService.getStepProducts(jppInstanceId, 'coa_analysis'),
        jppService.getInstance(problemSetId),
      ]);

      const extractedCoas = extractCOAs(step3Products);
      setCoas(extractedCoas);
      setStepStatus(instance.stepStatuses.coa_analysis || 'not_started');

      // Load existing wargame entries or initialize defaults
      const existing = extractWargameEntries(step4Products);
      if (existing.length > 0) {
        setWargameEntries(existing);
      } else {
        // Initialize empty wargame entries for each COA
        setWargameEntries(
          extractedCoas.map((coa) => ({
            coaId: coa.id,
            adversaryActions: [],
            vulnerabilities: [],
            counterActions: [],
            outcomeAssessment: '',
            confidenceScore: 50,
          })),
        );
      }

      setDecisionPoints(extractDecisionPoints(step4Products));
    } catch (err) {
      console.error('[COAAnalysis] Failed to load data:', err);
    }
  }, [jppInstanceId, problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update a specific wargame entry
  const updateEntry = (coaId: string, patch: Partial<WargameEntry>) => {
    setWargameEntries((prev) =>
      prev.map((e) => (e.coaId === coaId ? { ...e, ...patch } : e)),
    );
  };

  // Add a decision point
  const addDecisionPoint = () => {
    setDecisionPoints((prev) => [
      ...prev,
      { description: '', triggerCondition: '', recommendedAction: '' },
    ]);
  };

  // Update a decision point
  const updateDecisionPoint = (idx: number, patch: Partial<DecisionPoint>) => {
    setDecisionPoints((prev) => prev.map((dp, i) => (i === idx ? { ...dp, ...patch } : dp)));
  };

  // Remove a decision point
  const removeDecisionPoint = (idx: number) => {
    setDecisionPoints((prev) => prev.filter((_, i) => i !== idx));
  };

  // Save all wargame results
  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each wargame entry as a step product
      for (const entry of wargameEntries) {
        await jppService.saveStepProduct(jppInstanceId, 'coa_analysis', {
          roleId: currentRole,
          content: {
            coaId: entry.coaId,
            adversaryActions: entry.adversaryActions,
            vulnerabilities: entry.vulnerabilities,
            counterActions: entry.counterActions,
            outcomeAssessment: entry.outcomeAssessment,
            confidenceScore: entry.confidenceScore,
          },
          status: 'draft',
        });
      }
      // Save decision points as a separate product
      if (decisionPoints.length > 0) {
        await jppService.saveStepProduct(jppInstanceId, 'coa_analysis', {
          roleId: currentRole,
          content: { decisionPoints },
          status: 'draft',
        });
      }
      // Mark step in progress
      if (stepStatus === 'not_started') {
        await jppService.updateStepStatus(jppInstanceId, 'coa_analysis', 'in_progress');
        setStepStatus('in_progress');
      }
    } catch (err) {
      console.error('[COAAnalysis] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <JPPStepLayout
      stepId="coa_analysis"
      stepLabel="COA Analysis (Wargame)"
      stepNumber={4}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-coa-analysis-agent"
    >
      {/* Section 1: COA Cards (read-only reference) */}
      <RoleGatedSection
        allowedRoles={[]}
        currentRole={currentRole}
        title="COA Reference Cards"
        description="COAs from Step 3 for reference during wargaming"
      >
        {coas.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
            No COAs available. Complete Step 3 (COA Development) first.
          </p>
        ) : (
          coas.map((coa) => (
            <div key={coa.id} style={cardStyle}>
              <div style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.85rem' }}>
                {coa.name}
              </div>
              <p style={{ margin: '0.25rem 0', fontSize: '0.8rem', color: '#9ca3af' }}>
                {coa.description}
              </p>
              {coa.scheme && (
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  Scheme: {coa.scheme}
                </p>
              )}
            </div>
          ))
        )}
      </RoleGatedSection>

      {/* Section 2: Wargame Results (per COA) */}
      <RoleGatedSection
        allowedRoles={['j2', 'j3', 'j5', 'red_team']}
        currentRole={currentRole}
        title="Wargame Results"
        description="Red Team adversary analysis per COA. Auto-generated by Red Team agent, editable by staff."
      >
        {coas.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
            No COAs to wargame.
          </p>
        ) : (
          coas.map((coa) => {
            const entry = wargameEntries.find((e) => e.coaId === coa.id);
            const isExpanded = expandedCoa === coa.id;

            return (
              <div key={coa.id} style={{ ...cardStyle, marginBottom: '0.75rem' }}>
                <button
                  onClick={() => setExpandedCoa(isExpanded ? null : coa.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#e5e7eb',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{coa.name} - Wargame</span>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                  >
                    &#9660;
                  </span>
                </button>

                {isExpanded && entry && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Adversary Actions */}
                    <div>
                      <label style={labelStyle}>Adversary Actions</label>
                      <ListEditor
                        items={entry.adversaryActions}
                        onChange={(items) => updateEntry(coa.id, { adversaryActions: items })}
                        placeholder="Predicted enemy response..."
                      />
                    </div>

                    {/* Vulnerabilities */}
                    <div>
                      <label style={labelStyle}>Vulnerabilities Identified</label>
                      <ListEditor
                        items={entry.vulnerabilities}
                        onChange={(items) => updateEntry(coa.id, { vulnerabilities: items })}
                        placeholder="Vulnerability in this COA..."
                      />
                    </div>

                    {/* Counter-Actions */}
                    <div>
                      <label style={labelStyle}>Counter-Actions</label>
                      <ListEditor
                        items={entry.counterActions}
                        onChange={(items) => updateEntry(coa.id, { counterActions: items })}
                        placeholder="How adversary might counter..."
                      />
                    </div>

                    {/* Outcome Assessment */}
                    <div>
                      <label style={labelStyle}>Outcome Assessment</label>
                      <textarea
                        value={entry.outcomeAssessment}
                        onChange={(e) =>
                          updateEntry(coa.id, { outcomeAssessment: e.target.value })
                        }
                        placeholder="Overall wargame outcome assessment for this COA..."
                        style={textareaStyle}
                      />
                    </div>

                    {/* Confidence Score */}
                    <div>
                      <label style={labelStyle}>
                        Confidence Score: {entry.confidenceScore}%
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={entry.confidenceScore}
                        onChange={(e) =>
                          updateEntry(coa.id, { confidenceScore: Number(e.target.value) })
                        }
                        style={{ width: '100%', accentColor: '#3b82f6' }}
                      />
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.65rem',
                          color: '#6b7280',
                        }}
                      >
                        <span>Low</span>
                        <span>High</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </RoleGatedSection>

      {/* Section 3: Key Decision Points */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5']}
        currentRole={currentRole}
        title="Key Decision Points"
        description="Decision points identified during wargaming"
      >
        {decisionPoints.map((dp, idx) => (
          <div key={idx} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 500 }}>
                Decision Point {idx + 1}
              </span>
              <button
                onClick={() => removeDecisionPoint(idx)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                }}
              >
                Remove
              </button>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input
                value={dp.description}
                onChange={(e) => updateDecisionPoint(idx, { description: e.target.value })}
                placeholder="What decision must be made..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Trigger Condition</label>
              <input
                value={dp.triggerCondition}
                onChange={(e) => updateDecisionPoint(idx, { triggerCondition: e.target.value })}
                placeholder="When this decision is triggered..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Recommended Action</label>
              <input
                value={dp.recommendedAction}
                onChange={(e) => updateDecisionPoint(idx, { recommendedAction: e.target.value })}
                placeholder="Recommended course of action..."
                style={inputStyle}
              />
            </div>
          </div>
        ))}
        <button onClick={addDecisionPoint} style={buttonStyle}>
          + Add Decision Point
        </button>
      </RoleGatedSection>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle}>
          {saving ? 'Saving...' : 'Save Wargame Results'}
        </button>
      </div>
    </JPPStepLayout>
  );
}
