/**
 * NATORatingPanel - NATO Admiralty System (STANAG 2511) rating display
 *
 * Shows source reliability (A-F) and information credibility (1-6) as
 * two side-by-side panels with prominent letter/number grades, full
 * explanatory labels, color indicators, reasoning section, and override
 * capability with audit trail.
 */

import { useState } from 'react';

// ============================================================================
// Types (frontend mirror of backend nato-ratings.ts)
// ============================================================================

export type SourceReliability = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
export type InformationCredibility = 1 | 2 | 3 | 4 | 5 | 6;

export interface NATORating {
  sourceReliability: SourceReliability;
  informationCredibility: InformationCredibility;
  assessedBy: string;
  assessedAt: string;
  reasoning: string;
  overriddenBy?: string;
  overrideReason?: string;
  overrideAt?: string;
  originalRating?: {
    sourceReliability: SourceReliability;
    informationCredibility: InformationCredibility;
  };
}

const RELIABILITY_LABELS: Record<SourceReliability, string> = {
  A: 'Completely Reliable',
  B: 'Usually Reliable',
  C: 'Fairly Reliable',
  D: 'Not Usually Reliable',
  E: 'Unreliable',
  F: 'Reliability Cannot Be Judged',
};

const CREDIBILITY_LABELS: Record<InformationCredibility, string> = {
  1: 'Confirmed by Other Sources',
  2: 'Probably True',
  3: 'Possibly True',
  4: 'Doubtfully True',
  5: 'Improbable',
  6: 'Truth Cannot Be Judged',
};

// ============================================================================
// Color mapping
// ============================================================================

const RELIABILITY_COLORS: Record<SourceReliability, { bg: string; text: string; border: string }> = {
  A: { bg: 'bg-green-900/40', text: 'text-green-400', border: 'border-green-600' },
  B: { bg: 'bg-lime-900/40', text: 'text-lime-400', border: 'border-lime-600' },
  C: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-600' },
  D: { bg: 'bg-orange-900/40', text: 'text-orange-400', border: 'border-orange-600' },
  E: { bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-600' },
  F: { bg: 'bg-gray-800/40', text: 'text-gray-400', border: 'border-gray-600' },
};

const CREDIBILITY_COLORS: Record<InformationCredibility, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-green-900/40', text: 'text-green-400', border: 'border-green-600' },
  2: { bg: 'bg-lime-900/40', text: 'text-lime-400', border: 'border-lime-600' },
  3: { bg: 'bg-yellow-900/40', text: 'text-yellow-400', border: 'border-yellow-600' },
  4: { bg: 'bg-orange-900/40', text: 'text-orange-400', border: 'border-orange-600' },
  5: { bg: 'bg-red-900/40', text: 'text-red-400', border: 'border-red-600' },
  6: { bg: 'bg-gray-800/40', text: 'text-gray-400', border: 'border-gray-600' },
};

// ============================================================================
// NATORatingPanel Component
// ============================================================================

interface NATORatingPanelProps {
  rating: NATORating;
  documentId: string;
  onOverride?: (newRating: Partial<NATORating>, reason: string) => void;
}

export function NATORatingPanel({ rating: rawRating, documentId, onOverride }: NATORatingPanelProps) {
  const rating = rawRating ?? { sourceReliability: 'F' as SourceReliability, informationCredibility: 6 as InformationCredibility, assessedBy: 'system', assessedAt: new Date().toISOString() };
  const [showOverride, setShowOverride] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const [overrideReliability, setOverrideReliability] = useState<SourceReliability>(rating.sourceReliability);
  const [overrideCredibility, setOverrideCredibility] = useState<InformationCredibility>(rating.informationCredibility);
  const [overrideReason, setOverrideReason] = useState('');

  // Avoid unused variable warning for documentId
  void documentId;

  const relColors = RELIABILITY_COLORS[rating.sourceReliability] ?? RELIABILITY_COLORS['F'];
  const credColors = CREDIBILITY_COLORS[rating.informationCredibility] ?? CREDIBILITY_COLORS[6];

  const handleOverrideSubmit = () => {
    if (!onOverride || !overrideReason.trim()) return;
    onOverride(
      {
        sourceReliability: overrideReliability,
        informationCredibility: overrideCredibility,
      },
      overrideReason.trim()
    );
    setShowOverride(false);
    setOverrideReason('');
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-950 px-4 py-2 border-b border-gray-700 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
          NATO Rating Assessment
        </h3>
        <span className="text-xs text-gray-500">
          Assessed by {rating.assessedBy}
        </span>
      </div>

      {/* Two-panel rating display */}
      <div className="p-4 grid grid-cols-2 gap-4">
        {/* Source Reliability (A-F) */}
        <div className={`${relColors.bg} border ${relColors.border} rounded-lg p-4 text-center`}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
            Source Reliability
          </p>
          <p className={`text-4xl font-bold ${relColors.text} mb-1`}>
            {rating.sourceReliability}
          </p>
          <p className={`text-sm ${relColors.text}`}>
            {rating.sourceReliability} - {RELIABILITY_LABELS[rating.sourceReliability]}
          </p>
        </div>

        {/* Information Credibility (1-6) */}
        <div className={`${credColors.bg} border ${credColors.border} rounded-lg p-4 text-center`}>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
            Information Credibility
          </p>
          <p className={`text-4xl font-bold ${credColors.text} mb-1`}>
            {rating.informationCredibility}
          </p>
          <p className={`text-sm ${credColors.text}`}>
            {rating.informationCredibility} - {CREDIBILITY_LABELS[rating.informationCredibility]}
          </p>
        </div>
      </div>

      {/* Combined assessment text */}
      <div className="px-4 pb-3">
        <p className="text-xs text-gray-400 text-center">
          Source: {rating.sourceReliability} - {RELIABILITY_LABELS[rating.sourceReliability]} | Info: {rating.informationCredibility} - {CREDIBILITY_LABELS[rating.informationCredibility]}
        </p>
      </div>

      {/* Override display (if already overridden) */}
      {rating.overriddenBy && rating.originalRating && (
        <div className="mx-4 mb-3 bg-amber-900/20 border border-amber-700/50 rounded px-3 py-2">
          <p className="text-xs text-amber-400">
            Overridden by {rating.overriddenBy}
            {rating.overrideAt && (
              <> on {new Date(rating.overrideAt).toLocaleDateString()}</>
            )}
          </p>
          <p className="text-xs text-amber-300/80 mt-1">{rating.overrideReason}</p>
          <p className="text-[10px] text-gray-500 mt-1">
            Original: {rating.originalRating?.sourceReliability}{rating.originalRating?.informationCredibility}
          </p>
        </div>
      )}

      {/* Reasoning section (expandable) */}
      <div className="border-t border-gray-800">
        <button
          onClick={() => setShowReasoning(!showReasoning)}
          className="w-full px-4 py-2 text-left text-xs text-gray-400 hover:text-gray-300 flex items-center justify-between transition-colors"
        >
          <span>Assessment Reasoning</span>
          <span className="text-gray-600">{showReasoning ? '\u25B2' : '\u25BC'}</span>
        </button>
        {showReasoning && (
          <div className="px-4 pb-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              {rating.reasoning}
            </p>
          </div>
        )}
      </div>

      {/* Override section */}
      {onOverride && !rating.overriddenBy && (
        <div className="border-t border-gray-800">
          {!showOverride ? (
            <button
              onClick={() => setShowOverride(true)}
              className="w-full px-4 py-2 text-xs text-gray-500 hover:text-amber-400 transition-colors text-center"
            >
              Override Assessment
            </button>
          ) : (
            <div className="p-4 space-y-3">
              <div className="bg-amber-900/20 border border-amber-700/50 rounded px-3 py-2">
                <p className="text-xs text-amber-400">
                  Overriding assessment. Original rating will be preserved.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Reliability</label>
                  <select
                    value={overrideReliability}
                    onChange={(e) => setOverrideReliability(e.target.value as SourceReliability)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
                  >
                    {(['A', 'B', 'C', 'D', 'E', 'F'] as SourceReliability[]).map((v) => (
                      <option key={v} value={v}>
                        {v} - {RELIABILITY_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-gray-400 mb-1">Credibility</label>
                  <select
                    value={overrideCredibility}
                    onChange={(e) => setOverrideCredibility(Number(e.target.value) as InformationCredibility)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-200"
                  >
                    {([1, 2, 3, 4, 5, 6] as InformationCredibility[]).map((v) => (
                      <option key={v} value={v}>
                        {v} - {CREDIBILITY_LABELS[v]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-gray-400 mb-1">Reason for override</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you are overriding the assessment..."
                  className="w-full bg-gray-800 border border-gray-600 rounded px-2 py-1.5 text-xs text-gray-200 resize-none"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowOverride(false);
                    setOverrideReason('');
                  }}
                  className="px-3 py-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverrideSubmit}
                  disabled={!overrideReason.trim()}
                  className="px-3 py-1 text-xs bg-amber-700 hover:bg-amber-600 text-amber-100 rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Override Rating
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
