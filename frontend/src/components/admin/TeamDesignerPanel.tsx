/**
 * TeamDesignerPanel Component
 *
 * Phase 51: Unified Agent Architecture — Plan 05
 *
 * Visual team designer with drag-and-drop agent composition:
 * - Left pane: available agents (draggable cards)
 * - Center pane: team composition area (droppable)
 * - Right pane: team config form + workflow editor
 *
 * Features:
 * - Drag agents from the available list into team composition area (@dnd-kit)
 * - Sortable execution order for sequential/pipeline workflows (@dnd-kit/sortable)
 * - Leader/orchestrator designation
 * - Workflow type selection (sequential, parallel, pipeline, supervised)
 * - Problem set assignment dropdown
 * - Team testing with per-agent trace view
 * - Team list view with create/edit/delete actions
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { useDraggable, useDroppable } from '@dnd-kit/core';

/** Build a CSS transform string from a @dnd-kit transform object */
function toCSSTransform(transform: { x: number; y: number; scaleX: number; scaleY: number } | null): string | undefined {
  if (!transform) return undefined;
  return `translate3d(${transform.x}px, ${transform.y}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`;
}
import { adminService } from '../../lib/admin-service';
import { problemSetService } from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';
import { FormField } from './common/FormField';
import type {
  AgentTeam,
  AgentTeamInput,
  TeamMember,
  TeamMemberRole,
  AgentTestTrace,
  AgentWithConfig,
} from '../../types/admin';

// ============================================================================
// Types & Constants
// ============================================================================

const WORKFLOW_TYPES = ['sequential', 'parallel', 'pipeline', 'supervised', 'consensus', 'hierarchical'] as const;
type DesignerWorkflowType = typeof WORKFLOW_TYPES[number];

const MEMBER_ROLES: TeamMemberRole[] = ['coordinator', 'specialist', 'validator', 'executor'];

// ============================================================================
// Zod Schema (extends TeamComposerPanel patterns)
// ============================================================================

const TeamDesignerSchema = z.object({
  teamId: z
    .string()
    .min(1, 'Team ID is required')
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, 'Team ID must be alphanumeric with underscores/hyphens'),
  name: z.string().min(3, 'Name must be at least 3 characters').max(50, 'Name must be at most 50 characters'),
  description: z.string().max(500).optional(),
  purpose: z.string().min(1, 'Purpose is required').max(1000),
  workflowType: z.enum(['sequential', 'parallel', 'pipeline', 'supervised', 'consensus', 'hierarchical']),
  leaderId: z.string().optional(),
  problemSetId: z.string().optional(),
});

type TeamDesignerFormData = z.infer<typeof TeamDesignerSchema>;

// ============================================================================
// Draggable Agent Card (in available agents pane)
// ============================================================================

interface DraggableAgentCardProps {
  agent: AgentWithConfig;
  isInTeam: boolean;
}

function DraggableAgentCard({ agent, isInTeam }: DraggableAgentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `available-${agent.agentId}`,
    disabled: isInTeam,
  });

  const style = {
    transform: toCSSTransform(transform),
    opacity: isDragging ? 0.5 : isInTeam ? 0.4 : 1,
    cursor: isInTeam ? 'not-allowed' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`agent-drag-card ${isInTeam ? 'agent-drag-card--used' : ''}`}
    >
      <div className="agent-drag-card-name">{agent.name}</div>
      <div className="agent-drag-card-meta">
        <span className={`badge badge--phase badge--${agent.phase?.toLowerCase()}`}>
          {agent.phase}
        </span>
        <span className={`badge ${agent.active ? 'badge--active' : 'badge--inactive'}`}>
          {agent.active ? 'active' : 'inactive'}
        </span>
      </div>
      {isInTeam && <div className="agent-drag-card-in-team">In team</div>}
    </div>
  );
}

// ============================================================================
// Sortable Team Member Card (in composition area)
// ============================================================================

interface TeamMemberCardProps {
  member: TeamMember;
  agentName: string;
  isLeader: boolean;
  onRemove: (agentId: string) => void;
  onRoleChange: (agentId: string, role: TeamMemberRole) => void;
  onSetLeader: (agentId: string) => void;
}

function SortableTeamMemberCard({
  member,
  agentName,
  isLeader,
  onRemove,
  onRoleChange,
  onSetLeader,
}: TeamMemberCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: member.agentId,
  });

  const style = {
    transform: toCSSTransform(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`team-member-designer-card ${isLeader ? 'team-member-designer-card--leader' : ''}`}
    >
      <div className="team-member-drag-handle" {...attributes} {...listeners}>
        &#8597;
      </div>

      <div className="team-member-info-section">
        <div className="team-member-name-row">
          {isLeader && <span className="leader-crown" title="Team Leader">&#9812;</span>}
          <span className="team-member-name">{agentName}</span>
        </div>

        <select
          className="form-select form-select--sm"
          value={member.role}
          onChange={(e) => onRoleChange(member.agentId, e.target.value as TeamMemberRole)}
        >
          {MEMBER_ROLES.map((role) => (
            <option key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div className="team-member-actions">
        {!isLeader && (
          <button
            type="button"
            className="btn btn--xs btn--secondary"
            onClick={() => onSetLeader(member.agentId)}
            title="Set as leader"
          >
            Set Leader
          </button>
        )}
        <button
          type="button"
          className="btn btn--xs btn--danger"
          onClick={() => onRemove(member.agentId)}
          title="Remove from team"
        >
          &times;
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Droppable Composition Area
// ============================================================================

interface CompositionAreaProps {
  members: TeamMember[];
  leaderId: string | undefined;
  agents: AgentWithConfig[];
  onRemove: (agentId: string) => void;
  onRoleChange: (agentId: string, role: TeamMemberRole) => void;
  onSetLeader: (agentId: string) => void;
}

function CompositionArea({ members, leaderId, agents, onRemove, onRoleChange, onSetLeader }: CompositionAreaProps) {
  const getAgentName = (agentId: string) => agents.find((a) => a.agentId === agentId)?.name ?? agentId;
  const { setNodeRef, isOver } = useDroppable({ id: 'composition-area' });

  return (
    <div
      ref={setNodeRef}
      className={`composition-area ${isOver ? 'composition-area--over' : ''}`}
    >
      {members.length === 0 ? (
        <div className="composition-area-empty">
          <p>Drag agents here to compose your team</p>
          <p className="composition-area-hint">Drop an agent from the left panel</p>
        </div>
      ) : (
        <SortableContext items={members.map((m) => m.agentId)} strategy={verticalListSortingStrategy}>
          {members.map((member) => (
            <SortableTeamMemberCard
              key={member.agentId}
              member={member}
              agentName={getAgentName(member.agentId)}
              isLeader={member.agentId === leaderId}
              onRemove={onRemove}
              onRoleChange={onRoleChange}
              onSetLeader={onSetLeader}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// ============================================================================
// Agent Test Trace Item
// ============================================================================

function AgentTraceItem({ trace }: { trace: AgentTestTrace }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`agent-trace-item ${trace.success ? 'agent-trace-item--success' : 'agent-trace-item--fail'}`}>
      <div
        className="agent-trace-header"
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`status-dot ${trace.success ? 'status-dot--success' : 'status-dot--error'}`} />
        <span className="agent-trace-name">{trace.agentId}</span>
        <span className="badge badge--role">{trace.role}</span>
        <span className="agent-trace-duration">{trace.durationMs}ms</span>
        <span className="agent-trace-expand">{expanded ? '&#9650;' : '&#9660;'}</span>
      </div>
      {expanded && (
        <div className="agent-trace-body">
          <div className="agent-trace-section">
            <span className="agent-trace-label">Input:</span>
            <pre className="agent-trace-content">{trace.input}</pre>
          </div>
          <div className="agent-trace-section">
            <span className="agent-trace-label">Output:</span>
            <pre className="agent-trace-content">{trace.output}</pre>
          </div>
          {trace.error && (
            <div className="agent-trace-section agent-trace-section--error">
              <span className="agent-trace-label">Error:</span>
              <pre className="agent-trace-content">{trace.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main TeamDesignerPanel Component
// ============================================================================

type PanelView = 'list' | 'designer';

interface ProblemSetOption {
  id: string;
  name: string;
}

export function TeamDesignerPanel() {
  const { userDID } = useUser();

  // View state
  const [view, setView] = useState<PanelView>('list');
  const [editingTeam, setEditingTeam] = useState<AgentTeam | null>(null);

  // Data state
  const [teams, setTeams] = useState<AgentTeam[]>([]);
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);
  const [problemSets, setProblemSets] = useState<ProblemSetOption[]>([]);

  // Loading / feedback state
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Designer state
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [leaderId, setLeaderId] = useState<string | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Test state
  const [testPrompt, setTestPrompt] = useState('');
  const [testScenario, setTestScenario] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<import('../../types/admin').TeamTestResult | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<AgentTeam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // Form
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<TeamDesignerFormData>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(TeamDesignerSchema) as any,
    defaultValues: {
      teamId: '',
      name: '',
      description: '',
      purpose: '',
      workflowType: 'sequential',
      leaderId: '',
      problemSetId: '',
    },
  });

  const watchedLeaderId = watch('leaderId');

  // Sync form leaderId to state
  useEffect(() => {
    setLeaderId(watchedLeaderId || undefined);
  }, [watchedLeaderId]);

  // ─── Data Loading ───────────────────────────────────────────────────────────

  const loadTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const list = await adminService.listTeams();
      setTeams(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadAgents = useCallback(async () => {
    try {
      const list = await adminService.listAgents();
      setAgents(list);
    } catch (err) {
      console.warn('[TeamDesignerPanel] Failed to load agents:', err);
    }
  }, []);

  const loadProblemSets = useCallback(async () => {
    if (!userDID) return;
    try {
      const memberships = await problemSetService.listMyMemberships(userDID);
      setProblemSets(memberships.map((m) => ({ id: m.problemSetId, name: m.name })));
    } catch (err) {
      console.warn('[TeamDesignerPanel] Failed to load problem sets:', err);
    }
  }, [userDID]);

  useEffect(() => {
    loadTeams();
    loadAgents();
    loadProblemSets();
  }, [loadTeams, loadAgents, loadProblemSets]);

  // ─── Designer helpers ───────────────────────────────────────────────────────

  const getAgentName = (agentId: string) => agents.find((a) => a.agentId === agentId)?.name ?? agentId;

  const openDesigner = (team?: AgentTeam) => {
    if (team) {
      setEditingTeam(team);
      setTeamMembers([...team.members]);
      setLeaderId(team.leaderId ?? team.members[0]?.agentId);
      reset({
        teamId: team.teamId,
        name: team.name,
        description: team.description ?? '',
        purpose: team.purpose,
        workflowType: (WORKFLOW_TYPES.includes(team.workflow.type as DesignerWorkflowType)
          ? team.workflow.type
          : 'sequential') as DesignerWorkflowType,
        leaderId: team.leaderId ?? team.members[0]?.agentId ?? '',
        problemSetId: team.assignedProblemSets?.[0] ?? '',
      });
    } else {
      setEditingTeam(null);
      setTeamMembers([]);
      setLeaderId(undefined);
      reset();
    }
    setTestResult(null);
    setView('designer');
  };

  const closeDesigner = () => {
    setView('list');
    setEditingTeam(null);
    setTeamMembers([]);
    setLeaderId(undefined);
    setTestResult(null);
    setError(null);
  };

  // ─── DnD Handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // Dropping from available agents pane onto composition area (or any member within)
    if (activeIdStr.startsWith('available-')) {
      const agentId = activeIdStr.replace('available-', '');
      // over.id can be 'composition-area' or an existing member's agentId
      if (!teamMembers.some((m) => m.agentId === agentId)) {
        const newMember: TeamMember = {
          agentId,
          role: 'specialist',
          responsibilities: [],
          canInitiate: false,
          canEscalate: true,
        };
        const updated = [...teamMembers, newMember];
        setTeamMembers(updated);
        // Auto-set first member as leader
        if (updated.length === 1) {
          setLeaderId(agentId);
          setValue('leaderId', agentId);
        }
      }
      return;
    }

    // Reordering within composition area (active and over are both agentIds)
    if (activeIdStr !== overIdStr && overIdStr !== 'composition-area') {
      const oldIndex = teamMembers.findIndex((m) => m.agentId === activeIdStr);
      const newIndex = teamMembers.findIndex((m) => m.agentId === overIdStr);
      if (oldIndex !== -1 && newIndex !== -1) {
        setTeamMembers(arrayMove(teamMembers, oldIndex, newIndex));
      }
    }
  };

  const handleRemoveMember = (agentId: string) => {
    const updated = teamMembers.filter((m) => m.agentId !== agentId);
    setTeamMembers(updated);
    if (leaderId === agentId) {
      const newLeader = updated[0]?.agentId;
      setLeaderId(newLeader);
      setValue('leaderId', newLeader ?? '');
    }
  };

  const handleRoleChange = (agentId: string, role: TeamMemberRole) => {
    setTeamMembers((prev) => prev.map((m) => m.agentId === agentId ? { ...m, role } : m));
  };

  const handleSetLeader = (agentId: string) => {
    setLeaderId(agentId);
    setValue('leaderId', agentId);
  };

  // ─── Form Submit ────────────────────────────────────────────────────────────

  const onSubmit = async (data: TeamDesignerFormData) => {
    if (teamMembers.length === 0) {
      setError('Team must have at least one member');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Build sorted execution stages from current member order
      const stages = teamMembers.map((m, idx) => ({
        stageId: `stage-${idx + 1}`,
        name: `Step ${idx + 1}: ${getAgentName(m.agentId)}`,
        assignedAgents: [m.agentId],
        nextStages: idx < teamMembers.length - 1 ? [`stage-${idx + 2}`] : [],
      }));

      // Map leader to coordinator role
      const membersWithLeader: TeamMember[] = teamMembers.map((m) => ({
        ...m,
        role: m.agentId === data.leaderId ? 'coordinator' : m.role,
        canInitiate: m.agentId === data.leaderId,
      }));

      const input: AgentTeamInput = {
        teamId: data.teamId,
        name: data.name,
        description: data.description ?? '',
        purpose: data.purpose,
        members: membersWithLeader,
        workflow: {
          type: data.workflowType as AgentTeamInput['workflow']['type'],
          stages,
          humanCheckpoints: [],
        },
        isEnabled: true,
      };

      if (editingTeam) {
        await adminService.updateTeam(editingTeam.teamId, {
          name: input.name,
          description: input.description,
          purpose: input.purpose,
          members: input.members,
          workflow: input.workflow,
        });
        // Handle problem set assignment change
        if (data.problemSetId) {
          await adminService.assignTeam(editingTeam.teamId, data.problemSetId);
        }
        setSuccessMessage(`Team "${data.name}" updated successfully`);
      } else {
        const result = await adminService.createTeam(input);
        if (data.problemSetId) {
          await adminService.assignTeam(result.teamId, data.problemSetId);
        }
        setSuccessMessage(`Team "${data.name}" created (${result.teamDID})`);
      }

      await loadTeams();
      setTimeout(() => {
        setSuccessMessage(null);
        closeDesigner();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save team');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Team Test ──────────────────────────────────────────────────────────────

  const handleRunTest = async () => {
    if (!editingTeam || !testPrompt.trim()) return;

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const result = await adminService.testTeam(editingTeam.teamId, testPrompt, testScenario || undefined);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Team test failed');
    } finally {
      setIsTesting(false);
    }
  };

  // ─── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminService.deleteTeam(deleteTarget.teamId);
      await loadTeams();
      setSuccessMessage(`Team "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    } finally {
      setIsDeleting(false);
    }
  };

  // ─── Render: Team List ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading team designer...</p>
      </div>
    );
  }

  const activeAgent = activeId?.startsWith('available-')
    ? agents.find((a) => a.agentId === activeId.replace('available-', ''))
    : null;

  // ─── Team List View ─────────────────────────────────────────────────────────

  if (view === 'list') {
    return (
      <div className="config-panel">
        <div className="config-panel-header">
          <h2>Agent Teams</h2>
          <p>Compose agent teams with drag-and-drop, define workflows, assign to problem sets.</p>
        </div>

        {error && (
          <div className="alert alert--error">
            <span className="alert-icon">!</span>
            {error}
          </div>
        )}
        {successMessage && (
          <div className="alert alert--success">
            <span className="alert-icon">&#10003;</span>
            {successMessage}
          </div>
        )}

        <div className="config-section">
          <div className="section-header-row">
            <h3>Teams ({teams.length})</h3>
            <button className="btn btn--primary" onClick={() => openDesigner()}>
              + Create Team
            </button>
          </div>

          {teams.length === 0 ? (
            <div className="empty-state">
              No teams yet. Click "Create Team" to compose your first agent team.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Members</th>
                  <th>Workflow</th>
                  <th>Assigned Problem Sets</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.teamId}>
                    <td>
                      <div className="team-name-cell">
                        <span className="team-name">{team.name}</span>
                        <span className="team-id-label">{team.teamId}</span>
                      </div>
                    </td>
                    <td>{team.members?.length ?? 0}</td>
                    <td>
                      <span className={`badge badge--workflow badge--${team.workflow?.type}`}>
                        {team.workflow?.type ?? '—'}
                      </span>
                    </td>
                    <td>
                      {(team.assignedProblemSets?.length ?? 0) > 0 ? (
                        <span className="badge badge--assigned">
                          {team.assignedProblemSets?.length} assigned
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${team.isEnabled ? 'badge--active' : 'badge--inactive'}`}>
                        {team.isEnabled ? 'enabled' : 'disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={() => openDesigner(team)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn--sm btn--danger"
                          onClick={() => setDeleteTarget(team)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
            <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header modal-header--danger">
                <h3>Delete Team</h3>
                <button className="modal-close" onClick={() => setDeleteTarget(null)}>&times;</button>
              </div>
              <div className="modal-body">
                <p>Delete <strong>{deleteTarget.name}</strong>?</p>
                <p className="text-muted">This removes the team and all assignments. The DID will be invalidated.</p>
                <div className="modal-footer">
                  <button className="btn btn--secondary" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
                    Cancel
                  </button>
                  <button className="btn btn--danger" onClick={handleDelete} disabled={isDeleting}>
                    {isDeleting ? 'Deleting...' : 'Delete Team'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Designer View ──────────────────────────────────────────────────────────

  const usedAgentIds = new Set(teamMembers.map((m) => m.agentId));

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <div className="header-with-back">
          <button className="btn btn--ghost btn--sm" onClick={closeDesigner}>
            &#8592; Back to Teams
          </button>
          <h2>{editingTeam ? `Edit: ${editingTeam.name}` : 'Create Team'}</h2>
        </div>
        <p>Drag agents into the composition area. Set the leader and workflow type, then save.</p>
      </div>

      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}
      {successMessage && (
        <div className="alert alert--success">
          <span className="alert-icon">&#10003;</span>
          {successMessage}
        </div>
      )}

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="team-designer-layout">
          {/* LEFT: Available agents */}
          <div className="team-designer-left">
            <h3>Available Agents</h3>
            <p className="section-hint">Drag onto the composition area</p>
            <div className="agent-available-list">
              {agents.length === 0 ? (
                <div className="empty-state">No agents found</div>
              ) : (
                agents.map((agent) => (
                  <DraggableAgentCard
                    key={agent.agentId}
                    agent={agent}
                    isInTeam={usedAgentIds.has(agent.agentId)}
                  />
                ))
              )}
            </div>
          </div>

          {/* CENTER: Composition area */}
          <div className="team-designer-center">
            <h3>Team Composition</h3>
            <p className="section-hint">
              {teamMembers.length > 0
                ? `${teamMembers.length} agent${teamMembers.length !== 1 ? 's' : ''} — drag to reorder`
                : 'Drop agents here'}
            </p>
            <CompositionArea
              members={teamMembers}
              leaderId={leaderId}
              agents={agents}
              onRemove={handleRemoveMember}
              onRoleChange={handleRoleChange}
              onSetLeader={handleSetLeader}
            />
          </div>

          {/* RIGHT: Config form */}
          <div className="team-designer-right">
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="config-section">
                <h3>Team Config</h3>

                {!editingTeam && (
                  <FormField label="Team ID" required error={errors.teamId?.message}>
                    <input
                      type="text"
                      {...register('teamId')}
                      className="form-input"
                      placeholder="alpha_team"
                    />
                  </FormField>
                )}

                <FormField label="Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    {...register('name')}
                    className="form-input"
                    placeholder="Alpha Team"
                  />
                </FormField>

                <FormField label="Description" error={errors.description?.message}>
                  <textarea
                    {...register('description')}
                    className="form-input form-textarea"
                    placeholder="Brief description..."
                    rows={2}
                  />
                </FormField>

                <FormField label="Purpose / Mission" required error={errors.purpose?.message}>
                  <textarea
                    {...register('purpose')}
                    className="form-input form-textarea"
                    placeholder="Team mission statement..."
                    rows={3}
                  />
                </FormField>
              </div>

              <div className="config-section">
                <h3>Workflow</h3>

                <FormField label="Workflow Type" required error={errors.workflowType?.message}>
                  <select {...register('workflowType')} className="form-select">
                    {WORKFLOW_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Leader / Orchestrator" error={errors.leaderId?.message}>
                  <select {...register('leaderId')} className="form-select">
                    <option value="">Select leader...</option>
                    {teamMembers.map((m) => (
                      <option key={m.agentId} value={m.agentId}>
                        {getAgentName(m.agentId)}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="config-section">
                <h3>Assignment</h3>

                <FormField label="Assign to Problem Set" error={errors.problemSetId?.message}>
                  <select {...register('problemSetId')} className="form-select">
                    <option value="">— none —</option>
                    {problemSets.map((ps) => (
                      <option key={ps.id} value={ps.id}>
                        {ps.name}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn--secondary" onClick={closeDesigner}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn--primary"
                  disabled={isSaving || teamMembers.length === 0}
                >
                  {isSaving ? 'Saving...' : editingTeam ? 'Update Team' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* DnD overlay for dragged agent card */}
        <DragOverlay>
          {activeAgent ? (
            <div className="agent-drag-card agent-drag-card--overlay">
              <div className="agent-drag-card-name">{activeAgent.name}</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Team Testing Section (only for existing teams) */}
      {editingTeam && (
        <div className="config-section team-test-section">
          <h3>Team Test</h3>
          <p className="section-hint">
            Run a test prompt through the team workflow to see per-agent outputs.
          </p>

          <div className="form-row">
            <FormField label="Scenario (optional)">
              <input
                type="text"
                className="form-input"
                placeholder="Pacific AY26 — Competition Phase"
                value={testScenario}
                onChange={(e) => setTestScenario(e.target.value)}
              />
            </FormField>
          </div>

          <FormField label="Test Prompt" required>
            <textarea
              className="form-input form-textarea"
              placeholder="Analyze the current threat environment in the Taiwan Strait..."
              rows={3}
              value={testPrompt}
              onChange={(e) => setTestPrompt(e.target.value)}
            />
          </FormField>

          <button
            type="button"
            className="btn btn--primary"
            onClick={handleRunTest}
            disabled={isTesting || !testPrompt.trim()}
          >
            {isTesting ? 'Running Test...' : 'Run Team Test'}
          </button>

          {testResult && (
            <div className="team-test-results">
              <div className={`team-test-summary ${testResult.success ? 'team-test-summary--success' : 'team-test-summary--fail'}`}>
                <span>
                  {testResult.summary.successfulAgents}/{testResult.summary.totalAgents} agents succeeded
                </span>
                <span>{testResult.summary.totalDurationMs}ms total</span>
                <span className={`badge ${testResult.success ? 'badge--active' : 'badge--error'}`}>
                  {testResult.success ? 'PASS' : 'PARTIAL'}
                </span>
              </div>

              <div className="agent-traces">
                {testResult.agentTraces.map((trace, i) => (
                  <AgentTraceItem key={`${trace.agentId}-${i}`} trace={trace} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
