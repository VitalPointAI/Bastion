/**
 * COP Event Bus - Typed EventEmitter for Agent Coordination
 *
 * Phase 21 Plan 02: Nervous system of the COP agent team.
 * In-process EventEmitter with full type safety for all COP event types.
 * Interface can be swapped to BullMQ later if horizontal scaling is needed.
 */
import { EventEmitter } from 'events';

// ─── Layer State Type ────────────────────────────────────────────────────────

export type LayerState = 'draft' | 'review' | 'published' | 'cop';

// ─── COP Event Payload Types ────────────────────────────────────────────────

export interface COPEvents {
  'document:committed': {
    workspaceId: string;
    sectionId: string;
    documentId: string;
  };
  'layer:generation:start': {
    workspaceId: string;
    sectionId: string;
    triggeredBy: 'commit' | 'manual' | 'polling';
  };
  'layer:generation:complete': {
    layerId: string;
    status: 'success' | 'error';
    error?: string;
  };
  'layer:state:transition': {
    layerId: string;
    from: LayerState;
    to: LayerState;
    by: string;
  };
  'agent:activity': {
    agentId: string;
    action: string;
    detail: string;
    workspaceId: string;
    sectionId: string;
    timestamp: string;
  };
  'conflict:detected': {
    layerId: string;
    conflictingLayerId: string;
    entities: string[];
  };
  'linkage:discovered': {
    entityId: string;
    linkedEntityId: string;
    confidence: number;
    autoCommitted: boolean;
  };
}

// ─── Typed Event Bus ─────────────────────────────────────────────────────────

/**
 * Type-safe event bus wrapping Node.js EventEmitter for COP coordination.
 * All event names and payloads are enforced at compile time via COPEvents interface.
 */
export class COPEventBus {
  private emitter = new EventEmitter();

  /**
   * Register a typed event handler.
   */
  on<K extends keyof COPEvents>(
    event: K,
    handler: (data: COPEvents[K]) => void,
  ): void {
    this.emitter.on(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Emit a typed event with payload.
   */
  emit<K extends keyof COPEvents>(event: K, data: COPEvents[K]): void {
    this.emitter.emit(event, data);
  }

  /**
   * Remove a typed event handler.
   */
  off<K extends keyof COPEvents>(
    event: K,
    handler: (data: COPEvents[K]) => void,
  ): void {
    this.emitter.off(event, handler as (...args: unknown[]) => void);
  }

  /**
   * Remove all listeners for a specific event, or all events if no event specified.
   */
  removeAllListeners(event?: keyof COPEvents): void {
    if (event) {
      this.emitter.removeAllListeners(event);
    } else {
      this.emitter.removeAllListeners();
    }
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

/** Global COP event bus singleton for cross-module coordination. */
export const copEventBus = new COPEventBus();
