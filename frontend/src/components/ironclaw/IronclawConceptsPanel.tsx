/**
 * IronclawConceptsPanel
 *
 * Phase 66 Plan 05: Knowledge tab panel for the Ironclaw drawer.
 * Displays concepts learned by Ironclaw with filter pills, version history,
 * and retract confirmation. Per D-08 (transparency) and D-09 (version browsing).
 *
 * Features:
 * - Fetch concepts from /api/ironclaw/:problemSetId/concepts
 * - Filter pills by concept type (client-side)
 * - Expandable concept cards with full value and version history
 * - Inline version history timeline with accordion behavior
 * - Retract confirmation banner (optimistic removal)
 * - Empty and error states
 */

import { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConceptEntry {
  id: string;
  concept_key: string;
  concept_type: string;
  value: Record<string, unknown>;
  confidence: number;
  version: number;
  status: 'active' | 'superseded' | 'retracted' | 'contradicted';
  source_thread_id?: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IronclawConceptsPanelProps {
  problemSetId: string | null;
  userDid: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<string, string> = {
  actor: 'bg-blue-900/50 text-blue-300 border-blue-700/40',
  situation: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/40',
  assessment: 'bg-violet-900/50 text-violet-300 border-violet-700/40',
  preference: 'bg-slate-700/60 text-slate-400 border-slate-600/40',
  lesson: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/40',
  intent: 'bg-amber-900/50 text-amber-300 border-amber-700/40',
  relationship: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/40',
  directive: 'bg-orange-900/50 text-orange-300 border-orange-700/40',
};

const FILTER_TYPES = [
  'all',
  'actor',
  'situation',
  'assessment',
  'preference',
  'lesson',
  'intent',
  'relationship',
  'directive',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths === 1) return '1 month ago';
  return `${diffMonths} months ago`;
}

function getValuePreview(value: Record<string, unknown>): string {
  const text =
    typeof value === 'string'
      ? value
      : typeof value.text === 'string'
      ? value.text
      : typeof value.summary === 'string'
      ? value.summary
      : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 120)}...` : text;
}

function getValueFull(value: Record<string, unknown>): string {
  return typeof value === 'string'
    ? value
    : typeof value.text === 'string'
    ? value.text
    : typeof value.summary === 'string'
    ? value.summary
    : JSON.stringify(value, null, 2);
}

// ---------------------------------------------------------------------------
// ConceptCard sub-component
// ---------------------------------------------------------------------------

interface ConceptCardProps {
  concept: ConceptEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  historyId: string | null;
  history: ConceptEntry[];
  onToggleHistory: () => void;
  retractingId: string | null;
  onRetractRequest: () => void;
  onRetractConfirm: () => void;
  onRetractCancel: () => void;
}

function ConceptCard({
  concept,
  isExpanded,
  onToggleExpand,
  historyId,
  history,
  onToggleHistory,
  retractingId,
  onRetractRequest,
  onRetractConfirm,
  onRetractCancel,
}: ConceptCardProps) {
  const typeColor = TYPE_COLORS[concept.concept_type] ?? 'bg-slate-700/60 text-slate-400 border-slate-600/40';
  const isShowingHistory = historyId === concept.id;
  const isConfirmingRetract = retractingId === concept.id;
  const valuePreview = getValuePreview(concept.value);
  const valueFull = getValueFull(concept.value);

  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5">
      {/* Header row */}
      <button
        onClick={onToggleExpand}
        aria-expanded={isExpanded}
        className="w-full flex items-center gap-2 text-left"
        aria-label={`${isExpanded ? 'Collapse' : 'Expand'} concept: ${concept.concept_key}`}
      >
        {/* Concept key */}
        <span className="text-sm font-semibold text-slate-200 flex-1 truncate">
          {concept.concept_key}
        </span>

        {/* Type badge */}
        <span
          className={`text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${typeColor} shrink-0`}
        >
          {concept.concept_type}
        </span>

        {/* Version */}
        <span className="text-[9px] text-slate-500 font-mono shrink-0">
          v{concept.version}
        </span>

        {/* Confidence */}
        <span className="text-[10px] text-slate-500 shrink-0">
          {Math.round(concept.confidence * 100)}%
        </span>

        {/* Relative time */}
        <span className="text-[10px] text-slate-500 shrink-0">
          {relativeTime(concept.updated_at)}
        </span>

        {/* Expand chevron */}
        <svg
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Value preview (collapsed) */}
      {!isExpanded && (
        <p className="text-xs text-slate-300 leading-snug mt-1">{valuePreview}</p>
      )}

      {/* Contradicted badge */}
      {concept.status === 'contradicted' && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border bg-amber-900/60 text-amber-300 border-amber-700/60">
            Contradicted
          </span>
          <button
            onClick={onToggleHistory}
            className="text-[10px] text-amber-400 hover:text-amber-300 cursor-pointer"
          >
            Resolve
          </button>
        </div>
      )}

      {/* Consolidated badge */}
      {concept.source_thread_id === 'consolidation' && (
        <span className="mt-1.5 inline-block text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border bg-emerald-900/40 text-emerald-300 border-emerald-700/40">
          Consolidated
        </span>
      )}

      {/* Expanded content */}
      {isExpanded && (
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          {/* Full value */}
          <p className="text-xs text-slate-300 leading-snug whitespace-pre-wrap">
            {valueFull}
          </p>

          {/* Actions row */}
          <div className="flex items-center gap-3 mt-2.5">
            {/* View / hide history */}
            <button
              onClick={onToggleHistory}
              aria-expanded={isShowingHistory}
              className="text-[10px] text-amber-400 cursor-pointer hover:text-amber-300"
            >
              {isShowingHistory ? 'Hide history' : 'View history'}
            </button>

            {/* Retract button (only if not already confirming) */}
            {!isConfirmingRetract && (
              <button
                onClick={onRetractRequest}
                className="ml-auto text-slate-600 hover:text-red-400 transition-colors p-1 rounded"
                aria-label={`Retract concept: ${concept.concept_key}`}
                title="Retract this concept"
              >
                {/* Trash icon */}
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Retract confirmation banner */}
          {isConfirmingRetract && (
            <div className="mt-2.5 bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2.5">
              <p className="text-xs text-red-300 mb-2">
                Retract this concept? Ironclaw will no longer use this understanding. This cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={onRetractConfirm}
                  className="px-3 py-1 text-[10px] font-semibold rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
                >
                  Retract
                </button>
                <button
                  onClick={onRetractCancel}
                  className="px-3 py-1 text-[10px] rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Version history inline expand */}
          <div
            className={`overflow-hidden transition-all duration-200 ${isShowingHistory ? 'max-h-96' : 'max-h-0'}`}
          >
            {isShowingHistory && history.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                <div className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">
                  Version History
                </div>
                {history.map((entry) => {
                  const isCurrent = entry.version === concept.version && entry.status === 'active';
                  const isRetracted = entry.status === 'retracted';
                  const isSuperseded = entry.status === 'superseded';
                  return (
                    <div
                      key={entry.id}
                      className={`pl-3 border-l-2 ${
                        isCurrent ? 'border-amber-400' : 'border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] text-slate-500 font-mono">v{entry.version}</span>
                        {isRetracted && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0.5 rounded bg-red-900/40 text-red-400 border border-red-700/40">
                            Retracted
                          </span>
                        )}
                        {isSuperseded && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0.5 rounded bg-slate-700/60 text-slate-500 border border-slate-600/40">
                            Superseded
                          </span>
                        )}
                        {isCurrent && (
                          <span className="text-[9px] uppercase tracking-wider font-semibold px-1 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-700/40">
                            Current
                          </span>
                        )}
                        <span className="text-[10px] text-slate-600 ml-auto">
                          {relativeTime(entry.updated_at)}
                        </span>
                      </div>
                      <p
                        className={`text-[10px] leading-snug mt-0.5 ${
                          isRetracted
                            ? 'text-red-400'
                            : isSuperseded
                            ? 'text-slate-500 line-through'
                            : 'text-slate-300'
                        }`}
                      >
                        {getValuePreview(entry.value)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function IronclawConceptsPanel({ problemSetId, userDid: _userDid }: IronclawConceptsPanelProps) {
  const [concepts, setConcepts] = useState<ConceptEntry[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [history, setHistory] = useState<ConceptEntry[]>([]);
  const [retractingId, setRetractingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Fetch concepts
  // ---------------------------------------------------------------------------

  const fetchConcepts = useCallback(() => {
    setLoading(true);
    setError(null);
    const url = problemSetId
      ? `/api/ironclaw/${problemSetId}/concepts`
      : '/api/ironclaw/global/concepts';

    fetch(url, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: ConceptEntry[]) => {
        setConcepts(data);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load concepts');
        setLoading(false);
      });
  }, [problemSetId]);

  useEffect(() => {
    fetchConcepts();
  }, [fetchConcepts]);

  // ---------------------------------------------------------------------------
  // History fetch
  // ---------------------------------------------------------------------------

  const handleToggleHistory = useCallback(
    (concept: ConceptEntry) => {
      if (historyId === concept.id) {
        setHistoryId(null);
        setHistory([]);
        return;
      }
      setHistoryId(concept.id);
      const url = problemSetId
        ? `/api/ironclaw/${problemSetId}/concepts/${encodeURIComponent(concept.concept_key)}/history`
        : `/api/ironclaw/global/concepts/${encodeURIComponent(concept.concept_key)}/history`;
      fetch(url, { credentials: 'include' })
        .then((r) => (r.ok ? r.json() : []))
        .then((data: ConceptEntry[]) => setHistory(data))
        .catch(() => setHistory([]));
    },
    [historyId, problemSetId]
  );

  // ---------------------------------------------------------------------------
  // Retract
  // ---------------------------------------------------------------------------

  const handleRetractConfirm = useCallback(
    async (conceptId: string) => {
      const previous = concepts;
      setConcepts((prev) => prev.filter((c) => c.id !== conceptId));
      setRetractingId(null);
      setExpandedId(null);
      setHistoryId(null);

      try {
        const r = await fetch(
          `/api/ironclaw/${problemSetId ?? 'global'}/concepts/${conceptId}/retract`,
          { method: 'POST', credentials: 'include' }
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
      } catch {
        // Revert on error
        setConcepts(previous);
        setError('Failed to retract concept. Please try again.');
      }
    },
    [concepts, problemSetId]
  );

  // ---------------------------------------------------------------------------
  // Filtered list
  // ---------------------------------------------------------------------------

  const filtered =
    filter === 'all' ? concepts : concepts.filter((c) => c.concept_type === filter);

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-500">
        <svg className="w-5 h-5 animate-spin mb-2 text-slate-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-xs">Loading concepts...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && concepts.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-xs text-red-400">
          Failed to load concepts.{' '}
          <button
            onClick={fetchConcepts}
            className="underline hover:no-underline text-red-300"
          >
            Retry
          </button>
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!loading && concepts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        {/* Lightbulb icon */}
        <svg
          className="w-6 h-6 mb-3 text-slate-700"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        <p className="text-xs text-slate-300 font-medium">No concepts learned yet</p>
        <p className="text-xs text-slate-500 mt-1 max-w-56 leading-relaxed">
          As you work with Ironclaw, it will extract key knowledge from your conversations and store it here.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Section count */}
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        {filtered.length} {filtered.length === 1 ? 'Concept' : 'Concepts'}
        {filter !== 'all' && ` — ${filter}`}
      </div>

      {/* Inline error (after initial load) */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter pills */}
      <div
        role="group"
        aria-label="Filter by concept type"
        className="flex flex-wrap gap-1.5"
      >
        {FILTER_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            aria-pressed={filter === type}
            className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded cursor-pointer transition-colors ${
              filter === type
                ? 'bg-slate-700 text-slate-200 border border-slate-600'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {type}
          </button>
        ))}
      </div>

      {/* Concept cards */}
      {filtered.map((concept) => (
        <ConceptCard
          key={concept.id}
          concept={concept}
          isExpanded={expandedId === concept.id}
          onToggleExpand={() => {
            setExpandedId((prev) => (prev === concept.id ? null : concept.id));
            // Close retract confirm if switching cards
            if (retractingId !== concept.id) setRetractingId(null);
          }}
          historyId={historyId}
          history={historyId === concept.id ? history : []}
          onToggleHistory={() => handleToggleHistory(concept)}
          retractingId={retractingId}
          onRetractRequest={() => setRetractingId(concept.id)}
          onRetractConfirm={() => handleRetractConfirm(concept.id)}
          onRetractCancel={() => setRetractingId(null)}
        />
      ))}
    </div>
  );
}
