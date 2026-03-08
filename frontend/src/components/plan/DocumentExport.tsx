/**
 * DocumentExport
 *
 * Phase 33 Plan 10: Export panel within JPP Step 7 (PlanOrderDevelopment).
 * Provides format selection (PDF/DOCX), annex picker, version lifecycle
 * management, and distribution to subordinate problem sets.
 *
 * Only visible after plan has been approved through governance gate.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  documentService,
  type DocumentFormat,
  type VersionStatus,
  type VersionRecord,
  type DistributionRecord,
} from '../../lib/document-service.ts';

// ─── Types ──────────────────────────────────────────────────────────────────

type PlanType = 'OPLAN' | 'OPORD' | 'CONPLAN' | 'FRAGORD' | 'CAMPAIGN_PLAN';

interface DocumentExportProps {
  problemSetId: string;
  jppInstanceId: string;
  planId: string;
  planType: PlanType;
  currentRole: string;
  availableAnnexes?: Array<{ letter: string; title: string }>;
  childProblemSets?: Array<{ id: string; name: string }>;
}

// ─── Role Gating ────────────────────────────────────────────────────────────

const EXPORT_ROLES = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j34', 'fires_coordinator', 'commander', 'xo'];
const DRAFT_PROMOTE_ROLES = ['j3', 'j5'];
const FINAL_PROMOTE_ROLES = ['commander', 'xo'];
const DISTRIBUTE_ROLES = ['j3', 'j5', 'commander'];

function canExport(role: string): boolean {
  return EXPORT_ROLES.includes(role);
}

function canPromoteDraft(role: string): boolean {
  return DRAFT_PROMOTE_ROLES.includes(role);
}

function canPromoteToFinal(role: string): boolean {
  return FINAL_PROMOTE_ROLES.includes(role);
}

function canDistribute(role: string): boolean {
  return DISTRIBUTE_ROLES.includes(role);
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const sectionStyle: React.CSSProperties = {
  backgroundColor: 'rgba(31, 41, 55, 0.5)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.375rem',
  padding: '0.75rem',
  marginBottom: '0.75rem',
};

const headingStyle: React.CSSProperties = {
  fontSize: '0.85rem',
  fontWeight: 600,
  color: '#e5e7eb',
  marginBottom: '0.5rem',
};

const subTextStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  color: '#6b7280',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  fontSize: '0.78rem',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
  cursor: 'pointer',
  fontWeight: 500,
};

const successButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'rgba(16, 185, 129, 0.15)',
  border: '1px solid rgba(16, 185, 129, 0.3)',
  color: '#6ee7b7',
};

const dangerButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  color: '#fca5a5',
};

const badgeBase: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.15rem 0.4rem',
  borderRadius: '0.25rem',
  fontSize: '0.65rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

function statusBadge(status: VersionStatus): React.CSSProperties {
  const colors: Record<VersionStatus, { bg: string; border: string; color: string }> = {
    draft: { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.4)', color: '#9ca3af' },
    coordinating_draft: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' },
    final: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.3)', color: '#6ee7b7' },
  };
  const c = colors[status] || colors.draft;
  return { ...badgeBase, backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.color };
}

const statusLabels: Record<VersionStatus, string> = {
  draft: 'Draft',
  coordinating_draft: 'Coordinating Draft',
  final: 'Final',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function DocumentExport({
  problemSetId,
  jppInstanceId: _jppInstanceId,
  planId,
  planType,
  currentRole,
  availableAnnexes = [],
  childProblemSets = [],
}: DocumentExportProps) {
  // Export state
  const [format, setFormat] = useState<DocumentFormat>('pdf');
  const [selectedAnnexes, setSelectedAnnexes] = useState<Set<string>>(
    new Set(availableAnnexes.map((a) => a.letter)),
  );
  const [generating, setGenerating] = useState(false);

  // Version state
  const [versions, setVersions] = useState<VersionRecord[]>([]);
  const [currentStatus, setCurrentStatus] = useState<VersionStatus>('draft');
  const [versionNotes, setVersionNotes] = useState('');
  const [promoting, setPromoting] = useState(false);

  // Distribution state
  const [selectedTargets, setSelectedTargets] = useState<Set<string>>(new Set());
  const [distributing, setDistributing] = useState(false);
  const [distributions, setDistributions] = useState<DistributionRecord[]>([]);

  // Load versions and distributions
  const loadData = useCallback(async () => {
    try {
      const [vers, dists] = await Promise.all([
        documentService.getVersions(problemSetId, planId),
        documentService.getDistributions(problemSetId, planId),
      ]);
      setVersions(vers);
      setDistributions(dists);

      // Determine current status from latest version
      if (vers.length > 0) {
        setCurrentStatus(vers[0].status);
      }
    } catch (err) {
      console.error('[DocumentExport] Failed to load data:', err);
    }
  }, [problemSetId, planId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Annex toggle
  const toggleAnnex = (letter: string) => {
    setSelectedAnnexes((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  // Export/download
  const handleExport = async (preview: boolean) => {
    if (!canExport(currentRole)) return;
    setGenerating(true);
    try {
      const blob = await documentService.generateDocument(
        problemSetId,
        planId,
        format,
        Array.from(selectedAnnexes),
        planType,
      );

      if (preview && format === 'pdf') {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${planType}_${planId}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('[DocumentExport] Export failed:', err);
    } finally {
      setGenerating(false);
    }
  };

  // Version promotion
  const handlePromote = async () => {
    let nextStatus: VersionStatus;
    if (currentStatus === 'draft') {
      if (!canPromoteDraft(currentRole)) return;
      nextStatus = 'coordinating_draft';
    } else if (currentStatus === 'coordinating_draft') {
      if (!canPromoteToFinal(currentRole)) return;
      nextStatus = 'final';
    } else {
      return; // Already final
    }

    setPromoting(true);
    try {
      await documentService.createVersion(
        problemSetId,
        planId,
        nextStatus,
        versionNotes || undefined,
      );
      setCurrentStatus(nextStatus);
      setVersionNotes('');
      await loadData();
    } catch (err) {
      console.error('[DocumentExport] Promotion failed:', err);
    } finally {
      setPromoting(false);
    }
  };

  // Distribution
  const toggleTarget = (psId: string) => {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(psId)) next.delete(psId);
      else next.add(psId);
      return next;
    });
  };

  const handleDistribute = async () => {
    if (!canDistribute(currentRole) || selectedTargets.size === 0) return;

    const latestFinal = versions.find((v) => v.status === 'final');
    if (!latestFinal) return;

    setDistributing(true);
    try {
      await documentService.distribute(
        problemSetId,
        planId,
        latestFinal.versionId,
        Array.from(selectedTargets),
      );
      setSelectedTargets(new Set());
      await loadData();
    } catch (err) {
      console.error('[DocumentExport] Distribution failed:', err);
    } finally {
      setDistributing(false);
    }
  };

  // Determine next promotion action label
  const nextPromotionLabel =
    currentStatus === 'draft'
      ? 'Promote to Coordinating Draft'
      : currentStatus === 'coordinating_draft'
        ? 'Promote to Final'
        : null;

  const canPromote =
    (currentStatus === 'draft' && canPromoteDraft(currentRole)) ||
    (currentStatus === 'coordinating_draft' && canPromoteToFinal(currentRole));

  return (
    <div>
      {/* Section 1: Export */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Document Export</div>

        {/* Format toggle */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
          {(['pdf', 'docx'] as DocumentFormat[]).map((f) => (
            <label
              key={f}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.8rem',
                color: '#e5e7eb',
                cursor: 'pointer',
              }}
            >
              <input
                type="radio"
                name="doc-format"
                value={f}
                checked={format === f}
                onChange={() => setFormat(f)}
                style={{ accentColor: '#3b82f6' }}
              />
              {f.toUpperCase()}
            </label>
          ))}
        </div>

        {/* Annex checklist */}
        {availableAnnexes.length > 0 && (
          <div style={{ marginBottom: '0.5rem' }}>
            <div style={subTextStyle}>Include Annexes:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
              {availableAnnexes.map((a) => (
                <label
                  key={a.letter}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                    fontSize: '0.75rem',
                    color: '#d1d5db',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedAnnexes.has(a.letter)}
                    onChange={() => toggleAnnex(a.letter)}
                    style={{ accentColor: '#3b82f6' }}
                  />
                  {a.letter} - {a.title}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {format === 'pdf' && (
            <button
              onClick={() => handleExport(true)}
              disabled={generating || !canExport(currentRole)}
              style={{ ...buttonStyle, opacity: canExport(currentRole) ? 1 : 0.4 }}
            >
              {generating ? 'Generating...' : 'Preview'}
            </button>
          )}
          <button
            onClick={() => handleExport(false)}
            disabled={generating || !canExport(currentRole)}
            style={{ ...successButtonStyle, opacity: canExport(currentRole) ? 1 : 0.4 }}
          >
            {generating ? 'Generating...' : `Download ${format.toUpperCase()}`}
          </button>
        </div>

        {!canExport(currentRole) && (
          <div style={{ ...subTextStyle, marginTop: '0.25rem', color: '#f59e0b' }}>
            Export requires a staff role.
          </div>
        )}
      </div>

      {/* Section 2: Version Lifecycle */}
      <div style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={headingStyle}>Version Lifecycle</span>
          <span style={statusBadge(currentStatus)}>
            {statusLabels[currentStatus]}
          </span>
        </div>

        {nextPromotionLabel && (
          <div>
            <textarea
              value={versionNotes}
              onChange={(e) => setVersionNotes(e.target.value)}
              placeholder="Version notes (optional)..."
              style={{
                width: '100%',
                minHeight: '2.5rem',
                backgroundColor: 'rgba(17, 24, 39, 0.6)',
                border: '1px solid rgba(75, 85, 99, 0.5)',
                borderRadius: '0.25rem',
                color: '#e5e7eb',
                padding: '0.375rem',
                fontSize: '0.78rem',
                resize: 'vertical',
                marginBottom: '0.375rem',
              }}
            />
            <button
              onClick={handlePromote}
              disabled={promoting || !canPromote}
              style={{ ...successButtonStyle, opacity: canPromote ? 1 : 0.4 }}
            >
              {promoting ? 'Promoting...' : nextPromotionLabel}
            </button>
            {!canPromote && (
              <div style={{ ...subTextStyle, marginTop: '0.25rem', color: '#f59e0b' }}>
                {currentStatus === 'draft'
                  ? 'Requires J3 or J5 role to promote draft.'
                  : 'Requires Commander or XO role to finalize.'}
              </div>
            )}
          </div>
        )}

        {currentStatus === 'final' && (
          <div style={{ fontSize: '0.78rem', color: '#6ee7b7' }}>
            Plan has been finalized and is ready for distribution.
          </div>
        )}
      </div>

      {/* Section 3: Distribution (only when final) */}
      {currentStatus === 'final' && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Distribution</div>

          {childProblemSets.length > 0 ? (
            <div>
              <div style={{ ...subTextStyle, marginBottom: '0.375rem' }}>
                Select subordinate problem sets to receive this plan as HQ guidance:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.5rem' }}>
                {childProblemSets.map((ps) => (
                  <label
                    key={ps.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      fontSize: '0.78rem',
                      color: '#d1d5db',
                      cursor: canDistribute(currentRole) ? 'pointer' : 'default',
                      opacity: canDistribute(currentRole) ? 1 : 0.5,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTargets.has(ps.id)}
                      onChange={() => toggleTarget(ps.id)}
                      disabled={!canDistribute(currentRole)}
                      style={{ accentColor: '#10b981' }}
                    />
                    {ps.name}
                  </label>
                ))}
              </div>
              <button
                onClick={handleDistribute}
                disabled={distributing || selectedTargets.size === 0 || !canDistribute(currentRole)}
                style={{
                  ...dangerButtonStyle,
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  color: '#6ee7b7',
                  opacity: canDistribute(currentRole) && selectedTargets.size > 0 ? 1 : 0.4,
                }}
              >
                {distributing ? 'Distributing...' : 'Distribute as HQ Guidance'}
              </button>

              {!canDistribute(currentRole) && (
                <div style={{ ...subTextStyle, marginTop: '0.25rem', color: '#f59e0b' }}>
                  Requires J3, J5, or Commander role to distribute.
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              No subordinate problem sets available for distribution.
            </div>
          )}

          {/* Distribution log */}
          {distributions.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div style={{ ...subTextStyle, marginBottom: '0.25rem' }}>Distribution History:</div>
              {distributions.map((d, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: '0.72rem',
                    color: '#9ca3af',
                    padding: '0.25rem 0',
                    borderBottom: '1px solid rgba(75, 85, 99, 0.2)',
                  }}
                >
                  <span style={{ color: '#6ee7b7' }}>{d.targetProblemSetId}</span>
                  {' -- '}
                  {new Date(d.distributedAt).toLocaleString()}
                  {' by '}
                  {d.distributedBy}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
