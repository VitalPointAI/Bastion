/**
 * PlanningInitiation (JPP Step 1)
 *
 * Phase 33 Plan 06: Planning Initiation step with commander guidance,
 * staff estimates, planning timeline, and higher HQ guidance inheritance.
 * Uses role-gated sections to control edit access by staff role.
 */

import { useState, useEffect, useCallback } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type JPPStepProduct, type StepStatus } from '../../lib/jpp-service.ts';

// ─── Types ─────────────────────────────────────────────────────────────────

interface TimelineMilestone {
  name: string;
  date: string;
}

interface CommanderGuidanceContent {
  commanderGuidance: string;
  problemStatement: string;
  timeline: TimelineMilestone[];
  priorities: string[];
}

interface StaffEstimateContent {
  assessment: string;
}

interface PlanningTimelineContent {
  milestones: TimelineMilestone[];
}

interface ParentGuidance {
  commanderGuidance?: string;
  strategicObjectives?: string[];
  constraints?: string[];
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface PlanningInitiationProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

// ─── Staff function definitions ────────────────────────────────────────────

const STAFF_FUNCTIONS = [
  { id: 'j1', label: 'J1 - Personnel', role: 'j1' },
  { id: 'j2', label: 'J2 - Intelligence', role: 'j2' },
  { id: 'j3', label: 'J3 - Operations', role: 'j3' },
  { id: 'j4', label: 'J4 - Logistics', role: 'j4' },
  { id: 'j5', label: 'J5 - Plans', role: 'j5' },
  { id: 'j6', label: 'J6 - Communications', role: 'j6' },
] as const;

const PLANNING_MILESTONES_DEFAULT: TimelineMilestone[] = [
  { name: 'Mission Analysis Brief', date: '' },
  { name: 'COA Brief', date: '' },
  { name: 'Decision Brief', date: '' },
  { name: 'Order Publication', date: '' },
];

// ─── Styles ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  backgroundColor: 'rgba(31, 41, 55, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  color: '#e5e7eb',
  fontSize: '0.85rem',
  resize: 'vertical' as const,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 500,
  color: '#9ca3af',
  marginBottom: '0.25rem',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.4)',
  border: '1px solid rgba(75, 85, 99, 0.3)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.5rem',
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

const removeButtonStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.7rem',
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '0.25rem',
  color: '#fca5a5',
  cursor: 'pointer',
};

// ─── Component ─────────────────────────────────────────────────────────────

export function PlanningInitiation({
  problemSetId,
  jppInstanceId,
  currentRole,
}: PlanningInitiationProps) {
  // Parent HQ guidance
  const [parentGuidance, setParentGuidance] = useState<ParentGuidance | null>(null);
  const [hasParent, setHasParent] = useState(false);

  // Commander's guidance
  const [commanderGuidance, setCommanderGuidance] = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [guidanceTimeline, setGuidanceTimeline] = useState<TimelineMilestone[]>([]);
  const [guidanceProductId, setGuidanceProductId] = useState<string | undefined>();

  // Staff estimates
  const [staffEstimates, setStaffEstimates] = useState<Record<string, string>>({});
  const [staffProductIds, setStaffProductIds] = useState<Record<string, string>>({});

  // Planning timeline
  const [planningMilestones, setPlanningMilestones] = useState<TimelineMilestone[]>(
    PLANNING_MILESTONES_DEFAULT.map((m) => ({ ...m })),
  );
  const [timelineProductId, setTimelineProductId] = useState<string | undefined>();

  // Collapsible staff sections
  const [expandedStaff, setExpandedStaff] = useState<Record<string, boolean>>({});

  // Step status
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');

  // ─── Load existing data ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch parent products for HQ guidance
        const parentData = await jppService.getParentProducts(jppInstanceId);
        if (!cancelled) {
          setHasParent(!!parentData.parentJppId);
          if (parentData.parentJppId && parentData.products.planning_initiation) {
            const parentProducts = parentData.products.planning_initiation;
            const cmdProduct = parentProducts.find(
              (p: JPPStepProduct) =>
                (p.content as unknown as CommanderGuidanceContent).commanderGuidance !== undefined,
            );
            if (cmdProduct) {
              const content = cmdProduct.content as unknown as CommanderGuidanceContent;
              setParentGuidance({
                commanderGuidance: content.commanderGuidance,
                strategicObjectives: content.priorities,
                constraints: [],
              });
            }
          }
        }
      } catch {
        // No parent available
        if (!cancelled) setHasParent(false);
      }

      try {
        // Fetch existing step products
        const products = await jppService.getStepProducts(jppInstanceId, 'planning_initiation');
        if (cancelled) return;

        for (const product of products) {
          const content = product.content as Record<string, unknown>;

          // Commander's guidance product
          if (content.commanderGuidance !== undefined) {
            const gc = content as unknown as CommanderGuidanceContent;
            setCommanderGuidance(gc.commanderGuidance || '');
            setProblemStatement(gc.problemStatement || '');
            setPriorities(gc.priorities || []);
            setGuidanceTimeline(gc.timeline || []);
            setGuidanceProductId(product.id);
          }

          // Staff estimate products (keyed by roleId)
          if (content.assessment !== undefined) {
            setStaffEstimates((prev) => ({ ...prev, [product.roleId]: (content as StaffEstimateContent).assessment }));
            setStaffProductIds((prev) => ({ ...prev, [product.roleId]: product.id }));
          }

          // Planning timeline product
          if (content.milestones !== undefined && content.assessment === undefined) {
            setPlanningMilestones((content as unknown as PlanningTimelineContent).milestones);
            setTimelineProductId(product.id);
          }
        }
      } catch {
        // Products not yet created
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [jppInstanceId]);

  // ─── Auto-save helpers ─────────────────────────────────────────────────

  const saveCommanderGuidance = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'planning_initiation', {
        roleId: 'commander',
        content: {
          commanderGuidance,
          problemStatement,
          timeline: guidanceTimeline,
          priorities,
        },
        status: 'draft',
        id: guidanceProductId,
      });
      setGuidanceProductId(result.id);
    } catch {
      // Save failed silently -- could add error toast
    }
  }, [jppInstanceId, commanderGuidance, problemStatement, guidanceTimeline, priorities, guidanceProductId]);

  const saveStaffEstimate = useCallback(
    async (roleId: string, assessment: string) => {
      try {
        const result = await jppService.saveStepProduct(jppInstanceId, 'planning_initiation', {
          roleId,
          content: { assessment },
          status: 'draft',
          id: staffProductIds[roleId],
        });
        setStaffProductIds((prev) => ({ ...prev, [roleId]: result.id }));
      } catch {
        // Save failed silently
      }
    },
    [jppInstanceId, staffProductIds],
  );

  const savePlanningTimeline = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'planning_initiation', {
        roleId: 'j5',
        content: { milestones: planningMilestones },
        status: 'draft',
        id: timelineProductId,
      });
      setTimelineProductId(result.id);
    } catch {
      // Save failed silently
    }
  }, [jppInstanceId, planningMilestones, timelineProductId]);

  // ─── Priority management ──────────────────────────────────────────────

  const addPriority = () => setPriorities((prev) => [...prev, '']);
  const removePriority = (index: number) =>
    setPriorities((prev) => prev.filter((_, i) => i !== index));
  const updatePriority = (index: number, value: string) =>
    setPriorities((prev) => prev.map((p, i) => (i === index ? value : p)));

  // ─── Guidance timeline management ────────────────────────────────────

  const addGuidanceMilestone = () =>
    setGuidanceTimeline((prev) => [...prev, { name: '', date: '' }]);
  const removeGuidanceMilestone = (index: number) =>
    setGuidanceTimeline((prev) => prev.filter((_, i) => i !== index));
  const updateGuidanceMilestone = (index: number, field: 'name' | 'date', value: string) =>
    setGuidanceTimeline((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );

  // ─── Planning milestone management ──────────────────────────────────

  const updatePlanningMilestone = (index: number, field: 'name' | 'date', value: string) =>
    setPlanningMilestones((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)),
    );

  // ─── Staff section toggle ────────────────────────────────────────────

  const toggleStaff = (id: string) =>
    setExpandedStaff((prev) => ({ ...prev, [id]: !prev[id] }));

  void stepStatus;
  void setStepStatus;
  void problemSetId;

  return (
    <JPPStepLayout
      stepId="planning_initiation"
      stepLabel="Planning Initiation"
      stepNumber={1}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-planning-init-agent"
    >
      {/* ── Section 1: Higher HQ Guidance (read-only) ──────────────────── */}
      <RoleGatedSection
        allowedRoles={[]}
        currentRole={currentRole}
        title="Higher Headquarters Guidance"
        description="Inherited guidance from parent echelon JPP (read-only)"
      >
        {hasParent && parentGuidance ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {parentGuidance.commanderGuidance && (
              <div style={cardStyle}>
                <label style={labelStyle}>Commander&apos;s Guidance (Higher HQ)</label>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#d1d5db', whiteSpace: 'pre-wrap' }}>
                  {parentGuidance.commanderGuidance}
                </p>
              </div>
            )}
            {parentGuidance.strategicObjectives && parentGuidance.strategicObjectives.length > 0 && (
              <div style={cardStyle}>
                <label style={labelStyle}>Strategic Objectives</label>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#d1d5db', fontSize: '0.85rem' }}>
                  {parentGuidance.strategicObjectives.map((obj, i) => (
                    <li key={i}>{obj}</li>
                  ))}
                </ul>
              </div>
            )}
            {parentGuidance.constraints && parentGuidance.constraints.length > 0 && (
              <div style={cardStyle}>
                <label style={labelStyle}>Constraints</label>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#d1d5db', fontSize: '0.85rem' }}>
                  {parentGuidance.constraints.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              ...cardStyle,
              textAlign: 'center',
              color: '#6b7280',
              fontSize: '0.85rem',
              fontStyle: 'italic',
            }}
          >
            No higher headquarters guidance available
          </div>
        )}
      </RoleGatedSection>

      {/* ── Section 2: Commander's Guidance ─────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['commander', 'xo', 'chief_of_staff']}
        currentRole={currentRole}
        title="Commander's Guidance"
        description="Initial guidance, problem statement, priorities, and planning timeline"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Commander&apos;s Initial Guidance</label>
            <textarea
              style={{ ...inputStyle, minHeight: '6rem' }}
              value={commanderGuidance}
              onChange={(e) => setCommanderGuidance(e.target.value)}
              onBlur={saveCommanderGuidance}
              placeholder="Enter commander's initial planning guidance..."
            />
          </div>

          <div>
            <label style={labelStyle}>Problem Statement</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={problemStatement}
              onChange={(e) => setProblemStatement(e.target.value)}
              onBlur={saveCommanderGuidance}
              placeholder="Define the problem to be solved..."
            />
          </div>

          {/* Planning Timeline (within commander's guidance) */}
          <div>
            <label style={labelStyle}>Planning Timeline</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {guidanceTimeline.map((milestone, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <input
                    style={{ ...inputStyle, flex: 2 }}
                    value={milestone.name}
                    onChange={(e) => updateGuidanceMilestone(i, 'name', e.target.value)}
                    onBlur={saveCommanderGuidance}
                    placeholder="Milestone name"
                  />
                  <input
                    type="date"
                    style={{ ...inputStyle, flex: 1 }}
                    value={milestone.date}
                    onChange={(e) => updateGuidanceMilestone(i, 'date', e.target.value)}
                    onBlur={saveCommanderGuidance}
                  />
                  <button style={removeButtonStyle} onClick={() => removeGuidanceMilestone(i)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button style={{ ...buttonStyle, marginTop: '0.375rem' }} onClick={addGuidanceMilestone}>
              + Add Milestone
            </button>
          </div>

          {/* Priorities */}
          <div>
            <label style={labelStyle}>Priorities (ordered)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
              {priorities.map((priority, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span
                    style={{
                      width: '1.5rem',
                      textAlign: 'center',
                      fontSize: '0.75rem',
                      color: '#9ca3af',
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}.
                  </span>
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={priority}
                    onChange={(e) => updatePriority(i, e.target.value)}
                    onBlur={saveCommanderGuidance}
                    placeholder={`Priority ${i + 1}`}
                  />
                  <button style={removeButtonStyle} onClick={() => removePriority(i)}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button style={{ ...buttonStyle, marginTop: '0.375rem' }} onClick={addPriority}>
              + Add Priority
            </button>
          </div>
        </div>
      </RoleGatedSection>

      {/* ── Section 3: Initial Staff Estimates ─────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j1', 'j2', 'j3', 'j4', 'j5', 'j6']}
        currentRole={currentRole}
        title="Initial Staff Estimates"
        description="Staff-section initial assessments (each section gated to its J-code)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {STAFF_FUNCTIONS.map((sf) => {
            const isExpanded = expandedStaff[sf.id] ?? false;
            const canEditThis = currentRole === sf.role;

            return (
              <div key={sf.id} style={cardStyle}>
                <button
                  onClick={() => toggleStaff(sf.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: '#e5e7eb',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.65rem',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                  >
                    &#9660;
                  </span>
                  <span>{sf.label}</span>
                  {!canEditThis && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.65rem',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '0.25rem',
                        backgroundColor: 'rgba(107, 114, 128, 0.3)',
                        color: '#9ca3af',
                      }}
                    >
                      read-only
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <textarea
                      style={{
                        ...inputStyle,
                        minHeight: '4rem',
                        ...(canEditThis
                          ? {}
                          : { pointerEvents: 'none' as const, opacity: 0.75 }),
                      }}
                      value={staffEstimates[sf.role] || ''}
                      onChange={(e) => {
                        if (canEditThis) {
                          setStaffEstimates((prev) => ({ ...prev, [sf.role]: e.target.value }));
                        }
                      }}
                      onBlur={() => {
                        if (canEditThis) {
                          saveStaffEstimate(sf.role, staffEstimates[sf.role] || '');
                        }
                      }}
                      placeholder={`${sf.label} initial assessment...`}
                      readOnly={!canEditThis}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </RoleGatedSection>

      {/* ── Section 4: Planning Timeline ───────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j5', 'j3', 'chief_of_staff']}
        currentRole={currentRole}
        title="Planning Timeline"
        description="Key dates for mission analysis brief, COA brief, decision brief, and order publication"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '0.5rem',
              padding: '0.375rem 0.5rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#9ca3af',
              borderBottom: '1px solid rgba(75, 85, 99, 0.3)',
            }}
          >
            <span>Milestone</span>
            <span>Date</span>
          </div>
          {planningMilestones.map((milestone, i) => (
            <div
              key={i}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr',
                gap: '0.5rem',
                alignItems: 'center',
              }}
            >
              <input
                style={inputStyle}
                value={milestone.name}
                onChange={(e) => updatePlanningMilestone(i, 'name', e.target.value)}
                onBlur={savePlanningTimeline}
                placeholder="Milestone name"
              />
              <input
                type="date"
                style={inputStyle}
                value={milestone.date}
                onChange={(e) => updatePlanningMilestone(i, 'date', e.target.value)}
                onBlur={savePlanningTimeline}
              />
            </div>
          ))}
        </div>
      </RoleGatedSection>
    </JPPStepLayout>
  );
}
