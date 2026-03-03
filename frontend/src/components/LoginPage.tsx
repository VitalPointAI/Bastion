/**
 * LoginPage - Passkey authentication using @vitalpoint/near-phantom-auth
 *
 * Replaces the previous magic-link/passkey login page.
 * Uses useAnonAuth() from the package (provided by AnonAuthProvider in App.tsx).
 * Magic link and TOTP removed — passkey-only authentication.
 */

import { useNavigate } from 'react-router-dom';
import { useAnonAuth } from '@vitalpoint/near-phantom-auth/client';
import './LoginPage.css';

export function LoginPage() {
  const navigate = useNavigate();
  const {
    isLoading,
    isAuthenticated,
    login,
    error,
    clearError,
    webAuthnSupported,
  } = useAnonAuth();

  // Already authenticated — redirect to app
  if (isAuthenticated) {
    navigate('/', { replace: true });
    return null;
  }

  const handleLogin = async () => {
    clearError();
    await login();
    // On success the session cookie is set; isAuthenticated will become true
    // AuthWrapper redirect will navigate to the protected page
  };

  if (!webAuthnSupported) {
    return (
      <div className="login-page">
        <div className="login-card">
          <h1>BASTION</h1>
          <p className="subtitle">Secure Command &amp; Control</p>
          <div className="error-message">
            Your browser does not support passkeys (WebAuthn).
            Please use a modern browser such as Chrome, Firefox, or Safari.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>BASTION</h1>
        <p className="subtitle">Secure Command &amp; Control</p>

        {error && (
          <div className="error-message">
            {error}{' '}
            <button className="back-link" onClick={clearError}>
              Dismiss
            </button>
          </div>
        )}

        <div className="login-options">
          <button
            className="login-button primary"
            onClick={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? 'Authenticating...' : 'Sign in with Passkey'}
          </button>

          <p className="new-user-link">
            New user?{' '}
            <a href="/register">Create an account</a>
          </p>
        </div>
      </div>
    </div>
  );
}
