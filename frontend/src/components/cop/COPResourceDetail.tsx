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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h4 style={{ margin: 0, fontSize: '0.75rem', color: '#8888a0', textTransform: 'uppercase' }}>
        Last Known Position
      </h4>

      {resource.lat != null && resource.lng != null ? (
        <>
          <DetailRow label="Latitude" value={String(resource.lat)} mono />
          <DetailRow label="Longitude" value={String(resource.lng)} mono />
        </>
      ) : (
        <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>No position data</span>
      )}

      <DetailRow label="Last Update" value={resource.updatedAt ? new Date(resource.updatedAt).toLocaleString() : 'Unknown'} />

      {/* Placeholder for live feed graph */}
      <div style={{
        marginTop: '0.5rem',
        padding: '1.5rem',
        border: '1px dashed rgba(59, 130, 246, 0.3)',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.75rem',
      }}>
        Live telemetry graph placeholder
        <br />
        <span style={{ fontSize: '0.625rem', color: '#4b5563' }}>
          Heading, speed, and position history
        </span>
      </div>
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

      {/* Placeholder for group management actions */}
      <div style={{
        marginTop: '0.5rem',
        padding: '1.5rem',
        border: '1px dashed rgba(139, 92, 246, 0.3)',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#6b7280',
        fontSize: '0.75rem',
      }}>
        Group management actions placeholder
        <br />
        <span style={{ fontSize: '0.625rem', color: '#4b5563' }}>
          Assign, reassign, create group
        </span>
      </div>
    </div>
  );
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
