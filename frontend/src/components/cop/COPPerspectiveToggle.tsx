/**
 * COPPerspectiveToggle
 *
 * Phase 21 Plan 08: Three-way segmented control for switching between
 * Friendly, Adversary, and Combined viewing perspectives on the COP.
 * Filters which symbols are visible by affiliation.
 */

import type { Perspective } from '../../types/cop.js';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPPerspectiveToggleProps {
  currentPerspective: Perspective;
  onPerspectiveChange: (perspective: Perspective) => void;
}

// ─── Perspective Config ─────────────────────────────────────────────────────

const PERSPECTIVES: Array<{ value: Perspective; label: string; color: string; activeColor: string }> = [
  { value: 'friendly', label: 'Friendly', color: '#3b82f6', activeColor: '#2563eb' },
  { value: 'adversary', label: 'Adversary', color: '#ef4444', activeColor: '#dc2626' },
  { value: 'combined', label: 'Combined', color: '#6b7280', activeColor: '#4b5563' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function COPPerspectiveToggle({
  currentPerspective,
  onPerspectiveChange,
}: COPPerspectiveToggleProps) {
  return (
    <div
      className="flex rounded-lg overflow-hidden border border-gray-600"
      role="radiogroup"
      aria-label="COP perspective"
      style={{ backdropFilter: 'blur(8px)' }}
    >
      {PERSPECTIVES.map(({ value, label, color, activeColor }) => {
        const isActive = currentPerspective === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={isActive}
            onClick={() => onPerspectiveChange(value)}
            className="px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap"
            style={{
              backgroundColor: isActive ? activeColor : 'rgba(31, 41, 55, 0.9)',
              color: isActive ? '#ffffff' : color,
              borderRight: value !== 'combined' ? '1px solid #4b5563' : undefined,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
