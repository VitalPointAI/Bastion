/**
 * WorkflowConfigPanel Component
 *
 * Configuration panel for workflow settings including:
 * - Escalation timeouts per risk level
 * - Approval authority settings
 * - Notification toggles
 */

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { adminService, getRiskLevelDisplayName } from '../../lib/admin-service';
import type { WorkflowConfig } from '../../types/admin';
import { FormField } from './common/FormField';

// Approval roles available in the system
const APPROVAL_ROLES = [
  { value: 'STAFF_OFFICER', label: 'Staff Officer' },
  { value: 'COMMANDER', label: 'Commander' },
  { value: 'SENIOR_COMMANDER', label: 'Senior Commander' },
  { value: 'GENERAL_OFFICER', label: 'General Officer' },
] as const;

// Zod schema for workflow configuration
const WorkflowConfigSchema = z.object({
  escalationTimeouts: z.object({
    LOW: z.number().min(1).max(168, 'Max 168 hours (1 week)'),
    MEDIUM: z.number().min(1).max(168),
    HIGH: z.number().min(1).max(168),
    EXTREME: z.number().min(0.5).max(48),
  }),
  approvalAuthority: z.object({
    LOW: z.object({
      requiredRole: z.string(),
      canDelegate: z.boolean(),
    }),
    MEDIUM: z.object({
      requiredRole: z.string(),
      canDelegate: z.boolean(),
    }),
    HIGH: z.object({
      requiredRole: z.string(),
      canDelegate: z.boolean(),
    }),
    EXTREME: z.object({
      requiredRole: z.string(),
      canDelegate: z.boolean(),
    }),
  }),
  notifications: z.object({
    emailOnPending: z.boolean(),
    emailOnEscalation: z.boolean(),
    slackWebhook: z.string().url().optional().or(z.literal('')),
  }),
  reason: z.string().min(1, 'Please provide a reason for changes'),
});

type WorkflowConfigFormData = z.infer<typeof WorkflowConfigSchema>;

export function WorkflowConfigPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<WorkflowConfigFormData>({
    resolver: zodResolver(WorkflowConfigSchema),
  });

  // Load current configuration on mount
  useEffect(() => {
    const loadConfig = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const config = await adminService.getWorkflowConfig();

        // Convert array-based approval authority to object form
        const authorityMap: Record<string, { requiredRole: string; canDelegate: boolean }> = {};
        // Handle case where approvalAuthority might be undefined, null, or not an array
        const authorityArray = Array.isArray(config.approvalAuthority) ? config.approvalAuthority : [];
        authorityArray.forEach((auth) => {
          authorityMap[auth.riskLevel] = {
            requiredRole: auth.requiredRole,
            canDelegate: auth.canDelegate,
          };
        });

        reset({
          escalationTimeouts: config.escalationTimeouts || { LOW: 24, MEDIUM: 12, HIGH: 4, EXTREME: 1 },
          approvalAuthority: {
            LOW: authorityMap['LOW'] || { requiredRole: 'STAFF_OFFICER', canDelegate: true },
            MEDIUM: authorityMap['MEDIUM'] || { requiredRole: 'STAFF_OFFICER', canDelegate: true },
            HIGH: authorityMap['HIGH'] || { requiredRole: 'COMMANDER', canDelegate: false },
            EXTREME: authorityMap['EXTREME'] || { requiredRole: 'SENIOR_COMMANDER', canDelegate: false },
          },
          notifications: {
            emailOnPending: config.notifications?.emailOnPending ?? true,
            emailOnEscalation: config.notifications?.emailOnEscalation ?? true,
            slackWebhook: config.notifications?.slackWebhook || '',
          },
          reason: '',
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load configuration');
      } finally {
        setIsLoading(false);
      }
    };

    loadConfig();
  }, [reset]);

  const onSubmit = async (data: WorkflowConfigFormData) => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccessMessage(null);

      // Convert form data to API format
      const updateData: Partial<WorkflowConfig> = {
        escalationTimeouts: data.escalationTimeouts,
        approvalAuthority: [
          { riskLevel: 'LOW', ...data.approvalAuthority.LOW },
          { riskLevel: 'MEDIUM', ...data.approvalAuthority.MEDIUM },
          { riskLevel: 'HIGH', ...data.approvalAuthority.HIGH },
          { riskLevel: 'EXTREME', ...data.approvalAuthority.EXTREME },
        ],
        notifications: {
          emailOnPending: data.notifications.emailOnPending,
          emailOnEscalation: data.notifications.emailOnEscalation,
          slackWebhook: data.notifications.slackWebhook || undefined,
        },
      };

      await adminService.updateWorkflowConfig(updateData, data.reason);

      setSuccessMessage('Workflow configuration saved successfully');
      reset({ ...data, reason: '' });

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
        <p>Loading workflow configuration...</p>
      </div>
    );
  }

  const riskLevels = ['LOW', 'MEDIUM', 'HIGH', 'EXTREME'] as const;

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>Workflow Configuration</h2>
        <p>Configure escalation timeouts, approval authorities, and notifications.</p>
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
          <h3>Escalation Timeouts</h3>
          <p className="config-section-desc">
            Time (in hours) before a pending decision escalates to the next authority level.
          </p>

          <div className="form-row form-row--2x2">
            {riskLevels.map((level) => (
              <FormField
                key={level}
                label={`${getRiskLevelDisplayName(level)} Risk`}
                required
                error={errors.escalationTimeouts?.[level]?.message}
                hint="Hours"
              >
                <input
                  type="number"
                  step="0.5"
                  {...register(`escalationTimeouts.${level}`, { valueAsNumber: true })}
                  className="form-input"
                  min={level === 'EXTREME' ? 0.5 : 1}
                  max={level === 'EXTREME' ? 48 : 168}
                />
              </FormField>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3>Approval Authority</h3>
          <p className="config-section-desc">
            Required approval role and delegation settings per risk level.
          </p>

          <div className="authority-grid">
            {riskLevels.map((level) => (
              <div key={level} className="authority-card">
                <div className="authority-header">
                  <span className={`risk-badge risk-badge--${level.toLowerCase()}`}>
                    {getRiskLevelDisplayName(level)}
                  </span>
                </div>
                <div className="authority-body">
                  <FormField
                    label="Required Role"
                    error={errors.approvalAuthority?.[level]?.requiredRole?.message}
                  >
                    <select
                      {...register(`approvalAuthority.${level}.requiredRole`)}
                      className="form-select"
                    >
                      {APPROVAL_ROLES.map((role) => (
                        <option key={role.value} value={role.value}>
                          {role.label}
                        </option>
                      ))}
                    </select>
                  </FormField>

                  <div className="checkbox-inline">
                    <label className="checkbox-label-inline">
                      <input
                        type="checkbox"
                        {...register(`approvalAuthority.${level}.canDelegate`)}
                        className="checkbox-input-inline"
                      />
                      <span className="checkbox-text">Can Delegate</span>
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3>Notifications</h3>

          <div className="notification-toggles">
            <div className="checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  {...register('notifications.emailOnPending')}
                  className="checkbox-input"
                />
                <span className="checkbox-box" />
                <div className="checkbox-content">
                  <span className="checkbox-name">Email on Pending</span>
                  <span className="checkbox-desc">
                    Send email notifications when new items are pending approval.
                  </span>
                </div>
              </label>
            </div>

            <div className="checkbox-field">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  {...register('notifications.emailOnEscalation')}
                  className="checkbox-input"
                />
                <span className="checkbox-box" />
                <div className="checkbox-content">
                  <span className="checkbox-name">Email on Escalation</span>
                  <span className="checkbox-desc">
                    Send email notifications when items are escalated.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="form-row" style={{ marginTop: '1rem' }}>
            <FormField
              label="Slack Webhook URL"
              error={errors.notifications?.slackWebhook?.message}
              hint="Optional. Send notifications to Slack channel."
            >
              <input
                type="text"
                {...register('notifications.slackWebhook')}
                className="form-input"
                placeholder="https://hooks.slack.com/services/..."
              />
            </FormField>
          </div>
        </div>

        <div className="config-section">
          <h3>Change Reason</h3>
          <FormField
            label="Reason for changes"
            required
            error={errors.reason?.message}
            hint="Required for audit trail"
          >
            <input
              type="text"
              {...register('reason')}
              className="form-input"
              placeholder="e.g., Adjusting escalation times for holiday coverage"
            />
          </FormField>
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
