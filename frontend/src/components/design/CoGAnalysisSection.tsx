/**
 * CoGAnalysisSection
 *
 * Phase 25 Plan 03: Side-by-side CoG analysis container with friendly and
 * adversary trees. Auto-saves on changes with debounce.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CoGAnalysis, CoGTree as CoGTreeType } from '../../lib/design-service.ts';
import { CoGTree } from './CoGTree.tsx';

interface CoGAnalysisSectionProps {
  problemSetId: string;
  initialData: CoGAnalysis;
  onUpdate: (data: CoGAnalysis) => void;
}

export function CoGAnalysisSection({ problemSetId, initialData, onUpdate }: CoGAnalysisSectionProps) {
  const [cogAnalysis, setCogAnalysis] = useState<CoGAnalysis>(initialData);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep problemSetId in scope for future use
  void problemSetId;

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

  return (
    <div className="flex flex-col gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Center of Gravity Analysis</h2>
          <p className="text-sm text-gray-400">Strange's CG-CC-CR-CV Framework</p>
        </div>
      </div>

      {/* Side-by-side Trees */}
      <div className="flex flex-col lg:flex-row gap-0">
        {/* Friendly Forces */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3 px-3">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <h3 className="text-sm font-medium text-blue-400">Friendly Forces</h3>
          </div>
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 min-h-[300px]">
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
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3 min-h-[300px]">
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
  );
}
