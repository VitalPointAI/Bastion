/**
 * LLMConfigPanel Component
 *
 * Configuration panel for LLM provider settings including:
 * - Provider selection (Anthropic, OpenAI, Azure, Local)
 * - Model assignments for different tasks
 * - API key management (masked display, optional update)
 * - Rate limiting controls
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService, getProviderDisplayName } from '../../lib/admin-service';
import type { LLMProviderConfig } from '../../types/admin';
import { FormField } from './common/FormField';

// Zod schema for LLM configuration form
const LLMConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'azure-openai', 'near-ai', 'local']),
  models: z.object({
    extraction: z.string().min(1, 'Extraction model is required'),
    analysis: z.string().min(1, 'Analysis model is required'),
    summarization: z.string().min(1, 'Summarization model is required'),
    redTeam: z.string().min(1, 'Red team model is required'),
  }),
  apiKey: z.string().optional(),
  baseUrl: z.string().url().optional().or(z.literal('')),
  maxRequestsPerMinute: z.number().min(1).max(1000),
  maxTokensPerDay: z.number().min(1000).max(10000000),
  maxCostPerDocument: z.number().min(0.01).max(100),
  alertThreshold: z.number().min(0).max(1),
});

type LLMConfigFormData = z.infer<typeof LLMConfigSchema>;

export function LLMConfigPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [currentMaskedKey, setCurrentMaskedKey] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<LLMConfigFormData>({
    resolver: zodResolver(LLMConfigSchema),
  });

  // Load current configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const config = await adminService.getLLMConfig();
        setCurrentMaskedKey(config.apiKey || '');
        reset({
          provider: config.provider,
          models: config.models,
          apiKey: '', // Don't prefill API key
          baseUrl: config.baseUrl || '',
          maxRequestsPerMinute: config.maxRequestsPerMinute,
          maxTokensPerDay: config.maxTokensPerDay,
          maxCostPerDocument: config.maxCostPerDocument,
          alertThreshold: config.alertThreshold,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [reset]);

  const onSubmit = async (data: LLMConfigFormData) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Only include apiKey if it was provided (non-empty)
      const updateData: Partial<LLMProviderConfig> = {
        provider: data.provider,
        models: data.models,
        maxRequestsPerMinute: data.maxRequestsPerMinute,
        maxTokensPerDay: data.maxTokensPerDay,
        maxCostPerDocument: data.maxCostPerDocument,
        alertThreshold: data.alertThreshold,
      };

      if (data.baseUrl) {
        updateData.baseUrl = data.baseUrl;
      }

      if (data.apiKey && data.apiKey.trim() !== '') {
        updateData.apiKey = data.apiKey;
      }

      const updatedConfig = await adminService.updateLLMConfig(
        updateData,
        'Updated via Admin UI'
      );

      setCurrentMaskedKey(updatedConfig.apiKey || '');
      setSuccessMessage('Configuration saved successfully');
      reset({
        ...data,
        apiKey: '', // Clear API key field after save
      });

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
        <p>Loading LLM configuration...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>LLM Provider Configuration</h2>
        <p>Configure AI model providers, API keys, and usage limits.</p>
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
          <h3>Provider Settings</h3>

          <div className="form-row">
            <FormField label="Provider" required error={errors.provider?.message}>
              <select {...register('provider')} className="form-select">
                <option value="anthropic">{getProviderDisplayName('anthropic')}</option>
                <option value="openai">{getProviderDisplayName('openai')}</option>
                <option value="azure-openai">{getProviderDisplayName('azure-openai')}</option>
                <option value="near-ai">{getProviderDisplayName('near-ai')}</option>
                <option value="local">{getProviderDisplayName('local')}</option>
              </select>
            </FormField>

            <FormField label="Base URL" error={errors.baseUrl?.message} hint="Optional. Override default API endpoint.">
              <input
                type="text"
                {...register('baseUrl')}
                className="form-input"
                placeholder="https://api.example.com/v1"
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField label="Current API Key" hint="Masked for security">
              <input
                type="text"
                value={currentMaskedKey || 'Not configured'}
                className="form-input form-input--readonly"
                readOnly
                disabled
              />
            </FormField>

            <FormField label="New API Key" error={errors.apiKey?.message} hint="Leave blank to keep current key">
              <input
                type="password"
                {...register('apiKey')}
                className="form-input"
                placeholder="Enter new API key"
                autoComplete="new-password"
              />
            </FormField>
          </div>
        </div>

        <div className="config-section">
          <h3>Model Assignments</h3>

          <div className="form-row form-row--2x2">
            <FormField label="Extraction Model" required error={errors.models?.extraction?.message}>
              <input
                type="text"
                {...register('models.extraction')}
                className="form-input"
                placeholder="claude-3-5-sonnet-20241022"
              />
            </FormField>

            <FormField label="Analysis Model" required error={errors.models?.analysis?.message}>
              <input
                type="text"
                {...register('models.analysis')}
                className="form-input"
                placeholder="claude-3-5-sonnet-20241022"
              />
            </FormField>

            <FormField label="Summarization Model" required error={errors.models?.summarization?.message}>
              <input
                type="text"
                {...register('models.summarization')}
                className="form-input"
                placeholder="claude-3-5-haiku-20241022"
              />
            </FormField>

            <FormField label="Red Team Model" required error={errors.models?.redTeam?.message}>
              <input
                type="text"
                {...register('models.redTeam')}
                className="form-input"
                placeholder="claude-3-5-sonnet-20241022"
              />
            </FormField>
          </div>
        </div>

        <div className="config-section">
          <h3>Rate Limits &amp; Cost Controls</h3>

          <div className="form-row form-row--2x2">
            <FormField
              label="Max Requests/Min"
              required
              error={errors.maxRequestsPerMinute?.message}
            >
              <input
                type="number"
                {...register('maxRequestsPerMinute', { valueAsNumber: true })}
                className="form-input"
                min={1}
                max={1000}
              />
            </FormField>

            <FormField
              label="Max Tokens/Day"
              required
              error={errors.maxTokensPerDay?.message}
            >
              <input
                type="number"
                {...register('maxTokensPerDay', { valueAsNumber: true })}
                className="form-input"
                min={1000}
                max={10000000}
              />
            </FormField>

            <FormField
              label="Max Cost/Document ($)"
              required
              error={errors.maxCostPerDocument?.message}
            >
              <input
                type="number"
                step="0.01"
                {...register('maxCostPerDocument', { valueAsNumber: true })}
                className="form-input"
                min={0.01}
                max={100}
              />
            </FormField>

            <FormField
              label="Alert Threshold"
              required
              error={errors.alertThreshold?.message}
              hint="0-1 (triggers alert at this % of budget)"
            >
              <input
                type="number"
                step="0.05"
                {...register('alertThreshold', { valueAsNumber: true })}
                className="form-input"
                min={0}
                max={1}
              />
            </FormField>
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
