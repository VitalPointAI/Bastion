/**
 * LoginPage - Unified login with passkey and magic link options
 */

import { useState } from 'react';
import { authenticateWithPasskey, isPasskeySupported } from '../lib/passkey';
import { authService } from '../lib/auth-service';
import './LoginPage.css';

type LoginMode = 'choose' | 'passkey' | 'magic-link';

export function LoginPage() {
  const [mode, setMode] = useState<LoginMode>('choose');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean | null>(null);

  // Check passkey support on mount
  useState(() => {
    isPasskeySupported().then(setPasskeySupported);
  });

  const handlePasskeyLogin = async () => {
    setError(null);
    setLoading(true);

    const result = await authenticateWithPasskey(email || undefined);

    setLoading(false);

    if (result.success) {
      // Redirect to app
      window.location.href = '/';
    } else {
      setError(result.error || 'Authentication failed');
    }
  };

  const handleMagicLinkRequest = async () => {
    if (!email) {
      setError('Please enter your email');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const result = await authService.sendMagicLink(email);
      setMagicLinkSent(true);

      // In dev mode, show token
      if (result.devToken) {
        console.log('DEV: Magic link token:', result.devToken);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send magic link');
    }

    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>BASTION</h1>
        <p className="subtitle">Secure Command & Control</p>

        {error && (
          <div className="error-message">{error}</div>
        )}

        {mode === 'choose' && (
          <div className="login-options">
            {passkeySupported !== false && (
              <button
                className="login-button primary"
                onClick={() => setMode('passkey')}
              >
                <span className="icon">🔐</span>
                Sign in with Passkey
              </button>
            )}

            <button
              className="login-button secondary"
              onClick={() => setMode('magic-link')}
            >
              <span className="icon">📧</span>
              Sign in with Email
            </button>

            <p className="new-user-link">
              New user? <a href="/register">Create an account</a>
            </p>
          </div>
        )}

        {mode === 'passkey' && (
          <div className="passkey-login">
            <input
              type="email"
              placeholder="Email (optional for discoverable credentials)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="email-input"
            />

            <button
              className="login-button primary"
              onClick={handlePasskeyLogin}
              disabled={loading}
            >
              {loading ? 'Authenticating...' : 'Continue with Passkey'}
            </button>

            <button
              className="back-link"
              onClick={() => setMode('choose')}
            >
              ← Back to options
            </button>
          </div>
        )}

        {mode === 'magic-link' && !magicLinkSent && (
          <div className="magic-link-login">
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="email-input"
              required
            />

            <button
              className="login-button primary"
              onClick={handleMagicLinkRequest}
              disabled={loading || !email}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>

            <button
              className="back-link"
              onClick={() => setMode('choose')}
            >
              ← Back to options
            </button>
          </div>
        )}

        {mode === 'magic-link' && magicLinkSent && (
          <div className="magic-link-sent">
            <div className="success-icon">✓</div>
            <h2>Check your email</h2>
            <p>We sent a login link to <strong>{email}</strong></p>
            <p className="hint">The link expires in 15 minutes.</p>

            <button
              className="back-link"
              onClick={() => {
                setMagicLinkSent(false);
                setMode('choose');
              }}
            >
              ← Try a different method
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
