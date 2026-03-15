/**
 * COPResourceDetail
 *
 * Phase 27 Plan 05: 4-tab detail panel for a selected resource.
 * Shows identity/status, capabilities/specs, telemetry/feeds, and assignment/grouping.
 * Dark theme, compact layout following COPReviewPanel.css patterns.
 */

import { useState, useEffect } from 'react';
import type { RegisteredResource, ResourceGroup } from '../../lib/resource-registry-service.js';
import { resourceRegistryService } from '../../lib/resource-registry-service.js';

// ─── Telemetry types ──────────────────────────────────────────────────────────

interface TelemetrySnapshot {
  position: { x: number; y: number };
  heading: number;
  battery: number;
  speed?: number;
  timestamp?: number;
}

interface RobotInfo {
  robot_id: string;
  did: string;
  capabilities: string[];
  state: string;
  current_mission_id?: string;
  last_heartbeat: number;
  latest_telemetry?: TelemetrySnapshot;
  latest_vision?: {
    timestamp: string;
    detections: Array<{ class_desc: string; confidence: number }>;
    scene_description?: string;
    keyframe_jpeg_b64?: string;
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface COPResourceDetailProps {
  resource: RegisteredResource;
  onClose: () => void;
}

// ─── Tab definitions ─────────────────────────────────────────────────────────

type Tab = 'identity' | 'capabilities' | 'telemetry' | 'grouping';

const TABS: { id: Tab; label: string }[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'telemetry', label: 'Telemetry' },
  { id: 'grouping', label: 'Grouping' },
];

// ─── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  FMC: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', label: 'Fully Mission Capable' },
  PMC: { color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', label: 'Partially Mission Capable' },
  NMC: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Not Mission Capable' },
};

const TRUST_LABELS: Record<string, string> = {
  explicit: 'Explicit Trust',
  vouched: 'Vouched',
  verified: 'Verified',
  autonomous: 'Autonomous',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function COPResourceDetail({ resource, onClose }: COPResourceDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('identity');
  const [group, setGroup] = useState<ResourceGroup | null>(null);

  // Fetch group if resource has groupId
  useEffect(() => {
    if (!resource.groupId || !resource.missionId) return;

    let cancelled = false;

    async function loadGroup() {
      try {
        const groups = await resourceRegistryService.listGroups(resource.missionId);
        const found = groups.find((g) => g.id === resource.groupId);
        if (!cancelled && found) {
          setGroup(found);
        }
      } catch {
        // Group not found, ignore
      }
    }

    loadGroup();
    return () => { cancelled = true; };
  }, [resource.groupId, resource.missionId]);

  const statusCfg = STATUS_CONFIG[resource.status] || {
    color: '#6b7280',
    bg: 'rgba(107, 114, 128, 0.15)',
    label: resource.status,
  };

  return (
    <div style={{
      background: 'var(--bg-secondary, #1a1a24)',
      borderLeft: '1px solid var(--border-subtle, #2a2a38)',
      height: '100%',
      width: '360px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontSize: '0.8125rem',
      color: 'var(--text-primary, #e0e0e8)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '1rem 1.25rem',
        borderBottom: '1px solid var(--border-subtle, #2a2a38)',
      }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
            {resource.name}
          </h3>
          {resource.did && (
            <span style={{
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontSize: '0.6875rem',
              color: 'var(--text-secondary, #8888a0)',
            }}>
              {resource.did.length > 32 ? `${resource.did.slice(0, 16)}...${resource.did.slice(-12)}` : resource.did}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '1.25rem',
            padding: '4px',
            lineHeight: 1,
          }}
          aria-label="Close resource detail"
        >
          x
        </button>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-subtle, #2a2a38)',
        padding: '0 0.5rem',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '0.5rem 0.25rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
              color: activeTab === tab.id ? '#3b82f6' : '#8888a0',
              fontSize: '0.6875rem',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem' }}>
        {activeTab === 'identity' && (
          <IdentityTab resource={resource} statusCfg={statusCfg} />
        )}
        {activeTab === 'capabilities' && (
          <CapabilitiesTab resource={resource} />
        )}
        {activeTab === 'telemetry' && (
          <TelemetryTab resource={resource} />
        )}
        {activeTab === 'grouping' && (
          <GroupingTab resource={resource} group={group} />
        )}
      </div>
    </div>
  );
}

// ─── Identity & Status Tab ───────────────────────────────────────────────────

function IdentityTab({
  resource,
  statusCfg,
}: {
  resource: RegisteredResource;
  statusCfg: { color: string; bg: string; label: string };
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <DetailRow label="Name" value={resource.name} />
      <DetailRow label="Category" value={resource.category} />
      {resource.serialNumber && (
        <DetailRow label="Serial Number" value={resource.serialNumber} mono />
      )}
      {resource.did && (
        <DetailRow label="DID" value={resource.did} mono />
      )}

      {/* Status badge */}
      <div>
        <span style={{ fontSize: '0.6875rem', color: '#8888a0', textTransform: 'uppercase' }}>
          Status
        </span>
        <div style={{
          marginTop: '0.25rem',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.25rem 0.75rem',
          borderRadius: '9999px',
          background: statusCfg.bg,
          color: statusCfg.color,
          fontWeight: 600,
          fontSize: '0.75rem',
        }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: statusCfg.color,
          }} />
          {statusCfg.label}
        </div>
      </div>

      {resource.trustTier && (
        <DetailRow label="Trust Tier" value={TRUST_LABELS[resource.trustTier] || resource.trustTier} />
      )}

      {resource.isAutonomous !== undefined && (
        <div>
          <span style={{ fontSize: '0.6875rem', color: '#8888a0', textTransform: 'uppercase' }}>
            Autonomous
          </span>
          <div style={{ marginTop: '0.25rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '4px',
              background: resource.isAutonomous ? 'rgba(139, 92, 246, 0.15)' : 'rgba(107, 114, 128, 0.15)',
              color: resource.isAutonomous ? '#a78bfa' : '#9ca3af',
              fontSize: '0.75rem',
              fontWeight: 500,
            }}>
              {resource.isAutonomous ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Capabilities & Specs Tab ────────────────────────────────────────────────

function CapabilitiesTab({ resource }: { resource: RegisteredResource }) {
  const capabilities = resource.capabilities ?? [];
  const specs = resource.specifications ?? {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Capabilities */}
      <div>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
          Capabilities
        </h4>
        {capabilities.length === 0 ? (
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>No capabilities listed</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem' }}>
            {capabilities.map((cap) => (
              <span
                key={cap}
                style={{
                  padding: '0.125rem 0.5rem',
                  borderRadius: '9999px',
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                }}
              >
                {cap}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Specifications */}
      <div>
        <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
          Specifications
        </h4>
        {Object.keys(specs).length === 0 ? (
          <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>No specifications</span>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {Object.entries(specs).map(([key, value]) => (
              <div
                key={key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '0.25rem 0',
                  borderBottom: '1px solid rgba(42, 42, 56, 0.5)',
                }}
              >
                <span style={{ color: '#8888a0', fontSize: '0.6875rem' }}>{key}</span>
                <span style={{
                  color: '#e0e0e8',
                  fontSize: '0.6875rem',
                  fontFamily: "'Fira Code', monospace",
                }}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Telemetry & Feeds Tab ───────────────────────────────────────────────────

function TelemetryTab({ resource }: { resource: RegisteredResource }) {
  const [robotInfo, setRobotInfo] = useState<RobotInfo | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetrySnapshot[]>([]);
  const maxHistory = 30; // Keep last 30 readings

  // Poll robot telemetry every 2 seconds if this is an autonomous resource
  useEffect(() => {
    if (!resource.isAutonomous) return;

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch('/api/robot/robots');
        if (!res.ok || cancelled) return;
        const robots = (await res.json()) as RobotInfo[];
        // Match by DID or by name containing the robot ID
        const match = robots.find(r =>
          r.did === resource.did ||
          resource.name?.toLowerCase().includes(r.robot_id.toLowerCase()),
        );
        if (match && !cancelled) {
          setRobotInfo(match);
          if (match.latest_telemetry) {
            setTelemetryHistory(prev => {
              const next = [...prev, { ...match.latest_telemetry!, timestamp: Date.now() }];
              return next.slice(-maxHistory);
            });
          }
        }
      } catch { /* silent */ }
    }

    poll();
    const interval = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [resource.did, resource.name, resource.isAutonomous]);

  const telem = robotInfo?.latest_telemetry;

  // Compute heartbeat age outside JSX to avoid impure Date.now() in render
  const [heartbeatAge, setHeartbeatAge] = useState('');
  useEffect(() => {
    if (!robotInfo?.last_heartbeat) { setHeartbeatAge(''); return; }
    const update = () => setHeartbeatAge(`${Math.round((Date.now() - robotInfo.last_heartbeat) / 1000)}s ago`);
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [robotInfo?.last_heartbeat]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Connection status */}
      {robotInfo && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
          <div style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: robotInfo.state === 'connected' ? '#22c55e' : '#ef4444',
            boxShadow: robotInfo.state === 'connected' ? '0 0 6px #22c55e' : 'none',
          }} />
          <span style={{ fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'capitalize' }}>
            {robotInfo.state}
          </span>
          <span style={{ fontSize: '0.625rem', color: '#4b5563', marginLeft: 'auto' }}>
            {heartbeatAge}
          </span>
        </div>
      )}

      <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
        Position
      </h4>

      {telem ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          <DetailRow label="X" value={telem.position.x.toFixed(2)} mono />
          <DetailRow label="Y" value={telem.position.y.toFixed(2)} mono />
          <DetailRow label="Heading" value={`${telem.heading}°`} mono />
          <div>
            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#8888a0', textTransform: 'uppercase', marginBottom: '0.125rem' }}>
              Battery
            </span>
            <span style={{
              color: telem.battery > 60 ? '#22c55e' : telem.battery > 20 ? '#eab308' : '#ef4444',
              fontSize: '0.8125rem',
              fontFamily: "'Fira Code', 'Courier New', monospace",
              fontWeight: 600,
            }}>
              {telem.battery}%
            </span>
          </div>
        </div>
      ) : resource.lat != null && resource.lng != null ? (
        <>
          <DetailRow label="Latitude" value={String(resource.lat)} mono />
          <DetailRow label="Longitude" value={String(resource.lng)} mono />
        </>
      ) : (
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>No position data</span>
      )}

      <DetailRow label="Last Update" value={resource.updatedAt ? new Date(resource.updatedAt).toLocaleString() : 'Unknown'} />

      {/* Telemetry history sparkline */}
      {telemetryHistory.length > 1 && (
        <div>
          <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase', marginBottom: '6px' }}>
            Battery History
          </h4>
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '2px',
            height: '40px', padding: '4px',
            background: 'rgba(31, 41, 55, 0.5)',
            borderRadius: '4px',
            border: '1px solid #374151',
          }}>
            {telemetryHistory.map((t, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${Math.max(2, t.battery * 0.4)}px`,
                  background: t.battery > 60 ? '#22c55e' : t.battery > 20 ? '#eab308' : '#ef4444',
                  borderRadius: '1px',
                  opacity: 0.4 + (i / telemetryHistory.length) * 0.6,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Vision feed (if robot) */}
      {robotInfo?.latest_vision && (
        <div>
          <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase', marginBottom: '6px' }}>
            Vision Feed
          </h4>
          {robotInfo.latest_vision.keyframe_jpeg_b64 && (
            <div style={{ borderRadius: '4px', overflow: 'hidden', border: '1px solid #374151', marginBottom: '6px' }}>
              <img
                src={`data:image/jpeg;base64,${robotInfo.latest_vision.keyframe_jpeg_b64}`}
                alt="Camera feed"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            </div>
          )}
          {robotInfo.latest_vision.scene_description && (
            <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontStyle: 'italic', marginBottom: '4px' }}>
              {robotInfo.latest_vision.scene_description}
            </div>
          )}
          {robotInfo.latest_vision.detections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {robotInfo.latest_vision.detections.map((det, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '0.6875rem', padding: '3px 6px',
                  background: 'rgba(31, 41, 55, 0.6)',
                  borderRadius: '3px', border: '1px solid #374151',
                }}>
                  <span style={{ color: '#e5e7eb' }}>{det.class_desc}</span>
                  <span style={{ color: det.confidence >= 0.8 ? '#22c55e' : det.confidence >= 0.5 ? '#eab308' : '#ef4444' }}>
                    {(det.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Current mission (if robot) */}
      {robotInfo?.current_mission_id && (
        <div>
          <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
            Active Mission
          </h4>
          <span style={{ fontSize: '0.75rem', color: '#d1d5db', fontFamily: "'Fira Code', monospace" }}>
            {robotInfo.current_mission_id.slice(0, 12)}...
          </span>
        </div>
      )}

      {/* Manual Control D-pad */}
      {robotInfo && <ManualControlPad robotId={robotInfo.robot_id} />}

      {!robotInfo && (
        <div style={{
          marginTop: '0.5rem',
          padding: '1rem',
          border: '1px dashed rgba(107, 114, 128, 0.3)',
          borderRadius: '8px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '0.75rem',
        }}>
          No live telemetry — resource not connected as a robot
        </div>
      )}
    </div>
  );
}

// ─── Assignment & Grouping Tab ───────────────────────────────────────────────

function GroupingTab({
  resource,
  group,
}: {
  resource: RegisteredResource;
  group: ResourceGroup | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
        Group Assignment
      </h4>

      {group ? (
        <>
          <DetailRow label="Group Name" value={group.name} />
          <DetailRow label="Group Type" value={group.groupType} />
          <DetailRow label="Member Count" value={String(group.memberCount)} />

          {/* Aggregate capabilities */}
          <div>
            <span style={{ fontSize: '0.6875rem', color: '#8888a0', textTransform: 'uppercase' }}>
              Group Capabilities
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
              {group.aggregateCapabilities.map((cap) => (
                <span
                  key={cap}
                  style={{
                    padding: '0.125rem 0.5rem',
                    borderRadius: '9999px',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#c4b5fd',
                    fontSize: '0.6875rem',
                    fontWeight: 500,
                  }}
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : resource.groupId ? (
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Loading group data...</span>
      ) : (
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>Not assigned to a group</span>
      )}

      {/* Group management actions */}
      <GroupActions resource={resource} group={group} />
    </div>
  );
}

// ─── Group Management Actions ────────────────────────────────────────────────

function GroupActions({
  resource,
  group,
}: {
  resource: RegisteredResource;
  group: ResourceGroup | null;
}) {
  const [availableGroups, setAvailableGroups] = useState<ResourceGroup[]>([]);
  const [assigning, setAssigning] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupType, setNewGroupType] = useState<'task_force' | 'support' | 'reserve' | 'custom'>('task_force');
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!resource.missionId) return;
    resourceRegistryService.listGroups(resource.missionId)
      .then(setAvailableGroups)
      .catch(() => { /* silent */ });
  }, [resource.missionId]);

  const handleAssign = async (groupId: string) => {
    setAssigning(true);
    setMessage(null);
    try {
      await resourceRegistryService.addToGroup(groupId, resource.id);
      setMessage('Assigned to group');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to assign');
    } finally {
      setAssigning(false);
    }
  };

  const handleRemoveFromGroup = async () => {
    if (!resource.groupId) return;
    setAssigning(true);
    setMessage(null);
    try {
      await resourceRegistryService.removeFromGroup(resource.groupId, resource.id);
      setMessage('Removed from group');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to remove');
    } finally {
      setAssigning(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || !resource.missionId) return;
    setCreating(true);
    setMessage(null);
    try {
      const created = await resourceRegistryService.createGroup({
        missionId: resource.missionId,
        name: newGroupName.trim(),
        groupType: newGroupType,
      });
      setAvailableGroups(prev => [...prev, created]);
      setNewGroupName('');
      setShowCreate(false);
      setMessage(`Created "${created.name}"`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const btnStyle = {
    padding: '0.375rem 0.75rem',
    borderRadius: '4px',
    border: '1px solid #374151',
    background: 'rgba(59, 130, 246, 0.15)',
    color: '#93c5fd',
    fontSize: '0.6875rem',
    cursor: 'pointer',
    fontWeight: 500 as const,
  };

  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {message && (
        <div style={{
          padding: '0.375rem 0.75rem',
          borderRadius: '4px',
          background: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          color: '#86efac',
          fontSize: '0.6875rem',
        }}>
          {message}
        </div>
      )}

      {/* Remove from current group */}
      {group && (
        <button
          onClick={handleRemoveFromGroup}
          disabled={assigning}
          style={{ ...btnStyle, background: 'rgba(239, 68, 68, 0.15)', color: '#fca5a5', borderColor: '#7f1d1d' }}
        >
          {assigning ? 'Removing...' : `Remove from ${group.name}`}
        </button>
      )}

      {/* Assign to existing group */}
      {availableGroups.filter(g => g.id !== resource.groupId).length > 0 && (
        <div>
          <span style={{ fontSize: '0.6875rem', color: '#8888a0', textTransform: 'uppercase', display: 'block', marginBottom: '0.25rem' }}>
            Assign to Group
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {availableGroups.filter(g => g.id !== resource.groupId).map(g => (
              <button
                key={g.id}
                onClick={() => handleAssign(g.id)}
                disabled={assigning}
                style={btnStyle}
              >
                {g.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Create new group */}
      {showCreate ? (
        <div style={{
          padding: '0.5rem',
          background: 'rgba(31, 41, 55, 0.5)',
          borderRadius: '6px',
          border: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.375rem',
        }}>
          <input
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            placeholder="Group name"
            style={{
              background: '#1a1a24',
              border: '1px solid #374151',
              borderRadius: '4px',
              padding: '0.375rem 0.5rem',
              color: '#e0e0e8',
              fontSize: '0.75rem',
            }}
          />
          <select
            value={newGroupType}
            onChange={e => setNewGroupType(e.target.value as 'task_force' | 'support' | 'reserve' | 'custom')}
            style={{
              background: '#1a1a24',
              border: '1px solid #374151',
              borderRadius: '4px',
              padding: '0.375rem 0.5rem',
              color: '#e0e0e8',
              fontSize: '0.75rem',
            }}
          >
            <option value="task_force">Task Force</option>
            <option value="support">Support</option>
            <option value="reserve">Reserve</option>
            <option value="custom">Custom</option>
          </select>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button onClick={handleCreateGroup} disabled={creating || !newGroupName.trim()} style={btnStyle}>
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button onClick={() => setShowCreate(false)} style={{ ...btnStyle, background: 'transparent', color: '#6b7280' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowCreate(true)} style={{ ...btnStyle, background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
          + Create New Group
        </button>
      )}
    </div>
  );
}

// ─── Manual Control D-pad ────────────────────────────────────────────────────

function ManualControlPad({ robotId }: { robotId: string }) {
  const [speed, setSpeed] = useState(100);
  const [duration, setDuration] = useState(1.0);
  const [sending, setSending] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  async function nudge(heading: number, label: string) {
    setSending(true);
    setLastAction(label);
    try {
      await fetch(`/api/robot/robots/${robotId}/nudge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heading, speed, duration_sec: duration }),
      });
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  async function stopRobot() {
    setSending(true);
    setLastAction('STOP');
    try {
      await fetch(`/api/robot/robots/${robotId}/stop`, { method: 'POST' });
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  const arrowBtn: Record<string, string | number> = {
    width: '36px',
    height: '36px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#93c5fd',
    fontSize: '1rem',
    cursor: sending ? 'not-allowed' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: sending ? 0.5 : 1,
    transition: 'background 0.15s',
  };

  const sliderLabel: Record<string, string> = {
    fontSize: '0.5625rem',
    color: '#6b7280',
    textTransform: 'uppercase',
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
        Manual Control
      </h4>

      {/* D-pad grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '36px 36px 36px',
        gridTemplateRows: '36px 36px 36px',
        gap: '4px',
        justifyContent: 'center',
        marginBottom: '0.5rem',
      }}>
        <div /> {/* top-left empty */}
        <button style={arrowBtn} onClick={() => nudge(0, 'N')} disabled={sending} title="North">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 2L12 10H2Z" fill="currentColor"/></svg>
        </button>
        <div /> {/* top-right empty */}

        <button style={arrowBtn} onClick={() => nudge(270, 'W')} disabled={sending} title="West">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M2 7L10 2V12Z" fill="currentColor"/></svg>
        </button>
        <button
          style={{ ...arrowBtn, background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.5625rem', fontWeight: 700 }}
          onClick={stopRobot}
          disabled={sending}
          title="Emergency Stop"
        >
          STOP
        </button>
        <button style={arrowBtn} onClick={() => nudge(90, 'E')} disabled={sending} title="East">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M12 7L4 2V12Z" fill="currentColor"/></svg>
        </button>

        <div /> {/* bottom-left empty */}
        <button style={arrowBtn} onClick={() => nudge(180, 'S')} disabled={sending} title="South">
          <svg width="14" height="14" viewBox="0 0 14 14"><path d="M7 12L2 4H12Z" fill="currentColor"/></svg>
        </button>
        <div /> {/* bottom-right empty */}
      </div>

      {/* Speed + duration sliders */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.375rem' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...sliderLabel }}>
            <span>Speed</span>
            <span>{speed}</span>
          </div>
          <input
            type="range"
            min={10}
            max={255}
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', height: '4px' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', ...sliderLabel }}>
            <span>Duration</span>
            <span>{duration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            min={0.2}
            max={5}
            step={0.1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: '100%', accentColor: '#3b82f6', height: '4px' }}
          />
        </div>
      </div>

      {lastAction && (
        <div style={{ fontSize: '0.5625rem', color: '#4b5563', textAlign: 'center' }}>
          Last: {lastAction} @ speed {speed}, {duration.toFixed(1)}s
        </div>
      )}
    </div>
  );
}

// ─── Battery Sparkline ───────────────────────────────────────────────────────

function BatterySparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const w = 280;
  const h = 32;
  const pad = 2;
  const minVal = Math.max(0, Math.min(...data) - 5);
  const maxVal = Math.min(100, Math.max(...data) + 5);
  const range = maxVal - minVal || 1;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((v - minVal) / range) * (h - 2 * pad);
    return `${x},${y}`;
  });

  const lastVal = data[data.length - 1];
  const color = batteryColor(lastVal);

  return (
    <svg width={w} height={h} style={{ display: 'block', marginTop: '0.25rem' }}>
      <defs>
        <linearGradient id="battGradDetail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <polygon
        points={`${pad},${h - pad} ${points.join(' ')} ${w - pad},${h - pad}`}
        fill="url(#battGradDetail)"
      />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {(() => {
        const parts = points[points.length - 1].split(',');
        return <circle cx={parts[0]} cy={parts[1]} r="2.5" fill={color} />;
      })()}
    </svg>
  );
}

// ─── Compass Indicator ───────────────────────────────────────────────────────

function CompassIndicator({ heading, size = 40 }: { heading: number; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const rad = (heading - 90) * (Math.PI / 180);
  const needleLen = size * 0.34;
  const nx = cx + Math.cos(rad) * needleLen;
  const ny = cy + Math.sin(rad) * needleLen;

  return (
    <svg width={size} height={size} style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={size * 0.44} fill="none" stroke="#374151" strokeWidth="1" />
      <text x={cx} y={size * 0.18} textAnchor="middle" fill="#6b7280" fontSize={size * 0.16} fontFamily="monospace">N</text>
      <text x={size - 2} y={cy + 2} textAnchor="end" fill="#4b5563" fontSize={size * 0.14} fontFamily="monospace">E</text>
      <text x={cx} y={size - 1} textAnchor="middle" fill="#4b5563" fontSize={size * 0.14} fontFamily="monospace">S</text>
      <text x={3} y={cy + 2} textAnchor="start" fill="#4b5563" fontSize={size * 0.14} fontFamily="monospace">W</text>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={size * 0.06} fill="#3b82f6" />
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ─── Shared detail row ───────────────────────────────────────────────────────

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <span style={{
        display: 'block',
        fontSize: '0.6875rem',
        color: '#8888a0',
        textTransform: 'uppercase',
        marginBottom: '0.125rem',
      }}>
        {label}
      </span>
      <span style={{
        color: '#e0e0e8',
        fontSize: '0.8125rem',
        fontFamily: mono ? "'Fira Code', 'Courier New', monospace" : 'inherit',
        wordBreak: 'break-all',
      }}>
        {value}
      </span>
    </div>
  );
}
