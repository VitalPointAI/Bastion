/**
 * DevicePipelineKanban
 *
 * Phase 42 Plan 03: Kanban-style view of the device onboarding state machine.
 * Maps 12 DeviceState values to 6 display columns so operators can see at a
 * glance where every discovered device is in the pipeline.
 *
 * Column → States mapping:
 *   Discovered     → discovered, fingerprinting
 *   Authenticating → authenticating, gate_check, ironclaw_analysis, pending_dao
 *   Onboarding     → onboarding
 *   Connected      → connected
 *   Offline        → disconnected
 *   Rejected       → rejected, revoked, quarantined
 */

import React from 'react';
import type { DiscoveredDevice } from '../../../lib/discovery-service';
import { DeviceState } from '../../../lib/discovery-service';

// ─── Column definitions ───────────────────────────────────────────────────────

interface PipelineColumn {
  id: string;
  label: string;
  states: (typeof DeviceState)[keyof typeof DeviceState][];
  borderColor: string;
  badgeColor: string;
}

const PIPELINE_COLUMNS: PipelineColumn[] = [
  {
    id: 'discovered',
    label: 'Discovered',
    states: [DeviceState.discovered, DeviceState.fingerprinting],
    borderColor: 'border-blue-500',
    badgeColor: 'bg-blue-500/20 text-blue-300',
  },
  {
    id: 'authenticating',
    label: 'Authenticating',
    states: [
      DeviceState.authenticating,
      DeviceState.gate_check,
      DeviceState.ironclaw_analysis,
      DeviceState.pending_dao,
    ],
    borderColor: 'border-yellow-500',
    badgeColor: 'bg-yellow-500/20 text-yellow-300',
  },
  {
    id: 'onboarding',
    label: 'Onboarding',
    states: [DeviceState.onboarding],
    borderColor: 'border-purple-500',
    badgeColor: 'bg-purple-500/20 text-purple-300',
  },
  {
    id: 'connected',
    label: 'Connected',
    states: [DeviceState.connected],
    borderColor: 'border-green-500',
    badgeColor: 'bg-green-500/20 text-green-300',
  },
  {
    id: 'offline',
    label: 'Offline',
    states: [DeviceState.disconnected],
    borderColor: 'border-gray-500',
    badgeColor: 'bg-gray-500/20 text-gray-400',
  },
  {
    id: 'rejected',
    label: 'Rejected',
    states: [DeviceState.rejected, DeviceState.revoked, DeviceState.quarantined],
    borderColor: 'border-red-500',
    badgeColor: 'bg-red-500/20 text-red-300',
  },
];

// ─── State label helpers ──────────────────────────────────────────────────────

const STATE_LABELS: Partial<Record<string, string>> = {
  discovered: 'Discovered',
  fingerprinting: 'Fingerprinting',
  authenticating: 'Authenticating',
  gate_check: 'Gate Check',
  ironclaw_analysis: 'IronClaw',
  pending_dao: 'Pending DAO',
  onboarding: 'Onboarding',
  connected: 'Connected',
  disconnected: 'Offline',
  quarantined: 'Quarantined',
  rejected: 'Rejected',
  revoked: 'Revoked',
};

const STATE_BADGE_COLORS: Partial<Record<string, string>> = {
  discovered: 'bg-blue-600 text-blue-100',
  fingerprinting: 'bg-blue-700 text-blue-100',
  authenticating: 'bg-yellow-600 text-yellow-100',
  gate_check: 'bg-yellow-700 text-yellow-100',
  ironclaw_analysis: 'bg-orange-600 text-orange-100',
  pending_dao: 'bg-amber-600 text-amber-100',
  onboarding: 'bg-purple-600 text-purple-100',
  connected: 'bg-green-600 text-green-100',
  disconnected: 'bg-gray-600 text-gray-100',
  quarantined: 'bg-red-700 text-red-100',
  rejected: 'bg-red-600 text-red-100',
  revoked: 'bg-rose-600 text-rose-100',
};

// ─── RSSI signal indicator ────────────────────────────────────────────────────

function SignalIndicator({ rssi }: { rssi: number }) {
  const bars = rssi >= -60 ? 4 : rssi >= -70 ? 3 : rssi >= -80 ? 2 : 1;
  return (
    <span className="flex items-end gap-px" title={`${rssi} dBm`}>
      {[1, 2, 3, 4].map((b) => (
        <span
          key={b}
          className={[
            'w-1 rounded-sm',
            b <= bars ? 'bg-green-400' : 'bg-gray-600',
          ].join(' ')}
          style={{ height: `${b * 3}px` }}
        />
      ))}
    </span>
  );
}

// ─── Device card ─────────────────────────────────────────────────────────────

interface DeviceCardProps {
  device: DiscoveredDevice;
  onSelect: (deviceId: string) => void;
}

function DeviceCard({ device, onSelect }: DeviceCardProps) {
  const displayName =
    device.fingerprint?.displayName ?? device.fingerprint?.model ?? device.rawIdentifier;
  const deviceType = device.transportType.toUpperCase();
  const stateLabel = STATE_LABELS[device.state] ?? device.state;
  const stateBadge = STATE_BADGE_COLORS[device.state] ?? 'bg-gray-600 text-gray-100';

  return (
    <div
      className="bg-gray-800 border border-gray-700 rounded px-3 py-2 cursor-pointer hover:border-gray-500 hover:bg-gray-750 transition-colors"
      onClick={() => onSelect(device.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(device.id)}
      aria-label={`Select device ${displayName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-100 truncate">{displayName}</p>
          <p className="text-xs text-gray-400">{deviceType}</p>
        </div>
        {device.signalStrength !== undefined && (
          <SignalIndicator rssi={device.signalStrength} />
        )}
      </div>
      <div className="mt-1.5">
        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${stateBadge}`}>
          {stateLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DevicePipelineKanbanProps {
  devices: DiscoveredDevice[];
  onSelectDevice: (deviceId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DevicePipelineKanban({ devices, onSelectDevice }: DevicePipelineKanbanProps) {
  const grouped = PIPELINE_COLUMNS.map((col) => ({
    ...col,
    devices: devices.filter((d) => col.states.includes(d.state)),
  }));

  return (
    <div className="flex gap-3 h-full overflow-x-auto px-1 py-2">
      {grouped.map((col) => (
        <div
          key={col.id}
          className={`flex flex-col flex-shrink-0 w-52 bg-gray-900 rounded-lg border-t-4 ${col.borderColor} border-x border-b border-gray-700`}
        >
          {/* Column header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
            <span className="text-xs font-semibold text-gray-200 uppercase tracking-wider">
              {col.label}
            </span>
            <span
              className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${col.badgeColor}`}
            >
              {col.devices.length}
            </span>
          </div>

          {/* Device cards */}
          <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-96">
            {col.devices.length === 0 ? (
              <div className="border border-dashed border-gray-700 rounded px-3 py-4 text-center">
                <p className="text-xs text-gray-600">No devices</p>
              </div>
            ) : (
              col.devices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onSelect={onSelectDevice}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
