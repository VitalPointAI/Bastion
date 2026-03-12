/**
 * BrainController — master orchestrator for the adaptive brain visualization.
 *
 * Wires together all brain sub-components and manages shared state:
 *   - Node selection (single + multi-select via Shift-click)
 *   - Search filtering (dim non-matching nodes)
 *   - Clustering mode
 *   - Timeline scrubbing (historical + future views)
 *   - Annotations (per-node)
 *   - AI context snapshots
 *   - Intelligence gap marking
 *   - Proactive pattern alerts
 *   - Particle animation from sidebar into brain
 *
 * BrainController is the "nervous system" — it owns all cross-component state
 * and passes it down to the layout and sub-components via props.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { ForceGraphMethods } from 'react-force-graph-2d';

import { useMode } from '../../context/ModeContext.js';

import { BrainLayout } from './BrainLayout.js';
import { BrainVisualization } from './BrainVisualization.js';
import { BrainToolbar } from './BrainToolbar.js';
import { BrainDetailPanel } from './BrainDetailPanel.js';
import { BrainTimeline } from './BrainTimeline.js';
import { IngestionSidebar } from './IngestionSidebar.js';
import { AIContextSnapshotModal } from './AIContextSnapshotModal.js';
import { ParticleOverlay } from './renderers/particleRenderer.js';

import { useBrainData } from './hooks/useBrainData.js';
import { useBrainIngestion } from './hooks/useBrainIngestion.js';
import { useBrainClustering } from './hooks/useBrainClustering.js';
import { useBrainAnnotations } from './hooks/useBrainAnnotations.js';
import { useBrainTimeline } from './hooks/useBrainTimeline.js';
import { useBrainGaps } from './hooks/useBrainGaps.js';
import { useBrainPatterns } from './hooks/useBrainPatterns.js';

import type { BrainNode, BrainGraphData } from './types.js';
import type { PatternAlert } from './hooks/useBrainPatterns.js';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface BrainControllerProps {
  problemSetId: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function BrainController({ problemSetId }: BrainControllerProps) {
  // ── Mode ────────────────────────────────────────────────────────────────────
  const { mode } = useMode();

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

  const { gaps: _gaps, gapCount, markGapNodes } = useBrainGaps(problemSetId);

  const { alerts, unreadCount: _unreadCount, markAsRead: _markAsRead, markAllAsRead: _markAllAsRead } =
    useBrainPatterns(problemSetId);
  void alerts;

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

  const rightPanelOpen = selectedNodeId !== null || selectedNodeIds.length > 0;

  // ── Search state ────────────────────────────────────────────────────────────
  const [searchMatchIds, setSearchMatchIds] = useState<string[] | null>(null);

  // ── Modal state ─────────────────────────────────────────────────────────────
  const [snapshotModalOpen, setSnapshotModalOpen] = useState(false);

  // ── Processed graph data ────────────────────────────────────────────────────
  const processedData: BrainGraphData = (() => {
    // Start from the timeline's effective data
    const base = effectiveData;

    // Apply gap marking — marks gap nodes with isGap=true and adds ghost nodes
    const nodesWithGaps = markGapNodes(base.nodes ?? []);

    // Apply search dimming — set isSearchDimmed flag on non-matching nodes
    const nodesWithSearch =
      searchMatchIds !== null
        ? nodesWithGaps.map((n) => ({
            ...n,
            isSearchDimmed: !searchMatchIds.includes(n.id),
          }))
        : nodesWithGaps;

    return {
      nodes: nodesWithSearch,
      edges: base.edges ?? [],
    };
  })();

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

  const handleClosePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedNodeIds([]);
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
    fgRef.current.centerAt(node.x, node.y, 500);
    fgRef.current.zoom(3, 500);
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
            clusterMode={clusterMode}
            onClusterModeChange={setClusterMode}
            onSearchResults={handleSearchResults}
            onNodeFocus={handleNodeFocus}
            onSnapshotClick={() => setSnapshotModalOpen(true)}
            gapCount={gapCount}
          />
        }
        leftSidebar={
          <IngestionSidebar
            problemSetId={problemSetId}
            mode={mode}
          />
        }
        center={
          <div ref={centerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            <BrainVisualization
              data={processedData}
              selectedNodeId={selectedNodeId ?? undefined}
              selectedNodeIds={selectedNodeIds}
              onNodeClick={handleNodeClick}
              onLassoSelect={handleLassoSelect}
              clusterMode={clusterMode}
              fgRef={fgRef}
            />
            <ParticleOverlay
              particlesRef={particlesRef}
              width={centerSize.w}
              height={centerSize.h}
              sidebarWidth={280}
            />
          </div>
        }
        rightPanel={
          rightPanelOpen ? (
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
