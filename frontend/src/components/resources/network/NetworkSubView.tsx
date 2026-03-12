/**
 * NetworkSubView
 *
 * Phase 42 Plan 04: Composes NetworkTopologyView and EMSpectrumPanel side-by-side
 * in a horizontal flex layout. Topology fills remaining space; EM panel is a
 * toggleable flex-shrink-0 w-80 panel on the right.
 *
 * Receives hoisted discovery props from ResourcesTab — no duplicate useDiscovery calls.
 */

import { useState, useCallback, useRef } from 'react';
import type { DiscoveredDevice, DiscoveryStatus, LegalConsentRequirement } from '../../../lib/discovery-service';
import { discoveryService } from '../../../lib/discovery-service';
import { useResourcesContext } from '../resourcesContextValue.js';
import { ResourceDetailPanel } from '../ResourceDetailPanel';
import { NetworkTopologyView } from './NetworkTopologyView';
import type { TopologyOrigin } from './NetworkTopologyView';
import { EMSpectrumPanel } from './EMSpectrumPanel';

interface NetworkSubViewProps {
  devices: DiscoveredDevice[];
  scannerStatus: DiscoveryStatus | null;
  connected: number;
}

const ORIGIN_OPTIONS: { value: TopologyOrigin; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'server', label: 'Server' },
  { value: 'client', label: 'Client' },
  { value: 'remote', label: 'Remote' },
];

export function NetworkSubView({ devices, scannerStatus, connected }: NetworkSubViewProps) {
  const [showEM, setShowEM] = useState(false);
  const [topologyOrigin, setTopologyOrigin] = useState<TopologyOrigin>('all');
  const { selectedResourceId, setSelectedResourceId } = useResourcesContext();

  // Legal consent state
  const [consentRequirement, setConsentRequirement] = useState<LegalConsentRequirement | null>(null);
  const [consentAccepting, setConsentAccepting] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const pendingOriginRef = useRef<string | null>(null);

  const connectedCount = connected;

  // Map topology origin to discovery origin for scan
  const getDiscoveryOrigin = useCallback((): string => {
    if (topologyOrigin === 'server' || topologyOrigin === 'client' || topologyOrigin === 'remote') {
      return topologyOrigin;
    }
    return 'server'; // default for 'all'
  }, [topologyOrigin]);

  // Start scan with consent handling
  const handleStartScan = useCallback(async () => {
    const origin = getDiscoveryOrigin();
    setScanError(null);
    try {
      await discoveryService.startScanning(undefined, origin);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed';
      if (msg.includes('Legal consent required') || msg.includes('451')) {
        // Fetch consent requirement and show modal
        try {
          const requirement = await discoveryService.getLegalConsent(origin);
          if (requirement.hasValidConsent) {
            // Retry — consent was already valid
            await discoveryService.startScanning(undefined, origin);
            return;
          }
          pendingOriginRef.current = origin;
          setConsentRequirement(requirement);
        } catch {
          setScanError('Failed to load consent requirements');
        }
        return;
      }
      setScanError(msg);
    }
  }, [getDiscoveryOrigin]);

  const handleConsentAccept = useCallback(async () => {
    if (!consentRequirement) return;
    setConsentAccepting(true);
    try {
      await discoveryService.recordLegalConsent(
        consentRequirement.consentType,
        consentRequirement.textHash,
      );
      setConsentRequirement(null);
      const origin = pendingOriginRef.current;
      pendingOriginRef.current = null;
      // Retry the scan
      if (origin) {
        try {
          await discoveryService.startScanning(undefined, origin);
        } catch (err) {
          setScanError(err instanceof Error ? err.message : 'Scan failed after consent');
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Failed to record consent');
    } finally {
      setConsentAccepting(false);
    }
  }, [consentRequirement]);

  const handleConsentCancel = useCallback(() => {
    setConsentRequirement(null);
    pendingOriginRef.current = null;
  }, []);

  return (
    <>
      <div className="flex flex-col h-full overflow-hidden bg-gray-900">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2 border-b border-gray-700">
          <span className="text-sm font-medium text-gray-300">Network Topology</span>

          {/* Origin perspective toggle */}
          <div className="flex items-center bg-gray-800 rounded overflow-hidden border border-gray-600">
            {ORIGIN_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTopologyOrigin(opt.value)}
                className={`text-xs px-2.5 py-1 transition-colors ${
                  topologyOrigin === opt.value
                    ? 'bg-sky-600 text-white'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

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

          {scanError && (
            <span className="text-red-400 text-xs ml-auto">
              {scanError}
              <button onClick={() => setScanError(null)} className="ml-2 text-red-500 underline">dismiss</button>
            </span>
          )}
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
              origin={topologyOrigin}
              onStartScan={handleStartScan}
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

      {/* Legal Consent Modal */}
      {consentRequirement && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={(e) => { if (e.target === e.currentTarget) handleConsentCancel(); }}
        >
          <div className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
            <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-amber-400 font-bold text-sm tracking-wider uppercase">
                {consentRequirement.title}
              </h3>
              <button onClick={handleConsentCancel} className="text-slate-400 hover:text-slate-200 text-lg leading-none">
                &times;
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
                {consentRequirement.legalText}
              </pre>
            </div>
            <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-end gap-3">
              <button
                onClick={handleConsentCancel}
                className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConsentAccept}
                disabled={consentAccepting}
                className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded transition-colors"
              >
                {consentAccepting ? 'Recording...' : 'I Acknowledge & Accept'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
