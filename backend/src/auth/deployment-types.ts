/**
 * Deployment Configuration Type
 *
 * Extracted from types.ts during Phase 18 auth replacement.
 * platform-settings-store.ts imports from here to preserve its functionality
 * while the legacy types.ts is phased out in Plan 18-05.
 */

/**
 * Platform deployment configuration
 * Determines authentication requirements based on environment
 */
export interface DeploymentConfig {
  id: string;
  environment: 'public' | 'enterprise' | 'classified';
  allowedSecondFactors: ('totp' | 'hardware_token' | 'cac_piv')[];
  requireSecondFactor: boolean; // Always true for recovery
  sessionDurationMinutes: number;
  requireReauthForHighValue: boolean; // Require passkey reauth for sensitive ops
  allowedEmailDomains?: string[]; // Empty array or undefined = no restriction
  createdAt: Date;
  updatedAt: Date;
}
