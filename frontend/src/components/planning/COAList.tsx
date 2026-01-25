import React, { useState, useCallback } from 'react';
import { COACard } from './COACard';
import type { COA } from './types';
import {
  getCOAs,
  selectCOA,
  generateCOAs,
  runRedTeam,
  compareCOAs,
} from '../../lib/planning-service';
import './COAEditor.css';

interface COAListProps {
  planId: string;
  coas: COA[];
  onCOAsChange: (coas: COA[]) => void;
  onEditCOA: (coa: COA | null) => void;
}

export function COAList({
  planId,
  coas,
  onCOAsChange,
  onEditCOA,
}: COAListProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshCOAs = useCallback(async () => {
    const updated = await getCOAs(planId);
    onCOAsChange(updated);
  }, [planId, onCOAsChange]);

  const handleGenerateCOAs = async () => {
    try {
      setLoading('Generating COAs...');
      setError(null);
      await generateCOAs(planId, 3);
      await refreshCOAs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate COAs');
    } finally {
      setLoading(null);
    }
  };

  const handleRunRedTeam = async () => {
    try {
      setLoading('Running Red Team simulation...');
      setError(null);
      await runRedTeam(planId);
      await refreshCOAs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run Red Team');
    } finally {
      setLoading(null);
    }
  };

  const handleCompareCOAs = async () => {
    try {
      setLoading('Comparing COAs...');
      setError(null);
      await compareCOAs(planId);
      await refreshCOAs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare COAs');
    } finally {
      setLoading(null);
    }
  };

  const handleSelectCOA = async (coaId: string) => {
    try {
      setLoading('Selecting COA...');
      await selectCOA(planId, coaId);
      await refreshCOAs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select COA');
    } finally {
      setLoading(null);
    }
  };

  const sortedCOAs = [...coas].sort((a, b) => {
    // Selected first, then by ranking, then by number
    if (a.selected && !b.selected) return -1;
    if (!a.selected && b.selected) return 1;
    if (a.comparisonScore && b.comparisonScore) {
      return a.comparisonScore.ranking - b.comparisonScore.ranking;
    }
    return a.number - b.number;
  });

  return (
    <div className="coa-list">
      <div className="coa-list-header">
        <h3>Courses of Action ({coas.length})</h3>
        <div className="coa-actions">
          <button
            className="ai-action-btn"
            onClick={handleGenerateCOAs}
            disabled={!!loading}
          >
            Generate with AI
          </button>
          <button
            className="ai-action-btn"
            onClick={handleRunRedTeam}
            disabled={!!loading || coas.length === 0}
          >
            Red Team All
          </button>
          <button
            className="ai-action-btn"
            onClick={handleCompareCOAs}
            disabled={!!loading || coas.length < 2}
          >
            Compare All
          </button>
        </div>
      </div>

      {loading && (
        <div className="coa-loading">
          <span className="spinner" />
          {loading}
        </div>
      )}

      {error && <div className="coa-error">{error}</div>}

      {coas.length < 3 && (
        <div className="coa-warning">
          Minimum 3 COAs required per doctrine. Currently: {coas.length}
        </div>
      )}

      <div className="coa-grid">
        {sortedCOAs.map((coa) => (
          <COACard
            key={coa.id}
            coa={coa}
            isSelected={false}
            onSelect={() => handleSelectCOA(coa.id)}
            onEdit={() => onEditCOA(coa)}
          />
        ))}

        <div className="coa-card add-coa" onClick={() => onEditCOA(null)}>
          <span className="add-icon">+</span>
          <span>Add New COA</span>
        </div>
      </div>
    </div>
  );
}
