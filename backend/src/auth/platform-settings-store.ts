/**
 * Platform Settings Store
 *
 * Phase 1.2 Plan 01: Deployment environment configuration
 *
 * ARCHITECTURE:
 * - Configurable authentication requirements per deployment
 * - Environment types: public, enterprise, classified
 * - Admin-configurable via Admin UI
 * - Determines allowed 2FA methods and session policies
 */

import { getPool } from '../lib/database.js';
import type { DeploymentConfig } from './deployment-types.js';

/**
 * Initialize platform settings table
 */
async function initPlatformSettingsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS platform_settings (
      id TEXT PRIMARY KEY,
      environment TEXT NOT NULL,
      allowed_second_factors JSONB NOT NULL,
      require_second_factor BOOLEAN NOT NULL DEFAULT true,
      session_duration_minutes INTEGER NOT NULL DEFAULT 10080,
      require_reauth_for_high_value BOOLEAN NOT NULL DEFAULT false,
      allowed_email_domains JSONB DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    -- Insert default public environment config if not exists
    INSERT INTO platform_settings (id, environment, allowed_second_factors, allowed_email_domains)
    VALUES ('default', 'public', '["totp"]'::jsonb, '[]'::jsonb)
    ON CONFLICT (id) DO NOTHING;

    -- Add allowed_email_domains column if it doesn't exist (for existing deployments)
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'platform_settings' AND column_name = 'allowed_email_domains'
      ) THEN
        ALTER TABLE platform_settings ADD COLUMN allowed_email_domains JSONB DEFAULT '[]'::jsonb;
      END IF;
    END $$;
  `);
}

/**
 * Default configurations for each environment type
 */
const DEFAULT_CONFIGS: Record<string, Omit<DeploymentConfig, 'id' | 'createdAt' | 'updatedAt'>> = {
  public: {
    environment: 'public',
    allowedSecondFactors: ['totp'],
    requireSecondFactor: true,
    sessionDurationMinutes: 10080, // 7 days
    requireReauthForHighValue: false,
    allowedEmailDomains: [], // No restriction
  },
  enterprise: {
    environment: 'enterprise',
    allowedSecondFactors: ['totp', 'hardware_token'],
    requireSecondFactor: true,
    sessionDurationMinutes: 1440, // 24 hours
    requireReauthForHighValue: true,
    allowedEmailDomains: [], // No restriction by default
  },
  classified: {
    environment: 'classified',
    allowedSecondFactors: ['hardware_token', 'cac_piv'],
    requireSecondFactor: true,
    sessionDurationMinutes: 480, // 8 hours (shift-based)
    requireReauthForHighValue: true,
    allowedEmailDomains: [], // Admin should configure
  },
};

/**
 * Platform Settings Store
 * Singleton pattern with lazy table initialization
 */
export class PlatformSettingsStore {
  private initialized = false;
  private cachedConfig: DeploymentConfig | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await initPlatformSettingsTable();
      this.initialized = true;
    }
  }

  /**
   * Get current deployment configuration
   * Cached for 5 minutes to reduce database load
   */
  async getConfig(): Promise<DeploymentConfig> {
    await this.ensureInitialized();

    // Return cached config if fresh
    const now = Date.now();
    if (this.cachedConfig && now - this.cacheTime < this.CACHE_TTL_MS) {
      return this.cachedConfig;
    }

    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        id, environment, allowed_second_factors,
        require_second_factor, session_duration_minutes,
        require_reauth_for_high_value, allowed_email_domains,
        created_at, updated_at
      FROM platform_settings
      WHERE id = 'default'
    `
    );

    if (result.rows.length === 0) {
      // Shouldn't happen due to default insert, but handle gracefully
      return {
        id: 'default',
        environment: 'public',
        allowedSecondFactors: ['totp'],
        requireSecondFactor: true,
        sessionDurationMinutes: 10080,
        requireReauthForHighValue: false,
        allowedEmailDomains: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const row = result.rows[0];
    this.cachedConfig = {
      id: row.id,
      environment: row.environment,
      allowedSecondFactors: row.allowed_second_factors,
      requireSecondFactor: row.require_second_factor,
      sessionDurationMinutes: row.session_duration_minutes,
      requireReauthForHighValue: row.require_reauth_for_high_value,
      allowedEmailDomains: row.allowed_email_domains || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    this.cacheTime = now;

    return this.cachedConfig;
  }

  /**
   * Update deployment configuration
   * Admin-only operation
   *
   * @param environment - Environment type (public, enterprise, classified)
   */
  async setEnvironment(
    environment: 'public' | 'enterprise' | 'classified'
  ): Promise<DeploymentConfig> {
    await this.ensureInitialized();
    const pool = getPool();

    const config = DEFAULT_CONFIGS[environment];
    if (!config) {
      throw new Error(`Invalid environment: ${environment}`);
    }

    const now = new Date();

    await pool.query(
      `
      UPDATE platform_settings
      SET
        environment = $1,
        allowed_second_factors = $2,
        require_second_factor = $3,
        session_duration_minutes = $4,
        require_reauth_for_high_value = $5,
        allowed_email_domains = $6,
        updated_at = $7
      WHERE id = 'default'
    `,
      [
        config.environment,
        JSON.stringify(config.allowedSecondFactors),
        config.requireSecondFactor,
        config.sessionDurationMinutes,
        config.requireReauthForHighValue,
        JSON.stringify(config.allowedEmailDomains || []),
        now,
      ]
    );

    // Invalidate cache
    this.cachedConfig = null;

    return {
      id: 'default',
      ...config,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Update custom configuration
   * For advanced admin use
   */
  async updateConfig(
    updates: Partial<Omit<DeploymentConfig, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<DeploymentConfig> {
    await this.ensureInitialized();
    const pool = getPool();

    const current = await this.getConfig();
    const now = new Date();

    const newConfig = {
      environment: updates.environment ?? current.environment,
      allowedSecondFactors: updates.allowedSecondFactors ?? current.allowedSecondFactors,
      requireSecondFactor: updates.requireSecondFactor ?? current.requireSecondFactor,
      sessionDurationMinutes: updates.sessionDurationMinutes ?? current.sessionDurationMinutes,
      requireReauthForHighValue:
        updates.requireReauthForHighValue ?? current.requireReauthForHighValue,
      allowedEmailDomains: updates.allowedEmailDomains ?? current.allowedEmailDomains,
    };

    await pool.query(
      `
      UPDATE platform_settings
      SET
        environment = $1,
        allowed_second_factors = $2,
        require_second_factor = $3,
        session_duration_minutes = $4,
        require_reauth_for_high_value = $5,
        allowed_email_domains = $6,
        updated_at = $7
      WHERE id = 'default'
    `,
      [
        newConfig.environment,
        JSON.stringify(newConfig.allowedSecondFactors),
        newConfig.requireSecondFactor,
        newConfig.sessionDurationMinutes,
        newConfig.requireReauthForHighValue,
        JSON.stringify(newConfig.allowedEmailDomains || []),
        now,
      ]
    );

    // Invalidate cache
    this.cachedConfig = null;

    return {
      id: 'default',
      ...newConfig,
      createdAt: current.createdAt,
      updatedAt: now,
    };
  }

  /**
   * Check if a second factor method is allowed in current environment
   */
  async isSecondFactorAllowed(method: 'totp' | 'hardware_token' | 'cac_piv'): Promise<boolean> {
    const config = await this.getConfig();
    return config.allowedSecondFactors.includes(method);
  }

  /**
   * Get session duration in milliseconds
   */
  async getSessionDurationMs(): Promise<number> {
    const config = await this.getConfig();
    return config.sessionDurationMinutes * 60 * 1000;
  }

  /**
   * Reset to default configuration for environment type
   */
  async resetToDefault(
    environment: 'public' | 'enterprise' | 'classified'
  ): Promise<DeploymentConfig> {
    return this.setEnvironment(environment);
  }

  /**
   * Clear cache (for testing or after manual database changes)
   */
  clearCache(): void {
    this.cachedConfig = null;
    this.cacheTime = 0;
  }

  /**
   * Get allowed email domains for registration restriction
   * Empty array means no restriction (all domains allowed)
   */
  async getAllowedEmailDomains(): Promise<string[]> {
    const config = await this.getConfig();
    return config.allowedEmailDomains || [];
  }

  /**
   * Set allowed email domains for registration restriction
   * Empty array or null means no restriction (all domains allowed)
   */
  async setAllowedEmailDomains(domains: string[]): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    // Normalize domains (lowercase, trim whitespace)
    const normalizedDomains = domains
      .map(d => d.toLowerCase().trim())
      .filter(d => d.length > 0);

    await pool.query(
      `
      UPDATE platform_settings
      SET allowed_email_domains = $1, updated_at = NOW()
      WHERE id = 'default'
    `,
      [JSON.stringify(normalizedDomains)]
    );

    // Invalidate cache
    this.cachedConfig = null;
  }

  /**
   * Check if an email domain is allowed for registration
   * Returns true if:
   * - No domain restriction is set (empty array)
   * - The email domain is in the allowed list
   */
  async isEmailDomainAllowed(email: string): Promise<boolean> {
    const allowedDomains = await this.getAllowedEmailDomains();

    // No restriction if empty
    if (allowedDomains.length === 0) {
      return true;
    }

    // Extract domain from email
    const emailLower = email.toLowerCase().trim();
    const atIndex = emailLower.lastIndexOf('@');
    if (atIndex === -1) {
      return false; // Invalid email format
    }

    const domain = emailLower.substring(atIndex + 1);
    return allowedDomains.includes(domain);
  }
}

// Singleton instance
let platformSettingsStoreInstance: PlatformSettingsStore | null = null;

export function getPlatformSettingsStore(): PlatformSettingsStore {
  if (!platformSettingsStoreInstance) {
    platformSettingsStoreInstance = new PlatformSettingsStore();
  }
  return platformSettingsStoreInstance;
}

// Export default configs for reference
export { DEFAULT_CONFIGS };
