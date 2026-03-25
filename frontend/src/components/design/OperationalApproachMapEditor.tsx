/**
 * OperationalApproachMapEditor
 *
 * Phase 56 Plan 02: Interactive map editor for visualizing and manipulating
 * military symbols and control measures in the Operational Approach section.
 *
 * Features:
 * - OpenStreetMap tiles via DARK_TILE_URL (Stadia/Carto dark theme)
 * - MIL-STD-2525D milsymbol markers (draggable) using DivIcon
 * - Inline symbol edit panel on click (designation, SIDC, affiliation, delete)
 * - leaflet-draw control for polyline/polygon control measures
 * - Memoized milsymbol icon creation for performance with 50+ symbols
 * - All interactions call map-overlay-service and propagate state upward
 *
 * Phase 56 Plan 04: Yjs collaborative real-time sync
 * - Y.Map('mapSymbols') and Y.Map('controlMeasures') on existing design-interview doc
 * - Mutations write to Yjs first (real-time), then API (persistence)
 * - Y.Map.observe callbacks update local React state
 * - Ironclaw WebSocket events bridged into Yjs via design.map_updated events
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Polygon,
  Tooltip,
  FeatureGroup,
  useMapEvents,
} from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import ms from 'milsymbol';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

import type { MapOverlay, MapSymbol, ControlMeasure } from '../../lib/design-service.ts';
import * as mapOverlayService from '../../lib/map-overlay-service.ts';
import { latLngToMGRS } from '../../lib/mgrs-coordinator.ts';
import { DARK_TILE_URL, DARK_TILE_ATTRIBUTION, DARK_TILE_SUBDOMAINS } from '../../lib/map-tiles.ts';
import { useDesignInterview } from '../../hooks/useDesignInterview.ts';
import { MapSymbolPicker } from './MapSymbolPicker.tsx';
import './OperationalApproachMapEditor.css';

// Fix default Leaflet marker icons (webpack/vite asset resolution)
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface OperationalApproachMapEditorProps {
  problemSetId: string;
  mapOverlay: MapOverlay;
  onOverlayChange: (overlay: MapOverlay) => void;
  aoBounds?: { southwest: { lat: number; lng: number }; northeast: { lat: number; lng: number } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Affiliation-based colors for control measures */
const affiliationColor = {
  friendly: '#0066cc',
  enemy: '#cc0000',
  neutral: '#00cc00',
} as const;

/** Create a milsymbol DivIcon; memoized externally via a Map cache */
function buildMilIcon(sidc: string, designation: string, size = 30): L.DivIcon {
  const symbol = new ms.Symbol(sidc, {
    size,
    uniqueDesignation: designation,
  });
  return L.divIcon({
    className: 'milsymbol-marker',
    html: symbol.asSVG(),
    iconSize: [symbol.getSize().width, symbol.getSize().height],
    iconAnchor: [symbol.getSize().width / 2, symbol.getSize().height / 2],
  });
}

// ─── Map background click handler ─────────────────────────────────────────────

function MapClickClear({ onClear }: { onClear: () => void }) {
  useMapEvents({ click: onClear });
  return null;
}

// ─── Placement mode click handler ──────────────────────────────────────────────

interface PlacementClickHandlerProps {
  pendingSymbol: { sidc: string; designation: string; affiliation: MapSymbol['affiliation'] } | null;
  onPlace: (lat: number, lng: number) => void;
}

function PlacementClickHandler({ pendingSymbol, onPlace }: PlacementClickHandlerProps) {
  const map = useMapEvents({
    click: (e) => {
      if (pendingSymbol) {
        onPlace(e.latlng.lat, e.latlng.lng);
      }
    },
  });

  // Apply crosshair cursor when in placement mode
  useEffect(() => {
    const container = map.getContainer();
    if (pendingSymbol) {
      container.style.cursor = 'crosshair';
    } else {
      container.style.cursor = '';
    }
    return () => {
      container.style.cursor = '';
    };
  }, [map, pendingSymbol]);

  return null;
}

// ─── Draw form modal (inline) ──────────────────────────────────────────────────

interface DrawFormProps {
  onSubmit: (label: string, type: ControlMeasure['type'], affiliation: ControlMeasure['affiliation']) => void;
  onCancel: () => void;
}

function DrawForm({ onSubmit, onCancel }: DrawFormProps) {
  const [label, setLabel] = useState('');
  const [type, setType] = useState<ControlMeasure['type']>('phase_line');
  const [affiliation, setAffiliation] = useState<ControlMeasure['affiliation']>('friendly');

  return (
    <div className="map-editor-draw-form">
      <div className="symbol-edit-row">
        <label className="map-editor-label">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Phase Line Blue"
          className="map-editor-input"
          autoFocus
        />
      </div>
      <div className="symbol-edit-row">
        <label className="map-editor-label">Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as ControlMeasure['type'])}
          className="map-editor-select"
        >
          <option value="phase_line">Phase Line</option>
          <option value="boundary">Boundary</option>
          <option value="axis_of_advance">Axis of Advance</option>
          <option value="objective">Objective</option>
          <option value="engagement_area">Engagement Area</option>
          <option value="nai">NAI</option>
          <option value="fscm">FSCM</option>
          <option value="flot">FLOT</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div className="symbol-edit-row">
        <label className="map-editor-label">Affiliation</label>
        <select
          value={affiliation}
          onChange={(e) => setAffiliation(e.target.value as ControlMeasure['affiliation'])}
          className="map-editor-select"
        >
          <option value="friendly">Friendly</option>
          <option value="enemy">Enemy</option>
          <option value="neutral">Neutral</option>
        </select>
      </div>
      <div className="symbol-edit-row">
        <button
          onClick={() => onSubmit(label, type, affiliation)}
          disabled={!label.trim()}
          className="map-editor-btn map-editor-btn--primary"
        >
          Add Control Measure
        </button>
        <button onClick={onCancel} className="map-editor-btn">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Symbol Edit Panel ────────────────────────────────────────────────────────

interface SymbolEditPanelProps {
  symbol: MapSymbol;
  problemSetId: string;
  onSaved: (overlay: MapOverlay) => void;
  onDeleted: (overlay: MapOverlay) => void;
  onClose: () => void;
  /** Yjs map for optimistic real-time updates before API response */
  symbolsMap?: import('yjs').Map<MapSymbol> | null;
}

function SymbolEditPanel({ symbol, problemSetId, onSaved, onDeleted, onClose, symbolsMap }: SymbolEditPanelProps) {
  const [designation, setDesignation] = useState(symbol.designation);
  const [sidc, setSidc] = useState(symbol.sidc);
  const [affiliation, setAffiliation] = useState(symbol.affiliation);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Live milsymbol preview
  const previewSvg = useMemo(() => {
    try {
      const sym = new ms.Symbol(sidc, { size: 28, uniqueDesignation: designation });
      return sym.asSVG();
    } catch {
      return '';
    }
  }, [sidc, designation]);

  const handleSave = async () => {
    setSaving(true);
    // Optimistic Yjs write — propagates to all clients immediately
    if (symbolsMap) {
      symbolsMap.set(symbol.id, { ...symbol, designation, sidc, affiliation });
    }
    try {
      const updated = await mapOverlayService.updateSymbol(problemSetId, symbol.id, {
        designation,
        sidc,
        affiliation,
      });
      onSaved(updated);
      onClose();
    } catch (err) {
      console.error('[OperationalApproachMapEditor] Failed to update symbol:', err);
      // Revert optimistic Yjs write on failure
      if (symbolsMap) {
        symbolsMap.set(symbol.id, symbol);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    // Optimistic Yjs delete — propagates to all clients immediately
    if (symbolsMap) {
      symbolsMap.delete(symbol.id);
    }
    try {
      const updated = await mapOverlayService.removeSymbol(problemSetId, symbol.id);
      onDeleted(updated);
      onClose();
    } catch (err) {
      console.error('[OperationalApproachMapEditor] Failed to delete symbol:', err);
      // Revert optimistic Yjs delete on failure
      if (symbolsMap) {
        symbolsMap.set(symbol.id, symbol);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="map-editor-panel">
      <div className="symbol-edit-row">
        {previewSvg && (
          <div
            className="map-editor-symbol-preview"
            dangerouslySetInnerHTML={{ __html: previewSvg }}
          />
        )}
        <div style={{ flex: 1 }}>
          <div className="symbol-edit-row">
            <label className="map-editor-label">Designation</label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Unit designation..."
              className="map-editor-input"
            />
          </div>
          <div className="symbol-edit-row">
            <label className="map-editor-label">SIDC</label>
            <input
              type="text"
              value={sidc}
              onChange={(e) => setSidc(e.target.value)}
              placeholder="MIL-STD-2525 SIDC..."
              className="map-editor-input"
            />
          </div>
          <div className="symbol-edit-row">
            <label className="map-editor-label">Affiliation</label>
            <select
              value={affiliation}
              onChange={(e) => setAffiliation(e.target.value as MapSymbol['affiliation'])}
              className="map-editor-select"
            >
              <option value="friendly">Friendly</option>
              <option value="enemy">Enemy</option>
              <option value="neutral">Neutral</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>
      <div className="symbol-edit-row" style={{ marginTop: '8px' }}>
        <button
          onClick={handleSave}
          disabled={saving || deleting}
          className="map-editor-btn map-editor-btn--primary"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={handleDelete}
          disabled={saving || deleting}
          className="map-editor-btn map-editor-btn--danger"
        >
          {deleting ? 'Deleting...' : 'Delete Symbol'}
        </button>
        <button onClick={onClose} className="map-editor-btn" disabled={saving || deleting}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function OperationalApproachMapEditor({
  problemSetId,
  mapOverlay,
  onOverlayChange,
  aoBounds,
}: OperationalApproachMapEditorProps) {
  const [selectedSymbol, setSelectedSymbol] = useState<MapSymbol | null>(null);

  // Symbol picker (Plan 05)
  const [showPicker, setShowPicker] = useState(false);
  const [pendingSymbol, setPendingSymbol] = useState<{
    sidc: string;
    designation: string;
    affiliation: MapSymbol['affiliation'];
  } | null>(null);

  // Pending draw layer — waiting for user to fill in label/type/affiliation form
  const pendingDrawRef = useRef<{
    layer: L.Layer;
    geoType: 'line' | 'polygon';
    coords: Array<{ lat: number; lng: number }>;
  } | null>(null);
  const [showDrawForm, setShowDrawForm] = useState(false);
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);

  // Icon cache: keyed by `${sidc}-${designation}` to avoid re-creating icons each render
  const iconCache = useRef<Map<string, L.DivIcon>>(new Map());

  const getOrCreateIcon = useCallback((sidc: string, designation: string): L.DivIcon => {
    const key = `${sidc}--${designation}`;
    if (!iconCache.current.has(key)) {
      iconCache.current.set(key, buildMilIcon(sidc, designation));
    }
    return iconCache.current.get(key)!;
  }, []);

  // ESC key cancels placement mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingSymbol(null);
        setShowPicker(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // ─── Yjs collaborative sync (Plan 56-04) ────────────────────────────────

  // Reuse the existing design-interview Yjs document — no new WebSocket connection.
  // useDesignInterview with the same problemSetId reuses the same Yjs doc.
  const { getMap } = useDesignInterview(problemSetId);

  // Y.Map instances on the shared design-interview document
  const symbolsMap = useMemo(
    () => getMap<MapSymbol>('mapSymbols'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getMap identity changes when doc connects
    [getMap]
  );
  const measuresMap = useMemo(
    () => getMap<ControlMeasure>('controlMeasures'),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- getMap identity changes when doc connects
    [getMap]
  );

  // Local React state backed by Yjs — these drive the rendered map
  const [symbols, setSymbols] = useState<MapSymbol[]>(mapOverlay.symbols);
  const [controlMeasures, setControlMeasures] = useState<ControlMeasure[]>(mapOverlay.controlMeasures);

  // Seed Y.Maps from the initial mapOverlay prop if empty (first client populates from DB)
  useEffect(() => {
    if (!symbolsMap || symbolsMap.size > 0) return;
    for (const sym of mapOverlay.symbols) {
      symbolsMap.set(sym.id, sym);
    }
  }, [symbolsMap, mapOverlay.symbols]);

  useEffect(() => {
    if (!measuresMap || measuresMap.size > 0) return;
    for (const cm of mapOverlay.controlMeasures) {
      measuresMap.set(cm.id, cm);
    }
  }, [measuresMap, mapOverlay.controlMeasures]);

  // Observe symbolsMap — update React state whenever Yjs state changes (local or remote)
  useEffect(() => {
    if (!symbolsMap) return;
    const handler = () => setSymbols(Array.from(symbolsMap.values()));
    symbolsMap.observe(handler);
    handler(); // Initial sync on mount
    return () => symbolsMap.unobserve(handler);
  }, [symbolsMap]);

  // Observe measuresMap — update React state whenever Yjs state changes (local or remote)
  useEffect(() => {
    if (!measuresMap) return;
    const handler = () => setControlMeasures(Array.from(measuresMap.values()));
    measuresMap.observe(handler);
    handler(); // Initial sync on mount
    return () => measuresMap.unobserve(handler);
  }, [measuresMap]);

  // Bridge Ironclaw WebSocket events (design.map_updated) into Yjs so all clients
  // see Ironclaw-originated map changes in real-time. The backend publishes these
  // events via the message bus; a window CustomEvent 'design:map_updated' is
  // dispatched by the WebSocket subscription layer for this problem set.
  useEffect(() => {
    if (!symbolsMap || !measuresMap) return;

    const handleMapUpdated = (e: Event) => {
      const detail = (e as CustomEvent<{
        action: string;
        symbol?: MapSymbol;
        symbolId?: string;
        lat?: number;
        lng?: number;
        updates?: Partial<MapSymbol>;
        measure?: ControlMeasure;
        measureId?: string;
      }>).detail;

      switch (detail.action) {
        case 'add':
          if (detail.symbol) symbolsMap.set(detail.symbol.id, detail.symbol);
          break;
        case 'move': {
          const existing = detail.symbolId ? symbolsMap.get(detail.symbolId) : undefined;
          if (existing && detail.lat !== undefined && detail.lng !== undefined) {
            symbolsMap.set(detail.symbolId!, { ...existing, lat: detail.lat, lng: detail.lng });
          }
          break;
        }
        case 'remove':
          if (detail.symbolId) symbolsMap.delete(detail.symbolId);
          break;
        case 'update': {
          const existing = detail.symbolId ? symbolsMap.get(detail.symbolId) : undefined;
          if (existing && detail.updates) {
            symbolsMap.set(detail.symbolId!, { ...existing, ...detail.updates });
          }
          break;
        }
        case 'add_control_measure':
          if (detail.measure) measuresMap.set(detail.measure.id, detail.measure);
          break;
        case 'remove_control_measure':
          if (detail.measureId) measuresMap.delete(detail.measureId);
          break;
        default:
          break;
      }
    };

    window.addEventListener('design:map_updated', handleMapUpdated);
    return () => window.removeEventListener('design:map_updated', handleMapUpdated);
  }, [symbolsMap, measuresMap]);

  // Keep parent overlay in sync with Yjs-backed state (only when arrays change identity)
  const prevSymbolsRef = useRef<MapSymbol[]>(symbols);
  const prevMeasuresRef = useRef<ControlMeasure[]>(controlMeasures);
  useEffect(() => {
    if (symbols !== prevSymbolsRef.current || controlMeasures !== prevMeasuresRef.current) {
      prevSymbolsRef.current = symbols;
      prevMeasuresRef.current = controlMeasures;
      onOverlayChange({ symbols, controlMeasures });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only sync on Yjs array identity change
  }, [symbols, controlMeasures]);

  // Place symbol on map at clicked position
  const handlePlaceSymbol = useCallback(
    async (lat: number, lng: number) => {
      if (!pendingSymbol) return;
      try {
        const updated = await mapOverlayService.addSymbol(problemSetId, {
          sidc: pendingSymbol.sidc,
          designation: pendingSymbol.designation,
          affiliation: pendingSymbol.affiliation,
          lat,
          lng,
          createdBy: 'user',
        });
        // Sync authoritative IDs from the API response into Yjs so remote clients see the symbol
        if (symbolsMap) {
          for (const sym of updated.symbols) {
            symbolsMap.set(sym.id, sym);
          }
        }
        onOverlayChange(updated);
      } catch (err) {
        console.error('[OperationalApproachMapEditor] Failed to add symbol:', err);
      } finally {
        setPendingSymbol(null);
      }
    },
    [pendingSymbol, problemSetId, onOverlayChange, symbolsMap]
  );

  // Derive map initial state from aoBounds
  const mapCenter: L.LatLngExpression = aoBounds
    ? [
        (aoBounds.southwest.lat + aoBounds.northeast.lat) / 2,
        (aoBounds.southwest.lng + aoBounds.northeast.lng) / 2,
      ]
    : [20, 0];
  const mapZoom = aoBounds ? 8 : 2;

  // ─── Symbol drag handler ─────────────────────────────────────────────────

  const handleSymbolDragEnd = useCallback(
    async (symbol: MapSymbol, e: L.DragEndEvent) => {
      const { lat, lng } = (e.target as L.Marker).getLatLng();
      // Write to Yjs first — propagates to all clients immediately
      if (symbolsMap) {
        symbolsMap.set(symbol.id, { ...symbol, lat, lng });
      }
      // Invalidate icon cache entry so the marker re-renders at new position cleanly
      iconCache.current.delete(`${symbol.sidc}--${symbol.designation}`);
      try {
        // Persist to API (authoritative storage) in the background
        const updated = await mapOverlayService.moveSymbol(problemSetId, symbol.id, lat, lng);
        onOverlayChange(updated);
      } catch (err) {
        console.error('[OperationalApproachMapEditor] Failed to move symbol:', err);
        // Revert Yjs optimistic update on failure
        if (symbolsMap) {
          symbolsMap.set(symbol.id, symbol);
        }
      }
    },
    [problemSetId, onOverlayChange, symbolsMap]
  );

  // ─── Draw handlers ───────────────────────────────────────────────────────

  const handleCreated = useCallback((e: L.DrawEvents.Created) => {
    const layer = e.layer;
    let geoType: 'line' | 'polygon' = 'line';
    let coords: Array<{ lat: number; lng: number }> = [];

    if (layer instanceof L.Polyline && !(layer instanceof L.Polygon)) {
      geoType = 'line';
      coords = (layer.getLatLngs() as L.LatLng[]).map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    } else if (layer instanceof L.Polygon) {
      geoType = 'polygon';
      const lls = (layer.getLatLngs() as L.LatLng[][])[0] ?? (layer.getLatLngs() as L.LatLng[]);
      coords = (lls as L.LatLng[]).map((ll) => ({ lat: ll.lat, lng: ll.lng }));
    }

    pendingDrawRef.current = { layer, geoType, coords };
    setShowDrawForm(true);
  }, []);

  const handleDrawFormSubmit = useCallback(
    async (label: string, type: ControlMeasure['type'], affiliation: ControlMeasure['affiliation']) => {
      const pending = pendingDrawRef.current;
      if (!pending) return;

      try {
        const updated = await mapOverlayService.addControlMeasure(problemSetId, {
          type,
          label,
          affiliation,
          geometry: { type: pending.geoType, coordinates: pending.coords },
          createdBy: 'user',
        });
        // Sync authoritative IDs from the API response into Yjs so remote clients see it
        if (measuresMap) {
          for (const cm of updated.controlMeasures) {
            measuresMap.set(cm.id, cm);
          }
        }
        onOverlayChange(updated);
      } catch (err) {
        console.error('[OperationalApproachMapEditor] Failed to add control measure:', err);
      } finally {
        // Remove the temporary draw layer from the FeatureGroup (it's now tracked via state)
        if (featureGroupRef.current && pending.layer) {
          featureGroupRef.current.removeLayer(pending.layer);
        }
        pendingDrawRef.current = null;
        setShowDrawForm(false);
      }
    },
    [problemSetId, onOverlayChange, measuresMap]
  );

  const handleDrawFormCancel = useCallback(() => {
    const pending = pendingDrawRef.current;
    if (featureGroupRef.current && pending?.layer) {
      featureGroupRef.current.removeLayer(pending.layer);
    }
    pendingDrawRef.current = null;
    setShowDrawForm(false);
  }, []);

  const handleDeleted = useCallback(
    async (e: L.DrawEvents.Deleted) => {
      // leaflet-draw deletes are against drawn layers in the FeatureGroup;
      // our control measures are rendered as separate react-leaflet elements,
      // so deletions from the toolbar won't match by layer. Instead, we rely
      // on the inline delete button per control measure. This handler is a no-op
      // but kept to satisfy the EditControl signature.
      void e;
    },
    []
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="map-editor-container-wrapper">

      {/* ─── Toolbar above map ─── */}
      <div className="map-editor-toolbar">
        <button
          className={`map-editor-btn ${showPicker ? 'map-editor-btn--primary' : ''}`}
          onClick={() => {
            setShowPicker((v) => !v);
            setPendingSymbol(null);
          }}
        >
          + Add Symbol
        </button>
      </div>

      <div className="map-editor-container" style={{ position: 'relative' }}>
        <MapContainer
          key={problemSetId}
          center={mapCenter}
          zoom={mapZoom}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution={DARK_TILE_ATTRIBUTION}
            url={DARK_TILE_URL}
            subdomains={DARK_TILE_SUBDOMAINS ?? 'abcd'}
            maxZoom={18}
          />

          {/* Clear symbol selection on map background click (only when not in placement mode) */}
          {!pendingSymbol && <MapClickClear onClear={() => setSelectedSymbol(null)} />}

          {/* Placement mode click handler */}
          <PlacementClickHandler pendingSymbol={pendingSymbol} onPlace={handlePlaceSymbol} />

          {/* ─── Military symbol markers (rendered from Yjs-backed state) ─── */}
          {symbols.map((symbol) => (
            <Marker
              key={symbol.id}
              position={[symbol.lat, symbol.lng]}
              icon={getOrCreateIcon(symbol.sidc, symbol.designation)}
              draggable={true}
              eventHandlers={{
                dragend: (e) => handleSymbolDragEnd(symbol, e as L.DragEndEvent),
                click: () => {
                  setSelectedSymbol(symbol);
                },
              }}
            >
              <Tooltip>
                <span>
                  {symbol.designation}
                  {' — '}
                  {(() => {
                    try {
                      return latLngToMGRS(symbol.lat, symbol.lng, 4);
                    } catch {
                      return `${symbol.lat.toFixed(4)}, ${symbol.lng.toFixed(4)}`;
                    }
                  })()}
                </span>
              </Tooltip>
            </Marker>
          ))}

          {/* ─── Control measures (rendered from Yjs-backed state) ─── */}
          {controlMeasures.map((measure) => {
            const coords: L.LatLngExpression[] = measure.geometry.coordinates.map(
              (c) => [c.lat, c.lng] as L.LatLngExpression
            );
            const color = affiliationColor[measure.affiliation] ?? '#888888';

            if (measure.geometry.type === 'polygon') {
              return (
                <Polygon key={measure.id} positions={coords} pathOptions={{ color, weight: 2, fillOpacity: 0.15 }}>
                  <Tooltip permanent direction="center">
                    <span>{measure.label}</span>
                  </Tooltip>
                </Polygon>
              );
            }

            return (
              <Polyline key={measure.id} positions={coords} pathOptions={{ color, weight: 2 }}>
                <Tooltip permanent>
                  <span>{measure.label}</span>
                </Tooltip>
              </Polyline>
            );
          })}

          {/* ─── leaflet-draw controls ─── */}
          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              onDeleted={handleDeleted}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: {
                  shapeOptions: { color: '#0066cc', weight: 2 },
                },
                polygon: {
                  allowIntersection: false,
                  showArea: false,
                  shapeOptions: { color: '#0066cc', weight: 2, fillOpacity: 0.1 },
                },
              }}
            />
          </FeatureGroup>
        </MapContainer>

        {/* ─── Placement mode banner ─── */}
        {pendingSymbol && (
          <div className="placement-banner">
            <span className="placement-banner-text">
              Click on the map to place <strong>{pendingSymbol.designation}</strong>
            </span>
            <button
              className="map-editor-btn"
              onClick={() => setPendingSymbol(null)}
            >
              Cancel
            </button>
          </div>
        )}

        {/* ─── Symbol picker panel ─── */}
        {showPicker && (
          <MapSymbolPicker
            onSelectSymbol={(sidc, designation, affiliation) => {
              setPendingSymbol({ sidc, designation, affiliation });
              setShowPicker(false);
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </div>

      {/* ─── Draw form: label/type/affiliation for new control measure ─── */}
      {showDrawForm && (
        <DrawForm
          onSubmit={handleDrawFormSubmit}
          onCancel={handleDrawFormCancel}
        />
      )}

      {/* ─── Inline symbol edit panel ─── */}
      {selectedSymbol && !showDrawForm && (
        <SymbolEditPanel
          key={selectedSymbol.id}
          symbol={selectedSymbol}
          problemSetId={problemSetId}
          symbolsMap={symbolsMap}
          onSaved={(overlay) => {
            onOverlayChange(overlay);
            // Re-find symbol by id from updated overlay to keep panel in sync
            const refreshed = overlay.symbols.find((s) => s.id === selectedSymbol.id);
            setSelectedSymbol(refreshed ?? null);
          }}
          onDeleted={(overlay) => {
            onOverlayChange(overlay);
            setSelectedSymbol(null);
          }}
          onClose={() => setSelectedSymbol(null)}
        />
      )}
    </div>
  );
}
