/**
 * RegisterPage - New user passkey registration using @vitalpoint/near-phantom-auth
 *
 * Collects display name + organization email before passkey creation.
 * Validates email against domain whitelist / email blacklist via backend.
 * After passkey is created, saves user profile to /api/user-profile.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnonAuth } from '@vitalpoint/near-phantom-auth/client';
import './RegisterPage.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

export function RegisterPage() {
  const navigate = useNavigate();
  const {
    isLoading,
    isAuthenticated,
    register,
    error,
    clearError,
    webAuthnSupported,
  } = useAnonAuth();

  const [displayName, setDisplayName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [emailRequired, setEmailRequired] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Check if email is required (domain whitelist active)
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/user-profile/registration-requirements`)
      .then(res => res.json())
      .then((data: { emailRequired: boolean }) => {
        setEmailRequired(data.emailRequired);
      })
      .catch(() => {
        // Default to not required if endpoint unavailable
      });
  }, []);

  // Already authenticated — redirect to app
  if (isAuthenticated && !isSavingProfile) {
    navigate('/', { replace: true });
    return null;
  }

  const handleRegister = async () => {
    clearError();
    setValidationError(null);

    // Validate display name
    if (!displayName.trim()) {
      setValidationError('Display name is required');
      return;
    }

    // Validate email if required or provided
    const emailValue = orgEmail.trim();
    if (emailRequired && !emailValue) {
      setValidationError('Organization email is required');
      return;
    }

    // Validate email against whitelist/blacklist if provided
    if (emailValue) {
      try {
        const valRes = await fetch(`${BACKEND_URL}/api/user-profile/validate-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailValue }),
        });
        const valData = await valRes.json() as { allowed: boolean; reason?: string };
        if (!valData.allowed) {
          setValidationError(valData.reason || 'This email is not permitted for registration');
          return;
        }
      } catch {
        setValidationError('Unable to validate email. Please try again.');
        return;
      }
    }

    // Create passkey
    setIsSavingProfile(true);
    try {
      await register();

      // Save profile after passkey creation (session cookie is now set)
      try {
        await fetch(`${BACKEND_URL}/api/user-profile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            displayName: displayName.trim(),
            orgEmail: emailValue || null,
          }),
        });
      } catch (err) {
        console.error('[RegisterPage] Failed to save profile:', err);
      }
    } catch (err) {
      console.error('[RegisterPage] Registration failed:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  if (!webAuthnSupported) {
    return (
      <div className="register-page">
        <div className="register-card">
          <h1>BASTION</h1>
          <p className="subtitle">Create Your Account</p>
          <div className="warning-message">
            Your browser does not support passkeys (WebAuthn). Please use a modern browser
            such as Chrome, Firefox, or Safari with biometric authentication.
          </div>
          <p className="login-link">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="register-page">
      <div className="register-card">
        <h1>BASTION</h1>
        <p className="subtitle">Create Your Account</p>

        {(error || validationError) && (
          <div className="error-message">
            {validationError || error}{' '}
            <button
              className="back-link"
              onClick={() => {
                clearError();
                setValidationError(null);
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ff4d4d', textDecoration: 'underline' }}
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="register-form">
          <input
            className="email-input"
            type="text"
            placeholder="Display Name *"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoading || isSavingProfile}
            autoComplete="name"
          />

          <input
            className="email-input"
            type="email"
            placeholder={emailRequired ? 'Organization Email *' : 'Organization Email (optional)'}
            value={orgEmail}
            onChange={(e) => setOrgEmail(e.target.value)}
            disabled={isLoading || isSavingProfile}
            autoComplete="email"
          />

          <button
            className="register-button primary"
            onClick={handleRegister}
            disabled={isLoading || isSavingProfile}
          >
            {isLoading || isSavingProfile ? 'Creating account...' : 'Create Account with Passkey'}
          </button>

          <p className="info-text">
            A passkey will be created using your device's biometric authentication
            (fingerprint, face, or PIN). No password required.
          </p>

          <p className="login-link">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
