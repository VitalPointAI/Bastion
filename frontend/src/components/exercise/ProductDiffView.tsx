/**
 * ProductDiffView
 *
 * Phase 15 Plan 05: Modal overlay for reviewing cross-staff product changes before integration.
 *
 * Shows a side-by-side comparison of structured field changes (summary table) and
 * narrative content changes (content summary + source/target comparison).
 * User can "Accept & Integrate" (merges source into target) or "Reject" (marks as read).
 *
 * Layout:
 *   1. Header: "Integration Review", source role badge, product title, close button
 *   2. Structured Field Changes: comparison table (field / old value / new value)
 *   3. Narrative Content Changes: content summary + side-by-side textareas
 *   4. Action buttons: Accept & Integrate, Reject, Close
 */

import { useState } from 'react';
import type { StaffNotification, StaffProduct } from '../../types/exercise';
import { STAFF_ROLE_CONFIG } from '../../types/exercise';
import './ProductDiffView.css';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface DiffSnapshot {
  structuredChanges: Array<{
    field: string;
    oldValue: unknown;
    newValue: unknown;
  }>;
  contentChanged: boolean;
  contentSummary?: string;
  productTitle?: string;
}

export interface ProductDiffViewProps {
  notification: StaffNotification;
  sourceProduct: StaffProduct;
  targetProduct: StaffProduct | null;
  onAccept: () => Promise<void>;
  onReject: () => void;
  onClose: () => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(empty)';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function roleCategoryClass(roleKey: string): string {
  const config = STAFF_ROLE_CONFIG[roleKey];
  if (!config) return 'other';
  switch (config.category) {
    case 'Command': return 'command';
    case 'J-Staff': return 'jstaff';
    case 'Special Staff': return 'special';
    case 'Supporting Elements': return 'supporting';
    case 'Component Commands': return 'component';
    case 'Additional Elements': return 'additional';
    default: return 'other';
  }
}

// ─── ProductDiffView ───────────────────────────────────────────────────────────

export function ProductDiffView({
  notification,
  sourceProduct,
  targetProduct,
  onAccept,
  onReject,
  onClose,
}: ProductDiffViewProps) {
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const diffSnapshot = notification.diffSnapshot as DiffSnapshot | null;
  const structuredChanges = diffSnapshot?.structuredChanges ?? [];
  const contentChanged = diffSnapshot?.contentChanged ?? false;
  const contentSummary = diffSnapshot?.contentSummary;

  const productTitle =
    diffSnapshot?.productTitle ??
    sourceProduct.title ??
    `Product from ${STAFF_ROLE_CONFIG[notification.sourceRole]?.label ?? notification.sourceRole}`;

  const sourceRoleLabel = STAFF_ROLE_CONFIG[notification.sourceRole]?.label ?? notification.sourceRole;
  const categoryClass = roleCategoryClass(notification.sourceRole);

  const handleAccept = async () => {
    setIsAccepting(true);
    setAcceptError(null);
    try {
      await onAccept();
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Integration failed');
      setIsAccepting(false);
    }
  };

  return (
    <div className="pdv-overlay" role="dialog" aria-modal="true" aria-label="Integration Review">
      <div className="pdv-card">
        {/* ── Header ── */}
        <div className="pdv-header">
          <div className="pdv-header-left">
            <span className="pdv-title">Integration Review</span>
            <span className={`pdv-source-badge pdv-source-badge--${categoryClass}`}>
              {sourceRoleLabel}
            </span>
            <span className="pdv-product-title">{productTitle}</span>
          </div>
          <button
            className="pdv-close-btn"
            onClick={onClose}
            aria-label="Close without action"
            title="Close without action"
          >
            &times;
          </button>
        </div>

        {/* ── Body ── */}
        <div className="pdv-body">

          {/* ── Structured Field Changes ── */}
          <section className="pdv-section">
            <h3 className="pdv-section-title">Structured Field Changes</h3>
            {structuredChanges.length === 0 ? (
              <p className="pdv-no-changes">No structured field changes</p>
            ) : (
              <table className="pdv-changes-table">
                <thead>
                  <tr>
                    <th className="pdv-col-field">Field</th>
                    <th className="pdv-col-old">Previous Value</th>
                    <th className="pdv-col-new">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {structuredChanges.map((change, idx) => (
                    <tr key={idx} className="pdv-change-row">
                      <td className="pdv-cell pdv-cell--field">
                        {change.field}
                      </td>
                      <td className="pdv-cell pdv-cell--old">
                        <span className="pdv-value pdv-value--old">
                          {formatValue(change.oldValue)}
                        </span>
                      </td>
                      <td className="pdv-cell pdv-cell--new">
                        <span className="pdv-value pdv-value--new">
                          {formatValue(change.newValue)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* ── Narrative Content Changes ── */}
          <section className="pdv-section">
            <h3 className="pdv-section-title">Narrative Content Changes</h3>
            {!contentChanged ? (
              <p className="pdv-no-changes">No narrative content changes</p>
            ) : (
              <div className="pdv-content-section">
                {contentSummary && (
                  <div className="pdv-content-summary">
                    <span className="pdv-content-summary-label">Summary of changes:</span>{' '}
                    {contentSummary}
                  </div>
                )}
                <div className={`pdv-content-panels ${targetProduct ? 'pdv-content-panels--split' : ''}`}>
                  <div className="pdv-content-panel">
                    <label className="pdv-content-label">
                      Source Product Content ({sourceRoleLabel})
                    </label>
                    <textarea
                      className="pdv-content-textarea"
                      value={sourceProduct.content}
                      readOnly
                      rows={12}
                      aria-label="Source product content"
                    />
                  </div>
                  {targetProduct && (
                    <div className="pdv-content-panel">
                      <label className="pdv-content-label">
                        Current Content (Your workspace)
                      </label>
                      <textarea
                        className="pdv-content-textarea"
                        value={targetProduct.content}
                        readOnly
                        rows={12}
                        aria-label="Current target content"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

        </div>

        {/* ── Actions ── */}
        {acceptError && (
          <div className="pdv-error">{acceptError}</div>
        )}
        <div className="pdv-actions">
          <button
            className="pdv-btn pdv-btn--accept"
            onClick={handleAccept}
            disabled={isAccepting || notification.isIntegrated}
            title={notification.isIntegrated ? 'Already integrated' : 'Merge source changes into your workspace and mark as integrated'}
          >
            {notification.isIntegrated
              ? 'Already Integrated'
              : isAccepting
              ? 'Integrating...'
              : 'Accept & Integrate'}
          </button>
          <button
            className="pdv-btn pdv-btn--reject"
            onClick={onReject}
            disabled={isAccepting}
            title="Mark as read without integrating"
          >
            Reject
          </button>
          <button
            className="pdv-btn pdv-btn--close"
            onClick={onClose}
            disabled={isAccepting}
            title="Dismiss without any action"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
