/**
 * AgentManagementPanel Component
 *
 * Administrative panel for creating and managing AI agents:
 * - Create agents via form with all required fields
 * - Upload agents via JSON file with drag-drop support
 * - List and manage custom agents (edit/delete)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { adminService, getProviderDisplayName } from '../../lib/admin-service';
import type { AgentWithConfig, AgentDefinition, LLMProviderType } from '../../types/admin';
import { FormField } from './common/FormField';
import { AgentBuilderWizard } from './AgentBuilderWizard';
import { useUser } from '../../context/UserContext';
import { AgentHealthDot } from '../common/AgentHealthDot';
import { useAgentValidationStatus } from '../../hooks/useAgentValidationStatus';

const PROVIDERS: LLMProviderType[] = ['anthropic', 'openai', 'azure-openai', 'near-ai', 'local'];
const AGENT_TYPES = ['governance', 'strategic', 'custom'] as const;
const AGENT_PHASES = ['Support', 'Represent', 'Organize'] as const;
const AUTONOMY_LEVELS = ['NotAutonomous', 'SemiAutonomous', 'Autonomous'] as const;

// Common capabilities available for selection
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
];

// Zod schema for agent creation form
const AgentCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().min(1, 'Description is required').max(500),
  type: z.enum(AGENT_TYPES),
  phase: z.enum(AGENT_PHASES).optional(),
  capabilities: z.array(z.string()).min(1, 'At least one capability is required'),
  maxAutonomy: z.enum(AUTONOMY_LEVELS).optional(),
  isEnabled: z.boolean().optional(),
  // Model config (optional)
  useCustomModel: z.boolean(),
  modelConfig: z.object({
    provider: z.enum(['anthropic', 'openai', 'azure-openai', 'near-ai', 'local']).optional(),
    model: z.string().optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(256).max(128000).optional(),
  }).optional(),
});

type AgentCreateFormData = z.infer<typeof AgentCreateSchema>;

interface ModelOption {
  id: string;
  name: string;
}

interface JsonValidationResult {
  valid: boolean;
  data?: AgentDefinition;
  errors: string[];
}

export function AgentManagementPanel() {
  const validationStatus = useAgentValidationStatus();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Agent Builder Wizard state
  const [showWizard, setShowWizard] = useState(false);
  const { userDID } = useUser();

  // Agent list
  const [customAgents, setCustomAgents] = useState<AgentWithConfig[]>([]);

  // Form submission state
  const [isCreating, setIsCreating] = useState(false);
  const [createdAgentDID, setCreatedAgentDID] = useState<string | null>(null);

  // JSON upload state
  const [dragOver, setDragOver] = useState(false);
  const [jsonValidation, setJsonValidation] = useState<JsonValidationResult | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AgentWithConfig | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Model fetching
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<AgentCreateFormData>({
    resolver: zodResolver(AgentCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      type: 'custom',
      phase: 'Support',
      capabilities: [],
      maxAutonomy: 'NotAutonomous',
      isEnabled: true,
      useCustomModel: false,
      modelConfig: {
        provider: 'anthropic',
        model: '',
        temperature: 0.7,
        maxTokens: 4096,
      },
    },
  });

  const useCustomModel = watch('useCustomModel');
  const selectedProvider = watch('modelConfig.provider');

  // Fetch models when provider changes
  const fetchModels = useCallback(async (provider: string) => {
    if (!provider) return;
    setIsLoadingModels(true);
    try {
      const models = await adminService.fetchProviderModels(provider);
      setAvailableModels(models);
    } catch (err) {
      console.warn('Failed to fetch models:', err);
    } finally {
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (useCustomModel && selectedProvider) {
      fetchModels(selectedProvider);
    }
  }, [useCustomModel, selectedProvider, fetchModels]);

  // Load agents on mount
  useEffect(() => {
    const loadAgents = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const agentList = await adminService.listAgents();
        // Filter to custom agents (not built-in system agents)
        setCustomAgents(agentList.filter(a =>
          !a.agentId.match(/^(osintCollector|documentProcessor|threatMonitor|fusionAgent|extractionAgent|assessmentAgent|redTeamAgent|devilsAdvocate|coaGenerator|governance-copilot|proposal-screener|context-analyzer|feasibility-assessor)$/)
        ));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load agents');
      } finally {
        setIsLoading(false);
      }
    };

    loadAgents();
  }, []);

  // Handle form submission
  const onSubmit = async (data: AgentCreateFormData) => {
    setIsCreating(true);
    setError(null);
    setCreatedAgentDID(null);

    try {
      const definition: AgentDefinition = {
        name: data.name,
        description: data.description,
        type: data.type,
        phase: data.phase,
        capabilities: data.capabilities,
        maxAutonomy: data.maxAutonomy,
        isEnabled: data.isEnabled,
      };

      if (data.useCustomModel && data.modelConfig) {
        definition.modelConfig = {
          provider: data.modelConfig.provider!,
          model: data.modelConfig.model || '',
          temperature: data.modelConfig.temperature,
          maxTokens: data.modelConfig.maxTokens,
        };
      }

      const result = await adminService.createAgent(definition);

      setCreatedAgentDID(result.agentDID);
      setSuccessMessage(`Agent "${data.name}" created successfully!`);

      // Refresh agent list
      const agentList = await adminService.listAgents();
      setCustomAgents(agentList.filter(a =>
        !a.agentId.match(/^(osintCollector|documentProcessor|threatMonitor|fusionAgent|extractionAgent|assessmentAgent|redTeamAgent|devilsAdvocate|coaGenerator|governance-copilot|proposal-screener|context-analyzer|feasibility-assessor)$/)
      ));

      // Reset form
      reset();

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setIsCreating(false);
    }
  };

  // Validate JSON file
  const validateJson = (content: string): JsonValidationResult => {
    const errors: string[] = [];

    try {
      const data = JSON.parse(content);

      // Required fields
      if (!data.name || typeof data.name !== 'string') {
        errors.push('Missing or invalid "name" field (string required)');
      }
      if (!data.description || typeof data.description !== 'string') {
        errors.push('Missing or invalid "description" field (string required)');
      }
      if (!data.type || !AGENT_TYPES.includes(data.type)) {
        errors.push(`Invalid "type" field (must be one of: ${AGENT_TYPES.join(', ')})`);
      }
      if (!data.capabilities || !Array.isArray(data.capabilities) || data.capabilities.length === 0) {
        errors.push('Missing or invalid "capabilities" field (non-empty array required)');
      }

      // Optional field validation
      if (data.phase && !AGENT_PHASES.includes(data.phase)) {
        errors.push(`Invalid "phase" field (must be one of: ${AGENT_PHASES.join(', ')})`);
      }
      if (data.maxAutonomy && !AUTONOMY_LEVELS.includes(data.maxAutonomy)) {
        errors.push(`Invalid "maxAutonomy" field (must be one of: ${AUTONOMY_LEVELS.join(', ')})`);
      }

      // Model config validation
      if (data.modelConfig) {
        if (data.modelConfig.provider && !PROVIDERS.includes(data.modelConfig.provider)) {
          errors.push(`Invalid modelConfig.provider (must be one of: ${PROVIDERS.join(', ')})`);
        }
        if (data.modelConfig.temperature !== undefined &&
            (typeof data.modelConfig.temperature !== 'number' ||
             data.modelConfig.temperature < 0 ||
             data.modelConfig.temperature > 2)) {
          errors.push('Invalid modelConfig.temperature (must be number 0-2)');
        }
        if (data.modelConfig.maxTokens !== undefined &&
            (typeof data.modelConfig.maxTokens !== 'number' ||
             data.modelConfig.maxTokens < 256 ||
             data.modelConfig.maxTokens > 128000)) {
          errors.push('Invalid modelConfig.maxTokens (must be number 256-128000)');
        }
      }

      if (errors.length === 0) {
        return { valid: true, data: data as AgentDefinition, errors: [] };
      }

      return { valid: false, errors };
    } catch (_parseErr) {
      return { valid: false, errors: ['Invalid JSON format'] };
    }
  };

  // Handle file drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      handleFile(file);
    } else {
      setJsonValidation({ valid: false, errors: ['Please drop a .json file'] });
    }
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  // Process uploaded file
  const handleFile = async (file: File) => {
    try {
      const content = await file.text();
      const result = validateJson(content);
      setJsonValidation(result);
    } catch (_err) {
      setJsonValidation({ valid: false, errors: ['Failed to read file'] });
    }
  };

  // Upload validated JSON
  const uploadJson = async () => {
    if (!jsonValidation?.valid || !jsonValidation.data) return;

    setIsUploading(true);
    setError(null);

    try {
      const result = await adminService.createAgent(jsonValidation.data);

      setCreatedAgentDID(result.agentDID);
      setSuccessMessage(`Agent "${jsonValidation.data.name}" created from JSON!`);
      setJsonValidation(null);

      // Refresh agent list
      const agentList = await adminService.listAgents();
      setCustomAgents(agentList.filter(a =>
        !a.agentId.match(/^(osintCollector|documentProcessor|threatMonitor|fusionAgent|extractionAgent|assessmentAgent|redTeamAgent|devilsAdvocate|coaGenerator|governance-copilot|proposal-screener|context-analyzer|feasibility-assessor)$/)
      ));

      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload agent');
    } finally {
      setIsUploading(false);
    }
  };

  // Refresh agent list helper
  const refreshAgentList = useCallback(async () => {
    const agentList = await adminService.listAgents();
    setCustomAgents(agentList.filter(a =>
      !a.agentId.match(/^(osintCollector|documentProcessor|threatMonitor|fusionAgent|extractionAgent|assessmentAgent|redTeamAgent|devilsAdvocate|coaGenerator|governance-copilot|proposal-screener|context-analyzer|feasibility-assessor|strategy-document-reviewer)$/)
    ));
  }, []);

  // Delete agent
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await adminService.deleteAgent(deleteTarget.agentId);

      // Refresh agent list
      await refreshAgentList();

      setSuccessMessage(`Agent "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete agent');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle wizard agent creation success
  const handleWizardAgentCreated = async (agentId: string) => {
    setShowWizard(false);
    setSuccessMessage(`Agent created successfully! ID: ${agentId}`);
    await refreshAgentList();
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  if (isLoading) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading agent management...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <div className="config-panel-header-row">
          <div>
            <h2>Agent Management</h2>
            <p>Create new AI agents or upload agent definitions via JSON.</p>
          </div>
          <button
            className="btn btn--wizard"
            onClick={() => setShowWizard(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
            Agent Builder
          </button>
        </div>
      </div>

      {/* Agent Builder Wizard Modal */}
      {showWizard && userDID && (
        <AgentBuilderWizard
          userDID={userDID}
          onClose={() => setShowWizard(false)}
          onAgentCreated={handleWizardAgentCreated}
        />
      )}

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
          {createdAgentDID && (
            <div className="created-did">
              <span className="created-did-label">Agent DID:</span>
              <code className="created-did-value">{createdAgentDID}</code>
            </div>
          )}
        </div>
      )}

      <Tabs className="management-tabs">
        <TabList className="management-tab-list">
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Create Agent
          </Tab>
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Upload JSON
          </Tab>
        </TabList>

        {/* Create Agent Form Tab */}
        <TabPanel className="management-tab-panel">
          <form onSubmit={handleSubmit(onSubmit)} className="agent-create-form">
            <div className="config-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <FormField label="Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    {...register('name')}
                    className="form-input"
                    placeholder="My Custom Agent"
                  />
                </FormField>

                <FormField label="Type" required error={errors.type?.message}>
                  <select {...register('type')} className="form-select">
                    {AGENT_TYPES.map(t => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Description" required error={errors.description?.message}>
                  <textarea
                    {...register('description')}
                    className="form-input form-textarea"
                    placeholder="Describe what this agent does..."
                    rows={3}
                  />
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Phase" error={errors.phase?.message}>
                  <select {...register('phase')} className="form-select">
                    {AGENT_PHASES.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Max Autonomy" error={errors.maxAutonomy?.message}>
                  <select {...register('maxAutonomy')} className="form-select">
                    {AUTONOMY_LEVELS.map(l => (
                      <option key={l} value={l}>
                        {l.replace(/([A-Z])/g, ' $1').trim()}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>

            <div className="config-section">
              <h3>Capabilities</h3>
              <p className="config-section-desc">Select the capabilities this agent should have.</p>

              <div className="capabilities-grid">
                <Controller
                  name="capabilities"
                  control={control}
                  render={({ field }) => (
                    <>
                      {AVAILABLE_CAPABILITIES.map(cap => (
                        <label key={cap} className="capability-checkbox">
                          <input
                            type="checkbox"
                            checked={field.value.includes(cap)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                field.onChange([...field.value, cap]);
                              } else {
                                field.onChange(field.value.filter(c => c !== cap));
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
              {errors.capabilities && (
                <span className="form-error">{errors.capabilities.message}</span>
              )}
            </div>

            <div className="config-section">
              <h3>Model Configuration (Optional)</h3>

              <div className="checkbox-field checkbox-field--compact">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    {...register('useCustomModel')}
                    className="checkbox-input"
                  />
                  <span className="checkbox-box" />
                  <div className="checkbox-content">
                    <span className="checkbox-name">Use Custom Model</span>
                    <span className="checkbox-desc">
                      Assign a specific LLM provider and model to this agent.
                    </span>
                  </div>
                </label>
              </div>

              {useCustomModel && (
                <div className="model-config-fields">
                  <div className="model-config-row">
                    <FormField label="Provider">
                      <select {...register('modelConfig.provider')} className="form-select">
                        {PROVIDERS.map(p => (
                          <option key={p} value={p}>{getProviderDisplayName(p)}</option>
                        ))}
                      </select>
                    </FormField>

                    <FormField label="Model">
                      <select {...register('modelConfig.model')} className="form-select">
                        <option value="">
                          {isLoadingModels ? 'Loading models...' : 'Select a model...'}
                        </option>
                        {availableModels.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </FormField>
                  </div>

                  <div className="model-config-row">
                    <FormField label="Temperature" hint="0-2">
                      <Controller
                        name="modelConfig.temperature"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="number"
                            className="form-input"
                            min={0}
                            max={2}
                            step={0.1}
                            value={field.value}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0.7)}
                          />
                        )}
                      />
                    </FormField>

                    <FormField label="Max Tokens">
                      <Controller
                        name="modelConfig.maxTokens"
                        control={control}
                        render={({ field }) => (
                          <input
                            type="number"
                            className="form-input"
                            min={256}
                            max={128000}
                            value={field.value}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 4096)}
                          />
                        )}
                      />
                    </FormField>
                  </div>
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Agent'}
              </button>
            </div>
          </form>
        </TabPanel>

        {/* Upload JSON Tab */}
        <TabPanel className="management-tab-panel">
          <div className="config-section">
            <h3>Upload Agent Definition</h3>
            <p className="config-section-desc">
              Drag and drop a JSON file or click to select. The file should contain a valid agent definition.
            </p>

            <div
              className={`drop-zone ${dragOver ? 'drop-zone--active' : ''} ${jsonValidation ? 'drop-zone--has-file' : ''}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="drop-zone-input"
              />

              {!jsonValidation ? (
                <div className="drop-zone-content">
                  <div className="drop-zone-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="drop-zone-text">
                    Drop JSON file here or <span className="drop-zone-link">browse</span>
                  </p>
                  <p className="drop-zone-hint">Accepts .json files only</p>
                </div>
              ) : (
                <div className="drop-zone-preview">
                  {jsonValidation.valid ? (
                    <>
                      <div className="preview-status preview-status--valid">
                        <span className="preview-icon">✓</span>
                        Valid Agent Definition
                      </div>
                      <div className="preview-details">
                        <div className="preview-field">
                          <span className="preview-label">Name:</span>
                          <span className="preview-value">{jsonValidation.data?.name}</span>
                        </div>
                        <div className="preview-field">
                          <span className="preview-label">Type:</span>
                          <span className="preview-value">{jsonValidation.data?.type}</span>
                        </div>
                        <div className="preview-field">
                          <span className="preview-label">Capabilities:</span>
                          <span className="preview-value">
                            {jsonValidation.data?.capabilities.length} capabilities
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="preview-status preview-status--invalid">
                        <span className="preview-icon">!</span>
                        Validation Errors
                      </div>
                      <ul className="preview-errors">
                        {jsonValidation.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  <button
                    type="button"
                    className="btn btn--sm btn--secondary"
                    onClick={(e) => {
                      e.stopPropagation();
                      setJsonValidation(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            {jsonValidation?.valid && (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={uploadJson}
                  disabled={isUploading}
                >
                  {isUploading ? 'Creating...' : 'Create Agent from JSON'}
                </button>
              </div>
            )}
          </div>

          <div className="config-section">
            <h3>JSON Schema Reference</h3>
            <pre className="json-schema">
{`{
  "name": "My Agent",           // Required: string
  "description": "...",         // Required: string
  "type": "custom",             // Required: governance | strategic | custom
  "capabilities": ["..."],      // Required: array of strings
  "phase": "Support",           // Optional: Support | Represent | Organize
  "maxAutonomy": "NotAutonomous", // Optional: NotAutonomous | SemiAutonomous | Autonomous
  "isEnabled": true,            // Optional: boolean
  "modelConfig": {              // Optional: custom model settings
    "provider": "anthropic",    // anthropic | openai | azure-openai | near-ai | local
    "model": "claude-3-sonnet-20240229",
    "temperature": 0.7,         // 0-2
    "maxTokens": 4096           // 256-128000
  }
}`}
            </pre>
          </div>
        </TabPanel>
      </Tabs>

      {/* Custom Agents List */}
      {customAgents.length > 0 && (
        <div className="config-section">
          <h3>Custom Agents ({customAgents.length})</h3>

          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>DID</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customAgents.map((agent) => (
                  <tr key={agent.agentId}>
                    <td>
                      <span className="source-name">
                        <AgentHealthDot status={validationStatus.get(agent.agentId) ?? 'unknown'} size="sm" />
                        {' '}{agent.name}
                      </span>
                    </td>
                    <td>
                      <span className="source-type">{agent.phase || 'Custom'}</span>
                    </td>
                    <td>
                      {agent.agentDID ? (
                        <code className="agent-did-value" title={agent.agentDID}>
                          {agent.agentDID.substring(0, 20)}...
                        </code>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-badge status-badge--${agent.active ? 'enabled' : 'disabled'}`}>
                        {agent.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn--sm btn--danger"
                          onClick={() => setDeleteTarget(agent)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header--danger">
              <h3>Delete Agent</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-muted">
                This action cannot be undone. The agent's DID will be invalidated.
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
                  {isDeleting ? 'Deleting...' : 'Delete Agent'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
