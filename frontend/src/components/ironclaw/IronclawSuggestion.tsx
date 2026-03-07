/**
 * IronclawSuggestion -- Proactive suggestion card
 *
 * Blue-tinted card with agent attribution and accept/dismiss buttons.
 * Appears inline in chat as a special message type.
 */

import type { SuggestionData } from '../../types/ironclaw.ts';

interface IronclawSuggestionProps {
  suggestion: SuggestionData;
  onAccept: (id: string) => void;
  onDismiss: (id: string) => void;
}

export function IronclawSuggestion({ suggestion, onAccept, onDismiss }: IronclawSuggestionProps) {
  return (
    <div className="border border-blue-600/40 bg-blue-950/30 rounded-lg p-3 mb-3 mr-auto max-w-[85%]">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2">
        <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <span className="text-xs font-medium text-blue-300">Suggestion</span>
      </div>

      {/* Content */}
      <p className="text-sm text-gray-200 mb-2">{suggestion.content}</p>

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
          Accept
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
