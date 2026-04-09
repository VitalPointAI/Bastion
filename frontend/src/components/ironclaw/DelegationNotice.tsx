/**
 * DelegationNotice -- Delegation notice with agent panel link
 *
 * Shows in the chat when Ironclaw delegates to a specialist agent.
 * Per D-09, D-10 of the UI-SPEC.
 */

import type { DelegationState } from '../../types/ironclaw.ts';

interface DelegationNoticeProps {
  delegation: DelegationState;
  onViewInAgentPanel: (specialistId: string) => void;
}

function ShieldIcon() {
  return (
    <svg
      className="w-4 h-4 text-blue-400 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

export function DelegationNotice({ delegation, onViewInAgentPanel }: DelegationNoticeProps) {
  const isComplete = delegation.status === 'complete';

  return (
    <div
      className="bg-slate-700/40 border border-slate-600 rounded-lg px-3 py-2 flex items-center gap-2 my-1"
      style={{ animation: 'fadeIn 150ms ease-in-out' }}
    >
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>

      <ShieldIcon />

      <span className="text-xs text-gray-300 flex-1">
        {isComplete ? (
          <>
            Delegation to <strong className="font-semibold">{delegation.specialistDisplayName}</strong> complete
            {delegation.resultSummary && (
              <span className="text-gray-400"> — {delegation.resultSummary}</span>
            )}
          </>
        ) : (
          <>
            Delegating to <strong className="font-semibold">{delegation.specialistDisplayName}</strong>...
          </>
        )}
        <button
          type="button"
          onClick={() => onViewInAgentPanel(delegation.specialistId)}
          className="text-blue-400 hover:text-blue-300 underline text-xs ml-1 cursor-pointer"
        >
          View in Agent Panel
        </button>
      </span>
    </div>
  );
}
