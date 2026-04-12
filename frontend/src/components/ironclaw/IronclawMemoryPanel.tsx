/**
 * IronclawMemoryPanel
 *
 * Shows what's in Ironclaw's intrinsic memory system (the memory_documents
 * table in the Ironclaw sidecar's PostgreSQL database). The commander uses
 * this tab to verify Ironclaw's memory is working, see what's being remembered,
 * and monitor per-request token cost.
 *
 * Ironclaw's own memory_read/memory_write tools are the ONLY memory system
 * now — BASTION's previous parallel user/context memory stores have been
 * removed. Anything Ironclaw needs to remember persistently goes through its
 * own memory API, which this panel makes visible.
 *
 * Features:
 *   - Total document count + total memory cost (estimated tokens)
 *   - Auto-loaded file budget (files loaded into every LLM call — drives
 *     per-request token usage)
 *   - Per-file preview with size, last updated time, delete button
 *   - "Purge daily/ logs" bulk action for autonomous routine bloat
 */

import { useState, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffSecs = Math.floor((now - then) / 1000);
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

function formatTokens(n: number): string {
  if (n < 1000) return `${n} tokens`;
  return `${(n / 1000).toFixed(1)}k tokens`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InternalMemoryDoc {
  id: string;
  path: string;
  lengthChars: number;
  estimatedTokens: number;
  autoLoaded: boolean;
  preview: string;
  updatedAt: string;
}

interface InternalMemoryReport {
  totalDocuments: number;
  totalChars: number;
  estimatedTotalTokens: number;
  autoLoadedChars: number;
  autoLoadedTokens: number;
  documents: InternalMemoryDoc[];
}

const API_BASE = import.meta.env.VITE_API_URL || '';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function IronclawMemoryPanel() {
  const [report, setReport] = useState<InternalMemoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ironclaw/internal-memory`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InternalMemoryReport;
      setReport(data);
    } catch (err) {
      setError((err as Error).message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/ironclaw/internal-memory/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setReport((prev) => {
        if (!prev) return null;
        const remaining = prev.documents.filter((d) => d.id !== id);
        const totalChars = remaining.reduce((s, d) => s + d.lengthChars, 0);
        const autoLoadedChars = remaining
          .filter((d) => d.autoLoaded)
          .reduce((s, d) => s + d.lengthChars, 0);
        return {
          ...prev,
          documents: remaining,
          totalDocuments: remaining.length,
          totalChars,
          estimatedTotalTokens: Math.ceil(totalChars / 4),
          autoLoadedChars,
          autoLoadedTokens: Math.ceil(autoLoadedChars / 4),
        };
      });
    } catch (err) {
      setError(`Failed to delete: ${(err as Error).message}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePurgePrefix(prefix: string) {
    if (!confirm(`Delete all memory files under "${prefix}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(
        `${API_BASE}/api/ironclaw/internal-memory/prefix/${encodeURIComponent(prefix)}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await load();
    } catch (err) {
      setError(`Purge failed: ${(err as Error).message}`);
    }
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
          Ironclaw Memory
        </div>
        <button
          onClick={() => void load()}
          className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          title="Refresh"
        >
          Refresh
        </button>
      </div>

      <p className="text-[10px] text-slate-500 leading-relaxed">
        Files Ironclaw persists in its memory system. Auto-loaded files
        (marked <span className="text-amber-400">●</span>) are injected into
        every LLM call and drive per-request token cost.
      </p>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Inspecting Ironclaw memory...
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-900/20 border border-red-700/30 rounded px-3 py-2">
          {error}
        </div>
      )}

      {report && (
        <>
          {/* Summary block */}
          <div className="bg-slate-800/50 border border-slate-700/40 rounded-lg px-3 py-2.5 flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total documents</span>
              <span className="text-slate-200 font-mono">{report.totalDocuments}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Total memory cost</span>
              <span className="text-slate-200 font-mono">
                {formatTokens(report.estimatedTotalTokens)}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Auto-loaded (every request)</span>
              <span
                className={`font-mono ${
                  report.autoLoadedTokens > 5000 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {formatTokens(report.autoLoadedTokens)}
              </span>
            </div>
          </div>

          {/* Quick actions */}
          {report.documents.some((d) => d.path.startsWith('daily/')) && (
            <button
              onClick={() => void handlePurgePrefix('daily/')}
              className="text-[10px] text-red-400 hover:text-red-300 underline self-start"
            >
              Purge all daily/ logs
            </button>
          )}

          {/* Document list */}
          {report.documents.length === 0 ? (
            <p className="text-xs text-slate-500 italic">No internal memory files.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {report.documents.map((doc) => {
                const isExpanded = expandedId === doc.id;
                const isDeleting = deletingId === doc.id;
                return (
                  <div
                    key={doc.id}
                    className={`bg-slate-800/60 border border-slate-700/60 rounded-lg px-3 py-2 transition-opacity ${
                      isDeleting ? 'opacity-40' : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {doc.autoLoaded && (
                            <span
                              className="text-amber-400 shrink-0"
                              title="Auto-loaded on every LLM call"
                            >
                              ●
                            </span>
                          )}
                          <span className="text-xs text-slate-200 font-mono truncate">
                            {doc.path}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-mono">{formatTokens(doc.estimatedTokens)}</span>
                          <span>·</span>
                          <span>{relativeTime(doc.updatedAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                          className="text-slate-600 hover:text-slate-400 p-1 rounded transition-colors"
                          title={isExpanded ? 'Collapse' : 'Preview'}
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d={isExpanded ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'}
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => void handleDelete(doc.id)}
                          disabled={isDeleting}
                          className="text-slate-600 hover:text-red-400 disabled:opacity-40 p-1 rounded transition-colors"
                          title="Delete this memory file"
                        >
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
                    {isExpanded && (
                      <pre className="mt-2 pt-2 border-t border-slate-700/50 text-[10px] text-slate-400 font-mono whitespace-pre-wrap wrap-break-word max-h-40 overflow-y-auto">
                        {doc.preview}
                        {doc.lengthChars > doc.preview.length && '\n\n…[truncated preview]'}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
