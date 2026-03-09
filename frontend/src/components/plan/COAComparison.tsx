/**
 * COAComparison
 *
 * Phase 33 Plan 07: JPP Step 5 - COA Comparison.
 * Displays a decision matrix with 5 criteria (Feasibility, Acceptability,
 * Suitability, Distinguishability, Completeness). Each COA is scored 1-5
 * per criterion with rationale. Composite scores auto-calculated from
 * weighted criteria. Includes staff recommendation and governance gate.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type JPPStepProduct, type StepStatus } from '../../lib/jpp-service.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface COASummary {
  id: string;
  name: string;
}

interface CriterionDef {
  key: CriterionKey;
  label: string;
  description: string;
}

type CriterionKey =
  | 'feasibility'
  | 'acceptability'
  | 'suitability'
  | 'distinguishability'
  | 'completeness';

interface CriterionScore {
  score: number; // 1-5
  rationale: string;
}

/** Scores for one COA across all 5 criteria */
type COAScores = Record<CriterionKey, CriterionScore>;

interface COAComparisonProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const CRITERIA: CriterionDef[] = [
  { key: 'feasibility', label: 'Feasibility', description: 'Can we do it with available resources?' },
  { key: 'acceptability', label: 'Acceptability', description: 'Worth the cost in risk and resources?' },
  { key: 'suitability', label: 'Suitability', description: 'Does it achieve the objective?' },
  { key: 'distinguishability', label: 'Distinguishability', description: 'Sufficiently different from other COAs?' },
  { key: 'completeness', label: 'Completeness', description: 'Fully addresses the mission?' },
];

const DEFAULT_WEIGHTS: Record<CriterionKey, number> = {
  feasibility: 1,
  acceptability: 1,
  suitability: 1,
  distinguishability: 1,
  completeness: 1,
};

function defaultScores(): COAScores {
  return {
    feasibility: { score: 3, rationale: '' },
    acceptability: { score: 3, rationale: '' },
    suitability: { score: 3, rationale: '' },
    distinguishability: { score: 3, rationale: '' },
    completeness: { score: 3, rationale: '' },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract COA names from Step 3 products */
function extractCOAs(products: JPPStepProduct[]): COASummary[] {
  const coas: COASummary[] = [];
  for (const p of products) {
    const c = p.content;
    if (c && typeof c === 'object' && 'coaId' in c) {
      coas.push({
        id: (c.coaId as string) || p.id,
        name: (c.name as string) || `COA ${coas.length + 1}`,
      });
    }
  }
  return coas;
}

/** Extract existing comparison scores from Step 5 products */
function extractScores(
  products: JPPStepProduct[],
): { scores: Record<string, COAScores>; weights: Record<CriterionKey, number>; recommendation: string; recommendedCoaId: string; riskSummary: string } {
  const scores: Record<string, COAScores> = {};
  let weights = { ...DEFAULT_WEIGHTS };
  let recommendation = '';
  let recommendedCoaId = '';
  let riskSummary = '';

  for (const p of products) {
    const c = p.content;
    if (!c || typeof c !== 'object') continue;

    // Scores product
    if ('coaId' in c && 'feasibility' in c) {
      const coaId = c.coaId as string;
      scores[coaId] = {
        feasibility: (c.feasibility as CriterionScore) || { score: 3, rationale: '' },
        acceptability: (c.acceptability as CriterionScore) || { score: 3, rationale: '' },
        suitability: (c.suitability as CriterionScore) || { score: 3, rationale: '' },
        distinguishability: (c.distinguishability as CriterionScore) || { score: 3, rationale: '' },
        completeness: (c.completeness as CriterionScore) || { score: 3, rationale: '' },
      };
    }

    // Weights product
    if ('criteriaWeights' in c) {
      weights = c.criteriaWeights as Record<CriterionKey, number>;
    }

    // Recommendation product
    if ('recommendation' in c) {
      recommendation = (c.recommendation as string) || '';
      recommendedCoaId = (c.recommendedCoaId as string) || '';
      riskSummary = (c.riskSummary as string) || '';
    }
  }

  return { scores, weights, recommendation, recommendedCoaId, riskSummary };
}

/** Compute weighted composite score */
function compositeScore(scores: COAScores, weights: Record<CriterionKey, number>): number {
  let totalWeight = 0;
  let totalScore = 0;
  for (const key of CRITERIA.map((c) => c.key)) {
    const w = weights[key] || 1;
    totalWeight += w;
    totalScore += scores[key].score * w;
  }
  return totalWeight > 0 ? totalScore / totalWeight : 0;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cellStyle: React.CSSProperties = {
  padding: '0.5rem',
  borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
  fontSize: '0.8rem',
  color: '#d1d5db',
  verticalAlign: 'top',
};

const headerCellStyle: React.CSSProperties = {
  ...cellStyle,
  fontWeight: 600,
  color: '#e5e7eb',
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  fontSize: '0.75rem',
};

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '2.5rem',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.5)',
  borderRadius: '0.25rem',
  color: '#e5e7eb',
  padding: '0.375rem',
  fontSize: '0.75rem',
  resize: 'vertical',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  color: '#9ca3af',
  marginBottom: '0.25rem',
  fontWeight: 500,
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

// ─── Component ──────────────────────────────────────────────────────────────

export function COAComparison({ problemSetId, jppInstanceId, currentRole }: COAComparisonProps) {
  const [coas, setCoas] = useState<COASummary[]>([]);
  const [allScores, setAllScores] = useState<Record<string, COAScores>>({});
  const [weights, setWeights] = useState<Record<CriterionKey, number>>(DEFAULT_WEIGHTS);
  const [recommendation, setRecommendation] = useState('');
  const [recommendedCoaId, setRecommendedCoaId] = useState('');
  const [riskSummary, setRiskSummary] = useState('');
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');
  const [saving, setSaving] = useState(false);

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [step3Products, step5Products, instance] = await Promise.all([
        jppService.getStepProducts(jppInstanceId, 'coa_development'),
        jppService.getStepProducts(jppInstanceId, 'coa_comparison'),
        jppService.getInstance(problemSetId),
      ]);

      const extractedCoas = extractCOAs(step3Products);
      setCoas(extractedCoas);
      setStepStatus(instance.stepStatuses.coa_comparison || 'not_started');

      const existing = extractScores(step5Products);
      setWeights(existing.weights);
      setRecommendation(existing.recommendation);
      setRecommendedCoaId(existing.recommendedCoaId);
      setRiskSummary(existing.riskSummary);

      // Initialize scores for each COA
      const scoreMap: Record<string, COAScores> = {};
      for (const coa of extractedCoas) {
        scoreMap[coa.id] = existing.scores[coa.id] || defaultScores();
      }
      setAllScores(scoreMap);
    } catch (err) {
      console.error('[COAComparison] Failed to load data:', err);
    }
  }, [jppInstanceId, problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update a score for a COA/criterion
  const updateScore = (coaId: string, criterion: CriterionKey, patch: Partial<CriterionScore>) => {
    setAllScores((prev) => ({
      ...prev,
      [coaId]: {
        ...prev[coaId],
        [criterion]: { ...prev[coaId]?.[criterion], ...patch },
      },
    }));
  };

  // Compute rankings
  const rankings = useMemo(() => {
    const scored = coas.map((coa) => ({
      coaId: coa.id,
      composite: allScores[coa.id] ? compositeScore(allScores[coa.id], weights) : 0,
    }));
    scored.sort((a, b) => b.composite - a.composite);
    const rankMap: Record<string, { composite: number; rank: number }> = {};
    scored.forEach((s, idx) => {
      rankMap[s.coaId] = { composite: s.composite, rank: idx + 1 };
    });
    return rankMap;
  }, [coas, allScores, weights]);

  // Save
  const handleSave = async () => {
    setSaving(true);
    try {
      // Save scores per COA
      for (const coa of coas) {
        const scores = allScores[coa.id];
        if (!scores) continue;
        await jppService.saveStepProduct(jppInstanceId, 'coa_comparison', {
          roleId: currentRole,
          content: {
            coaId: coa.id,
            ...scores,
            compositeScore: rankings[coa.id]?.composite || 0,
            ranking: rankings[coa.id]?.rank || 0,
          },
          status: 'draft',
        });
      }

      // Save weights
      await jppService.saveStepProduct(jppInstanceId, 'coa_comparison', {
        roleId: currentRole,
        content: { criteriaWeights: weights },
        status: 'draft',
      });

      // Save recommendation
      if (recommendation || recommendedCoaId) {
        await jppService.saveStepProduct(jppInstanceId, 'coa_comparison', {
          roleId: currentRole,
          content: { recommendation, recommendedCoaId, riskSummary },
          status: 'draft',
        });
      }

      if (stepStatus === 'not_started') {
        await jppService.updateStepStatus(jppInstanceId, 'coa_comparison', 'in_progress');
        setStepStatus('in_progress');
      }
    } catch (err) {
      console.error('[COAComparison] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <JPPStepLayout
      stepId="coa_comparison"
      stepLabel="COA Comparison"
      stepNumber={5}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-coa-comparison-agent"
    >
      {/* Section 1: Comparison Criteria (with adjustable weights) */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5', 'commander']}
        currentRole={currentRole}
        title="Comparison Criteria"
        description="5 evaluation criteria with adjustable weights"
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
          {CRITERIA.map((c) => (
            <div
              key={c.key}
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                border: '1px solid rgba(75, 85, 99, 0.4)',
                borderRadius: '0.375rem',
                padding: '0.5rem',
                textAlign: 'center',
              }}
            >
              <div style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.8rem' }}>
                {c.label}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', margin: '0.25rem 0' }}>
                {c.description}
              </div>
              <label style={{ ...labelStyle, marginTop: '0.5rem' }}>
                Weight: {weights[c.key]}
              </label>
              <input
                type="range"
                min={1}
                max={5}
                value={weights[c.key]}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))
                }
                style={{ width: '100%', accentColor: '#3b82f6' }}
              />
            </div>
          ))}
        </div>
      </RoleGatedSection>

      {/* Section 2: Decision Matrix */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5']}
        currentRole={currentRole}
        title="Decision Matrix"
        description="Score each COA (1-5) per criterion. Composite score auto-calculated."
      >
        {coas.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
            No COAs available. Complete Step 3 first.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                border: '1px solid rgba(75, 85, 99, 0.3)',
              }}
            >
              <thead>
                <tr>
                  <th style={headerCellStyle}>COA</th>
                  {CRITERIA.map((c) => (
                    <th key={c.key} style={headerCellStyle}>
                      {c.label}
                      <br />
                      <span style={{ fontWeight: 400, fontSize: '0.65rem', color: '#6b7280' }}>
                        (w={weights[c.key]})
                      </span>
                    </th>
                  ))}
                  <th style={headerCellStyle}>Composite</th>
                  <th style={headerCellStyle}>Rank</th>
                </tr>
              </thead>
              <tbody>
                {coas.map((coa) => {
                  const scores = allScores[coa.id];
                  const rank = rankings[coa.id];

                  return (
                    <tr key={coa.id}>
                      <td style={{ ...cellStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {coa.name}
                      </td>
                      {CRITERIA.map((c) => (
                        <td key={c.key} style={cellStyle}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <select
                              value={scores?.[c.key]?.score ?? 3}
                              onChange={(e) =>
                                updateScore(coa.id, c.key, { score: Number(e.target.value) })
                              }
                              style={{
                                backgroundColor: 'rgba(17, 24, 39, 0.8)',
                                border: '1px solid rgba(75, 85, 99, 0.5)',
                                borderRadius: '0.25rem',
                                color: '#e5e7eb',
                                padding: '0.25rem',
                                fontSize: '0.8rem',
                              }}
                            >
                              {[1, 2, 3, 4, 5].map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                            <textarea
                              value={scores?.[c.key]?.rationale ?? ''}
                              onChange={(e) =>
                                updateScore(coa.id, c.key, { rationale: e.target.value })
                              }
                              placeholder="Rationale..."
                              style={{ ...textareaStyle, minHeight: '2rem' }}
                            />
                          </div>
                        </td>
                      ))}
                      <td
                        style={{
                          ...cellStyle,
                          fontWeight: 700,
                          fontSize: '1rem',
                          textAlign: 'center',
                          color: '#60a5fa',
                        }}
                      >
                        {rank?.composite.toFixed(1) || '-'}
                      </td>
                      <td
                        style={{
                          ...cellStyle,
                          fontWeight: 700,
                          fontSize: '1rem',
                          textAlign: 'center',
                          color: rank?.rank === 1 ? '#6ee7b7' : '#d1d5db',
                        }}
                      >
                        #{rank?.rank || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </RoleGatedSection>

      {/* Section 3: Staff Recommendation */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5', 'chief_of_staff']}
        currentRole={currentRole}
        title="Staff Recommendation"
        description="Staff narrative recommendation and COA selection"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Recommended COA</label>
            <select
              value={recommendedCoaId}
              onChange={(e) => setRecommendedCoaId(e.target.value)}
              style={{
                width: '100%',
                backgroundColor: 'rgba(17, 24, 39, 0.6)',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '0.25rem',
                color: '#e5e7eb',
                padding: '0.5rem',
                fontSize: '0.8rem',
              }}
            >
              <option value="">-- Select recommended COA --</option>
              {coas.map((coa) => (
                <option key={coa.id} value={coa.id}>
                  {coa.name} (Score: {rankings[coa.id]?.composite.toFixed(1) || '-'}, Rank #{rankings[coa.id]?.rank || '-'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Recommendation Narrative</label>
            <textarea
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value)}
              placeholder="Staff recommendation narrative with justification..."
              style={{ ...textareaStyle, minHeight: '4rem' }}
            />
          </div>

          <div>
            <label style={labelStyle}>Risk Comparison Summary</label>
            <textarea
              value={riskSummary}
              onChange={(e) => setRiskSummary(e.target.value)}
              placeholder="Comparative risk assessment across COAs..."
              style={{ ...textareaStyle, minHeight: '3rem' }}
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle}>
          {saving ? 'Saving...' : 'Save Comparison'}
        </button>
      </div>
    </JPPStepLayout>
  );
}
