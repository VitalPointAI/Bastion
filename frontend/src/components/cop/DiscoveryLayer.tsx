/**
 * DiscoveryLayer
 *
 * Phase 32 Plan 09: COP map layer rendering discovered devices as markers
 * with state-based styling. Devices without location render in a sidebar
 * list grouped by transport type.
 *
 * Follows COPResourceLayer pattern for Leaflet integration.
 */

import { useState } from 'react';
import { Marker, Tooltip, CircleMarker } from 'react-leaflet';
import L from 'leaflet';
import type { DiscoveredDevice, DeviceState, TransportType } from '../../lib/discovery-service.ts';

// ---- State-based marker styling -------------------------------------------

interface StateStyle {
  color: string;
  fillColor: string;
  pulse: boolean;
  shape: 'circle' | 'x';
}

const STATE_STYLES: Record<string, StateStyle> = {
  discovered:        { color: '#eab308', fillColor: '#eab308', pulse: true, shape: 'circle' },
  fingerprinting:    { color: '#eab308', fillColor: '#eab308', pulse: true, shape: 'circle' },
  authenticating:    { color: '#f97316', fillColor: '#f97316', pulse: false, shape: 'circle' },
  gate_check:        { color: '#f97316', fillColor: '#f97316', pulse: false, shape: 'circle' },
  ironclaw_analysis: { color: '#f97316', fillColor: '#f97316', pulse: false, shape: 'circle' },
  pending_dao:       { color: '#f97316', fillColor: '#f97316', pulse: false, shape: 'circle' },
  onboarding:        { color: '#f97316', fillColor: '#f97316', pulse: false, shape: 'circle' },
  connected:         { color: '#22c55e', fillColor: '#22c55e', pulse: false, shape: 'circle' },
  disconnected:      { color: '#6b7280', fillColor: '#6b7280', pulse: false, shape: 'circle' },
  quarantined:       { color: '#ef4444', fillColor: '#ef4444', pulse: true, shape: 'circle' },
  rejected:          { color: '#ef4444', fillColor: '#ef4444', pulse: false, shape: 'x' },
  revoked:           { color: '#ef4444', fillColor: '#ef4444', pulse: false, shape: 'x' },
};

function getStateStyle(state: DeviceState): StateStyle {
  return STATE_STYLES[state] || STATE_STYLES.discovered;
}

// ---- Transport labels -----------------------------------------------------

const TRANSPORT_LABELS: Record<string, string> = {
  ble: 'Bluetooth',
  wifi: 'WiFi',
  usb: 'USB',
  tak: 'TAK',
};

// ---- Icon helpers ---------------------------------------------------------

function createRejectedIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'discovery-rejected-marker',
    html: `<div style="
      width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      color: ${color}; font-weight: 900; font-size: 18px;
      font-family: 'Fira Code', monospace;
      text-shadow: 0 0 4px rgba(0,0,0,0.8);
    ">X</div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function timeSince(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ---- Props ----------------------------------------------------------------

interface DiscoveryLayerProps {
  devices: DiscoveredDevice[];
  visible: boolean;
  onDeviceSelect?: (device: DiscoveredDevice) => void;
}

// ---- Component ------------------------------------------------------------

export function DiscoveryLayer({ devices, visible, onDeviceSelect }: DiscoveryLayerProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!visible) return null;

  // Separate devices with/without location
  const locatedDevices = devices.filter((d) => d.location?.lat != null && d.location?.lng != null);
  const unlocatedDevices = devices.filter((d) => d.location?.lat == null || d.location?.lng == null);

  // Group unlocated by transport
  const groupedUnlocated = unlocatedDevices.reduce<Record<string, DiscoveredDevice[]>>((acc, d) => {
    const key = d.transportType || 'unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  return (
    <>
      {/* Map markers for located devices */}
      {locatedDevices.map((device) => {
        const style = getStateStyle(device.state);

        if (style.shape === 'x') {
          return (
            <Marker
              key={`disc-${device.id}`}
              position={[device.location!.lat, device.location!.lng]}
              icon={createRejectedIcon(style.color)}
              eventHandlers={{
                click: () => onDeviceSelect?.(device),
              }}
            >
              <Tooltip direction="top" offset={[0, -12]}>
                <DeviceTooltip device={device} />
              </Tooltip>
            </Marker>
          );
        }

        return (
          <CircleMarker
            key={`disc-${device.id}`}
            center={[device.location!.lat, device.location!.lng]}
            radius={style.pulse ? 8 : 6}
            pathOptions={{
              color: style.color,
              fillColor: style.fillColor,
              fillOpacity: 0.8,
              weight: 2,
              className: style.pulse ? 'discovery-pulse' : undefined,
            }}
            eventHandlers={{
              click: () => onDeviceSelect?.(device),
            }}
          >
            <Tooltip direction="top" offset={[0, -8]}>
              <DeviceTooltip device={device} />
            </Tooltip>
          </CircleMarker>
        );
      })}

      {/* Sidebar for unlocated devices */}
      {unlocatedDevices.length > 0 && (
        <div className="absolute top-2 right-2 z-[1000]" style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="bg-slate-800 border border-slate-600 text-slate-200 px-3 py-1.5 text-xs font-mono rounded hover:bg-slate-700"
          >
            {unlocatedDevices.length} unlocated device{unlocatedDevices.length !== 1 ? 's' : ''}
          </button>

          {sidebarOpen && (
            <div className="mt-1 bg-slate-800 border border-slate-600 rounded shadow-lg max-h-80 overflow-y-auto w-64">
              {Object.entries(groupedUnlocated).map(([transport, devs]) => (
                <div key={transport} className="border-b border-slate-700 last:border-b-0">
                  <div className="px-3 py-1.5 bg-slate-750 text-slate-400 text-xs font-mono uppercase tracking-wider">
                    {TRANSPORT_LABELS[transport] || transport} ({devs.length})
                  </div>
                  {devs.map((d) => {
                    const s = getStateStyle(d.state);
                    return (
                      <button
                        key={d.id}
                        onClick={() => onDeviceSelect?.(d)}
                        className="w-full text-left px-3 py-1.5 hover:bg-slate-700 text-xs font-mono flex items-center gap-2"
                      >
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-slate-200 truncate">
                          {d.fingerprint?.displayName || d.rawIdentifier}
                        </span>
                        <span className="text-slate-500 ml-auto">{d.state}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSS for pulsing animation */}
      <style>{`
        .discovery-pulse {
          animation: disc-pulse 1.5s ease-in-out infinite;
        }
        @keyframes disc-pulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

// ---- Tooltip sub-component ------------------------------------------------

function DeviceTooltip({ device }: { device: DiscoveredDevice }) {
  const style = getStateStyle(device.state);
  return (
    <div style={{ fontSize: '11px', fontFamily: "'Fira Code', monospace", minWidth: '140px' }}>
      <strong>{device.fingerprint?.displayName || device.rawIdentifier}</strong>
      <br />
      <span style={{ color: '#94a3b8' }}>
        {TRANSPORT_LABELS[device.transportType] || device.transportType}
      </span>
      <br />
      <span style={{ color: style.color }}>{device.state}</span>
      {device.signalStrength != null && (
        <>
          <br />
          <span style={{ color: '#94a3b8' }}>Signal: {device.signalStrength} dBm</span>
        </>
      )}
      <br />
      <span style={{ color: '#64748b' }}>Last seen: {timeSince(device.lastSeen)}</span>
    </div>
  );
}
