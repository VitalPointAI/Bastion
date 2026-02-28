/**
 * CommanderDecisionPanel
 *
 * Phase 14 Plan 08: Commander decision workflow covering all 5 decision types
 * (accept, reject, modify, combine, return for analysis) with blockchain-anchored
 * recording, hash confirmation display, and decision history audit trail.
 *
 * Access control: Action buttons are shown only for commanders / exercise_control.
 * Non-commanders see decisions in read-only mode.
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { ScenarioCOA, CommanderDecision } from '../../types/exercise';
import './CommanderDecisionPanel.css';

// ─── Types ─────────────────────────────────────────────────────────────────────

type DecisionType = CommanderDecision;

interface DecisionRecord {
  coaId: string;
  coaName: string;
  decision: DecisionType;
  notes: string;
  hash: string;
  blockchainTx: string | null;
  timestamp: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatHash(hash: string): string {
  if (hash.length <= 16) return hash;
  return `${hash.slice(0, 16)}...`;
}

function ordinal(n: number): string {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function decisionLabel(decision: DecisionType): string {
  switch (decision) {
    case 'accepted': return 'Accept COA';
    case 'rejected': return 'Reject COA';
    case 'modified': return 'Modify COA';
    case 'combined': return 'Combine COAs';
    case 'returned': return 'Return for Analysis';
  }
}

function decisionColor(decision: DecisionType): string {
  switch (decision) {
    case 'accepted': return '#22c55e';
    case 'rejected': return '#ef4444';
    case 'modified': return '#eab308';
    case 'combined': return '#3b82f6';
    case 'returned': return '#9ca3af';
  }
}

function decisionBg(decision: DecisionType): string {
  switch (decision) {
    case 'accepted': return 'rgba(34, 197, 94, 0.1)';
    case 'rejected': return 'rgba(239, 68, 68, 0.1)';
    case 'modified': return 'rgba(234, 179, 8, 0.1)';
    case 'combined': return 'rgba(59, 130, 246, 0.1)';
    case 'returned': return 'rgba(156, 163, 175, 0.1)';
  }
}

function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#eab308';
  if (score >= 25) return '#f97316';
  return '#ef4444';
}

// ─── COA Summary Card ──────────────────────────────────────────────────────────

interface COASummaryCardProps {
  coa: ScenarioCOA;
  rank?: number;
  isSelected: boolean;
  onSelect: () => void;
  selectable: boolean;
}

function COASummaryCard({ coa, rank, isSelected, onSelect, selectable }: COASummaryCardProps) {
  const combinedScore = coa.combinedScore;

  // Get a brief one-liner from the narrative
  const brief = coa.narrative
    ? coa.narrative.split(/[.\n]/)[0].trim().slice(0, 100)
    : coa.description.split(/[.\n]/)[0].trim().slice(0, 100);

  return (
    <div
      className={`cdp-coa-card ${isSelected ? 'selected' : ''} ${selectable ? 'selectable' : ''}`}
      onClick={selectable ? onSelect : undefined}
    >
      <div className="cdp-coa-card-header">
        <div className="cdp-coa-card-name">
          <span className="cdp-coa-number">COA {coa.number}</span>
          <span className="cdp-coa-name">{coa.name}</span>
        </div>
        <div className="cdp-coa-card-meta">
          {combinedScore !== null && (
            <span
              className="cdp-coa-score"
              style={{ color: getScoreColor(combinedScore) }}
            >
              {combinedScore}
            </span>
          )}
          {rank !== undefined && (
            <span className="cdp-coa-rank">{ordinal(rank)}</span>
          )}
          {coa.commanderDecision && (
            <span
              className="cdp-coa-prev-decision"
              style={{
                color: decisionColor(coa.commanderDecision),
                borderColor: decisionColor(coa.commanderDecision),
              }}
            >
              {coa.commanderDecision}
            </span>
          )}
        </div>
      </div>
      {brief && (
        <div className="cdp-coa-brief">{brief}</div>
      )}
    </div>
  );
}

// ─── Decision Form ─────────────────────────────────────────────────────────────

interface DecisionFormProps {
  decisionType: DecisionType;
  coas: ScenarioCOA[];
  selectedCOAId: string | null;
  onSelectCOA: (id: string) => void;
  notes: string;
  onNotesChange: (text: string) => void;
  combinedElements: Record<string, string[]>;
  onToggleCombineElement: (coaId: string, element: string) => void;
}

const COMBINE_ELEMENTS = [
  { key: 'scheme', label: 'Scheme of Maneuver' },
  { key: 'tasks', label: 'Task Assignments' },
  { key: 'support', label: 'Support Concept' },
];

function DecisionForm({
  decisionType,
  coas,
  selectedCOAId,
  onSelectCOA,
  notes,
  onNotesChange,
  combinedElements,
  onToggleCombineElement,
}: DecisionFormProps) {
  const notesRequired =
    decisionType === 'rejected' ||
    decisionType === 'modified' ||
    decisionType === 'returned';

  const notesLabel: Record<DecisionType, string> = {
    accepted: "Commander's notes (optional)",
    rejected: 'Reason for rejection (required)',
    modified: 'Required modifications (required)',
    combined: 'Combined intent (describe what elements to integrate)',
    returned: 'Additional analysis required (required)',
  };

  const notesPlaceholder: Record<DecisionType, string> = {
    accepted: "e.g., Proceed with COA 2. Execute per the approved plan.",
    rejected:
      'e.g., COA 1 rejected — resource requirements exceed current sustainment capacity.',
    modified:
      'e.g., Accept COA 2 with the following modifications: shift main effort to eastern axis...',
    combined:
      'e.g., Combine COA 1 shaping fires with COA 2 main effort ground scheme.',
    returned:
      'e.g., Return for additional analysis — need updated ISR plan and logistics feasibility check.',
  };

  return (
    <div className="cdp-decision-form">
      {/* COA selection — for accept / reject / modify */}
      {(decisionType === 'accepted' ||
        decisionType === 'rejected' ||
        decisionType === 'modified') && (
        <div className="cdp-form-field">
          <label className="cdp-form-label">
            {decisionType === 'accepted' ? 'Approved COA' :
             decisionType === 'rejected' ? 'COA to Reject' :
             'Base COA for Modification'}
          </label>
          <select
            className="cdp-form-select"
            value={selectedCOAId ?? ''}
            onChange={(e) => onSelectCOA(e.target.value)}
          >
            <option value="">Select a COA...</option>
            {coas.map((coa) => (
              <option key={coa.id} value={coa.id}>
                COA {coa.number} — {coa.name}
                {coa.combinedScore !== null ? ` (score: ${coa.combinedScore})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Combine: element checkboxes per COA */}
      {decisionType === 'combined' && (
        <div className="cdp-form-field">
          <label className="cdp-form-label">Select elements from each COA to combine</label>
          <div className="cdp-combine-grid">
            {coas.map((coa) => (
              <div key={coa.id} className="cdp-combine-coa">
                <div className="cdp-combine-coa-title">
                  COA {coa.number} — {coa.name}
                </div>
                {COMBINE_ELEMENTS.map(({ key, label }) => {
                  const checked = (combinedElements[coa.id] ?? []).includes(key);
                  return (
                    <label key={key} className="cdp-combine-check">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleCombineElement(coa.id, key)}
                      />
                      {label}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes field */}
      <div className="cdp-form-field">
        <label className="cdp-form-label">
          {notesLabel[decisionType]}
          {notesRequired && <span className="cdp-required"> *</span>}
        </label>
        <textarea
          className="cdp-form-textarea"
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder={notesPlaceholder[decisionType]}
          rows={4}
        />
      </div>
    </div>
  );
}

// ─── Decision History Entry ────────────────────────────────────────────────────

function DecisionHistoryEntry({ record }: { record: DecisionRecord }) {
  const [hashCopied, setHashCopied] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(record.hash).catch(() => {});
    setHashCopied(true);
    setTimeout(() => setHashCopied(false), 2000);
  };

  return (
    <div className="cdp-history-entry">
      <div className="cdp-history-dot" style={{ borderColor: decisionColor(record.decision) }} />
      <div className="cdp-history-body">
        <div className="cdp-history-header">
          <span
            className="cdp-history-decision"
            style={{ color: decisionColor(record.decision) }}
          >
            {decisionLabel(record.decision)}
          </span>
          <span className="cdp-history-coa">{record.coaName}</span>
          <span className="cdp-history-time">
            {new Date(record.timestamp).toLocaleString()}
          </span>
        </div>
        {record.notes && (
          <div className="cdp-history-notes">{record.notes}</div>
        )}
        <div className="cdp-history-hash">
          <span className="cdp-hash-label">SHA-256:</span>
          <span className="cdp-hash-value">{formatHash(record.hash)}</span>
          <button
            className="cdp-copy-hash-btn"
            onClick={handleCopyHash}
            title="Copy full hash to clipboard"
          >
            {hashCopied ? 'Copied!' : '\u29C1'}
          </button>
          {record.blockchainTx ? (
            <span className="cdp-blockchain-status anchored">
              Anchored — tx: {record.blockchainTx.slice(0, 12)}...
            </span>
          ) : (
            <span className="cdp-blockchain-status pending">
              Blockchain anchoring pending
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Confirmation Display ──────────────────────────────────────────────────────

interface DecisionConfirmationProps {
  decision: DecisionType;
  coaName: string;
  hash: string;
  timestamp: string;
}

function DecisionConfirmation({ decision, coaName, hash, timestamp }: DecisionConfirmationProps) {
  const [hashCopied, setHashCopied] = useState(false);

  const handleCopyHash = () => {
    navigator.clipboard.writeText(hash).catch(() => {});
    setHashCopied(true);
    setTimeout(() => setHashCopied(false), 2000);
  };

  return (
    <div className="cdp-confirmation" style={{ borderColor: decisionColor(decision) }}>
      <div className="cdp-confirmation-header">
        <span className="cdp-confirmation-icon" style={{ color: decisionColor(decision) }}>
          &#10003;
        </span>
        <div>
          <div className="cdp-confirmation-title" style={{ color: decisionColor(decision) }}>
            {decisionLabel(decision)} — Recorded
          </div>
          <div className="cdp-confirmation-coa">{coaName}</div>
        </div>
      </div>
      <div className="cdp-confirmation-hash">
        <div className="cdp-hash-row">
          <span className="cdp-hash-label">SHA-256 Hash:</span>
          <code className="cdp-hash-code">{formatHash(hash)}</code>
          <button
            className="cdp-copy-hash-btn"
            onClick={handleCopyHash}
            title="Copy full hash"
          >
            {hashCopied ? 'Copied!' : '\u29C1'}
          </button>
        </div>
        <div className="cdp-blockchain-pending">
          <span className="cdp-pending-dot" />
          Blockchain anchoring pending — outbox will sync
        </div>
        <div className="cdp-confirmation-time">
          Recorded at {new Date(timestamp).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface CommanderDecisionPanelProps {
  scenarioId: string;
  perspective: 'blue' | 'red';
  exercisePhase: string;
  coas: ScenarioCOA[];
  /** Whether the current user has commander authority to record decisions */
  exerciseRole?: 'blue_staff' | 'red_cell' | 'exercise_control' | string;
}

export function CommanderDecisionPanel({
  scenarioId: _scenarioId,
  perspective,
  exercisePhase,
  coas,
  exerciseRole,
}: CommanderDecisionPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [selectedDecision, setSelectedDecision] = useState<DecisionType | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [selectedCOAId, setSelectedCOAId] = useState<string | null>(null);
  const [combinedElements, setCombinedElements] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [decisionResult, setDecisionResult] = useState<{
    hash: string;
    decision: DecisionType;
    coaName: string;
    timestamp: string;
  } | null>(null);

  // Decision history (built from COA state)
  const [decisionHistory, setDecisionHistory] = useState<DecisionRecord[]>([]);

  // ── Derive commander authority ─────────────────────────────────────────────
  // exercise_control and any commander role can record decisions
  const isCommander =
    exerciseRole === 'exercise_control' || exerciseRole === 'commander';

  // ── Derive rankings from COA combined scores ───────────────────────────────
  const ranked = [...coas]
    .filter((c) => c.combinedScore !== null)
    .sort((a, b) => (b.combinedScore ?? 0) - (a.combinedScore ?? 0));

  const rankMap: Record<string, number> = {};
  ranked.forEach((c, i) => { rankMap[c.id] = i + 1; });

  // ── Reload decision history from COA state ─────────────────────────────────
  useEffect(() => {
    const history: DecisionRecord[] = coas
      .filter((c) => c.commanderDecision !== null && c.decisionHash !== null)
      .map((c) => ({
        coaId: c.id,
        coaName: c.name,
        decision: c.commanderDecision as DecisionType,
        notes: c.commanderDecisionNotes ?? '',
        hash: c.decisionHash as string,
        blockchainTx: c.blockchainTx,
        timestamp: c.updatedAt,
      }));
    setDecisionHistory(history);
  }, [coas]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSelectDecisionType = (type: DecisionType) => {
    // Toggle if same type clicked again
    if (selectedDecision === type) {
      setSelectedDecision(null);
      setSelectedCOAId(null);
      setDecisionNotes('');
      setCombinedElements({});
    } else {
      setSelectedDecision(type);
      setSelectedCOAId(null);
      setDecisionNotes('');
      setCombinedElements({});
      setDecisionResult(null);
    }
    setSubmitError(null);
  };

  const handleToggleCombineElement = (coaId: string, element: string) => {
    setCombinedElements((prev) => {
      const current = prev[coaId] ?? [];
      const updated = current.includes(element)
        ? current.filter((e) => e !== element)
        : [...current, element];
      return { ...prev, [coaId]: updated };
    });
  };

  const isSubmitDisabled = (): boolean => {
    if (!selectedDecision) return true;
    if (submitting) return true;

    // Notes required for reject, modify, return
    const notesRequired =
      selectedDecision === 'rejected' ||
      selectedDecision === 'modified' ||
      selectedDecision === 'returned';
    if (notesRequired && !decisionNotes.trim()) return true;

    // COA required for accept / reject / modify
    if (
      (selectedDecision === 'accepted' ||
        selectedDecision === 'rejected' ||
        selectedDecision === 'modified') &&
      !selectedCOAId
    ) return true;

    // Combine needs at least one element selected
    if (selectedDecision === 'combined') {
      const totalSelected = Object.values(combinedElements).flat().length;
      if (totalSelected === 0) return true;
    }

    return false;
  };

  const handleSubmit = async () => {
    if (!selectedDecision || isSubmitDisabled()) return;

    // Determine target COA
    // For 'combined' and 'returned', we may not have a single coaId;
    // use the first selected COA or the first scored COA as the record target
    const targetCoaId =
      selectedCOAId ??
      coas.find((c) => c.combinedScore !== null)?.id ??
      coas[0]?.id;

    if (!targetCoaId) {
      setSubmitError('No COA available to record decision against.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await exerciseService.recordDecision(
        targetCoaId,
        selectedDecision,
        decisionNotes
      );
      const coaName = coas.find((c) => c.id === targetCoaId)?.name ?? 'Unknown COA';
      const timestamp = new Date().toISOString();

      setDecisionResult({
        hash: result.hash,
        decision: selectedDecision,
        coaName,
        timestamp,
      });

      // Prepend to local history
      setDecisionHistory((prev) => [
        {
          coaId: targetCoaId,
          coaName,
          decision: selectedDecision,
          notes: decisionNotes,
          hash: result.hash,
          blockchainTx: null,
          timestamp,
        },
        ...prev,
      ]);

      // Reset form
      setSelectedDecision(null);
      setSelectedCOAId(null);
      setDecisionNotes('');
      setCombinedElements({});
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to record decision');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const DECISION_TYPES: DecisionType[] = [
    'accepted',
    'rejected',
    'modified',
    'combined',
    'returned',
  ];

  return (
    <div className="cdp-panel">

      {/* ── COA Summary Row ─────────────────────────────────────────────── */}
      <section className="cdp-section">
        <div className="cdp-section-header">
          <h3 className="cdp-section-title">
            COA Summary
            <span className={`cdp-perspective-tag cdp-perspective-tag--${perspective}`}>
              {perspective === 'blue' ? 'Blue Force' : 'Red Cell'}
            </span>
            <span className="cdp-phase-tag">{exercisePhase}</span>
          </h3>
        </div>

        {coas.length === 0 ? (
          <div className="cdp-empty">
            No COAs available. Create and score COAs in the COA Scoring tab first.
          </div>
        ) : (
          <div className="cdp-coa-summary-row">
            {coas.map((coa) => (
              <COASummaryCard
                key={coa.id}
                coa={coa}
                rank={rankMap[coa.id]}
                isSelected={selectedCOAId === coa.id}
                onSelect={() => setSelectedCOAId(coa.id)}
                selectable={
                  isCommander &&
                  selectedDecision !== null &&
                  selectedDecision !== 'combined' &&
                  selectedDecision !== 'returned'
                }
              />
            ))}
          </div>
        )}
      </section>

      {/* ── Decision confirmation (shown after submit) ───────────────── */}
      {decisionResult && (
        <DecisionConfirmation
          decision={decisionResult.decision}
          coaName={decisionResult.coaName}
          hash={decisionResult.hash}
          timestamp={decisionResult.timestamp}
        />
      )}

      {/* ── Decision Actions ─────────────────────────────────────────── */}
      <section className="cdp-section">
        <div className="cdp-section-header">
          <h3 className="cdp-section-title">Commander Decision</h3>
          {!isCommander && (
            <span className="cdp-read-only-badge">Read-Only</span>
          )}
        </div>

        {isCommander ? (
          <>
            {/* Decision type buttons */}
            <div className="cdp-decision-buttons">
              {DECISION_TYPES.map((type) => (
                <button
                  key={type}
                  className={`cdp-decision-btn cdp-decision-btn--${type} ${
                    selectedDecision === type ? 'active' : ''
                  }`}
                  onClick={() => handleSelectDecisionType(type)}
                  style={
                    selectedDecision === type
                      ? {
                          background: decisionBg(type),
                          borderColor: decisionColor(type),
                          color: decisionColor(type),
                        }
                      : {}
                  }
                >
                  {decisionLabel(type)}
                </button>
              ))}
            </div>

            {/* Decision details form */}
            {selectedDecision && (
              <DecisionForm
                decisionType={selectedDecision}
                coas={coas}
                selectedCOAId={selectedCOAId}
                onSelectCOA={setSelectedCOAId}
                notes={decisionNotes}
                onNotesChange={setDecisionNotes}
                combinedElements={combinedElements}
                onToggleCombineElement={handleToggleCombineElement}
              />
            )}

            {/* Submit error */}
            {submitError && (
              <div className="cdp-error">{submitError}</div>
            )}

            {/* Submit button */}
            {selectedDecision && (
              <div className="cdp-submit-row">
                <button
                  className="cdp-btn-cancel"
                  onClick={() => {
                    setSelectedDecision(null);
                    setSubmitError(null);
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className={`cdp-btn-submit cdp-btn-submit--${selectedDecision}`}
                  onClick={handleSubmit}
                  disabled={isSubmitDisabled()}
                  style={
                    !isSubmitDisabled()
                      ? {
                          background: decisionBg(selectedDecision),
                          borderColor: decisionColor(selectedDecision),
                          color: decisionColor(selectedDecision),
                        }
                      : {}
                  }
                >
                  {submitting
                    ? 'Recording...'
                    : `Submit: ${decisionLabel(selectedDecision)}`}
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="cdp-no-authority">
            Commander authority required to record decisions.
            Decisions can be viewed in the history below.
          </div>
        )}
      </section>

      {/* ── Decision History ──────────────────────────────────────────── */}
      {decisionHistory.length > 0 && (
        <section className="cdp-section">
          <div className="cdp-section-header">
            <h3 className="cdp-section-title">
              Decision History
              <span className="cdp-history-count">{decisionHistory.length}</span>
            </h3>
          </div>
          <div className="cdp-history-timeline">
            {decisionHistory.map((record, idx) => (
              <DecisionHistoryEntry key={`${record.coaId}-${idx}`} record={record} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Wired into ExerciseDashboard via scenarioId prop ─────────────────────────
// Usage: <CommanderDecisionPanel scenarioId={...} perspective={...}
//           exercisePhase={...} coas={scoredCOAs} exerciseRole={userRole} />
