/**
 * COPTab — Unified COP Workspace View
 *
 * Phase 21 Plan 12: Merges Overview, Monitor, and COP into a single primary
 * workspace view. The map with AI layers is the main content area. A collapsible
 * sidebar provides selectable views: layer controls, actor graph, actor detail,
 * activity feed, agent activity, version history, layer lifecycle, and review.
 *
 * Previously these capabilities were split across WorkspaceDashboard (Overview),
 * MonitorTab, and the old COPTab. Now consolidated here.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import type { COPLayer, Perspective, COPPhaseSpec } from '../../types/cop.js';
import { useWorkspace } from '../../context/WorkspaceContext.js';
import { COPMapView } from './COPMapView.js';
import { COPLayerControls } from './COPLayerControls.js';
import { COPPerspectiveToggle } from './COPPerspectiveToggle.js';
import { COPPhaseSlider } from './COPPhaseSlider.js';
import { COPAgentActivity } from './COPAgentActivity.js';
import { COPVersionBrowser } from './COPVersionBrowser.js';
import { COPLayerLifecycle } from './COPLayerLifecycle.js';
import { COPConflictBanner } from './COPConflictBanner.js';
import { COPReviewPanel } from './COPReviewPanel.js';
import { GraphExplorer, type GraphData } from '../graph/GraphExplorer.js';
import { NodeDetailPanel } from '../graph/NodeDetailPanel.js';
import { ActivityFeed } from '../workspace/ActivityFeed.js';

// ─── Types ──────────────────────────────────────────────────────────────────

type SidebarView =
  | 'layers'
  | 'actor-graph'
  | 'actor-detail'
  | 'activity'
  | 'agent-status'
  | 'versions'
  | 'lifecycle'
  | 'review';

interface COPTabProps {
  workspaceId: string;
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
    id: 'agent-status',
    label: 'Agent Activity',
    // cpu/bot icon
    icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7z',
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

export function COPTab({ workspaceId }: COPTabProps) {
  // Existing COP state
  const [layers, setLayers] = useState<COPLayer[]>([]);
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>({});
  const [currentPerspective, setCurrentPerspective] = useState<Perspective>('combined');

  // Sidebar state
  const [sidebarView, setSidebarView] = useState<SidebarView>('layers');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Actor graph state (from MonitorTab)
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  // Temporal phase state
  const [currentPhase, setCurrentPhase] = useState<number>(0);

  // Selected layer for lifecycle/version/review views
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  // Role from workspace context (for ActivityFeed)
  const { userRoleInActive } = useWorkspace();

  // Extract temporal phases from loaded layers
  const temporalPhases = useMemo((): COPPhaseSpec[] => {
    for (const layer of layers) {
      const spec = (layer as any).spec;
      if (spec?.temporalPhases?.length) {
        return spec.temporalPhases;
      }
    }
    return [];
  }, [layers]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  // Fetch graph data on mount (same pattern as MonitorTab)
  useEffect(() => {
    fetch(`/api/graph?workspaceId=${workspaceId}`)
      .then((res) => (res.ok ? (res.json() as Promise<GraphData>) : null))
      .then((data) => {
        if (data) setGraphData(data);
      })
      .catch(() => {
        // Graph data unavailable
      });
  }, [workspaceId]);

  // ─── Layer callbacks (existing) ───────────────────────────────────────────

  const handleLayersLoaded = useCallback((loadedLayers: COPLayer[]) => {
    setLayers(loadedLayers);

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

    // Auto-select first layer if none selected
    if (loadedLayers.length > 0) {
      setSelectedLayerId((prev) => prev ?? loadedLayers[0].id);
    }
  }, []);

  function handleVisibilityChange(layerId: string, visible: boolean) {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }));
  }

  function handleOpacityChange(layerId: string, opacity: number) {
    setLayerOpacity((prev) => ({ ...prev, [layerId]: opacity }));
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
            layerVisibility={layerVisibility}
            layerOpacity={layerOpacity}
            onVisibilityChange={handleVisibilityChange}
            onOpacityChange={handleOpacityChange}
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
            workspaceId={workspaceId}
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
            workspaceId={workspaceId}
            userRole={userRoleInActive}
          />
        );

      case 'agent-status':
        return <COPAgentActivity workspaceId={workspaceId} />;

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
            currentVersion={(selectedLayer as any).version ?? 1}
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
        {/* Perspective toggle — top left corner */}
        <div className="absolute top-3 left-3 z-[1000]">
          <COPPerspectiveToggle
            currentPerspective={currentPerspective}
            onPerspectiveChange={setCurrentPerspective}
          />
        </div>

        {/* Sidebar toggle (when collapsed) — top right */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 right-3 z-[1000] px-3 py-1.5 text-xs font-medium bg-gray-800/90 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
            aria-label="Show sidebar"
          >
            Sidebar
          </button>
        )}

        {/* Map */}
        <div className="flex-1 min-h-0 relative">
          <COPMapView
            workspaceId={workspaceId}
            layerVisibility={layerVisibility}
            layerOpacity={layerOpacity}
            currentPerspective={currentPerspective}
            currentPhase={currentPhase || undefined}
            onLayersLoaded={handleLayersLoaded}
          />
        </div>

        {/* Phase slider — bottom of map area */}
        {temporalPhases.length > 0 && (
          <div className="shrink-0 border-t border-gray-700 bg-gray-800/95 px-4 py-2">
            <COPPhaseSlider
              phases={temporalPhases}
              currentPhase={currentPhase}
              onPhaseChange={setCurrentPhase}
            />
          </div>
        )}
      </div>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="flex border-l border-gray-700 bg-gray-800 w-80 shrink-0">
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
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {SIDEBAR_NAV.find((n) => n.id === sidebarView)?.label ?? 'COP'}
              </h3>
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
