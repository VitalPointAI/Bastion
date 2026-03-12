/**
 * DiscoverySubView
 *
 * Phase 42 Plan 03: Combines the BLE/Serial client scanner panel (collapsible)
 * with the DevicePipelineKanban that shows device onboarding state progression
 * in real-time. Devices and scanner status are passed from the hoisted
 * useDiscovery call in ResourcesTab (one hook per Resources tab tree).
 */

import React, { useState } from 'react';
import type { DiscoveredDevice, DiscoveryStatus } from '../../../lib/discovery-service';
import { useResourcesContext } from '../ResourcesContext';
import { ClientDiscoveryPanel } from './ClientDiscoveryPanel';
import { DevicePipelineKanban } from './DevicePipelineKanban';

// ─── Status dot ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  idle: 'bg-gray-400',
  scanning: 'bg-green-400 animate-pulse',
  paused: 'bg-yellow-400',
  unavailable: 'bg-red-400',
};

const STATUS_LABELS: Record<string, string> = {
  idle: 'Idle',
  scanning: 'Scanning',
  paused: 'Paused',
  unavailable: 'Unavailable',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DiscoverySubViewProps {
  devices: DiscoveredDevice[];
  scannerStatus: DiscoveryStatus | null;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DiscoverySubView({ devices, scannerStatus }: DiscoverySubViewProps) {
  const { setSelectedResourceId } = useResourcesContext();
  const [scannerExpanded, setScannerExpanded] = useState(false);

  const statusState = scannerStatus?.state ?? 'unavailable';
  const statusDot = STATUS_COLORS[statusState] ?? 'bg-gray-400';
  const statusLabel = STATUS_LABELS[statusState] ?? statusState;

  const connectedCount = devices.filter((d) => d.state === 'connected').length;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900">

      {/* Scanner section — collapsible, default collapsed */}
      <div className="shrink-0 border-b border-gray-700">
        <button
          className="w-full flex items-center justify-between px-4 py-2 text-sm font-medium text-gray-300 hover:text-gray-100 hover:bg-gray-800 transition-colors"
          onClick={() => setScannerExpanded((prev) => !prev)}
          aria-expanded={scannerExpanded}
        >
          <span className="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.14 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
            Device Scanner
          </span>
          <span className="text-gray-500 text-xs">
            {scannerExpanded ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {scannerExpanded && (
          <div className="px-4 pb-4">
            <ClientDiscoveryPanel />
          </div>
        )}
      </div>

      {/* Pipeline section — main content */}
      <div className="flex-1 overflow-hidden">
        <DevicePipelineKanban
          devices={devices}
          onSelectDevice={setSelectedResourceId}
        />
      </div>

      {/* Status bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-t border-gray-700 bg-gray-850 text-xs text-gray-400">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${statusDot}`} />
          <span>{statusLabel}</span>
          {scannerStatus?.activeScanners && scannerStatus.activeScanners.length > 0 && (
            <span className="text-gray-600">
              ({scannerStatus.activeScanners.join(', ')})
            </span>
          )}
          {scannerStatus?.message && (
            <span className="text-gray-500 italic">{scannerStatus.message}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span>
            <span className="font-medium text-gray-300">{devices.length}</span> total
          </span>
          <span>
            <span className="font-medium text-green-400">{connectedCount}</span> connected
          </span>
        </div>
      </div>
    </div>
  );
}
