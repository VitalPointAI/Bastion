/**
 * DesignInterviewGate — Section review gate with confirm/revise actions
 *
 * Phase 55 Plan 04: Displays section summary from Ironclaw with options
 * to confirm and continue to next section, or revise with feedback.
 */

import React, { useState } from 'react';

const SECTION_LABELS: Record<string, string> = {
  'problem-framing': 'Problem Framing',
  'cog-analysis': 'CoG Analysis',
  'loes': 'Lines of Effort',
  'operational-approach': 'Operational Approach',
};

interface Props {
  section: string;
  summary: string;
  onConfirm: () => void;
  onRevise: (feedback: string) => void;
  isLoading: boolean;
}

export function DesignInterviewGate({ section, summary, onConfirm, onRevise, isLoading }: Props) {
  const [showRevise, setShowRevise] = useState(false);
  const [feedback, setFeedback] = useState('');

  const sectionLabel = SECTION_LABELS[section] ?? section;

  const handleRevise = () => {
    if (feedback.trim()) {
      onRevise(feedback.trim());
      setFeedback('');
      setShowRevise(false);
    }
  };

  return (
    <div className="bg-gray-800 border border-blue-500/30 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-blue-300">
        {sectionLabel} Review
      </h3>

      <div className="text-sm text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
        {summary}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-gray-700">
        <button
          onClick={onConfirm}
          disabled={isLoading}
          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded transition-colors"
        >
          {isLoading ? 'Processing...' : 'Confirm & Continue'}
        </button>

        {!showRevise ? (
          <button
            onClick={() => setShowRevise(true)}
            disabled={isLoading}
            className="px-3 py-1.5 text-xs font-medium bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-gray-300 rounded transition-colors"
          >
            Revise
          </button>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <input
              type="text"
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRevise()}
              placeholder="What needs revision..."
              className="flex-1 px-2 py-1.5 text-xs bg-gray-900 border border-gray-600 rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-blue-500"
              autoFocus
            />
            <button
              onClick={handleRevise}
              disabled={isLoading || !feedback.trim()}
              className="px-2 py-1.5 text-xs bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded transition-colors"
            >
              Send
            </button>
            <button
              onClick={() => { setShowRevise(false); setFeedback(''); }}
              className="px-2 py-1.5 text-xs text-gray-400 hover:text-gray-200"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
