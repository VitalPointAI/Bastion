/**
 * CoGAnalysisSection
 *
 * Phase 25 Plan 03/06: Side-by-side CoG analysis container with friendly and
 * adversary trees. Auto-saves on changes with debounce. Includes AI panel
 * for CoG analysis suggestions and validation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CoGAnalysis, CoGTree as CoGTreeType } from '../../lib/design-service.ts';
import { CoGTree } from './CoGTree.tsx';
import { useIronclawContext } from '../../context/IronclawContext.tsx';
import { useDesignInterview, getRoleColor } from '../../hooks/useDesignInterview.ts';
import { DesignInterviewProgress } from './DesignInterviewProgress.tsx';
import { DesignInterviewGate } from './DesignInterviewGate.tsx';

export interface CoGAnalysisSectionProps {
  problemSetId: string;
  initialData: CoGAnalysis;
  onUpdate: (data: CoGAnalysis) => void;
}


export function CoGAnalysisSection({ problemSetId, initialData, onUpdate }: CoGAnalysisSectionProps) {
  const { toggleDrawer } = useIronclawContext();
  const designInterview = useDesignInterview(problemSetId);
  const { participants, isCollaborative, isMyTurn } = designInterview;
  const [cogAnalysis, setCogAnalysis] = useState<CoGAnalysis>(initialData);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if initialData changes externally
  useEffect(() => {
    setCogAnalysis(initialData);
  }, [initialData]);

  const scheduleAutoSave = useCallback(
    (data: CoGAnalysis) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onUpdate(data);
      }, 2000);
    },
    [onUpdate]
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleFriendlyChange = useCallback(
    (tree: CoGTreeType) => {
      const updated = { ...cogAnalysis, friendly: tree };
      setCogAnalysis(updated);
      scheduleAutoSave(updated);
    },
    [cogAnalysis, scheduleAutoSave]
  );

  const handleAdversaryChange = useCallback(
    (tree: CoGTreeType) => {
      const updated = { ...cogAnalysis, adversary: tree };
      setCogAnalysis(updated);
      scheduleAutoSave(updated);
    },
    [cogAnalysis, scheduleAutoSave]
  );

  // Determine if gate should show for this section
  const showGate = designInterview.awaitingConfirm &&
    designInterview.interviewState?.currentSection === 'cog-analysis';

  // Handle Guide Me button click
  const handleGuideMe = useCallback(async () => {
    const hasFriendly = cogAnalysis.friendly?.root != null;
    const hasAdversary = cogAnalysis.adversary?.root != null;
    const mode = (hasFriendly || hasAdversary) ? 'revision' : 'new';
    await designInterview.startInterview(mode);
    toggleDrawer();
  }, [cogAnalysis, designInterview, toggleDrawer]);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      {/* Interview progress indicator — shown when interview is active */}
      {designInterview.interviewState && (
        <div className="shrink-0">
          <DesignInterviewProgress interviewState={designInterview.interviewState} />
        </div>
      )}

      {/* Section Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Center of Gravity Analysis</h2>
          <p className="text-sm text-gray-400">Strange's CG-CC-CR-CV Framework</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Participant awareness bar — shown when collaborative interview is active */}
          {designInterview.isActive && isCollaborative && (
            <div className="flex items-center gap-1.5 mr-1" title="Active participants">
              {Array.from(participants.entries()).map(([did, role]) => (
                <div key={did} className="flex flex-col items-center" title={role}>
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getRoleColor(role) }}
                  />
                  <span className="text-gray-500" style={{ fontSize: '9px', lineHeight: '1.2' }}>{role}</span>
                </div>
              ))}
            </div>
          )}
          {/* Guide Me button — pulses when it's this user's turn */}
          <button
            onClick={handleGuideMe}
            disabled={designInterview.isLoading}
            className={`text-blue-400 hover:text-blue-300 border border-blue-500/30 rounded px-3 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors${isMyTurn ? ' ring-2 ring-blue-400 animate-pulse' : ''}`}
            title={isMyTurn ? "Ironclaw is directing a question to you" : "Start guided CoG analysis interview with Ironclaw"}
          >
            {isMyTurn ? 'Your Turn' : 'Guide Me'}
          </button>
        </div>
      </div>

      {/* Review gate — shown when CoG section awaits confirmation */}
      {showGate && designInterview.lastMessage && (
        <div className="shrink-0">
          <DesignInterviewGate
            section="cog-analysis"
            summary={designInterview.lastMessage}
            onConfirm={designInterview.confirmSection}
            onRevise={(feedback) => {
              toggleDrawer();
              designInterview.sendMessage(feedback);
            }}
            isLoading={designInterview.isLoading}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {/* Main Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto">
          {/* Side-by-side Trees */}
          <div className="flex flex-col lg:flex-row gap-0">
            {/* Friendly Forces */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 px-3">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <h3 className="text-sm font-medium text-blue-400">Friendly Forces</h3>
              </div>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 min-h-75">
                <CoGTree
                  tree={cogAnalysis.friendly}
                  side="friendly"
                  onTreeChange={handleFriendlyChange}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="hidden lg:block w-px bg-gray-700 mx-2" />
            <div className="block lg:hidden h-px bg-gray-700 my-2" />

            {/* Adversary Forces */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3 px-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <h3 className="text-sm font-medium text-red-400">Adversary Forces</h3>
              </div>
              <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 min-h-75">
                <CoGTree
                  tree={cogAnalysis.adversary}
                  side="adversary"
                  onTreeChange={handleAdversaryChange}
                />
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 px-3 py-2 bg-gray-800/30 rounded text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
              <span>Center of Gravity (CG)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
              <span>Critical Capability (CC)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
              <span>Critical Requirement (CR)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }} />
              <span>Critical Vulnerability (CV)</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
