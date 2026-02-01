/**
 * PasskeySetup - Passkey registration component
 */

import { useState } from 'react';
import { registerPasskey, isPasskeySupported } from '../lib/passkey';
import './PasskeySetup.css';

interface PasskeySetupProps {
  email: string;
  isRecovery?: boolean;
  onComplete: (accountId: string, prfSupported: boolean) => void;
  onSkip?: () => void;
}

export function PasskeySetup({
  email,
  isRecovery = false,
  onComplete,
  onSkip
}: PasskeySetupProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  // Check support on mount
  useState(() => {
    isPasskeySupported().then(setPasskeySupported);
  });

  const handleRegister = async () => {
    setError(null);
    setLoading(true);

    const result = await registerPasskey(email, isRecovery);

    setLoading(false);

    if (result.success && result.accountId) {
      onComplete(result.accountId, result.prfSupported ?? false);
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  if (passkeySupported === false) {
    return (
      <div className="passkey-setup">
        <div className="unsupported">
          <h3>Passkeys Not Supported</h3>
          <p>Your browser or device doesn't support passkeys.</p>
          {onSkip && (
            <button onClick={onSkip} className="skip-button">
              Continue without passkey
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="passkey-setup">
      <h2>{isRecovery ? 'Set Up New Passkey' : 'Create Your Passkey'}</h2>

      <p className="description">
        Passkeys are secure, phishing-resistant credentials stored on your device.
        Use your fingerprint, face, or PIN to authenticate.
      </p>

      {error && <div className="error-message">{error}</div>}

      <div className="email-display">
        <span className="label">Account:</span>
        <span className="email">{email}</span>
      </div>

      <button
        className="register-button"
        onClick={handleRegister}
        disabled={loading}
      >
        {loading ? 'Creating passkey...' : 'Create Passkey'}
      </button>

      {onSkip && !isRecovery && (
        <button onClick={onSkip} className="skip-link">
          Skip for now
        </button>
      )}

      <div className="security-note">
        <strong>Note:</strong> For full functionality including encrypted operations,
        passkey registration is recommended.
      </div>
    </div>
  );
}
