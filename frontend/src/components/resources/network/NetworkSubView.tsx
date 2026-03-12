/**
 * NetworkSubView
 *
 * Phase 42 Plan 04: Composes NetworkTopologyView and EMSpectrumPanel side-by-side
 * in a horizontal flex layout. Topology fills remaining space; EM panel is a
 * toggleable flex-shrink-0 w-80 panel on the right.
 *
 * Receives hoisted discovery props from ResourcesTab — no duplicate useDiscovery calls.
 */

import { useState } from 'react';
import type { DiscoveredDevice, DiscoveryStatus } from '../../../lib/discovery-service';
import { useResourcesContext } from '../ResourcesContext';
import { ResourceDetailPanel } from '../ResourceDetailPanel';
import { NetworkTopologyView } from './NetworkTopologyView';
import { EMSpectrumPanel } from './EMSpectrumPanel';

interface NetworkSubViewProps {
  devices: DiscoveredDevice[];
  scannerStatus: DiscoveryStatus | null;
  connected: number;
}

export function NetworkSubView({ devices, scannerStatus, connected }: NetworkSubViewProps) {
  const [showEM, setShowEM] = useState(false);
  const { selectedResourceId, setSelectedResourceId } = useResourcesContext();

  const connectedCount = connected;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-700">
        <span className="text-sm font-medium text-gray-300">Network Topology</span>
        <button
          onClick={() => setShowEM((prev) => !prev)}
          className={`text-xs px-3 py-1 rounded transition-colors ${
            showEM
              ? 'bg-sky-600 text-white'
              : 'bg-gray-800 text-gray-400 hover:text-gray-200 border border-gray-600'
          }`}
        >
          EM Spectrum
        </button>
      </div>

      {/* Main content: topology + optional EM panel */}
      <div className="flex flex-1 min-h-0">
        {/* Topology graph takes remaining space */}
        <div className="flex-1 min-w-0">
          <NetworkTopologyView
            visible={true}
            scannerStatus={scannerStatus}
            deviceCount={devices.length}
            connectedCount={connectedCount}
            onNodeClick={(deviceId) => setSelectedResourceId(deviceId)}
          />
        </div>

        {/* EM panel as toggleable right panel */}
        {showEM && (
          <EMSpectrumPanel visible={showEM} onClose={() => setShowEM(false)} />
        )}
      </div>

      {/* Resource detail slide-over */}
      {selectedResourceId && (
        <ResourceDetailPanel
          resourceId={selectedResourceId}
          onClose={() => setSelectedResourceId(null)}
        />
      )}
    </div>
  );
}
