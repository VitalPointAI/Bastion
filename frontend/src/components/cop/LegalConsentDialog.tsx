/**
 * Legal Consent Dialog
 *
 * Phase 32 Plan 12: Modal dialog showing jurisdiction-appropriate legal text
 * and requiring explicit acknowledgement before any scan can start.
 * Text varies by origin type (local, client, remote, military).
 */

import React, { useState, useEffect } from 'react';
import { discoveryService } from '../../lib/discovery-service';

interface LegalConsentDialogProps {
  origin: string;
  targetId?: string;
  isMilitary?: boolean;
  onConsented: () => void;
  onCancel: () => void;
}

export const LegalConsentDialog: React.FC<LegalConsentDialogProps> = ({
  origin,
  targetId,
  isMilitary,
  onConsented,
  onCancel,
}) => {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked] = useState(false);
  const [title, setTitle] = useState('');
  const [legalText, setLegalText] = useState('');
  const [textHash, setTextHash] = useState('');
  const [consentType, setConsentType] = useState('');
  const [hasValidConsent, setHasValidConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadConsent() {
      try {
        const requirement = await discoveryService.getLegalConsent(origin, targetId, isMilitary);
        if (cancelled) return;

        setTitle(requirement.title);
        setLegalText(requirement.legalText);
        setTextHash(requirement.textHash);
        setConsentType(requirement.consentType);
        setHasValidConsent(requirement.hasValidConsent);

        if (requirement.hasValidConsent) {
          onConsented();
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load consent');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadConsent();
    return () => { cancelled = true; };
  }, [origin, targetId, isMilitary, onConsented]);

  const handleAccept = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await discoveryService.recordLegalConsent(consentType, textHash, targetId);
      onConsented();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record consent');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
        <div className="bg-slate-900 border border-slate-600 rounded-lg p-6 max-w-lg">
          <p className="text-slate-400 font-mono text-sm">Loading legal requirements...</p>
        </div>
      </div>
    );
  }

  if (hasValidConsent) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-slate-900 border border-amber-600/50 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-amber-500 text-lg">&#9888;</span>
          <h2 className="text-amber-400 font-mono text-sm font-bold tracking-wider uppercase">
            {title}
          </h2>
        </div>

        {/* Legal Text */}
        <div className="flex-1 overflow-y-auto mb-4 bg-slate-950 border border-slate-700 rounded p-4">
          <pre className="text-slate-300 font-mono text-xs whitespace-pre-wrap leading-relaxed">
            {legalText}
          </pre>
        </div>

        {/* Acknowledgement Checkbox */}
        <label className="flex items-start gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-amber-500"
          />
          <span className="text-slate-300 font-mono text-xs leading-relaxed">
            I have read and understand the above legal notice. I confirm that I have proper
            authorization to perform this scanning activity and accept responsibility for
            compliance with all applicable laws and regulations.
          </span>
        </label>

        {error && (
          <p className="text-red-400 font-mono text-xs mb-3">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-xs rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAccept}
            disabled={!checked || submitting}
            className="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-mono text-xs rounded transition-colors font-bold"
          >
            {submitting ? 'Recording...' : 'I Accept — Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
};
