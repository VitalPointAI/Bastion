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
import { DesignAIPanel } from './DesignAIPanel.tsx';

interface CoGAnalysisSectionProps {
  problemSetId: string;
  initialData: CoGAnalysis;
  onUpdate: (data: CoGAnalysis) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  aiCache?: Map<string, Record<string, any>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onAiCacheUpdate?: (cache: Map<string, Record<string, any>>) => void;
}

/**
 * Map a CoG suggestion type to the expected child type in the CG-CC-CR-CV hierarchy.
 */
function findParentForType(
  node: CoGNode | null,
  suggestionParentType: string | null
): CoGNode | null {
  if (!node) return null;
  if (suggestionParentType === null) return null; // Root-level suggestion
  if (node.type === suggestionParentType) return node;
  for (const child of node.children) {
    const found = findParentForType(child, suggestionParentType);
    if (found) return found;
  }
  return null;
}

/**
 * Deep clone a CoG tree, adding a new node under the first matching parent.
 */
function addNodeToTree(tree: CoGTreeType, newNode: CoGNode, parentType: string | null): CoGTreeType {
  // If no root and suggestion is for a CG, create it as root
  if (!tree.root && (parentType === null || newNode.type === 'cog')) {
    return { root: newNode };
  }

  if (!tree.root) return tree;

  // Deep clone
  const cloneNode = (n: CoGNode): CoGNode => ({
    ...n,
    children: n.children.map(cloneNode),
  });

  const clonedRoot = cloneNode(tree.root);

  // Find parent and add child
  const parent = findParentForType(clonedRoot, parentType);
  if (parent) {
    parent.children = [...parent.children, newNode];
  }

  return { root: clonedRoot };
}

export function CoGAnalysisSection({ problemSetId, initialData, onUpdate, aiCache, onAiCacheUpdate }: CoGAnalysisSectionProps) {
  const [cogAnalysis, setCogAnalysis] = useState<CoGAnalysis>(initialData);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
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

  const handleApplyCogSuggestion = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (suggestion: any) => {
      const newNode: CoGNode = {
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: suggestion.type,
        label: suggestion.label,
        description: suggestion.description,
        children: [],
      };

      const side: 'friendly' | 'adversary' = suggestion.side || 'friendly';
      const parentType: string | null = suggestion.parentType ?? null;

      const updatedTree = addNodeToTree(cogAnalysis[side], newNode, parentType);
      const updated: CoGAnalysis = {
        ...cogAnalysis,
        [side]: updatedTree,
      };

      setCogAnalysis(updated);
      // Trigger immediate save for applied suggestions
      onUpdate(updated);
    },
    [cogAnalysis, onUpdate]
  );

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Center of Gravity Analysis</h2>
          <p className="text-sm text-gray-400">Strange's CG-CC-CR-CV Framework</p>
        </div>
      </div>

      {/* Content + AI Panel */}
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

        {/* AI Panel */}
        <DesignAIPanel
          problemSetId={problemSetId}
          activeSection="cog-analysis"
          sectionData={cogAnalysis}
          isOpen={aiPanelOpen}
          onToggle={() => setAiPanelOpen(!aiPanelOpen)}
          onApplyCogSuggestion={handleApplyCogSuggestion}
          externalCache={aiCache}
          onCacheUpdate={onAiCacheUpdate}
        />
      </div>
    </div>
  );
}
