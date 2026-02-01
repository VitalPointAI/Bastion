/**
 * Auth Service - API client for passkey and magic link authentication
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_API_URL || '';

export interface AuthSession {
  sessionToken: string;
  accountId: string;
  email?: string;        // Email address for UI display
  prfAvailable: boolean;
  expiresAt: string;
}

export interface RegisterResult {
  verified: boolean;
  nearAccountId: string;      // From MPC using user UUID (NOT from passkey)
  prfSupported: boolean;
  mpcDerivationPath: string;  // bastion,{user_uuid}
}

class AuthService {
  private sessionToken: string | null = null;

  constructor() {
    // Restore session from localStorage
    this.sessionToken = localStorage.getItem('sessionToken');
  }

  // ============================================
  // Passkey Endpoints
  // ============================================

  async getRegistrationOptions(email: string, isRecovery = false) {
    const res = await fetch(`${BACKEND_URL}/api/auth/passkey/register-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, isRecovery })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async verifyRegistration(challengeId: string, userId: string, response: unknown): Promise<RegisterResult> {
    const res = await fetch(`${BACKEND_URL}/api/auth/passkey/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, userId, response })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async getAuthenticationOptions(email?: string) {
    const res = await fetch(`${BACKEND_URL}/api/auth/passkey/auth-options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async verifyAuthentication(challengeId: string, response: unknown) {
    const res = await fetch(`${BACKEND_URL}/api/auth/passkey/authenticate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId, response })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // ============================================
  // Magic Link Endpoints
  // ============================================

  async sendMagicLink(email: string) {
    const res = await fetch(`${BACKEND_URL}/api/auth/magic-link/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async verifyMagicLink(token: string) {
    const res = await fetch(`${BACKEND_URL}/api/auth/magic-link/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  async requestRecovery(email: string) {
    const res = await fetch(`${BACKEND_URL}/api/auth/recovery/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  }

  // ============================================
  // Session Management
  // ============================================

  async getSession(): Promise<AuthSession | null> {
    if (!this.sessionToken) return null;

    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/session`, {
        headers: { 'Authorization': `Bearer ${this.sessionToken}` }
      });

      if (!res.ok) {
        this.clearSession();
        return null;
      }

      const data = await res.json();
      return {
        sessionToken: this.sessionToken,
        accountId: data.accountId || data.nearAccountId,  // Handle both field names
        email: data.email,
        prfAvailable: data.prfAvailable,
        expiresAt: data.expiresAt
      };
    } catch {
      this.clearSession();
      return null;
    }
  }

  setSession(sessionToken: string) {
    this.sessionToken = sessionToken;
    localStorage.setItem('sessionToken', sessionToken);
  }

  clearSession() {
    this.sessionToken = null;
    localStorage.removeItem('sessionToken');
  }

  async logout() {
    if (!this.sessionToken) return;

    try {
      await fetch(`${BACKEND_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.sessionToken}` }
      });
    } catch {
      // Ignore errors on logout
    }

    this.clearSession();
  }

  getSessionToken(): string | null {
    return this.sessionToken;
  }
}

export const authService = new AuthService();
