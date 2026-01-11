import { describe, it, expect } from 'vitest';

describe('Frontend Security', () => {
  it('should not expose secrets in environment', () => {
    const env = import.meta.env;

    // Secrets that MUST NOT exist
    expect(env.VITE_PINATA_JWT).toBeUndefined();
    expect(env.VITE_FASTNEAR_API_KEY).toBeUndefined();
    expect(env.PINATA_JWT).toBeUndefined();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.ENCRYPTION_MASTER_KEY).toBeUndefined();

    // Public config that CAN exist
    expect(env.VITE_PRIVY_APP_ID).toBeDefined();
    expect(env.VITE_NEAR_NETWORK).toBeDefined();
    expect(env.VITE_BACKEND_API_URL).toBeDefined();
  });
});
