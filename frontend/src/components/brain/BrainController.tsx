/**
 * BrainController — master orchestrator for the adaptive brain visualization.
 *
 * Wires together all brain sub-components and manages shared state:
 *   - Node selection (single + multi-select via Shift-click)
 *   - Search filtering (dim non-matching nodes)
 *   - Clustering mode (driven by active lens)
 *   - Timeline scrubbing (historical + future views)
 *   - Annotations (per-node)
 *   - AI context snapshots
 *   - Intelligence gap marking
 *   - Proactive pattern alerts
 *   - Particle animation from sidebar into brain
 *   - Phase 45: lens system, subspace navigation, drill-down hierarchy, N-hop expansion
 *
 * BrainController is the "nervous system" — it owns all cross-component state
 * and passes it down to the layout and sub-components via props.
 */

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-3d';


import { BrainLayout } from './BrainLayout.js';
import { BrainVisualization } from './BrainVisualization.js';
import { BrainToolbar } from './BrainToolbar.js';
import { BrainDetailPanel } from './BrainDetailPanel.js';
import { BrainTimeline } from './BrainTimeline.js';
// IngestionSidebar is preserved but no longer used in BrainController (Phase 50 Plan 07).
// It remains as a fallback reference — do not delete.
import { IngestionDrawer } from './IngestionDrawer.js';
import { AIContextSnapshotModal } from './AIContextSnapshotModal.js';
import { GapSummaryPanel } from './GapSummaryPanel.js';
import { ParticleOverlay } from './renderers/particleRenderer.js';
import { BrainBreadcrumb } from './BrainBreadcrumb.js';
import { SubspaceSidebar } from './SubspaceSidebar.js';

import { useBrainData } from './hooks/useBrainData.js';
import { useBrainIngestion } from './hooks/useBrainIngestion.js';
import { useBrainClustering } from './hooks/useBrainClustering.js';
import { useBrainAnnotations } from './hooks/useBrainAnnotations.js';
import { useBrainTimeline } from './hooks/useBrainTimeline.js';
import { useBrainGaps } from './hooks/useBrainGaps.js';
import { useBrainPatterns } from './hooks/useBrainPatterns.js';
import { useBrainLens } from './hooks/useBrainLens.js';
import { useBrainSubspaces } from './hooks/useBrainSubspaces.js';
import { useBrainDrillDown } from './hooks/useBrainDrillDown.js';
import { useBrainNHop } from './hooks/useBrainNHop.js';


import type { BrainNode, BrainGraphData } from './types.js';
import type { PatternAlert } from './hooks/useBrainPatterns.js';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BrainControllerProps {
  problemSetId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainController({ problemSetId }: BrainControllerProps) {
  // ── ForceGraph ref (shared between BrainVisualization and useBrainClustering)
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);

  // ── Center container ref for ResizeObserver ─────────────────────────────────
  const centerRef = useRef<HTMLDivElement>(null);
  const [centerSize, setCenterSize] = useState<{ w: number; h: number }>({
    w: 800,
    h: 600,
  });

  useEffect(() => {
    if (!centerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setCenterSize({
          w: entry.contentRect.width,
          h: entry.contentRect.height,
        });
      }
    });
    ro.observe(centerRef.current);
    return () => ro.disconnect();
  }, []);

  // ── Data hooks ──────────────────────────────────────────────────────────────
  const { data, loading: dataLoading, refetch } = useBrainData(problemSetId);
  void dataLoading; // Loading state used by parent or future spinner
  void refetch;

  const { events: _events, activeProcesses: _activeProcesses, particlesRef, isConnected: _isConnected } =
    useBrainIngestion(problemSetId, true, centerSize.h);

  // useBrainClustering is still used for force layout reheat — but clusterMode is
  // now driven by the active lens via a useEffect below (RESEARCH.md Pitfall 5).
  const { clusterMode, setClusterMode, clusterLabels: _clusterLabels } = useBrainClustering(
    fgRef,
    data.nodes,
  );

  const { annotations: _annotations, createAnnotation, updateAnnotation, deleteAnnotation, getNodeAnnotations } =
    useBrainAnnotations(problemSetId);

  const {
    selectedTime,
    timeRange,
    futureTime,
    isLive,
    loading: timeLoading,
    setSelectedTime,
    goLive,
    effectiveData,
  } = useBrainTimeline(problemSetId, data);

  const { gaps, gapCount, loading: gapsLoading, markGapNodes } = useBrainGaps(problemSetId);

  const { alerts, unreadCount: _unreadCount, markAsRead: _markAsRead, markAllAsRead: _markAllAsRead } =
    useBrainPatterns(problemSetId);
  void alerts;

  // ── Phase 45: Lens system ───────────────────────────────────────────────────
  const {
    activeLens,
    allLenses,
    setActiveLensId,
    saveLens: _saveLens,
    deleteLens: deleteLensAction,
    cloneLens,
    applyLensFilters,
    clusterModeChanged,
  } = useBrainLens(problemSetId);

  // Sync clusterMode from active lens — only reheat when mode actually changes
  // (RESEARCH.md Pitfall 5: pure filter-only lens switches must NOT reheat).
  const prevClusterModeRef = useRef<string>(activeLens.clusterMode);
  useEffect(() => {
    if (clusterModeChanged && prevClusterModeRef.current !== activeLens.clusterMode) {
      prevClusterModeRef.current = activeLens.clusterMode;
      setClusterMode(activeLens.clusterMode);
    }
  }, [activeLens.clusterMode, clusterModeChanged, setClusterMode]);

  // ── Phase 45: Subspace system ───────────────────────────────────────────────
  const {
    subspaces,
    activeSubspaceId,
    setActiveSubspaceId,
    subspaceData,
    createManualSubspace,
    createSmartSubspace: _createSmartSubspace,
    deleteSubspace,
  } = useBrainSubspaces(problemSetId, effectiveData);

  // ── Phase 45: Drill-down system ─────────────────────────────────────────────
  const {
    level: drillLevel,
    breadcrumbs,
    drillIntoSubspace,
    drillIntoNode,
    drillIntoDocuments,
    drillUp,
    drillData,
    focusNodeId,
    getCameraTarget,
  } = useBrainDrillDown(effectiveData, activeSubspaceId, subspaceData);

  // ── Phase 45: N-hop expansion ───────────────────────────────────────────────
  const {
    expandedHops,
    expandedData,
    loading: nhopLoading,
    showWarning: nhopWarning,
    expand: expandNHop,
    reset: resetNHop,
    setFocusNode: setNHopFocusNode,
  } = useBrainNHop(problemSetId);

  void nhopLoading;
  void resetNHop;

  // ── Camera transition on drill-level changes ────────────────────────────────
  useEffect(() => {
    const target = getCameraTarget();
    if (target && fgRef.current) {
      fgRef.current.cameraPosition(target.position, target.lookAt, target.duration);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drillLevel, breadcrumbs.length]);

  // ── Shift-key tracking (for multi-select on node click) ────────────────────
  const shiftHeldRef = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ── Selection state ─────────────────────────────────────────────────────────
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // ── Search state ────────────────────────────────────────────────────────────
  const [searchMatchIds, setSearchMatchIds] = useState<string[] | null>(null);

  // ── Modal / panel state ─────────────────────────────────────────────────────
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);
  const [gapPanelOpen, setGapPanelOpen] = useState(false);

  // ── IngestionDrawer state (Phase 50 Plan 07) ────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const handleDrawerOpen = useCallback(() => setDrawerOpen(true), []);
  const handleDrawerClose = useCallback(() => setDrawerOpen(false), []);

  const rightPanelOpen = selectedNodeId !== null || selectedNodeIds.length > 0 || gapPanelOpen;

  // ── Processed graph data (memoized to avoid full graph rebuild per render) ──
  //
  // Pipeline:
  //   1. Start from drill-level data (subspace/node/document filtered by drill-down)
  //   2. If Level 3 (node) with N-hop expanded data, use that instead
  //   3. Apply lens filters (node type, actor category, gap visibility)
  //   4. Apply gap marking (marks gap nodes + adds ghost stubs for missing intelligence)
  //   5. Apply search dimming (set isSearchDimmed on non-matching nodes)
  //   6. Filter edges to visible nodes
  const processedData: BrainGraphData = useMemo(() => {
    // Step 1: Start from drill-level data
    let baseNodes = drillLevel === 'full' ? effectiveData.nodes : drillData.nodes;
    let baseEdges = drillLevel === 'full' ? effectiveData.edges : drillData.edges;

    // Step 2: If at Level 3 (node detail) with N-hop expansion active, use expanded data
    if (drillLevel === 'node' && expandedData) {
      baseNodes = expandedData.nodes;
      baseEdges = expandedData.edges;
    }

    // Step 3: Apply lens filters
    const lensFiltered = applyLensFilters(baseNodes);

    // Step 4: Apply gap marking
    const withGaps = markGapNodes(lensFiltered);

    // Step 5: Apply search dimming
    const searchSet = searchMatchIds ? new Set(searchMatchIds) : null;
    const withSearch =
      searchSet !== null
        ? withGaps.map((n) => ({
            ...n,
            isSearchDimmed: !searchSet.has(n.id),
          }))
        : withGaps;

    // Step 6: Filter edges to only include those between visible nodes
    const visibleIds = new Set(withSearch.map((n) => n.id));
    const filteredEdges = baseEdges.filter((e) => {
      const srcId = typeof e.source === 'string' ? e.source : (e.source as BrainNode).id;
      const tgtId = typeof e.target === 'string' ? e.target : (e.target as BrainNode).id;
      return visibleIds.has(srcId) && visibleIds.has(tgtId);
    });

    return { nodes: withSearch, edges: filteredEdges };
  }, [effectiveData, drillLevel, drillData, expandedData, applyLensFilters, markGapNodes, searchMatchIds]);

  // Derive selected node objects from the processed data
  const selectedNode = selectedNodeId
    ? processedData.nodes.find((n) => n.id === selectedNodeId)
    : undefined;

  const selectedNodes =
    selectedNodeIds.length > 0
      ? processedData.nodes.filter((n) => selectedNodeIds.includes(n.id))
      : undefined;

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleNodeClick = useCallback(
    (node: BrainNode) => {
      // Shift held → multi-select (add/remove from selection)
      if (shiftHeldRef.current) {
        setSelectedNodeIds((prev) =>
          prev.includes(node.id)
            ? prev.filter((id) => id !== node.id)
            : [...prev, node.id],
        );
        setSelectedNodeId(null);
      } else {
        setSelectedNodeId(node.id);
        setSelectedNodeIds([]);
      }
    },
    [],
  );

  // ── Double-click: drive drill-down at the appropriate level ─────────────────
  const handleNodeDoubleClick = useCallback(
    (node: BrainNode) => {
      if (drillLevel === 'full' && node.containerId) {
        // At full graph: double-click node with a containerId drills into that container
        const subId = `container:${node.containerId}`;
        setActiveSubspaceId(subId);
        drillIntoSubspace(subId, node.containerLabel ?? node.containerId);
      } else if (drillLevel === 'subspace') {
        // Inside subspace: double-click drills into node neighbourhood
        drillIntoNode(node.id);
        setNHopFocusNode(node.id);
      } else if (drillLevel === 'node' && node.type === 'document') {
        // At node detail: double-click on document drills into document layer
        drillIntoDocuments(node.id);
      }
    },
    [drillLevel, drillIntoSubspace, drillIntoNode, drillIntoDocuments, setActiveSubspaceId, setNHopFocusNode],
  );

  // ── Subspace sidebar selection ──────────────────────────────────────────────
  const handleSubspaceSelect = useCallback(
    (id: string | null) => {
      setActiveSubspaceId(id);
      if (id) {
        const sub = subspaces.find((s) => s.id === id);
        drillIntoSubspace(id, sub?.name ?? id);
      } else {
        drillUp(0); // return to full graph
      }
    },
    [subspaces, setActiveSubspaceId, drillIntoSubspace, drillUp],
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
    setGapPanelOpen(false);
  }, []);

  const handleSearchResults = useCallback((matchingIds: string[]) => {
    setSearchMatchIds(matchingIds.length === 0 ? null : matchingIds);
  }, []);

  const processedNodesRef = useRef(processedData.nodes);
  useEffect(() => {
    processedNodesRef.current = processedData.nodes;
  }, [processedData.nodes]);

  const handleNodeFocus = (nodeId: string) => {
    const node = processedNodesRef.current.find((n) => n.id === nodeId);
    if (!node || node.x == null || node.y == null) return;
    if (!fgRef.current) return;
    const z = (node as unknown as { z?: number }).z ?? 0;
    const distance = 120;
    fgRef.current.cameraPosition(
      { x: node.x + distance, y: node.y + distance, z: z + distance },
      { x: node.x, y: node.y, z },
      500,
    );
  };

  const handleAlertClick = useCallback((alert: PatternAlert) => {
    // Highlight alert's related nodes by setting them as the active search match
    setSearchMatchIds(alert.relatedNodeIds.length > 0 ? alert.relatedNodeIds : null);
  }, []);
  void handleAlertClick;

  const handleLassoSelect = useCallback((nodeIds: string[]) => {
    setSelectedNodeIds(nodeIds);
    setSelectedNodeId(null);
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <BrainLayout
        topBar={
          <BrainToolbar
            nodes={processedData.nodes}
            problemSetId={problemSetId}
            activeLens={activeLens}
            allLenses={allLenses}
            onLensChange={setActiveLensId}
            onDeleteLens={deleteLensAction}
            onCloneLens={cloneLens}
            onSearchResults={handleSearchResults}
            onNodeFocus={handleNodeFocus}
            onSnapshotClick={() => setSnapshotModalOpen(true)}
            gapCount={gapCount}
            onGapClick={() => { setGapPanelOpen((prev) => !prev); setSelectedNodeId(null); setSelectedNodeIds([]); }}
          />
        }
        breadcrumb={
          // Only show breadcrumb when drilled in (more than just root entry)
          breadcrumbs.length > 1 ? (
            <BrainBreadcrumb
              breadcrumbs={breadcrumbs}
              onNavigate={drillUp}
            />
          ) : undefined
        }
        leftSidebar={
          /* Phase 50 Plan 07: IngestionSidebar removed from grid — replaced by IngestionDrawer overlay.
           * Left column now only holds SubspaceSidebar (narrowed to 200px in BrainLayout.css). */
          <SubspaceSidebar
            subspaces={subspaces}
            activeSubspaceId={activeSubspaceId}
            onSubspaceSelect={handleSubspaceSelect}
            onCreateManual={createManualSubspace}
            onCreateSmart={() => {
              // Smart subspace creation UI is a future feature (Plan 45+)
              // For now this is a no-op placeholder
            }}
            onDelete={deleteSubspace}
            selectedNodeIds={selectedNodeIds}
          />
        }
        ingestionDrawer={
          <IngestionDrawer
            problemSetId={problemSetId}
            isOpen={drawerOpen}
            onOpen={handleDrawerOpen}
            onClose={handleDrawerClose}
          />
        }
        center={
          <div ref={centerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <BrainVisualization
              data={processedData}
              selectedNodeId={selectedNodeId ?? undefined}
              selectedNodeIds={selectedNodeIds}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              onLassoSelect={handleLassoSelect}
              clusterMode={clusterMode}
              fgRef={fgRef}
              drillLevel={drillLevel}
              expandedHops={expandedHops}
              nhopWarning={nhopWarning}
              onExpand={focusNodeId ? () => expandNHop(focusNodeId) : undefined}
            />
            <ParticleOverlay
              particlesRef={particlesRef}
              width={centerSize.w}
              height={centerSize.h}
              sidebarWidth={200}
            />
          </div>
        }
        rightPanel={
          gapPanelOpen ? (
            <GapSummaryPanel
              gaps={gaps}
              loading={gapsLoading}
              onNodeClick={(nodeId) => {
                setGapPanelOpen(false);
                setSelectedNodeId(nodeId);
                setSelectedNodeIds([]);
                handleNodeFocus(nodeId);
              }}
            />
          ) : rightPanelOpen ? (
            <BrainDetailPanel
              selectedNode={selectedNode}
              selectedNodes={selectedNodes}
              graphData={processedData}
              annotations={
                selectedNode ? getNodeAnnotations(selectedNode.id) : []
              }
              onClose={handleClosePanel}
              onCreateAnnotation={createAnnotation}
              onUpdateAnnotation={updateAnnotation}
              onDeleteAnnotation={deleteAnnotation}
            />
          ) : undefined
        }
        rightPanelOpen={rightPanelOpen}
        timeline={
          <BrainTimeline
            timeRange={timeRange}
            futureTime={futureTime}
            selectedTime={selectedTime}
            isLive={isLive}
            loading={timeLoading}
            onTimeChange={setSelectedTime}
            onGoLive={goLive}
          />
        }
      />

      {snapshotModalOpen && (
        <AIContextSnapshotModal
          isOpen={snapshotModalOpen}
          onClose={() => setSnapshotModalOpen(false)}
          problemSetId={problemSetId}
          nodeCount={processedData.nodes.length}
          edgeCount={processedData.edges.length}
          currentTimeScale={selectedTime ?? undefined}
        />
      )}
    </>
  );
}
