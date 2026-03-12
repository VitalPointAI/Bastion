/**
 * Client-Side Discovery Panel
 *
 * Phase 32 Plan 11: Shows browser API availability, provides scan buttons
 * for Web Bluetooth and Web Serial, and displays locally-discovered devices
 * with relay status to the Bastion backend.
 *
 * Moved from cop/ to resources/discovery/ in Phase 42 Plan 03.
 */

import React from 'react';
import { useClientDiscovery } from '../../../hooks/useClientDiscovery';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-600',
  sent: 'bg-green-600',
  failed: 'bg-red-600',
};

export const ClientDiscoveryPanel: React.FC = () => {
  const {
    discoveries,
    scanning,
    startBluetoothScan,
    startSerialScan,
    isBluetoothAvailable,
    isSerialAvailable,
  } = useClientDiscovery();

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
      <h3 className="text-amber-400 text-xs font-bold tracking-wider mb-3 uppercase">
        Client Discovery Bridge
      </h3>

      {/* API Availability */}
      <div className="flex gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isBluetoothAvailable ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-slate-300 text-xs">Web Bluetooth</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isSerialAvailable ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-slate-300 text-xs">Web Serial</span>
        </div>
      </div>

      {/* Scan Buttons */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={startBluetoothScan}
          disabled={!isBluetoothAvailable || scanning}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
        >
          {scanning ? 'Scanning...' : 'Scan Bluetooth'}
        </button>
        <button
          onClick={startSerialScan}
          disabled={!isSerialAvailable || scanning}
          className="px-3 py-1 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
        >
          {scanning ? 'Scanning...' : 'Scan Serial'}
        </button>
      </div>

      {!isBluetoothAvailable && !isSerialAvailable && (
        <p className="text-slate-500 text-xs italic mb-4">
          No browser discovery APIs available. Use Chrome/Edge with HTTPS for Web Bluetooth/Serial support.
        </p>
      )}

      {/* Discovered Devices */}
      {discoveries.length > 0 && (
        <div className="border-t border-slate-700 pt-3">
          <h4 className="text-slate-400 text-xs mb-2 uppercase tracking-wider">
            Discovered ({discoveries.length})
          </h4>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {discoveries.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between bg-slate-800 rounded px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 text-xs">
                    {d.type === 'bluetooth' ? 'BLE' : 'SER'}
                  </span>
                  <span className="text-slate-200 text-xs">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-xs text-white ${statusColors[d.relayStatus]}`}
                  >
                    {d.relayStatus}
                  </span>
                  {d.error && (
                    <span className="text-red-400 text-xs" title={d.error}>
                      !
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
