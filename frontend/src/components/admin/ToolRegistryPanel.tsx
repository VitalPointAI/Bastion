/**
 * ToolRegistryPanel Component
 *
 * Administrative panel for creating and managing MCP tools:
 * - Create tools with JSON Schema input/output definitions
 * - List and filter tools by category
 * - Assign/unassign tools to agents
 * - Delete tools with confirmation
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { adminService } from '../../lib/admin-service';
import type { MCPTool, MCPToolInput, ToolCategory, ToolHandler, AgentWithConfig } from '../../types/admin';
import { FormField } from './common/FormField';

const TOOL_CATEGORIES: ToolCategory[] = ['data', 'action', 'integration', 'analysis'];
const TOOL_HANDLERS: ToolHandler[] = ['builtin', 'webhook', 'function'];

// Zod schema for tool creation form
const ToolCreateSchema = z.object({
  toolId: z.string()
    .min(1, 'Tool ID is required')
    .max(64)
    .regex(/^[a-z0-9_-]+$/i, 'Tool ID must be alphanumeric with underscores/hyphens'),
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  category: z.enum(['data', 'action', 'integration', 'analysis']),
  handler: z.enum(['builtin', 'webhook', 'function']),
  inputSchemaJson: z.string().min(2, 'Input schema is required'),
  outputSchemaJson: z.string().optional(),
  endpoint: z.string().url().optional().or(z.literal('')),
  timeout: z.number().min(1000).max(300000).optional(),
  rateLimit: z.number().min(1).max(1000).optional(),
  permissions: z.string().optional(),
  isEnabled: z.boolean().default(true),
});

type ToolCreateFormData = z.infer<typeof ToolCreateSchema>;

export function ToolRegistryPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Tool list
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<ToolCategory | ''>('');

  // Expanded tool for details
  const [expandedToolId, setExpandedToolId] = useState<string | null>(null);

  // Form submission state
  const [isCreating, setIsCreating] = useState(false);
  const [createdToolDID, setCreatedToolDID] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<MCPTool | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Agent assignment
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);
  const [assigningTool, setAssigningTool] = useState<MCPTool | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<ToolCreateFormData>({
    resolver: zodResolver(ToolCreateSchema),
    defaultValues: {
      toolId: '',
      name: '',
      description: '',
      category: 'data',
      handler: 'builtin',
      inputSchemaJson: JSON.stringify({
        type: 'object',
        properties: {},
        required: [],
      }, null, 2),
      outputSchemaJson: '',
      endpoint: '',
      timeout: 30000,
      rateLimit: 60,
      permissions: '',
      isEnabled: true,
    },
  });

  const selectedHandler = watch('handler');

  // Load tools
  const loadTools = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const toolList = await adminService.listTools(categoryFilter || undefined);
      setTools(toolList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tools');
    } finally {
      setIsLoading(false);
    }
  }, [categoryFilter]);

  // Load agents for assignment
  const loadAgents = useCallback(async () => {
    try {
      const agentList = await adminService.listAgents();
      setAgents(agentList);
    } catch (err) {
      console.warn('Failed to load agents:', err);
    }
  }, []);

  useEffect(() => {
    loadTools();
    loadAgents();
  }, [loadTools, loadAgents]);

  // Handle form submission
  const onSubmit = async (data: ToolCreateFormData) => {
    setIsCreating(true);
    setError(null);
    setCreatedToolDID(null);

    try {
      // Parse JSON schemas
      let inputSchema;
      try {
        inputSchema = JSON.parse(data.inputSchemaJson);
      } catch {
        setError('Invalid input schema JSON');
        setIsCreating(false);
        return;
      }

      let outputSchema;
      if (data.outputSchemaJson && data.outputSchemaJson.trim()) {
        try {
          outputSchema = JSON.parse(data.outputSchemaJson);
        } catch {
          setError('Invalid output schema JSON');
          setIsCreating(false);
          return;
        }
      }

      const input: MCPToolInput = {
        toolId: data.toolId,
        name: data.name,
        description: data.description,
        category: data.category,
        handler: data.handler,
        inputSchema,
        outputSchema,
        config: data.handler === 'webhook' ? {
          endpoint: data.endpoint || undefined,
          timeout: data.timeout,
          rateLimit: data.rateLimit,
        } : undefined,
        permissions: data.permissions
          ? data.permissions.split(',').map(p => p.trim()).filter(Boolean)
          : [],
        isEnabled: data.isEnabled,
      };

      const result = await adminService.createTool(input);

      setCreatedToolDID(result.toolDID);
      setSuccessMessage(`Tool "${data.name}" created successfully!`);

      // Refresh tool list
      await loadTools();

      // Reset form
      reset();

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tool');
    } finally {
      setIsCreating(false);
    }
  };

  // Delete tool
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await adminService.deleteTool(deleteTarget.toolId);

      await loadTools();

      setSuccessMessage(`Tool "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete tool');
    } finally {
      setIsDeleting(false);
    }
  };

  // Assign tool to agent
  const handleAssign = async () => {
    if (!assigningTool || !selectedAgentId) return;

    setIsAssigning(true);
    try {
      await adminService.assignToolToAgent(assigningTool.toolId, selectedAgentId);

      await loadTools();

      setSuccessMessage(`Tool assigned to agent`);
      setAssigningTool(null);
      setSelectedAgentId('');

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign tool');
    } finally {
      setIsAssigning(false);
    }
  };

  // Toggle enable/disable
  const toggleEnabled = async (tool: MCPTool) => {
    try {
      await adminService.updateTool(tool.toolId, { isEnabled: !tool.isEnabled });
      await loadTools();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update tool');
    }
  };

  if (isLoading && tools.length === 0) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading tool registry...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>Tool Registry</h2>
        <p>Create and manage MCP tools for agent capabilities.</p>
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
          {createdToolDID && (
            <div className="created-did">
              <span className="created-did-label">Tool DID:</span>
              <code className="created-did-value">{createdToolDID}</code>
            </div>
          )}
        </div>
      )}

      <Tabs className="management-tabs">
        <TabList className="management-tab-list">
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Registered Tools ({tools.length})
          </Tab>
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Create Tool
          </Tab>
        </TabList>

        {/* Registered Tools Tab */}
        <TabPanel className="management-tab-panel">
          <div className="config-section">
            <div className="config-section-header-row">
              <h3>Tools</h3>
              <select
                className="form-select form-select--compact"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as ToolCategory | '')}
              >
                <option value="">All Categories</option>
                {TOOL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                ))}
              </select>
            </div>

            {tools.length === 0 ? (
              <div className="empty-state">
                No tools registered yet. Create one in the "Create Tool" tab.
              </div>
            ) : (
              <div className="tool-cards-list">
                {tools.map((tool) => (
                  <div
                    key={tool.toolId}
                    className={`tool-card ${expandedToolId === tool.toolId ? 'tool-card--expanded' : ''}`}
                  >
                    <div
                      className="tool-card-header"
                      onClick={() => setExpandedToolId(expandedToolId === tool.toolId ? null : tool.toolId)}
                    >
                      <div className="tool-card-info">
                        <span className="tool-card-name">{tool.name}</span>
                        <div className="tool-card-badges">
                          <span className={`badge badge--category badge--${tool.category}`}>
                            {tool.category}
                          </span>
                          <span className={`badge badge--handler badge--${tool.handler}`}>
                            {tool.handler}
                          </span>
                          {tool.toolDID && (
                            <span className="badge badge--did" title={tool.toolDID}>
                              DID
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="tool-card-meta">
                        <span className="tool-card-agents">
                          {tool.assignedAgentsCount || 0} agents
                        </span>
                        <span className={`tool-card-expand ${expandedToolId === tool.toolId ? 'expanded' : ''}`}>
                          &#9660;
                        </span>
                      </div>
                    </div>

                    <div className={`tool-card-body ${expandedToolId === tool.toolId ? '' : 'collapsed'}`}>
                      <p className="tool-description">{tool.description}</p>

                      <div className="tool-did-display">
                        <span className="tool-did-label">DID:</span>
                        <code className="tool-did-value">{tool.toolDID}</code>
                      </div>

                      <div className="tool-schema-section">
                        <h4>Input Schema</h4>
                        <pre className="tool-schema">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
                      </div>

                      {tool.outputSchema && (
                        <div className="tool-schema-section">
                          <h4>Output Schema</h4>
                          <pre className="tool-schema">{JSON.stringify(tool.outputSchema, null, 2)}</pre>
                        </div>
                      )}

                      {tool.permissions.length > 0 && (
                        <div className="tool-permissions">
                          <h4>Permissions</h4>
                          <div className="permission-badges">
                            {tool.permissions.map(perm => (
                              <span key={perm} className="badge badge--permission">{perm}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="tool-card-actions">
                        <label className="toggle-label toggle-label--inline">
                          <input
                            type="checkbox"
                            checked={tool.isEnabled}
                            onChange={() => toggleEnabled(tool)}
                            className="toggle-input"
                          />
                          <span className="toggle-switch toggle-switch--sm" />
                          <span className="toggle-text">{tool.isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>

                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningTool(tool);
                          }}
                        >
                          Assign
                        </button>

                        <button
                          className="btn btn--sm btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(tool);
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

        {/* Create Tool Tab */}
        <TabPanel className="management-tab-panel">
          <form onSubmit={handleSubmit(onSubmit)} className="tool-create-form">
            <div className="config-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <FormField label="Tool ID" required error={errors.toolId?.message}>
                  <input
                    type="text"
                    {...register('toolId')}
                    className="form-input"
                    placeholder="my_custom_tool"
                  />
                </FormField>

                <FormField label="Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    {...register('name')}
                    className="form-input"
                    placeholder="My Custom Tool"
                  />
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Description" required error={errors.description?.message}>
                  <textarea
                    {...register('description')}
                    className="form-input form-textarea"
                    placeholder="Describe what this tool does..."
                    rows={3}
                  />
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Category" required error={errors.category?.message}>
                  <select {...register('category')} className="form-select">
                    {TOOL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Handler Type" required error={errors.handler?.message}>
                  <select {...register('handler')} className="form-select">
                    {TOOL_HANDLERS.map(h => (
                      <option key={h} value={h}>{h.charAt(0).toUpperCase() + h.slice(1)}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>

            <div className="config-section">
              <h3>Schema Definition</h3>
              <p className="config-section-desc">Define the input and output schemas using JSON Schema format.</p>

              <FormField label="Input Schema (JSON)" required error={errors.inputSchemaJson?.message}>
                <textarea
                  {...register('inputSchemaJson')}
                  className="form-input form-textarea form-textarea--code"
                  rows={10}
                  placeholder='{"type": "object", "properties": {...}, "required": []}'
                />
              </FormField>

              <FormField label="Output Schema (JSON, optional)" error={errors.outputSchemaJson?.message}>
                <textarea
                  {...register('outputSchemaJson')}
                  className="form-input form-textarea form-textarea--code"
                  rows={6}
                  placeholder='{"type": "object", "properties": {...}}'
                />
              </FormField>
            </div>

            {selectedHandler === 'webhook' && (
              <div className="config-section">
                <h3>Webhook Configuration</h3>

                <div className="form-row">
                  <FormField label="Endpoint URL" error={errors.endpoint?.message}>
                    <input
                      type="url"
                      {...register('endpoint')}
                      className="form-input"
                      placeholder="https://api.example.com/webhook"
                    />
                  </FormField>
                </div>

                <div className="form-row">
                  <FormField label="Timeout (ms)" error={errors.timeout?.message}>
                    <input
                      type="number"
                      {...register('timeout', { valueAsNumber: true })}
                      className="form-input"
                      min={1000}
                      max={300000}
                    />
                  </FormField>

                  <FormField label="Rate Limit (req/min)" error={errors.rateLimit?.message}>
                    <input
                      type="number"
                      {...register('rateLimit', { valueAsNumber: true })}
                      className="form-input"
                      min={1}
                      max={1000}
                    />
                  </FormField>
                </div>
              </div>
            )}

            <div className="config-section">
              <h3>Permissions & Status</h3>

              <div className="form-row">
                <FormField label="Required Permissions" hint="Comma-separated list">
                  <input
                    type="text"
                    {...register('permissions')}
                    className="form-input"
                    placeholder="tool:my_tool, read:data"
                  />
                </FormField>
              </div>

              <div className="checkbox-field checkbox-field--compact">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('isEnabled')}
                    className="checkbox-input"
                  />
                  <span className="checkbox-box" />
                  <div className="checkbox-content">
                    <span className="checkbox-name">Enabled</span>
                    <span className="checkbox-desc">
                      Tool will be available for assignment to agents.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Tool'}
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
              <h3>Delete Tool</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-muted">
                This will remove the tool and all agent assignments. The tool's DID will be invalidated.
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
                  {isDeleting ? 'Deleting...' : 'Delete Tool'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Tool Modal */}
      {assigningTool && (
        <div className="modal-overlay" onClick={() => setAssigningTool(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Tool to Agent</h3>
              <button className="modal-close" onClick={() => setAssigningTool(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Assign <strong>{assigningTool.name}</strong> to an agent.
              </p>

              <FormField label="Select Agent">
                <select
                  className="form-select"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Select an agent...</option>
                  {agents.map(agent => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="modal-footer">
                <button
                  className="btn btn--secondary"
                  onClick={() => setAssigningTool(null)}
                  disabled={isAssigning}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleAssign}
                  disabled={isAssigning || !selectedAgentId}
                >
                  {isAssigning ? 'Assigning...' : 'Assign Tool'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
