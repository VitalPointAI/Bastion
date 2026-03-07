/**
 * HMAC Authentication for Backend-Ironclaw Communication
 *
 * Provides request signing and verification using a shared secret.
 * Prevents impersonation of the backend by any container on the Docker network.
 *
 * Security properties:
 * - HMAC-SHA256 signature over method + path + body + timestamp
 * - Timestamp validation (5-minute window) prevents replay attacks
 * - Shared secret injected via environment variable (IRONCLAW_SHARED_SECRET)
 */

import { createHmac, timingSafeEqual } from 'crypto';

const SIGNATURE_HEADER = 'x-bastion-signature';
const TIMESTAMP_HEADER = 'x-bastion-timestamp';
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get the shared secret from environment.
 * Returns null if not configured (graceful degradation in dev).
 */
function getSharedSecret(): string | null {
  return process.env.IRONCLAW_SHARED_SECRET || null;
}

/**
 * Compute HMAC-SHA256 signature for a request.
 */
function computeSignature(
  secret: string,
  method: string,
  path: string,
  body: string,
  timestamp: string,
): string {
  const payload = `${method}\n${path}\n${body}\n${timestamp}`;
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Sign an outbound request to the Ironclaw sidecar.
 * Returns headers to attach to the request.
 * Returns empty object if IRONCLAW_SHARED_SECRET is not configured.
 */
export function signRequest(
  method: string,
  path: string,
  body: string,
): Record<string, string> {
  const secret = getSharedSecret();
  if (!secret) return {};

  const timestamp = Date.now().toString();
  const signature = computeSignature(secret, method, path, body, timestamp);

  return {
    [SIGNATURE_HEADER]: signature,
    [TIMESTAMP_HEADER]: timestamp,
  };
}

/**
 * Verify an inbound request from the Ironclaw sidecar (MCP tool callbacks).
 * Returns true if signature is valid or if HMAC is not configured (dev mode).
 *
 * In production, IRONCLAW_SHARED_SECRET should always be set.
 */
export function verifyRequest(
  method: string,
  path: string,
  body: string,
  headers: Record<string, string | string[] | undefined>,
): boolean {
  const secret = getSharedSecret();
  if (!secret) {
    // Not configured — allow in dev, warn in production
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[hmac-auth] WARNING: IRONCLAW_SHARED_SECRET not set in production. ' +
        'All inbound requests from Ironclaw are UNVERIFIED.',
      );
    }
    return true;
  }

  const signature = headers[SIGNATURE_HEADER] as string | undefined;
  const timestamp = headers[TIMESTAMP_HEADER] as string | undefined;

  if (!signature || !timestamp) {
    console.warn('[hmac-auth] Missing signature or timestamp headers');
    return false;
  }

  // Timestamp validation — reject stale requests
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime) || Math.abs(Date.now() - requestTime) > MAX_CLOCK_SKEW_MS) {
    console.warn('[hmac-auth] Request timestamp outside allowed window');
    return false;
  }

  // Compute expected signature and compare using timing-safe comparison
  const expected = computeSignature(secret, method, path, body, timestamp);
  const expectedBuf = Buffer.from(expected, 'hex');
  const actualBuf = Buffer.from(signature, 'hex');

  if (expectedBuf.length !== actualBuf.length) {
    return false;
  }

  return timingSafeEqual(expectedBuf, actualBuf);
}

export { SIGNATURE_HEADER, TIMESTAMP_HEADER };
