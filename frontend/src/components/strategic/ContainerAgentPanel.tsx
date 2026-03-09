/**
 * ContainerAgentPanel Component (Stub - Task 2 will flesh out)
 *
 * Panel for managing container-level agent assignments (standing orders).
 */

import { useState, useEffect } from 'react';
import type { ContainerAgentAssignment } from '../../lib/types/strategic.js';
import { strategicService, API_BASE } from '../../lib/strategic-service.js';
import './ContainerAgentPanel.css';

interface Agent {
  agentId: string;
  displayName: string;
  description?: string;
  phase: string;
  capabilities: string[];
}

interface ContainerAgentPanelProps {
  containerId: string;
  containerName: string;
  userDID: string;
  onClose: () => void;
}

export function ContainerAgentPanel({
  containerId,
  containerName,
  userDID,
  onClose,
}: ContainerAgentPanelProps) {
  const [assignments, setAssignments] = useState<ContainerAgentAssignment[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSelector, setShowSelector] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Load current assignments and available agents
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [agentAssignments, agentsRes] = await Promise.all([
          strategicService.getContainerAgents(containerId),
          fetch(`${API_BASE}/api/strategic/agents`, {
            headers: { 'X-DID': userDID },
            credentials: 'include',
          }),
        ]);

        setAssignments(agentAssignments);

        if (agentsRes.ok) {
          const data = await agentsRes.json();
          setAvailableAgents(data.agents || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [containerId, userDID]);

  const handleAssignAgent = async (agentId: string, assignmentType: string = 'monitor') => {
    setSubmitting(true);
    setError(null);
    try {
      await strategicService.assignAgentToContainer(containerId, {
        agentId,
        assignmentType,
        autoProcessNew: true,
      });
      // Reload assignments
      const updated = await strategicService.getContainerAgents(containerId);
      setAssignments(updated);
      setShowSelector(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign agent');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAgent = async (agentId: string) => {
    setError(null);
    try {
      await strategicService.removeAgentFromContainer(containerId, agentId);
      setAssignments((prev) => prev.filter((a) => a.agentId !== agentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove agent');
    }
  };

  const handleToggleAutoProcess = async (assignment: ContainerAgentAssignment) => {
    setError(null);
    try {
      // Re-assign with toggled autoProcessNew (upsert semantics)
      await strategicService.assignAgentToContainer(containerId, {
        agentId: assignment.agentId,
        assignmentType: assignment.assignmentType,
        autoProcessNew: !assignment.autoProcessNew,
      });
      setAssignments((prev) =>
        prev.map((a) =>
          a.agentId === assignment.agentId
            ? { ...a, autoProcessNew: !a.autoProcessNew }
            : a
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update');
    }
  };

  // Get agent display name from available agents or fall back to agentId
  const getAgentName = (agentId: string): string => {
    const agent = availableAgents.find((a) => a.agentId === agentId);
    return agent?.displayName || (agentId ? agentId.substring(0, 20) : 'Agent');
  };

  // Filter out already-assigned agents
  const unassignedAgents = availableAgents.filter(
    (agent) => !assignments.some((a) => a.agentId === agent.agentId)
  );

  const getTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'review': return 'type-review';
      case 'monitor': return 'type-monitor';
      case 'analyze': return 'type-analyze';
      default: return 'type-default';
    }
  };

  return (
    <div className="agent-panel-overlay" onClick={onClose}>
      <div className="agent-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="agent-panel-header">
          <div>
            <h3>Container Agents</h3>
            <span className="agent-panel-subtitle">{containerName}</span>
          </div>
          <button className="agent-panel-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Standing orders explanation */}
        <div className="standing-orders-info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          Agents assigned to this container will automatically process new documents added to it.
        </div>

        {/* Error */}
        {error && (
          <div className="agent-panel-error">{error}</div>
        )}

        {/* Content */}
        <div className="agent-panel-content">
          {loading ? (
            <div className="agent-panel-loading">
              <span className="spinner" />
              Loading...
            </div>
          ) : (
            <>
              {/* Current assignments */}
              {assignments.length === 0 ? (
                <div className="agent-panel-empty">
                  No agents assigned to this container yet.
                </div>
              ) : (
                <div className="agent-assignment-list">
                  {assignments.map((assignment) => (
                    <div key={assignment.id} className="agent-assignment-row">
                      <div className="agent-assignment-info">
                        <span className="agent-assignment-name">
                          {getAgentName(assignment.agentId)}
                        </span>
                        <span className={`agent-type-badge ${getTypeBadgeClass(assignment.assignmentType)}`}>
                          {assignment.assignmentType}
                        </span>
                      </div>
                      <div className="agent-assignment-controls">
                        <label className="auto-process-toggle" title="Auto-process new documents">
                          <input
                            type="checkbox"
                            checked={assignment.autoProcessNew}
                            onChange={() => handleToggleAutoProcess(assignment)}
                          />
                          <span className="toggle-slider" />
                          <span className="toggle-label">Auto</span>
                        </label>
                        <button
                          className="remove-agent-btn"
                          onClick={() => handleRemoveAgent(assignment.agentId)}
                          title="Remove agent"
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add agent button / selector */}
              {!showSelector ? (
                <button
                  className="add-agent-btn"
                  onClick={() => setShowSelector(true)}
                  disabled={unassignedAgents.length === 0}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  {unassignedAgents.length > 0 ? 'Assign Agent' : 'All agents assigned'}
                </button>
              ) : (
                <div className="agent-selector">
                  <div className="agent-selector-header">
                    <span>Select an agent</span>
                    <button onClick={() => setShowSelector(false)}>Cancel</button>
                  </div>
                  {unassignedAgents.length === 0 ? (
                    <p className="no-agents-msg">No more agents available</p>
                  ) : (
                    <div className="agent-selector-list">
                      {unassignedAgents.map((agent) => (
                        <button
                          key={agent.agentId}
                          className="agent-selector-item"
                          onClick={() => handleAssignAgent(agent.agentId, 'monitor')}
                          disabled={submitting}
                        >
                          <div className="agent-selector-item-info">
                            <span className="agent-selector-name">{agent.displayName}</span>
                            {agent.description && (
                              <span className="agent-selector-desc">{agent.description}</span>
                            )}
                          </div>
                          <span className="agent-selector-phase">{agent.phase}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
