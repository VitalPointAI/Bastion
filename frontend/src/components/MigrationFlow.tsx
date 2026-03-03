/**
 * MigrationFlow - Guides users through security upgrade migrations
 *
 * Phase 1.2 Plan 06: Generic migration component for auth/security upgrades
 *
 * Shown when:
 * 1. System detects user needs security upgrade
 * 2. User has legacy auth configuration
 * 3. DID secret derivation method has changed
 *
 * USE CASES:
 * - Migrating to passkey authentication with PRF
 * - Upgrading secret derivation methods
 * - Security-mandated migrations
 */

import { useState } from 'react';
import './MigrationFlow.css';

interface MigrationFlowProps {
  email: string;
  onComplete: () => void;
  onSkip?: () => void;
  migrationType?: 'passkey' | 'security-upgrade' | 'generic';
}

type MigrationStep =
  | 'intro'
  | 'processing'
  | 'totp-setup'
  | 'complete'
  | 'error';

const _BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

export function MigrationFlow({
  email,
  onComplete,
  onSkip,
  migrationType: _migrationType = 'security-upgrade',
}: MigrationFlowProps) {
  const [step, setStep] = useState<MigrationStep>('intro');
  const [error, setError] = useState<string | null>(null);
  const [didPreserved, _setDidPreserved] = useState(false);

  const handleStartMigration = async () => {
    setStep('processing');
    setError(null);

    try {
      // This is a placeholder - in real usage, the calling component
      // would handle the actual migration logic and call this component
      // only for UI flow.

      // Simulate migration process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Prompt for TOTP setup (recommended for multi-factor recovery)
      setStep('totp-setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Migration failed');
      setStep('error');
    }
  };

  const handleRetry = () => {
    setStep('intro');
    setError(null);
  };

  return (
    <div className="migration-flow">
      {step === 'intro' && (
        <div className="migration-intro">
          <h2>Security Upgrade Available</h2>
          <p>
            BASTION has enhanced security features available for your account.
            This upgrade ensures your encrypted data remains protected with the
            latest security standards.
          </p>

          <div className="benefits-list">
            <div className="benefit">
              <span className="icon">🔐</span>
              <span>Enhanced encryption standards</span>
            </div>
            <div className="benefit">
              <span className="icon">🛡️</span>
              <span>Improved security posture</span>
            </div>
            <div className="benefit">
              <span className="icon">📱</span>
              <span>Modern authentication methods</span>
            </div>
          </div>

          <div className="account-info">
            <span className="label">Account:</span>
            <span className="email">{email}</span>
          </div>

          <button className="primary-button" onClick={handleStartMigration}>
            Start Security Upgrade
          </button>

          {onSkip && (
            <button className="skip-link" onClick={onSkip}>
              Remind me later
            </button>
          )}
        </div>
      )}

      {step === 'processing' && (
        <div className="migration-progress">
          <div className="spinner" />
          <h3>Processing security upgrade...</h3>
          <p>This ensures your encrypted data remains accessible.</p>
        </div>
      )}

      {step === 'totp-setup' && (
        <div className="migration-totp">
          <div className="success-icon">✓</div>
          <h2>Upgrade Complete!</h2>

          <p>
            For enhanced security during account recovery, we recommend setting
            up two-factor authentication (2FA) with an authenticator app.
          </p>

          <div className="totp-benefits">
            <div className="benefit">
              <span className="icon">🔒</span>
              <span>Required for account recovery</span>
            </div>
            <div className="benefit">
              <span className="icon">📱</span>
              <span>Works with Google Authenticator, Authy, etc.</span>
            </div>
          </div>

          <button
            className="primary-button"
            onClick={() => {
              // Navigate to TOTP setup (can be done later in settings)
              window.location.href = '/settings/security';
            }}
          >
            Set Up 2FA Now
          </button>

          <button className="skip-link" onClick={() => setStep('complete')}>
            Skip for now (can set up later in Settings)
          </button>
        </div>
      )}

      {step === 'complete' && (
        <div className="migration-complete">
          <div className="success-icon">✓</div>
          <h2>Migration Complete!</h2>

          {didPreserved ? (
            <p>
              Your security upgrade is complete and all your encrypted data has
              been preserved.
            </p>
          ) : (
            <p>Your security upgrade is complete.</p>
          )}

          <button className="primary-button" onClick={onComplete}>
            Continue to BASTION
          </button>
        </div>
      )}

      {step === 'error' && (
        <div className="migration-error">
          <div className="error-icon">⚠️</div>
          <h2>Upgrade Issue</h2>
          <p className="error-message">{error}</p>

          <div className="error-actions">
            <button className="primary-button" onClick={handleRetry}>
              Try Again
            </button>

            {onSkip && (
              <button className="secondary-button" onClick={onSkip}>
                Continue without upgrade
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
