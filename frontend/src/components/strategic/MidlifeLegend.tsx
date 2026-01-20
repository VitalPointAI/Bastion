/**
 * MidlifeLegend Component
 *
 * Displays a prominent legend explaining the MIDLIFE categorization framework
 * with color-coded categories and their descriptions.
 */

import { MIDLIFE_METADATA, MidlifeCategory } from '../../lib/types/strategic.js';
import './MidlifeLegend.css';

interface MidlifeLegendProps {
  /** Compact mode shows only badges, no descriptions */
  compact?: boolean;
  /** Optional title override */
  title?: string;
}

/**
 * Category icons for MIDLIFE framework
 */
const MIDLIFE_ICONS: Record<MidlifeCategory, JSX.Element> = {
  MILITARY: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  INFORMATION: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
      <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
      <circle cx="12" cy="12" r="2" />
      <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
      <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
    </svg>
  ),
  DIPLOMATIC: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" />
    </svg>
  ),
  LEGAL: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18" />
      <path d="M12 3v18" />
      <path d="M3.5 8.5l8.5 3.5 8.5-3.5" />
      <path d="M3.5 8.5L12 5l8.5 3.5" />
    </svg>
  ),
  INTELLIGENCE: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2m0 18v2M1 12h2m18 0h2" />
      <path d="M18.36 5.64l-1.41 1.41m-9.9 9.9l-1.41 1.41M5.64 5.64l1.41 1.41m9.9 9.9l1.41 1.41" />
    </svg>
  ),
  FINANCIAL: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  ),
  ECONOMIC: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M18 9l-5 5-4-4-5 5" />
    </svg>
  ),
};

const MIDLIFE_ORDER: MidlifeCategory[] = [
  'MILITARY',
  'INFORMATION',
  'DIPLOMATIC',
  'LEGAL',
  'INTELLIGENCE',
  'FINANCIAL',
  'ECONOMIC',
];

export function MidlifeLegend({ compact = false, title }: MidlifeLegendProps) {
  return (
    <div className={`midlife-legend ${compact ? 'compact' : ''}`}>
      <div className="legend-header">
        <h3>{title || 'MIDLIFE Framework'}</h3>
        <span className="legend-subtitle">
          Strategic Power Categorization
        </span>
      </div>
      <div className="legend-grid">
        {MIDLIFE_ORDER.map((category) => {
          const meta = MIDLIFE_METADATA[category];
          return (
            <div
              key={category}
              className="legend-item"
              style={{
                '--category-color': meta.color,
              } as React.CSSProperties}
            >
              <div className="legend-badge">
                <span className="legend-icon">{MIDLIFE_ICONS[category]}</span>
                <span className="legend-label">{meta.label}</span>
              </div>
              {!compact && (
                <p className="legend-description">{meta.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
