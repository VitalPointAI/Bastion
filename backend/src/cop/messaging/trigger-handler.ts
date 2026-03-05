/**
 * COP Trigger Handler - Triple Trigger Model
 *
 * Phase 21 Plan 02: Initiates layer generation via three trigger types:
 * 1. Document commit (primary) - fires when staff commits document changes
 * 2. Manual trigger (staff-initiated) - explicit layer generation request
 * 3. Periodic polling (autonomous) - for sensor data and AI team outputs
 *
 * Polling intervals per RESEARCH.md discretion:
 * - Normal: 60s between polls during inactivity
 * - Active (recent commit within 5 min): 15s
 * - Deep idle (no activity for 1 hour): 300s
 */
import type { COPEventBus } from './event-bus.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TriggerType = 'commit' | 'manual' | 'polling';

export interface PollingConfig {
  /** Normal polling interval in ms (default: 60000) */
  normalIntervalMs: number;
  /** Active polling interval in ms (default: 15000) */
  activeIntervalMs: number;
  /** Deep idle polling interval in ms (default: 300000) */
  deepIdleIntervalMs: number;
}

const DEFAULT_POLLING_CONFIG: PollingConfig = {
  normalIntervalMs: 60_000,
  activeIntervalMs: 15_000,
  deepIdleIntervalMs: 300_000,
};

// ─── Trigger Handler ─────────────────────────────────────────────────────────

/**
 * Manages the triple trigger model for COP layer generation.
 * Each trigger type ultimately emits 'layer:generation:start' on the event bus.
 */
export class TriggerHandler {
  private bus: COPEventBus;
  private pollIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lastChecked: Map<string, number> = new Map();
  private pollingConfig: PollingConfig;

  constructor(bus: COPEventBus, config?: Partial<PollingConfig>) {
    this.bus = bus;
    this.pollingConfig = { ...DEFAULT_POLLING_CONFIG, ...config };
  }

  /**
   * Handle a document commit event.
   * Emits document:committed followed by layer:generation:start with triggeredBy='commit'.
   */
  handleCommitTrigger(
    workspaceId: string,
    sectionId: string,
    documentId: string,
  ): void {
    this.bus.emit('document:committed', {
      workspaceId,
      sectionId,
      documentId,
    });

    this.bus.emit('layer:generation:start', {
      workspaceId,
      sectionId,
      triggeredBy: 'commit',
    });
  }

  /**
   * Handle a manual trigger from staff.
   * Emits layer:generation:start with triggeredBy='manual'.
   */
  handleManualTrigger(workspaceId: string, sectionId: string): void {
    this.bus.emit('layer:generation:start', {
      workspaceId,
      sectionId,
      triggeredBy: 'manual',
    });
  }

  /**
   * Start periodic polling for a workspace section.
   * On first poll, always triggers (no previous state to compare).
   * Subsequent polls check lastChecked timestamp.
   *
   * @param workspaceId - Workspace to poll
   * @param sectionId - Section to poll
   * @param intervalMs - Poll interval in milliseconds (default: normal interval)
   */
  startPolling(
    workspaceId: string,
    sectionId: string,
    intervalMs?: number,
  ): void {
    const key = `${workspaceId}:${sectionId}`;

    // Clear existing interval if any
    this.stopPolling(workspaceId, sectionId);

    const interval = intervalMs ?? this.pollingConfig.normalIntervalMs;

    const handle = setInterval(() => {
      const lastCheck = this.lastChecked.get(key);

      // First poll or changes detected (stub: always trigger on first poll)
      if (!lastCheck || this.hasChanges(workspaceId, sectionId, lastCheck)) {
        this.lastChecked.set(key, Date.now());
        this.bus.emit('layer:generation:start', {
          workspaceId,
          sectionId,
          triggeredBy: 'polling',
        });
      }
    }, interval);

    this.pollIntervals.set(key, handle);
  }

  /**
   * Stop polling for a workspace section.
   */
  stopPolling(workspaceId: string, sectionId: string): void {
    const key = `${workspaceId}:${sectionId}`;
    const handle = this.pollIntervals.get(key);
    if (handle) {
      clearInterval(handle);
      this.pollIntervals.delete(key);
    }
  }

  /**
   * Stop all active polling intervals.
   */
  stopAllPolling(): void {
    for (const handle of this.pollIntervals.values()) {
      clearInterval(handle);
    }
    this.pollIntervals.clear();
  }

  /**
   * Stub: Check for changes since last check.
   * In production, this would query the database for document commits
   * or sensor data updates since lastCheckedAt.
   * For now, always returns true on first poll.
   */
  private hasChanges(
    _workspaceId: string,
    _sectionId: string,
    _lastCheckedAt: number,
  ): boolean {
    // Stub: always returns false after first poll (first poll has no lastCheck)
    return false;
  }
}
