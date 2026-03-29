/**
 * PIRPanel
 *
 * Design tab panel for managing Priority Intelligence Requirements.
 * Displays CCIR, PIR, FFIR, and EEFI records with type badges,
 * priority ordering, status indicators, linked assumptions, and
 * Ironclaw-driven derivation from operational design.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  PIR,
  PIRType,
  PIRStatus,
  PIRSuggestion,
  CreatePIRInput,
} from '../../lib/pir-service.ts';
import {
  listPIRs,
  createPIR,
  updatePIR,
  deletePIR,
  answerPIR,
  derivePIRsFromDesign,
} from '../../lib/pir-service.ts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TYPE_COLORS: Record<PIRType, { bg: string; text: string; label: string }> = {
  CCIR: { bg: 'bg-red-900/40', text: 'text-red-300', label: 'CCIR' },
  PIR:  { bg: 'bg-amber-900/40', text: 'text-amber-300', label: 'PIR' },
  FFIR: { bg: 'bg-blue-900/40', text: 'text-blue-300', label: 'FFIR' },
  EEFI: { bg: 'bg-purple-900/40', text: 'text-purple-300', label: 'EEFI' },
};

const STATUS_DISPLAY: Record<PIRStatus, { icon: string; className: string }> = {
  ACTIVE:     { icon: '\u25CF', className: 'text-green-400' },
  ANSWERED:   { icon: '\u2713', className: 'text-blue-400' },
  SUPERSEDED: { icon: '\u2014', className: 'text-gray-500 line-through' },
  CANCELLED:  { icon: '\u2717', className: 'text-gray-600' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PIRPanelProps {
  problemSetId: string;
  assumptions?: string[];
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TypeBadge({ type }: { type: PIRType }) {
  const colors = TYPE_COLORS[type];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {colors.label}
    </span>
  );
}

function StatusIndicator({ status }: { status: PIRStatus }) {
  const display = STATUS_DISPLAY[status];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${display.className}`}>
      <span>{display.icon}</span>
      <span>{status}</span>
    </span>
  );
}

function PriorityBadge({ priority }: { priority: number }) {
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-700 text-gray-200 text-xs font-bold">
      {priority}
    </span>
  );
}

// ---------------------------------------------------------------------------
// PIR Row
// ---------------------------------------------------------------------------

interface PIRRowProps {
  pir: PIR;
  onUpdate: (id: string, updates: Partial<PIR>) => void;
  onDelete: (id: string) => void;
  onAnswer: (id: string) => void;
}

function PIRRow({ pir, onUpdate, onDelete, onAnswer }: PIRRowProps) {
  const [expanded, setExpanded] = useState(false);
  const statusDisplay = STATUS_DISPLAY[pir.status];

  return (
    <div className="border border-gray-700 rounded-lg bg-gray-800/50 mb-2">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-800/80"
        onClick={() => setExpanded(!expanded)}
      >
        <PriorityBadge priority={pir.priority} />
        <TypeBadge type={pir.type} />
        <StatusIndicator status={pir.status} />
        <p className={`flex-1 text-sm text-gray-200 truncate ${pir.status === 'SUPERSEDED' ? 'line-through text-gray-500' : ''}`}>
          {pir.description}
        </p>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
          {/* Full description */}
          <div className="mt-3">
            <p className="text-sm text-gray-300 whitespace-pre-wrap">{pir.description}</p>
          </div>

          {/* Source info */}
          {pir.sourceType && (
            <div className="text-xs text-gray-500">
              Source: <span className="text-gray-400">{pir.sourceType}</span>
              {pir.sourceId && <span className="ml-1 text-gray-600">({pir.sourceId})</span>}
            </div>
          )}

          {/* Linked assumptions */}
          {pir.linkedAssumptionIds.length > 0 && (
            <div>
              <span className="text-xs font-medium text-gray-400">Linked Assumptions:</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {pir.linkedAssumptionIds.map((aid) => (
                  <span key={aid} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-700 text-xs text-gray-300">
                    {aid.length > 24 ? aid.slice(0, 24) + '...' : aid}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Answer section */}
          {pir.status === 'ANSWERED' && pir.answer && (
            <div className="bg-blue-900/20 border border-blue-800/40 rounded p-3">
              <div className="text-xs font-medium text-blue-400 mb-1">
                Answer {pir.answeredBy && `by ${pir.answeredBy}`}
                {pir.answeredAt && ` on ${new Date(pir.answeredAt).toLocaleDateString()}`}
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{pir.answer}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            {pir.status === 'ACTIVE' && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); onAnswer(pir.id); }}
                  className="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 text-white"
                >
                  Answer
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(pir.id, { status: 'SUPERSEDED' }); }}
                  className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Supersede
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onUpdate(pir.id, { status: 'CANCELLED' }); }}
                  className="px-3 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
                >
                  Cancel
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(pir.id); }}
              className="px-3 py-1 text-xs rounded bg-red-900/50 hover:bg-red-800/50 text-red-300 ml-auto"
            >
              Delete
            </button>
          </div>

          {/* Metadata */}
          <div className="text-xs text-gray-600 pt-1">
            Created {new Date(pir.createdAt).toLocaleDateString()} by {pir.createdBy}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create PIR Modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  problemSetId: string;
  onCreated: () => void;
  onClose: () => void;
}

function CreatePIRModal({ problemSetId, onCreated, onClose }: CreateModalProps) {
  const [type, setType] = useState<PIRType>('PIR');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(1);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await createPIR({
        problemSetId,
        type,
        description: description.trim(),
        priority,
        createdBy: 'user',
      });
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create PIR:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Add Intelligence Requirement</h3>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-400 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as PIRType)}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
              >
                <option value="CCIR">CCIR - Commander's Critical</option>
                <option value="PIR">PIR - Priority Intelligence</option>
                <option value="FFIR">FFIR - Friendly Force</option>
                <option value="EEFI">EEFI - Essential Elements</option>
              </select>
            </div>
            <div className="w-24">
              <label className="block text-xs font-medium text-gray-400 mb-1">Priority</label>
              <input
                type="number"
                min={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              placeholder="Describe the intelligence requirement..."
              className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !description.trim()}
            className="px-4 py-2 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Answer Modal
// ---------------------------------------------------------------------------

interface AnswerModalProps {
  pirId: string;
  onAnswered: () => void;
  onClose: () => void;
}

function AnswerPIRModal({ pirId, onAnswered, onClose }: AnswerModalProps) {
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setSaving(true);
    try {
      await answerPIR(pirId, answer.trim(), 'user');
      onAnswered();
      onClose();
    } catch (err) {
      console.error('Failed to answer PIR:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">Answer Intelligence Requirement</h3>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={6}
          placeholder="Provide the answer with supporting evidence..."
          className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 resize-none"
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !answer.trim()}
            className="px-4 py-2 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
          >
            {saving ? 'Submitting...' : 'Submit Answer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Suggestions Panel (from derive_pirs_from_design)
// ---------------------------------------------------------------------------

interface SuggestionsPanelProps {
  suggestions: PIRSuggestion[];
  problemSetId: string;
  onCreated: () => void;
  onClose: () => void;
}

function SuggestionsPanel({ suggestions, problemSetId, onCreated, onClose }: SuggestionsPanelProps) {
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(suggestions.filter((s) => !s.possibleDuplicate).map((_, i) => i))
  );
  const [creating, setCreating] = useState(false);

  const toggleSelection = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const toCreate = suggestions.filter((_, i) => selected.has(i));
      for (const s of toCreate) {
        await createPIR({
          problemSetId,
          type: s.type as PIRType,
          description: s.description,
          priority: s.priority,
          sourceType: s.sourceType,
          createdBy: 'ironclaw',
        });
      }
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create suggested PIRs:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-800 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">
            Recommended PIRs from Design ({suggestions.length})
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-2 mb-4">
          {suggestions.map((s, i) => (
            <div
              key={i}
              className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                selected.has(i)
                  ? 'border-blue-600 bg-blue-900/20'
                  : 'border-gray-700 bg-gray-800/30 hover:bg-gray-800/50'
              } ${s.possibleDuplicate ? 'opacity-60' : ''}`}
              onClick={() => toggleSelection(i)}
            >
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleSelection(i)}
                  className="rounded border-gray-600 bg-gray-900 text-blue-600"
                  onClick={(e) => e.stopPropagation()}
                />
                <TypeBadge type={s.type as PIRType} />
                <span className="text-xs text-gray-500">Priority {s.priority}</span>
                {s.possibleDuplicate && (
                  <span className="text-xs text-yellow-500 ml-auto">Possible duplicate</span>
                )}
              </div>
              <p className="text-sm text-gray-300 mb-1">{s.description}</p>
              <div className="text-xs text-gray-500">
                <span className="text-gray-400">Source:</span> {s.sourceLabel}
              </div>
              <div className="text-xs text-gray-600 mt-1">{s.rationale}</div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-gray-700 pt-4">
          <span className="text-sm text-gray-400">
            {selected.size} of {suggestions.length} selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded bg-gray-700 hover:bg-gray-600 text-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || selected.size === 0}
              className="px-4 py-2 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white disabled:opacity-50"
            >
              {creating ? 'Creating...' : `Create ${selected.size} PIR${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter Bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  activeType: PIRType | 'ALL';
  activeStatus: PIRStatus | 'ALL';
  onTypeChange: (t: PIRType | 'ALL') => void;
  onStatusChange: (s: PIRStatus | 'ALL') => void;
}

function FilterBar({ activeType, activeStatus, onTypeChange, onStatusChange }: FilterBarProps) {
  const types: Array<PIRType | 'ALL'> = ['ALL', 'CCIR', 'PIR', 'FFIR', 'EEFI'];
  const statuses: Array<PIRStatus | 'ALL'> = ['ALL', 'ACTIVE', 'ANSWERED', 'SUPERSEDED', 'CANCELLED'];

  return (
    <div className="flex flex-wrap items-center gap-4 mb-4">
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Type:</span>
        {types.map((t) => (
          <button
            key={t}
            onClick={() => onTypeChange(t)}
            className={`px-2 py-0.5 text-xs rounded ${
              activeType === t
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-gray-500 mr-1">Status:</span>
        {statuses.map((s) => (
          <button
            key={s}
            onClick={() => onStatusChange(s)}
            className={`px-2 py-0.5 text-xs rounded ${
              activeStatus === s
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function PIRPanel({ problemSetId, assumptions }: PIRPanelProps) {
  const [pirs, setPirs] = useState<PIR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<PIRSuggestion[] | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [filterType, setFilterType] = useState<PIRType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<PIRStatus | 'ALL'>('ALL');

  const fetchPIRs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const filters: { type?: PIRType; status?: PIRStatus } = {};
      if (filterType !== 'ALL') filters.type = filterType;
      if (filterStatus !== 'ALL') filters.status = filterStatus;
      const data = await listPIRs(problemSetId, filters);
      setPirs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PIRs');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, filterType, filterStatus]);

  useEffect(() => {
    fetchPIRs();
  }, [fetchPIRs]);

  const handleUpdate = async (id: string, updates: Partial<PIR>) => {
    try {
      await updatePIR(id, updates);
      await fetchPIRs();
    } catch (err) {
      console.error('Failed to update PIR:', err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deletePIR(id);
      await fetchPIRs();
    } catch (err) {
      console.error('Failed to delete PIR:', err);
    }
  };

  const handleDerive = async () => {
    setDeriving(true);
    try {
      const result = await derivePIRsFromDesign(problemSetId);
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      } else {
        setError('No PIR suggestions could be derived. Ensure the operational design has content (assumptions, CoG analysis, LOEs).');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to derive PIRs');
    } finally {
      setDeriving(false);
    }
  };

  // Summary counts
  const activePIRs = pirs.filter((p) => p.status === 'ACTIVE');
  const answeredPIRs = pirs.filter((p) => p.status === 'ANSWERED');
  const ccirCount = pirs.filter((p) => p.type === 'CCIR' && p.status === 'ACTIVE').length;
  const pirCount = pirs.filter((p) => p.type === 'PIR' && p.status === 'ACTIVE').length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Intelligence Requirements</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {activePIRs.length} active ({ccirCount} CCIR, {pirCount} PIR) / {answeredPIRs.length} answered / {pirs.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDerive}
            disabled={deriving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-purple-800/50 hover:bg-purple-700/50 text-purple-200 border border-purple-700/50 disabled:opacity-50"
          >
            {deriving ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            )}
            Derive from Design
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add PIR
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterBar
        activeType={filterType}
        activeStatus={filterStatus}
        onTypeChange={setFilterType}
        onStatusChange={setFilterStatus}
      />

      {/* Error */}
      {error && (
        <div className="bg-red-900/30 border border-red-800/50 rounded-lg p-3 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-gray-500">
          <svg className="w-5 h-5 animate-spin mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Loading intelligence requirements...
        </div>
      )}

      {/* Empty state */}
      {!loading && pirs.length === 0 && (
        <div className="border border-dashed border-gray-700 rounded-lg p-8 text-center">
          <p className="text-gray-400 mb-2">No intelligence requirements yet.</p>
          <p className="text-xs text-gray-600 mb-4">
            Add PIRs manually or use "Derive from Design" to generate recommendations
            from your operational design (assumptions, CoG analysis, lines of effort).
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={handleDerive}
              disabled={deriving}
              className="px-3 py-1.5 text-sm rounded bg-purple-800/50 hover:bg-purple-700/50 text-purple-200 border border-purple-700/50"
            >
              Derive from Design
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="px-3 py-1.5 text-sm rounded bg-blue-700 hover:bg-blue-600 text-white"
            >
              Add Manually
            </button>
          </div>
        </div>
      )}

      {/* PIR List */}
      {!loading && pirs.length > 0 && (
        <div>
          {pirs.map((pir) => (
            <PIRRow
              key={pir.id}
              pir={pir}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
              onAnswer={(id) => setAnsweringId(id)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreate && (
        <CreatePIRModal
          problemSetId={problemSetId}
          onCreated={fetchPIRs}
          onClose={() => setShowCreate(false)}
        />
      )}

      {answeringId && (
        <AnswerPIRModal
          pirId={answeringId}
          onAnswered={fetchPIRs}
          onClose={() => setAnsweringId(null)}
        />
      )}

      {suggestions && (
        <SuggestionsPanel
          suggestions={suggestions}
          problemSetId={problemSetId}
          onCreated={fetchPIRs}
          onClose={() => setSuggestions(null)}
        />
      )}
    </div>
  );
}

export default PIRPanel;
