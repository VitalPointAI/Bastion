/**
 * LensSelector — dropdown UI for selecting and managing brain visualization lenses.
 *
 * Replaces the cluster mode toggle buttons in BrainToolbar.
 *
 * This is a CONTROLLED component — it receives all lens state via props from
 * useBrainLens (via BrainController). It manages only its own open/closed state.
 *
 * Layout:
 *   - A compact dropdown button showing the active lens name with a lens icon
 *   - A dropdown panel with:
 *       Built-in section: 4 role lenses (Overview, J2, J3, J5)
 *       Custom section: user-owned lenses with clone/delete actions
 *       Footer: "Save current as lens" and "Clone active" actions
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import type { BrainLens } from './types.js';
import { BUILTIN_LENS_IDS } from './types.js';
import './LensSelector.css';

// ─── Role badge labels ────────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, string> = {
  [BUILTIN_LENS_IDS.OVERVIEW]: 'ALL',
  [BUILTIN_LENS_IDS.J2_INTEL]: 'J2',
  [BUILTIN_LENS_IDS.J3_OPS]: 'J3',
  [BUILTIN_LENS_IDS.J5_PLANS]: 'J5',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface LensSelectorProps {
  /** The currently active lens */
  activeLens: BrainLens;
  /** All available lenses (built-in + custom) */
  allLenses: BrainLens[];
  /** Called when the user selects a lens */
  onLensChange: (lensId: string) => void;
  /** Called to open a save-as-lens dialog (optional) */
  onSaveLens?: () => void;
  /** Called to delete a custom lens (optional) */
  onDeleteLens?: (id: string) => void;
  /** Called to clone a lens (optional) */
  onCloneLens?: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LensSelector({
  activeLens,
  allLenses,
  onLensChange,
  onSaveLens,
  onDeleteLens,
  onCloneLens,
}: LensSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const builtInLenses = allLenses.filter((l) => l.isBuiltIn);
  const customLenses = allLenses.filter((l) => !l.isBuiltIn);

  // ── Close on outside click ─────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  // ── Keyboard handling ──────────────────────────────────────────────────────

  const handleTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // ── Lens selection ─────────────────────────────────────────────────────────

  const handleSelect = (lensId: string) => {
    onLensChange(lensId);
    setIsOpen(false);
  };

  // ── Delete confirmation ────────────────────────────────────────────────────

  const handleDelete = (e: React.MouseEvent, lensId: string) => {
    e.stopPropagation(); // Don't trigger lens selection
    onDeleteLens?.(lensId);
  };

  const handleClone = (e: React.MouseEvent, lensId: string) => {
    e.stopPropagation();
    onCloneLens?.(lensId);
    setIsOpen(false);
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="lens-selector" ref={containerRef}>
      {/* Trigger button */}
      <button
        type="button"
        className={`lens-selector-trigger${isOpen ? ' open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        title={`Active lens: ${activeLens.name}`}
      >
        {/* Lens icon (unicode magnifying glass with sparkles) */}
        <span className="lens-selector-icon">&#x1F50D;</span>
        <span className="lens-selector-label">{activeLens.name}</span>
        {ROLE_BADGE[activeLens.id] && (
          <span className={`lens-role-badge lens-role-badge--${ROLE_BADGE[activeLens.id]?.toLowerCase()}`}>
            {ROLE_BADGE[activeLens.id]}
          </span>
        )}
        <span className="lens-selector-caret" aria-hidden="true">
          {isOpen ? '\u25B2' : '\u25BC'}
        </span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="lens-selector-panel" role="listbox" aria-label="Select visualization lens">

          {/* Built-in lenses section */}
          <div className="lens-section">
            <div className="lens-section-header">Built-in Lenses</div>
            {builtInLenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                role="option"
                aria-selected={lens.id === activeLens.id}
                className={`lens-item${lens.id === activeLens.id ? ' active' : ''}`}
                onClick={() => handleSelect(lens.id)}
              >
                <span className="lens-item-name">{lens.name}</span>
                {ROLE_BADGE[lens.id] && (
                  <span className={`lens-role-badge lens-role-badge--${ROLE_BADGE[lens.id]?.toLowerCase()}`}>
                    {ROLE_BADGE[lens.id]}
                  </span>
                )}
                {lens.id === activeLens.id && (
                  <span className="lens-item-check" aria-hidden="true">&#x2713;</span>
                )}
              </button>
            ))}
          </div>

          {/* Custom lenses section (only shown if any exist) */}
          {customLenses.length > 0 && (
            <div className="lens-section">
              <div className="lens-section-header">My Lenses</div>
              {customLenses.map((lens) => (
                <div
                  key={lens.id}
                  className={`lens-item lens-item--custom${lens.id === activeLens.id ? ' active' : ''}`}
                >
                  <button
                    type="button"
                    role="option"
                    aria-selected={lens.id === activeLens.id}
                    className="lens-item-select-btn"
                    onClick={() => handleSelect(lens.id)}
                  >
                    {/* User icon */}
                    <span className="lens-item-user-icon" aria-hidden="true">&#x1F464;</span>
                    <span className="lens-item-name">{lens.name}</span>
                    {lens.id === activeLens.id && (
                      <span className="lens-item-check" aria-hidden="true">&#x2713;</span>
                    )}
                  </button>
                  {/* Clone and delete actions */}
                  <div className="lens-item-actions">
                    {onCloneLens && (
                      <button
                        type="button"
                        className="lens-action-btn"
                        onClick={(e) => handleClone(e, lens.id)}
                        title="Clone lens"
                        aria-label={`Clone ${lens.name}`}
                      >
                        &#x2398;
                      </button>
                    )}
                    {onDeleteLens && (
                      <button
                        type="button"
                        className="lens-action-btn lens-action-btn--delete"
                        onClick={(e) => handleDelete(e, lens.id)}
                        title="Delete lens"
                        aria-label={`Delete ${lens.name}`}
                      >
                        &#x2715;
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer: save / clone active */}
          <div className="lens-panel-footer">
            {onSaveLens && (
              <button
                type="button"
                className="lens-footer-btn"
                onClick={() => { onSaveLens(); setIsOpen(false); }}
              >
                <span aria-hidden="true">&#x1F4BE;</span> Save current as lens
              </button>
            )}
            {onCloneLens && (
              <button
                type="button"
                className="lens-footer-btn"
                onClick={(e) => handleClone(e, activeLens.id)}
              >
                <span aria-hidden="true">&#x2398;</span> Clone active lens
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
