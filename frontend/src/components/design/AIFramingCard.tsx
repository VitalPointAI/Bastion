/**
 * AIFramingCard
 *
 * Phase 25 Plan 02: Interactive card displaying one AlternativeFraming
 * with confidence badge and Adopt/Merge/Dismiss actions.
 */

import { useState } from 'react';

// Mirrors backend AlternativeFraming interface
export interface AlternativeFraming {
  perspectiveType: string;
  framingStatement: string;
  rootCauses: string[];
  keyStakeholders: Array<{ name: string; interest: string; influence: 'high' | 'medium' | 'low' }>;
  interventionPoints: string[];
  assumptions: string[];
  blindSpots: string[];
  framingConfidence: number;
  confidenceBounds: { lower: number; upper: number };
}

interface AIFramingCardProps {
  framing: AlternativeFraming;
  onAdopt: (framing: AlternativeFraming) => void;
  onMerge: (framing: AlternativeFraming) => void;
  onDismiss: (framing: AlternativeFraming) => void;
}

function formatPerspective(type: string): string {
  return type
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function confidenceLabel(value: number): { text: string; color: string } {
  if (value >= 0.7) return { text: 'High', color: 'text-green-400' };
  if (value >= 0.4) return { text: 'Medium', color: 'text-amber-400' };
  return { text: 'Low', color: 'text-red-400' };
}

function CollapsibleList({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>&#9654;</span>
        {title} ({items.length})
      </button>
      {open && (
        <ul className="mt-1 ml-4 space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-xs text-gray-400 list-disc">
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StakeholderList({
  stakeholders,
}: {
  stakeholders: AlternativeFraming['keyStakeholders'];
}) {
  const [open, setOpen] = useState(false);

  if (stakeholders.length === 0) return null;

  const influenceColor: Record<string, string> = {
    high: 'text-red-400',
    medium: 'text-amber-400',
    low: 'text-gray-500',
  };

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1"
      >
        <span className={`transition-transform ${open ? 'rotate-90' : ''}`}>&#9654;</span>
        Key Stakeholders ({stakeholders.length})
      </button>
      {open && (
        <div className="mt-1 ml-4 space-y-1">
          {stakeholders.map((s, i) => (
            <div key={i} className="text-xs text-gray-400">
              <span className="font-medium text-gray-300">{s.name}</span>
              <span className="mx-1">-</span>
              <span>{s.interest}</span>
              <span className={`ml-1 ${influenceColor[s.influence] ?? 'text-gray-500'}`}>
                [{s.influence}]
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AIFramingCard({ framing, onAdopt, onMerge, onDismiss }: AIFramingCardProps) {
  const confidence = confidenceLabel(framing.framingConfidence);

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
          {formatPerspective(framing.perspectiveType)}
        </span>
        <span className={`text-xs font-medium ${confidence.color}`}>
          {confidence.text} ({Math.round(framing.framingConfidence * 100)}%)
        </span>
      </div>

      {/* Framing Statement */}
      <p className="text-sm text-gray-200 leading-relaxed mb-2">
        {framing.framingStatement}
      </p>

      {/* Collapsible Details */}
      <CollapsibleList title="Root Causes" items={framing.rootCauses} />
      <StakeholderList stakeholders={framing.keyStakeholders} />
      <CollapsibleList title="Intervention Points" items={framing.interventionPoints} />
      <CollapsibleList title="Assumptions" items={framing.assumptions} />
      <CollapsibleList title="Blind Spots" items={framing.blindSpots} />

      {/* Action Buttons */}
      <div className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-700">
        <button
          onClick={() => onAdopt(framing)}
          className="px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          Adopt
        </button>
        <button
          onClick={() => onMerge(framing)}
          className="px-3 py-1 text-xs font-medium rounded bg-gray-600 hover:bg-gray-500 text-gray-200 transition-colors"
        >
          Merge
        </button>
        <button
          onClick={() => onDismiss(framing)}
          className="px-3 py-1 text-xs font-medium rounded text-red-400 hover:text-red-300 transition-colors ml-auto"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
