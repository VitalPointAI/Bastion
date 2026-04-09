/**
 * IronclawSuggestion -- Proactive suggestion card with field write-back
 *
 * Blue-tinted card with agent attribution and four actions:
 * - Accept: apply the suggestion value as-is to the target field
 * - Edit: inline-edit the value before applying
 * - Revise: send feedback to the agent for a revised suggestion
 * - Dismiss: discard the suggestion
 */

import { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { SuggestionData } from '../../types/ironclaw.ts';

interface IronclawSuggestionProps {
  suggestion: SuggestionData;
  onAccept: (id: string, editedValue?: string) => void;
  onDismiss: (id: string) => void;
  onRevise?: (id: string, feedback: string) => void;
}

export function IronclawSuggestion({ suggestion, onAccept, onDismiss, onRevise }: IronclawSuggestionProps) {
  const hasFieldTarget = suggestion.targetField && suggestion.fieldValue;
  const [mode, setMode] = useState<'view' | 'edit' | 'revise'>('view');
  const [editValue, setEditValue] = useState(suggestion.fieldValue ?? '');
  const [reviseComment, setReviseComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const reviseRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus when entering edit/revise mode
  useEffect(() => {
    if (mode === 'edit') editRef.current?.focus();
    if (mode === 'revise') reviseRef.current?.focus();
  }, [mode]);

  const handleAcceptEdited = () => {
    onAccept(suggestion.id, editValue);
  };

  const handleReviseSubmit = async () => {
    if (!reviseComment.trim() || !onRevise) return;
    setIsSubmitting(true);
    onRevise(suggestion.id, reviseComment.trim());
    setReviseComment('');
    setMode('view');
    setIsSubmitting(false);
  };

  return (
    <div className="border border-blue-600/40 bg-blue-950/30 rounded-lg p-3 mb-3 mr-auto max-w-[85%]">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-medium text-blue-300">Suggestion</span>
        {hasFieldTarget && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-900/50 border border-blue-700/50 text-blue-300 ml-auto">
            {suggestion.targetFieldLabel || suggestion.targetField}
          </span>
        )}
      </div>

      {/* Content — rendered as markdown (view mode) */}
      {mode === 'view' && (
        <div className="ironclaw-md text-sm text-gray-200 mb-2">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
              code: ({ children }) => <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
            }}
          >
            {suggestion.content ?? ''}
          </Markdown>
        </div>
      )}

      {/* Field value preview (view mode) */}
      {mode === 'view' && hasFieldTarget && suggestion.fieldValue && (
        <div className="mt-2 mb-2 p-2 rounded bg-slate-800/60 border border-slate-700/50">
          <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-medium">
            Value to apply
          </div>
          <div className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {suggestion.fieldValue}
          </div>
        </div>
      )}

      {/* Edit mode — editable textarea */}
      {mode === 'edit' && (
        <div className="mt-2 mb-2">
          <div className="text-[10px] text-amber-400 mb-1 uppercase tracking-wide font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit before applying
          </div>
          <textarea
            ref={editRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full bg-slate-800 border border-amber-600/40 rounded p-2 text-xs text-slate-200
              focus:outline-none focus:border-amber-500/60 resize-y min-h-[80px] max-h-[200px]"
            rows={5}
          />
        </div>
      )}

      {/* Revise mode — feedback input */}
      {mode === 'revise' && (
        <div className="mt-2 mb-2">
          <div className="text-[10px] text-purple-400 mb-1 uppercase tracking-wide font-medium flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            What should the agent change?
          </div>
          <textarea
            ref={reviseRef}
            value={reviseComment}
            onChange={(e) => setReviseComment(e.target.value)}
            placeholder="e.g. Focus more on naval capabilities, add specific force dispositions..."
            className="w-full bg-slate-800 border border-purple-600/40 rounded p-2 text-xs text-slate-200
              placeholder:text-slate-600 focus:outline-none focus:border-purple-500/60 resize-y min-h-[60px] max-h-[120px]"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleReviseSubmit();
              }
            }}
          />
        </div>
      )}

      {/* Agent attribution */}
      <p className="text-[10px] text-gray-400 mb-3">
        Suggested by <span className="text-blue-400">{suggestion.agentDisplayName}</span>
      </p>

      {/* Action buttons */}
      {mode === 'view' && (
        <div className="flex gap-1.5">
          <button
            onClick={() => onAccept(suggestion.id)}
            className="flex-1 px-2 py-1.5 text-xs font-medium rounded
              bg-green-700 hover:bg-green-600 text-white transition-colors"
          >
            {hasFieldTarget ? 'Apply' : 'Accept'}
          </button>
          {hasFieldTarget && (
            <button
              onClick={() => setMode('edit')}
              className="flex-1 px-2 py-1.5 text-xs font-medium rounded
                bg-amber-700/60 hover:bg-amber-600/60 text-amber-200 transition-colors"
            >
              Edit
            </button>
          )}
          {onRevise && (
            <button
              onClick={() => setMode('revise')}
              className="flex-1 px-2 py-1.5 text-xs font-medium rounded
                bg-purple-700/50 hover:bg-purple-600/50 text-purple-200 transition-colors"
            >
              Revise
            </button>
          )}
          <button
            onClick={() => onDismiss(suggestion.id)}
            className="px-2 py-1.5 text-xs font-medium rounded
              bg-gray-700 hover:bg-gray-600 text-gray-400 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Edit mode buttons */}
      {mode === 'edit' && (
        <div className="flex gap-1.5">
          <button
            onClick={handleAcceptEdited}
            className="flex-1 px-2 py-1.5 text-xs font-medium rounded
              bg-green-700 hover:bg-green-600 text-white transition-colors"
          >
            Apply Edited
          </button>
          <button
            onClick={() => { setMode('view'); setEditValue(suggestion.fieldValue ?? ''); }}
            className="px-3 py-1.5 text-xs font-medium rounded
              bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Revise mode buttons */}
      {mode === 'revise' && (
        <div className="flex gap-1.5">
          <button
            onClick={handleReviseSubmit}
            disabled={!reviseComment.trim() || isSubmitting}
            className="flex-1 px-2 py-1.5 text-xs font-medium rounded
              bg-purple-700 hover:bg-purple-600 text-white transition-colors
              disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Sending...' : 'Send for Revision'}
          </button>
          <button
            onClick={() => { setMode('view'); setReviseComment(''); }}
            className="px-3 py-1.5 text-xs font-medium rounded
              bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
