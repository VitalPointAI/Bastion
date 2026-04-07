/**
 * CoGAnalysisSection
 *
 * Phase 25 Plan 03/06: Side-by-side CoG analysis container with friendly and
 * adversary trees. Auto-saves on changes with debounce. Includes AI panel
 * for CoG analysis suggestions and validation.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type { CoGAnalysis, CoGTree as CoGTreeType, CoGNode } from '../../lib/design-service.ts';
import { CoGTree } from './CoGTree.tsx';

/**
 * Validate that a CoGTree has the expected structure.
 * Agent-generated data may have a completely different schema
 * (e.g. root as a string instead of a CoGNode object).
 */
function normalizeCoGTree(tree: unknown): CoGTreeType {
  if (!tree || typeof tree !== 'object') return { root: null };
  const t = tree as Record<string, unknown>;
  if (t.root === null || t.root === undefined) return { root: null };
  if (typeof t.root === 'string') {
    // Agent returned root as a label string — wrap in a valid CoGNode
    return {
      root: {
        id: crypto.randomUUID(),
        type: 'cog',
        label: t.root as string,
        description: (t as Record<string, unknown>).description as string ?? '',
        children: [],
      },
    };
  }
  if (typeof t.root === 'object') {
    // Validate it looks like a CoGNode
    const r = t.root as Record<string, unknown>;
    if (typeof r.id === 'string' && typeof r.label === 'string') {
      return { root: normalizeCoGNode(r) };
    }
    // Has some fields but not id/label — try to salvage
    return {
      root: {
        id: (r.id as string) ?? crypto.randomUUID(),
        type: 'cog',
        label: (r.label as string) ?? (r.name as string) ?? 'Center of Gravity',
        description: (r.description as string) ?? '',
        children: Array.isArray(r.children) ? r.children.map((c: unknown) => normalizeCoGNode(c as Record<string, unknown>)) : [],
      },
    };
  }
  return { root: null };
}

function normalizeCoGNode(raw: Record<string, unknown>): CoGNode {
  return {
    id: (raw.id as string) ?? crypto.randomUUID(),
    type: (raw.type as CoGNode['type']) ?? 'cog',
    label: (raw.label as string) ?? (raw.name as string) ?? '',
    description: (raw.description as string) ?? '',
    children: Array.isArray(raw.children)
      ? raw.children.map((c: unknown) => normalizeCoGNode(c as Record<string, unknown>))
      : [],
  };
}
import { useIronclawContext } from '../../context/IronclawContext.tsx';
import { useDesignInterview, getRoleColor } from '../../hooks/useDesignInterview.ts';
import { DesignInterviewGate } from './DesignInterviewGate.tsx';

export interface CoGAnalysisSectionProps {
  problemSetId: string;
  initialData: CoGAnalysis;
  onUpdate: (data: CoGAnalysis) => void;
}


export function CoGAnalysisSection({ problemSetId, initialData, onUpdate }: CoGAnalysisSectionProps) {
  const { toggleDrawer } = useIronclawContext();
  const designInterview = useDesignInterview(problemSetId);
  const { participants, isCollaborative } = designInterview;
  const [activeTab, setActiveTab] = useState<'friendly' | 'adversary'>('friendly');
  const [cogAnalysis, setCogAnalysis] = useState<CoGAnalysis>(() => ({
    friendly: normalizeCoGTree(initialData?.friendly),
    adversary: normalizeCoGTree(initialData?.adversary),
  }));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync if initialData changes externally
  useEffect(() => {
    setCogAnalysis({
      friendly: normalizeCoGTree(initialData?.friendly),
      adversary: normalizeCoGTree(initialData?.adversary),
    });
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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-lg font-semibold text-gray-100">Center of Gravity Analysis</h2>
        {/* Participant awareness bar — shown when collaborative interview is active */}
        {designInterview.isActive && isCollaborative && (
          <div className="flex items-center gap-1.5" title="Active participants">
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

      {/* Friendly / Adversary tabs */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setActiveTab('friendly')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-t border-b-2 transition-colors ${
            activeTab === 'friendly'
              ? 'border-blue-500 text-blue-400 bg-gray-800/50'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          Friendly Forces
        </button>
        <button
          onClick={() => setActiveTab('adversary')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-t border-b-2 transition-colors ${
            activeTab === 'adversary'
              ? 'border-red-500 text-red-400 bg-gray-800/50'
              : 'border-transparent text-gray-500 hover:text-gray-300'
          }`}
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          Adversary Forces
        </button>
      </div>

      {/* Active tree — full width */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4 min-h-75">
          {activeTab === 'friendly' ? (
            <CoGTree
              tree={cogAnalysis.friendly}
              side="friendly"
              onTreeChange={handleFriendlyChange}
            />
          ) : (
            <CoGTree
              tree={cogAnalysis.adversary}
              side="adversary"
              onTreeChange={handleAdversaryChange}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 px-3 py-2 mt-3 bg-gray-800/30 rounded text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#ef4444' }} />
            <span>CG</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#f59e0b' }} />
            <span>CC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#3b82f6' }} />
            <span>CR</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: '#10b981' }} />
            <span>CV</span>
          </div>
        </div>
      </div>
    </div>
  );
}
