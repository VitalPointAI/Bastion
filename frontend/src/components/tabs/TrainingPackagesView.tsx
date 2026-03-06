/**
 * TrainingPackagesView
 *
 * Training-mode sidebar view in UnderstandTab that resolves the linked scenario
 * for the active problem set, displays a classification banner, and renders
 * ScenarioPackageUpload for document management. Shows a prompt when no
 * scenario is linked.
 */

import { useState, useEffect, useCallback } from 'react';
import { ScenarioPackageUpload } from '../exercise/ScenarioPackageUpload.js';
import { exerciseService } from '../../services/exercise-service.js';
import { problemSetService } from '../../lib/problem-set-service.js';
import { useProblemSet } from '../../context/ProblemSetContext.js';
import type { ExerciseScenario, ScenarioDocument } from '../../types/exercise.js';
import './TrainingPackagesView.css';

interface TrainingPackagesViewProps {
  problemSetId: string;
  onDocCountChange: (count: number) => void;
  onPendingChange: (pending: boolean) => void;
}

function classificationClass(classification: string): string {
  const lower = classification.toLowerCase().replace(/[\s-_]/g, '');
  if (lower.includes('topsecret')) return 'topsecret';
  if (lower.includes('secret')) return 'secret';
  return 'unclassified';
}

export function TrainingPackagesView({ problemSetId, onDocCountChange, onPendingChange }: TrainingPackagesViewProps) {
  const { activeProblemSet } = useProblemSet();
  const [scenario, setScenario] = useState<ExerciseScenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<ScenarioDocument | null>(null);

  const classification = activeProblemSet?.classification ?? 'UNCLASSIFIED';

  // Resolve linked scenario on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    problemSetService.getLinkedScenario(problemSetId).then((result) => {
      if (!cancelled) {
        setScenario(result);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [problemSetId]);

  // Track document counts for sidebar badge
  const refreshDocCounts = useCallback(() => {
    if (!scenario) return;
    exerciseService.getDocuments(scenario.id).then((docs) => {
      onDocCountChange(docs.length);
      onPendingChange(docs.some((d) => d.extractionConfidence === 0));
    }).catch(() => { /* non-fatal */ });
  }, [scenario, onDocCountChange, onPendingChange]);

  useEffect(() => {
    refreshDocCounts();
  }, [refreshDocCounts]);

  if (loading) {
    return (
      <div className="training-packages-container">
        <div className="training-packages-loading">Loading...</div>
      </div>
    );
  }

  if (!scenario) {
    return (
      <div className="training-packages-container">
        <div className="no-scenario-prompt">
          <h3>No Scenario Linked</h3>
          <p>No scenario is linked to this problem set. Create a problem set from a scenario or link an existing one.</p>
          <div className="no-scenario-actions">
            <button className="no-scenario-btn no-scenario-btn--primary">
              Create from Scenario
            </button>
            <button className="no-scenario-btn no-scenario-btn--secondary" disabled title="Coming soon">
              Link Existing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="training-packages-container">
      <div className={`classification-banner ${classificationClass(classification)}`}>
        {classification}
      </div>
      <div className="classification-warning">
        Classification ceiling: {classification}. Documents tagged above this level may not be appropriate.
      </div>

      <div className="training-packages-content">
        <div className={`training-packages-main ${selectedDoc ? 'with-preview' : ''}`}>
          <ScenarioPackageUpload
            scenario={scenario}
            onUploadComplete={refreshDocCounts}
            onDocumentClick={setSelectedDoc}
          />
        </div>
        {selectedDoc && (
          <TrainingDocPreviewInline document={selectedDoc} onClose={() => setSelectedDoc(null)} />
        )}
      </div>
    </div>
  );
}

// Inline preview placeholder -- will be extracted to its own file in Task 2
function TrainingDocPreviewInline({ document: _doc, onClose }: { document: ScenarioDocument; onClose: () => void }) {
  void _doc;
  void onClose;
  return null;
}
