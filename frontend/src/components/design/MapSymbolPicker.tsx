/**
 * MapSymbolPicker
 *
 * Phase 56 Plan 05: Collapsible symbol picker panel for the OperationalApproachMapEditor.
 * Provides a browsable catalog of ~20 common MIL-STD-2525D symbols organized by category,
 * affiliation filtering, text search, and a free-text SIDC entry with live milsymbol preview.
 *
 * Clicking a catalog entry calls onSelectSymbol → enters placement mode in the map editor.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import ms from 'milsymbol';
import type { MapSymbol } from '../../lib/design-service.ts';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MapSymbolPickerProps {
  onSelectSymbol: (sidc: string, designation: string, affiliation: MapSymbol['affiliation']) => void;
  onClose: () => void;
}

// ─── Symbol Catalog ───────────────────────────────────────────────────────────

interface CatalogEntry {
  sidc: string;
  label: string;
  category: string;
  affiliation: MapSymbol['affiliation'];
}

const COMMON_SYMBOLS: CatalogEntry[] = [
  // Land Units — Friendly
  { sidc: 'SFGPUCI----E', label: 'Infantry',        category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUCA----E', label: 'Armor',            category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUCF----E', label: 'Artillery',        category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUCRVA--E', label: 'Aviation',         category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUCRR---E', label: 'Reconnaissance',  category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUCE----E', label: 'Engineer',         category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUCS----E', label: 'Signal',           category: 'Land - Friendly', affiliation: 'friendly' },
  { sidc: 'SFGPUUS----E', label: 'Logistics',        category: 'Land - Friendly', affiliation: 'friendly' },
  // Land Units — Enemy
  { sidc: 'SHGPUCI----E', label: 'Infantry',        category: 'Land - Enemy', affiliation: 'enemy' },
  { sidc: 'SHGPUCA----E', label: 'Armor',            category: 'Land - Enemy', affiliation: 'enemy' },
  { sidc: 'SHGPUCF----E', label: 'Artillery',        category: 'Land - Enemy', affiliation: 'enemy' },
  { sidc: 'SHGPUCD----E', label: 'Air Defense',      category: 'Land - Enemy', affiliation: 'enemy' },
  // Air — Friendly
  { sidc: 'SFAPMFF----E', label: 'Fixed Wing',       category: 'Air - Friendly', affiliation: 'friendly' },
  { sidc: 'SFAPMHR----E', label: 'Rotary Wing',      category: 'Air - Friendly', affiliation: 'friendly' },
  // Control Measures (tactical graphics use neutral affiliation visually)
  { sidc: 'SFGPGAO----E', label: 'Objective',        category: 'Control Measures', affiliation: 'friendly' },
  { sidc: 'SFGPGAA----E', label: 'Assembly Area',    category: 'Control Measures', affiliation: 'friendly' },
  { sidc: 'SFGPGAP----E', label: 'Checkpoint',       category: 'Control Measures', affiliation: 'friendly' },
  { sidc: 'SFGPGAE----E', label: 'Engagement Area',  category: 'Control Measures', affiliation: 'friendly' },
  { sidc: 'SFGPGAZ----E', label: 'Landing Zone',     category: 'Control Measures', affiliation: 'friendly' },
  { sidc: 'SFGPGAD----E', label: 'Drop Zone',        category: 'Control Measures', affiliation: 'friendly' },
];

// Pre-build a data URL cache keyed by SIDC (computed once, not per render)
const SIDC_DATA_URL_CACHE = new Map<string, string>();

function getSidcDataUrl(sidc: string): string {
  if (!SIDC_DATA_URL_CACHE.has(sidc)) {
    try {
      const sym = new ms.Symbol(sidc, { size: 32 });
      SIDC_DATA_URL_CACHE.set(sidc, sym.toDataURL());
    } catch {
      SIDC_DATA_URL_CACHE.set(sidc, '');
    }
  }
  return SIDC_DATA_URL_CACHE.get(sidc)!;
}

// ─── SIDC → affiliation helper ────────────────────────────────────────────────

function sidcToAffiliation(sidc: string): MapSymbol['affiliation'] {
  const char = sidc[1]?.toUpperCase() ?? 'U';
  if (char === 'F') return 'friendly';
  if (char === 'H') return 'enemy';
  if (char === 'N') return 'neutral';
  return 'unknown';
}

// ─── Component ────────────────────────────────────────────────────────────────

const AFFILIATION_FILTERS = ['All', 'Friendly', 'Enemy', 'Neutral'] as const;
type AffiliationFilter = typeof AFFILIATION_FILTERS[number];

export function MapSymbolPicker({ onSelectSymbol, onClose }: MapSymbolPickerProps) {
  const [affiliationFilter, setAffiliationFilter] = useState<AffiliationFilter>('All');
  const [textFilter, setTextFilter] = useState('');

  // Custom SIDC entry
  const [customSidc, setCustomSidc] = useState('');
  const [customDesignation, setCustomDesignation] = useState('');
  const [customPreviewUrl, setCustomPreviewUrl] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced live preview for custom SIDC
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (customSidc.trim().length >= 10) {
        try {
          const sym = new ms.Symbol(customSidc.trim(), { size: 40 });
          setCustomPreviewUrl(sym.toDataURL());
        } catch {
          setCustomPreviewUrl('');
        }
      } else {
        setCustomPreviewUrl('');
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [customSidc]);

  // Filtered catalog
  const filteredSymbols = useMemo(() => {
    return COMMON_SYMBOLS.filter((entry) => {
      const matchesAffiliation =
        affiliationFilter === 'All' ||
        entry.affiliation === affiliationFilter.toLowerCase();
      const matchesText =
        textFilter === '' ||
        entry.label.toLowerCase().includes(textFilter.toLowerCase()) ||
        entry.category.toLowerCase().includes(textFilter.toLowerCase());
      return matchesAffiliation && matchesText;
    });
  }, [affiliationFilter, textFilter]);

  // Group filtered symbols by category
  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, CatalogEntry[]>();
    for (const entry of filteredSymbols) {
      const list = groups.get(entry.category) ?? [];
      list.push(entry);
      groups.set(entry.category, list);
    }
    return groups;
  }, [filteredSymbols]);

  const handleSelectCatalog = useCallback(
    (entry: CatalogEntry) => {
      onSelectSymbol(entry.sidc, entry.label, entry.affiliation);
    },
    [onSelectSymbol]
  );

  const handleAddCustom = useCallback(() => {
    const sidc = customSidc.trim();
    const designation = customDesignation.trim() || 'Custom';
    if (!sidc) return;
    const affiliation = sidcToAffiliation(sidc);
    onSelectSymbol(sidc, designation, affiliation);
  }, [customSidc, customDesignation, onSelectSymbol]);

  return (
    <div className="symbol-picker">
      {/* Header */}
      <div className="symbol-picker-header">
        <span className="symbol-picker-title">Add Symbol</span>
        <button className="symbol-picker-close map-editor-btn" onClick={onClose} aria-label="Close symbol picker">
          ✕
        </button>
      </div>

      {/* Text filter */}
      <input
        type="text"
        className="map-editor-input symbol-picker-search"
        placeholder="Search symbols..."
        value={textFilter}
        onChange={(e) => setTextFilter(e.target.value)}
      />

      {/* Affiliation filter buttons */}
      <div className="symbol-picker-filters">
        {AFFILIATION_FILTERS.map((f) => (
          <button
            key={f}
            className={`symbol-picker-filter-btn ${affiliationFilter === f ? 'symbol-picker-filter-btn--active' : ''}`}
            onClick={() => setAffiliationFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Catalog */}
      <div className="symbol-picker-catalog">
        {groupedByCategory.size === 0 && (
          <div className="symbol-picker-empty">No symbols match filter.</div>
        )}
        {Array.from(groupedByCategory.entries()).map(([category, entries]) => (
          <div key={category}>
            <div className="symbol-category">{category}</div>
            <div className="symbol-grid">
              {entries.map((entry) => {
                const dataUrl = getSidcDataUrl(entry.sidc);
                return (
                  <button
                    key={entry.sidc}
                    className="symbol-card"
                    onClick={() => handleSelectCatalog(entry)}
                    title={`${entry.label} (${entry.sidc})`}
                  >
                    {dataUrl ? (
                      <img src={dataUrl} alt={entry.label} width={32} height={32} className="symbol-card-img" />
                    ) : (
                      <div className="symbol-card-placeholder" />
                    )}
                    <span className="symbol-card-label">{entry.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Custom SIDC section */}
      <div className="symbol-picker-custom">
        <div className="symbol-category" style={{ marginTop: 0 }}>Custom SIDC</div>
        <div className="symbol-picker-custom-row">
          {customPreviewUrl ? (
            <img src={customPreviewUrl} alt="SIDC preview" width={40} height={40} className="symbol-card-img" />
          ) : (
            <div className="symbol-card-placeholder symbol-card-placeholder--lg" />
          )}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <input
              type="text"
              className="map-editor-input"
              placeholder="SIDC code (e.g. SFGPUCI----E)"
              value={customSidc}
              onChange={(e) => setCustomSidc(e.target.value)}
              maxLength={20}
            />
            <input
              type="text"
              className="map-editor-input"
              placeholder="Designation (optional)"
              value={customDesignation}
              onChange={(e) => setCustomDesignation(e.target.value)}
            />
          </div>
        </div>
        <button
          className="map-editor-btn map-editor-btn--primary symbol-picker-add-btn"
          disabled={!customSidc.trim()}
          onClick={handleAddCustom}
        >
          Place Custom Symbol
        </button>
      </div>
    </div>
  );
}
