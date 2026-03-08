/**
 * TrainingTacticalAssess
 *
 * Phase 37 Plan 04: Tactical-level training assessment view.
 * Sidebar: After-Action Review, Task Assessment.
 * AAR view: list/create AARs, edit 4-section form, manage observations.
 * Task Assessment view: T/P/U ratings per METL task linked to selected AAR.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.js';
import { useProblemSet } from '../../context/ProblemSetContext.tsx';
import { useUser } from '../../context/UserContext.js';
import {
  assessmentService,
  type StructuredAAR,
  type AARObservation,
  type AARObservationType,
  type METLTask,
  type METLAssessment,
  type CreateMETLAssessmentInput,
} from '../../lib/assessment-service';
import { AARForm } from './AARForm.tsx';
import { METLTaskAssessment } from './METLTaskAssessment.tsx';
import './AssessEchelonRouter.css';

// ============================================================================
// Sidebar configuration
// ============================================================================

const TACTICAL_TRAINING_ITEMS: SidebarItem[] = [
  { id: 'aar', label: 'After-Action Review' },
  { id: 'task-assessment', label: 'Task Assessment' },
];

// ============================================================================
// Props
// ============================================================================

interface TrainingTacticalAssessProps {
  problemSetId: string;
}

// ============================================================================
// Component
// ============================================================================

export function TrainingTacticalAssess({ problemSetId }: TrainingTacticalAssessProps) {
  const { activeProblemSet } = useProblemSet();
  const { userDID } = useUser();

  const [selectedView, setSelectedView] = useState('aar');
  const [aars, setAARs] = useState<StructuredAAR[]>([]);
  const [selectedAAR, setSelectedAAR] = useState<StructuredAAR | null>(null);
  const [observations, setObservations] = useState<AARObservation[]>([]);
  const [metlTasks, setMETLTasks] = useState<METLTask[]>([]);
  const [assessments, setAssessments] = useState<METLAssessment[]>([]);
  const [loading, setLoading] = useState(false);
  const [creatingAAR, setCreatingAAR] = useState(false);
  const [newEventName, setNewEventName] = useState('');

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadAARs = useCallback(async () => {
    try {
      const list = await assessmentService.listAARs(problemSetId);
      setAARs(list);
    } catch (err) {
      console.error('Failed to load AARs:', err);
    }
  }, [problemSetId]);

  const loadObservations = useCallback(async (aarId: string) => {
    try {
      const obs = await assessmentService.listAARObservations(aarId);
      setObservations(obs);
    } catch (err) {
      console.error('Failed to load observations:', err);
    }
  }, []);

  const loadAssessments = useCallback(async (aarId: string) => {
    try {
      const result = await assessmentService.getAssessmentsByAAR(aarId);
      setAssessments(result);
    } catch (err) {
      console.error('Failed to load assessments:', err);
    }
  }, []);

  const loadMETLTasks = useCallback(async () => {
    try {
      // Load local tasks
      const localTasks = await assessmentService.listMETLTasks(problemSetId);

      // Load inherited tasks from parent if available
      const parentPsId = activeProblemSet?.parentProblemSetId;
      let inheritedTasks: METLTask[] = [];
      if (parentPsId) {
        try {
          inheritedTasks = await assessmentService.getInheritedMETLTasks(
            problemSetId,
            parentPsId
          );
        } catch {
          // Parent may not have METL tasks yet
        }
      }

      // Combine: inherited first, then local supplemental
      const combined = [
        ...inheritedTasks,
        ...localTasks.filter((t) => t.isSupplemental),
      ];
      // If no inherited tasks, use all local tasks
      setMETLTasks(combined.length > 0 ? combined : localTasks);
    } catch (err) {
      console.error('Failed to load METL tasks:', err);
    }
  }, [problemSetId, activeProblemSet?.parentProblemSetId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadAARs(), loadMETLTasks()]).finally(() => setLoading(false));
  }, [loadAARs, loadMETLTasks]);

  useEffect(() => {
    if (selectedAAR) {
      loadObservations(selectedAAR.id);
      loadAssessments(selectedAAR.id);
    } else {
      setObservations([]);
      setAssessments([]);
    }
  }, [selectedAAR, loadObservations, loadAssessments]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function handleCreateAAR() {
    if (!newEventName.trim() || !userDID) return;
    try {
      const created = await assessmentService.createAAR({
        problemSetId,
        trainingEventName: newEventName.trim(),
        initiatedBy: userDID,
      });
      setAARs((prev) => [created, ...prev]);
      setSelectedAAR(created);
      setNewEventName('');
      setCreatingAAR(false);
    } catch (err) {
      console.error('Failed to create AAR:', err);
    }
  }

  async function handleUpdateAAR(updated: {
    whatWasPlanned?: string;
    whatHappened?: string;
    why?: string;
    status?: 'draft' | 'in_review';
  }) {
    if (!selectedAAR) return;
    try {
      const result = await assessmentService.updateAAR(selectedAAR.id, updated);
      setSelectedAAR(result);
      setAARs((prev) => prev.map((a) => (a.id === result.id ? result : a)));
    } catch (err) {
      console.error('Failed to update AAR:', err);
    }
  }

  async function handleFinalizeAAR() {
    if (!selectedAAR || !userDID) return;
    try {
      const result = await assessmentService.finalizeAAR(selectedAAR.id, userDID);
      setSelectedAAR(result);
      setAARs((prev) => prev.map((a) => (a.id === result.id ? result : a)));
    } catch (err) {
      console.error('Failed to finalize AAR:', err);
    }
  }

  async function handleAddObservation(obs: {
    observationType: AARObservationType;
    content: string;
    metlTaskId?: string;
  }) {
    if (!selectedAAR || !userDID) return;
    try {
      const created = await assessmentService.addAARObservation(selectedAAR.id, {
        ...obs,
        createdBy: userDID,
      });
      setObservations((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to add observation:', err);
    }
  }

  async function handleUpdateObservation(
    id: string,
    updates: { aiAccepted?: boolean; content?: string }
  ) {
    try {
      const updated = await assessmentService.updateAARObservation(id, updates);
      setObservations((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error('Failed to update observation:', err);
    }
  }

  async function handleAssess(input: CreateMETLAssessmentInput) {
    if (!userDID) return;
    try {
      const created = await assessmentService.createMETLAssessment({
        ...input,
        assessedBy: userDID,
      });
      setAssessments((prev) => [...prev, created]);
    } catch (err) {
      console.error('Failed to create assessment:', err);
    }
  }

  // ─── Render AAR view ────────────────────────────────────────────────────

  function renderAARView() {
    return (
      <div>
        {/* Create AAR form */}
        {creatingAAR ? (
          <div className="tac-assess-create-form">
            <input
              type="text"
              placeholder="Training event name..."
              value={newEventName}
              onChange={(e) => setNewEventName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateAAR()}
              autoFocus
            />
            <button className="btn-save" onClick={handleCreateAAR} disabled={!newEventName.trim()}>
              Create
            </button>
            <button className="btn-cancel" onClick={() => setCreatingAAR(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <div style={{ marginBottom: '1rem' }}>
            <button className="add-measure-btn" onClick={() => setCreatingAAR(true)}>
              + Create AAR
            </button>
          </div>
        )}

        {/* AAR list */}
        {aars.length === 0 && !loading && (
          <div className="ops-assess-empty">
            No After-Action Reviews yet. Create one to get started.
          </div>
        )}
        {aars.length > 0 && !selectedAAR && (
          <div className="tac-assess-aar-list">
            {aars.map((aar) => (
              <div
                key={aar.id}
                className="tac-assess-aar-card"
                onClick={() => setSelectedAAR(aar)}
              >
                <div className="tac-assess-aar-card-info">
                  <span className="tac-assess-aar-card-name">{aar.trainingEventName}</span>
                  <span className="tac-assess-aar-card-date">
                    {new Date(aar.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span
                  className={`status-badge status-${
                    aar.status === 'finalized'
                      ? 'green'
                      : aar.status === 'in_review'
                        ? 'yellow'
                        : 'yellow'
                  }`}
                >
                  {aar.status === 'finalized'
                    ? 'FINALIZED'
                    : aar.status === 'in_review'
                      ? 'IN REVIEW'
                      : 'DRAFT'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Selected AAR form */}
        {selectedAAR && (
          <>
            <button
              className="add-measure-btn"
              onClick={() => setSelectedAAR(null)}
              style={{ marginBottom: '0.75rem' }}
            >
              Back to AAR list
            </button>
            <AARForm
              aar={selectedAAR}
              observations={observations}
              metlTasks={metlTasks}
              onUpdate={handleUpdateAAR}
              onFinalize={handleFinalizeAAR}
              onAddObservation={handleAddObservation}
              onUpdateObservation={handleUpdateObservation}
            />
          </>
        )}
      </div>
    );
  }

  // ─── Render Task Assessment view ─────────────────────────────────────────

  function renderTaskAssessmentView() {
    if (!selectedAAR) {
      return (
        <div className="tac-assess-prompt">
          <p>Select or create an After-Action Review first to assess METL tasks.</p>
          <button className="add-measure-btn" onClick={() => setSelectedView('aar')}>
            Go to AARs
          </button>
        </div>
      );
    }

    return (
      <METLTaskAssessment
        problemSetId={problemSetId}
        aarId={selectedAAR.id}
        metlTasks={metlTasks}
        existingAssessments={assessments}
        onAssess={handleAssess}
      />
    );
  }

  // ─── Main render ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="assess-placeholder">
        <p>Loading training assessment...</p>
      </div>
    );
  }

  return (
    <TabLayout
      items={TACTICAL_TRAINING_ITEMS}
      selectedItem={selectedView}
      onSelectItem={setSelectedView}
    >
      {selectedView === 'aar' && renderAARView()}
      {selectedView === 'task-assessment' && renderTaskAssessmentView()}
    </TabLayout>
  );
}
