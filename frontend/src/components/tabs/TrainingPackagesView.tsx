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
import { TrainingDocPreview } from './TrainingDocPreview.js';
import { CreateScenarioPanel } from './CreateScenarioPanel.js';
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
        <CreateScenarioPanel
          problemSetId={problemSetId}
          problemSetName={activeProblemSet?.name ?? 'Training'}
          onCreated={(created) => setScenario(created)}
        />
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
          <TrainingDocPreview document={selectedDoc} onClose={() => setSelectedDoc(null)} />
        )}
      </div>
    </div>
  );
}
