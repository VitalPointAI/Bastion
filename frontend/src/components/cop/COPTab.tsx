/**
 * COPTab — Unified COP Problem Set View
 *
 * Phase 21 Plan 12: Merges Overview, Monitor, and COP into a single primary
 * problem set view. The map with AI layers is the main content area. A collapsible
 * sidebar provides selectable views: layer controls, actor graph, actor detail,
 * activity feed, agent activity, version history, layer lifecycle, and review.
 *
 * Previously these capabilities were split across WorkspaceDashboard (Overview),
 * MonitorTab, and the old COPTab. Now consolidated here.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { COPLayer, Perspective, COPPhaseSpec } from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import { useProblemSet } from '../../context/ProblemSetContext.js';
import { COPMapView } from './COPMapView.js';
import { COPLayerControls } from './COPLayerControls.js';
// COPPerspectiveToggle moved into COPLayerControls sidebar
import { COPPhaseSlider } from './COPPhaseSlider.js';
import { COPVersionBrowser } from './COPVersionBrowser.js';
import { COPLayerLifecycle } from './COPLayerLifecycle.js';
import { COPReviewPanel } from './COPReviewPanel.js';
import { COPResourceDetail } from './COPResourceDetail.js';
import { MissionSequencePanel } from './MissionSequencePanel.js';
import { COPGateNotifications } from './COPGateNotifications.js';
import { GraphExplorer, type GraphData } from '../graph/GraphExplorer.js';
import { NodeDetailPanel } from '../graph/NodeDetailPanel.js';
import { ActivityFeed } from '../problem-set/ActivityFeed.js';
import type { RegisteredResource } from '../../lib/resource-registry-service.js';
import { inheritanceApiService, type AggregatedMissionStatus, type MissionStatusSnapshot } from '../../services/inheritance-service.js';
import { MissionStatusCard } from '../inheritance/MissionStatusCard.js';
import { MissionStatusDrilldown } from '../inheritance/MissionStatusDrilldown.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type SidebarView =
  | 'layers'
  | 'actor-graph'
  | 'actor-detail'
  | 'activity'
  | 'versions'
  | 'lifecycle'
  | 'review';

interface COPTabProps {
  problemSetId: string;
}

// ─── Sidebar nav items ──────────────────────────────────────────────────────

interface SidebarNavItem {
  id: SidebarView;
  label: string;
  icon: string; // SVG path d attribute
}

const SIDEBAR_NAV: SidebarNavItem[] = [
  {
    id: 'layers',
    label: 'Layers',
    // layers/stack icon
    icon: 'M4 7l8-4 8 4-8 4-8-4zm0 5l8 4 8-4m-16 5l8 4 8-4',
  },
  {
    id: 'actor-graph',
    label: 'Actor Graph',
    // network/graph icon
    icon: 'M12 4.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM4.5 14.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM19.5 14.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM12 9.5v2m-5 5l3.5-3m3 0l3.5 3',
  },
  {
    id: 'actor-detail',
    label: 'Actor Detail',
    // person/user icon
    icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
  },
  {
    id: 'activity',
    label: 'Activity Feed',
    // activity/pulse icon
    icon: 'M22 12h-4l-3 9L9 3l-3 9H2',
  },
  {
    id: 'versions',
    label: 'Version History',
    // clock/history icon
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  {
    id: 'lifecycle',
    label: 'Layer Lifecycle',
    // workflow/arrows icon
    icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  {
    id: 'review',
    label: 'Review',
    // clipboard/check icon
    icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

// ─── Persistence helpers ─────────────────────────────────────────────────

function loadCopPrefs(psId: string): {
  visibility: Record<string, boolean>;
  opacity: Record<string, number>;
  perspective: Perspective;
} {
  try {
    const raw = localStorage.getItem(`cop-prefs-${psId}`);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { visibility: {}, opacity: {}, perspective: 'combined' };
}

function saveCopPrefs(
  psId: string,
  visibility: Record<string, boolean>,
  opacity: Record<string, number>,
  perspective: Perspective,
) {
  try {
    localStorage.setItem(`cop-prefs-${psId}`, JSON.stringify({ visibility, opacity, perspective }));
  } catch { /* ignore */ }
}

export function COPTab({ problemSetId }: COPTabProps) {
  // Load persisted user preferences
  const savedPrefs = loadCopPrefs(problemSetId);

  // Existing COP state
  const [layers, setLayers] = useState<COPLayer[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(savedPrefs.visibility);
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>(savedPrefs.opacity);
  const [currentPerspective, setCurrentPerspective] = useState<Perspective>(savedPrefs.perspective);

  // Sidebar state
  const [sidebarView, setSidebarView] = useState<SidebarView>('layers');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Actor graph state (from MonitorTab)
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  // Temporal phase state
  const [currentPhase, setCurrentPhase] = useState<number>(0);

  // Bottom controls drawer collapsed state
  const [controlsCollapsed, setControlsCollapsed] = useState(false);

  // Selected layer for lifecycle/version/review views
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Resource layer state
  const [selectedResource, setSelectedResource] = useState<RegisteredResource | null>(null);
  const [resourceLayerVisible, setResourceLayerVisible] = useState(true);

  // Robot layer state (Phase 06)
  const [robotLayerVisible, setRobotLayerVisible] = useState(true);

  // Parent COP layer inheritance toggle
  const [showParentLayers, setShowParentLayers] = useState(false);
  const [inheritedLayers, setInheritedLayers] = useState<COPLayer[]>([]);

  // Refresh key — increment to force COPMapView to re-fetch layers
  const [layerRefreshKey, setLayerRefreshKey] = useState(0);
  const handleLayersChanged = useCallback(() => setLayerRefreshKey(k => k + 1), []);

  // Map flyTo control for gate notifications (zoom to action area)
  const mapFlyToRef = useRef<((lat: number, lng: number, zoom: number) => void) | null>(null);
  const handleMapReady = useCallback((flyTo: (lat: number, lng: number, zoom: number) => void) => {
    mapFlyToRef.current = flyTo;
  }, []);
  const handleZoomToAction = useCallback((lat: number, lng: number, zoom: number) => {
    mapFlyToRef.current?.(lat, lng, zoom);
  }, []);

  // Auto-trigger state
  const [generating, setGenerating] = useState(false);
  const autoTriggeredRef = useRef(false);

  // Role from workspace context (for ActivityFeed)
  const { userRoleInActive } = useProblemSet();

  // Subordinate mission status (Phase 38)
  const [missionStatuses, setMissionStatuses] = useState<AggregatedMissionStatus[]>([]);
  const [drillDownPsId, setDrillDownPsId] = useState<string | null>(null);
  const [drillDownSnapshot, setDrillDownSnapshot] = useState<MissionStatusSnapshot | null>(null);
  const [missionSectionOpen, setMissionSectionOpen] = useState(true);

  // Extract temporal phases from loaded layers
  const temporalPhases = useMemo((): COPPhaseSpec[] => {
    for (const layer of layers) {
      const spec = layer.spec;
      if (spec?.temporalPhases?.length) {
        return spec.temporalPhases;
      }
    }
    return [];
  }, [layers]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  // Fetch graph data on mount (same pattern as MonitorTab)
  useEffect(() => {
    fetch(`/api/graph?workspaceId=${problemSetId}`)
      .then((res) => (res.ok ? (res.json() as Promise<GraphData>) : null))
      .then((data) => {
        if (data) setGraphData(data);
      })
      .catch(() => {
        // Graph data unavailable
      });
  }, [problemSetId]);

  // ─── Layer callbacks (existing) ───────────────────────────────────────────

  const handleLayersLoaded = useCallback((loadedLayers: COPLayer[]) => {
    // Separate own layers from inherited parent layers
    const ownLayers = loadedLayers.filter(l => !l.isInherited);
    const parentLayers = loadedLayers.filter(l => l.isInherited);

    setLayers(ownLayers);
    setInheritedLayers(parentLayers);

    // Initialize visibility (all visible by default)
    setLayerVisibility((prev) => {
      const next = { ...prev };
      for (const layer of loadedLayers) {
        if (next[layer.id] === undefined) {
          next[layer.id] = true;
        }
      }
      return next;
    });

    // Initialize opacity (100% by default)
    setLayerOpacity((prev) => {
      const next = { ...prev };
      for (const layer of loadedLayers) {
        if (next[layer.id] === undefined) {
          next[layer.id] = 100;
        }
      }
      return next;
    });

    // Auto-select first own layer if none selected
    if (ownLayers.length > 0) {
      setSelectedLayerId((prev) => prev ?? ownLayers[0].id);
    }
  }, []);

  // ─── Auto-trigger COP generation on first visit ─────────────────────────

  useEffect(() => {
    if (autoTriggeredRef.current) return;
    autoTriggeredRef.current = true;

    async function checkAndTrigger() {
      try {
        const status = await copService.getStatus(problemSetId);
        if (status.status === 'idle' && !status.hasLayers) {
          setGenerating(true);
          try {
            // Generation is synchronous -- backend runs sub-agents and returns
            await copService.triggerGeneration(problemSetId, 'default');
            // Fetch all layers (including the one just created)
            const newLayers = await copService.queryLayers(problemSetId, { includeParent: showParentLayers });
            handleLayersLoaded(newLayers);
          } finally {
            setGenerating(false);
          }
        } else if (status.hasLayers) {
          // Already have layers -- just fetch them
          const existingLayers = await copService.queryLayers(problemSetId, { includeParent: showParentLayers });
          handleLayersLoaded(existingLayers);
        }
      } catch (err) {
        console.warn('[COP] Auto-trigger check failed:', err);
        setGenerating(false);
      }
    }

    checkAndTrigger();
  }, [problemSetId, handleLayersLoaded, showParentLayers]);

  // ─── Re-fetch layers when parent layers toggle changes ─────────────────

  const parentToggleInitRef = useRef(true);
  useEffect(() => {
    // Skip the initial mount (handled by auto-trigger above)
    if (parentToggleInitRef.current) {
      parentToggleInitRef.current = false;
      return;
    }

    async function refetchWithParent() {
      try {
        const allLayers = await copService.queryLayers(problemSetId, { includeParent: showParentLayers });
        handleLayersLoaded(allLayers);
      } catch (err) {
        console.warn('[COP] Parent layer re-fetch failed:', err);
      }
    }

    refetchWithParent();
  }, [showParentLayers, problemSetId, handleLayersLoaded]);

  // ─── Subordinate mission status (Phase 38) ──────────────────────────────

  useEffect(() => {
    let wsCleanup: (() => void) | null = null;

    async function loadMissionStatus() {
      try {
        const statuses = await inheritanceApiService.getMissionStatus(problemSetId);
        if (statuses.length > 0) {
          setMissionStatuses(statuses);

          // Subscribe to real-time updates
          wsCleanup = inheritanceApiService.connectStatusStream(
            problemSetId,
            (updatedStatus) => {
              setMissionStatuses((prev) => {
                const idx = prev.findIndex((s) => s.childPsId === updatedStatus.childPsId);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = updatedStatus;
                  return next;
                }
                return [...prev, updatedStatus];
              });
            },
          );
        }
      } catch {
        // No child missions or API not available — silently skip
      }
    }

    loadMissionStatus();

    return () => {
      if (wsCleanup) wsCleanup();
    };
  }, [problemSetId]);

  // Drill-down handler
  const handleMissionDrillDown = useCallback(async (childPsId: string) => {
    if (drillDownPsId === childPsId) {
      // Toggle off
      setDrillDownPsId(null);
      setDrillDownSnapshot(null);
      return;
    }

    try {
      const snapshot = await inheritanceApiService.getMissionDrilldown(problemSetId, childPsId);
      setDrillDownPsId(childPsId);
      setDrillDownSnapshot(snapshot);
    } catch (err) {
      console.warn('[COP] Drill-down fetch failed:', err);
    }
  }, [problemSetId, drillDownPsId]);

  // ─── Manual generation handler ──────────────────────────────────────────

  async function handleManualGenerate() {
    setGenerating(true);
    try {
      // Generation is synchronous -- backend runs sub-agents and returns layer
      await copService.triggerGeneration(problemSetId, 'default');
      // Refresh all layers after generation completes
      const newLayers = await copService.queryLayers(problemSetId, { includeParent: showParentLayers });
      handleLayersLoaded(newLayers);
    } catch (err) {
      console.error('[COP] Manual generation failed:', err);
    } finally {
      setGenerating(false);
    }
  }

  function handleVisibilityChange(layerId: string, visible: boolean) {
    setLayerVisibility((prev) => {
      const next = { ...prev, [layerId]: visible };
      saveCopPrefs(problemSetId, next, layerOpacity, currentPerspective);
      return next;
    });
  }

  function handleOpacityChange(layerId: string, opacity: number) {
    setLayerOpacity((prev) => {
      const next = { ...prev, [layerId]: opacity };
      saveCopPrefs(problemSetId, layerVisibility, next, currentPerspective);
      return next;
    });
  }

  function handlePerspectiveChange(perspective: Perspective) {
    setCurrentPerspective(perspective);
    saveCopPrefs(problemSetId, layerVisibility, layerOpacity, perspective);
  }

  // ─── Actor graph handlers ─────────────────────────────────────────────────

  function handleNodeClick(node: { id: string }) {
    setSelectedActorId(node.id);
    setSidebarView('actor-detail');
  }

  // ─── Resolved selected layer ─────────────────────────────────────────────

  const selectedLayer = useMemo(
    () => layers.find((l) => l.id === selectedLayerId) ?? null,
    [layers, selectedLayerId],
  );

  // ─── Sidebar content rendering ────────────────────────────────────────────

  function renderSidebarContent() {
    switch (sidebarView) {
      case 'layers':
        return (
          <COPLayerControls
            layers={layers}
            inheritedLayers={inheritedLayers}
            layerVisibility={layerVisibility}
            layerOpacity={layerOpacity}
            onVisibilityChange={handleVisibilityChange}
            onOpacityChange={handleOpacityChange}
            onLayerDeleted={(layerId) => {
              setLayers((prev) => prev.filter((l) => l.id !== layerId));
              setLayerVisibility((prev) => { const next = { ...prev }; delete next[layerId]; return next; });
              setLayerOpacity((prev) => { const next = { ...prev }; delete next[layerId]; return next; });
            }}
            currentPerspective={currentPerspective}
            onPerspectiveChange={handlePerspectiveChange}
            resourceLayerVisible={resourceLayerVisible}
            onResourceLayerToggle={() => setResourceLayerVisible((v) => !v)}
            robotLayerVisible={robotLayerVisible}
            onRobotLayerToggle={() => setRobotLayerVisible((v) => !v)}
            showParentLayers={showParentLayers}
            onShowParentLayersToggle={() => setShowParentLayers((v) => !v)}
          />
        );

      case 'actor-graph':
        if (graphData === null) {
          return (
            <div className="flex items-center justify-center h-48 text-sm text-gray-500">
              Loading graph data...
            </div>
          );
        }
        return (
          <GraphExplorer
            data={graphData}
            problemSetId={problemSetId}
            onNodeClick={handleNodeClick}
            selectedNodeId={selectedActorId ?? undefined}
            height={500}
          />
        );

      case 'actor-detail':
        return (
          <NodeDetailPanel
            actorId={selectedActorId}
            onClose={() => setSidebarView('actor-graph')}
            onNavigateToActor={(id) => setSelectedActorId(id)}
          />
        );

      case 'activity':
        return (
          <ActivityFeed
            problemSetId={problemSetId}
            userRole={userRoleInActive}
          />
        );

      case 'versions':
        if (!selectedLayer) {
          return (
            <div className="p-4 text-sm text-gray-500">
              Select a layer from the Layers panel to browse versions.
            </div>
          );
        }
        return (
          <COPVersionBrowser
            layerId={selectedLayer.id}
            currentVersion={selectedLayer.currentVersion ?? 1}
            onVersionSelect={() => {
              // Version selection handled by map view refresh
            }}
          />
        );

      case 'lifecycle':
        if (!selectedLayer) {
          return (
            <div className="p-4 text-sm text-gray-500">
              Select a layer from the Layers panel to manage lifecycle.
            </div>
          );
        }
        return (
          <COPLayerLifecycle
            layer={selectedLayer}
            onTransition={(updatedLayer) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === updatedLayer.id ? updatedLayer : l)),
              );
            }}
            canPromote={userRoleInActive === 'commander' || userRoleInActive === 'xo'}
          />
        );

      case 'review':
        if (!selectedLayer) {
          return (
            <div className="p-4 text-sm text-gray-500">
              Select a layer from the Layers panel to review.
            </div>
          );
        }
        return (
          <COPReviewPanel
            layer={selectedLayer}
            onFeedbackSubmitted={(updatedLayer) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === updatedLayer.id ? updatedLayer : l)),
              );
            }}
            onTransition={(updatedLayer) => {
              setLayers((prev) =>
                prev.map((l) => (l.id === updatedLayer.id ? updatedLayer : l)),
              );
            }}
          />
        );

      default:
        return null;
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-1 min-h-0 relative" style={{ height: '100%' }}>
      {/* Main map area */}
      <div className="flex-1 min-w-0 relative flex flex-col">
        {/* Perspective, resource, and robot toggles moved to sidebar COPLayerControls */}

        {/* Sidebar toggle (when collapsed) — top right */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 right-3 z-1000 px-3 py-1.5 text-xs font-medium bg-gray-800/90 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Show sidebar"
          >
            Sidebar
          </button>
        )}

        {/* Map */}
        <div className="flex-1 min-h-0 relative">
          {/* Mission Sequence Panel (Scripted / Autonomous) */}
          <MissionSequencePanel problemSetId={problemSetId} onZoomToAO={handleZoomToAction} onLayersChanged={handleLayersChanged} />

          {/* Gate notifications — lethal modal + toast notifications */}
          <COPGateNotifications onZoomToAction={handleZoomToAction} problemSetId={problemSetId} />

          <COPMapView
            problemSetId={problemSetId}
            layerVisibility={layerVisibility}
            layerOpacity={layerOpacity}
            currentPerspective={currentPerspective}
            currentPhase={currentPhase || undefined}
            refreshKey={layerRefreshKey}
            onLayersLoaded={handleLayersLoaded}
            showParentLayers={showParentLayers}
            resourceLayerVisible={resourceLayerVisible}
            onResourceSelect={(res) => {
              setSelectedResource(res);
            }}
            robotLayerVisible={robotLayerVisible}
            onRobotClick={async (id) => {
              // Build a RegisteredResource from robot data so COPResourceDetail renders
              // with the full tabbed panel (telemetry, vision, D-pad, grouping)
              try {
                const res = await fetch('/api/robot/robots');
                if (res.ok) {
                  const robots = await res.json();
                  const match = robots.find((r: { robot_id: string }) => r.robot_id === id);
                  if (match) {
                    const resource: RegisteredResource = {
                      id: match.robot_id,
                      missionId: '',
                      name: match.robot_id,
                      category: 'sensors',
                      status: match.state === 'connected' ? 'FMC' : 'NMC',
                      did: match.did,
                      isAutonomous: true,
                      capabilities: match.capabilities || [],
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    };
                    setSelectedResource(resource);
                    return;
                  }
                }
              } catch { /* ignore — robot API unavailable */ }
            }}
            selectedRobotId={null}
            onMapReady={handleMapReady}
          />

          {/* Generating spinner overlay */}
          {generating && (
            <div className="absolute inset-0 flex items-center justify-center z-500 pointer-events-none">
              <div className="pointer-events-auto bg-gray-800/95 border border-blue-500/50 rounded-xl p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent mx-auto mb-3" />
                <p className="text-sm text-blue-300">Generating COP layers...</p>
              </div>
            </div>
          )}
        </div>

        {/* Collapsible bottom controls drawer — phase slider + playbook */}
        {temporalPhases.length > 0 && (
          <div
            className="shrink-0 border-t border-gray-700 bg-gray-800/95"
            style={{
              maxHeight: controlsCollapsed ? '0px' : '300px',
              overflow: 'hidden',
              transition: 'max-height 0.25s ease',
            }}
          >
            <div className="px-4 py-2">
              <COPPhaseSlider
                phases={temporalPhases}
                currentPhase={currentPhase}
                onPhaseChange={setCurrentPhase}
              />
            </div>
          </div>
        )}

        {/* Drawer toggle tab — always visible when phases exist */}
        {temporalPhases.length > 0 && (
          <button
            onClick={() => setControlsCollapsed((v) => !v)}
            className="shrink-0 flex items-center justify-center w-full border-t border-gray-700 bg-gray-800/95 hover:bg-gray-700/95 transition-colors cursor-pointer"
            style={{ height: '20px', padding: 0, border: 'none', borderTop: '1px solid #374151' }}
            title={controlsCollapsed ? 'Show timeline controls' : 'Hide timeline controls'}
            aria-label={controlsCollapsed ? 'Show timeline controls' : 'Hide timeline controls'}
          >
            <span style={{ fontSize: '10px', color: '#6b7280', userSelect: 'none' }}>
              {controlsCollapsed ? '▲ Timeline' : '▼'}
            </span>
          </button>
        )}
      </div>

      {/* Subordinate Missions (Phase 38) */}
      {missionStatuses.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: temporalPhases.length > 0 ? '60px' : '8px',
          left: '8px',
          right: sidebarOpen ? '392px' : '8px',
          zIndex: 900,
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          border: '1px solid #374151',
          borderRadius: '8px',
          maxHeight: missionSectionOpen ? '320px' : '36px',
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
        }}>
          {/* Collapse header */}
          <button
            onClick={() => setMissionSectionOpen((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '8px 12px',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: missionSectionOpen ? '1px solid #374151' : 'none',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase' as const,
              letterSpacing: '0.5px',
            }}
          >
            <span>Subordinate Missions ({missionStatuses.length})</span>
            <span style={{ fontSize: '10px' }}>{missionSectionOpen ? '▼' : '▲'}</span>
          </button>

          {missionSectionOpen && (
            <div style={{ padding: '8px 12px', overflowY: 'auto', maxHeight: '270px' }}>
              {/* Card grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: '8px',
                marginBottom: drillDownSnapshot ? '8px' : '0',
              }}>
                {missionStatuses.map((status) => (
                  <MissionStatusCard
                    key={status.childPsId}
                    status={status}
                    onDrillDown={handleMissionDrillDown}
                  />
                ))}
              </div>

              {/* Inline drill-down */}
              {drillDownPsId && drillDownSnapshot && (
                <MissionStatusDrilldown
                  childPsId={drillDownPsId}
                  snapshot={drillDownSnapshot}
                  onClose={() => {
                    setDrillDownPsId(null);
                    setDrillDownSnapshot(null);
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Resource detail panel (overlays on right side of map) */}
      {selectedResource && (
        <COPResourceDetail
          resource={selectedResource}
          onClose={() => setSelectedResource(null)}
        />
      )}


      {/* Sidebar */}
      {sidebarOpen && (
        <div className="flex border-l border-gray-700 bg-gray-800 w-96 shrink-0">
          {/* Vertical icon nav */}
          <div className="flex flex-col border-r border-gray-700 bg-gray-850 py-1 shrink-0">
            {SIDEBAR_NAV.map((item) => (
              <button
                key={item.id}
                onClick={() => setSidebarView(item.id)}
                className={[
                  'flex items-center justify-center w-10 h-10 mx-0.5 my-0.5 rounded transition-colors',
                  sidebarView === item.id
                    ? 'bg-blue-600/20 text-blue-400'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50',
                ].join(' ')}
                title={item.label}
                aria-label={item.label}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4.5 w-4.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={item.icon} />
                </svg>
              </button>
            ))}

            {/* Spacer + close at bottom */}
            <div className="flex-1" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="flex items-center justify-center w-10 h-10 mx-0.5 my-0.5 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
              title="Close sidebar"
              aria-label="Close sidebar"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Sidebar content */}
          <div className="flex-1 overflow-y-auto min-w-0">
            <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {SIDEBAR_NAV.find((n) => n.id === sidebarView)?.label ?? 'COP'}
              </h3>
              {layers.length > 0 && sidebarView === 'layers' && (
                <button
                  onClick={handleManualGenerate}
                  disabled={generating}
                  className="text-[10px] px-2 py-0.5 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors disabled:opacity-50"
                  title="Regenerate COP layers"
                >
                  {generating ? 'Generating...' : 'Regenerate'}
                </button>
              )}
            </div>
            <div className="flex-1 min-h-0">
              {renderSidebarContent()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
