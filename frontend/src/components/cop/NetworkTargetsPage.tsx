/**
 * Network Targets Management Page
 *
 * Phase 32 Plan 12: Full CRUD page for managing remote scan targets.
 * Shows configured addresses with port range, protocol, enable toggle,
 * and consent status per target.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { discoveryService } from '../../lib/discovery-service';
import type { ScanTarget } from '../../lib/discovery-service';

const protocolOptions = ['tcp', 'udp', 'icmp'] as const;

const consentStatusBadge = (target: ScanTarget) => {
  if (!target.legalConsentAt) {
    return <span className="px-2 py-0.5 rounded text-xs bg-slate-600 text-slate-300">None</span>;
  }
  const expires = new Date(target.legalConsentAt).getTime() + 4 * 60 * 60 * 1000;
  if (Date.now() > expires) {
    return <span className="px-2 py-0.5 rounded text-xs bg-yellow-700 text-yellow-200">Expired</span>;
  }
  return <span className="px-2 py-0.5 rounded text-xs bg-green-700 text-green-200">Valid</span>;
};

export const NetworkTargetsPage: React.FC = () => {
  const [targets, setTargets] = useState<ScanTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [formAddress, setFormAddress] = useState('');
  const [formPortRange, setFormPortRange] = useState('');
  const [formProtocol, setFormProtocol] = useState<'tcp' | 'udp' | 'icmp'>('tcp');
  const [formLabel, setFormLabel] = useState('');
  const [formSubmitting, setFormSubmitting] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  const loadTargets = useCallback(async () => {
    try {
      const result = await discoveryService.getScanTargets();
      setTargets(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load targets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const handleAdd = async () => {
    if (!formAddress || !formLabel) return;
    setFormSubmitting(true);
    try {
      await discoveryService.addScanTarget({
        address: formAddress,
        portRange: formPortRange || undefined,
        protocol: formProtocol,
        label: formLabel,
        enabled: true,
      });
      setFormAddress('');
      setFormPortRange('');
      setFormProtocol('tcp');
      setFormLabel('');
      setShowAddForm(false);
      await loadTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add target');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await discoveryService.updateScanTarget(id, { enabled: !enabled });
      await loadTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update target');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await discoveryService.removeScanTarget(id);
      await loadTargets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove target');
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded p-4 font-mono text-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-amber-400 text-xs font-bold tracking-wider uppercase">
          Remote Scan Targets
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-xs rounded transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Target'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-700 rounded px-3 py-2 mb-3">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-slate-800 border border-slate-600 rounded p-3 mb-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-slate-400 text-xs block mb-1">Address *</label>
              <input
                type="text"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="192.168.1.0/24 or hostname"
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Label *</label>
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Target name"
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Port Range</label>
              <input
                type="text"
                value={formPortRange}
                onChange={(e) => setFormPortRange(e.target.value)}
                placeholder="1-1024 or 80,443,8080"
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs block mb-1">Protocol</label>
              <select
                value={formProtocol}
                onChange={(e) => setFormProtocol(e.target.value as typeof formProtocol)}
                className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-1 text-slate-200 text-xs"
              >
                {protocolOptions.map((p) => (
                  <option key={p} value={p}>{p.toUpperCase()}</option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={handleAdd}
            disabled={!formAddress || !formLabel || formSubmitting}
            className="px-3 py-1 bg-green-700 hover:bg-green-600 disabled:bg-slate-700 disabled:text-slate-500 text-white text-xs rounded transition-colors"
          >
            {formSubmitting ? 'Adding...' : 'Add Target'}
          </button>
        </div>
      )}

      {/* Targets Table */}
      {loading ? (
        <p className="text-slate-500 text-xs">Loading targets...</p>
      ) : targets.length === 0 ? (
        <p className="text-slate-500 text-xs italic">No remote scan targets configured.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 py-2 px-2">Label</th>
                <th className="text-left text-slate-400 py-2 px-2">Address</th>
                <th className="text-left text-slate-400 py-2 px-2">Ports</th>
                <th className="text-left text-slate-400 py-2 px-2">Proto</th>
                <th className="text-left text-slate-400 py-2 px-2">Consent</th>
                <th className="text-center text-slate-400 py-2 px-2">Active</th>
                <th className="text-right text-slate-400 py-2 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                  <td className="py-2 px-2 text-slate-200">{t.label}</td>
                  <td className="py-2 px-2 text-slate-300">{t.address}</td>
                  <td className="py-2 px-2 text-slate-400">{t.portRange || '-'}</td>
                  <td className="py-2 px-2 text-slate-400 uppercase">{t.protocol}</td>
                  <td className="py-2 px-2">{consentStatusBadge(t)}</td>
                  <td className="py-2 px-2 text-center">
                    <button
                      onClick={() => handleToggle(t.id, t.enabled)}
                      className={`w-8 h-4 rounded-full relative transition-colors ${
                        t.enabled ? 'bg-green-600' : 'bg-slate-600'
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                          t.enabled ? 'left-4' : 'left-0.5'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
