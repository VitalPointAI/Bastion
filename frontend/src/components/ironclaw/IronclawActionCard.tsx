/**
 * IronclawActionCard -- Inline action confirmation card
 *
 * Displays action description with risk-level badge and yes/no/always buttons.
 * High-risk actions omit "Always Allow" per locked decision.
 */

import type { ActionCardData, TrustDecision } from '../../types/ironclaw.ts';

interface IronclawActionCardProps {
  card: ActionCardData;
  onDecision: (actionId: string, decision: TrustDecision) => void;
  disabled?: boolean;
}

const RISK_BADGE: Record<string, { label: string; classes: string }> = {
  low: { label: 'Low Risk', classes: 'bg-green-900/50 text-green-300 border-green-700' },
  medium: { label: 'Medium Risk', classes: 'bg-yellow-900/50 text-yellow-300 border-yellow-700' },
  high: { label: 'High Risk', classes: 'bg-red-900/50 text-red-300 border-red-700' },
};

export function IronclawActionCard({ card, onDecision, disabled }: IronclawActionCardProps) {
  const risk = RISK_BADGE[card.riskLevel] || RISK_BADGE.medium;
  const showAlways = card.riskLevel !== 'high';

  const handleDecision = (decision: TrustDecision) => {
    if (!disabled) {
      onDecision(card.actionId, decision);
    }
  };

  return (
    <div className="border border-amber-600/50 bg-amber-950/30 rounded-lg p-3 mt-1">
      {/* Header with risk badge */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-amber-300 uppercase tracking-wide">
          Authorization Required
        </span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${risk.classes}`}>
          {risk.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-200 mb-3">Ironclaw is requesting permission to: <strong>{card.description}</strong></p>

      {/* Decision buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => handleDecision('yes')}
          disabled={disabled}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded
            bg-green-700 hover:bg-green-600 text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => handleDecision('no')}
          disabled={disabled}
          className="flex-1 px-3 py-1.5 text-xs font-medium rounded
            bg-red-700 hover:bg-red-600 text-white
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors"
        >
          Deny
        </button>
        {showAlways && (
          <button
            onClick={() => handleDecision('always')}
            disabled={disabled}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded
              border border-blue-500 text-blue-300 hover:bg-blue-900/40
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors"
          >
            Always Allow
          </button>
        )}
      </div>
    </div>
  );
}
