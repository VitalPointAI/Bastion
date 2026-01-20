/**
 * AgentConfigPanel Component
 *
 * Configuration panel for AI agent settings including:
 * - Expandable cards for each agent with per-agent model configuration
 * - Enable/disable toggles for each agent type
 * - Confidence threshold slider
 * - Human review requirements
 * - DID badges for agent identity
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService, getAgentDisplayName, getProviderDisplayName } from '../../lib/admin-service';
import type { AgentConfig, EnabledAgents, AgentWithConfig, LLMProviderType } from '../../types/admin';
import { FormField } from './common/FormField';

// Agent descriptions for display
const AGENT_DESCRIPTIONS: Record<keyof EnabledAgents, string> = {
  osintCollector: 'Collects and processes open-source intelligence from configured feeds',
  documentProcessor: 'Extracts and analyzes content from uploaded documents',
  threatMonitor: 'Monitors threat indicators and assesses potential risks',
  fusionAgent: 'Synthesizes information from multiple sources into unified assessments',
  extractionAgent: 'Extracts strategic objectives and key information from documents',
  assessmentAgent: 'Performs risk assessments and impact analysis',
  redTeamAgent: 'Challenges assumptions and identifies potential weaknesses',
  devilsAdvocate: 'Provides contrarian analysis to stress-test conclusions',
  coaGenerator: 'Generates courses of action based on mission parameters',
};

const PROVIDERS: LLMProviderType[] = ['anthropic', 'openai', 'azure-openai', 'near-ai', 'local'];

// Zod schema for global agent configuration
const AgentConfigSchema = z.object({
  enabledAgents: z.object({
    osintCollector: z.boolean(),
    documentProcessor: z.boolean(),
    threatMonitor: z.boolean(),
    fusionAgent: z.boolean(),
    extractionAgent: z.boolean(),
    assessmentAgent: z.boolean(),
    redTeamAgent: z.boolean(),
    devilsAdvocate: z.boolean(),
    coaGenerator: z.boolean(),
  }),
  defaultConfidenceThreshold: z.number().min(0.5).max(1),
  requireHumanReview: z.boolean(),
});

type AgentConfigFormData = z.infer<typeof AgentConfigSchema>;

interface AgentModelFormState {
  useGlobalDefault: boolean;
  provider: LLMProviderType;
  model: string;
  temperature: number;
  maxTokens: number;
}

interface ModelOption {
  id: string;
  name: string;
}

export function AgentConfigPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Extended agent data with DID and custom configs
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
  const [agentModelForms, setAgentModelForms] = useState<Map<string, AgentModelFormState>>(new Map());
  const [savingAgents, setSavingAgents] = useState<Set<string>>(new Set());
  const [availableModels, setAvailableModels] = useState<Map<string, ModelOption[]>>(new Map());
  const [loadingModels, setLoadingModels] = useState<Set<string>>(new Set());

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    formState: { errors, isDirty },
  } = useForm<AgentConfigFormData>({
    resolver: zodResolver(AgentConfigSchema),
    defaultValues: {
      enabledAgents: {
        osintCollector: true,
        documentProcessor: true,
        threatMonitor: true,
        fusionAgent: true,
        extractionAgent: true,
        assessmentAgent: true,
        redTeamAgent: true,
        devilsAdvocate: true,
        coaGenerator: true,
      },
      defaultConfidenceThreshold: 0.7,
      requireHumanReview: true,
    },
  });

  const confidenceThreshold = watch('defaultConfidenceThreshold');

  // Fetch models for a provider
  const fetchModelsForProvider = useCallback(async (provider: LLMProviderType) => {
    const cacheKey = provider;
    if (availableModels.has(cacheKey)) {
      return availableModels.get(cacheKey) || [];
    }

    setLoadingModels(prev => new Set([...prev, cacheKey]));
    try {
      const models = await adminService.fetchProviderModels(provider);
      setAvailableModels(prev => new Map(prev).set(cacheKey, models));
      return models;
    } catch (err) {
      console.warn(`Failed to fetch models for ${provider}:`, err);
      return [];
    } finally {
      setLoadingModels(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [availableModels]);

  // Load configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load global agent config
        const config = await adminService.getAgentConfig();
        reset({
          enabledAgents: config.enabledAgents,
          defaultConfidenceThreshold: config.defaultConfidenceThreshold,
          requireHumanReview: config.requireHumanReviewFor?.length > 0,
        });

        // Load agents with extended info
        try {
          const agentList = await adminService.listAgents();
          setAgents(agentList);

          // Initialize model form states for each agent
          const formStates = new Map<string, AgentModelFormState>();
          for (const agent of agentList) {
            const hasCustomConfig = agent.customModelConfig != null;
            formStates.set(agent.agentId, {
              useGlobalDefault: !hasCustomConfig,
              provider: (agent.customModelConfig?.provider as LLMProviderType) || 'anthropic',
              model: agent.customModelConfig?.model || '',
              temperature: agent.customModelConfig?.temperature ?? 0.7,
              maxTokens: agent.customModelConfig?.maxTokens ?? 4096,
            });
          }
          setAgentModelForms(formStates);
        } catch (agentErr) {
          console.warn('Failed to load agents:', agentErr);
          // Continue without agent list - the panel will still show global config
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [reset]);

  // Toggle agent card expansion
  const toggleExpand = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
        // Fetch models when expanding if needed
        const form = agentModelForms.get(agentId);
        if (form && !form.useGlobalDefault) {
          fetchModelsForProvider(form.provider);
        }
      }
      return next;
    });
  };

  // Update agent model form state
  const updateAgentModelForm = (agentId: string, updates: Partial<AgentModelFormState>) => {
    setAgentModelForms(prev => {
      const current = prev.get(agentId);
      if (!current) return prev;
      const next = new Map(prev);
      next.set(agentId, { ...current, ...updates });
      return next;
    });

    // Fetch models when provider changes
    if (updates.provider) {
      fetchModelsForProvider(updates.provider);
    }
  };

  // Save per-agent model config
  const saveAgentModelConfig = async (agentId: string) => {
    const form = agentModelForms.get(agentId);
    if (!form) return;

    setSavingAgents(prev => new Set([...prev, agentId]));
    try {
      if (form.useGlobalDefault) {
        // Clear custom config
        await adminService.clearAgentModelConfig(agentId);
      } else {
        // Save custom config
        await adminService.setAgentModelConfig(agentId, {
          agentId,
          provider: form.provider,
          model: form.model,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          useGlobalDefault: false,
        });
      }

      // Update local agent state
      setAgents(prev => prev.map(a => {
        if (a.agentId !== agentId) return a;
        return {
          ...a,
          customModelConfig: form.useGlobalDefault ? null : {
            agentId,
            provider: form.provider,
            model: form.model,
            temperature: form.temperature,
            maxTokens: form.maxTokens,
            useGlobalDefault: false,
          },
        };
      }));

      setSuccessMessage(`Saved configuration for ${agentId}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save config for ${agentId}`);
    } finally {
      setSavingAgents(prev => {
        const next = new Set(prev);
        next.delete(agentId);
        return next;
      });
    }
  };

  // Save global agent config
  const onSubmit = async (data: AgentConfigFormData) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      const updateData: Partial<AgentConfig> = {
        enabledAgents: data.enabledAgents,
        defaultConfidenceThreshold: data.defaultConfidenceThreshold,
        requireHumanReviewFor: data.requireHumanReview ? ['all'] : [],
      };

      await adminService.updateAgentConfig(updateData, 'Updated via Admin UI');

      setSuccessMessage('Global agent configuration saved successfully');
      reset(data);

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading agent configuration...</p>
      </div>
    );
  }

  const agentKeys = Object.keys(AGENT_DESCRIPTIONS) as Array<keyof EnabledAgents>;

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>Agent Configuration</h2>
        <p>Configure AI agents, per-agent model settings, and behavior controls.</p>
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

      <form onSubmit={handleSubmit(onSubmit)} className="config-form">
        {/* Global Behavior Settings */}
        <div className="config-section">
          <h3>Global Behavior Settings</h3>

          <div className="form-row">
            <FormField
              label="Default Confidence Threshold"
              error={errors.defaultConfidenceThreshold?.message}
              hint={`Current: ${Math.round((confidenceThreshold || 0.7) * 100)}%`}
            >
              <div className="slider-container">
                <Controller
                  name="defaultConfidenceThreshold"
                  control={control}
                  render={({ field }) => (
                    <input
                      type="range"
                      min={0.5}
                      max={1}
                      step={0.05}
                      className="form-slider"
                      value={field.value}
                      onChange={(e) => field.onChange(parseFloat(e.target.value))}
                    />
                  )}
                />
                <div className="slider-labels">
                  <span>50%</span>
                  <span>75%</span>
                  <span>100%</span>
                </div>
              </div>
            </FormField>
          </div>

          <div className="form-row">
            <div className="checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  {...register('requireHumanReview')}
                  className="checkbox-input"
                />
                <span className="checkbox-box" />
                <div className="checkbox-content">
                  <span className="checkbox-name">Require Human Review</span>
                  <span className="checkbox-desc">
                    All agent outputs must be reviewed by a human before being acted upon.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Per-Agent Configuration Cards */}
        <div className="config-section">
          <h3>Agent Status &amp; Model Configuration</h3>
          <p className="config-section-desc">
            Click on an agent to expand and configure its specific model settings.
          </p>

          <div className="agent-cards-list">
            {agents.length > 0 ? (
              agents.map((agent) => {
                const isExpanded = expandedAgents.has(agent.agentId);
                const form = agentModelForms.get(agent.agentId);
                const hasCustomConfig = agent.customModelConfig != null;
                const isSavingThis = savingAgents.has(agent.agentId);
                const models = availableModels.get(form?.provider || 'anthropic') || [];
                const isLoadingTheseModels = loadingModels.has(form?.provider || 'anthropic');
                const agentKey = agent.agentId as keyof EnabledAgents;
                const hasToggle = agentKey in AGENT_DESCRIPTIONS;

                return (
                  <div key={agent.agentId} className={`agent-card ${isExpanded ? 'agent-card--expanded' : ''}`}>
                    <div
                      className="agent-card-header"
                      onClick={() => toggleExpand(agent.agentId)}
                    >
                      <div className="agent-card-info">
                        {hasToggle && (
                          <label
                            className="toggle-label toggle-label--inline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              {...register(`enabledAgents.${agentKey}`)}
                              className="toggle-input"
                            />
                            <span className="toggle-switch toggle-switch--sm" />
                          </label>
                        )}
                        <span className="agent-card-name">{agent.name || getAgentDisplayName(agent.agentId)}</span>
                        <div className="agent-card-badges">
                          {hasCustomConfig && (
                            <span className="badge--custom-config">Custom Config</span>
                          )}
                          {agent.agentDID && (
                            <span className="badge--did" title={agent.agentDID}>
                              DID
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`agent-card-expand ${isExpanded ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </div>

                    <div className={`agent-card-body ${isExpanded ? '' : 'collapsed'}`}>
                      {form && (
                        <div className="model-config-form">
                          {/* Agent description */}
                          {hasToggle && (
                            <p className="agent-description">
                              {AGENT_DESCRIPTIONS[agentKey]}
                            </p>
                          )}

                          {/* DID Display */}
                          {agent.agentDID && (
                            <div className="agent-did-display">
                              <span className="agent-did-label">Agent DID:</span>
                              <code className="agent-did-value">{agent.agentDID}</code>
                            </div>
                          )}

                          {/* Use Global Default Toggle */}
                          <div className="checkbox-field checkbox-field--compact">
                            <label className="checkbox-label">
                              <input
                                type="checkbox"
                                checked={form.useGlobalDefault}
                                onChange={(e) => updateAgentModelForm(agent.agentId, {
                                  useGlobalDefault: e.target.checked
                                })}
                                className="checkbox-input"
                              />
                              <span className="checkbox-box" />
                              <div className="checkbox-content">
                                <span className="checkbox-name">Use Global Default</span>
                                <span className="checkbox-desc">
                                  Use the system-wide LLM configuration for this agent.
                                </span>
                              </div>
                            </label>
                          </div>

                          {/* Custom Model Config (disabled when using global) */}
                          <div className={`model-config-fields ${form.useGlobalDefault ? 'disabled' : ''}`}>
                            <div className="model-config-row">
                              <FormField label="Provider">
                                <select
                                  className="form-select"
                                  value={form.provider}
                                  onChange={(e) => updateAgentModelForm(agent.agentId, {
                                    provider: e.target.value as LLMProviderType,
                                    model: '' // Reset model when provider changes
                                  })}
                                  disabled={form.useGlobalDefault}
                                >
                                  {PROVIDERS.map(p => (
                                    <option key={p} value={p}>{getProviderDisplayName(p)}</option>
                                  ))}
                                </select>
                              </FormField>

                              <FormField label="Model">
                                <select
                                  className="form-select"
                                  value={form.model}
                                  onChange={(e) => updateAgentModelForm(agent.agentId, {
                                    model: e.target.value
                                  })}
                                  disabled={form.useGlobalDefault || isLoadingTheseModels}
                                >
                                  <option value="">
                                    {isLoadingTheseModels ? 'Loading models...' : 'Select a model...'}
                                  </option>
                                  {models.map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                  {form.model && !models.find(m => m.id === form.model) && (
                                    <option value={form.model}>{form.model} (current)</option>
                                  )}
                                </select>
                              </FormField>
                            </div>

                            <div className="model-config-row">
                              <FormField
                                label="Temperature"
                                hint={`Current: ${form.temperature.toFixed(1)}`}
                              >
                                <input
                                  type="range"
                                  min={0}
                                  max={2}
                                  step={0.1}
                                  value={form.temperature}
                                  onChange={(e) => updateAgentModelForm(agent.agentId, {
                                    temperature: parseFloat(e.target.value)
                                  })}
                                  disabled={form.useGlobalDefault}
                                  className="form-slider"
                                />
                              </FormField>

                              <FormField label="Max Tokens">
                                <input
                                  type="number"
                                  className="form-input"
                                  value={form.maxTokens}
                                  onChange={(e) => updateAgentModelForm(agent.agentId, {
                                    maxTokens: parseInt(e.target.value) || 4096
                                  })}
                                  disabled={form.useGlobalDefault}
                                  min={256}
                                  max={128000}
                                />
                              </FormField>
                            </div>
                          </div>

                          {/* Save Button for this agent */}
                          <div className="agent-card-actions">
                            <button
                              type="button"
                              className="btn btn--sm btn--primary"
                              onClick={() => saveAgentModelConfig(agent.agentId)}
                              disabled={isSavingThis}
                            >
                              {isSavingThis ? 'Saving...' : 'Save Agent Config'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              // Fallback to basic grid if no agents loaded
              <div className="agent-grid">
                {agentKeys.map((agent) => (
                  <div key={agent} className="agent-toggle-card">
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        {...register(`enabledAgents.${agent}`)}
                        className="toggle-input"
                      />
                      <span className="toggle-switch" />
                      <div className="toggle-content">
                        <span className="toggle-name">{getAgentDisplayName(agent)}</span>
                        <span className="toggle-desc">{AGENT_DESCRIPTIONS[agent]}</span>
                      </div>
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Global Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
