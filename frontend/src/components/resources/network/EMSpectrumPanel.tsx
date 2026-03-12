/**
 * EMSpectrumPanel
 *
 * Phase 32 Plan 09: EM spectrum awareness panel with two tabs:
 *   - Environment: EM bands from external/discovered devices
 *   - Own Emissions: Bastion's active transmissions and OPSEC indicator
 *
 * Auto-refreshes every 10 seconds from discovery REST API.
 *
 * Phase 42 Plan 04: Moved from cop/ to resources/network/. Absolute overlay
 * positioning stripped — now renders as inline flex child (flex-shrink-0 w-80).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { EMSnapshot, EMSignalEntry } from '../../../lib/discovery-service.ts';
import { discoveryService } from '../../../lib/discovery-service.ts';

// ---- Constants ------------------------------------------------------------

const REFRESH_INTERVAL_MS = 10_000;

const BAND_LABELS: Record<string, string> = {
  bluetooth: 'Bluetooth',
  wifi_2g: 'WiFi 2.4G',
  wifi_5g: 'WiFi 5G',
  vhf: 'VHF',
  uhf: 'UHF',
  hf: 'HF',
  satcom: 'SATCOM',
  unknown: 'Unknown',
};

// ---- OPSEC level calculation ----------------------------------------------

function getOpsecLevel(emissionCount: number): { label: string; color: string } {
  if (emissionCount <= 2) return { label: 'Low', color: '#22c55e' };
  if (emissionCount <= 5) return { label: 'Medium', color: '#eab308' };
  return { label: 'High', color: '#ef4444' };
}

// ---- Strength color -------------------------------------------------------

function strengthColor(dbm: number): string {
  // Typical range: -90 (weak) to -30 (strong)
  const normalized = Math.min(1, Math.max(0, (dbm + 90) / 60));
  if (normalized < 0.33) return '#22c55e';  // weak = green
  if (normalized < 0.66) return '#eab308';  // medium = yellow
  return '#ef4444';                          // strong = red
}

// ---- Props ----------------------------------------------------------------

interface EMSpectrumPanelProps {
  visible: boolean;
  onClose: () => void;
}

// ---- Component ------------------------------------------------------------

export function EMSpectrumPanel({ visible, onClose }: EMSpectrumPanelProps) {
  const [tab, setTab] = useState<'environment' | 'emissions'>('environment');
  const [snapshot, setSnapshot] = useState<EMSnapshot | null>(null);
  const [ownEmissions, setOwnEmissions] = useState<EMSignalEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [snap, emissions] = await Promise.all([
        discoveryService.getEMSnapshot(),
        discoveryService.getOwnEMFootprint(),
      ]);
      if (mountedRef.current) {
        setSnapshot(snap);
        setOwnEmissions(emissions);
      }
    } catch (err) {
      console.error('[EMSpectrumPanel] fetch failed:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (visible) {
      fetchData();
      const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
      return () => {
        clearInterval(interval);
        mountedRef.current = false;
      };
    }
    return () => { mountedRef.current = false; };
  }, [visible, fetchData]);

  if (!visible) return null;

  const opsec = getOpsecLevel(ownEmissions.length);

  return (
    <div className="flex-shrink-0 w-80 h-full border-l border-slate-700 bg-slate-900 flex flex-col font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-700 bg-slate-800">
        <span className="text-slate-200 font-bold text-sm tracking-wider">EM SPECTRUM</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        <button
          onClick={() => setTab('environment')}
          className={`flex-1 py-2 text-center text-xs font-mono uppercase tracking-wider ${
            tab === 'environment'
              ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Environment
        </button>
        <button
          onClick={() => setTab('emissions')}
          className={`flex-1 py-2 text-center text-xs font-mono uppercase tracking-wider ${
            tab === 'emissions'
              ? 'text-sky-400 border-b-2 border-sky-400 bg-slate-800'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Own Emissions
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && !snapshot ? (
          <div className="text-slate-500 text-center py-8">Loading EM data...</div>
        ) : tab === 'environment' ? (
          <EnvironmentTab snapshot={snapshot} />
        ) : (
          <EmissionsTab emissions={ownEmissions} opsec={opsec} />
        )}
      </div>

      {/* Footer: refresh indicator */}
      <div className="px-3 py-1.5 border-t border-slate-700 text-slate-600 text-center">
        {snapshot ? `Updated ${new Date(snapshot.timestamp).toLocaleTimeString()}` : 'No data'}
      </div>
    </div>
  );
}

// ---- Environment Tab ------------------------------------------------------

function EnvironmentTab({ snapshot }: { snapshot: EMSnapshot | null }) {
  if (!snapshot) {
    return <div className="text-slate-500 text-center py-4">No EM data available</div>;
  }

  const bands = Object.entries(snapshot.bandSummary)
    .filter(([, summary]) => summary.count > 0)
    .sort((a, b) => b[1].count - a[1].count);

  if (bands.length === 0) {
    return <div className="text-slate-500 text-center py-4">No signals detected</div>;
  }

  const maxCount = Math.max(...bands.map(([, s]) => s.count));

  return (
    <div className="space-y-3">
      <div className="text-slate-400 uppercase tracking-wider mb-2">
        Signal Environment ({snapshot.environmentSignals.length} total)
      </div>

      {bands.map(([band, summary]) => {
        const barWidth = maxCount > 0 ? (summary.count / maxCount) * 100 : 0;
        const color = strengthColor(summary.avgStrength);

        return (
          <div key={band} className="space-y-1">
            <div className="flex justify-between text-slate-300">
              <span>{BAND_LABELS[band] || band}</span>
              <span className="text-slate-500">
                {summary.count} sig | avg {summary.avgStrength.toFixed(0)} dBm
              </span>
            </div>
            <div className="h-3 bg-slate-800 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all duration-500"
                style={{ width: `${barWidth}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Own Emissions Tab ----------------------------------------------------

function EmissionsTab({
  emissions,
  opsec,
}: {
  emissions: EMSignalEntry[];
  opsec: { label: string; color: string };
}) {
  // Group by band
  const byBand = emissions.reduce<Record<string, EMSignalEntry[]>>((acc, e) => {
    if (!acc[e.band]) acc[e.band] = [];
    acc[e.band].push(e);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* OPSEC indicator */}
      <div className="bg-slate-800 rounded p-3 flex items-center justify-between">
        <div>
          <div className="text-slate-400 uppercase tracking-wider">EM Footprint</div>
          <div className="text-slate-300 mt-0.5">{emissions.length} active transmission{emissions.length !== 1 ? 's' : ''}</div>
        </div>
        <div className="text-right">
          <div className="text-slate-500 text-[10px] uppercase">OPSEC Level</div>
          <div className="font-bold text-sm" style={{ color: opsec.color }}>
            {opsec.label}
          </div>
        </div>
      </div>

      {emissions.length === 0 ? (
        <div className="text-slate-500 text-center py-4">No active transmissions</div>
      ) : (
        Object.entries(byBand).map(([band, signals]) => (
          <div key={band} className="border border-slate-700 rounded">
            <div className="px-3 py-1.5 bg-slate-800 text-slate-400 uppercase tracking-wider border-b border-slate-700">
              {BAND_LABELS[band] || band} ({signals.length})
            </div>
            <div className="divide-y divide-slate-800">
              {signals.map((sig, idx) => (
                <div key={idx} className="px-3 py-1.5 flex justify-between text-slate-300">
                  <span>
                    {sig.transportType ? `${BAND_LABELS[sig.transportType] || sig.transportType} scanner` : sig.sourceIdentifier}
                  </span>
                  <span style={{ color: strengthColor(sig.signalStrengthDbm) }}>
                    {sig.signalStrengthDbm.toFixed(0)} dBm
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
