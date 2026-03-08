/**
 * PlanOrderDevelopment
 *
 * Phase 33 Plan 07: JPP Step 7 - Plan/Order Development.
 * Produces the operational plan with plan type selection (OPLAN/OPORD/CONPLAN/FRAGORD),
 * 5-paragraph order structure with role-gated editing per paragraph,
 * annex sections (A-E plus extensible), E-W-M gap check, and plan approval gate.
 */

import { useState, useEffect, useCallback } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type JPPStepProduct, type StepStatus } from '../../lib/jpp-service.ts';
import { ewmService, type EWMGap } from '../../lib/ewm-service.ts';
import { GateSubmitButton } from '../governance/index.ts';
import { DocumentExport } from './DocumentExport.tsx';
import { DocumentVersionHistory } from './DocumentVersionHistory.tsx';

// ─── Types ──────────────────────────────────────────────────────────────────

type PlanType = 'OPLAN' | 'OPORD' | 'CONPLAN' | 'FRAGORD';

interface FiveParagraphOrder {
  // Para 1 - Situation
  situation: {
    enemy: string;
    friendly: string;
    environment: string;
  };
  // Para 2 - Mission
  mission: string;
  // Para 3 - Execution
  execution: {
    conceptOfOperations: string;
    tasksToSubordinates: string;
    coordinatingInstructions: string;
  };
  // Para 4 - Sustainment
  sustainment: {
    logistics: string;
    personnel: string;
    healthServices: string;
  };
  // Para 5 - Command & Signal
  commandSignal: {
    commandRelationships: string;
    signalPlan: string;
  };
}

interface AnnexData {
  letter: string;
  title: string;
  allowedRoles: string[];
  content: string;
}

interface PlanOrderDevelopmentProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const PLAN_TYPES: Array<{ value: PlanType; label: string; description: string }> = [
  { value: 'OPLAN', label: 'OPLAN', description: 'Operations Plan - complete plan without a specific execution time' },
  { value: 'OPORD', label: 'OPORD', description: 'Operations Order - directive to execute operations' },
  { value: 'CONPLAN', label: 'CONPLAN', description: 'Concept Plan - plan in abbreviated format' },
  { value: 'FRAGORD', label: 'FRAGORD', description: 'Fragmentary Order - amendment to an existing order' },
];

const DEFAULT_ANNEXES: AnnexData[] = [
  { letter: 'A', title: 'Task Organization', allowedRoles: ['j3'], content: '' },
  { letter: 'B', title: 'Intelligence', allowedRoles: ['j2'], content: '' },
  { letter: 'C', title: 'Operations', allowedRoles: ['j3'], content: '' },
  { letter: 'D', title: 'Fires', allowedRoles: ['j3', 'fires_coordinator'], content: '' },
  { letter: 'E', title: 'Protection', allowedRoles: ['j34'], content: '' },
];

function defaultOrder(): FiveParagraphOrder {
  return {
    situation: { enemy: '', friendly: '', environment: '' },
    mission: '',
    execution: { conceptOfOperations: '', tasksToSubordinates: '', coordinatingInstructions: '' },
    sustainment: { logistics: '', personnel: '', healthServices: '' },
    commandSignal: { commandRelationships: '', signalPlan: '' },
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Extract existing plan data from Step 7 products */
function extractPlanData(products: JPPStepProduct[]): {
  planType: PlanType;
  order: FiveParagraphOrder;
  annexes: AnnexData[];
} {
  let planType: PlanType = 'OPLAN';
  let order = defaultOrder();
  let annexes = [...DEFAULT_ANNEXES];

  for (const p of products) {
    const c = p.content;
    if (!c || typeof c !== 'object') continue;

    if ('planType' in c) {
      planType = (c.planType as PlanType) || 'OPLAN';
    }

    if ('fiveParagraphOrder' in c) {
      const fpo = c.fiveParagraphOrder as FiveParagraphOrder;
      order = { ...defaultOrder(), ...fpo };
    }

    if ('annexes' in c && Array.isArray(c.annexes)) {
      annexes = c.annexes as AnnexData[];
    }
  }

  return { planType, order, annexes };
}

/** Extract mission statement from Step 2 for auto-population */
function extractMissionFromStep2(products: JPPStepProduct[]): string {
  for (const p of products) {
    const c = p.content;
    if (!c || typeof c !== 'object') continue;
    if ('missionStatement' in c) return (c.missionStatement as string) || '';
    if ('who' in c && 'what' in c) {
      return `WHO: ${c.who || ''}\nWHAT: ${c.what || ''}\nWHEN: ${c.when || ''}\nWHERE: ${c.where || ''}\nWHY: ${c.why || ''}`;
    }
  }
  return '';
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const textareaStyle: React.CSSProperties = {
  width: '100%',
  minHeight: '3.5rem',
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

const sectionDividerStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
  fontWeight: 600,
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.5rem',
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

const warningStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  backgroundColor: 'rgba(245, 158, 11, 0.1)',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: '0.25rem',
  color: '#fbbf24',
  fontSize: '0.8rem',
  marginBottom: '0.375rem',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function PlanOrderDevelopment({ problemSetId, jppInstanceId, currentRole }: PlanOrderDevelopmentProps) {
  const [planType, setPlanType] = useState<PlanType>('OPLAN');
  const [order, setOrder] = useState<FiveParagraphOrder>(defaultOrder());
  const [annexes, setAnnexes] = useState<AnnexData[]>(DEFAULT_ANNEXES);
  const [expandedAnnex, setExpandedAnnex] = useState<string | null>(null);
  const [gaps, setGaps] = useState<EWMGap[]>([]);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [gapsWaived, setGapsWaived] = useState(false);
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');
  const [saving, setSaving] = useState(false);

  // Load existing plan data + E-W-M gaps
  const loadData = useCallback(async () => {
    try {
      const [step7Products, step2Products, ewmGaps, instance] = await Promise.all([
        jppService.getStepProducts(jppInstanceId, 'plan_development'),
        jppService.getStepProducts(jppInstanceId, 'mission_analysis'),
        ewmService.getGaps(jppInstanceId),
        jppService.getInstance(problemSetId),
      ]);

      const planData = extractPlanData(step7Products);
      setPlanType(planData.planType);
      setAnnexes(planData.annexes);
      setStepStatus(instance.stepStatuses.plan_development || 'not_started');

      // If order has no mission, auto-populate from Step 2
      if (!planData.order.mission) {
        const missionFromStep2 = extractMissionFromStep2(step2Products);
        setOrder({ ...planData.order, mission: missionFromStep2 });
      } else {
        setOrder(planData.order);
      }

      setGaps(ewmGaps);
    } catch (err) {
      console.error('[PlanOrderDevelopment] Failed to load data:', err);
    } finally {
      setGapsLoading(false);
    }
  }, [jppInstanceId, problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update order paragraph field
  const updateSituation = (field: keyof FiveParagraphOrder['situation'], value: string) => {
    setOrder((prev) => ({
      ...prev,
      situation: { ...prev.situation, [field]: value },
    }));
  };

  const updateExecution = (field: keyof FiveParagraphOrder['execution'], value: string) => {
    setOrder((prev) => ({
      ...prev,
      execution: { ...prev.execution, [field]: value },
    }));
  };

  const updateSustainment = (field: keyof FiveParagraphOrder['sustainment'], value: string) => {
    setOrder((prev) => ({
      ...prev,
      sustainment: { ...prev.sustainment, [field]: value },
    }));
  };

  const updateCommandSignal = (field: keyof FiveParagraphOrder['commandSignal'], value: string) => {
    setOrder((prev) => ({
      ...prev,
      commandSignal: { ...prev.commandSignal, [field]: value },
    }));
  };

  // Update annex content
  const updateAnnex = (letter: string, content: string) => {
    setAnnexes((prev) =>
      prev.map((a) => (a.letter === letter ? { ...a, content } : a)),
    );
  };

  // Add a new annex
  const addAnnex = () => {
    const usedLetters = new Set(annexes.map((a) => a.letter));
    const allLetters = 'FGHIJKLMNOPQRSTUVWXYZ'.split('');
    const nextLetter = allLetters.find((l) => !usedLetters.has(l));
    if (nextLetter) {
      setAnnexes((prev) => [
        ...prev,
        { letter: nextLetter, title: `Annex ${nextLetter}`, allowedRoles: ['j3'], content: '' },
      ]);
    }
  };

  // Save plan
  const handleSave = async () => {
    setSaving(true);
    try {
      await jppService.saveStepProduct(jppInstanceId, 'plan_development', {
        roleId: currentRole,
        content: {
          planType,
          fiveParagraphOrder: order,
          annexes,
          gapsWaived,
        },
        status: 'draft',
      });

      if (stepStatus === 'not_started') {
        await jppService.updateStepStatus(jppInstanceId, 'plan_development', 'in_progress');
        setStepStatus('in_progress');
      }
    } catch (err) {
      console.error('[PlanOrderDevelopment] Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  const canApprovePlan = gaps.length === 0 || gapsWaived;

  return (
    <JPPStepLayout
      stepId="plan_development"
      stepLabel="Plan/Order Development"
      stepNumber={7}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-plan-dev-agent"
    >
      {/* Section 1: Plan Type Selection */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5', 'commander']}
        currentRole={currentRole}
        title="Plan Type"
        description="Select the type of plan/order to produce"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {PLAN_TYPES.map((pt) => (
            <label
              key={pt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.5rem',
                backgroundColor:
                  planType === pt.value
                    ? 'rgba(59, 130, 246, 0.15)'
                    : 'rgba(17, 24, 39, 0.4)',
                border:
                  planType === pt.value
                    ? '1px solid rgba(59, 130, 246, 0.4)'
                    : '1px solid rgba(75, 85, 99, 0.3)',
                borderRadius: '0.25rem',
                cursor: 'pointer',
                fontSize: '0.8rem',
                color: '#e5e7eb',
              }}
            >
              <input
                type="radio"
                name="plan-type"
                value={pt.value}
                checked={planType === pt.value}
                onChange={(e) => setPlanType(e.target.value as PlanType)}
                style={{ accentColor: '#3b82f6' }}
              />
              <div>
                <span style={{ fontWeight: 600 }}>{pt.label}</span>
                <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  {pt.description}
                </span>
              </div>
            </label>
          ))}
        </div>
      </RoleGatedSection>

      {/* Section 2: 5-Paragraph Order */}

      {/* Para 1 - Situation */}
      <RoleGatedSection
        allowedRoles={['j2']}
        currentRole={currentRole}
        title="Paragraph 1: Situation"
        description="Enemy, friendly, and environmental situation"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>a. Enemy Forces</label>
            <textarea
              value={order.situation.enemy}
              onChange={(e) => updateSituation('enemy', e.target.value)}
              placeholder="Enemy composition, disposition, strength, capabilities..."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>b. Friendly Forces</label>
            <textarea
              value={order.situation.friendly}
              onChange={(e) => updateSituation('friendly', e.target.value)}
              placeholder="Higher HQ mission, adjacent units, supporting units..."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>c. Environment</label>
            <textarea
              value={order.situation.environment}
              onChange={(e) => updateSituation('environment', e.target.value)}
              placeholder="Terrain, weather, civil considerations..."
              style={textareaStyle}
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* Para 2 - Mission */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5']}
        currentRole={currentRole}
        title="Paragraph 2: Mission"
        description="Auto-populated from Step 2 mission statement, editable"
      >
        <div>
          <label style={labelStyle}>Mission Statement (Who, What, When, Where, Why)</label>
          <textarea
            value={order.mission}
            onChange={(e) => setOrder((prev) => ({ ...prev, mission: e.target.value }))}
            placeholder="Unit mission statement in 5W format..."
            style={{ ...textareaStyle, minHeight: '4rem' }}
          />
          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Pre-populated from Step 2 Mission Analysis. Edit as needed.
          </div>
        </div>
      </RoleGatedSection>

      {/* Para 3 - Execution */}
      <RoleGatedSection
        allowedRoles={['j3']}
        currentRole={currentRole}
        title="Paragraph 3: Execution"
        description="Concept of operations, tasks, and coordinating instructions"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>a. Concept of Operations</label>
            <textarea
              value={order.execution.conceptOfOperations}
              onChange={(e) => updateExecution('conceptOfOperations', e.target.value)}
              placeholder="Scheme of maneuver, phasing, decisive operations..."
              style={{ ...textareaStyle, minHeight: '4rem' }}
            />
          </div>
          <div>
            <label style={labelStyle}>b. Tasks to Subordinate Units</label>
            <textarea
              value={order.execution.tasksToSubordinates}
              onChange={(e) => updateExecution('tasksToSubordinates', e.target.value)}
              placeholder="Specific tasks assigned to each subordinate unit..."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>c. Coordinating Instructions</label>
            <textarea
              value={order.execution.coordinatingInstructions}
              onChange={(e) => updateExecution('coordinatingInstructions', e.target.value)}
              placeholder="Timings, boundaries, control measures, ROE..."
              style={textareaStyle}
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* Para 4 - Sustainment */}
      <RoleGatedSection
        allowedRoles={['j4']}
        currentRole={currentRole}
        title="Paragraph 4: Sustainment"
        description="Logistics, personnel, and health service support"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>a. Logistics</label>
            <textarea
              value={order.sustainment.logistics}
              onChange={(e) => updateSustainment('logistics', e.target.value)}
              placeholder="Supply, transportation, maintenance plans..."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>b. Personnel</label>
            <textarea
              value={order.sustainment.personnel}
              onChange={(e) => updateSustainment('personnel', e.target.value)}
              placeholder="Replacement, medical evacuation..."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>c. Health Services</label>
            <textarea
              value={order.sustainment.healthServices}
              onChange={(e) => updateSustainment('healthServices', e.target.value)}
              placeholder="Health service support plan..."
              style={textareaStyle}
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* Para 5 - Command & Signal */}
      <RoleGatedSection
        allowedRoles={['j6']}
        currentRole={currentRole}
        title="Paragraph 5: Command and Signal"
        description="Command relationships and signal/communications plan"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>a. Command Relationships</label>
            <textarea
              value={order.commandSignal.commandRelationships}
              onChange={(e) => updateCommandSignal('commandRelationships', e.target.value)}
              placeholder="Command post locations, succession, chain of command..."
              style={textareaStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>b. Signal Plan</label>
            <textarea
              value={order.commandSignal.signalPlan}
              onChange={(e) => updateCommandSignal('signalPlan', e.target.value)}
              placeholder="Frequencies, call signs, code words, pyrotechnics..."
              style={textareaStyle}
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* Section 3: Annexes */}
      <RoleGatedSection
        allowedRoles={['j2', 'j3', 'j4', 'j5', 'j6', 'j34', 'fires_coordinator']}
        currentRole={currentRole}
        title="Annexes"
        description="Standard annexes A-E plus extensible additional annexes"
      >
        {annexes.map((annex) => {
          const isExpanded = expandedAnnex === annex.letter;
          const canEditAnnex = annex.allowedRoles.includes(currentRole);

          return (
            <div key={annex.letter} style={cardStyle}>
              <button
                onClick={() => setExpandedAnnex(isExpanded ? null : annex.letter)}
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
                <span>
                  Annex {annex.letter} - {annex.title}
                  {!canEditAnnex && (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.65rem',
                        color: '#6b7280',
                        fontWeight: 400,
                      }}
                    >
                      (read-only for {currentRole})
                    </span>
                  )}
                </span>
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

              {isExpanded && (
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={sectionDividerStyle}>
                    Roles: {annex.allowedRoles.join(', ')}
                  </div>
                  <textarea
                    value={annex.content}
                    onChange={(e) => updateAnnex(annex.letter, e.target.value)}
                    placeholder={`Content for Annex ${annex.letter} - ${annex.title}...`}
                    style={{
                      ...textareaStyle,
                      minHeight: '6rem',
                      ...(canEditAnnex
                        ? {}
                        : { pointerEvents: 'none' as const, opacity: 0.6 }),
                    }}
                    readOnly={!canEditAnnex}
                  />
                </div>
              )}
            </div>
          );
        })}
        <button
          onClick={addAnnex}
          style={{
            padding: '0.375rem 0.75rem',
            fontSize: '0.75rem',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0.25rem',
            color: '#93c5fd',
            cursor: 'pointer',
            marginTop: '0.25rem',
          }}
        >
          + Add Annex
        </button>
      </RoleGatedSection>

      {/* Section 4: E-W-M Gap Check (read-only) */}
      <RoleGatedSection
        allowedRoles={[]}
        currentRole={currentRole}
        title="E-W-M Gap Check"
        description="Unresolved Ends-Ways-Means gaps must be addressed before plan approval"
      >
        {gapsLoading ? (
          <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>Loading gap analysis...</p>
        ) : gaps.length === 0 ? (
          <div
            style={{
              padding: '0.5rem 0.75rem',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '0.25rem',
              color: '#6ee7b7',
              fontSize: '0.8rem',
            }}
          >
            No E-W-M gaps detected. Plan is ready for approval.
          </div>
        ) : (
          <div>
            <div style={warningStyle}>
              {gaps.length} unresolved gap{gaps.length !== 1 ? 's' : ''} detected. Address before plan approval.
            </div>
            {gaps.map((gap, idx) => (
              <div
                key={idx}
                style={{
                  ...warningStyle,
                  backgroundColor: 'rgba(245, 158, 11, 0.05)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  [{gap.type.replace(/_/g, ' ').toUpperCase()}] {gap.entityName}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#d97706', marginTop: '0.125rem' }}>
                  {gap.details}
                </div>
              </div>
            ))}
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                marginTop: '0.5rem',
                fontSize: '0.8rem',
                color: '#fbbf24',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={gapsWaived}
                onChange={(e) => setGapsWaived(e.target.checked)}
                style={{ accentColor: '#f59e0b' }}
              />
              Waive remaining gaps (commander authorization required)
            </label>
          </div>
        )}
      </RoleGatedSection>

      {/* Save Button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <button onClick={handleSave} disabled={saving} style={saveButtonStyle}>
          {saving ? 'Saving...' : `Save ${planType}`}
        </button>

        {/* Section 5: Plan Approval Gate */}
        <div
          style={{
            opacity: canApprovePlan ? 1 : 0.5,
            pointerEvents: canApprovePlan ? 'auto' : 'none',
          }}
        >
          <GateSubmitButton
            gateType="plan_approval"
            itemId={`${jppInstanceId}-plan-approval`}
            itemTitle={`${planType} Approval`}
            itemDescription={
              canApprovePlan
                ? `Submit ${planType} for final commander approval`
                : `Cannot approve: ${gaps.length} E-W-M gap(s) unresolved`
            }
            tabId="plan"
          />
        </div>
      </div>
      {!canApprovePlan && (
        <div style={{ textAlign: 'right', fontSize: '0.7rem', color: '#f59e0b', marginTop: '0.25rem' }}>
          Plan approval gate disabled: resolve E-W-M gaps or waive them first
        </div>
      )}

      {/* Section 6: Document Export (only visible after plan approval) */}
      {stepStatus === 'approved' && (
        <div style={{ marginTop: '1rem' }}>
          <DocumentExport
            problemSetId={problemSetId}
            jppInstanceId={jppInstanceId}
            planId={`${jppInstanceId}-plan`}
            planType={planType}
            currentRole={currentRole}
            availableAnnexes={annexes.map((a) => ({ letter: a.letter, title: a.title }))}
          />
        </div>
      )}

      {/* Section 7: Version History (always visible, collapsible) */}
      <div style={{ marginTop: '1rem' }}>
        <DocumentVersionHistory
          problemSetId={problemSetId}
          planId={`${jppInstanceId}-plan`}
        />
      </div>
    </JPPStepLayout>
  );
}
