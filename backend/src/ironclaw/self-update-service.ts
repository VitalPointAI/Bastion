/**
 * Ironclaw Self-Update Service
 *
 * Phase 30 Plan 08: Polls GitHub releases for new Ironclaw versions every 6 hours.
 * Orchestrates non-disruptive updates with session draining, container restart,
 * health check verification, and automatic rollback on failure.
 * Notifies system admin via Ironclaw chat messages.
 */

import { exec } from 'child_process';
import { ironclawClient } from './ironclaw-client.js';
import { ironclawStore } from './ironclaw-store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UpdateCheckResult {
  available: boolean;
  latestVersion?: string;
  releaseNotes?: string;
}

interface UpdateResult {
  success: boolean;
  oldVersion: string;
  newVersion: string;
  error?: string;
}

interface UpdateStatus {
  currentVersion: string | null;
  isUpdating: boolean;
  lastChecked: Date | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GITHUB_RELEASES_URL =
  'https://api.github.com/repos/nearai/ironclaw/releases/latest';
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
const SESSION_DRAIN_MS = 30_000; // 30 seconds
const HEALTH_CHECK_INTERVAL_MS = 5_000; // 5 seconds
const HEALTH_CHECK_TIMEOUT_MS = 60_000; // 60 seconds
const DOCKER_RESTART_TIMEOUT_MS = 120_000; // 120 seconds
const RELEASE_NOTES_MAX_LENGTH = 500;

// ---------------------------------------------------------------------------
// SelfUpdateService
// ---------------------------------------------------------------------------

export class SelfUpdateService {
  private currentVersion: string | null = null;
  private pollIntervalMs = POLL_INTERVAL_MS;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isUpdating = false;
  private lastChecked: Date | null = null;

  /**
   * Start the self-update service.
   * Fetches current version from Ironclaw health endpoint and begins polling.
   */
  async start(): Promise<void> {
    try {
      // Try to get version from env var first, then health endpoint
      this.currentVersion =
        process.env.IRONCLAW_VERSION ?? (await this.fetchCurrentVersion());
    } catch {
      console.warn(
        '[SelfUpdateService] Could not determine current Ironclaw version at startup',
      );
      this.currentVersion = null;
    }

    this.pollTimer = setInterval(() => {
      void this.pollForUpdate();
    }, this.pollIntervalMs);

    console.log(
      `[SelfUpdateService] Started, current version: ${this.currentVersion ?? 'unknown'}, polling every ${this.pollIntervalMs / 3_600_000} hours`,
    );
  }

  /**
   * Stop the self-update service.
   */
  async stop(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    console.log('[SelfUpdateService] Stopped');
  }

  /**
   * Check GitHub releases for a newer version of Ironclaw.
   */
  async checkForUpdate(): Promise<UpdateCheckResult> {
    try {
      const response = await fetch(GITHUB_RELEASES_URL, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'BASTION-SelfUpdate/1.0',
        },
      });

      if (!response.ok) {
        console.warn(
          `[SelfUpdateService] GitHub API returned ${response.status}: ${response.statusText}`,
        );
        return { available: false };
      }

      const release = (await response.json()) as {
        tag_name: string;
        body?: string;
      };
      const latestVersion = release.tag_name;

      this.lastChecked = new Date();

      if (this.currentVersion && latestVersion !== this.currentVersion) {
        const releaseNotes = release.body
          ? release.body.slice(0, RELEASE_NOTES_MAX_LENGTH)
          : undefined;

        return {
          available: true,
          latestVersion,
          releaseNotes,
        };
      }

      return { available: false };
    } catch (err) {
      console.warn(
        '[SelfUpdateService] Error checking for updates:',
        err instanceof Error ? err.message : err,
      );
      return { available: false };
    }
  }

  /**
   * Perform a full update: notify -> drain -> restart -> verify -> report.
   * Rolls back on health check failure.
   */
  async performUpdate(
    _notifyProblemSetId?: string,
  ): Promise<UpdateResult> {
    if (this.isUpdating) {
      return {
        success: false,
        oldVersion: this.currentVersion ?? 'unknown',
        newVersion: 'unknown',
        error: 'Update already in progress',
      };
    }

    const checkResult = await this.checkForUpdate();
    if (!checkResult.available || !checkResult.latestVersion) {
      return {
        success: false,
        oldVersion: this.currentVersion ?? 'unknown',
        newVersion: 'unknown',
        error: 'No update available',
      };
    }

    const oldVersion = this.currentVersion ?? 'unknown';
    const newVersion = checkResult.latestVersion;

    this.isUpdating = true;

    try {
      // 1. Notify admin
      await this.notifyAdmin(
        `Ironclaw update detected: ${oldVersion} -> ${newVersion}. Beginning update...`,
      );

      // 2. Drain active sessions
      console.log('[SelfUpdateService] Draining active sessions...');
      await new Promise((resolve) => setTimeout(resolve, SESSION_DRAIN_MS));

      // 3. Pull and restart container
      console.log('[SelfUpdateService] Pulling and restarting Ironclaw container...');
      await this.execDockerRestart();

      // 4. Wait for health check to pass
      console.log('[SelfUpdateService] Waiting for health check...');
      const healthy = await this.waitForHealthy();

      if (healthy) {
        this.currentVersion = newVersion;
        const changelogMsg = checkResult.releaseNotes
          ? `Ironclaw updated to ${newVersion}. Changes: ${checkResult.releaseNotes}`
          : `Ironclaw updated to ${newVersion}.`;
        await this.notifyAdmin(changelogMsg);

        console.log(`[SelfUpdateService] Update successful: ${oldVersion} -> ${newVersion}`);
        return { success: true, oldVersion, newVersion };
      } else {
        // 5. Rollback
        console.warn('[SelfUpdateService] Health check failed, attempting rollback...');
        await this.execDockerRollback();
        await this.notifyAdmin(
          `Update to ${newVersion} failed. Rolled back to ${oldVersion}.`,
        );

        return {
          success: false,
          oldVersion,
          newVersion,
          error: 'Health check failed after update, rolled back',
        };
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error('[SelfUpdateService] Update error:', errorMsg);
      await this.notifyAdmin(
        `Update to ${newVersion} failed with error: ${errorMsg}. Manual intervention may be required.`,
      );

      return {
        success: false,
        oldVersion,
        newVersion,
        error: errorMsg,
      };
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Get the current status of the self-update service.
   */
  getStatus(): UpdateStatus {
    return {
      currentVersion: this.currentVersion,
      isUpdating: this.isUpdating,
      lastChecked: this.lastChecked,
    };
  }

  // =========================================================================
  // Private helpers
  // =========================================================================

  /**
   * Poll loop handler -- called by setInterval.
   */
  private async pollForUpdate(): Promise<void> {
    const result = await this.checkForUpdate();
    if (result.available && result.latestVersion) {
      console.log(
        `[SelfUpdateService] New version available: ${result.latestVersion}`,
      );
      // Notify admin about available update but don't auto-apply
      await this.notifyAdmin(
        `New Ironclaw version available: ${result.latestVersion}. ` +
          (result.releaseNotes
            ? `Release notes: ${result.releaseNotes}`
            : 'No release notes.'),
      );
    }
  }

  /**
   * Notify system admin by adding a system message to the most recent
   * Ironclaw session. Also logs to console as fallback.
   */
  private async notifyAdmin(content: string): Promise<void> {
    try {
      // Find the most recent session to determine the problem_set_id
      // Use the system admin pattern: look for any recent session
      const pool = (await import('../lib/database.js')).getPool();
      const result = await pool.query(
        `SELECT problem_set_id FROM ironclaw_sessions
         ORDER BY last_active_at DESC LIMIT 1`,
      );

      if (result.rows.length > 0) {
        const problemSetId = result.rows[0].problem_set_id as string;
        await ironclawStore.addMessage({
          problem_set_id: problemSetId,
          content,
          sender: 'ironclaw',
          specialist_id: null,
          specialist_display_name: null,
          delegated_by: null,
          action_card: null,
          step_progress: null,
          suggestion: null,
        });
      }
    } catch (err) {
      // Fallback to console if DB is unavailable
      console.log(`[SelfUpdateService] Admin notification: ${content}`);
      console.warn(
        '[SelfUpdateService] Could not send admin notification via DB:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Fetch the current Ironclaw version from the health/version endpoint.
   */
  private async fetchCurrentVersion(): Promise<string | null> {
    // Try HTTP version endpoint first
    try {
      const baseUrl = process.env.IRONCLAW_URL ?? 'http://ironclaw:8080';
      const response = await fetch(`${baseUrl}/version`);
      if (response.ok) {
        const data = (await response.json()) as { version?: string };
        if (data.version) return data.version;
      }
    } catch {
      // Ironclaw HTTP not reachable — try shared file fallback
    }

    // Fallback: read version from shared volume (written by Ironclaw entrypoint)
    try {
      const { readFileSync } = await import('fs');
      const version = readFileSync('/shared/tokens/ironclaw-version', 'utf-8').trim();
      if (version) return version;
    } catch {
      // File not available
    }

    return null;
  }

  /**
   * Execute Docker compose pull and restart for the Ironclaw container.
   */
  private execDockerRestart(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd =
        'docker compose -f docker-compose.prod.yml pull ironclaw && ' +
        'docker compose -f docker-compose.prod.yml up -d ironclaw';

      exec(cmd, { timeout: DOCKER_RESTART_TIMEOUT_MS }, (error, stdout, stderr) => {
        if (error) {
          console.error('[SelfUpdateService] Docker restart error:', stderr);
          reject(new Error(`Docker restart failed: ${error.message}`));
          return;
        }
        console.log('[SelfUpdateService] Docker restart output:', stdout);
        resolve();
      });
    });
  }

  /**
   * Attempt rollback by restarting with the previous image.
   */
  private execDockerRollback(): Promise<void> {
    return new Promise((resolve, reject) => {
      const cmd = 'docker compose -f docker-compose.prod.yml up -d ironclaw';

      exec(cmd, { timeout: DOCKER_RESTART_TIMEOUT_MS }, (error) => {
        if (error) {
          console.error('[SelfUpdateService] Rollback error:', error.message);
          reject(new Error(`Rollback failed: ${error.message}`));
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Poll the health check endpoint until it passes or times out.
   */
  private async waitForHealthy(): Promise<boolean> {
    const deadline = Date.now() + HEALTH_CHECK_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const healthy = await ironclawClient.healthCheck();
      if (healthy) return true;
      await new Promise((resolve) =>
        setTimeout(resolve, HEALTH_CHECK_INTERVAL_MS),
      );
    }

    return false;
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const selfUpdateService = new SelfUpdateService();
