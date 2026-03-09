/**
 * OAuth Token Auto-Refresh
 *
 * Proactively refreshes OAuth tokens before they expire.
 * Called by the config service when resolving API credentials,
 * and periodically by a background timer.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { configService } from '../strategic/config/index.js';

/** Refresh tokens when less than this many seconds remain */
const REFRESH_BUFFER_SECONDS = 300; // 5 minutes before expiry

/** Background refresh interval (check every 60 seconds) */
const REFRESH_CHECK_INTERVAL_MS = 60_000;

/** Shared volume path for Ironclaw token sync */
const TOKEN_SYNC_PATH = process.env.TOKEN_SYNC_PATH || '/shared/tokens/anthropic-oauth-token';

let refreshTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Write the OAuth token to the shared volume so Ironclaw can pick it up.
 * Fails silently when the shared volume isn't mounted (e.g. local dev).
 */
async function syncTokenToFile(token: string): Promise<void> {
  try {
    await mkdir(dirname(TOKEN_SYNC_PATH), { recursive: true });
    await writeFile(TOKEN_SYNC_PATH, token, { mode: 0o600 });
    console.log('[OAuth] Token synced to shared volume for Ironclaw');
  } catch {
    // Shared volume not mounted — expected in local dev
  }
}

/**
 * Check if the current OAuth token is expired or about to expire.
 */
export function isTokenExpiringSoon(expiresAt: string | undefined | null): boolean {
  if (!expiresAt) return false;
  const expiryTime = new Date(expiresAt).getTime();
  const bufferMs = REFRESH_BUFFER_SECONDS * 1000;
  return Date.now() >= expiryTime - bufferMs;
}

/**
 * Attempt to refresh the OAuth access token using the refresh token.
 * Updates the config service with the new tokens on success.
 * Returns the new access token, or null on failure.
 */
export async function refreshOAuthToken(): Promise<string | null> {
  const config = await configService.getLLMConfig();
  const oauth = config.oauth;

  if (!oauth?.refreshToken || !oauth?.clientId || !oauth?.clientSecret) {
    return null;
  }

  // Only refresh if token is expiring soon or already expired
  if (oauth.tokenExpiresAt && !isTokenExpiringSoon(oauth.tokenExpiresAt)) {
    return oauth.accessToken || null;
  }

  try {
    console.log('[OAuth] Refreshing access token...');

    const response = await fetch('https://console.anthropic.com/v1/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
        refresh_token: oauth.refreshToken,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[OAuth] Token refresh failed:', response.status, errorBody);
      return null;
    }

    const tokens = await response.json() as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
    };

    // Update config with new tokens
    await configService.updateLLMConfig(
      {
        oauth: {
          ...oauth,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token || oauth.refreshToken,
          tokenExpiresAt: tokens.expires_in
            ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
            : oauth.tokenExpiresAt,
          connected: true,
        },
      },
      'system',
      'OAuth token auto-refreshed',
    );

    console.log('[OAuth] Token refreshed successfully');

    // Sync to shared volume so Ironclaw sidecar picks up the new token
    await syncTokenToFile(tokens.access_token);

    return tokens.access_token;
  } catch (err) {
    console.error('[OAuth] Token refresh error:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Get the current valid OAuth access token, refreshing if needed.
 * Returns null if OAuth is not configured or refresh fails.
 */
export async function getValidOAuthToken(): Promise<string | null> {
  const config = await configService.getLLMConfig();
  const oauth = config.oauth;

  if (!oauth?.connected || !oauth?.accessToken) {
    return null;
  }

  // If token is still valid, sync it to shared volume and return
  if (oauth.tokenExpiresAt && !isTokenExpiringSoon(oauth.tokenExpiresAt)) {
    await syncTokenToFile(oauth.accessToken);
    return oauth.accessToken;
  }

  // Token expired or expiring — try to refresh
  return refreshOAuthToken();
}

/**
 * Start the background token refresh timer.
 * Checks periodically and refreshes tokens proactively.
 */
export function startTokenRefreshTimer(): void {
  if (refreshTimer) return;

  // Sync current token to shared volume on startup
  (async () => {
    try {
      const config = await configService.getLLMConfig();
      if (config.oauth?.connected && config.oauth?.accessToken) {
        await syncTokenToFile(config.oauth.accessToken);
      }
    } catch { /* ignore startup sync errors */ }
  })();

  refreshTimer = setInterval(async () => {
    try {
      const config = await configService.getLLMConfig();
      const oauth = config.oauth;

      if (oauth?.connected && oauth?.refreshToken && oauth?.tokenExpiresAt) {
        if (isTokenExpiringSoon(oauth.tokenExpiresAt)) {
          await refreshOAuthToken();
        }
      }
    } catch {
      // Silent — background check should not crash
    }
  }, REFRESH_CHECK_INTERVAL_MS);

  console.log('[OAuth] Background token refresh timer started (60s interval)');
}

/**
 * Stop the background token refresh timer.
 */
export function stopTokenRefreshTimer(): void {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}
