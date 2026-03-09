/**
 * DesignAIPanel
 *
 * Phase 25 Plan 02/06: Collapsible right-side AI assistant panel.
 * Section-aware with cached results per section. Explicit trigger model.
 * Renders section-specific cards for problem-framing, cog-analysis, and lines-of-effort.
 */

import { useState, useCallback } from 'react';
import { designService } from '../../lib/design-service.ts';
import { AIFramingCard } from './AIFramingCard.tsx';
import type { AlternativeFraming } from './AIFramingCard.tsx';
import { AgentTeamComposer } from './AgentTeamComposer.tsx';

// ==========================================================================
// CoG Analysis Types (mirrors backend CoGAnalysisOutput)
// ==========================================================================

interface CoGSuggestion {
  type: 'cog' | 'critical-capability' | 'critical-requirement' | 'critical-vulnerability';
  label: string;
  description: string;
  parentType: string | null;
  side: 'friendly' | 'adversary';
  rationale: string;
  confidence: number;
  confidenceBounds: { lower: number; upper: number };
}

interface CoGValidationIssue {
  nodeId: string;
  issue: string;
  severity: 'warning' | 'error';
}

// ==========================================================================
// LOE Gap Analysis Types (mirrors backend LOEGapAnalysisOutput)
// ==========================================================================

interface LOEGapSuggestion {
  type: 'unaddressed-vulnerability' | 'missing-linkage' | 'phase-gap' | 'loe-suggestion';
  description: string;
  affectedLoeId: string | null;
  affectedCogNodeId: string | null;
  recommendation: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number;
  confidenceBounds: { lower: number; upper: number };
}

// ==========================================================================
// Narrative Synthesis Types (mirrors backend NarrativeSynthesisOutput)
// ==========================================================================

interface NarrativeDraft {
  narrative: string;
  sections: Array<{ heading: string; content: string }>;
  confidence: number;
  confidenceBounds: { lower: number; upper: number };
  synthesisNotes: string[];
}

// ==========================================================================
// Props
// ==========================================================================

interface DesignAIPanelProps {
  problemSetId: string;
  activeSection: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sectionData: Record<string, any>;
  isOpen: boolean;
  onToggle: () => void;
  onAdopt?: (framing: AlternativeFraming) => void;
  onMerge?: (framing: AlternativeFraming) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onApplyCogSuggestion?: (suggestion: any) => void;
  onApplyNarrative?: (narrative: string) => void;
}

// ==========================================================================
// Helpers
// ==========================================================================

const COG_TYPE_LABELS: Record<string, string> = {
  cog: 'CG',
  'critical-capability': 'CC',
  'critical-requirement': 'CR',
  'critical-vulnerability': 'CV',
};

const COG_TYPE_COLORS: Record<string, string> = {
  cog: 'bg-red-500/20 text-red-400 border-red-500/40',
  'critical-capability': 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  'critical-requirement': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
  'critical-vulnerability': 'bg-green-500/20 text-green-400 border-green-500/40',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/40',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
};

const GAP_TYPE_LABELS: Record<string, string> = {
  'unaddressed-vulnerability': 'Unaddressed Vulnerability',
  'missing-linkage': 'Missing Linkage',
  'phase-gap': 'Phase Gap',
  'loe-suggestion': 'LOE Suggestion',
};

function confidenceLabel(value: number): { text: string; color: string } {
  if (value >= 0.7) return { text: 'High', color: 'text-green-400' };
  if (value >= 0.4) return { text: 'Medium', color: 'text-amber-400' };
  return { text: 'Low', color: 'text-red-400' };
}

function scoreBarColor(score: number): string {
  if (score >= 0.7) return 'bg-green-500';
  if (score >= 0.4) return 'bg-amber-500';
  return 'bg-red-500';
}

// ==========================================================================
// Sub-Components
// ==========================================================================

function ScoreBar({ label, score }: { label: string; score: number }) {
  const pct = Math.round(score * 100);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
        <span>{label}</span>
        <span className="font-medium text-gray-300">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBarColor(score)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ValidationIssueCard({ issue }: { issue: CoGValidationIssue }) {
  const isError = issue.severity === 'error';
  return (
    <div
      className={`p-2 mb-2 rounded text-xs border-l-2 ${
        isError
          ? 'bg-red-900/20 border-red-500 text-red-300'
          : 'bg-amber-900/20 border-amber-500 text-amber-300'
      }`}
    >
      <span className="font-medium uppercase text-[10px] tracking-wider">
        {issue.severity}
      </span>
      <p className="mt-0.5">{issue.issue}</p>
    </div>
  );
}

function CogSuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: CoGSuggestion;
  onApply?: () => void;
  onDismiss: () => void;
}) {
  const confidence = confidenceLabel(suggestion.confidence);
  const typeColor = COG_TYPE_COLORS[suggestion.type] || 'bg-gray-500/20 text-gray-400';
  const typeLabel = COG_TYPE_LABELS[suggestion.type] || suggestion.type;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
      {/* Header badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${typeColor}`}>
          {typeLabel}
        </span>
        <span
          className={`text-[10px] font-medium uppercase px-1.5 py-0.5 rounded border ${
            suggestion.side === 'friendly'
              ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
              : 'bg-red-500/20 text-red-400 border-red-500/40'
          }`}
        >
          {suggestion.side}
        </span>
        <span className={`text-xs font-medium ml-auto ${confidence.color}`}>
          {confidence.text} ({Math.round(suggestion.confidence * 100)}%)
        </span>
      </div>

      {/* Content */}
      <p className="text-sm font-medium text-gray-200 mb-1">{suggestion.label}</p>
      <p className="text-xs text-gray-300 leading-relaxed mb-1">{suggestion.description}</p>
      <p className="text-xs text-gray-500 italic leading-relaxed">{suggestion.rationale}</p>

      {/* Actions */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
        {onApply && (
          <button
            onClick={onApply}
            className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          >
            Apply
          </button>
        )}
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-xs font-medium rounded text-red-400 hover:text-red-300 transition-colors ml-auto"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

function LoeGapCard({
  suggestion,
  onDismiss,
}: {
  suggestion: LOEGapSuggestion;
  onDismiss: () => void;
}) {
  const confidence = confidenceLabel(suggestion.confidence);
  const priorityColor = PRIORITY_COLORS[suggestion.priority] || 'bg-gray-500/20 text-gray-400';
  const typeLabel = GAP_TYPE_LABELS[suggestion.type] || suggestion.type;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
      {/* Header badges */}
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${priorityColor}`}>
          {suggestion.priority}
        </span>
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          {typeLabel}
        </span>
        <span className={`text-xs font-medium ml-auto ${confidence.color}`}>
          {confidence.text} ({Math.round(suggestion.confidence * 100)}%)
        </span>
      </div>

      {/* Content */}
      <p className="text-xs text-gray-200 leading-relaxed mb-2">{suggestion.description}</p>

      {/* Recommendation callout */}
      <div className="bg-gray-700/50 border border-gray-600 rounded p-2 mb-2">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
          Recommendation
        </p>
        <p className="text-xs text-gray-300 leading-relaxed">{suggestion.recommendation}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
        <button
          onClick={onDismiss}
          className="px-3 py-1 text-xs font-medium rounded text-red-400 hover:text-red-300 transition-colors ml-auto"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

// ==========================================================================
// Main Component
// ==========================================================================

export function DesignAIPanel({
  problemSetId,
  activeSection,
  sectionData,
  isOpen,
  onToggle,
  onAdopt,
  onMerge,
  onApplyCogSuggestion,
  onApplyNarrative,
}: DesignAIPanelProps) {
  // Section-keyed cache to prevent stale results on section switch
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [resultsCache, setResultsCache] = useState<Map<string, Record<string, any>>>(new Map());
  const [dismissedIds, setDismissedIds] = useState<Map<string, Set<number>>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Agent team composition: additional agents per section
  const [sectionAgents, setSectionAgents] = useState<Map<string, string[]>>(new Map());
  const additionalAgents = sectionAgents.get(activeSection) ?? [];
  const handleAgentsChange = useCallback(
    (agentIds: string[]) => {
      setSectionAgents((prev) => {
        const next = new Map(prev);
        next.set(activeSection, agentIds);
        return next;
      });
    },
    [activeSection],
  );

  const cachedResults = resultsCache.get(activeSection);
  const dismissed = dismissedIds.get(activeSection) ?? new Set<number>();

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await designService.analyzeSection(
        problemSetId,
        activeSection,
        sectionData,
        additionalAgents.length > 0 ? additionalAgents : undefined,
      );
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
  }, [problemSetId, activeSection, sectionData, additionalAgents]);

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

  // ==========================================================================
  // Section-specific rendering
  // ==========================================================================

  const renderCogAnalysisResults = () => {
    if (!cachedResults) return null;

    const validationIssues = (cachedResults.validationIssues || []) as CoGValidationIssue[];
    const suggestions = (cachedResults.suggestions || []) as CoGSuggestion[];
    const completenessScore = (cachedResults.completenessScore as number) ?? 0;

    const visibleSuggestions = suggestions.filter((_, i) => !dismissed.has(i));
    const allDismissed = suggestions.length > 0 && visibleSuggestions.length === 0;

    return (
      <div>
        {/* Completeness Score */}
        <ScoreBar label="Analysis Completeness" score={completenessScore} />

        {/* Validation Issues */}
        {validationIssues.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              Validation Issues ({validationIssues.length})
            </p>
            {validationIssues.map((issue, i) => (
              <ValidationIssueCard key={`vi-${i}`} issue={issue} />
            ))}
          </div>
        )}

        {/* Suggestions */}
        {suggestions.map((suggestion, index) =>
          dismissed.has(index) ? null : (
            <CogSuggestionCard
              key={`cog-${index}`}
              suggestion={suggestion}
              onApply={
                onApplyCogSuggestion
                  ? () => onApplyCogSuggestion(suggestion)
                  : undefined
              }
              onDismiss={() => handleDismiss(index)}
            />
          )
        )}

        {allDismissed && (
          <div className="text-xs text-gray-500 text-center mt-4">
            All suggestions dismissed. Click Analyze again for fresh results.
          </div>
        )}

        {suggestions.length === 0 && validationIssues.length === 0 && (
          <div className="text-xs text-gray-500 text-center mt-4">
            No issues found. CoG analysis looks complete.
          </div>
        )}
      </div>
    );
  };

  const renderLoeGapResults = () => {
    if (!cachedResults) return null;

    const suggestions = (cachedResults.suggestions || []) as LOEGapSuggestion[];
    const coverageScore = (cachedResults.coverageScore as number) ?? 0;

    const visibleSuggestions = suggestions.filter((_, i) => !dismissed.has(i));
    const allDismissed = suggestions.length > 0 && visibleSuggestions.length === 0;

    return (
      <div>
        {/* Coverage Score */}
        <ScoreBar label="CV Coverage" score={coverageScore} />

        {/* Gap Suggestions */}
        {suggestions.map((suggestion, index) =>
          dismissed.has(index) ? null : (
            <LoeGapCard
              key={`loe-${index}`}
              suggestion={suggestion}
              onDismiss={() => handleDismiss(index)}
            />
          )
        )}

        {allDismissed && (
          <div className="text-xs text-gray-500 text-center mt-4">
            All suggestions dismissed. Click Analyze again for fresh results.
          </div>
        )}

        {suggestions.length === 0 && (
          <div className="text-xs text-gray-500 text-center mt-4">
            No gaps found. LOE-CoG coverage looks complete.
          </div>
        )}
      </div>
    );
  };

  const renderOperationalApproachResults = () => {
    if (!cachedResults) return null;

    const drafts = (cachedResults.drafts || []) as NarrativeDraft[];
    const completenessScore = (cachedResults.completenessScore as number) ?? 0;

    // Collect synthesis notes from all drafts
    const allNotes: string[] = [];
    for (const draft of drafts) {
      for (const note of draft.synthesisNotes ?? []) {
        if (!allNotes.includes(note)) allNotes.push(note);
      }
    }

    const visibleDrafts = drafts.filter((_, i) => !dismissed.has(i));
    const allDismissed = drafts.length > 0 && visibleDrafts.length === 0;

    return (
      <div>
        {/* Design Completeness Score */}
        <ScoreBar label="Design Completeness" score={completenessScore} />

        {/* Synthesis Notes */}
        {allNotes.length > 0 && (
          <div className="mb-3">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
              Synthesis Notes ({allNotes.length})
            </p>
            {allNotes.map((note, i) => (
              <div
                key={`note-${i}`}
                className="p-2 mb-1 rounded text-xs bg-blue-900/20 border-l-2 border-blue-500 text-blue-300"
              >
                {note}
              </div>
            ))}
          </div>
        )}

        {/* Narrative Drafts */}
        {drafts.map((draft, index) =>
          dismissed.has(index) ? null : (
            <div key={`draft-${index}`} className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
              {/* Header */}
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border bg-purple-500/20 text-purple-400 border-purple-500/40">
                  Draft {index + 1}
                </span>
                <span className={`text-xs font-medium ml-auto ${confidenceLabel(draft.confidence).color}`}>
                  {confidenceLabel(draft.confidence).text} ({Math.round(draft.confidence * 100)}%)
                </span>
              </div>

              {/* Sections Preview */}
              {(draft.sections ?? []).map((section, sIdx) => (
                <div key={`section-${sIdx}`} className="mb-2">
                  <p className="text-xs font-medium text-gray-300 mb-0.5">{section.heading}</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {section.content.length > 100
                      ? section.content.slice(0, 100) + '...'
                      : section.content}
                  </p>
                </div>
              ))}

              {/* Actions */}
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
                {onApplyNarrative && (
                  <button
                    onClick={() => onApplyNarrative(draft.narrative)}
                    className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                  >
                    Apply
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(index)}
                  className="px-3 py-1 text-xs font-medium rounded text-red-400 hover:text-red-300 transition-colors ml-auto"
                >
                  Dismiss
                </button>
              </div>
            </div>
          )
        )}

        {allDismissed && (
          <div className="text-xs text-gray-500 text-center mt-4">
            All drafts dismissed. Click Analyze again for fresh results.
          </div>
        )}

        {drafts.length === 0 && (
          <div className="text-xs text-gray-500 text-center mt-4">
            No narrative drafts generated. Add more design data and try again.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative w-80 shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col overflow-hidden">
      {toggleButton}

      {/* Header */}
      <div className="p-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-200">AI Assistant</h3>
        <p className="text-xs text-gray-500 mt-0.5">{sectionLabel}</p>
      </div>

      {/* Agent Team Composer */}
      <div className="p-3 border-b border-gray-700">
        <AgentTeamComposer
          section={activeSection}
          additionalAgents={additionalAgents}
          onAgentsChange={handleAgentsChange}
        />
      </div>

      {/* Analyze Button */}
      <div className="p-3 border-b border-gray-700">
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="w-full px-3 py-2 text-sm font-medium rounded bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white transition-colors"
        >
          {loading ? 'Analyzing...' : `Analyze${additionalAgents.length > 0 ? ` (${additionalAgents.length + 1} agents)` : ''}`}
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

        {/* CoG Analysis Results */}
        {activeSection === 'cog-analysis' && renderCogAnalysisResults()}

        {/* Lines of Effort Gap Results */}
        {activeSection === 'lines-of-effort' && renderLoeGapResults()}

        {/* Operational Approach Results */}
        {activeSection === 'operational-approach' && renderOperationalApproachResults()}

        {/* Unsupported section fallback */}
        {activeSection !== 'problem-framing' &&
          activeSection !== 'cog-analysis' &&
          activeSection !== 'lines-of-effort' &&
          activeSection !== 'operational-approach' &&
          cachedResults && (
            <div className="text-xs text-gray-500 text-center mt-8">
              Analysis results available for {sectionLabel}.
            </div>
          )}

        {/* Additional Agent Contributions */}
        {cachedResults?.agentContributions &&
          (cachedResults.agentContributions as AgentContributionResult[]).length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-700">
              <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                Supplementary Agent Analysis ({(cachedResults.agentContributions as AgentContributionResult[]).length})
              </p>
              {(cachedResults.agentContributions as AgentContributionResult[]).map((contrib) => (
                <AgentContributionCard key={contrib.agentId} contribution={contrib} />
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// ==========================================================================
// Agent Contribution Types & Card
// ==========================================================================

interface AgentContributionResult {
  agentId: string;
  agentName: string;
  analysis: string;
  confidence: number;
  keyPoints: string[];
}

function AgentContributionCard({ contribution }: { contribution: AgentContributionResult }) {
  const [expanded, setExpanded] = useState(false);
  const confidence = confidenceLabel(contribution.confidence);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
        <span className="text-xs font-medium text-gray-200">{contribution.agentName}</span>
        <span className={`text-xs font-medium ml-auto ${confidence.color}`}>
          {confidence.text} ({Math.round(contribution.confidence * 100)}%)
        </span>
      </div>

      {/* Key Points */}
      {contribution.keyPoints.length > 0 && (
        <div className="space-y-1 mb-2">
          {contribution.keyPoints.map((point, i) => (
            <div key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
              <span className="text-blue-400 mt-0.5 shrink-0">&#8226;</span>
              <span>{point}</span>
            </div>
          ))}
        </div>
      )}

      {/* Analysis (collapsible) */}
      {contribution.analysis && (
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-[10px] text-gray-500 hover:text-gray-400 transition-colors"
          >
            {expanded ? 'Hide full analysis' : 'Show full analysis'}
          </button>
          {expanded && (
            <p className="text-xs text-gray-400 leading-relaxed mt-1 whitespace-pre-wrap">
              {contribution.analysis}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
