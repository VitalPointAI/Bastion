/**
 * IronclawDirectivesPanel
 *
 * Phase 66 Plan 05: Commander Priorities section within the Knowledge panel.
 * Per D-07: commanders need persistent directives that guide Ironclaw's behavior.
 *
 * Directives are stored as concepts with type 'directive'. The value field
 * contains `{ text: directiveText }`.
 *
 * Features:
 * - Fetch directives from /api/ironclaw/:problemSetId/concepts filtered by type=directive
 * - Add directive with optimistic insertion
 * - Delete directive with 3-second undo toast (optimistic remove, revert on undo)
 * - Empty state, error state, loading state
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ConceptEntry } from './IronclawConceptsPanel.tsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DirectiveItem {
  id: string;
  text: string;
  createdAt: string;
}

interface UndoState {
  item: DirectiveItem;
  timeout: ReturnType<typeof setTimeout>;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IronclawDirectivesPanelProps {
  problemSetId: string | null;
  userDid: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IronclawDirectivesPanel({ problemSetId, userDid: _userDid }: IronclawDirectivesPanelProps) {
  const [directives, setDirectives] = useState<DirectiveItem[]>([]);
  const [newDirective, setNewDirective] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<UndoState | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Fetch
  // ---------------------------------------------------------------------------

  const fetchDirectives = useCallback(() => {
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
        const items: DirectiveItem[] = data
          .filter((c) => c.concept_type === 'directive')
          .map((c) => ({
            id: c.id,
            text:
              typeof c.value === 'object' && typeof (c.value as Record<string, unknown>).text === 'string'
                ? ((c.value as Record<string, unknown>).text as string)
                : JSON.stringify(c.value),
            createdAt: c.created_at,
          }));
        setDirectives(items);
        setLoading(false);
      })
      .catch((err: Error) => {
        setError(err.message || 'Failed to load priorities');
        setLoading(false);
      });
  }, [problemSetId]);

  useEffect(() => {
    fetchDirectives();
  }, [fetchDirectives]);

  // ---------------------------------------------------------------------------
  // Add directive
  // ---------------------------------------------------------------------------

  const handleAdd = async () => {
    const text = newDirective.trim();
    if (!text) return;

    const key = `directive:${Date.now()}`;
    const tempId = crypto.randomUUID();
    const optimisticItem: DirectiveItem = {
      id: tempId,
      text,
      createdAt: new Date().toISOString(),
    };

    // Optimistic add
    setDirectives((prev) => [optimisticItem, ...prev]);
    setNewDirective('');
    setSaving(true);

    try {
      const url = problemSetId
        ? `/api/ironclaw/${problemSetId}/concepts`
        : '/api/ironclaw/global/concepts';
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          conceptKey: key,
          conceptType: 'directive',
          value: { text },
          confidence: 1.0,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      // Refresh to get real ID from server
      fetchDirectives();
    } catch {
      // Revert optimistic add
      setDirectives((prev) => prev.filter((d) => d.id !== tempId));
      setError('Priority could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  // ---------------------------------------------------------------------------
  // Delete directive (with 3s undo)
  // ---------------------------------------------------------------------------

  const handleDelete = useCallback(
    (item: DirectiveItem) => {
      // Clear any existing undo
      if (undoItem) {
        clearTimeout(undoItem.timeout);
        // Fire the retract for the previous undo item immediately
        const prevItem = undoItem.item;
        const retractUrl = problemSetId
          ? `/api/ironclaw/${problemSetId}/concepts/${prevItem.id}/retract`
          : `/api/ironclaw/global/concepts/${prevItem.id}/retract`;
        fetch(retractUrl, { method: 'POST', credentials: 'include' }).catch(() => {});
      }

      // Optimistic remove
      setDirectives((prev) => prev.filter((d) => d.id !== item.id));

      // Set 3000ms undo window
      const timeout = setTimeout(() => {
        // Fire retract API after undo window expires
        const retractUrl = problemSetId
          ? `/api/ironclaw/${problemSetId}/concepts/${item.id}/retract`
          : `/api/ironclaw/global/concepts/${item.id}/retract`;
        fetch(retractUrl, { method: 'POST', credentials: 'include' }).catch(() => {});
        setUndoItem(null);
      }, 3000);

      setUndoItem({ item, timeout });
    },
    [undoItem, problemSetId]
  );

  const handleUndo = useCallback(() => {
    if (!undoItem) return;
    clearTimeout(undoItem.timeout);
    setDirectives((prev) => [undoItem.item, ...prev]);
    setUndoItem(null);
  }, [undoItem]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Section heading */}
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        Commander Priorities
      </div>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline hover:no-underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading priorities...
        </div>
      )}

      {/* Empty state */}
      {!loading && directives.length === 0 && !undoItem && (
        <p className="text-xs text-slate-500 italic">
          No priorities set. Add a priority to guide Ironclaw's focus between monitoring cycles.
        </p>
      )}

      {/* Directive list */}
      {!loading && directives.map((item) => (
        <div
          key={item.id}
          className="flex items-start gap-2 bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2.5"
        >
          {/* Text */}
          <span className="text-xs text-slate-300 leading-snug flex-1">{item.text}</span>

          {/* Remove button */}
          <button
            onClick={() => handleDelete(item)}
            className="text-slate-600 hover:text-red-400 transition-colors p-0.5 rounded shrink-0"
            aria-label={`Remove priority: ${item.text}`}
            title="Remove priority"
          >
            {/* Trash icon (14px) */}
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
      ))}

      {/* Add Priority input row */}
      <div className="flex flex-col gap-2 mt-1">
        <input
          ref={inputRef}
          type="text"
          value={newDirective}
          onChange={(e) => setNewDirective(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g. Prioritize Baltic naval movements over economic data"
          className="bg-slate-800/60 border border-slate-700/60 rounded px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-slate-500 outline-none w-full"
          disabled={saving}
        />
        <button
          onClick={handleAdd}
          disabled={!newDirective.trim() || saving}
          className="self-end px-3 py-1 text-[10px] font-semibold rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add Priority
        </button>
      </div>

      {/* Undo toast */}
      {undoItem && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[960] flex items-center gap-3 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2.5 shadow-xl text-xs text-slate-300">
          Priority removed.
          <button
            onClick={handleUndo}
            className="text-amber-400 hover:text-amber-300 font-semibold underline"
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
