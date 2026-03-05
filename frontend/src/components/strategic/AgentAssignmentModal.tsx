/**
 * AgentAssignmentModal Component
 *
 * Modal for assigning agents/teams to documents.
 * Allows selecting an agent, assignment type, and configuration.
 */

import { useState, useEffect } from 'react';
import { API_BASE } from '../../lib/strategic-service.js';
import './AgentAssignmentModal.css';

interface Agent {
  agentId: string;
  displayName: string;
  description?: string;
  phase: string;
  capabilities: string[];
}

interface Team {
  teamId: string;
  name: string;
  description?: string;
  workflowType: string;
  memberCount: number;
}

interface AgentAssignmentModalProps {
  documentId: string;
  userDID: string;
  onClose: () => void;
  onAssigned: () => void;
}

type AssignmentType = 'review' | 'monitor' | 'analyze';

export function AgentAssignmentModal({
  documentId,
  userDID,
  onClose,
  onAssigned,
}: AgentAssignmentModalProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [assignmentMode, setAssignmentMode] = useState<'agent' | 'team'>('agent');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [assignmentType, setAssignmentType] = useState<AssignmentType>('review');

  useEffect(() => {
    const loadAgentsAndTeams = async () => {
      setLoading(true);
      setError(null);
      try {
        // Load agents
        const agentsRes = await fetch(`${API_BASE}/api/strategic/agents`, {
          headers: { 'X-DID': userDID },
        });
        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAgents(data.agents || []);
          if (data.agents?.length > 0) {
            setSelectedAgentId(data.agents[0].agentId);
          }
        }

        // Load teams
        const teamsRes = await fetch(`${API_BASE}/api/strategic/teams`, {
          headers: { 'X-DID': userDID },
        });
        if (teamsRes.ok) {
          const data = await teamsRes.json();
          setTeams(data.teams || []);
          if (data.teams?.length > 0) {
            setSelectedTeamId(data.teams[0].teamId);
          }
        }
      } catch (_err) {
        setError('Failed to load agents and teams');
      } finally {
        setLoading(false);
      }
    };
    loadAgentsAndTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAssign = async () => {
    if (assignmentMode === 'agent' && !selectedAgentId) {
      setError('Please select an agent');
      return;
    }
    if (assignmentMode === 'team' && !selectedTeamId) {
      setError('Please select a team');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE}/api/strategic/assignments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
          body: JSON.stringify({
            documentId,
            agentId: selectedAgentId || selectedTeamId,
            autoReview: assignmentType === 'monitor',
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to assign');
      }

      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="assignment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Assign Agent/Team</h3>
          <button className="close-btn" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-content">
          {error && (
            <div className="modal-error">{error}</div>
          )}

          {loading ? (
            <div className="modal-loading">
              <span className="spinner" />
              Loading...
            </div>
          ) : (
            <>
              {/* Assignment Mode Toggle */}
              <div className="form-group">
                <label>Assign to</label>
                <div className="mode-toggle">
                  <button
                    type="button"
                    className={assignmentMode === 'agent' ? 'active' : ''}
                    onClick={() => setAssignmentMode('agent')}
                  >
                    Agent
                  </button>
                  <button
                    type="button"
                    className={assignmentMode === 'team' ? 'active' : ''}
                    onClick={() => setAssignmentMode('team')}
                  >
                    Team
                  </button>
                </div>
              </div>

              {/* Agent Selection */}
              {assignmentMode === 'agent' && (
                <div className="form-group">
                  <label htmlFor="agent-select">Agent</label>
                  {agents.length === 0 ? (
                    <p className="no-items">No agents available</p>
                  ) : (
                    <select
                      id="agent-select"
                      value={selectedAgentId}
                      onChange={(e) => setSelectedAgentId(e.target.value)}
                    >
                      {agents.map((agent) => (
                        <option key={agent.agentId} value={agent.agentId}>
                          {agent.displayName} ({agent.phase})
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedAgentId && agents.find(a => a.agentId === selectedAgentId)?.description && (
                    <p className="item-description">
                      {agents.find(a => a.agentId === selectedAgentId)?.description}
                    </p>
                  )}
                </div>
              )}

              {/* Team Selection */}
              {assignmentMode === 'team' && (
                <div className="form-group">
                  <label htmlFor="team-select">Team</label>
                  {teams.length === 0 ? (
                    <p className="no-items">No teams available</p>
                  ) : (
                    <select
                      id="team-select"
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                    >
                      {teams.map((team) => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.name} ({team.workflowType}, {team.memberCount} members)
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedTeamId && teams.find(t => t.teamId === selectedTeamId)?.description && (
                    <p className="item-description">
                      {teams.find(t => t.teamId === selectedTeamId)?.description}
                    </p>
                  )}
                </div>
              )}

              {/* Assignment Type */}
              <div className="form-group">
                <label htmlFor="type-select">Assignment Type</label>
                <select
                  id="type-select"
                  value={assignmentType}
                  onChange={(e) => setAssignmentType(e.target.value as AssignmentType)}
                >
                  <option value="review">Review - Analyze and categorize objectives</option>
                  <option value="monitor">Monitor - Watch for changes</option>
                  <option value="analyze">Analyze - Deep analysis</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="cancel-btn"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="assign-btn"
            onClick={handleAssign}
            disabled={submitting || loading}
          >
            {submitting ? 'Assigning...' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
