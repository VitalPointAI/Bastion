/**
 * TeamComposerPanel Component
 *
 * Administrative panel for creating and managing agent teams:
 * - Create teams with members and roles
 * - Configure workflow stages and types
 * - Set escalation policies
 * - Manage team membership
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { adminService } from '../../lib/admin-service';
import type {
  AgentTeam,
  AgentTeamInput,
  TeamMember,
  TeamMemberRole,
  WorkflowType,
  AgentWithConfig,
} from '../../types/admin';
import { FormField } from './common/FormField';

const WORKFLOW_TYPES: WorkflowType[] = ['sequential', 'parallel', 'consensus', 'hierarchical'];
const MEMBER_ROLES: TeamMemberRole[] = ['coordinator', 'specialist', 'validator', 'executor'];
const NOTIFICATION_CHANNELS = ['email', 'slack', 'webhook'] as const;

// Zod schema for team creation form
const TeamFormSchema = z.object({
  teamId: z.string()
    .min(1, 'Team ID is required')
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, 'Team ID must be alphanumeric with underscores/hyphens'),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  purpose: z.string().min(1, 'Purpose is required').max(1000),
  workflowType: z.enum(['sequential', 'parallel', 'consensus', 'hierarchical']),
  maxConcurrency: z.number().min(1).max(100).default(5),
  isEnabled: z.boolean().default(true),
  // Escalation policy
  escalationEnabled: z.boolean().default(true),
  escalationTimeout: z.number().min(60).max(86400).default(3600),
  escalationTargets: z.string().optional(),
  escalationChannels: z.array(z.string()).default([]),
});

type TeamFormData = z.infer<typeof TeamFormSchema>;

export function TeamComposerPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Team list
  const [teams, setTeams] = useState<AgentTeam[]>([]);

  // Expanded team for details
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);

  // Available agents for membership
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);

  // Form submission state
  const [isCreating, setIsCreating] = useState(false);
  const [createdTeamDID, setCreatedTeamDID] = useState<string | null>(null);

  // Team members being added
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [memberAgentId, setMemberAgentId] = useState<string>('');
  const [memberRole, setMemberRole] = useState<TeamMemberRole>('specialist');

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AgentTeam | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Add member modal
  const [addMemberTeam, setAddMemberTeam] = useState<AgentTeam | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors },
  } = useForm<TeamFormData>({
    resolver: zodResolver(TeamFormSchema),
    defaultValues: {
      teamId: '',
      name: '',
      description: '',
      purpose: '',
      workflowType: 'sequential',
      maxConcurrency: 5,
      isEnabled: true,
      escalationEnabled: true,
      escalationTimeout: 3600,
      escalationTargets: '',
      escalationChannels: [],
    },
  });

  // Load teams
  const loadTeams = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const teamList = await adminService.listTeams();
      setTeams(teamList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load agents
  const loadAgents = useCallback(async () => {
    try {
      const agentList = await adminService.listAgents();
      setAgents(agentList);
    } catch (err) {
      console.warn('Failed to load agents:', err);
    }
  }, []);

  useEffect(() => {
    loadTeams();
    loadAgents();
  }, [loadTeams, loadAgents]);

  // Add member to temporary list
  const handleAddMemberToList = () => {
    if (!memberAgentId) return;

    // Check if already in list
    if (teamMembers.some(m => m.agentId === memberAgentId)) {
      setError('Agent already added to team');
      return;
    }

    const newMember: TeamMember = {
      agentId: memberAgentId,
      role: memberRole,
      responsibilities: [],
      canInitiate: memberRole === 'coordinator',
      canEscalate: true,
    };

    setTeamMembers([...teamMembers, newMember]);
    setMemberAgentId('');
  };

  // Remove member from temporary list
  const handleRemoveMemberFromList = (agentId: string) => {
    setTeamMembers(teamMembers.filter(m => m.agentId !== agentId));
  };

  // Handle form submission
  const onSubmit = async (data: TeamFormData) => {
    if (teamMembers.length === 0) {
      setError('Team must have at least one member');
      return;
    }

    setIsCreating(true);
    setError(null);
    setCreatedTeamDID(null);

    try {
      const input: AgentTeamInput = {
        teamId: data.teamId,
        name: data.name,
        description: data.description,
        purpose: data.purpose,
        members: teamMembers,
        workflow: {
          type: data.workflowType,
          stages: [],
          humanCheckpoints: [],
        },
        escalationPolicy: {
          enabled: data.escalationEnabled,
          timeoutSeconds: data.escalationTimeout,
          targets: data.escalationTargets
            ? data.escalationTargets.split(',').map(t => t.trim()).filter(Boolean)
            : [],
          notificationChannels: data.escalationChannels as ('email' | 'slack' | 'webhook')[],
        },
        maxConcurrency: data.maxConcurrency,
        isEnabled: data.isEnabled,
      };

      const result = await adminService.createTeam(input);

      setCreatedTeamDID(result.teamDID);
      setSuccessMessage(`Team "${data.name}" created successfully!`);

      // Refresh team list
      await loadTeams();

      // Reset form and members
      reset();
      setTeamMembers([]);

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete team
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

  // Add member to existing team
  const handleAddMember = async () => {
    if (!addMemberTeam || !memberAgentId) return;

    setIsAddingMember(true);
    try {
      const member: TeamMember = {
        agentId: memberAgentId,
        role: memberRole,
        responsibilities: [],
        canInitiate: memberRole === 'coordinator',
        canEscalate: true,
      };

      await adminService.addTeamMember(addMemberTeam.teamId, member);

      await loadTeams();

      setSuccessMessage('Member added to team');
      setAddMemberTeam(null);
      setMemberAgentId('');

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  // Remove member from existing team
  const handleRemoveMember = async (teamId: string, agentId: string) => {
    try {
      await adminService.removeTeamMember(teamId, agentId);
      await loadTeams();
      setSuccessMessage('Member removed from team');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  // Toggle team enable/disable
  const toggleEnabled = async (team: AgentTeam) => {
    try {
      await adminService.updateTeam(team.teamId, { isEnabled: !team.isEnabled });
      await loadTeams();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team');
    }
  };

  // Get agent name by ID
  const getAgentName = (agentId: string): string => {
    const agent = agents.find(a => a.agentId === agentId);
    return agent?.name || agentId;
  };

  if (isLoading && teams.length === 0) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading team composer...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>Team Composer</h2>
        <p>Create and manage multi-agent teams for coordinated workflows.</p>
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
          {createdTeamDID && (
            <div className="created-did">
              <span className="created-did-label">Team DID:</span>
              <code className="created-did-value">{createdTeamDID}</code>
            </div>
          )}
        </div>
      )}

      <Tabs className="management-tabs">
        <TabList className="management-tab-list">
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Teams ({teams.length})
          </Tab>
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Create Team
          </Tab>
        </TabList>

        {/* Teams List Tab */}
        <TabPanel className="management-tab-panel">
          <div className="config-section">
            <h3>Agent Teams</h3>

            {teams.length === 0 ? (
              <div className="empty-state">
                No teams created yet. Create one in the "Create Team" tab.
              </div>
            ) : (
              <div className="team-cards-list">
                {teams.map((team) => (
                  <div
                    key={team.teamId}
                    className={`team-card ${expandedTeamId === team.teamId ? 'team-card--expanded' : ''}`}
                  >
                    <div
                      className="team-card-header"
                      onClick={() => setExpandedTeamId(expandedTeamId === team.teamId ? null : team.teamId)}
                    >
                      <div className="team-card-info">
                        <span className="team-card-name">{team.name}</span>
                        <div className="team-card-badges">
                          <span className={`badge badge--workflow badge--${team.workflow.type}`}>
                            {team.workflow.type}
                          </span>
                          {team.teamDID && (
                            <span className="badge badge--did" title={team.teamDID}>
                              DID
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="team-card-meta">
                        <span className="team-card-members">
                          {team.members.length} members
                        </span>
                        <span className={`team-card-expand ${expandedTeamId === team.teamId ? 'expanded' : ''}`}>
                          &#9660;
                        </span>
                      </div>
                    </div>

                    <div className={`team-card-body ${expandedTeamId === team.teamId ? '' : 'collapsed'}`}>
                      <p className="team-description">{team.description}</p>

                      <div className="team-purpose">
                        <h4>Purpose</h4>
                        <p>{team.purpose}</p>
                      </div>

                      <div className="team-did-display">
                        <span className="team-did-label">DID:</span>
                        <code className="team-did-value">{team.teamDID}</code>
                      </div>

                      <div className="team-members-section">
                        <div className="team-members-header">
                          <h4>Team Members</h4>
                          <button
                            type="button"
                            className="btn btn--sm btn--secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddMemberTeam(team);
                            }}
                          >
                            + Add Member
                          </button>
                        </div>

                        <div className="team-members-grid">
                          {team.members.map((member) => (
                            <div key={member.agentId} className="team-member-card">
                              <div className="team-member-info">
                                <span className="team-member-name">{getAgentName(member.agentId)}</span>
                                <span className={`badge badge--role badge--${member.role}`}>
                                  {member.role}
                                </span>
                              </div>
                              <div className="team-member-permissions">
                                {member.canInitiate && (
                                  <span className="permission-tag">Can Initiate</span>
                                )}
                                {member.canEscalate && (
                                  <span className="permission-tag">Can Escalate</span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn btn--sm btn--danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveMember(team.teamId, member.agentId);
                                }}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="team-card-actions">
                        <label className="toggle-label toggle-label--inline">
                          <input
                            type="checkbox"
                            checked={team.isEnabled}
                            onChange={() => toggleEnabled(team)}
                            className="toggle-input"
                          />
                          <span className="toggle-switch toggle-switch--sm" />
                          <span className="toggle-text">{team.isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>

                        <button
                          className="btn btn--sm btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(team);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabPanel>

        {/* Create Team Tab */}
        <TabPanel className="management-tab-panel">
          <form onSubmit={handleSubmit(onSubmit)} className="team-create-form">
            <div className="config-section">
              <h3>Team Information</h3>

              <div className="form-row">
                <FormField label="Team ID" required error={errors.teamId?.message}>
                  <input
                    type="text"
                    {...register('teamId')}
                    className="form-input"
                    placeholder="my_team"
                  />
                </FormField>

                <FormField label="Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    {...register('name')}
                    className="form-input"
                    placeholder="My Agent Team"
                  />
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Description" required error={errors.description?.message}>
                  <textarea
                    {...register('description')}
                    className="form-input form-textarea"
                    placeholder="Brief description of the team..."
                    rows={2}
                  />
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Purpose/Mission" required error={errors.purpose?.message}>
                  <textarea
                    {...register('purpose')}
                    className="form-input form-textarea"
                    placeholder="The team's mission statement and objectives..."
                    rows={3}
                  />
                </FormField>
              </div>
            </div>

            <div className="config-section">
              <h3>Team Members</h3>
              <p className="config-section-desc">
                Add agents to the team and assign their roles.
              </p>

              <div className="member-selector">
                <div className="member-selector-row">
                  <FormField label="Agent">
                    <select
                      className="form-select"
                      value={memberAgentId}
                      onChange={(e) => setMemberAgentId(e.target.value)}
                    >
                      <option value="">Select an agent...</option>
                      {agents
                        .filter(a => !teamMembers.some(m => m.agentId === a.agentId))
                        .map(agent => (
                          <option key={agent.agentId} value={agent.agentId}>
                            {agent.name}
                          </option>
                        ))}
                    </select>
                  </FormField>

                  <FormField label="Role">
                    <select
                      className="form-select"
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value as TeamMemberRole)}
                    >
                      {MEMBER_ROLES.map(role => (
                        <option key={role} value={role}>
                          {role.charAt(0).toUpperCase() + role.slice(1)}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <button
                    type="button"
                    className="btn btn--secondary member-add-btn"
                    onClick={handleAddMemberToList}
                    disabled={!memberAgentId}
                  >
                    Add
                  </button>
                </div>
              </div>

              {teamMembers.length === 0 ? (
                <div className="empty-state">
                  No members added yet. Select an agent and click "Add".
                </div>
              ) : (
                <div className="pending-members">
                  {teamMembers.map((member) => (
                    <div key={member.agentId} className="pending-member">
                      <span className="pending-member-name">{getAgentName(member.agentId)}</span>
                      <span className={`badge badge--role badge--${member.role}`}>
                        {member.role}
                      </span>
                      <button
                        type="button"
                        className="btn btn--sm btn--danger"
                        onClick={() => handleRemoveMemberFromList(member.agentId)}
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="config-section">
              <h3>Workflow Configuration</h3>

              <div className="form-row">
                <FormField label="Workflow Type" required error={errors.workflowType?.message}>
                  <select {...register('workflowType')} className="form-select">
                    {WORKFLOW_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Max Concurrent Executions" error={errors.maxConcurrency?.message}>
                  <input
                    type="number"
                    {...register('maxConcurrency', { valueAsNumber: true })}
                    className="form-input"
                    min={1}
                    max={100}
                  />
                </FormField>
              </div>
            </div>

            <div className="config-section">
              <h3>Escalation Policy</h3>

              <div className="checkbox-field checkbox-field--compact">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('escalationEnabled')}
                    className="checkbox-input"
                  />
                  <span className="checkbox-box" />
                  <div className="checkbox-content">
                    <span className="checkbox-name">Enable Escalation</span>
                    <span className="checkbox-desc">
                      Automatically escalate unresolved issues to human reviewers.
                    </span>
                  </div>
                </label>
              </div>

              <div className="form-row">
                <FormField label="Escalation Timeout (seconds)">
                  <input
                    type="number"
                    {...register('escalationTimeout', { valueAsNumber: true })}
                    className="form-input"
                    min={60}
                    max={86400}
                  />
                </FormField>

                <FormField label="Escalation Targets" hint="Comma-separated DIDs or roles">
                  <input
                    type="text"
                    {...register('escalationTargets')}
                    className="form-input"
                    placeholder="admin, reviewer"
                  />
                </FormField>
              </div>

              <FormField label="Notification Channels">
                <div className="checkbox-group">
                  <Controller
                    name="escalationChannels"
                    control={control}
                    render={({ field }) => (
                      <>
                        {NOTIFICATION_CHANNELS.map(channel => (
                          <label key={channel} className="checkbox-inline">
                            <input
                              type="checkbox"
                              checked={field.value.includes(channel)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  field.onChange([...field.value, channel]);
                                } else {
                                  field.onChange(field.value.filter((c: string) => c !== channel));
                                }
                              }}
                              className="checkbox-input-inline"
                            />
                            <span>{channel.charAt(0).toUpperCase() + channel.slice(1)}</span>
                          </label>
                        ))}
                      </>
                    )}
                  />
                </div>
              </FormField>
            </div>

            <div className="config-section">
              <div className="checkbox-field checkbox-field--compact">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('isEnabled')}
                    className="checkbox-input"
                  />
                  <span className="checkbox-box" />
                  <div className="checkbox-content">
                    <span className="checkbox-name">Team Enabled</span>
                    <span className="checkbox-desc">
                      Team will be available for workflow execution.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isCreating || teamMembers.length === 0}
              >
                {isCreating ? 'Creating...' : 'Create Team'}
              </button>
            </div>
          </form>
        </TabPanel>
      </Tabs>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header--danger">
              <h3>Delete Team</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-muted">
                This will remove the team and all member associations. The team's DID will be invalidated.
              </p>
              <div className="modal-footer">
                <button
                  className="btn btn--secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {addMemberTeam && (
        <div className="modal-overlay" onClick={() => setAddMemberTeam(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Team Member</h3>
              <button className="modal-close" onClick={() => setAddMemberTeam(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Add a new member to <strong>{addMemberTeam.name}</strong>.
              </p>

              <FormField label="Agent">
                <select
                  className="form-select"
                  value={memberAgentId}
                  onChange={(e) => setMemberAgentId(e.target.value)}
                >
                  <option value="">Select an agent...</option>
                  {agents
                    .filter(a => !addMemberTeam.members.some(m => m.agentId === a.agentId))
                    .map(agent => (
                      <option key={agent.agentId} value={agent.agentId}>
                        {agent.name}
                      </option>
                    ))}
                </select>
              </FormField>

              <FormField label="Role">
                <select
                  className="form-select"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as TeamMemberRole)}
                >
                  {MEMBER_ROLES.map(role => (
                    <option key={role} value={role}>
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="modal-footer">
                <button
                  className="btn btn--secondary"
                  onClick={() => setAddMemberTeam(null)}
                  disabled={isAddingMember}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleAddMember}
                  disabled={isAddingMember || !memberAgentId}
                >
                  {isAddingMember ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
