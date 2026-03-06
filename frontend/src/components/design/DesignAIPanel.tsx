/**
 * DesignAIPanel
 *
 * Phase 25 Plan 02: Collapsible right-side AI assistant panel.
 * Section-aware with cached results per section. Explicit trigger model.
 */

import { useState, useCallback } from 'react';
import { designService } from '../../lib/design-service.ts';
import { AIFramingCard } from './AIFramingCard.tsx';
import type { AlternativeFraming } from './AIFramingCard.tsx';

interface DesignAIPanelProps {
  problemSetId: string;
  activeSection: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectionData: Record<string, any>;
  isOpen: boolean;
  onToggle: () => void;
  onAdopt?: (framing: AlternativeFraming) => void;
  onMerge?: (framing: AlternativeFraming) => void;
}

export function DesignAIPanel({
  problemSetId,
  activeSection,
  sectionData,
  isOpen,
  onToggle,
  onAdopt,
  onMerge,
}: DesignAIPanelProps) {
  // Section-keyed cache to prevent stale results on section switch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resultsCache, setResultsCache] = useState<Map<string, Record<string, any>>>(new Map());
  const [dismissedIds, setDismissedIds] = useState<Map<string, Set<number>>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cachedResults = resultsCache.get(activeSection);
  const dismissed = dismissedIds.get(activeSection) ?? new Set<number>();

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await designService.analyzeSection(problemSetId, activeSection, sectionData);
      setResultsCache((prev) => {
        const next = new Map(prev);
        next.set(activeSection, result);
        return next;
      });
      // Reset dismissed for fresh results
      setDismissedIds((prev) => {
        const next = new Map(prev);
        next.delete(activeSection);
        return next;
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Analysis failed';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [problemSetId, activeSection, sectionData]);

  const handleDismiss = useCallback(
    (index: number) => {
      setDismissedIds((prev) => {
        const next = new Map(prev);
        const set = new Set(prev.get(activeSection) ?? []);
        set.add(index);
        next.set(activeSection, set);
        return next;
      });
    },
    [activeSection]
  );

  const sectionLabel = activeSection
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  // Toggle button always visible
  const toggleButton = (
    <button
      onClick={onToggle}
      className="absolute -left-8 top-4 w-7 h-12 bg-gray-800 border border-gray-700 border-r-0 rounded-l-md flex items-center justify-center text-gray-400 hover:text-gray-200 hover:bg-gray-700 transition-colors z-10"
      title={isOpen ? 'Close AI Panel' : 'Open AI Panel'}
    >
      <span className={`text-xs transition-transform ${isOpen ? 'rotate-180' : ''}`}>
        &#9664;
      </span>
    </button>
  );

  if (!isOpen) {
    return (
      <div className="relative w-0 shrink-0">
        {toggleButton}
      </div>
    );
  }

  return (
    <div className="relative w-80 shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
      {toggleButton}

      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">AI Assistant</h3>
        <p className="text-xs text-gray-500 mt-0.5">{sectionLabel}</p>
      </div>

      {/* Analyze Button */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full px-3 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? 'Analyzing...' : 'Analyze'}
        </button>
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <div className="text-xs text-red-400 mb-3 p-2 bg-red-900/20 rounded">
            {error}
          </div>
        )}

        {!cachedResults && !loading && !error && (
          <div className="text-xs text-gray-500 text-center mt-8">
            Click Analyze to get AI suggestions for {sectionLabel}.
          </div>
        )}

        {/* Problem Framing Results */}
        {activeSection === 'problem-framing' && cachedResults?.framings && (
          <div>
            {(cachedResults.framings as AlternativeFraming[]).map((framing, index) =>
              dismissed.has(index) ? null : (
                <AIFramingCard
                  key={`${framing.perspectiveType}-${index}`}
                  framing={framing}
                  onAdopt={(f) => onAdopt?.(f)}
                  onMerge={(f) => onMerge?.(f)}
                  onDismiss={() => handleDismiss(index)}
                />
              )
            )}
            {(cachedResults.framings as AlternativeFraming[]).every((_, i) => dismissed.has(i)) && (
              <div className="text-xs text-gray-500 text-center mt-4">
                All framings dismissed. Click Analyze again for fresh results.
              </div>
            )}
          </div>
        )}

        {/* Stub sections */}
        {activeSection !== 'problem-framing' && cachedResults && (
          <div className="text-xs text-gray-500 text-center mt-8">
            AI analysis coming soon for {sectionLabel}.
          </div>
        )}
      </div>
    </div>
  );
}
