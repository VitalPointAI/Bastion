/**
 * IronclawMemoryPanel
 *
 * Phase 57 Plan 03: Memory transparency panel displayed as a tab in the
 * Ironclaw drawer. Users can view all memories Ironclaw has about them,
 * inspect what was learned, and delete individual entries or all memories.
 *
 * Features:
 * - Fetch memories on mount via ironclawApi.getMemories()
 * - Human-readable key labels (working_style -> "Working Style")
 * - JSONB value display as key-value pairs
 * - Confidence badge, source badge (inferred/explicit), relative time
 * - Per-entry delete with optimistic removal + revert on error
 * - Delete all with confirmation
 * - Loading and empty states
 */

import { useState, useEffect } from 'react';
import type { IronclawMemoryEntry } from '../../types/ironclaw.ts';
import { ironclawApi } from '../../lib/ironclaw-service.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert snake_case key to Title Case label */
function formatKey(key: string): string {
  return key
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Format ISO date string as relative time */
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

/** Format a confidence float as a percentage string */
function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IronclawMemoryPanel() {
  const [memories, setMemories] = useState<IronclawMemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  // Fetch memories on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    ironclawApi
      .getMemories()
      .then((result) => {
        if (!cancelled) {
          setMemories(result.memories);
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message || 'Failed to load memories');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  async function handleDeleteMemory(key: string) {
    // Optimistic removal
    const previous = memories;
    setMemories((prev) => prev.filter((m) => m.memory_key !== key));
    setDeletingKey(key);
    try {
      await ironclawApi.deleteMemory(key);
    } catch (err) {
      // Revert on error
      setMemories(previous);
      setError(`Failed to delete memory: ${(err as Error).message}`);
    } finally {
      setDeletingKey(null);
    }
  }

  async function handleDeleteAll() {
    setShowDeleteAllConfirm(false);
    const previous = memories;
    setMemories([]);
    setDeletingAll(true);
    try {
      await ironclawApi.deleteAllMemories();
    } catch (err) {
      setMemories(previous);
      setError(`Failed to delete all memories: ${(err as Error).message}`);
    } finally {
      setDeletingAll(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-gray-500">
        <svg
          className="w-5 h-5 animate-spin mb-2 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs">Loading memories...</span>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Empty state
  // ---------------------------------------------------------------------------

  if (!loading && memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
        {/* Brain icon */}
        <svg
          className="w-10 h-10 mb-3 text-slate-600"
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
        <p className="text-sm text-gray-400 font-medium">No memories yet</p>
        <p className="text-xs text-gray-500 mt-1 max-w-56 leading-relaxed">
          Ironclaw hasn't learned about your preferences yet. As you interact, it will
          remember your working style and preferences.
        </p>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Memory list
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Section heading */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          {memories.length} {memories.length === 1 ? 'Memory' : 'Memories'}
        </div>
        {memories.length > 0 && (
          <button
            onClick={() => setShowDeleteAllConfirm(true)}
            disabled={deletingAll}
            className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50 transition-colors"
            title="Delete all memories"
          >
            Delete All
          </button>
        )}
      </div>

      {/* Delete all confirmation */}
      {showDeleteAllConfirm && (
        <div className="bg-red-900/20 border border-red-700/40 rounded-lg px-3 py-2.5">
          <p className="text-xs text-red-300 mb-2 font-medium">
            Delete all {memories.length} memories? Ironclaw will start fresh with no knowledge of your preferences.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleDeleteAll}
              className="px-3 py-1 text-[10px] font-semibold rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
            >
              Delete All
            </button>
            <button
              onClick={() => setShowDeleteAllConfirm(false)}
              className="px-3 py-1 text-[10px] rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Memory cards */}
      {memories.map((memory) => (
        <MemoryCard
          key={memory.id}
          memory={memory}
          isDeleting={deletingKey === memory.memory_key}
          onDelete={() => handleDeleteMemory(memory.memory_key)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MemoryCard sub-component
// ---------------------------------------------------------------------------

interface MemoryCardProps {
  memory: IronclawMemoryEntry;
  isDeleting: boolean;
  onDelete: () => void;
}

function MemoryCard({ memory, isDeleting, onDelete }: MemoryCardProps) {
  const [expanded, setExpanded] = useState(false);

  const valueEntries = Object.entries(memory.memory_value);

  return (
    <div
      className={`bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5
        transition-opacity ${isDeleting ? 'opacity-40' : 'opacity-100'}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          {/* Key label */}
          <span className="text-sm font-medium text-slate-200 truncate">
            {formatKey(memory.memory_key)}
          </span>
          {/* Meta row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Source badge */}
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                memory.source === 'explicit'
                  ? 'bg-blue-900/50 text-blue-300 border border-blue-700/40'
                  : 'bg-slate-700/60 text-slate-400 border border-slate-600/40'
              }`}
            >
              {memory.source}
            </span>
            {/* Confidence badge */}
            <span className="text-[10px] text-slate-500">
              {formatConfidence(memory.confidence)} confidence
            </span>
            {/* Relative time */}
            <span className="text-[10px] text-slate-600">
              {relativeTime(memory.updated_at)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Expand/collapse toggle */}
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="text-slate-600 hover:text-slate-400 p-1 rounded transition-colors"
            title={expanded ? 'Collapse' : 'Inspect'}
            aria-label={expanded ? 'Collapse memory details' : 'Inspect memory details'}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={expanded
                  ? 'M5 15l7-7 7 7'
                  : 'M19 9l-7 7-7-7'}
              />
            </svg>
          </button>

          {/* Delete button */}
          <button
            onClick={onDelete}
            disabled={isDeleting}
            className="text-slate-600 hover:text-red-400 disabled:opacity-40 p-1 rounded transition-colors"
            title="Delete this memory"
            aria-label={`Delete memory: ${formatKey(memory.memory_key)}`}
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
        </div>
      </div>

      {/* Expanded value details */}
      {expanded && valueEntries.length > 0 && (
        <div className="mt-2 pt-2 border-t border-slate-700/50">
          <div className="flex flex-col gap-1">
            {valueEntries.map(([k, v]) => (
              <div key={k} className="flex items-start gap-2 text-xs">
                <span className="text-slate-500 shrink-0 min-w-20 font-mono">
                  {k}:
                </span>
                <span className="text-slate-300 break-all">
                  {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
