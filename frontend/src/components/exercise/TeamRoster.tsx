/**
 * Team Roster Component
 *
 * Quick Task 9: Displays exercise positions grouped by side (blue/red/neutral/green)
 * with inline editing, phase mapping management, and template loading.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  positionService,
  type ExercisePosition,
  type PositionSide,
  type CreatePositionInput,
  type PhaseMappingInput,
} from '../../lib/position-service.js';
import { problemSetService, type ProblemSetMemberDetail } from '../../lib/problem-set-service.js';
import { adminService } from '../../lib/admin-service.js';
import type { AgentWithConfig, AgentTeam } from '../../types/admin.js';
import { useUser } from '../../context/UserContext.js';
import './TeamRoster.css';

// ─── AWC Position Template ───────────────────────────────────────────────────

const AWC_POSITION_TEMPLATE: CreatePositionInput[] = [
  // ── Neutral (Competition phase unified roster) ─────────────────────────
  {
    side: 'neutral', title: 'JPG Lead', sortOrder: 0,
    duties: 'Leads the Joint Planning Group through all phases',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'JPG Lead', duties: 'Leads the Joint Planning Group' },
      { exercisePhase: 'Crisis', title: 'CJ35 Planner', duties: 'Crisis action planning and future operations' },
      { exercisePhase: 'Conflict Day 4', title: 'CJ5', duties: 'Strategic plans and policy in conflict' },
    ],
  },
  {
    side: 'neutral', title: 'Regional Planner - Zone A', sortOrder: 1,
    duties: 'Responsible for regional analysis and planning in Zone A',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'Regional Planner - Zone A' },
      { exercisePhase: 'Crisis', title: 'Western Theater Cmd LNO', duties: 'Liaison to Western Theater Command' },
      { exercisePhase: 'Conflict Day 4', title: 'Land Ops Subcenter', duties: 'Land operations coordination' },
    ],
  },
  {
    side: 'neutral', title: 'Regional Planner - Zone B', sortOrder: 2,
    duties: 'Responsible for regional analysis and planning in Zone B',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'Regional Planner - Zone B' },
      { exercisePhase: 'Crisis', title: 'Southern Theater Cmd LNO', duties: 'Liaison to Southern Theater Command' },
      { exercisePhase: 'Conflict Day 4', title: 'Air Ops Subcenter', duties: 'Air operations coordination' },
    ],
  },
  {
    side: 'neutral', title: 'Regional Planner - Zone C', sortOrder: 3,
    duties: 'Responsible for regional analysis and planning in Zone C',
    phaseMappings: [
      { exercisePhase: 'Competition', title: 'Regional Planner - Zone C' },
      { exercisePhase: 'Crisis', title: 'Eastern Theater Cmd LNO', duties: 'Liaison to Eastern Theater Command' },
      { exercisePhase: 'Conflict Day 4', title: 'Maritime Ops Subcenter', duties: 'Maritime operations coordination' },
    ],
  },
  {
    side: 'neutral', title: 'Military Exercise Planner', sortOrder: 4,
    duties: 'Plans and coordinates military exercise components',
  },
  {
    side: 'neutral', title: 'Economic Advisor', sortOrder: 5,
    duties: 'Provides economic analysis and policy recommendations',
  },
  {
    side: 'neutral', title: 'DoS Representative', sortOrder: 6,
    duties: 'State Department liaison for interagency coordination',
  },

  // ── Blue positions ─────────────────────────────────────────────────────
  {
    side: 'blue', title: 'Commander', sortOrder: 0,
    duties: 'Overall blue force commander',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'Blue Cell Lead', duties: 'Leads blue cell during crisis phase' },
      { exercisePhase: 'Conflict Day 4', title: 'Commander', duties: 'Blue force commander in conflict' },
    ],
  },
  {
    side: 'blue', title: 'USARPAC LNO', sortOrder: 1,
    duties: 'U.S. Army Pacific liaison officer',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'USARPAC LNO', duties: 'Army Pacific liaison' },
      { exercisePhase: 'Conflict Day 4', title: 'CJFLCC', duties: 'Combined Joint Force Land Component Commander' },
    ],
  },
  {
    side: 'blue', title: 'PACFLT/MARFORPAC LNO', sortOrder: 2,
    duties: 'Pacific Fleet / Marine Forces Pacific liaison',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'PACFLT/MARFORPAC LNO', duties: 'Naval/Marine liaison' },
      { exercisePhase: 'Conflict Day 4', title: 'CJFMCC', duties: 'Combined Joint Force Maritime Component Commander' },
    ],
  },
  {
    side: 'blue', title: 'PACAF LNO', sortOrder: 3,
    duties: 'Pacific Air Forces liaison officer',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'PACAF LNO', duties: 'Air Forces Pacific liaison' },
      { exercisePhase: 'Conflict Day 4', title: 'CJFACC', duties: 'Combined Joint Force Air Component Commander' },
    ],
  },
  {
    side: 'blue', title: 'J4/TRANSCOM LNO', sortOrder: 4,
    duties: 'Logistics and transportation liaison',
  },
  {
    side: 'blue', title: 'Intel/Enablers', sortOrder: 5,
    duties: 'Intelligence and enabler coordination',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'CJ3', duties: 'Combined Joint Operations directorate' },
    ],
  },
  {
    side: 'blue', title: 'DoS Rep (Blue)', sortOrder: 6,
    duties: 'State Department representative for blue cell',
  },

  // ── Red positions ──────────────────────────────────────────────────────
  {
    side: 'red', title: 'Red Cell Lead', sortOrder: 0,
    duties: 'Leads the red cell adversary team',
    phaseMappings: [
      { exercisePhase: 'Crisis', title: 'JPG Lead (Red)', duties: 'Red cell planning lead during crisis' },
      { exercisePhase: 'Conflict Day 4', title: 'Commander (Red)', duties: 'Red force commander in conflict' },
    ],
  },
  {
    side: 'red', title: 'CJ35 Planner (Red)', sortOrder: 1,
    duties: 'Red cell future plans',
  },
  {
    side: 'red', title: 'Eastern Theater Cmd LNO', sortOrder: 2,
    duties: 'Eastern Theater Command liaison',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Land Ops Subcenter (Red)', duties: 'Red land operations' },
    ],
  },
  {
    side: 'red', title: 'Southern Theater Cmd LNO', sortOrder: 3,
    duties: 'Southern Theater Command liaison',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Maritime Ops Subcenter (Red)', duties: 'Red maritime operations' },
    ],
  },
  {
    side: 'red', title: 'PLA Air Force Planner', sortOrder: 4,
    duties: 'PLA Air Force planning and coordination',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Air & Air Defense Ops (Red)', duties: 'Red air and air defense operations' },
    ],
  },
  {
    side: 'red', title: 'PLA Rocket Force Planner', sortOrder: 5,
    duties: 'PLA Rocket Force planning and coordination',
    phaseMappings: [
      { exercisePhase: 'Conflict Day 4', title: 'Conventional Missile Ops (Red)', duties: 'Red conventional missile operations' },
    ],
  },
  {
    side: 'red', title: 'Intel/Enablers (Red)', sortOrder: 6,
    duties: 'Red cell intelligence and enabler coordination',
  },
  {
    side: 'red', title: 'DoS Rep (Red)', sortOrder: 7,
    duties: 'State Department representative for red cell',
  },
];

// ─── Side Config ─────────────────────────────────────────────────────────────

const SIDE_ORDER: PositionSide[] = ['blue', 'red', 'neutral', 'green'];
const SIDE_LABELS: Record<PositionSide, string> = {
  blue: 'Blue Force',
  red: 'Red Force',
  neutral: 'Neutral',
  green: 'Green (Civilian)',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDID(did: string): string {
  return did.replace(/^did:near:/, '');
}

function resolveAssigneeName(
  assignedTo: string,
  members: ProblemSetMemberDetail[],
  agents: AgentWithConfig[],
  teams: AgentTeam[],
): string {
  const agent = agents.find((a) => a.agentId === assignedTo || a.agentDID === assignedTo);
  if (agent) return agent.name;
  const team = teams.find((t) => t.teamId === assignedTo || t.teamDID === assignedTo);
  if (team) return team.name;
  const member = members.find((m) => m.userDid === assignedTo);
  if (member) return formatDID(member.userDid);
  return formatDID(assignedTo);
}

// ─── Component ───────────────────────────────────────────────────────────────

interface TeamRosterProps {
  problemSetId: string;
}

export function TeamRoster({ problemSetId }: TeamRosterProps) {
  const { userDID } = useUser();
  const [positions, setPositions] = useState<ExercisePosition[]>([]);
  const [exercisePhases, setExercisePhases] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [collapsedSides, setCollapsedSides] = useState<Set<PositionSide>>(new Set());
  const [members, setMembers] = useState<ProblemSetMemberDetail[]>([]);
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);
  const [agentTeams, setAgentTeams] = useState<AgentTeam[]>([]);

  const did = userDID || '';

  const loadData = useCallback(async () => {
    if (!did) return;
    setLoading(true);
    setError(null);
    try {
      const [posData, scenario, memberData] = await Promise.all([
        positionService.listPositions(problemSetId, did),
        problemSetService.getLinkedScenario(problemSetId),
        problemSetService.listMembers(problemSetId, did),
      ]);
      setPositions(posData);
      setMembers(memberData);
      if (scenario?.exercisePhases) {
        setExercisePhases(scenario.exercisePhases);
      }
      // Load agents/teams (non-fatal)
      try {
        const [agentData, teamData] = await Promise.all([
          adminService.listAgents(),
          adminService.listTeams(),
        ]);
        setAgents(agentData.filter((a) => a.active));
        setAgentTeams(teamData.filter((t) => t.isEnabled));
      } catch {
        // Agent/team data unavailable — dropdowns will be empty
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load positions');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, did]);

  useEffect(() => { loadData(); }, [loadData]);

  // Group positions by side
  const grouped = SIDE_ORDER.reduce<Record<PositionSide, ExercisePosition[]>>((acc, side) => {
    acc[side] = positions.filter((p) => p.side === side);
    return acc;
  }, { blue: [], red: [], neutral: [], green: [] });

  const toggleSide = (side: PositionSide) => {
    setCollapsedSides((prev) => {
      const next = new Set(prev);
      if (next.has(side)) next.delete(side);
      else next.add(side);
      return next;
    });
  };

  const handleDelete = async (positionId: string) => {
    if (!did) return;
    try {
      await positionService.deletePosition(problemSetId, positionId, did);
      setPositions((prev) => prev.filter((p) => p.id !== positionId));
      setConfirmDeleteId(null);
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const handleLoadTemplate = async () => {
    if (!did) return;
    setError(null);
    try {
      const newPositions = await positionService.bulkCreate(problemSetId, AWC_POSITION_TEMPLATE, did);
      setPositions((prev) => [...prev, ...newPositions]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Template load failed');
    }
  };

  if (loading) {
    return <div className="team-roster"><div className="team-roster__loading">Loading positions...</div></div>;
  }

  return (
    <div className="team-roster">
      <div className="team-roster__header">
        <h2 className="team-roster__title">Team Roster</h2>
        <div className="team-roster__actions">
          <button className="team-roster__btn team-roster__btn--primary" onClick={() => { setShowAddForm(true); setEditingId(null); }}>
            Add Position
          </button>
          <button className="team-roster__btn" onClick={handleLoadTemplate}>
            Load Template
          </button>
        </div>
      </div>

      {error && <div className="team-roster__error">{error}</div>}

      {showAddForm && (
        <PositionForm
          exercisePhases={exercisePhases}
          members={members}
          agents={agents}
          agentTeams={agentTeams}
          onSave={async (input) => {
            if (!did) return;
            const pos = await positionService.createPosition(problemSetId, input, did);
            setPositions((prev) => [...prev, pos]);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {positions.length === 0 && !showAddForm && (
        <div className="team-roster__empty">
          No positions defined. Click "Add Position" or "Load Template" to get started.
        </div>
      )}

      {SIDE_ORDER.map((side) => {
        const sidePositions = grouped[side];
        if (sidePositions.length === 0) return null;
        const collapsed = collapsedSides.has(side);

        return (
          <div key={side} className="team-roster__side-group">
            <div
              className={`team-roster__side-header team-roster__side-header--${side}`}
              onClick={() => toggleSide(side)}
            >
              <span>{SIDE_LABELS[side]} {collapsed ? '+' : '-'}</span>
              <span className="team-roster__side-count">{sidePositions.length} positions</span>
            </div>

            {!collapsed && (
              <div className="team-roster__side-content">
                {sidePositions.map((pos) => (
                  <div key={pos.id}>
                    <div
                      className="team-roster__position"
                      onClick={() => setEditingId(editingId === pos.id ? null : pos.id)}
                    >
                      <div className="team-roster__position-info">
                        <div className="team-roster__position-title">{pos.title}</div>
                        {pos.duties && (
                          <div className="team-roster__position-duties">{pos.duties}</div>
                        )}
                      </div>
                      <div className="team-roster__position-meta">
                        <span className={`team-roster__position-assigned ${pos.assignedTo ? 'team-roster__position-assigned--active' : ''}`}>
                          {pos.assignedTo
                            ? resolveAssigneeName(pos.assignedTo, members, agents, agentTeams)
                            : 'Unassigned'}
                        </span>
                        {(pos.phaseMappings?.length ?? 0) > 0 && (
                          <span className="team-roster__phase-badge">
                            {pos.phaseMappings!.length} phases
                          </span>
                        )}
                      </div>
                    </div>

                    {editingId === pos.id && (
                      <>
                        <PositionForm
                          position={pos}
                          exercisePhases={exercisePhases}
                          members={members}
                          agents={agents}
                          agentTeams={agentTeams}
                          onSave={async (input) => {
                            if (!did) return;
                            const updated = await positionService.updatePosition(problemSetId, pos.id, input, did);
                            setPositions((prev) => prev.map((p) => p.id === pos.id ? updated : p));
                            setEditingId(null);
                          }}
                          onCancel={() => setEditingId(null)}
                          onSaveMappings={async (mappings) => {
                            if (!did) return;
                            await positionService.setPhaseMappings(problemSetId, pos.id, mappings, did);
                            await loadData();
                          }}
                        />
                        {confirmDeleteId === pos.id ? (
                          <div className="team-roster__confirm">
                            <span className="team-roster__confirm-text">Delete this position?</span>
                            <button className="team-roster__btn team-roster__btn--danger team-roster__btn--sm" onClick={() => handleDelete(pos.id)}>
                              Yes, Delete
                            </button>
                            <button className="team-roster__btn team-roster__btn--sm" onClick={() => setConfirmDeleteId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--border-subtle, #2a2a38)' }}>
                            <button className="team-roster__btn team-roster__btn--danger team-roster__btn--sm" onClick={() => setConfirmDeleteId(pos.id)}>
                              Delete Position
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Position Form ───────────────────────────────────────────────────────────

interface PositionFormProps {
  position?: ExercisePosition;
  exercisePhases: string[];
  members: ProblemSetMemberDetail[];
  agents: AgentWithConfig[];
  agentTeams: AgentTeam[];
  onSave: (input: CreatePositionInput) => Promise<void>;
  onCancel: () => void;
  onSaveMappings?: (mappings: PhaseMappingInput[]) => Promise<void>;
}

function PositionForm({ position, exercisePhases, members, agents, agentTeams, onSave, onCancel, onSaveMappings }: PositionFormProps) {
  const [title, setTitle] = useState(position?.title ?? '');
  const [duties, setDuties] = useState(position?.duties ?? '');
  const [side, setSide] = useState<PositionSide>(position?.side ?? 'blue');
  const [assignedTo, setAssignedTo] = useState(position?.assignedTo ?? '');
  const [sortOrder, setSortOrder] = useState(position?.sortOrder ?? 0);
  const [showPhaseMappings, setShowPhaseMappings] = useState(false);
  const [saving, setSaving] = useState(false);

  // Phase mapping state
  const [phaseMappingData, setPhaseMappingData] = useState<Record<string, { title: string; duties: string }>>(() => {
    const data: Record<string, { title: string; duties: string }> = {};
    if (position?.phaseMappings) {
      for (const m of position.phaseMappings) {
        data[m.exercisePhase] = { title: m.title, duties: m.duties ?? '' };
      }
    }
    return data;
  });

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      // Build phase mappings from form data
      const phaseMappings: PhaseMappingInput[] = [];
      for (const [phase, data] of Object.entries(phaseMappingData)) {
        if (data.title.trim()) {
          phaseMappings.push({
            exercisePhase: phase,
            title: data.title.trim(),
            duties: data.duties.trim() || undefined,
          });
        }
      }

      await onSave({
        side,
        title: title.trim(),
        duties: duties.trim() || undefined,
        sortOrder,
        assignedTo: assignedTo.trim() || undefined,
        ...(!position ? { phaseMappings: phaseMappings.length > 0 ? phaseMappings : undefined } : {}),
      });
    } catch {
      // Error handled by parent
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMappings = async () => {
    if (!onSaveMappings) return;
    const mappings: PhaseMappingInput[] = [];
    for (const [phase, data] of Object.entries(phaseMappingData)) {
      if (data.title.trim()) {
        mappings.push({
          exercisePhase: phase,
          title: data.title.trim(),
          duties: data.duties.trim() || undefined,
        });
      }
    }
    setSaving(true);
    try {
      await onSaveMappings(mappings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="team-roster__edit-form">
      <div className="team-roster__form-row">
        <div className="team-roster__form-group">
          <label className="team-roster__form-label">Title</label>
          <input
            className="team-roster__form-input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Position title"
            maxLength={200}
          />
        </div>
        <div className="team-roster__form-group team-roster__form-group--small">
          <label className="team-roster__form-label">Side</label>
          <select
            className="team-roster__form-select"
            value={side}
            onChange={(e) => setSide(e.target.value as PositionSide)}
          >
            <option value="blue">Blue</option>
            <option value="red">Red</option>
            <option value="neutral">Neutral</option>
            <option value="green">Green</option>
          </select>
        </div>
        <div className="team-roster__form-group team-roster__form-group--small">
          <label className="team-roster__form-label">Sort Order</label>
          <input
            className="team-roster__form-input"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
          />
        </div>
      </div>

      <div className="team-roster__form-group">
        <label className="team-roster__form-label">Duties</label>
        <textarea
          className="team-roster__form-textarea"
          value={duties}
          onChange={(e) => setDuties(e.target.value)}
          placeholder="Position duties and responsibilities"
        />
      </div>

      <div className="team-roster__form-row">
        <div className="team-roster__form-group">
          <label className="team-roster__form-label">Assign to Member</label>
          <select
            className="team-roster__form-select"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userDid} value={m.userDid}>
                {formatDID(m.userDid)} ({m.role})
              </option>
            ))}
          </select>
        </div>
        <div className="team-roster__form-group">
          <label className="team-roster__form-label">Or Assign AI Agent / Team</label>
          <select
            className="team-roster__form-select"
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
          >
            <option value="">— None —</option>
            {agents.length > 0 && (
              <optgroup label="AI Agents">
                {agents.map((a) => (
                  <option key={a.agentId} value={a.agentId}>{a.name}</option>
                ))}
              </optgroup>
            )}
            {agentTeams.length > 0 && (
              <optgroup label="Agent Teams">
                {agentTeams.map((t) => (
                  <option key={t.teamId} value={t.teamId}>{t.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
      </div>

      {/* Phase Mappings */}
      {exercisePhases.length > 0 && (
        <div className="team-roster__phase-section">
          <div
            className="team-roster__phase-header"
            onClick={() => setShowPhaseMappings(!showPhaseMappings)}
          >
            Phase Mappings {showPhaseMappings ? '-' : '+'} ({Object.values(phaseMappingData).filter((d) => d.title.trim()).length} defined)
          </div>
          {showPhaseMappings && (
            <div className="team-roster__phase-rows">
              {exercisePhases.map((phase) => {
                const data = phaseMappingData[phase] ?? { title: '', duties: '' };
                return (
                  <div key={phase} className="team-roster__phase-row">
                    <span className="team-roster__phase-name">{phase}</span>
                    <input
                      className="team-roster__form-input"
                      value={data.title}
                      onChange={(e) => setPhaseMappingData((prev) => ({
                        ...prev,
                        [phase]: { ...prev[phase] ?? { title: '', duties: '' }, title: e.target.value },
                      }))}
                      placeholder="Title for this phase"
                    />
                    <input
                      className="team-roster__form-input"
                      value={data.duties}
                      onChange={(e) => setPhaseMappingData((prev) => ({
                        ...prev,
                        [phase]: { ...prev[phase] ?? { title: '', duties: '' }, duties: e.target.value },
                      }))}
                      placeholder="Duties for this phase"
                    />
                  </div>
                );
              })}
              {onSaveMappings && (
                <div className="team-roster__form-actions" style={{ padding: '0.5rem 0.75rem' }}>
                  <button
                    className="team-roster__btn team-roster__btn--primary team-roster__btn--sm"
                    onClick={handleSaveMappings}
                    disabled={saving}
                  >
                    Save Mappings
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="team-roster__form-actions">
        <button className="team-roster__btn" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button
          className="team-roster__btn team-roster__btn--primary"
          onClick={handleSubmit}
          disabled={saving || !title.trim()}
        >
          {saving ? 'Saving...' : (position ? 'Update' : 'Create')}
        </button>
      </div>
    </div>
  );
}
