/**
 * Client-Side Discovery Panel
 *
 * Phase 32 Plan 11: Shows browser API availability, provides scan buttons
 * for Web Bluetooth and Web Serial, and displays locally-discovered devices
 * with relay status to the Bastion backend.
 *
 * Moved from cop/ to resources/discovery/ in Phase 42 Plan 03.
 * Enhanced: added Network scan (server-side mDNS/SSDP) and permission guidance.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useClientDiscovery } from '../../../hooks/useClientDiscovery';
import { discoveryService } from '../../../lib/discovery-service';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-600',
  sent: 'bg-green-600',
  failed: 'bg-red-600',
};

type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported' | 'unknown';

function useBluetoothPermission(): PermissionState {
  const [state, setState] = useState<PermissionState>('unknown');

  useEffect(() => {
    if (!navigator.permissions) {
      setState('unsupported');
      return;
    }

    // Chromium supports querying 'bluetooth' permission
    navigator.permissions
      .query({ name: 'bluetooth' as PermissionName })
      .then((result) => {
        setState(result.state as PermissionState);
        const onChange = () => setState(result.state as PermissionState);
        result.addEventListener('change', onChange);
        return () => result.removeEventListener('change', onChange);
      })
      .catch(() => {
        // Firefox/Safari don't support bluetooth permission query
        setState('unsupported');
      });
  }, []);

  return state;
}

export const ClientDiscoveryPanel: React.FC = () => {
  const {
    discoveries,
    scanning,
    startBluetoothScan,
    startSerialScan,
    isBluetoothAvailable,
    isSerialAvailable,
  } = useClientDiscovery();

  const bluetoothPermission = useBluetoothPermission();

  const [networkScanning, setNetworkScanning] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const startNetworkScan = useCallback(async () => {
    setNetworkScanning(true);
    setNetworkError(null);
    try {
      await discoveryService.startScanning();
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Network scan failed');
    } finally {
      setNetworkScanning(false);
    }
  }, []);

  const bluetoothBlocked = bluetoothPermission === 'denied';

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
      <h3 className="text-amber-400 text-xs font-bold tracking-wider mb-3 uppercase">
        Discovery Bridge
      </h3>

      {/* API Availability */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-slate-300 text-xs">Network (mDNS/SSDP)</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${
              bluetoothBlocked ? 'bg-red-500' : isBluetoothAvailable ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-slate-300 text-xs">
            Web Bluetooth
            {bluetoothBlocked && (
              <span className="text-red-400 ml-1">(blocked)</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isSerialAvailable ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-slate-300 text-xs">Web Serial</span>
        </div>
      </div>

      {/* Permission blocked banner */}
      {bluetoothBlocked && (
        <div className="bg-red-900/30 border border-red-700/50 rounded px-3 py-2 mb-4">
          <p className="text-red-300 text-xs mb-1">
            Bluetooth permission is blocked by your browser.
          </p>
          <p className="text-slate-400 text-xs">
            Click the lock/tune icon in the address bar → Site settings → set Bluetooth to "Allow", then reload the page.
          </p>
        </div>
      )}

      {/* Scan Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={startNetworkScan}
          disabled={networkScanning}
          className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
        >
          {networkScanning ? 'Scanning...' : 'Scan Network'}
        </button>
        <button
          onClick={startBluetoothScan}
          disabled={!isBluetoothAvailable || scanning || bluetoothBlocked}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
          title={bluetoothBlocked ? 'Bluetooth permission blocked — check site settings' : undefined}
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

      {networkError && (
        <p className="text-red-400 text-xs mb-4">{networkError}</p>
      )}

      {!isBluetoothAvailable && !isSerialAvailable && !bluetoothBlocked && (
        <p className="text-slate-500 text-xs italic mb-4">
          Bluetooth/Serial unavailable. Use Chrome/Edge with HTTPS. Network scan uses server-side mDNS/SSDP.
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
