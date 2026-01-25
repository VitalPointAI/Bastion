/**
 * ROEPanel Component
 *
 * Phase 05 Plan 13: ROE display and override interface
 * Shows violations and warnings from ROE check, enables commander override
 */

import { useState } from 'react';
import type { ROECheckResult, ROEViolation, ROEWarning } from './types';
import './ROEPanel.css';

interface ROEPanelProps {
  checkResult: ROECheckResult | null;
  isCommander: boolean;
  onRequestOverride: (justification: string) => Promise<void>;
}

export function ROEPanel({
  checkResult,
  isCommander,
  onRequestOverride,
}: ROEPanelProps) {
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!checkResult) {
    return null;
  }

  const handleOverride = async () => {
    if (justification.length < 10) {
      setError('Justification must be at least 10 characters');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await onRequestOverride(justification);
      setJustification('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`roe-panel ${checkResult.approved ? 'approved' : 'violations'}`}>
      <div className="roe-header">
        <h4>ROE Check Result</h4>
        <span className={`roe-status ${checkResult.approved ? 'approved' : 'failed'}`}>
          {checkResult.approved ? 'APPROVED' : 'VIOLATIONS DETECTED'}
        </span>
      </div>

      {checkResult.violations.length > 0 && (
        <div className="roe-violations">
          <h5>Violations ({checkResult.violations.length})</h5>
          {checkResult.violations.map((v: ROEViolation, i: number) => (
            <div key={i} className={`violation-card ${v.severity}`}>
              <div className="violation-header">
                <span className="violation-name">{v.ruleName}</span>
                <span className={`severity-badge ${v.severity}`}>
                  {v.severity.toUpperCase()}
                </span>
              </div>
              <p className="violation-message">{v.message}</p>
              <span className="violation-citation">Citation: {v.citation}</span>
            </div>
          ))}
        </div>
      )}

      {checkResult.warnings.length > 0 && (
        <div className="roe-warnings">
          <h5>Warnings ({checkResult.warnings.length})</h5>
          {checkResult.warnings.map((w: ROEWarning, i: number) => (
            <div key={i} className={`warning-card ${w.severity}`}>
              <div className="warning-header">
                <span className="warning-name">{w.ruleName}</span>
                <span className={`severity-badge ${w.severity}`}>
                  {w.severity.toUpperCase()}
                </span>
              </div>
              <p className="warning-message">{w.message}</p>
              {w.recommendation && (
                <p className="warning-recommendation">
                  Recommendation: {w.recommendation}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {checkResult.requiresOverride && (
        <div className="roe-override">
          {isCommander ? (
            <>
              <h5>Commander Override</h5>
              <p className="override-warning">
                Proceeding requires documented justification. This will be
                recorded on the blockchain audit trail.
              </p>
              {error && <div className="override-error">{error}</div>}
              <textarea
                placeholder="Enter justification for override (minimum 10 characters)..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
              />
              <button
                className="override-btn"
                onClick={handleOverride}
                disabled={loading || justification.length < 10}
              >
                {loading ? 'Processing...' : 'Authorize Override'}
              </button>
            </>
          ) : (
            <div className="override-required">
              Commander authorization required to proceed with violations
            </div>
          )}
        </div>
      )}
    </div>
  );
}
