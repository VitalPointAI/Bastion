/**
 * COADevelopment (JPP Step 3)
 *
 * Phase 33 Plan 06: COA Development step that pulls LOEs from Design tab
 * as input, enables COA drafting with E-W-M linkage creation, and includes
 * governance gate for COA development info brief.
 */

import { useState, useEffect, useCallback } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type StepStatus } from '../../lib/jpp-service.ts';
import { designService, type LineOfEffort, type DesignStatus } from '../../lib/design-service.ts';
import { DesignContextPanel } from './DesignContextPanel.tsx';
import { ewmService, type EWMLinkage, type EWMGap } from '../../lib/ewm-service.ts';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SubordinateTask {
  unitId: string;
  task: string;
  purpose: string;
}

interface COA {
  id: string;
  number: number;
  name: string;
  description: string;
  schemeOfManeuver: string;
  decisiveOperation: string;
  shapingOperations: string;
  sustainingOperations: string;
  subordinateTasks: SubordinateTask[];
}

interface COAContent {
  coas: COA[];
}

interface ObjectiveOption {
  id: string;
  name: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface COADevelopmentProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

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

const loeCardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(16, 185, 129, 0.08)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.5rem',
};

const warningCardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(245, 158, 11, 0.1)',
  border: '1px solid rgba(245, 158, 11, 0.3)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.5rem',
  color: '#fde68a',
  fontSize: '0.85rem',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

let nextId = 0;
function genId() {
  nextId += 1;
  return `coa-${Date.now()}-${nextId}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function COADevelopment({
  problemSetId,
  jppInstanceId,
  currentRole,
}: COADevelopmentProps) {
  // LOEs from Design tab (read-only input)
  const [loes, setLoes] = useState<LineOfEffort[]>([]);
  const [designStatus, setDesignStatus] = useState<DesignStatus | null>(null);

  // COAs
  const [coas, setCoas] = useState<COA[]>([]);
  const [coaProductId, setCoaProductId] = useState<string | undefined>();
  const [expandedCoas, setExpandedCoas] = useState<Record<string, boolean>>({});

  // E-W-M linkages
  const [linkages, setLinkages] = useState<EWMLinkage[]>([]);
  const [gaps, setGaps] = useState<EWMGap[]>([]);

  // Objectives (from strategic objectives / parent products)
  const [objectives, setObjectives] = useState<ObjectiveOption[]>([]);

  // Step status
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');

  // ─── Load existing data ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Load LOEs and status from Design tab
      try {
        const [design, status] = await Promise.all([
          designService.getDesign(problemSetId),
          designService.getStatus(problemSetId),
        ]);
        if (!cancelled && design.linesOfEffort) {
          setLoes(design.linesOfEffort);
          setDesignStatus(status);
          // Extract objectives from LOE objective references
          const objList: ObjectiveOption[] = design.linesOfEffort
            .filter((loe) => loe.objectiveId)
            .map((loe) => ({
              id: loe.objectiveId!,
              name: `Objective for ${loe.name}`,
            }));
          // Deduplicate
          const seen = new Set<string>();
          setObjectives(
            objList.filter((o) => {
              if (seen.has(o.id)) return false;
              seen.add(o.id);
              return true;
            }),
          );
        }
      } catch {
        // Design not yet created
      }

      // Load existing COA products
      try {
        const products = await jppService.getStepProducts(jppInstanceId, 'coa_development');
        if (!cancelled) {
          for (const product of products) {
            const content = product.content as Record<string, unknown>;
            if (content.coas !== undefined) {
              setCoas((content as unknown as COAContent).coas || []);
              setCoaProductId(product.id);
            }
          }
        }
      } catch {
        // Products not yet created
      }

      // Load E-W-M linkages
      try {
        const existingLinkages = await ewmService.getLinkages(jppInstanceId);
        if (!cancelled) setLinkages(existingLinkages);
      } catch {
        // No linkages yet
      }

      // Load gap analysis
      try {
        const existingGaps = await ewmService.getGaps(jppInstanceId);
        if (!cancelled) setGaps(existingGaps);
      } catch {
        // No gaps data
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [problemSetId, jppInstanceId]);

  // ─── Save helpers ──────────────────────────────────────────────────────

  const saveCOAs = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'coa_development', {
        roleId: 'j3',
        content: { coas },
        status: 'draft',
        id: coaProductId,
      });
      setCoaProductId(result.id);
    } catch {
      // Save failed
    }
  }, [jppInstanceId, coas, coaProductId]);

  // ─── COA management ────────────────────────────────────────────────────

  const addCOA = () => {
    const newNum = coas.length + 1;
    const newCoa: COA = {
      id: genId(),
      number: newNum,
      name: '',
      description: '',
      schemeOfManeuver: '',
      decisiveOperation: '',
      shapingOperations: '',
      sustainingOperations: '',
      subordinateTasks: [],
    };
    setCoas((prev) => [...prev, newCoa]);
    setExpandedCoas((prev) => ({ ...prev, [newCoa.id]: true }));
  };

  const removeCOA = (id: string) =>
    setCoas((prev) => prev.filter((c) => c.id !== id));

  const updateCOA = (id: string, field: keyof COA, value: string) =>
    setCoas((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)),
    );

  const toggleCoa = (id: string) =>
    setExpandedCoas((prev) => ({ ...prev, [id]: !prev[id] }));

  // Subordinate task management
  const addSubTask = (coaId: string) =>
    setCoas((prev) =>
      prev.map((c) =>
        c.id === coaId
          ? { ...c, subordinateTasks: [...c.subordinateTasks, { unitId: '', task: '', purpose: '' }] }
          : c,
      ),
    );

  const removeSubTask = (coaId: string, index: number) =>
    setCoas((prev) =>
      prev.map((c) =>
        c.id === coaId
          ? { ...c, subordinateTasks: c.subordinateTasks.filter((_, i) => i !== index) }
          : c,
      ),
    );

  const updateSubTask = (coaId: string, index: number, field: keyof SubordinateTask, value: string) =>
    setCoas((prev) =>
      prev.map((c) =>
        c.id === coaId
          ? {
              ...c,
              subordinateTasks: c.subordinateTasks.map((st, i) =>
                i === index ? { ...st, [field]: value } : st,
              ),
            }
          : c,
      ),
    );

  // ─── E-W-M linkage creation ────────────────────────────────────────────

  const linkCOAToObjective = useCallback(
    async (coaId: string, objectiveId: string) => {
      if (!objectiveId) return;
      try {
        const newLinkage = await ewmService.createLinkage(jppInstanceId, {
          endObjectiveId: objectiveId,
          wayId: coaId,
          wayType: 'coa',
        });
        setLinkages((prev) => [...prev, newLinkage]);
        // Refresh gaps
        const updatedGaps = await ewmService.getGaps(jppInstanceId);
        setGaps(updatedGaps);
      } catch {
        // Linkage creation failed
      }
    },
    [jppInstanceId],
  );

  const linkCOAToLOE = useCallback(
    async (coaId: string, loeId: string) => {
      if (!loeId) return;
      // Find objective for this LOE
      const loe = loes.find((l) => l.id === loeId);
      const objectiveId = loe?.objectiveId || loeId; // fallback to loeId if no objective
      try {
        const newLinkage = await ewmService.createLinkage(jppInstanceId, {
          endObjectiveId: objectiveId,
          wayId: coaId,
          wayType: 'coa',
        });
        setLinkages((prev) => [...prev, newLinkage]);
        const updatedGaps = await ewmService.getGaps(jppInstanceId);
        setGaps(updatedGaps);
      } catch {
        // Linkage creation failed
      }
    },
    [jppInstanceId, loes],
  );

  const removeLinkage = useCallback(
    async (linkageId: string) => {
      try {
        await ewmService.deleteLinkage(jppInstanceId, linkageId);
        setLinkages((prev) => prev.filter((l) => l.id !== linkageId));
        const updatedGaps = await ewmService.getGaps(jppInstanceId);
        setGaps(updatedGaps);
      } catch {
        // Delete failed
      }
    },
    [jppInstanceId],
  );

  // Get linkages for a specific COA
  const getCoaLinkages = (coaId: string) =>
    linkages.filter((l) => l.wayId === coaId);

  void stepStatus;
  void setStepStatus;

  return (
    <JPPStepLayout
      stepId="coa_development"
      stepLabel="COA Development"
      stepNumber={3}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-coa-dev-agent"
    >
      {/* ── Design Context: Lines of Effort (from Design tab) ─────────── */}
      <DesignContextPanel
        title="Lines of Effort (from Design)"
        artifact="lines-of-effort"
        data={loes}
        sectionStatus={designStatus?.linesOfEffort ?? 'not-started'}
        problemSetId={problemSetId}
      />

      {/* ── Section 1: LOE Input (read-only from Design tab) ───────────── */}
      <RoleGatedSection
        allowedRoles={[]}
        currentRole={currentRole}
        title="Lines of Effort (from Operational Design)"
        description="Reference material from the Design tab -- not editable here"
      >
        {loes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {loes.map((loe) => (
              <div key={loe.id} style={loeCardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.375rem' }}>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '0.25rem',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      color: '#a7f3d0',
                      fontWeight: 600,
                    }}
                  >
                    LOE {loe.order}
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db' }}>{loe.name}</span>
                </div>
                <p style={{ margin: '0 0 0.375rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                  {loe.description}
                </p>
                {loe.decisivePoints.length > 0 && (
                  <div>
                    <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>
                      Decisive Points:
                    </span>
                    <ul style={{ margin: '0.25rem 0 0', paddingLeft: '1rem', fontSize: '0.8rem', color: '#9ca3af' }}>
                      {loe.decisivePoints.map((dp) => (
                        <li key={dp.id}>{dp.label}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
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
            No Lines of Effort defined in Operational Design. Complete the Design tab first.
          </div>
        )}
      </RoleGatedSection>

      {/* ── Section 2: COA Workspace ───────────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5', 'commander']}
        currentRole={currentRole}
        title="COA Workspace"
        description="Draft courses of action for this planning effort"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {coas.map((coa) => {
            const isExpanded = expandedCoas[coa.id] ?? false;

            return (
              <div key={coa.id} style={cardStyle}>
                {/* COA header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button
                    onClick={() => toggleCoa(coa.id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: '#e5e7eb',
                      fontSize: '0.65rem',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      transition: 'transform 0.15s',
                    }}
                  >
                    &#9660;
                  </button>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      padding: '0.125rem 0.5rem',
                      borderRadius: '0.25rem',
                      backgroundColor: 'rgba(59, 130, 246, 0.2)',
                      color: '#93c5fd',
                      fontWeight: 600,
                    }}
                  >
                    COA {coa.number}
                  </span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: '#e5e7eb' }}>
                    {coa.name || `(unnamed)`}
                  </span>
                  <button
                    style={{ ...removeButtonStyle, marginLeft: 'auto' }}
                    onClick={() => removeCOA(coa.id)}
                  >
                    Remove
                  </button>
                </div>

                {/* COA details (expanded) */}
                {isExpanded && (
                  <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <div>
                      <label style={labelStyle}>COA Name</label>
                      <input
                        style={inputStyle}
                        value={coa.name}
                        onChange={(e) => updateCOA(coa.id, 'name', e.target.value)}
                        onBlur={saveCOAs}
                        placeholder="COA name..."
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Description</label>
                      <textarea
                        style={{ ...inputStyle, minHeight: '3rem' }}
                        value={coa.description}
                        onChange={(e) => updateCOA(coa.id, 'description', e.target.value)}
                        onBlur={saveCOAs}
                        placeholder="COA description..."
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Scheme of Maneuver</label>
                      <textarea
                        style={{ ...inputStyle, minHeight: '4rem' }}
                        value={coa.schemeOfManeuver}
                        onChange={(e) => updateCOA(coa.id, 'schemeOfManeuver', e.target.value)}
                        onBlur={saveCOAs}
                        placeholder="Scheme of maneuver..."
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                      <div>
                        <label style={labelStyle}>Decisive Operation</label>
                        <textarea
                          style={{ ...inputStyle, minHeight: '3rem' }}
                          value={coa.decisiveOperation}
                          onChange={(e) => updateCOA(coa.id, 'decisiveOperation', e.target.value)}
                          onBlur={saveCOAs}
                          placeholder="Decisive operation..."
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Shaping Operations</label>
                        <textarea
                          style={{ ...inputStyle, minHeight: '3rem' }}
                          value={coa.shapingOperations}
                          onChange={(e) => updateCOA(coa.id, 'shapingOperations', e.target.value)}
                          onBlur={saveCOAs}
                          placeholder="Shaping operations..."
                        />
                      </div>
                      <div>
                        <label style={labelStyle}>Sustaining Operations</label>
                        <textarea
                          style={{ ...inputStyle, minHeight: '3rem' }}
                          value={coa.sustainingOperations}
                          onChange={(e) => updateCOA(coa.id, 'sustainingOperations', e.target.value)}
                          onBlur={saveCOAs}
                          placeholder="Sustaining operations..."
                        />
                      </div>
                    </div>

                    {/* Subordinate Tasks */}
                    <div>
                      <label style={labelStyle}>Subordinate Tasks</label>
                      {coa.subordinateTasks.map((st, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 2fr 2fr auto',
                            gap: '0.375rem',
                            marginBottom: '0.25rem',
                            alignItems: 'center',
                          }}
                        >
                          <input
                            style={inputStyle}
                            value={st.unitId}
                            onChange={(e) => updateSubTask(coa.id, i, 'unitId', e.target.value)}
                            onBlur={saveCOAs}
                            placeholder="Unit"
                          />
                          <input
                            style={inputStyle}
                            value={st.task}
                            onChange={(e) => updateSubTask(coa.id, i, 'task', e.target.value)}
                            onBlur={saveCOAs}
                            placeholder="Task"
                          />
                          <input
                            style={inputStyle}
                            value={st.purpose}
                            onChange={(e) => updateSubTask(coa.id, i, 'purpose', e.target.value)}
                            onBlur={saveCOAs}
                            placeholder="Purpose"
                          />
                          <button style={removeButtonStyle} onClick={() => removeSubTask(coa.id, i)}>
                            Remove
                          </button>
                        </div>
                      ))}
                      <button style={buttonStyle} onClick={() => addSubTask(coa.id)}>
                        + Add Subordinate Task
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <button
            style={{
              ...buttonStyle,
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 500,
            }}
            onClick={addCOA}
          >
            + New COA
          </button>
        </div>
      </RoleGatedSection>

      {/* ── Section 3: E-W-M Linkage ──────────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5']}
        currentRole={currentRole}
        title="Ends-Ways-Means Linkage"
        description="Link COAs to objectives and LOEs to establish E-W-M traceability"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {coas.length === 0 ? (
            <div style={{ ...cardStyle, color: '#6b7280', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center' }}>
              Create COAs above to begin linking
            </div>
          ) : (
            coas.map((coa) => {
              const coaLinks = getCoaLinkages(coa.id);
              return (
                <div key={coa.id} style={cardStyle}>
                  <div style={{ marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e5e7eb' }}>
                      COA {coa.number}: {coa.name || '(unnamed)'}
                    </span>
                  </div>

                  {/* Existing linkages */}
                  {coaLinks.length > 0 && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <label style={labelStyle}>Current Linkages</label>
                      {coaLinks.map((link) => (
                        <div
                          key={link.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            marginBottom: '0.25rem',
                            fontSize: '0.8rem',
                            color: '#d1d5db',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.65rem',
                              padding: '0.125rem 0.375rem',
                              borderRadius: '0.25rem',
                              backgroundColor: 'rgba(16, 185, 129, 0.2)',
                              color: '#a7f3d0',
                            }}
                          >
                            {link.wayType.toUpperCase()}
                          </span>
                          <span>Objective: {link.endObjectiveId.slice(0, 12)}...</span>
                          <button
                            style={{ ...removeButtonStyle, marginLeft: 'auto', fontSize: '0.65rem' }}
                            onClick={() => removeLinkage(link.id)}
                          >
                            Unlink
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Link to objective */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.375rem' }}>
                    <select
                      style={{ ...inputStyle, width: 'auto', flex: 1 }}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          linkCOAToObjective(coa.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Link to Objective...</option>
                      {objectives.map((obj) => (
                        <option key={obj.id} value={obj.id}>
                          {obj.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Link to LOE */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <select
                      style={{ ...inputStyle, width: 'auto', flex: 1 }}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) {
                          linkCOAToLOE(coa.id, e.target.value);
                          e.target.value = '';
                        }
                      }}
                    >
                      <option value="">Link to LOE...</option>
                      {loes.map((loe) => (
                        <option key={loe.id} value={loe.id}>
                          LOE {loe.order}: {loe.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })
          )}

          {/* Gap warnings */}
          {gaps.filter((g) => g.type === 'unlinked_end').length > 0 && (
            <div>
              <label style={{ ...labelStyle, color: '#fde68a' }}>Gap Warnings</label>
              {gaps
                .filter((g) => g.type === 'unlinked_end')
                .map((gap) => (
                  <div key={gap.entityId} style={warningCardStyle}>
                    <strong>{gap.entityName}</strong>: {gap.details}
                  </div>
                ))}
            </div>
          )}
        </div>
      </RoleGatedSection>

      {/* ── Section 4: Governance Gate ─────────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['commander', 'xo', 'chief_of_staff', 'j3', 'j5', 'j1', 'j2', 'j4', 'j6']}
        currentRole={currentRole}
        title="Governance Gate"
        description="COA Development information brief submission"
      >
        <div style={cardStyle}>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#9ca3af' }}>
            The COA Development governance gate is managed by the step layout above.
            When all COAs are drafted and linked, use the &quot;Submit for Approval&quot; button
            to initiate the COA selection decision brief.
          </p>
          <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280' }}>
            <span>COAs drafted: {coas.length}</span>
            {' | '}
            <span>E-W-M linkages: {linkages.length}</span>
            {' | '}
            <span style={{ color: gaps.length > 0 ? '#fde68a' : '#a7f3d0' }}>
              Gaps: {gaps.filter((g) => g.type === 'unlinked_end').length}
            </span>
          </div>
        </div>
      </RoleGatedSection>
    </JPPStepLayout>
  );
}
