/**
 * ObjectivesReviewPage - Three-Column Objectives Management
 *
 * Left:   Strategic objectives from parent/global problem set hierarchy (read-only, draggable)
 * Middle: Problem set objectives (editable, drop target for adoption)
 * Right:  Detail editor and action panel for the selected objective
 *
 * Polls both columns every 30 seconds. On mount triggers Ironclaw proactive assessment.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  StrategicObjective,
  MidlifeCategory,
  ObjectiveEnds,
  ObjectiveWays,
  ObjectiveMeans,
} from '../../lib/types/strategic.js';
import { MIDLIFE_METADATA } from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ObjectivesReviewPageProps {
  problemSetId: string;
  onDraftCountChange?: (count: number) => void;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HierarchyGroup {
  problemSetId: string;
  problemSetName: string;
  echelon: string;
  objectives: StrategicObjective[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMidlifeColor(category: MidlifeCategory | undefined): string {
  if (!category) return '#666678';
  return MIDLIFE_METADATA[category]?.color || '#666678';
}

function getMidlifeLabel(category: MidlifeCategory | undefined): string {
  if (!category) return 'Uncategorized';
  return MIDLIFE_METADATA[category]?.label || category;
}

function getStatusStyle(status: string): { bg: string; text: string; label: string } {
  switch (status) {
    case 'DRAFT':
      return { bg: 'bg-amber-900/30', text: 'text-amber-400', label: 'Draft' };
    case 'APPROVED':
    case 'OPERATIONALIZED':
      return { bg: 'bg-emerald-900/30', text: 'text-emerald-400', label: status === 'OPERATIONALIZED' ? 'Operationalized' : 'Approved' };
    case 'REJECTED':
      return { bg: 'bg-red-900/30', text: 'text-red-400', label: 'Rejected' };
    case 'UNDER_REVIEW':
    case 'SUBMITTED':
      return { bg: 'bg-blue-900/30', text: 'text-blue-400', label: 'Under Review' };
    default:
      return { bg: 'bg-gray-800/30', text: 'text-gray-400', label: status };
  }
}

function getPriorityStyle(priority: string): { bg: string; text: string } {
  switch (priority) {
    case 'CRITICAL': return { bg: 'bg-red-900/40', text: 'text-red-300' };
    case 'HIGH': return { bg: 'bg-orange-900/40', text: 'text-orange-300' };
    case 'MEDIUM': return { bg: 'bg-yellow-900/40', text: 'text-yellow-300' };
    case 'LOW': return { bg: 'bg-gray-800/40', text: 'text-gray-400' };
    default: return { bg: 'bg-gray-800/40', text: 'text-gray-400' };
  }
}

function getEchelonStyle(echelon: string): { bg: string; text: string } {
  switch (echelon) {
    case 'strategic': return { bg: 'bg-purple-900/40', text: 'text-purple-300' };
    case 'operational': return { bg: 'bg-blue-900/40', text: 'text-blue-300' };
    case 'tactical': return { bg: 'bg-green-900/40', text: 'text-green-300' };
    default: return { bg: 'bg-gray-800/40', text: 'text-gray-400' };
  }
}

function getEndsWaysMeans(obj: StrategicObjective): { ends: ObjectiveEnds; ways: ObjectiveWays; means: ObjectiveMeans } | null {
  if (obj.endsWaysMeans) return obj.endsWaysMeans;
  if (obj.ends && obj.ways && obj.means) return { ends: obj.ends, ways: obj.ways, means: obj.means };
  return null;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.8 ? 'bg-emerald-500' : value >= 0.6 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-gray-400">{pct}%</span>
    </div>
  );
}

function Spinner({ className = 'w-5 h-5' }: { className?: string }) {
  return <div className={`${className} border-2 border-gray-500 border-t-blue-400 rounded-full animate-spin`} />;
}

const POLL_INTERVAL = 30_000;

const MIDLIFE_OPTIONS: MidlifeCategory[] = [
  'MILITARY', 'INFORMATION', 'DIPLOMATIC', 'LEGAL',
  'INTELLIGENCE', 'FINANCIAL', 'ECONOMIC',
];

const PRIORITY_OPTIONS = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObjectivesReviewPage({ problemSetId, onDraftCountChange }: ObjectivesReviewPageProps) {
  // Left column state
  const [hierarchy, setHierarchy] = useState<HierarchyGroup[]>([]);
  const [hierarchyLoading, setHierarchyLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState<string | null>(null);
  const [assessmentDone, setAssessmentDone] = useState(false);

  // Middle column state
  const [objectives, setObjectives] = useState<StrategicObjective[]>([]);
  const [objectivesLoading, setObjectivesLoading] = useState(true);
  const [objectivesError, setObjectivesError] = useState<string | null>(null);

  // Right column state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [editMidlife, setEditMidlife] = useState<MidlifeCategory | ''>('');
  const [editPriority, setEditPriority] = useState('MEDIUM');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Drag state
  const [dragOverMiddle, setDragOverMiddle] = useState(false);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);

  // Refs
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Derived
  const selectedObjective = objectives.find(o => o.id === selectedId) || null;
  const adoptedParentIds = new Set(
    objectives
      .filter(o => o.parentObjectiveId)
      .map(o => o.parentObjectiveId!)
  );

  // ---------- Data fetching ----------

  const loadHierarchy = useCallback(async (silent = false) => {
    if (!silent) setHierarchyLoading(true);
    setHierarchyError(null);
    try {
      const groups = await strategicService.getObjectiveHierarchy(problemSetId);
      setHierarchy(groups);
    } catch (err) {
      if (!silent) setHierarchyError(err instanceof Error ? err.message : 'Failed to load hierarchy');
    } finally {
      if (!silent) setHierarchyLoading(false);
    }
  }, [problemSetId]);

  const loadObjectives = useCallback(async (silent = false) => {
    if (!silent) setObjectivesLoading(true);
    setObjectivesError(null);
    try {
      const all = await strategicService.getObjectives({ workspaceId: problemSetId });
      setObjectives(all);
      const draftCount = all.filter(o => o.status === 'DRAFT').length;
      onDraftCountChange?.(draftCount);
    } catch (err) {
      if (!silent) setObjectivesError(err instanceof Error ? err.message : 'Failed to load objectives');
    } finally {
      if (!silent) setObjectivesLoading(false);
    }
  }, [problemSetId, onDraftCountChange]);

  // On mount: trigger Ironclaw assessment, then fetch both columns
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // Trigger proactive assessment (fire and forget, but wait before loading)
      if (!assessmentDone) {
        try {
          await strategicService.assessObjectivesForProblemSet(problemSetId);
        } catch (err) {
          console.warn('[ObjectivesReviewPage] Assessment failed (non-blocking):', err);
        }
        if (!cancelled) setAssessmentDone(true);
      }

      if (!cancelled) {
        await Promise.all([loadHierarchy(), loadObjectives()]);
      }
    }

    init();

    // Polling
    pollRef.current = setInterval(() => {
      loadHierarchy(true);
      loadObjectives(true);
    }, POLL_INTERVAL);

    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [problemSetId, loadHierarchy, loadObjectives, assessmentDone]);

  // Sync right-column form when selection changes
  useEffect(() => {
    if (selectedObjective) {
      setEditDescription(selectedObjective.description);
      setEditMidlife(selectedObjective.midlifeCategory || '');
      setEditPriority(selectedObjective.priority);
      setSaveSuccess(false);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Actions ----------

  const handleSave = async () => {
    if (!selectedObjective) return;
    setActionLoading('save');
    setSaveSuccess(false);
    try {
      await strategicService.updateObjective(selectedObjective.id, {
        description: editDescription,
        midlifeCategory: editMidlife as MidlifeCategory || undefined,
        priority: editPriority as StrategicObjective['priority'],
      });
      await loadObjectives(true);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      console.error('[ObjectivesReviewPage] Save failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleApprove = async () => {
    if (!selectedObjective) return;
    setActionLoading('approve');
    try {
      await strategicService.submitReview(selectedObjective.id, 'APPROVE');
      await loadObjectives(true);
    } catch (err) {
      console.error('[ObjectivesReviewPage] Approve failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    if (!selectedObjective) return;
    setActionLoading('reject');
    try {
      await strategicService.submitReview(selectedObjective.id, 'REJECT');
      await loadObjectives(true);
    } catch (err) {
      console.error('[ObjectivesReviewPage] Reject failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleVerify = async () => {
    if (!selectedObjective) return;
    setActionLoading('verify');
    try {
      await strategicService.verifyObjective(selectedObjective.id, true);
      await loadObjectives(true);
    } catch (err) {
      console.error('[ObjectivesReviewPage] Verify failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  // ---------- Drag and Drop ----------

  const handleDragStart = (e: React.DragEvent, objectiveId: string) => {
    e.dataTransfer.setData('text/plain', objectiveId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverMiddle(true);
  };

  const handleDragLeave = () => {
    setDragOverMiddle(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverMiddle(false);
    const sourceId = e.dataTransfer.getData('text/plain');
    if (!sourceId) return;

    // Check if already adopted
    if (adoptedParentIds.has(sourceId)) return;

    setAdoptingId(sourceId);
    try {
      await strategicService.adoptObjective(sourceId, problemSetId);
      await loadObjectives(true);
    } catch (err) {
      console.error('[ObjectivesReviewPage] Adopt failed:', err);
    } finally {
      setAdoptingId(null);
    }
  };

  // Find parent objective description for "Derived from" display
  const findParentDescription = (parentId: string): string | null => {
    for (const group of hierarchy) {
      const found = group.objectives.find(o => o.id === parentId);
      if (found) return found.description;
    }
    return null;
  };

  // ---------- Render ----------

  return (
    <div className="flex h-full overflow-hidden bg-gray-900">
      {/* ======================== LEFT COLUMN ======================== */}
      <div className="w-1/3 flex flex-col border-r border-gray-700/50 min-w-0">
        <div className="px-3 py-2.5 border-b border-gray-700/50 flex-shrink-0">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Strategic Objectives
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">From parent hierarchy (drag to adopt)</p>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3">
          {hierarchyLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
              <Spinner className="w-4 h-4" />
              <span className="text-xs">Loading hierarchy...</span>
            </div>
          ) : hierarchyError ? (
            <div className="text-center py-8">
              <p className="text-xs text-red-400 mb-2">{hierarchyError}</p>
              <button
                onClick={() => loadHierarchy()}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Retry
              </button>
            </div>
          ) : hierarchy.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
              <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-xs text-center px-4">No strategic objectives from parent</p>
            </div>
          ) : (
            hierarchy.map(group => {
              const echelonStyle = getEchelonStyle(group.echelon);
              return (
                <div key={group.problemSetId}>
                  {/* Group header */}
                  <div className="flex items-center gap-2 mb-1.5 px-1">
                    <span className="text-[11px] font-medium text-gray-300 truncate">
                      {group.problemSetName}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${echelonStyle.bg} ${echelonStyle.text}`}>
                      {group.echelon}
                    </span>
                  </div>

                  {/* Objective cards */}
                  <div className="space-y-1.5">
                    {group.objectives.map(obj => {
                      const isAdopted = adoptedParentIds.has(obj.id);
                      const isAdopting = adoptingId === obj.id;
                      return (
                        <div
                          key={obj.id}
                          draggable={!isAdopted}
                          onDragStart={(e) => handleDragStart(e, obj.id)}
                          className={`
                            rounded-md border p-2.5 transition-all
                            ${isAdopted
                              ? 'border-emerald-700/30 bg-gray-800/30 opacity-70'
                              : 'border-gray-700/40 bg-gray-800/50 hover:bg-gray-800/70 cursor-grab active:cursor-grabbing'
                            }
                            ${isAdopting ? 'animate-pulse' : ''}
                          `}
                        >
                          {/* Badges */}
                          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border"
                              style={{
                                backgroundColor: `${getMidlifeColor(obj.midlifeCategory)}15`,
                                borderColor: `${getMidlifeColor(obj.midlifeCategory)}40`,
                                color: getMidlifeColor(obj.midlifeCategory),
                              }}
                            >
                              {getMidlifeLabel(obj.midlifeCategory)}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${getPriorityStyle(obj.priority).bg} ${getPriorityStyle(obj.priority).text}`}>
                              {obj.priority}
                            </span>
                            {obj.extractionConfidence !== undefined && (
                              <ConfidenceBar value={obj.extractionConfidence} />
                            )}
                            {isAdopted && (
                              <span className="ml-auto text-emerald-500" title="Adopted into this problem set">
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                                </svg>
                              </span>
                            )}
                          </div>

                          {/* Description */}
                          <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed">
                            {obj.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ======================== MIDDLE COLUMN ======================== */}
      <div
        className={`w-1/3 flex flex-col border-r border-gray-700/50 min-w-0 transition-colors ${
          dragOverMiddle ? 'bg-blue-900/10 ring-1 ring-inset ring-blue-500/30' : ''
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="px-3 py-2.5 border-b border-gray-700/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Problem Set Objectives
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">
                {objectives.length} objective{objectives.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={() => { loadObjectives(); loadHierarchy(); }}
              className="text-gray-500 hover:text-gray-300 p-1"
              title="Refresh"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
          {objectivesLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 gap-2">
              <Spinner className="w-4 h-4" />
              <span className="text-xs">Loading objectives...</span>
            </div>
          ) : objectivesError ? (
            <div className="text-center py-8">
              <p className="text-xs text-red-400 mb-2">{objectivesError}</p>
              <button
                onClick={() => loadObjectives()}
                className="text-xs text-blue-400 hover:text-blue-300 underline"
              >
                Retry
              </button>
            </div>
          ) : objectives.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-500 gap-3 px-4">
              <svg className="w-10 h-10 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="18" x2="12" y2="12" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
              <p className="text-xs text-center leading-relaxed">
                No objectives for this problem set yet. Drag objectives from the left or upload documents to extract them.
              </p>
            </div>
          ) : (
            objectives.map(obj => {
              const statusStyle = getStatusStyle(obj.status);
              const priorityStyle = getPriorityStyle(obj.priority);
              const isSelected = selectedId === obj.id;
              const hasParent = !!obj.parentObjectiveId;

              return (
                <button
                  key={obj.id}
                  onClick={() => setSelectedId(isSelected ? null : obj.id)}
                  className={`
                    w-full text-left rounded-md border p-2.5 transition-all
                    ${isSelected
                      ? 'border-blue-500/50 bg-blue-900/20 ring-1 ring-blue-500/20'
                      : 'border-gray-700/40 bg-gray-800/50 hover:bg-gray-800/70'
                    }
                  `}
                >
                  {/* Badges */}
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium border"
                      style={{
                        backgroundColor: `${getMidlifeColor(obj.midlifeCategory)}15`,
                        borderColor: `${getMidlifeColor(obj.midlifeCategory)}40`,
                        color: getMidlifeColor(obj.midlifeCategory),
                      }}
                    >
                      {getMidlifeLabel(obj.midlifeCategory)}
                    </span>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${priorityStyle.bg} ${priorityStyle.text}`}>
                      {obj.priority}
                    </span>
                    {obj.extractionConfidence !== undefined && (
                      <ConfidenceBar value={obj.extractionConfidence} />
                    )}
                    {hasParent && (
                      <span className="ml-auto text-blue-400" title="Adopted from parent">
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                        </svg>
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-xs text-gray-300 line-clamp-2 leading-relaxed">
                    {obj.description}
                  </p>

                  {/* Source */}
                  {obj.sourceReference && (
                    <p className="text-[10px] text-gray-500 mt-1 truncate">
                      Source: {obj.sourceReference}
                    </p>
                  )}
                </button>
              );
            })
          )}

          {/* Drop hint overlay */}
          {dragOverMiddle && (
            <div className="flex items-center justify-center py-6 border-2 border-dashed border-blue-500/40 rounded-lg">
              <p className="text-xs text-blue-400">Drop to adopt objective</p>
            </div>
          )}
        </div>
      </div>

      {/* ======================== RIGHT COLUMN ======================== */}
      <div className="w-1/3 flex flex-col min-w-0">
        <div className="px-3 py-2.5 border-b border-gray-700/50 flex-shrink-0">
          <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
            Details & Actions
          </h3>
        </div>

        {!selectedObjective ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-2 px-6">
            <svg className="w-8 h-8 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="9" x2="15" y2="15" />
              <line x1="15" y1="9" x2="9" y2="15" />
            </svg>
            <p className="text-xs text-center">Select an objective from the middle column to view details</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
            {/* Approved banner */}
            {selectedObjective.status === 'APPROVED' && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-900/30 border border-emerald-700/30">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
                <span className="text-xs font-medium text-emerald-400">Approved</span>
              </div>
            )}

            {/* Derived from parent */}
            {selectedObjective.parentObjectiveId && (
              <div className="px-3 py-2 rounded-md bg-blue-900/20 border border-blue-700/20">
                <p className="text-[10px] text-blue-400 font-medium mb-1">Derived from parent objective:</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  {findParentDescription(selectedObjective.parentObjectiveId) || `ID: ${selectedObjective.parentObjectiveId.slice(0, 12)}...`}
                </p>
                {findParentDescription(selectedObjective.parentObjectiveId) &&
                 findParentDescription(selectedObjective.parentObjectiveId) !== selectedObjective.description && (
                  <p className="text-[9px] text-amber-500 mt-1">* Text has been modified from parent</p>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-[11px] font-medium text-gray-400 block mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={4}
                className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded-md px-2.5 py-2 resize-y focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30"
                disabled={selectedObjective.status === 'APPROVED'}
              />
            </div>

            {/* Source reference */}
            {selectedObjective.sourceReference && (
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">Source Reference</label>
                <p className="text-xs text-gray-300 bg-gray-800/50 rounded px-2.5 py-1.5 border border-gray-700/40">
                  {selectedObjective.sourceReference}
                </p>
              </div>
            )}

            {/* MIDLIFE + Priority dropdowns */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">MIDLIFE Category</label>
                <select
                  value={editMidlife}
                  onChange={(e) => setEditMidlife(e.target.value as MidlifeCategory)}
                  disabled={selectedObjective.status === 'APPROVED'}
                  className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  <option value="">Uncategorized</option>
                  {MIDLIFE_OPTIONS.map(cat => (
                    <option key={cat} value={cat}>{MIDLIFE_METADATA[cat].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] font-medium text-gray-400 block mb-1">Priority</label>
                <select
                  value={editPriority}
                  onChange={(e) => setEditPriority(e.target.value)}
                  disabled={selectedObjective.status === 'APPROVED'}
                  className="w-full text-xs bg-gray-800 border border-gray-700 text-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-500"
                >
                  {PRIORITY_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Ends-Ways-Means */}
            {(() => {
              const ewm = getEndsWaysMeans(selectedObjective);
              if (!ewm) return null;
              return (
                <div className="space-y-2">
                  <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Ends-Ways-Means
                  </h4>

                  {/* Ends */}
                  <div className="pl-2.5 border-l-2 border-emerald-700/40">
                    <p className="text-[10px] font-medium text-emerald-400 mb-0.5">Ends</p>
                    <p className="text-[11px] text-gray-300">{ewm.ends.description}</p>
                    {ewm.ends.conditions?.length > 0 && (
                      <ul className="mt-0.5 space-y-0.5">
                        {ewm.ends.conditions.map((c, i) => (
                          <li key={i} className="text-[10px] text-gray-400 pl-2">- {c}</li>
                        ))}
                      </ul>
                    )}
                    {ewm.ends.timeframe && (
                      <p className="text-[10px] text-gray-500 mt-0.5">Timeframe: {ewm.ends.timeframe}</p>
                    )}
                  </div>

                  {/* Ways */}
                  <div className="pl-2.5 border-l-2 border-blue-700/40">
                    <p className="text-[10px] font-medium text-blue-400 mb-0.5">Ways</p>
                    {ewm.ways.strategies?.length > 0 && (
                      <div className="mb-0.5">
                        <span className="text-[9px] text-gray-500">Strategies:</span>
                        <ul className="space-y-0.5">
                          {ewm.ways.strategies.map((s, i) => (
                            <li key={i} className="text-[10px] text-gray-400 pl-2">{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ewm.ways.keyTasks?.length > 0 && (
                      <div>
                        <span className="text-[9px] text-gray-500">Key Tasks:</span>
                        <ul className="space-y-0.5">
                          {ewm.ways.keyTasks.map((t, i) => (
                            <li key={i} className="text-[10px] text-gray-400 pl-2">{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Means */}
                  <div className="pl-2.5 border-l-2 border-orange-700/40">
                    <p className="text-[10px] font-medium text-orange-400 mb-0.5">Means</p>
                    {ewm.means.forces?.length > 0 && (
                      <div className="mb-0.5">
                        <span className="text-[9px] text-gray-500">Forces:</span>
                        <ul className="space-y-0.5">
                          {ewm.means.forces.map((f, i) => (
                            <li key={i} className="text-[10px] text-gray-400 pl-2">{f}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ewm.means.capabilities?.length > 0 && (
                      <div className="mb-0.5">
                        <span className="text-[9px] text-gray-500">Capabilities:</span>
                        <ul className="space-y-0.5">
                          {ewm.means.capabilities.map((c, i) => (
                            <li key={i} className="text-[10px] text-gray-400 pl-2">{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {ewm.means.resources?.length > 0 && (
                      <div>
                        <span className="text-[9px] text-gray-500">Resources:</span>
                        <ul className="space-y-0.5">
                          {ewm.means.resources.map((r, i) => (
                            <li key={i} className="text-[10px] text-gray-400 pl-2">{r}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Constraints & Assumptions */}
            {(selectedObjective.constraints?.length > 0 || selectedObjective.assumptions?.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {selectedObjective.constraints?.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-medium text-gray-400 mb-1">Constraints</h5>
                    <ul className="space-y-0.5">
                      {selectedObjective.constraints.map((c, i) => (
                        <li key={i} className="text-[10px] text-gray-500">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {selectedObjective.assumptions?.length > 0 && (
                  <div>
                    <h5 className="text-[10px] font-medium text-gray-400 mb-1">Assumptions</h5>
                    <ul className="space-y-0.5">
                      {selectedObjective.assumptions.map((a, i) => (
                        <li key={i} className="text-[10px] text-gray-500">{a}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Risks */}
            {selectedObjective.risks && selectedObjective.risks.length > 0 && (
              <div>
                <h5 className="text-[10px] font-medium text-gray-400 mb-1">Risks</h5>
                <ul className="space-y-0.5">
                  {selectedObjective.risks.map((r, i) => (
                    <li key={i} className="text-[10px] text-red-400/70">{r}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Confidence scores */}
            <div className="flex items-center gap-4">
              {selectedObjective.extractionConfidence !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500">Extraction:</span>
                  <ConfidenceBar value={selectedObjective.extractionConfidence} />
                </div>
              )}
              {selectedObjective.midlifeConfidence !== undefined && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-gray-500">MIDLIFE:</span>
                  <ConfidenceBar value={selectedObjective.midlifeConfidence} />
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-3 text-[9px] text-gray-600">
              <span>ID: {selectedObjective.id.slice(0, 8)}...</span>
              {selectedObjective.extractedBy && (
                <span>Extracted by: {selectedObjective.extractedBy}</span>
              )}
              {selectedObjective.humanVerified && (
                <span className="text-emerald-600">Human verified</span>
              )}
              {selectedObjective.createdAt && (
                <span>{new Date(selectedObjective.createdAt).toLocaleDateString()}</span>
              )}
            </div>

            {/* Action buttons */}
            {selectedObjective.status !== 'APPROVED' && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-700/30">
                {/* Save */}
                <button
                  onClick={handleSave}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                    bg-blue-900/40 text-blue-400 border border-blue-700/40
                    hover:bg-blue-900/60 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors"
                >
                  {actionLoading === 'save' ? (
                    <Spinner className="w-3 h-3" />
                  ) : saveSuccess ? (
                    <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                      <polyline points="17 21 17 13 7 13 7 21" />
                      <polyline points="7 3 7 8 15 8" />
                    </svg>
                  )}
                  {saveSuccess ? 'Saved' : 'Save Changes'}
                </button>

                {/* Approve */}
                <button
                  onClick={handleApprove}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                    bg-emerald-900/40 text-emerald-400 border border-emerald-700/40
                    hover:bg-emerald-900/60 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors"
                >
                  {actionLoading === 'approve' ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  Approve
                </button>

                {/* Reject */}
                <button
                  onClick={handleReject}
                  disabled={!!actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                    bg-red-900/40 text-red-400 border border-red-700/40
                    hover:bg-red-900/60 disabled:opacity-50 disabled:cursor-not-allowed
                    transition-colors"
                >
                  {actionLoading === 'reject' ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  )}
                  Reject
                </button>

                {/* Verify */}
                {!selectedObjective.humanVerified && (
                  <button
                    onClick={handleVerify}
                    disabled={!!actionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded
                      bg-indigo-900/40 text-indigo-400 border border-indigo-700/40
                      hover:bg-indigo-900/60 disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors"
                  >
                    {actionLoading === 'verify' ? (
                      <Spinner className="w-3 h-3" />
                    ) : (
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                        <polyline points="22 4 12 14.01 9 11.01" />
                      </svg>
                    )}
                    Mark Verified
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
