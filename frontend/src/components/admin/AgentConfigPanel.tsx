/**
 * AgentConfigPanel Component
 *
 * Configuration panel for AI agent settings including:
 * - Enable/disable toggles for each agent type
 * - Confidence threshold slider
 * - Human review requirements
 */

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService, getAgentDisplayName } from '../../lib/admin-service';
import type { AgentConfig, EnabledAgents } from '../../types/admin';
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

// Zod schema for agent configuration
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

export function AgentConfigPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  // Load current configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const config = await adminService.getAgentConfig();
        reset({
          enabledAgents: config.enabledAgents,
          defaultConfidenceThreshold: config.defaultConfidenceThreshold,
          requireHumanReview: config.requireHumanReviewFor?.length > 0,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [reset]);

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

      setSuccessMessage('Agent configuration saved successfully');
      reset(data);

      // Clear success message after 3 seconds
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
        <p>Enable or disable AI agents and configure behavior settings.</p>
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
        <div className="config-section">
          <h3>Agent Status</h3>
          <p className="config-section-desc">
            Enable or disable individual agents. Disabled agents will not process any data.
          </p>

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
        </div>

        <div className="config-section">
          <h3>Behavior Settings</h3>

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
                    Recommended for production environments.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!isDirty || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
