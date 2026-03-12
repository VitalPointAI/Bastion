/**
 * Discovery Panel
 *
 * Three scanning origins (Phase 32 tri-origin model):
 *   1. Server — mDNS/SSDP/BLE/USB from the machine Bastion runs on
 *   2. Client — Web Bluetooth/Serial from the user's browser
 *   3. Remote — probe a specific IP/network entered by the user
 *
 * Each origin has its own legal consent flow (Phase 32 Plan 12).
 * Consent is per-user, per-origin, time-limited (server 24h, client 24h, remote 4h).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useClientDiscovery } from '../../../hooks/useClientDiscovery';
import { discoveryService } from '../../../lib/discovery-service';
import type { LegalConsentRequirement, ScanTarget } from '../../../lib/discovery-service';

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
    navigator.permissions
      .query({ name: 'bluetooth' as PermissionName })
      .then((result) => {
        setState(result.state as PermissionState);
        const onChange = () => setState(result.state as PermissionState);
        result.addEventListener('change', onChange);
        return () => result.removeEventListener('change', onChange);
      })
      .catch(() => setState('unsupported'));
  }, []);

  return state;
}

// ── Legal Consent Modal ─────────────────────────────────────────────────────

interface ConsentModalProps {
  requirement: LegalConsentRequirement;
  accepting: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

function ConsentModal({ requirement, accepting, onAccept, onCancel }: ConsentModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        ref={modalRef}
        tabIndex={-1}
        className="bg-slate-900 border border-slate-600 rounded-lg shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
      >
        <div className="px-5 py-3 border-b border-slate-700 flex items-center justify-between">
          <h3 className="text-amber-400 font-bold text-sm tracking-wider uppercase">
            {requirement.title}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 text-lg leading-none">
            &times;
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <pre className="text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed">
            {requirement.legalText}
          </pre>
        </div>
        <div className="px-5 py-3 border-t border-slate-700 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs text-slate-400 hover:text-slate-200 border border-slate-600 rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onAccept}
            disabled={accepting}
            className="px-4 py-2 text-xs bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded transition-colors"
          >
            {accepting ? 'Recording...' : 'I Acknowledge & Accept'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section Header ──────────────────────────────────────────────────────────

function SectionHeader({ label, description }: { label: string; description: string }) {
  return (
    <div className="mb-2">
      <h4 className="text-slate-200 text-xs font-bold uppercase tracking-wider">{label}</h4>
      <p className="text-slate-500 text-[10px] mt-0.5">{description}</p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

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
  const bluetoothBlocked = bluetoothPermission === 'denied';

  // Scan state per origin
  const [serverScanning, setServerScanning] = useState(false);
  const [remoteScanning, setRemoteScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Legal consent
  const [consentRequirement, setConsentRequirement] = useState<LegalConsentRequirement | null>(null);
  const [consentAccepting, setConsentAccepting] = useState(false);
  const pendingOriginRef = useRef<string | null>(null);

  // Remote scan targets
  const [scanTargets, setScanTargets] = useState<ScanTarget[]>([]);
  const [newTargetAddress, setNewTargetAddress] = useState('');
  const [newTargetLabel, setNewTargetLabel] = useState('');
  const [addingTarget, setAddingTarget] = useState(false);

  // Load remote scan targets on mount
  useEffect(() => {
    discoveryService.getScanTargets()
      .then(setScanTargets)
      .catch(() => { /* silent — targets section just shows empty */ });
  }, []);

  // ── Consent flow ──────────────────────────────────────────────────────────

  const triggerConsent = useCallback(async (origin: string): Promise<boolean> => {
    try {
      const requirement = await discoveryService.getLegalConsent(origin);
      if (requirement.hasValidConsent) return true;
      pendingOriginRef.current = origin;
      setConsentRequirement(requirement);
      return false;
    } catch {
      setError('Failed to load consent requirements');
      return false;
    }
  }, []);

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

      // Retry the scan that triggered consent
      if (origin === 'server') {
        startServerScanInner();
      } else if (origin === 'remote') {
        startRemoteScanInner();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent');
    } finally {
      setConsentAccepting(false);
    }
  }, [consentRequirement]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConsentCancel = useCallback(() => {
    setConsentRequirement(null);
    pendingOriginRef.current = null;
  }, []);

  // ── Server scan (origin: server) ──────────────────────────────────────────

  const startServerScanInner = useCallback(async () => {
    setServerScanning(true);
    setError(null);
    try {
      await discoveryService.startScanning(undefined, 'server');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Server scan failed';
      if (msg.includes('Legal consent required') || msg.includes('451')) {
        setServerScanning(false);
        await triggerConsent('server');
        return;
      }
      setError(msg);
    } finally {
      setServerScanning(false);
    }
  }, [triggerConsent]);

  // ── Remote scan (origin: remote) ──────────────────────────────────────────

  const startRemoteScanInner = useCallback(async () => {
    if (scanTargets.filter(t => t.enabled).length === 0) {
      setError('Add at least one remote target before scanning');
      return;
    }
    setRemoteScanning(true);
    setError(null);
    try {
      await discoveryService.startScanning(undefined, 'remote');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Remote scan failed';
      if (msg.includes('Legal consent required') || msg.includes('451')) {
        setRemoteScanning(false);
        await triggerConsent('remote');
        return;
      }
      setError(msg);
    } finally {
      setRemoteScanning(false);
    }
  }, [triggerConsent, scanTargets]);

  const handleAddTarget = useCallback(async () => {
    if (!newTargetAddress.trim()) return;
    setAddingTarget(true);
    try {
      const target = await discoveryService.addScanTarget({
        address: newTargetAddress.trim(),
        label: newTargetLabel.trim() || newTargetAddress.trim(),
        protocol: 'tcp',
        enabled: true,
      });
      setScanTargets((prev) => [...prev, target]);
      setNewTargetAddress('');
      setNewTargetLabel('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add target');
    } finally {
      setAddingTarget(false);
    }
  }, [newTargetAddress, newTargetLabel]);

  const handleRemoveTarget = useCallback(async (id: string) => {
    try {
      await discoveryService.deleteScanTarget(id);
      setScanTargets((prev) => prev.filter(t => t.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove target');
    }
  }, []);

  return (
    <>
      <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm space-y-5">
        <h3 className="text-amber-400 text-xs font-bold tracking-wider uppercase">
          Discovery Bridge
        </h3>

        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded px-3 py-2">
            <p className="text-red-400 text-xs">{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 text-[10px] underline mt-1">
              Dismiss
            </button>
          </div>
        )}

        {/* ── 1. Server Scan ──────────────────────────────────────────────── */}
        <div className="border border-slate-700 rounded p-3">
          <SectionHeader
            label="Server Scan"
            description="Scan from Bastion's host machine — mDNS, SSDP, Bluetooth, WiFi, USB"
          />
          <button
            onClick={startServerScanInner}
            disabled={serverScanning}
            className="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
          >
            {serverScanning ? 'Scanning...' : 'Start Server Scan'}
          </button>
        </div>

        {/* ── 2. Client Scan ──────────────────────────────────────────────── */}
        <div className="border border-slate-700 rounded p-3">
          <SectionHeader
            label="Client Scan"
            description="Scan from your browser — Web Bluetooth and Web Serial (relayed to Bastion)"
          />

          {/* Availability indicators */}
          <div className="flex gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                bluetoothBlocked ? 'bg-red-500' : isBluetoothAvailable ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className="text-slate-400 text-[10px]">
                Bluetooth{bluetoothBlocked ? ' (blocked)' : ''}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${isSerialAvailable ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-slate-400 text-[10px]">Serial</span>
            </div>
          </div>

          {bluetoothBlocked && (
            <div className="bg-red-900/30 border border-red-700/50 rounded px-3 py-2 mb-3">
              <p className="text-red-300 text-xs mb-0.5">Bluetooth permission blocked.</p>
              <p className="text-slate-400 text-[10px]">
                Address bar lock icon &rarr; Site settings &rarr; Bluetooth &rarr; Allow, then reload.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={startBluetoothScan}
              disabled={!isBluetoothAvailable || scanning || bluetoothBlocked}
              className="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
              title={bluetoothBlocked ? 'Permission blocked — check site settings' : undefined}
            >
              {scanning ? 'Scanning...' : 'Scan Bluetooth'}
            </button>
            <button
              onClick={startSerialScan}
              disabled={!isSerialAvailable || scanning}
              className="px-3 py-1.5 bg-purple-700 hover:bg-purple-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
            >
              {scanning ? 'Scanning...' : 'Scan Serial'}
            </button>
          </div>

          {!isBluetoothAvailable && !isSerialAvailable && !bluetoothBlocked && (
            <p className="text-slate-500 text-[10px] italic mt-2">
              Browser APIs unavailable. Requires Chrome/Edge with HTTPS.
            </p>
          )}
        </div>

        {/* ── 3. Remote Scan ──────────────────────────────────────────────── */}
        <div className="border border-slate-700 rounded p-3">
          <SectionHeader
            label="Remote Scan"
            description="Probe specific IP addresses or network ranges — requires explicit authorization"
          />

          {/* Existing targets */}
          {scanTargets.length > 0 && (
            <div className="space-y-1.5 mb-3">
              {scanTargets.map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-slate-800 rounded px-2.5 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.enabled ? 'bg-green-500' : 'bg-slate-600'}`} />
                    <span className="text-slate-300 text-xs truncate">{t.label}</span>
                    <span className="text-slate-500 text-[10px]">{t.address}{t.portRange ? `:${t.portRange}` : ''}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveTarget(t.id)}
                    className="text-slate-500 hover:text-red-400 text-xs ml-2 shrink-0"
                    title="Remove target"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add target form */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newTargetAddress}
              onChange={(e) => setNewTargetAddress(e.target.value)}
              placeholder="IP or CIDR (e.g. 10.0.1.0/24)"
              className="flex-1 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <input
              type="text"
              value={newTargetLabel}
              onChange={(e) => setNewTargetLabel(e.target.value)}
              placeholder="Label"
              className="w-28 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-xs text-slate-200 placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
            <button
              onClick={handleAddTarget}
              disabled={!newTargetAddress.trim() || addingTarget}
              className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-200 text-xs rounded transition-colors shrink-0"
            >
              {addingTarget ? '...' : 'Add'}
            </button>
          </div>

          <button
            onClick={startRemoteScanInner}
            disabled={remoteScanning || scanTargets.filter(t => t.enabled).length === 0}
            className="px-3 py-1.5 bg-red-700 hover:bg-red-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
          >
            {remoteScanning ? 'Scanning...' : 'Start Remote Scan'}
          </button>
          {scanTargets.length === 0 && (
            <p className="text-slate-500 text-[10px] italic mt-2">
              Add a target IP/range above before scanning.
            </p>
          )}
        </div>

        {/* ── Client-discovered devices ────────────────────────────────────── */}
        {discoveries.length > 0 && (
          <div className="border-t border-slate-700 pt-3">
            <h4 className="text-slate-400 text-xs mb-2 uppercase tracking-wider">
              Browser Discovered ({discoveries.length})
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {discoveries.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">
                      {d.type === 'bluetooth' ? 'BLE' : 'SER'}
                    </span>
                    <span className="text-slate-200 text-xs">{d.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs text-white ${statusColors[d.relayStatus]}`}>
                      {d.relayStatus}
                    </span>
                    {d.error && (
                      <span className="text-red-400 text-xs" title={d.error}>!</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Legal Consent Modal */}
      {consentRequirement && (
        <ConsentModal
          requirement={consentRequirement}
          accepting={consentAccepting}
          onAccept={handleConsentAccept}
          onCancel={handleConsentCancel}
        />
      )}
    </>
  );
};
