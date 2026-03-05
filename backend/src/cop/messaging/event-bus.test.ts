/**
 * COP Messaging Infrastructure Tests
 *
 * Phase 21 Plan 02 Task 1: Event bus, trigger handler, activity bridge
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { COPEventBus, copEventBus } from './event-bus.js';
import { TriggerHandler } from './trigger-handler.js';
import { ActivityBridge } from './activity-bridge.js';

// ─── Event Bus Tests ─────────────────────────────────────────────────────────

describe('COPEventBus', () => {
  let bus: COPEventBus;

  beforeEach(() => {
    bus = new COPEventBus();
  });

  it('delivers agent:activity events to registered handlers', () => {
    const handler = vi.fn();
    bus.on('agent:activity', handler);

    const data = {
      agentId: 'cop-coordinator-001',
      action: 'route_request',
      detail: 'Routing layer generation to J3 lead',
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      timestamp: new Date().toISOString(),
    };

    bus.emit('agent:activity', data);
    expect(handler).toHaveBeenCalledWith(data);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('supports all COP event types', () => {
    const handlers = {
      'document:committed': vi.fn(),
      'layer:generation:start': vi.fn(),
      'layer:generation:complete': vi.fn(),
      'layer:state:transition': vi.fn(),
      'agent:activity': vi.fn(),
      'conflict:detected': vi.fn(),
      'linkage:discovered': vi.fn(),
    };

    // Register all handlers
    (Object.keys(handlers) as Array<keyof typeof handlers>).forEach((event) => {
      bus.on(event, handlers[event]);
    });

    // Emit each event type
    bus.emit('document:committed', { workspaceId: 'ws-1', sectionId: 'sec-1', documentId: 'doc-1' });
    bus.emit('layer:generation:start', { workspaceId: 'ws-1', sectionId: 'sec-1', triggeredBy: 'commit' });
    bus.emit('layer:generation:complete', { layerId: 'layer-1', status: 'success' });
    bus.emit('layer:state:transition', { layerId: 'layer-1', from: 'draft', to: 'review', by: 'user-1' });
    bus.emit('agent:activity', {
      agentId: 'agent-1', action: 'test', detail: 'test',
      workspaceId: 'ws-1', sectionId: 'sec-1', timestamp: new Date().toISOString(),
    });
    bus.emit('conflict:detected', { layerId: 'layer-1', conflictingLayerId: 'layer-2', entities: ['ent-1'] });
    bus.emit('linkage:discovered', { entityId: 'ent-1', linkedEntityId: 'ent-2', confidence: 0.9, autoCommitted: true });

    // Verify all handlers received events
    Object.values(handlers).forEach((handler) => {
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  it('removes handlers with off()', () => {
    const handler = vi.fn();
    bus.on('agent:activity', handler);
    bus.off('agent:activity', handler);

    bus.emit('agent:activity', {
      agentId: 'a', action: 'b', detail: 'c',
      workspaceId: 'w', sectionId: 's', timestamp: '',
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('exports a singleton copEventBus instance', () => {
    expect(copEventBus).toBeInstanceOf(COPEventBus);
  });
});

// ─── Trigger Handler Tests ───────────────────────────────────────────────────

describe('TriggerHandler', () => {
  let bus: COPEventBus;
  let handler: TriggerHandler;

  beforeEach(() => {
    bus = new COPEventBus();
    handler = new TriggerHandler(bus);
    vi.useFakeTimers();
  });

  afterEach(() => {
    handler.stopAllPolling();
    vi.useRealTimers();
  });

  it('handleCommitTrigger emits document:committed then layer:generation:start', () => {
    const committedHandler = vi.fn();
    const startHandler = vi.fn();
    const callOrder: string[] = [];

    bus.on('document:committed', () => { callOrder.push('committed'); committedHandler(); });
    bus.on('layer:generation:start', () => { callOrder.push('start'); startHandler(); });

    handler.handleCommitTrigger('ws-1', 'sec-1', 'doc-1');

    expect(committedHandler).toHaveBeenCalledTimes(1);
    expect(startHandler).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['committed', 'start']);
  });

  it('handleCommitTrigger emits layer:generation:start with triggeredBy=commit', () => {
    const startHandler = vi.fn();
    bus.on('layer:generation:start', startHandler);

    handler.handleCommitTrigger('ws-1', 'sec-1', 'doc-1');

    expect(startHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        sectionId: 'sec-1',
        triggeredBy: 'commit',
      }),
    );
  });

  it('handleManualTrigger emits layer:generation:start with triggeredBy=manual', () => {
    const startHandler = vi.fn();
    bus.on('layer:generation:start', startHandler);

    handler.handleManualTrigger('ws-1', 'sec-1');

    expect(startHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        sectionId: 'sec-1',
        triggeredBy: 'manual',
      }),
    );
  });

  it('startPolling sets up interval that emits on first poll', () => {
    const startHandler = vi.fn();
    bus.on('layer:generation:start', startHandler);

    handler.startPolling('ws-1', 'sec-1', 1000);
    vi.advanceTimersByTime(1000);

    expect(startHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        sectionId: 'sec-1',
        triggeredBy: 'polling',
      }),
    );
  });

  it('stopPolling clears the interval', () => {
    const startHandler = vi.fn();
    bus.on('layer:generation:start', startHandler);

    handler.startPolling('ws-1', 'sec-1', 1000);
    handler.stopPolling('ws-1', 'sec-1');
    vi.advanceTimersByTime(5000);

    expect(startHandler).not.toHaveBeenCalled();
  });
});

// ─── Activity Bridge Tests ───────────────────────────────────────────────────

describe('ActivityBridge', () => {
  let bus: COPEventBus;
  let bridge: ActivityBridge;

  beforeEach(() => {
    bus = new COPEventBus();
    bridge = new ActivityBridge(bus);
  });

  it('captures agent:activity events in the buffer', () => {
    bus.emit('agent:activity', {
      agentId: 'cop-coordinator-001',
      action: 'route_request',
      detail: 'Routing to J3',
      workspaceId: 'ws-1',
      sectionId: 'sec-1',
      timestamp: new Date().toISOString(),
    });

    const activities = bridge.getActivities('ws-1');
    expect(activities).toHaveLength(1);
    expect(activities[0]).toMatchObject({
      agentId: 'cop-coordinator-001',
      action: 'route_request',
    });
  });

  it('returns activities filtered by workspace', () => {
    bus.emit('agent:activity', {
      agentId: 'a1', action: 'act1', detail: 'd1',
      workspaceId: 'ws-1', sectionId: 'sec-1', timestamp: '',
    });
    bus.emit('agent:activity', {
      agentId: 'a2', action: 'act2', detail: 'd2',
      workspaceId: 'ws-2', sectionId: 'sec-1', timestamp: '',
    });

    expect(bridge.getActivities('ws-1')).toHaveLength(1);
    expect(bridge.getActivities('ws-2')).toHaveLength(1);
  });

  it('respects the limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      bus.emit('agent:activity', {
        agentId: `a${i}`, action: `act${i}`, detail: `d${i}`,
        workspaceId: 'ws-1', sectionId: 'sec-1', timestamp: '',
      });
    }

    const activities = bridge.getActivities('ws-1', 3);
    expect(activities).toHaveLength(3);
  });

  it('maintains a ring buffer of max 100 per workspace', () => {
    for (let i = 0; i < 120; i++) {
      bus.emit('agent:activity', {
        agentId: `a${i}`, action: `act${i}`, detail: `d${i}`,
        workspaceId: 'ws-1', sectionId: 'sec-1', timestamp: '',
      });
    }

    const activities = bridge.getActivities('ws-1');
    expect(activities).toHaveLength(100);
    // Should have the latest entries, not the oldest
    expect(activities[activities.length - 1].agentId).toBe('a119');
  });
});
