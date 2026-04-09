/**
 * InlineError -- Inline error with retry button
 *
 * Renders an error message inline in the chat with an optional Retry button
 * per D-06 of the UI-SPEC.
 */

import type { InlineErrorState } from '../../types/ironclaw.ts';

interface InlineErrorProps {
  error: InlineErrorState;
  onRetry: (originalMessageId: string) => void;
}

function WarningIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-red-400 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

export function InlineError({ error, onRetry }: InlineErrorProps) {
  return (
    <div className="bg-red-950/30 border border-red-800/50 rounded-lg px-3 py-2 flex items-center gap-2 my-1">
      <WarningIcon />

      <span className="text-xs text-red-300 flex-1">{error.message}</span>

      {error.retryable && (
        <button
          type="button"
          onClick={() => onRetry(error.originalMessageId || '')}
          disabled={error.retrying}
          className="px-2 py-1 text-xs bg-red-900/50 hover:bg-red-800/50 border border-red-700 rounded text-red-200 cursor-pointer disabled:opacity-50 flex-shrink-0"
        >
          {error.retrying ? (
            <span className="flex items-center gap-1">
              Retrying
              <span className="inline-flex gap-0.5">
                <span className="w-1 h-1 bg-red-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-red-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-red-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </span>
          ) : (
            'Retry'
          )}
        </button>
      )}
    </div>
  );
}
