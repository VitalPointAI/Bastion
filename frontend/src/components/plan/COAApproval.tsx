/**
 * COAApproval
 *
 * Phase 33 Plan 07: JPP Step 6 - COA Approval.
 * Assembles a briefing package from prior step products (mission statement,
 * commander's intent, COA summaries with comparison scores, staff recommendation,
 * key decision points). Commander selects and approves a COA with modifications
 * via a governance gate.
 */

import { useState, useEffect, useCallback } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type JPPStepProduct, type StepStatus } from '../../lib/jpp-service.ts';
import { GateSubmitButton } from '../governance/index.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BriefingData {
  missionStatement: string;
  commandersIntent: string;
  coaSummaries: Array<{
    id: string;
    name: string;
    description: string;
    compositeScore: number;
    ranking: number;
  }>;
  staffRecommendation: string;
  recommendedCoaId: string;
  decisionPoints: Array<{
    description: string;
    triggerCondition: string;
    recommendedAction: string;
  }>;
}

interface COAApprovalProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Assemble briefing from prior step products */
function assembleBriefing(
  step2Products: JPPStepProduct[],
  step3Products: JPPStepProduct[],
  step4Products: JPPStepProduct[],
  step5Products: JPPStepProduct[],
): BriefingData {
  let missionStatement = '';
  let commandersIntent = '';
  const coaSummaries: BriefingData['coaSummaries'] = [];
  let staffRecommendation = '';
  let recommendedCoaId = '';
  const decisionPoints: BriefingData['decisionPoints'] = [];

  // Step 2: Mission statement and commander's intent
  for (const p of step2Products) {
    const c = p.content;
    if (!c || typeof c !== 'object') continue;
    if ('missionStatement' in c) {
      missionStatement = (c.missionStatement as string) || '';
    }
    if ('commandersIntent' in c) {
      commandersIntent = (c.commandersIntent as string) || '';
    }
    // Also check for the 5W format
    if ('who' in c && 'what' in c) {
      missionStatement =
        `WHO: ${c.who || ''}\nWHAT: ${c.what || ''}\nWHEN: ${c.when || ''}\nWHERE: ${c.where || ''}\nWHY: ${c.why || ''}`;
    }
  }

  // Step 3: COA names/descriptions
  const coaMap: Record<string, { name: string; description: string }> = {};
  for (const p of step3Products) {
    const c = p.content;
    if (c && typeof c === 'object' && 'coaId' in c) {
      const id = c.coaId as string;
      coaMap[id] = {
        name: (c.name as string) || '',
        description: (c.description as string) || '',
      };
    }
  }

  // Step 5: Comparison scores
  const scoreMap: Record<string, { compositeScore: number; ranking: number }> = {};
  for (const p of step5Products) {
    const c = p.content;
    if (!c || typeof c !== 'object') continue;
    if ('coaId' in c && 'compositeScore' in c) {
      scoreMap[c.coaId as string] = {
        compositeScore: (c.compositeScore as number) || 0,
        ranking: (c.ranking as number) || 0,
      };
    }
    if ('recommendation' in c) {
      staffRecommendation = (c.recommendation as string) || '';
      recommendedCoaId = (c.recommendedCoaId as string) || '';
    }
  }

  // Merge COA data
  for (const [id, coa] of Object.entries(coaMap)) {
    coaSummaries.push({
      id,
      name: coa.name,
      description: coa.description,
      compositeScore: scoreMap[id]?.compositeScore || 0,
      ranking: scoreMap[id]?.ranking || 0,
    });
  }
  coaSummaries.sort((a, b) => a.ranking - b.ranking);

  // Step 4: Decision points
  for (const p of step4Products) {
    const c = p.content;
    if (c && typeof c === 'object' && 'decisionPoints' in c && Array.isArray(c.decisionPoints)) {
      for (const dp of c.decisionPoints as Array<Record<string, string>>) {
        decisionPoints.push({
          description: dp.description || '',
          triggerCondition: dp.triggerCondition || '',
          recommendedAction: dp.recommendedAction || '',
        });
      }
    }
  }

  return { missionStatement, commandersIntent, coaSummaries, staffRecommendation, recommendedCoaId, decisionPoints };
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.75rem',
};

const briefingCardStyle: React.CSSProperties = {
  ...cardStyle,
  borderLeft: '3px solid #3b82f6',
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

const affirmButtonStyle: React.CSSProperties = {
  padding: '0.5rem 1.5rem',
  fontSize: '0.85rem',
  backgroundColor: 'rgba(16, 185, 129, 0.2)',
  border: '2px solid rgba(16, 185, 129, 0.5)',
  borderRadius: '0.375rem',
  color: '#6ee7b7',
  cursor: 'pointer',
  fontWeight: 600,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function COAApproval({ problemSetId, jppInstanceId, currentRole }: COAApprovalProps) {
  const [briefing, setBriefing] = useState<BriefingData>({
    missionStatement: '',
    commandersIntent: '',
    coaSummaries: [],
    staffRecommendation: '',
    recommendedCoaId: '',
    decisionPoints: [],
  });
  const [selectedCoaId, setSelectedCoaId] = useState('');
  const [guidanceModifications, setGuidanceModifications] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');
  const [saving, setSaving] = useState(false);

  // Load briefing data from all prior steps
  const loadData = useCallback(async () => {
    try {
      const [step2, step3, step4, step5, instance] = await Promise.all([
        jppService.getStepProducts(jppInstanceId, 'mission_analysis'),
        jppService.getStepProducts(jppInstanceId, 'coa_development'),
        jppService.getStepProducts(jppInstanceId, 'coa_analysis'),
        jppService.getStepProducts(jppInstanceId, 'coa_comparison'),
        jppService.getInstance(problemSetId),
      ]);

      const assembled = assembleBriefing(step2, step3, step4, step5);
      setBriefing(assembled);
      setStepStatus(instance.stepStatuses.coa_approval || 'not_started');

      // Pre-select recommended COA if available
      if (assembled.recommendedCoaId) {
        setSelectedCoaId(assembled.recommendedCoaId);
      }

      // Load existing commander decision if any
      const step6Products = await jppService.getStepProducts(jppInstanceId, 'coa_approval');
      for (const p of step6Products) {
        const c = p.content;
        if (c && typeof c === 'object' && 'selectedCoaId' in c) {
          setSelectedCoaId((c.selectedCoaId as string) || '');
          setGuidanceModifications((c.guidanceModifications as string) || '');
          setDecisionRationale((c.decisionRationale as string) || '');
        }
      }
    } catch (err) {
      console.error('[COAApproval] Failed to load briefing data:', err);
    }
  }, [jppInstanceId, problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Save commander decision
  const handleSave = async () => {
    setSaving(true);
    try {
      await jppService.saveStepProduct(jppInstanceId, 'coa_approval', {
        roleId: currentRole,
        content: {
          selectedCoaId,
          guidanceModifications,
          decisionRationale,
          approvedAt: new Date().toISOString(),
        },
        status: 'draft',
      });

      if (stepStatus === 'not_started') {
        await jppService.updateStepStatus(jppInstanceId, 'coa_approval', 'in_progress');
        setStepStatus('in_progress');
      }
    } catch (err) {
      console.error('[COAApproval] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const selectedCoa = briefing.coaSummaries.find((c) => c.id === selectedCoaId);

  return (
    <JPPStepLayout
      stepId="coa_approval"
      stepLabel="COA Approval"
      stepNumber={6}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-briefing-agent"
    >
      {/* Section 1: Briefing Package (read-only composite) */}
      <RoleGatedSection
        allowedRoles={[]}
        currentRole={currentRole}
        title="Briefing Package"
        description="Auto-assembled from prior step products for commander review"
      >
        {/* Mission Statement */}
        <div style={briefingCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, marginBottom: '0.375rem' }}>
            MISSION STATEMENT (Step 2)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
            {briefing.missionStatement || 'Not yet defined.'}
          </div>
        </div>

        {/* Commander's Intent */}
        <div style={briefingCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, marginBottom: '0.375rem' }}>
            COMMANDER'S INTENT (Step 2)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
            {briefing.commandersIntent || 'Not yet defined.'}
          </div>
        </div>

        {/* COA Summaries with Scores */}
        <div style={briefingCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, marginBottom: '0.375rem' }}>
            COA COMPARISON RESULTS (Steps 3 + 5)
          </div>
          {briefing.coaSummaries.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: '#6b7280', fontStyle: 'italic' }}>
              No COAs available.
            </p>
          ) : (
            briefing.coaSummaries.map((coa) => (
              <div
                key={coa.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  marginBottom: '0.25rem',
                  backgroundColor: 'rgba(17, 24, 39, 0.4)',
                  borderRadius: '0.25rem',
                  border: coa.id === briefing.recommendedCoaId
                    ? '1px solid rgba(16, 185, 129, 0.4)'
                    : '1px solid rgba(75, 85, 99, 0.2)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#e5e7eb', fontSize: '0.85rem' }}>
                    #{coa.ranking} {coa.name}
                    {coa.id === briefing.recommendedCoaId && (
                      <span
                        style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.65rem',
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          backgroundColor: 'rgba(16, 185, 129, 0.2)',
                          color: '#6ee7b7',
                        }}
                      >
                        STAFF RECOMMENDED
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.125rem' }}>
                    {coa.description}
                  </div>
                </div>
                <div style={{ textAlign: 'right', minWidth: '3rem' }}>
                  <div style={{ fontWeight: 700, color: '#60a5fa', fontSize: '1rem' }}>
                    {coa.compositeScore.toFixed(1)}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>score</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Staff Recommendation */}
        <div style={briefingCardStyle}>
          <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, marginBottom: '0.375rem' }}>
            STAFF RECOMMENDATION (Step 5)
          </div>
          <div style={{ fontSize: '0.8rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
            {briefing.staffRecommendation || 'No staff recommendation provided.'}
          </div>
        </div>

        {/* Decision Points from Wargame */}
        {briefing.decisionPoints.length > 0 && (
          <div style={briefingCardStyle}>
            <div style={{ fontSize: '0.75rem', color: '#60a5fa', fontWeight: 600, marginBottom: '0.375rem' }}>
              KEY DECISION POINTS (Step 4)
            </div>
            {briefing.decisionPoints.map((dp, idx) => (
              <div
                key={idx}
                style={{
                  padding: '0.375rem 0',
                  borderBottom: idx < briefing.decisionPoints.length - 1 ? '1px solid rgba(75, 85, 99, 0.2)' : 'none',
                }}
              >
                <div style={{ fontWeight: 500, color: '#d1d5db', fontSize: '0.8rem' }}>
                  DP-{idx + 1}: {dp.description}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  Trigger: {dp.triggerCondition} | Action: {dp.recommendedAction}
                </div>
              </div>
            ))}
          </div>
        )}
      </RoleGatedSection>

      {/* Section 2: Commander's Decision */}
      <RoleGatedSection
        allowedRoles={['commander', 'xo']}
        currentRole={currentRole}
        title="Commander's Decision"
        description="Select COA for approval with guidance modifications"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* COA Selection */}
          <div>
            <label style={labelStyle}>Select COA to Approve</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {briefing.coaSummaries.map((coa) => (
                <label
                  key={coa.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor:
                      selectedCoaId === coa.id
                        ? 'rgba(59, 130, 246, 0.15)'
                        : 'rgba(17, 24, 39, 0.4)',
                    border:
                      selectedCoaId === coa.id
                        ? '1px solid rgba(59, 130, 246, 0.4)'
                        : '1px solid rgba(75, 85, 99, 0.3)',
                    borderRadius: '0.25rem',
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                    color: '#e5e7eb',
                  }}
                >
                  <input
                    type="radio"
                    name="coa-selection"
                    value={coa.id}
                    checked={selectedCoaId === coa.id}
                    onChange={(e) => setSelectedCoaId(e.target.value)}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  <span style={{ fontWeight: 600 }}>{coa.name}</span>
                  <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    (Score: {coa.compositeScore.toFixed(1)}, Rank #{coa.ranking})
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Guidance Modifications */}
          <div>
            <label style={labelStyle}>Guidance Modifications</label>
            <textarea
              value={guidanceModifications}
              onChange={(e) => setGuidanceModifications(e.target.value)}
              placeholder="Commander's adjustments to the selected COA..."
              style={textareaStyle}
            />
          </div>

          {/* Decision Rationale */}
          <div>
            <label style={labelStyle}>Decision Rationale</label>
            <textarea
              value={decisionRationale}
              onChange={(e) => setDecisionRationale(e.target.value)}
              placeholder="Rationale for COA selection..."
              style={textareaStyle}
            />
          </div>

          {/* Affirm Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.5rem' }}>
            <button
              onClick={handleSave}
              disabled={saving || !selectedCoaId}
              style={{
                ...affirmButtonStyle,
                opacity: selectedCoaId ? 1 : 0.5,
                cursor: selectedCoaId ? 'pointer' : 'not-allowed',
              }}
            >
              {saving ? 'Saving...' : 'Affirm COA'}
            </button>
            {selectedCoa && (
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                Affirming: <strong style={{ color: '#e5e7eb' }}>{selectedCoa.name}</strong>
              </span>
            )}
          </div>
        </div>
      </RoleGatedSection>

      {/* Section 3: Governance Gate */}
      <RoleGatedSection
        allowedRoles={['commander', 'xo', 'chief_of_staff']}
        currentRole={currentRole}
        title="COA Approval Gate"
        description="Submit COA approval for governance review"
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <GateSubmitButton
            gateType="coa_approval"
            itemId={`${jppInstanceId}-coa-approval`}
            itemTitle="COA Approval Decision"
            itemDescription={
              selectedCoa
                ? `Commander approves ${selectedCoa.name} for plan development`
                : 'COA approval pending commander decision'
            }
            tabId="plan"
          />
        </div>
      </RoleGatedSection>
    </JPPStepLayout>
  );
}
