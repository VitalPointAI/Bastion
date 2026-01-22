/**
 * MidlifeCategorySelector Component
 *
 * Reusable dropdown for selecting MIDLIFE categories.
 * Color-coded options matching badges, icons for each category,
 * tooltips with descriptions, and indication when changing from AI to HUMAN categorization.
 */

import { useState, useRef, useEffect, type ReactElement } from 'react';
import type { MidlifeCategory, MidlifeCategorizedBy } from '../../lib/types/strategic.js';
import { MIDLIFE_METADATA } from '../../lib/types/strategic.js';
import './MidlifeCategorySelector.css';

interface MidlifeCategorySelectorProps {
  value: MidlifeCategory | undefined;
  onChange: (category: MidlifeCategory) => void;
  currentCategorizedBy?: MidlifeCategorizedBy;
  disabled?: boolean;
}

/**
 * Icons for each MIDLIFE category (simplified SVG paths)
 */
const CATEGORY_ICONS: Record<MidlifeCategory, ReactElement> = {
  MILITARY: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l9 18H3l9-18z" />
    </svg>
  ),
  INFORMATION: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  ),
  DIPLOMATIC: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  LEGAL: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="3" x2="12" y2="15" />
      <path d="M5 12h14" />
      <polyline points="3 12 12 6 21 12" />
      <line x1="5" y1="21" x2="19" y2="21" />
      <line x1="5" y1="12" x2="5" y2="21" />
      <line x1="19" y1="12" x2="19" y2="21" />
    </svg>
  ),
  INTELLIGENCE: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 5v-2" />
      <path d="M12 21v-2" />
      <path d="M5 12H3" />
      <path d="M21 12h-2" />
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
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
};

const CATEGORIES: MidlifeCategory[] = [
  'MILITARY',
  'INFORMATION',
  'DIPLOMATIC',
  'LEGAL',
  'INTELLIGENCE',
  'FINANCIAL',
  'ECONOMIC',
];

export function MidlifeCategorySelector({
  value,
  onChange,
  currentCategorizedBy,
  disabled = false,
}: MidlifeCategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<MidlifeCategory | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedMeta = value ? MIDLIFE_METADATA[value] : null;
  const willChangeToHuman = currentCategorizedBy === 'AI' && isOpen;

  const handleSelect = (category: MidlifeCategory) => {
    onChange(category);
    setIsOpen(false);
  };

  return (
    <div
      className={`midlife-selector ${isOpen ? 'open' : ''} ${disabled ? 'disabled' : ''}`}
      ref={containerRef}
    >
      {/* Selected Value Button */}
      <button
        type="button"
        className="selector-button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        {value ? (
          <>
            <span
              className="selected-icon"
              style={{ color: selectedMeta?.color }}
            >
              {CATEGORY_ICONS[value]}
            </span>
            <span
              className="selected-label"
              style={{ color: selectedMeta?.color }}
            >
              {selectedMeta?.label}
            </span>
          </>
        ) : (
          <span className="placeholder">Select category...</span>
        )}
        <svg className="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>

      {/* Human Override Warning */}
      {willChangeToHuman && (
        <div className="human-override-notice">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Changing category will mark as human-categorized</span>
        </div>
      )}

      {/* Dropdown Options */}
      {isOpen && !disabled && (
        <div className="selector-dropdown">
          {CATEGORIES.map((category) => {
            const meta = MIDLIFE_METADATA[category];
            const isSelected = category === value;
            const isHovered = category === hoveredCategory;

            return (
              <button
                key={category}
                type="button"
                className={`dropdown-option ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelect(category)}
                onMouseEnter={() => setHoveredCategory(category)}
                onMouseLeave={() => setHoveredCategory(null)}
                style={{
                  borderLeftColor: meta.color,
                  backgroundColor: isSelected || isHovered ? `${meta.color}15` : undefined,
                }}
              >
                <span className="option-icon" style={{ color: meta.color }}>
                  {CATEGORY_ICONS[category]}
                </span>
                <div className="option-content">
                  <span className="option-label" style={{ color: isSelected ? meta.color : undefined }}>
                    {meta.label}
                  </span>
                  <span className="option-description">{meta.description}</span>
                </div>
                {isSelected && (
                  <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke={meta.color} strokeWidth="3">
                    <polyline points="20,6 9,17 4,12" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tooltip for hovered category */}
      {hoveredCategory && !isOpen && (
        <div className="category-tooltip">
          {MIDLIFE_METADATA[hoveredCategory].description}
        </div>
      )}
    </div>
  );
}
