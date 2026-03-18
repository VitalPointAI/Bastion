/**
 * IronclawSuggestion -- Proactive suggestion card with optional field write-back
 *
 * Blue-tinted card with agent attribution and accept/dismiss buttons.
 * When targetField is present, shows "Apply to {field}" button that writes
 * the suggestion value into the target field.
 */

import Markdown from 'react-markdown';
import type { SuggestionData } from '../../types/ironclaw.ts';

interface IronclawSuggestionProps {
  suggestion: SuggestionData;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function IronclawSuggestion({ suggestion, onAccept, onDismiss }: IronclawSuggestionProps) {
  const hasFieldTarget = suggestion.targetField && suggestion.fieldValue;

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

      {/* Content — rendered as markdown */}
      <div className="ironclaw-md text-sm text-gray-200 mb-2">
        <Markdown
          components={{
            p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            code: ({ children }) => <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">{children}</code>,
            ul: ({ children }) => <ul className="list-disc pl-4 mb-1 space-y-0.5">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-1 space-y-0.5">{children}</ol>,
          }}
        >
          {suggestion.content}
        </Markdown>
      </div>

      {/* Field value preview — shown when write-back is available */}
      {hasFieldTarget && suggestion.fieldValue && (
        <div className="mt-2 mb-2 p-2 rounded bg-slate-800/60 border border-slate-700/50">
          <div className="text-[10px] text-slate-400 mb-1 uppercase tracking-wide font-medium">
            Value to apply
          </div>
          <div className="text-xs text-slate-200 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
            {suggestion.fieldValue}
          </div>
        </div>
      )}

      {/* Agent attribution */}
      <p className="text-[10px] text-gray-400 mb-3">
        Suggested by <span className="text-blue-400">{suggestion.agentDisplayName}</span>
      </p>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => onAccept(suggestion.id)}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded
            bg-green-700 hover:bg-green-600 text-white transition-colors"
        >
          {hasFieldTarget ? (
            <span className="flex items-center justify-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Apply to {suggestion.targetFieldLabel || 'Field'}
            </span>
          ) : (
            'Accept'
          )}
        </button>
        <button
          onClick={() => onDismiss(suggestion.id)}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded
            bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
