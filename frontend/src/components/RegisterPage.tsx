/**
 * RegisterPage - New user passkey registration
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerPasskey, isPasskeySupported } from '../lib/passkey';
import './RegisterPage.css';

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  // Check passkey support on mount
  useEffect(() => {
    isPasskeySupported().then(setPasskeySupported);
  }, []);

  const handleRegister = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setLoading(true);

    const result = await registerPasskey(email, false);

    setLoading(false);

    if (result.success) {
      // Registration successful - redirect to login
      navigate('/login');
    } else {
      setError(result.error || 'Registration failed');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading && passkeySupported !== false) {
      handleRegister();
    }
  };

  return (
    <div className="register-page">
      <div className="register-card">
        <h1>BASTION</h1>
        <p className="subtitle">Create Your Account</p>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {passkeySupported === false && (
          <div className="warning-message">
            Your browser does not support passkeys. Please use a modern browser with biometric authentication.
          </div>
        )}

        <div className="register-form">
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            className="email-input"
            autoComplete="email"
            required
          />

          <button
            className="register-button primary"
            onClick={handleRegister}
            disabled={loading || passkeySupported === false}
          >
            {loading ? 'Creating account...' : 'Create Account with Passkey'}
          </button>

          <p className="info-text">
            A passkey will be created using your device's biometric authentication (fingerprint, face, or PIN).
          </p>

          <p className="login-link">
            Already have an account? <a href="/login">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  );
}
