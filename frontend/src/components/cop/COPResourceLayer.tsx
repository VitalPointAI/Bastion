/**
 * COPResourceLayer
 *
 * Phase 27 Plan 05: Renders resources as MIL-STD-2525D symbols on the COP
 * Leaflet map. Supports clustering at low zoom levels and real-time position
 * updates via WebSocket.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Marker, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import ms from 'milsymbol';

import type {
  RegisteredResource,
  TelemetryFrame,
} from '../../lib/resource-registry-service.js';
import { resourceRegistryService } from '../../lib/resource-registry-service.js';

// ─── Props ───────────────────────────────────────────────────────────────────

interface COPResourceLayerProps {
  missionId: string;
  visible: boolean;
  onResourceSelect: (resource: RegisteredResource) => void;
}

// ─── Status border colors ────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  FMC: '#22c55e',
  PMC: '#eab308',
  NMC: '#ef4444',
};

// ─── Category fallback initials and colors ───────────────────────────────────

const CATEGORY_CONFIG: Record<string, { initial: string; color: string }> = {
  vehicles: { initial: 'V', color: '#3b82f6' },
  weapons: { initial: 'W', color: '#ef4444' },
  communications: { initial: 'C', color: '#8b5cf6' },
  sensors: { initial: 'S', color: '#06b6d4' },
  medical: { initial: 'M', color: '#22c55e' },
  other: { initial: 'O', color: '#6b7280' },
};

// ─── Icon helpers ────────────────────────────────────────────────────────────

/** Create a Leaflet icon from a MIL-STD-2525D SIDC code */
function createSIDCIcon(sidc: string, status: string): L.DivIcon {
  const symbol = new ms.Symbol(sidc, { size: 30 });
  const svg = symbol.asSVG();
  const borderColor = STATUS_COLORS[status] || '#6b7280';

  return L.divIcon({
    className: 'resource-milsymbol-marker',
    html: `<div style="border: 2px solid ${borderColor}; border-radius: 4px; display: inline-block; line-height: 0;">${svg}</div>`,
    iconSize: [symbol.getSize().width + 4, symbol.getSize().height + 4],
    iconAnchor: [(symbol.getSize().width + 4) / 2, (symbol.getSize().height + 4) / 2],
  });
}

/** Create a fallback circle icon with category initial */
function createFallbackIcon(category: string, status: string): L.DivIcon {
  const cfg = CATEGORY_CONFIG[category] || CATEGORY_CONFIG['other'];
  const borderColor = STATUS_COLORS[status] || '#6b7280';

  return L.divIcon({
    className: 'resource-fallback-marker',
    html: `<div style="
      width: 28px; height: 28px;
      border-radius: 50%;
      background: ${cfg.color};
      border: 3px solid ${borderColor};
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 700; font-size: 12px;
      font-family: 'Fira Code', monospace;
      box-shadow: 0 2px 4px rgba(0,0,0,0.4);
    ">${cfg.initial}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

/** Create a cluster count badge icon */
function createClusterIcon(count: number): L.DivIcon {
  const size = count > 99 ? 44 : count > 9 ? 38 : 32;

  return L.divIcon({
    className: 'resource-cluster-marker',
    html: `<div style="
      width: ${size}px; height: ${size}px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.85);
      border: 2px solid rgba(147, 197, 253, 0.9);
      display: flex; align-items: center; justify-content: center;
      color: white; font-weight: 700; font-size: ${count > 99 ? 11 : 13}px;
      font-family: 'Fira Code', monospace;
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ─── Grid-based clustering helper ────────────────────────────────────────────

interface Cluster {
  lat: number;
  lng: number;
  resources: RegisteredResource[];
}

function clusterResources(resources: RegisteredResource[], gridSize: number): Cluster[] {
  const grid = new Map<string, RegisteredResource[]>();

  for (const r of resources) {
    if (r.lat == null || r.lng == null) continue;
    const gx = Math.floor(r.lng / gridSize);
    const gy = Math.floor(r.lat / gridSize);
    const key = `${gx}:${gy}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(r);
  }

  const clusters: Cluster[] = [];
  for (const members of grid.values()) {
    const lat = members.reduce((sum, r) => sum + (r.lat ?? 0), 0) / members.length;
    const lng = members.reduce((sum, r) => sum + (r.lng ?? 0), 0) / members.length;
    clusters.push({ lat, lng, resources: members });
  }

  return clusters;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function COPResourceLayer({
  missionId,
  visible,
  onResourceSelect,
}: COPResourceLayerProps) {
  const [resources, setResources] = useState<RegisteredResource[]>([]);
  const [zoom, setZoom] = useState<number>(5);
  const positionsRef = useRef<Record<string, TelemetryFrame>>({});
  const map = useMap();

  // Track zoom level
  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
    },
  });

  useEffect(() => {
    setZoom(map.getZoom());
  }, [map]);

  // Fetch resources from registry
  useEffect(() => {
    if (!missionId) return;

    let cancelled = false;

    async function loadResources() {
      try {
        const results = await resourceRegistryService.searchRegistry({
          missionId,
        });
        if (!cancelled) {
          setResources(results);
        }
      } catch (err) {
        console.error('[COPResourceLayer] Failed to fetch resources:', err);
      }
    }

    loadResources();
    return () => { cancelled = true; };
  }, [missionId]);

  // Subscribe to WebSocket position updates
  const handlePositionUpdate = useCallback(
    (positions: Record<string, TelemetryFrame>) => {
      positionsRef.current = { ...positionsRef.current, ...positions };

      // Update resource positions in state
      setResources((prev) =>
        prev.map((r) => {
          const update = positions[r.id];
          if (update) {
            return { ...r, lat: update.lat, lng: update.lng };
          }
          return r;
        })
      );
    },
    []
  );

  useEffect(() => {
    const unsubscribe = resourceRegistryService.subscribeToPositions(handlePositionUpdate);
    return unsubscribe;
  }, [handlePositionUpdate]);

  // Remove robots from COP when they disconnect
  const handleResourceRemoval = useCallback(
    (resourceId: string) => {
      setResources((prev) =>
        prev.filter((r) => r.id !== resourceId && r.did !== resourceId)
      );
    },
    []
  );

  useEffect(() => {
    const unsubscribe = resourceRegistryService.subscribeToRemovals(handleResourceRemoval);
    return unsubscribe;
  }, [handleResourceRemoval]);

  // Don't render if not visible
  if (!visible) return null;

  // Filter resources with valid positions
  const locatedResources = resources.filter(
    (r) => r.lat != null && r.lng != null
  );

  // Zoom-based rendering: individual markers at zoom >= 12, clusters below
  if (zoom >= 12) {
    // Show individual markers
    return (
      <>
        {locatedResources.map((resource) => {
          const icon = resource.sidc
            ? createSIDCIcon(resource.sidc, resource.status)
            : createFallbackIcon(resource.category, resource.status);

          return (
            <Marker
              key={`resource-${resource.id}`}
              position={[resource.lat!, resource.lng!]}
              icon={icon}
              eventHandlers={{
                click: () => onResourceSelect(resource),
              }}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                <div style={{ fontSize: '11px', fontFamily: "'Fira Code', monospace" }}>
                  <strong>{resource.name}</strong>
                  <br />
                  <span style={{ color: STATUS_COLORS[resource.status] || '#888' }}>
                    {resource.status}
                  </span>
                  {resource.capabilities?.length ? (
                    <>
                      <br />
                      <span style={{ color: '#888' }}>
                        {resource.capabilities.slice(0, 3).join(', ')}
                      </span>
                    </>
                  ) : null}
                </div>
              </Tooltip>
            </Marker>
          );
        })}
      </>
    );
  }

  // Clustered view — group by proximity grid
  // Grid size roughly corresponds to ~2 degrees at low zoom, shrinking as zoom increases
  const gridSize = Math.max(0.5, 10 / Math.pow(2, zoom - 3));
  const clusters = clusterResources(locatedResources, gridSize);

  return (
    <>
      {clusters.map((cluster, idx) => {
        if (cluster.resources.length === 1) {
          // Single resource in cluster — show individual marker
          const resource = cluster.resources[0];
          const icon = resource.sidc
            ? createSIDCIcon(resource.sidc, resource.status)
            : createFallbackIcon(resource.category, resource.status);

          return (
            <Marker
              key={`resource-single-${resource.id}`}
              position={[resource.lat!, resource.lng!]}
              icon={icon}
              eventHandlers={{
                click: () => onResourceSelect(resource),
              }}
            >
              <Tooltip direction="top" offset={[0, -16]}>
                <span style={{ fontSize: '11px' }}>{resource.name}</span>
              </Tooltip>
            </Marker>
          );
        }

        // Multiple resources — show cluster badge
        return (
          <Marker
            key={`resource-cluster-${idx}`}
            position={[cluster.lat, cluster.lng]}
            icon={createClusterIcon(cluster.resources.length)}
            eventHandlers={{
              click: () => {
                // Zoom in to show individual markers
                map.setView([cluster.lat, cluster.lng], Math.min(zoom + 3, 12));
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -16]}>
              <span style={{ fontSize: '11px' }}>
                {cluster.resources.length} resources
              </span>
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
