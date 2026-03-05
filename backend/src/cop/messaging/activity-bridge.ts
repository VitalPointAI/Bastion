/**
 * COP Activity Bridge - Agent Activity to Workspace Feed
 *
 * Phase 21 Plan 02: Forwards COP agent events to the workspace activity feed.
 * Uses an in-memory ring buffer (last 100 per workspace) for now.
 * Actual persistence integration deferred to the API plan.
 *
 * Matches existing ObserverPanel data shape for seamless integration.
 */
import type { COPEventBus, COPEvents } from './event-bus.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  agentId: string;
  action: string;
  detail: string;
  workspaceId: string;
  sectionId: string;
  timestamp: string;
}

// ─── Ring Buffer ─────────────────────────────────────────────────────────────

const MAX_ENTRIES_PER_WORKSPACE = 100;

// ─── Activity Bridge ─────────────────────────────────────────────────────────

/**
 * Bridges COP agent activity events to workspace activity feeds.
 * Subscribes to the event bus 'agent:activity' events and buffers them
 * in a per-workspace ring buffer for retrieval by the API layer.
 */
export class ActivityBridge {
  private buffers: Map<string, ActivityEntry[]> = new Map();

  constructor(bus: COPEventBus) {
    bus.on('agent:activity', (data: COPEvents['agent:activity']) => {
      this.addActivity(data);
    });
  }

  /**
   * Get buffered activities for a workspace.
   *
   * @param workspaceId - Workspace to get activities for
   * @param limit - Maximum number of activities to return (default: all buffered)
   * @returns Array of activity entries, most recent last
   */
  getActivities(workspaceId: string, limit?: number): ActivityEntry[] {
    const buffer = this.buffers.get(workspaceId) ?? [];
    if (limit !== undefined && limit < buffer.length) {
      return buffer.slice(-limit);
    }
    return [...buffer];
  }

  /**
   * Add an activity entry to the workspace ring buffer.
   * Evicts oldest entries when the buffer exceeds MAX_ENTRIES_PER_WORKSPACE.
   */
  private addActivity(data: COPEvents['agent:activity']): void {
    const { workspaceId } = data;

    let buffer = this.buffers.get(workspaceId);
    if (!buffer) {
      buffer = [];
      this.buffers.set(workspaceId, buffer);
    }

    const entry: ActivityEntry = {
      agentId: data.agentId,
      action: data.action,
      detail: data.detail,
      workspaceId: data.workspaceId,
      sectionId: data.sectionId,
      timestamp: data.timestamp,
    };

    buffer.push(entry);

    // Ring buffer: evict oldest entries if over max
    if (buffer.length > MAX_ENTRIES_PER_WORKSPACE) {
      const excess = buffer.length - MAX_ENTRIES_PER_WORKSPACE;
      buffer.splice(0, excess);
    }
  }
}
