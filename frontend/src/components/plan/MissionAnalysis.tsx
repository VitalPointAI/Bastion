/**
 * MissionAnalysis (JPP Step 2)
 *
 * Phase 33 Plan 06: Mission Analysis step with IPB, task analysis,
 * mission statement (5W), and commander's intent (Klein 7 facets).
 * Uses role-gated sections to control edit access by staff role.
 */

import { useState, useEffect, useCallback } from 'react';
import { JPPStepLayout } from './JPPStepLayout.tsx';
import { RoleGatedSection } from './RoleGatedSection.tsx';
import { jppService, type JPPStepProduct, type StepStatus } from '../../lib/jpp-service.ts';

// ─── Types ─────────────────────────────────────────────────────────────────

interface IPBContent {
  threatAssessment: string;
  areaOfOperations: string;
  areaOfInterest: string;
  weatherTerrainSummary: string;
  enemyCOASummary: string;
}

interface TaskItem {
  id: string;
  text: string;
  isEssential?: boolean;
}

interface Assumption {
  id: string;
  text: string;
  validationStatus: 'valid' | 'invalid' | 'unconfirmed';
}

interface TaskAnalysisContent {
  specifiedTasks: TaskItem[];
  impliedTasks: TaskItem[];
  essentialTasks: string[];
  constraints: string[];
  assumptions: Assumption[];
}

interface MissionStatementContent {
  who: string;
  what: string;
  when: string;
  where: string;
  why: string;
  restatedMission: string;
}

interface CommanderIntentContent {
  purpose: string;
  keyTasks: string[];
  endState: string;
  context: string;
  constraints: string[];
  criticalFactors: string[];
  antigoals: string[];
}

// ─── Props ─────────────────────────────────────────────────────────────────

export interface MissionAnalysisProps {
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

const previewStyle: React.CSSProperties = {
  backgroundColor: 'rgba(16, 185, 129, 0.08)',
  border: '1px solid rgba(16, 185, 129, 0.2)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  color: '#a7f3d0',
  fontSize: '0.85rem',
  fontStyle: 'italic',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

let nextTaskId = 0;
function makeId() {
  nextTaskId += 1;
  return `task-${Date.now()}-${nextTaskId}`;
}

// ─── Component ─────────────────────────────────────────────────────────────

export function MissionAnalysis({
  problemSetId,
  jppInstanceId,
  currentRole,
}: MissionAnalysisProps) {
  // IPB
  const [ipb, setIpb] = useState<IPBContent>({
    threatAssessment: '',
    areaOfOperations: '',
    areaOfInterest: '',
    weatherTerrainSummary: '',
    enemyCOASummary: '',
  });
  const [ipbProductId, setIpbProductId] = useState<string | undefined>();

  // Task Analysis
  const [specifiedTasks, setSpecifiedTasks] = useState<TaskItem[]>([]);
  const [impliedTasks, setImpliedTasks] = useState<TaskItem[]>([]);
  const [essentialTaskIds, setEssentialTaskIds] = useState<Set<string>>(new Set());
  const [constraints, setConstraints] = useState<string[]>([]);
  const [assumptions, setAssumptions] = useState<Assumption[]>([]);
  const [taskProductId, setTaskProductId] = useState<string | undefined>();

  // Mission Statement
  const [missionStatement, setMissionStatement] = useState<MissionStatementContent>({
    who: '',
    what: '',
    when: '',
    where: '',
    why: '',
    restatedMission: '',
  });
  const [missionProductId, setMissionProductId] = useState<string | undefined>();

  // Commander's Intent
  const [intent, setIntent] = useState<CommanderIntentContent>({
    purpose: '',
    keyTasks: [],
    endState: '',
    context: '',
    constraints: [],
    criticalFactors: [],
    antigoals: [],
  });
  const [intentProductId, setIntentProductId] = useState<string | undefined>();

  // Step status
  const [stepStatus, setStepStatus] = useState<StepStatus>('not_started');

  // ─── Load existing data ────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const products = await jppService.getStepProducts(jppInstanceId, 'mission_analysis');
        if (cancelled) return;

        for (const product of products) {
          const content = product.content as Record<string, unknown>;

          // IPB product
          if (content.threatAssessment !== undefined) {
            setIpb(content as unknown as IPBContent);
            setIpbProductId(product.id);
          }

          // Task analysis product
          if (content.specifiedTasks !== undefined) {
            const tc = content as unknown as TaskAnalysisContent;
            setSpecifiedTasks(tc.specifiedTasks || []);
            setImpliedTasks(tc.impliedTasks || []);
            setEssentialTaskIds(new Set(tc.essentialTasks || []));
            setConstraints(tc.constraints || []);
            setAssumptions(tc.assumptions || []);
            setTaskProductId(product.id);
          }

          // Mission statement product
          if (content.who !== undefined) {
            setMissionStatement(content as unknown as MissionStatementContent);
            setMissionProductId(product.id);
          }

          // Commander's intent product
          if (content.purpose !== undefined && content.keyTasks !== undefined) {
            setIntent(content as unknown as CommanderIntentContent);
            setIntentProductId(product.id);
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

  // ─── Save helpers ──────────────────────────────────────────────────────

  const saveIPB = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'mission_analysis', {
        roleId: 'j2',
        content: ipb as unknown as Record<string, unknown>,
        status: 'draft',
        id: ipbProductId,
      });
      setIpbProductId(result.id);
    } catch {
      // Save failed
    }
  }, [jppInstanceId, ipb, ipbProductId]);

  const saveTaskAnalysis = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'mission_analysis', {
        roleId: 'j3',
        content: {
          specifiedTasks,
          impliedTasks,
          essentialTasks: Array.from(essentialTaskIds),
          constraints,
          assumptions,
        },
        status: 'draft',
        id: taskProductId,
      });
      setTaskProductId(result.id);
    } catch {
      // Save failed
    }
  }, [jppInstanceId, specifiedTasks, impliedTasks, essentialTaskIds, constraints, assumptions, taskProductId]);

  const saveMissionStatement = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'mission_analysis', {
        roleId: 'j3',
        content: missionStatement as unknown as Record<string, unknown>,
        status: 'draft',
        id: missionProductId,
      });
      setMissionProductId(result.id);
    } catch {
      // Save failed
    }
  }, [jppInstanceId, missionStatement, missionProductId]);

  const saveIntent = useCallback(async () => {
    try {
      const result = await jppService.saveStepProduct(jppInstanceId, 'mission_analysis', {
        roleId: 'commander',
        content: intent as unknown as Record<string, unknown>,
        status: 'draft',
        id: intentProductId,
      });
      setIntentProductId(result.id);
    } catch {
      // Save failed
    }
  }, [jppInstanceId, intent, intentProductId]);

  // ─── IPB field updater ─────────────────────────────────────────────────

  const updateIPB = (field: keyof IPBContent, value: string) =>
    setIpb((prev) => ({ ...prev, [field]: value }));

  // ─── Task list helpers ─────────────────────────────────────────────────

  const addSpecifiedTask = () =>
    setSpecifiedTasks((prev) => [...prev, { id: makeId(), text: '' }]);
  const removeSpecifiedTask = (id: string) =>
    setSpecifiedTasks((prev) => prev.filter((t) => t.id !== id));
  const updateSpecifiedTask = (id: string, text: string) =>
    setSpecifiedTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));

  const addImpliedTask = () =>
    setImpliedTasks((prev) => [...prev, { id: makeId(), text: '' }]);
  const removeImpliedTask = (id: string) =>
    setImpliedTasks((prev) => prev.filter((t) => t.id !== id));
  const updateImpliedTask = (id: string, text: string) =>
    setImpliedTasks((prev) => prev.map((t) => (t.id === id ? { ...t, text } : t)));

  const toggleEssential = (taskId: string) =>
    setEssentialTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });

  // Constraint helpers
  const addConstraint = () => setConstraints((prev) => [...prev, '']);
  const removeConstraint = (i: number) =>
    setConstraints((prev) => prev.filter((_, idx) => idx !== i));
  const updateConstraint = (i: number, value: string) =>
    setConstraints((prev) => prev.map((c, idx) => (idx === i ? value : c)));

  // Assumption helpers
  const addAssumption = () =>
    setAssumptions((prev) => [...prev, { id: makeId(), text: '', validationStatus: 'unconfirmed' }]);
  const removeAssumption = (id: string) =>
    setAssumptions((prev) => prev.filter((a) => a.id !== id));
  const updateAssumption = (id: string, field: 'text' | 'validationStatus', value: string) =>
    setAssumptions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
    );

  // Mission statement field updater
  const updateMission = (field: keyof MissionStatementContent, value: string) =>
    setMissionStatement((prev) => ({ ...prev, [field]: value }));

  // Intent list helpers
  const addIntentItem = (field: 'keyTasks' | 'constraints' | 'criticalFactors' | 'antigoals') =>
    setIntent((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  const removeIntentItem = (field: 'keyTasks' | 'constraints' | 'criticalFactors' | 'antigoals', i: number) =>
    setIntent((prev) => ({
      ...prev,
      [field]: prev[field].filter((_: string, idx: number) => idx !== i),
    }));
  const updateIntentItem = (field: 'keyTasks' | 'constraints' | 'criticalFactors' | 'antigoals', i: number, value: string) =>
    setIntent((prev) => ({
      ...prev,
      [field]: prev[field].map((v: string, idx: number) => (idx === i ? value : v)),
    }));

  // Mission statement preview
  const missionPreview = [
    missionStatement.who || '[Who]',
    'will',
    missionStatement.what || '[What]',
    'NLT',
    missionStatement.when || '[When]',
    'in',
    missionStatement.where || '[Where]',
    'in order to',
    missionStatement.why || '[Why]',
  ].join(' ');

  void stepStatus;
  void setStepStatus;
  void problemSetId;

  return (
    <JPPStepLayout
      stepId="mission_analysis"
      stepLabel="Mission Analysis"
      stepNumber={2}
      problemSetId={problemSetId}
      jppInstanceId={jppInstanceId}
      status={stepStatus}
      aiAgentId="jpp-mission-analysis-agent"
    >
      {/* ── Section 1: Intelligence Preparation ────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j2', 'j2x']}
        currentRole={currentRole}
        title="Intelligence Preparation of the Battlespace (IPB)"
        description="Threat, AO/AI, weather/terrain, and enemy COA assessment"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Threat Assessment</label>
            <textarea
              style={{ ...inputStyle, minHeight: '4rem' }}
              value={ipb.threatAssessment}
              onChange={(e) => updateIPB('threatAssessment', e.target.value)}
              onBlur={saveIPB}
              placeholder="Threat assessment..."
            />
          </div>
          <div>
            <label style={labelStyle}>Area of Operations</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={ipb.areaOfOperations}
              onChange={(e) => updateIPB('areaOfOperations', e.target.value)}
              onBlur={saveIPB}
              placeholder="Describe the area of operations..."
            />
          </div>
          <div>
            <label style={labelStyle}>Area of Interest</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={ipb.areaOfInterest}
              onChange={(e) => updateIPB('areaOfInterest', e.target.value)}
              onBlur={saveIPB}
              placeholder="Describe the area of interest..."
            />
          </div>
          <div>
            <label style={labelStyle}>Weather / Terrain Summary</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={ipb.weatherTerrainSummary}
              onChange={(e) => updateIPB('weatherTerrainSummary', e.target.value)}
              onBlur={saveIPB}
              placeholder="Weather and terrain assessment..."
            />
          </div>
          <div>
            <label style={labelStyle}>Enemy COA Summary</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={ipb.enemyCOASummary}
              onChange={(e) => updateIPB('enemyCOASummary', e.target.value)}
              onBlur={saveIPB}
              placeholder="Enemy course of action summary..."
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* ── Section 2: Task Analysis ───────────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5']}
        currentRole={currentRole}
        title="Task Analysis"
        description="Specified, implied, and essential tasks; constraints and assumptions"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Specified Tasks */}
          <div>
            <label style={labelStyle}>Specified Tasks</label>
            {specifiedTasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={essentialTaskIds.has(task.id)}
                  onChange={() => toggleEssential(task.id)}
                  title="Mark as essential"
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={task.text}
                  onChange={(e) => updateSpecifiedTask(task.id, e.target.value)}
                  onBlur={saveTaskAnalysis}
                  placeholder="Specified task..."
                />
                <button style={removeButtonStyle} onClick={() => removeSpecifiedTask(task.id)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={addSpecifiedTask}>
              + Add Specified Task
            </button>
          </div>

          {/* Implied Tasks */}
          <div>
            <label style={labelStyle}>Implied Tasks</label>
            {impliedTasks.map((task) => (
              <div key={task.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={essentialTaskIds.has(task.id)}
                  onChange={() => toggleEssential(task.id)}
                  title="Mark as essential"
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={task.text}
                  onChange={(e) => updateImpliedTask(task.id, e.target.value)}
                  onBlur={saveTaskAnalysis}
                  placeholder="Implied task..."
                />
                <button style={removeButtonStyle} onClick={() => removeImpliedTask(task.id)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={addImpliedTask}>
              + Add Implied Task
            </button>
          </div>

          {/* Essential Tasks (derived summary) */}
          {essentialTaskIds.size > 0 && (
            <div style={cardStyle}>
              <label style={labelStyle}>Essential Tasks (marked above)</label>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#a7f3d0', fontSize: '0.85rem' }}>
                {[...specifiedTasks, ...impliedTasks]
                  .filter((t) => essentialTaskIds.has(t.id))
                  .map((t) => (
                    <li key={t.id}>{t.text || '(unnamed)'}</li>
                  ))}
              </ul>
            </div>
          )}

          {/* Constraints */}
          <div>
            <label style={labelStyle}>Constraints</label>
            {constraints.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={c}
                  onChange={(e) => updateConstraint(i, e.target.value)}
                  onBlur={saveTaskAnalysis}
                  placeholder="Constraint..."
                />
                <button style={removeButtonStyle} onClick={() => removeConstraint(i)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={addConstraint}>
              + Add Constraint
            </button>
          </div>

          {/* Assumptions */}
          <div>
            <label style={labelStyle}>Assumptions</label>
            {assumptions.map((a) => (
              <div key={a.id} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <select
                  style={{
                    ...inputStyle,
                    width: 'auto',
                    minWidth: '7rem',
                    color:
                      a.validationStatus === 'valid'
                        ? '#a7f3d0'
                        : a.validationStatus === 'invalid'
                          ? '#fca5a5'
                          : '#fde68a',
                  }}
                  value={a.validationStatus}
                  onChange={(e) => updateAssumption(a.id, 'validationStatus', e.target.value)}
                  onBlur={saveTaskAnalysis}
                >
                  <option value="unconfirmed">Unconfirmed</option>
                  <option value="valid">Valid</option>
                  <option value="invalid">Invalid</option>
                </select>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={a.text}
                  onChange={(e) => updateAssumption(a.id, 'text', e.target.value)}
                  onBlur={saveTaskAnalysis}
                  placeholder="Assumption..."
                />
                <button style={removeButtonStyle} onClick={() => removeAssumption(a.id)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={addAssumption}>
              + Add Assumption
            </button>
          </div>
        </div>
      </RoleGatedSection>

      {/* ── Section 3: Mission Statement ───────────────────────────────── */}
      <RoleGatedSection
        allowedRoles={['j3', 'j5', 'commander']}
        currentRole={currentRole}
        title="Mission Statement"
        description="Five-paragraph mission statement (Who, What, When, Where, Why)"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={labelStyle}>Who</label>
              <input
                style={inputStyle}
                value={missionStatement.who}
                onChange={(e) => updateMission('who', e.target.value)}
                onBlur={saveMissionStatement}
                placeholder="Unit / organization..."
              />
            </div>
            <div>
              <label style={labelStyle}>What</label>
              <input
                style={inputStyle}
                value={missionStatement.what}
                onChange={(e) => updateMission('what', e.target.value)}
                onBlur={saveMissionStatement}
                placeholder="Action to accomplish..."
              />
            </div>
            <div>
              <label style={labelStyle}>When (NLT)</label>
              <input
                style={inputStyle}
                value={missionStatement.when}
                onChange={(e) => updateMission('when', e.target.value)}
                onBlur={saveMissionStatement}
                placeholder="Not later than..."
              />
            </div>
            <div>
              <label style={labelStyle}>Where</label>
              <input
                style={inputStyle}
                value={missionStatement.where}
                onChange={(e) => updateMission('where', e.target.value)}
                onBlur={saveMissionStatement}
                placeholder="Location / area..."
              />
            </div>
          </div>
          <div>
            <label style={labelStyle}>Why (Purpose)</label>
            <input
              style={inputStyle}
              value={missionStatement.why}
              onChange={(e) => updateMission('why', e.target.value)}
              onBlur={saveMissionStatement}
              placeholder="In order to..."
            />
          </div>

          {/* Preview */}
          <div>
            <label style={labelStyle}>Mission Statement Preview</label>
            <div style={previewStyle}>{missionPreview}</div>
          </div>

          <div>
            <label style={labelStyle}>Restated Mission</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={missionStatement.restatedMission}
              onChange={(e) => updateMission('restatedMission', e.target.value)}
              onBlur={saveMissionStatement}
              placeholder="Restated mission text..."
            />
          </div>
        </div>
      </RoleGatedSection>

      {/* ── Section 4: Commander's Intent (Klein 7 Facets) ─────────────── */}
      <RoleGatedSection
        allowedRoles={['commander', 'xo']}
        currentRole={currentRole}
        title="Commander's Intent"
        description="Seven Klein facets: purpose, key tasks, end state, context, constraints, critical factors, anti-goals"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Purpose</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={intent.purpose}
              onChange={(e) => setIntent((p) => ({ ...p, purpose: e.target.value }))}
              onBlur={saveIntent}
              placeholder="The broader purpose of this mission..."
            />
          </div>

          <div>
            <label style={labelStyle}>End State</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={intent.endState}
              onChange={(e) => setIntent((p) => ({ ...p, endState: e.target.value }))}
              onBlur={saveIntent}
              placeholder="Desired end state..."
            />
          </div>

          <div>
            <label style={labelStyle}>Context</label>
            <textarea
              style={{ ...inputStyle, minHeight: '3rem' }}
              value={intent.context}
              onChange={(e) => setIntent((p) => ({ ...p, context: e.target.value }))}
              onBlur={saveIntent}
              placeholder="Operational context..."
            />
          </div>

          {/* Key Tasks list */}
          <div>
            <label style={labelStyle}>Key Tasks</label>
            {intent.keyTasks.map((task, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={task}
                  onChange={(e) => updateIntentItem('keyTasks', i, e.target.value)}
                  onBlur={saveIntent}
                  placeholder={`Key task ${i + 1}`}
                />
                <button style={removeButtonStyle} onClick={() => removeIntentItem('keyTasks', i)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={() => addIntentItem('keyTasks')}>
              + Add Key Task
            </button>
          </div>

          {/* Constraints list */}
          <div>
            <label style={labelStyle}>Constraints</label>
            {intent.constraints.map((c, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={c}
                  onChange={(e) => updateIntentItem('constraints', i, e.target.value)}
                  onBlur={saveIntent}
                  placeholder={`Constraint ${i + 1}`}
                />
                <button style={removeButtonStyle} onClick={() => removeIntentItem('constraints', i)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={() => addIntentItem('constraints')}>
              + Add Constraint
            </button>
          </div>

          {/* Critical Factors list */}
          <div>
            <label style={labelStyle}>Critical Factors</label>
            {intent.criticalFactors.map((f, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={f}
                  onChange={(e) => updateIntentItem('criticalFactors', i, e.target.value)}
                  onBlur={saveIntent}
                  placeholder={`Critical factor ${i + 1}`}
                />
                <button style={removeButtonStyle} onClick={() => removeIntentItem('criticalFactors', i)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={() => addIntentItem('criticalFactors')}>
              + Add Critical Factor
            </button>
          </div>

          {/* Anti-goals list */}
          <div>
            <label style={labelStyle}>Anti-Goals (what to avoid)</label>
            {intent.antigoals.map((ag, i) => (
              <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.25rem', alignItems: 'center' }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={ag}
                  onChange={(e) => updateIntentItem('antigoals', i, e.target.value)}
                  onBlur={saveIntent}
                  placeholder={`Anti-goal ${i + 1}`}
                />
                <button style={removeButtonStyle} onClick={() => removeIntentItem('antigoals', i)}>
                  Remove
                </button>
              </div>
            ))}
            <button style={buttonStyle} onClick={() => addIntentItem('antigoals')}>
              + Add Anti-Goal
            </button>
          </div>
        </div>
      </RoleGatedSection>
    </JPPStepLayout>
  );
}
