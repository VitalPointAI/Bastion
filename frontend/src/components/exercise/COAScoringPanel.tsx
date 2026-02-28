/**
 * COAScoringPanel
 *
 * Phase 14 Plan 08: COA decision matrix, editable AI-generated narrative,
 * and wargame integration for staff use before commander review.
 *
 * Sections:
 *  1. COA list with creation form, score trigger, and comparison checkboxes
 *  2. Decision matrix table with color-coded FASDC criterion scores
 *  3. Staff-editable AI narrative and ranking summary
 */

import { useState, useEffect, useCallback } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type {
  ScenarioCOA,
  COAComparisonResult,
  CreateCOAInput,
  ExerciseCOAScore,
} from '../../types/exercise';
import './COAScoringPanel.css';

// ─── Score Color Scale ──────────────────────────────────────────────────────────

function getScoreColor(score: number): string {
  if (score >= 75) return '#22c55e'; // green
  if (score >= 50) return '#eab308'; // yellow
  if (score >= 25) return '#f97316'; // orange
  return '#ef4444'; // red
}

function getScoreBg(score: number): string {
  if (score >= 75) return 'rgba(34, 197, 94, 0.12)';
  if (score >= 50) return 'rgba(234, 179, 8, 0.12)';
  if (score >= 25) return 'rgba(249, 115, 22, 0.12)';
  return 'rgba(239, 68, 68, 0.12)';
}

// ─── Score Bar ─────────────────────────────────────────────────────────────────

function ScoreBar({ score }: { score: number }) {
  return (
    <div className="coa-score-bar-track">
      <div
        className="coa-score-bar-fill"
        style={{ width: `${score}%`, background: getScoreColor(score) }}
      />
    </div>
  );
}

// ─── Score Cell ────────────────────────────────────────────────────────────────

function ScoreCell({ score }: { score: number }) {
  return (
    <td
      className="coa-matrix-cell"
      style={{ background: getScoreBg(score) }}
      title={`Score: ${score}/100`}
    >
      <span className="coa-matrix-score" style={{ color: getScoreColor(score) }}>
        {score}
      </span>
      <ScoreBar score={score} />
    </td>
  );
}

// ─── Ranking Badge ─────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  const colors: Record<number, string> = {
    1: '#fbbf24',
    2: '#9ca3af',
    3: '#cd7c2f',
  };
  const color = colors[rank] ?? 'var(--text-muted, #666678)';
  return (
    <span className="coa-rank-badge" style={{ color, borderColor: color }}>
      {rank === 1 ? '1st' : rank === 2 ? '2nd' : rank === 3 ? '3rd' : `${rank}th`}
    </span>
  );
}

// ─── Decision Status Badge ──────────────────────────────────────────────────────

function DecisionBadge({ decision }: { decision: string | null }) {
  if (!decision) return null;
  const colors: Record<string, string> = {
    accepted: '#22c55e',
    rejected: '#ef4444',
    modified: '#eab308',
    combined: '#3b82f6',
    returned: '#9ca3af',
  };
  const color = colors[decision] ?? 'var(--text-muted)';
  return (
    <span className="coa-decision-badge" style={{ color, borderColor: color }}>
      {decision.charAt(0).toUpperCase() + decision.slice(1)}
    </span>
  );
}

// ─── COA Detail Pane (expandable) ─────────────────────────────────────────────

interface COADetailProps {
  coa: ScenarioCOA;
  editingNarrative: string | undefined;
  onNarrativeChange: (coaId: string, text: string) => void;
  onNarrativeSave: (coaId: string) => void;
  savingNarrative: boolean;
}

function COADetailPane({
  coa,
  editingNarrative,
  onNarrativeChange,
  onNarrativeSave,
  savingNarrative,
}: COADetailProps) {
  const scores = coa.doctScores;
  const criteria: Array<{ key: keyof ExerciseCOAScore; label: string }> = [
    { key: 'feasibility', label: 'Feasibility' },
    { key: 'acceptability', label: 'Acceptability' },
    { key: 'suitability', label: 'Suitability' },
    { key: 'distinguishability', label: 'Distinguishability' },
    { key: 'completeness', label: 'Completeness' },
  ];

  const narrativeText = editingNarrative ?? coa.narrative ?? '';
  const isEdited = narrativeText !== (coa.narrative ?? '');

  return (
    <div className="coa-detail-pane">
      {/* Criteria breakdown */}
      {scores && (
        <div className="coa-criteria-list">
          <div className="coa-criteria-header">FASDC Criteria Breakdown</div>
          {criteria.map(({ key, label }) => {
            const criterion = scores[key] as { score: number; rationale: string; wargameEvidence?: string } | undefined;
            if (!criterion) return null;
            return (
              <div key={key} className="coa-criterion-row">
                <div className="coa-criterion-label">{label}</div>
                <div className="coa-criterion-score-wrap">
                  <span
                    className="coa-criterion-score"
                    style={{ color: getScoreColor(criterion.score) }}
                  >
                    {criterion.score}
                  </span>
                  <ScoreBar score={criterion.score} />
                </div>
                <div className="coa-criterion-rationale">{criterion.rationale}</div>
                {criterion.wargameEvidence && (
                  <div className="coa-criterion-wargame">
                    <span className="coa-wargame-label">Wargame evidence:</span>{' '}
                    {criterion.wargameEvidence}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* COA narrative (inline edit) */}
      <div className="coa-narrative-section">
        <div className="coa-narrative-header">
          <span>COA Narrative</span>
          <span className={`coa-ai-badge ${isEdited ? 'edited' : ''}`}>
            {isEdited ? 'Edited' : 'AI Generated'}
          </span>
        </div>
        <textarea
          className="coa-narrative-textarea"
          value={narrativeText}
          onChange={(e) => onNarrativeChange(coa.id, e.target.value)}
          placeholder="No narrative yet — run scoring to generate an AI narrative."
          rows={5}
        />
        <button
          className="coa-save-narrative-btn"
          onClick={() => onNarrativeSave(coa.id)}
          disabled={savingNarrative || !isEdited}
        >
          {savingNarrative ? 'Saving...' : 'Save Narrative'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

interface COAScoringPanelProps {
  scenarioId: string;
  perspective: 'blue' | 'red';
  exercisePhase: string;
}

export function COAScoringPanel({
  scenarioId,
  perspective,
  exercisePhase,
}: COAScoringPanelProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [coas, setCOAs] = useState<ScenarioCOA[]>([]);
  const [comparison, setComparison] = useState<COAComparisonResult | null>(null);
  const [editingNarrative, setEditingNarrative] = useState<Record<string, string>>({});
  const [scoring, setScoring] = useState<Record<string, boolean>>({});
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [expandedCOAId, setExpandedCOAId] = useState<string | null>(null);

  // Load state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Compare state
  const [comparing, setComparing] = useState(false);
  const [compareError, setCompareError] = useState<string | null>(null);

  // Save narrative state (per-coa)
  const [savingNarrative, setSavingNarrative] = useState<Record<string, boolean>>({});

  // Create COA form
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createScheme, setCreateScheme] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Load COAs ──────────────────────────────────────────────────────────────
  const loadCOAs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await exerciseService.getCOAs(scenarioId, {
        team: perspective,
        phase: exercisePhase,
      });
      setCOAs(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load COAs');
    } finally {
      setLoading(false);
    }
  }, [scenarioId, perspective, exercisePhase]);

  useEffect(() => {
    loadCOAs();
  }, [loadCOAs]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleToggleComparison = (coaId: string) => {
    setSelectedForComparison((prev) =>
      prev.includes(coaId) ? prev.filter((id) => id !== coaId) : [...prev, coaId]
    );
  };

  const handleScore = async (coaId: string) => {
    setScoring((prev) => ({ ...prev, [coaId]: true }));
    try {
      await exerciseService.scoreCOA(coaId);
      // Reload to get updated doctScores
      await loadCOAs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to score COA');
    } finally {
      setScoring((prev) => ({ ...prev, [coaId]: false }));
    }
  };

  const handleCompare = async () => {
    if (selectedForComparison.length < 2) return;
    setComparing(true);
    setCompareError(null);
    try {
      const result = await exerciseService.compareCOAs(selectedForComparison);
      setComparison(result);
    } catch (err) {
      setCompareError(err instanceof Error ? err.message : 'Failed to compare COAs');
    } finally {
      setComparing(false);
    }
  };

  const handleNarrativeChange = (coaId: string, text: string) => {
    setEditingNarrative((prev) => ({ ...prev, [coaId]: text }));
  };

  const handleNarrativeSave = async (coaId: string) => {
    const text = editingNarrative[coaId];
    if (text === undefined) return;
    setSavingNarrative((prev) => ({ ...prev, [coaId]: true }));
    try {
      await exerciseService.updateNarrative(coaId, text);
      // Update local COA state
      setCOAs((prev) =>
        prev.map((c) => (c.id === coaId ? { ...c, narrative: text } : c))
      );
      // Clear edit buffer after save
      setEditingNarrative((prev) => {
        const next = { ...prev };
        delete next[coaId];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save narrative');
    } finally {
      setSavingNarrative((prev) => ({ ...prev, [coaId]: false }));
    }
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const input: CreateCOAInput = {
        team: perspective,
        exercisePhase,
        number: coas.length + 1,
        name: createName.trim(),
        description: createDescription.trim(),
        scheme: createScheme.trim(),
      };
      const newCOA = await exerciseService.createCOA(scenarioId, input);
      setCOAs((prev) => [...prev, newCOA]);
      setCreateName('');
      setCreateDescription('');
      setCreateScheme('');
      setShowCreateForm(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create COA');
    } finally {
      setCreating(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  // Build ranking map from comparison result
  const rankingMap: Record<string, number> = {};
  if (comparison) {
    for (const r of comparison.rankings) {
      rankingMap[r.coaId] = r.rank;
    }
  }

  // COAs selected for the matrix
  const matrixCOAs = comparison
    ? coas.filter((c) => selectedForComparison.includes(c.id))
    : [];

  const CRITERIA_KEYS: Array<{ key: keyof ExerciseCOAScore; label: string }> = [
    { key: 'feasibility', label: 'Feasibility' },
    { key: 'acceptability', label: 'Acceptability' },
    { key: 'suitability', label: 'Suitability' },
    { key: 'distinguishability', label: 'Distinguishability' },
    { key: 'completeness', label: 'Completeness' },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="coa-scoring-panel">
        <div className="coa-loading">Loading COAs...</div>
      </div>
    );
  }

  return (
    <div className="coa-scoring-panel">

      {/* ── Section 1: COA List ─────────────────────────────────────────── */}
      <section className="coa-section">
        <div className="coa-section-header">
          <h3 className="coa-section-title">
            Courses of Action
            <span className={`coa-perspective-tag coa-perspective-tag--${perspective}`}>
              {perspective === 'blue' ? 'Blue Force' : 'Red Cell'}
            </span>
            <span className="coa-phase-tag">{exercisePhase}</span>
          </h3>
          <button
            className="coa-create-btn"
            onClick={() => setShowCreateForm((prev) => !prev)}
          >
            {showCreateForm ? 'Cancel' : '+ Create COA'}
          </button>
        </div>

        {/* Error banner */}
        {error && <div className="coa-error">{error}</div>}

        {/* Inline create form */}
        {showCreateForm && (
          <div className="coa-create-form">
            <div className="coa-form-field">
              <label>Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="e.g., COA 1 — Decisive Strike"
              />
            </div>
            <div className="coa-form-field">
              <label>Description</label>
              <textarea
                value={createDescription}
                onChange={(e) => setCreateDescription(e.target.value)}
                placeholder="Describe the course of action..."
                rows={3}
              />
            </div>
            <div className="coa-form-field">
              <label>Scheme of Maneuver</label>
              <textarea
                value={createScheme}
                onChange={(e) => setCreateScheme(e.target.value)}
                placeholder="Describe the scheme of maneuver..."
                rows={3}
              />
            </div>
            {createError && <div className="coa-error">{createError}</div>}
            <div className="coa-form-actions">
              <button
                className="coa-btn-secondary"
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateError(null);
                }}
                disabled={creating}
              >
                Cancel
              </button>
              <button
                className="coa-btn-primary"
                onClick={handleCreate}
                disabled={creating || !createName.trim()}
              >
                {creating ? 'Creating...' : 'Create COA'}
              </button>
            </div>
          </div>
        )}

        {/* COA rows */}
        {coas.length === 0 ? (
          <div className="coa-empty">No COAs yet. Create the first COA above.</div>
        ) : (
          <div className="coa-list">
            {coas.map((coa) => {
              const isExpanded = expandedCOAId === coa.id;
              const isScoring = scoring[coa.id] ?? false;
              const rank = rankingMap[coa.id];

              return (
                <div
                  key={coa.id}
                  className={`coa-row ${isExpanded ? 'expanded' : ''}`}
                >
                  <div
                    className="coa-row-header"
                    onClick={() => setExpandedCOAId(isExpanded ? null : coa.id)}
                  >
                    {/* Comparison checkbox */}
                    <input
                      type="checkbox"
                      className="coa-compare-checkbox"
                      checked={selectedForComparison.includes(coa.id)}
                      onChange={() => handleToggleComparison(coa.id)}
                      onClick={(e) => e.stopPropagation()}
                      title="Select for comparison"
                    />

                    {/* COA number + name */}
                    <div className="coa-row-name">
                      <span className="coa-number">COA {coa.number}</span>
                      <span className="coa-name">{coa.name}</span>
                    </div>

                    {/* Combined score */}
                    {coa.combinedScore !== null && (
                      <div className="coa-row-score">
                        <span
                          className="coa-combined-score"
                          style={{ color: getScoreColor(coa.combinedScore) }}
                        >
                          {coa.combinedScore}
                        </span>
                        <span className="coa-combined-label">/ 100</span>
                      </div>
                    )}

                    {/* Rank badge */}
                    {rank !== undefined && <RankBadge rank={rank} />}

                    {/* Commander decision */}
                    <DecisionBadge decision={coa.commanderDecision} />

                    {/* Score button */}
                    <button
                      className={`coa-score-btn ${isScoring ? 'pulsing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleScore(coa.id);
                      }}
                      disabled={isScoring}
                      title="Run FASDC scoring via AI"
                    >
                      {isScoring ? 'Scoring...' : coa.doctScores ? 'Re-Score' : 'Score'}
                    </button>

                    {/* Expand arrow */}
                    <span className={`coa-expand-arrow ${isExpanded ? 'up' : 'down'}`}>
                      &#x2039;
                    </span>
                  </div>

                  {/* Expanded detail pane */}
                  {isExpanded && (
                    <COADetailPane
                      coa={coa}
                      editingNarrative={editingNarrative[coa.id]}
                      onNarrativeChange={handleNarrativeChange}
                      onNarrativeSave={handleNarrativeSave}
                      savingNarrative={savingNarrative[coa.id] ?? false}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Compare button */}
        {coas.length >= 2 && (
          <div className="coa-compare-toolbar">
            <span className="coa-compare-hint">
              {selectedForComparison.length} COA{selectedForComparison.length !== 1 ? 's' : ''} selected
            </span>
            <button
              className="coa-btn-compare"
              onClick={handleCompare}
              disabled={comparing || selectedForComparison.length < 2}
              title="Compare selected COAs using AI analysis"
            >
              {comparing ? 'Comparing...' : 'Compare Selected'}
            </button>
          </div>
        )}
        {compareError && <div className="coa-error">{compareError}</div>}
      </section>

      {/* ── Section 2: Decision Matrix ──────────────────────────────────── */}
      {comparison && matrixCOAs.length >= 2 && (
        <section className="coa-section">
          <div className="coa-section-header">
            <h3 className="coa-section-title">Decision Matrix</h3>
          </div>

          <div className="coa-matrix-wrapper">
            <table className="coa-matrix-table">
              <thead>
                <tr>
                  <th className="coa-matrix-criteria-col">Criterion</th>
                  {matrixCOAs.map((coa) => (
                    <th key={coa.id} className="coa-matrix-coa-col">
                      <div className="coa-matrix-coa-name">COA {coa.number}</div>
                      <div className="coa-matrix-coa-subname">{coa.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CRITERIA_KEYS.map(({ key, label }) => (
                  <tr key={key}>
                    <td className="coa-matrix-criteria-cell">{label}</td>
                    {matrixCOAs.map((coa) => {
                      const score = coa.doctScores
                        ? (coa.doctScores[key] as { score: number }).score
                        : 0;
                      return <ScoreCell key={coa.id} score={score} />;
                    })}
                  </tr>
                ))}
                {/* Combined Score row */}
                <tr className="coa-matrix-combined-row">
                  <td className="coa-matrix-criteria-cell coa-matrix-combined-label">
                    Combined Score
                  </td>
                  {matrixCOAs.map((coa) => (
                    <ScoreCell key={coa.id} score={coa.combinedScore ?? 0} />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Rankings */}
          <div className="coa-rankings">
            <div className="coa-rankings-title">Rankings by Combined Score</div>
            <ol className="coa-rankings-list">
              {comparison.rankings
                .slice()
                .sort((a, b) => a.rank - b.rank)
                .map((r) => (
                  <li key={r.coaId} className="coa-ranking-item">
                    <RankBadge rank={r.rank} />
                    <span className="coa-ranking-name">{r.coaName}</span>
                    <span
                      className="coa-ranking-score"
                      style={{ color: getScoreColor(r.combinedScore) }}
                    >
                      {r.combinedScore}
                    </span>
                    <span className="coa-ranking-rationale">{r.rationale}</span>
                  </li>
                ))}
            </ol>
          </div>
        </section>
      )}

      {/* ── Section 3: AI Comparison Narrative ─────────────────────────── */}
      {comparison && (
        <section className="coa-section">
          <div className="coa-section-header">
            <h3 className="coa-section-title">
              Comparison Narrative
              <span className={`coa-ai-badge ${
                editingNarrative['__comparison__'] !== undefined ? 'edited' : ''
              }`}>
                {editingNarrative['__comparison__'] !== undefined
                  ? 'Edited'
                  : 'AI Generated'}
              </span>
            </h3>
          </div>

          <textarea
            className="coa-narrative-textarea coa-comparison-textarea"
            value={
              editingNarrative['__comparison__'] ??
              comparison.comparisonNarrative
            }
            onChange={(e) =>
              setEditingNarrative((prev) => ({
                ...prev,
                __comparison__: e.target.value,
              }))
            }
            rows={8}
            placeholder="AI-generated comparison narrative will appear here after running Compare."
          />

          {/* Staff recommendation */}
          {comparison.recommendedCOAId && (
            <div className="coa-recommendation">
              <span className="coa-recommendation-label">Staff Recommendation:</span>{' '}
              <span className="coa-recommendation-coa">
                {coas.find((c) => c.id === comparison.recommendedCOAId)?.name ??
                  comparison.recommendedCOAId}
              </span>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
