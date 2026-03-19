/**
 * AgentDashboardPanel Component
 *
 * Phase 51: Full agent admin dashboard with health monitoring,
 * CRUD, tool assignment, memory viewer, and test harness.
 *
 * Features:
 * - Grid of AgentHealthCard for at-a-glance status
 * - Table view of all agents with inline actions
 * - Create/edit form with tool assignment (dual-list)
 * - Activate/deactivate toggle with gate feedback
 * - Detail view: full config, memory viewer, test harness
 * - Auto-poll health data every 30 seconds
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService } from '../../lib/admin-service';
import { AgentHealthCard } from './AgentHealthCard';
import { AgentMemoryViewer } from './AgentMemoryViewer';
import { getAgentAvatarUrl } from '../../lib/agent-avatar';
import { AgentTestHarness } from './AgentTestHarness';
import { CharacterBuilderPanel } from './CharacterBuilderPanel';
import { FormField } from './common/FormField';
import type {
  StandardAgentWithHealth,
  AgentClearanceLevel,
  ToolSummary,
} from '../../types/admin';

// ============================================================================
// Constants
// ============================================================================

const CLEARANCE_LEVELS: AgentClearanceLevel[] = ['Unclassified', 'CUI', 'Secret', 'TopSecret'];
const AUTONOMY_LEVELS = ['NotAutonomous', 'SemiAutonomous', 'Autonomous'] as const;
const AVAILABLE_CAPABILITIES = [
  'ProposalScreening',
  'ContextAnalysis',
  'FeasibilityAssessment',
  'VotingGuidance',
  'DocumentExtraction',
  'RiskAssessment',
  'RedTeamAnalysis',
  'COAGeneration',
  'IntelligenceFusion',
  'ThreatMonitoring',
  'AdversaryModeling',
  'EscalationModeling',
  'DeceptionDetection',
  'AssumptionAuditing',
  'OrdersValidation',
  'ProblemFraming',
  'ROECompliance',
];

// ============================================================================
// Zod Schema
// ============================================================================

const AgentFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  systemPrompt: z.string().max(4000).optional(),
  clearance: z.enum(['Unclassified', 'CUI', 'Secret', 'TopSecret']),
  capabilities: z.array(z.string()),
  maxAutonomy: z.enum(['NotAutonomous', 'SemiAutonomous', 'Autonomous']),
  status: z.enum(['active', 'inactive', 'degraded', 'error']),
  tools: z.array(z.string()),
});

type AgentFormValues = z.infer<typeof AgentFormSchema>;

// ============================================================================
// View state
// ============================================================================

type DashboardView = 'list' | 'create' | 'edit' | 'detail';

interface DetailState {
  agent: StandardAgentWithHealth;
  detailTab: 'config' | 'character' | 'memory' | 'test';
}

// ============================================================================
// Tool Assignment Component
// ============================================================================

interface ToolAssignmentProps {
  availableTools: ToolSummary[];
  assignedTools: string[];
  onChange: (tools: string[]) => void;
}

function ToolAssignment({ availableTools, assignedTools, onChange }: ToolAssignmentProps) {
  const unassigned = availableTools.filter((t) => !assignedTools.includes(t.toolId));
  const assigned = availableTools.filter((t) => assignedTools.includes(t.toolId));

  const addTool = (toolId: string) => onChange([...assignedTools, toolId]);
  const removeTool = (toolId: string) => onChange(assignedTools.filter((id) => id !== toolId));

  return (
    <div className="tool-assignment">
      <div className="tool-assignment__col">
        <h5>Available Tools ({unassigned.length})</h5>
        <div className="tool-assignment__list">
          {unassigned.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.8rem', padding: '8px' }}>
              All tools assigned
            </p>
          ) : (
            unassigned.map((tool) => (
              <div key={tool.toolId} className="tool-assignment__item">
                <div className="tool-assignment__item-info">
                  <strong>{tool.name}</strong>
                  <span className="tool-assignment__item-desc">
                    {tool.description.substring(0, 80)}
                    {tool.description.length > 80 ? '...' : ''}
                  </span>
                  {tool.category && (
                    <span className="tool-assignment__item-cat">{tool.category}</span>
                  )}
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--primary"
                  onClick={() => addTool(tool.toolId)}
                  title="Add tool"
                >
                  +
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="tool-assignment__divider">
        <span>→</span>
      </div>

      <div className="tool-assignment__col">
        <h5>Assigned Tools ({assigned.length})</h5>
        <div className="tool-assignment__list">
          {assigned.length === 0 ? (
            <p className="text-muted" style={{ fontSize: '0.8rem', padding: '8px' }}>
              No tools assigned
            </p>
          ) : (
            assigned.map((tool) => (
              <div key={tool.toolId} className="tool-assignment__item">
                <div className="tool-assignment__item-info">
                  <strong>{tool.name}</strong>
                  <span className="tool-assignment__item-desc">
                    {tool.description.substring(0, 80)}
                    {tool.description.length > 80 ? '...' : ''}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn--sm btn--danger"
                  onClick={() => removeTool(tool.toolId)}
                  title="Remove tool"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// AgentDashboardPanel
// ============================================================================

export function AgentDashboardPanel() {
  const [agents, setAgents] = useState<StandardAgentWithHealth[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [view, setView] = useState<DashboardView>('list');
  const [editTarget, setEditTarget] = useState<StandardAgentWithHealth | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);

  const [availableTools, setAvailableTools] = useState<ToolSummary[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm modal state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'activate' | 'deactivate' | 'delete';
    agent: StandardAgentWithHealth;
  } | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Filter & sort state
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClearance, setFilterClearance] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'successRate'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ============================================================================
  // Form setup
  // ============================================================================

  const defaultFormValues: AgentFormValues = {
    name: '',
    description: '',
    systemPrompt: '',
    clearance: 'Unclassified',
    capabilities: [],
    maxAutonomy: 'NotAutonomous',
    status: 'inactive',
    tools: [],
  };

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AgentFormValues>({
    resolver: zodResolver(AgentFormSchema),
    defaultValues: defaultFormValues,
  });

  const watchedTools = watch('tools');

  // ============================================================================
  // Data loading
  // ============================================================================

  const loadAgents = useCallback(async () => {
    try {
      const data = await adminService.listAgentsWithHealth();
      setAgents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      try {
        await loadAgents();
        // Load available tools for tool assignment
        const tools = await adminService.listAvailableTools();
        setAvailableTools(tools);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize');
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // Poll every 30 seconds
    pollRef.current = setInterval(() => {
      loadAgents();
    }, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadAgents]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // ============================================================================
  // Form open helpers
  // ============================================================================

  const openCreate = () => {
    reset(defaultFormValues);
    setEditTarget(null);
    setView('create');
  };

  const openEdit = (agent: StandardAgentWithHealth) => {
    setEditTarget(agent);
    reset({
      name: agent.name,
      description: agent.description || '',
      systemPrompt: agent.systemPrompt || '',
      clearance: agent.clearance || 'Unclassified',
      capabilities: agent.capabilities || [],
      maxAutonomy: (agent.maxAutonomy as 'NotAutonomous' | 'SemiAutonomous' | 'Autonomous') || 'NotAutonomous',
      status: agent.status || 'inactive',
      tools: agent.tools || [],
    });
    setView('edit');
  };

  const openDetail = (agent: StandardAgentWithHealth) => {
    setDetail({ agent, detailTab: 'config' });
    setView('detail');
  };

  const closeForm = () => {
    setView('list');
    setEditTarget(null);
    setDetail(null);
  };

  // ============================================================================
  // Form submit
  // ============================================================================

  const onSubmit = async (data: AgentFormValues) => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (view === 'create') {
        await adminService.createAgent({
          name: data.name,
          description: data.description || '',
          type: 'custom',
          capabilities: data.capabilities,
          maxAutonomy: data.maxAutonomy,
          isEnabled: data.status === 'active',
          // Phase 51 extras
          ...({ systemPrompt: data.systemPrompt } as Record<string, unknown>),
          ...({ clearance: data.clearance } as Record<string, unknown>),
          ...({ tools: data.tools } as Record<string, unknown>),
        } as Parameters<typeof adminService.createAgent>[0]);
        showSuccess(`Agent "${data.name}" created`);
      } else if (view === 'edit' && editTarget) {
        await adminService.updateAgent(editTarget.agentId, {
          name: data.name,
          description: data.description,
          isEnabled: data.status === 'active',
          ...({ systemPrompt: data.systemPrompt } as Record<string, unknown>),
          ...({ clearance: data.clearance } as Record<string, unknown>),
          ...({ tools: data.tools } as Record<string, unknown>),
          ...({ capabilities: data.capabilities } as Record<string, unknown>),
          ...({ maxAutonomy: data.maxAutonomy } as Record<string, unknown>),
          ...({ status: data.status } as Record<string, unknown>),
        } as Parameters<typeof adminService.updateAgent>[1]);
        showSuccess(`Agent "${data.name}" updated`);
      }
      await loadAgents();
      closeForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ============================================================================
  // Action handlers
  // ============================================================================

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    setIsConfirming(true);
    setError(null);
    try {
      const { type, agent } = confirmAction;
      if (type === 'activate') {
        const result = await adminService.activateAgent(agent.agentId);
        if (!result.success) {
          setError(result.error || 'Activation failed');
          if (result.gateReason) {
            setError(`Activation gate: ${result.gateReason}`);
          }
        } else {
          showSuccess(`Agent "${agent.name}" activated`);
        }
      } else if (type === 'deactivate') {
        await adminService.deactivateAgent(agent.agentId);
        showSuccess(`Agent "${agent.name}" deactivated`);
      } else if (type === 'delete') {
        await adminService.deleteAgent(agent.agentId);
        showSuccess(`Agent "${agent.name}" deleted`);
        if (view === 'detail') closeForm();
      }
      await loadAgents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setIsConfirming(false);
      setConfirmAction(null);
    }
  };

  // ============================================================================
  // Filtered & sorted agents (must be before any early returns — hooks rule)
  // ============================================================================

  const activeAgents = agents.filter((a) => a.status === 'active');
  const inactiveAgents = agents.filter((a) => a.status !== 'active');

  const filteredAgents = useMemo(() => {
    let result = [...agents];
    if (filterStatus !== 'all') result = result.filter((a) => a.status === filterStatus);
    if (filterClearance !== 'all') result = result.filter((a) => a.clearance === filterClearance);
    result.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'status') cmp = a.status.localeCompare(b.status);
      else if (sortBy === 'successRate') cmp = (a.successRate ?? -1) - (b.successRate ?? -1);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [agents, filterStatus, filterClearance, sortBy, sortDir]);

  const toggleSort = (col: 'name' | 'status' | 'successRate') => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('asc'); }
  };
  const sortIcon = (col: string) => sortBy === col ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  function getHealthDot(agent: StandardAgentWithHealth): { color: string; label: string } {
    if (agent.validationScore !== null && agent.validationScore !== undefined) {
      if (agent.validationScore >= 0.9) return { color: '#22c55e', label: 'Healthy' };
      if (agent.validationScore >= 0.7) return { color: '#f59e0b', label: 'Degraded' };
      return { color: '#ef4444', label: 'Unhealthy' };
    }
    if (agent.successRate !== null && agent.successRate !== undefined) {
      if (agent.successRate >= 0.9) return { color: '#22c55e', label: 'Healthy' };
      if (agent.successRate >= 0.7) return { color: '#f59e0b', label: 'Degraded' };
      return { color: '#ef4444', label: 'Unhealthy' };
    }
    return { color: '#475569', label: 'No data' };
  }

  // ============================================================================
  // Render loading
  // ============================================================================

  if (isLoading) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading agent dashboard...</p>
      </div>
    );
  }

  // ============================================================================
  // Render detail view
  // ============================================================================

  if (view === 'detail' && detail) {
    const { agent, detailTab } = detail;
    const boundTools = availableTools.filter((t) => (agent.tools || []).includes(t.toolId));

    return (
      <div className="config-panel">
        <div className="config-panel-header">
          <button className="btn btn--secondary btn--sm" onClick={closeForm}>
            ← Back to List
          </button>
          <h2>{agent.name}</h2>
          <div className="header-actions">
            <button className="btn btn--secondary" onClick={() => openEdit(agent)}>
              Edit
            </button>
            {agent.status === 'active' ? (
              <button
                className="btn btn--warning"
                onClick={() => setConfirmAction({ type: 'deactivate', agent })}
              >
                Deactivate
              </button>
            ) : (
              <button
                className="btn btn--success"
                onClick={() => setConfirmAction({ type: 'activate', agent })}
              >
                Activate
              </button>
            )}
            <button
              className="btn btn--danger"
              onClick={() => setConfirmAction({ type: 'delete', agent })}
            >
              Delete
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert--error">
            <span className="alert-icon">!</span>
            {error}
          </div>
        )}

        {/* Detail tabs */}
        <div className="management-tabs">
          <div className="management-tab-list">
            {(['config', 'character', 'memory', 'test'] as const).map((tab) => (
              <button
                key={tab}
                className={`management-tab${detailTab === tab ? ' management-tab--selected' : ''}`}
                onClick={() => setDetail({ agent, detailTab: tab })}
              >
                {tab === 'config' ? 'Configuration' : tab === 'character' ? 'Character' : tab === 'memory' ? 'Memory' : 'Test Harness'}
              </button>
            ))}
          </div>
        </div>

        <div className="management-tab-panel">
          {detailTab === 'config' && (
            <div className="config-section">
              <div className="form-row">
                <div>
                  <h4>Agent Details</h4>
                  <dl className="detail-list">
                    <dt>Agent ID</dt><dd><code>{agent.agentId}</code></dd>
                    <dt>Status</dt>
                    <dd>
                      <span className={`status-badge status-badge--${agent.status}`}>
                        {agent.status}
                      </span>
                    </dd>
                    <dt>Clearance</dt><dd>{agent.clearance}</dd>
                    <dt>Max Autonomy</dt><dd>{agent.maxAutonomy}</dd>
                    {agent.agentDID && <><dt>DID</dt><dd><code style={{ fontSize: '0.7rem' }}>{agent.agentDID.substring(0, 30)}...</code></dd></>}
                  </dl>
                </div>
                <div>
                  <h4>Health Metrics</h4>
                  <AgentHealthCard agent={agent} />
                </div>
              </div>

              {agent.systemPrompt && (
                <div style={{ marginTop: '16px' }}>
                  <h4>System Prompt</h4>
                  <pre style={{ background: '#1e293b', padding: '12px', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {agent.systemPrompt}
                  </pre>
                </div>
              )}

              {agent.capabilities && agent.capabilities.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4>Capabilities</h4>
                  <div className="capabilities-grid">
                    {agent.capabilities.map((cap) => (
                      <span key={cap} className="capability-badge">{cap}</span>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '16px' }}>
                <h4>Bound Tools ({boundTools.length})</h4>
                {boundTools.length === 0 ? (
                  <p className="text-muted">No tools assigned</p>
                ) : (
                  <div className="tool-assignment__list">
                    {boundTools.map((tool) => (
                      <div key={tool.toolId} className="tool-assignment__item">
                        <div className="tool-assignment__item-info">
                          <strong>{tool.name}</strong>
                          <span className="tool-assignment__item-desc">{tool.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {detailTab === 'character' && (
            <CharacterBuilderPanel agentId={agent.agentId} />
          )}

          {detailTab === 'memory' && (
            <AgentMemoryViewer agentId={agent.agentId} />
          )}

          {detailTab === 'test' && (
            <AgentTestHarness agent={agent} />
          )}
        </div>

        {confirmAction && (
          <ConfirmModal
            action={confirmAction.type}
            agentName={confirmAction.agent.name}
            isConfirming={isConfirming}
            onConfirm={handleConfirmAction}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // Render create/edit form
  // ============================================================================

  if (view === 'create' || view === 'edit') {
    return (
      <div className="config-panel">
        <div className="config-panel-header">
          <button className="btn btn--secondary btn--sm" onClick={closeForm}>
            ← Back
          </button>
          <h2>{view === 'create' ? 'Create Agent' : `Edit: ${editTarget?.name}`}</h2>
        </div>

        {error && (
          <div className="alert alert--error">
            <span className="alert-icon">!</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="agent-create-form">
          <div className="config-section">
            <h3>Basic Information</h3>
            <div className="form-row">
              <FormField label="Name" required error={errors.name?.message}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Agent name"
                  {...register('name')}
                />
              </FormField>
              <FormField label="Status">
                <select className="form-select" {...register('status')}>
                  <option value="inactive">Inactive</option>
                  <option value="active">Active</option>
                </select>
              </FormField>
            </div>

            <FormField label="Description">
              <textarea
                className="form-input form-textarea"
                rows={2}
                placeholder="Describe what this agent does..."
                {...register('description')}
              />
            </FormField>
          </div>

          <div className="config-section">
            <h3>Configuration</h3>
            <div className="form-row">
              <FormField label="Clearance Level">
                <select className="form-select" {...register('clearance')}>
                  {CLEARANCE_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>{lvl}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Max Autonomy">
                <select className="form-select" {...register('maxAutonomy')}>
                  {AUTONOMY_LEVELS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl.replace(/([A-Z])/g, ' $1').trim()}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormField label="System Prompt">
              <textarea
                className="form-input form-textarea"
                rows={5}
                placeholder="Enter system prompt for this agent's LLM context..."
                {...register('systemPrompt')}
              />
            </FormField>
          </div>

          <div className="config-section">
            <h3>Capabilities</h3>
            <div className="capabilities-grid">
              <Controller
                name="capabilities"
                control={control}
                render={({ field }) => (
                  <>
                    {AVAILABLE_CAPABILITIES.map((cap) => (
                      <label key={cap} className="capability-checkbox">
                        <input
                          type="checkbox"
                          checked={field.value.includes(cap)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              field.onChange([...field.value, cap]);
                            } else {
                              field.onChange(field.value.filter((c) => c !== cap));
                            }
                          }}
                          className="checkbox-input"
                        />
                        <span className="checkbox-box" />
                        <span className="capability-name">{cap}</span>
                      </label>
                    ))}
                  </>
                )}
              />
            </div>
          </div>

          <div className="config-section">
            <h3>Tools</h3>
            <p className="config-section-desc">
              Select tools to bind to this agent. Tools are called during execution.
            </p>
            <ToolAssignment
              availableTools={availableTools}
              assignedTools={watchedTools}
              onChange={(tools) => setValue('tools', tools)}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn--secondary"
              onClick={closeForm}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting
                ? view === 'create' ? 'Creating...' : 'Saving...'
                : view === 'create' ? 'Create Agent' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ============================================================================
  // Render combined agents view — stats + table
  // ============================================================================

  return (
    <div className="config-panel config-panel--flush">
      {/* Actions row */}
      <div className="config-panel-header" style={{ padding: '0 0 12px 0', display: 'flex', alignItems: 'center' }}>
        <div className="header-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button
            className="btn btn--sm btn--secondary"
            onClick={() => loadAgents()}
            title="Refresh agent list"
          >
            Refresh
          </button>
          <button className="btn btn--primary" onClick={openCreate}>
            + Create Agent
          </button>
        </div>
      </div>

      {/* Summary stats row */}
      <div className="agent-overview-stats">
        <div className="agent-stat-card">
          <div className="agent-stat-value">{agents.length}</div>
          <div className="agent-stat-label">Total Agents</div>
        </div>
        <div className="agent-stat-card agent-stat-card--active">
          <div className="agent-stat-value">{activeAgents.length}</div>
          <div className="agent-stat-label">Active</div>
        </div>
        <div className="agent-stat-card agent-stat-card--inactive">
          <div className="agent-stat-value">{inactiveAgents.length}</div>
          <div className="agent-stat-label">Inactive</div>
        </div>
        <div className="agent-stat-card">
          <div className="agent-stat-value">
            {agents.length > 0
              ? `${Math.round((agents.filter((a) => a.successRate !== null && a.successRate > 0.9).length / agents.length) * 100)}%`
              : '—'}
          </div>
          <div className="agent-stat-label">Healthy</div>
        </div>
      </div>

      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">!</span>
          {error}
          <button className="alert-dismiss" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {successMessage && (
        <div className="alert alert--success">
          <span className="alert-icon">&#10003;</span>
          {successMessage}
        </div>
      )}

      {/* Filter bar */}
      <div className="agent-filter-bar">
        <div className="agent-filter-group">
          <label className="agent-filter-label">Status</label>
          <select className="form-select form-select--sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="degraded">Degraded</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="agent-filter-group">
          <label className="agent-filter-label">Clearance</label>
          <select className="form-select form-select--sm" value={filterClearance} onChange={(e) => setFilterClearance(e.target.value)}>
            <option value="all">All</option>
            {CLEARANCE_LEVELS.map((lvl) => (
              <option key={lvl} value={lvl}>{lvl}</option>
            ))}
          </select>
        </div>
        <span className="agent-filter-count">{filteredAgents.length} of {agents.length} agents</span>
      </div>

      {/* Agent Table — full width, dense */}
      {filteredAgents.length === 0 ? (
        <div className="table-empty-state">
          <p>{agents.length === 0 ? 'No agents configured. Click "Create Agent" to add one.' : 'No agents match the current filters.'}</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="admin-table admin-table--dense">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th className="sortable-th" onClick={() => toggleSort('name')}>Name{sortIcon('name')}</th>
                <th className="sortable-th" onClick={() => toggleSort('status')}>Status{sortIcon('status')}</th>
                <th>Health</th>
                <th className="sortable-th" onClick={() => toggleSort('successRate')}>Success Rate{sortIcon('successRate')}</th>
                <th>Clearance</th>
                <th>Tools</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAgents.map((agent) => {
                const health = getHealthDot(agent);
                return (
                  <tr key={agent.agentId}>
                    <td style={{ padding: '4px 6px' }}>
                      <img
                        src={getAgentAvatarUrl(agent)}
                        alt={agent.name}
                        style={{ width: 28, height: 28, borderRadius: 6 }}
                      />
                    </td>
                    <td>
                      <button
                        className="link-button"
                        onClick={() => openDetail(agent)}
                      >
                        {agent.name}
                      </button>
                      <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{agent.agentId}</div>
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${agent.status}`}>
                        {agent.status}
                      </span>
                    </td>
                    <td>
                      <span
                        title={health.label}
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          backgroundColor: health.color,
                        }}
                      />
                    </td>
                    <td>
                      {agent.successRate !== null
                        ? `${Math.round(agent.successRate * 100)}%`
                        : '—'}
                    </td>
                    <td>{agent.clearance}</td>
                    <td>{(agent.tools || []).length}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={() => openEdit(agent)}
                        >
                          Edit
                        </button>
                        {agent.status === 'active' ? (
                          <button
                            className="btn btn--sm btn--warning"
                            onClick={() => setConfirmAction({ type: 'deactivate', agent })}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            className="btn btn--sm btn--success"
                            onClick={() => setConfirmAction({ type: 'activate', agent })}
                          >
                            Activate
                          </button>
                        )}
                        <button
                          className="btn btn--sm btn--danger"
                          onClick={() => setConfirmAction({ type: 'delete', agent })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm action modal */}
      {confirmAction && (
        <ConfirmModal
          action={confirmAction.type}
          agentName={confirmAction.agent.name}
          isConfirming={isConfirming}
          onConfirm={handleConfirmAction}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

// ============================================================================
// ConfirmModal
// ============================================================================

interface ConfirmModalProps {
  action: 'activate' | 'deactivate' | 'delete';
  agentName: string;
  isConfirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmModal({ action, agentName, isConfirming, onConfirm, onCancel }: ConfirmModalProps) {
  const actionLabel = action === 'activate' ? 'Activate' : action === 'deactivate' ? 'Deactivate' : 'Delete';
  const isDanger = action === 'delete';

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-header${isDanger ? ' modal-header--danger' : ''}`}>
          <h3>{actionLabel} Agent</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>
        <div className="modal-body">
          <p>
            Are you sure you want to {action} <strong>{agentName}</strong>?
          </p>
          {action === 'activate' && (
            <p className="text-muted">
              Activation requires passing the health gate (minimum test fixtures).
            </p>
          )}
          {action === 'delete' && (
            <p className="text-muted">
              This will permanently delete the agent and all its memory entries.
            </p>
          )}
          <div className="modal-footer">
            <button className="btn btn--secondary" onClick={onCancel} disabled={isConfirming}>
              Cancel
            </button>
            <button
              className={`btn btn--${isDanger ? 'danger' : action === 'activate' ? 'success' : 'warning'}`}
              onClick={onConfirm}
              disabled={isConfirming}
            >
              {isConfirming ? `${actionLabel}ing...` : actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
