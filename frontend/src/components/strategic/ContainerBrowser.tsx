/**
 * ContainerBrowser Component
 *
 * Main orchestrator for browsing strategic containers grouped by actor category.
 * Replaces the flat DocumentList in StrategicDashboard.
 * Manages navigation state: categories view -> container documents view.
 * Wraps content in DndContext for drag-and-drop document assignment.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import type {
  StrategicDocument,
  CategoryGroup,
  ActorCategory,
  StrategicContainer,
} from '../../lib/types/strategic.js';
import { strategicService } from '../../lib/strategic-service.js';
import { CategoryFilterBar } from './CategoryFilterBar.js';
import { ContainerCard } from './ContainerCard.js';
import { ContainerDocumentList } from './ContainerDocumentList.js';
import { ActorCategoryBadge } from './ActorCategoryBadge.js';
import { ContainerManager } from './ContainerManager.js';
import { ContainerAgentPanel } from './ContainerAgentPanel.js';
import './ContainerBrowser.css';

type BrowserLevel = 'categories' | 'container' | 'unorganized';

interface BrowserState {
  level: BrowserLevel;
  categoryFilter: string | null;
  selectedContainerId: string | null;
  selectedContainerName: string | null;
  selectedContainerCategoryColor: string | null;
}

interface ContainerBrowserProps {
  problemSetId: string;
  onSelectDocument: (doc: StrategicDocument) => void;
  userDID?: string;
  refreshTrigger: number;
}

interface ActiveDragItem {
  documentId: string;
  documentTitle: string;
  sourceContainerId: string | null;
}

/**
 * Draggable wrapper for unorganized document cards.
 */
function DraggableUnorganizedCard({
  doc,
  onSelectDocument,
}: {
  doc: StrategicDocument;
  onSelectDocument: (doc: StrategicDocument) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `doc-${doc.id}`,
    data: {
      type: 'document',
      documentId: doc.id,
      documentTitle: doc.title,
      sourceContainerId: null,
    },
  });

  return (
    <div
      ref={setNodeRef}
      className="document-card"
      style={{ opacity: isDragging ? 0.4 : 1 }}
      onClick={() => onSelectDocument(doc)}
      role="button"
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && onSelectDocument(doc)}
      aria-roledescription="draggable document"
      {...attributes}
      {...listeners}
    >
      <div className="doc-info">
        <h4 className="doc-title">{doc.title}</h4>
        <p className="doc-level-name">{doc.level}</p>
      </div>
    </div>
  );
}

export function ContainerBrowser({
  problemSetId,
  onSelectDocument,
  userDID,
  refreshTrigger,
}: ContainerBrowserProps) {
  const [environmentId, setEnvironmentId] = useState<string | null>(null);
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([]);
  const [unorganizedDocs, setUnorganizedDocs] = useState<StrategicDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [browserState, setBrowserState] = useState<BrowserState>({
    level: 'categories',
    categoryFilter: null,
    selectedContainerId: null,
    selectedContainerName: null,
    selectedContainerCategoryColor: null,
  });

  // Container manager state
  const [managerAction, setManagerAction] = useState<
    | { type: 'create-container'; categoryId: string }
    | { type: 'create-category' }
    | { type: 'rename-container'; containerId: string; currentName: string }
    | { type: 'delete-container'; containerId: string; containerName: string; documentCount: number }
    | { type: 'reassign-container'; containerId: string; currentCategoryId: string }
    | null
  >(null);

  // Drag-and-drop state
  const [activeDragItem, setActiveDragItem] = useState<ActiveDragItem | null>(null);
  const [dragError, setDragError] = useState<string | null>(null);

  // Container agent panel state
  const [agentPanelContainerId, setAgentPanelContainerId] = useState<string | null>(null);
  const [agentPanelContainerName, setAgentPanelContainerName] = useState<string>('');

  /**
   * Load environment and containers.
   */
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const env = await strategicService.getEnvironmentByProblemSet(problemSetId);
      setEnvironmentId(env.id);

      const [groups, unorganized] = await Promise.all([
        strategicService.getContainersGrouped(env.id),
        strategicService.getUnorganizedDocuments(env.id),
      ]);

      setCategoryGroups(groups);
      setUnorganizedDocs(unorganized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load containers');
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  /**
   * All categories flattened from groups.
   */
  const allCategories: ActorCategory[] = categoryGroups.map((g) => g.category);

  /**
   * Filter groups by active category.
   */
  const visibleGroups =
    browserState.categoryFilter !== null
      ? categoryGroups.filter((g) => g.category.id === browserState.categoryFilter)
      : categoryGroups;

  /**
   * Navigate to container document view.
   */
  const handleContainerClick = (container: StrategicContainer, categoryColor: string) => {
    setBrowserState({
      level: 'container',
      categoryFilter: browserState.categoryFilter,
      selectedContainerId: container.id,
      selectedContainerName: container.name,
      selectedContainerCategoryColor: categoryColor,
    });
  };

  /**
   * Navigate back to categories view.
   */
  const handleBack = () => {
    setBrowserState((prev) => ({
      ...prev,
      level: 'categories',
      selectedContainerId: null,
      selectedContainerName: null,
      selectedContainerCategoryColor: null,
    }));
  };

  /**
   * Navigate to unorganized documents.
   */
  const handleUnorganizedClick = () => {
    setBrowserState((prev) => ({
      ...prev,
      level: 'unorganized',
    }));
  };

  /**
   * Handle category filter change.
   */
  const handleFilterChange = (categoryId: string | null) => {
    setBrowserState((prev) => ({
      ...prev,
      categoryFilter: categoryId,
    }));
  };

  /**
   * Refresh data after container/category changes.
   */
  const handleRefresh = () => {
    loadData();
  };

  /**
   * Get agent count for a container from category groups.
   */
  const getContainerAgentCount = (containerId: string): number => {
    for (const group of categoryGroups) {
      const container = group.containers.find((c) => c.id === containerId);
      if (container) return container.agentCount;
    }
    return 0;
  };

  // ---------------------------------------------------------------------------
  // Drag-and-Drop Handlers
  // ---------------------------------------------------------------------------

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;
    if (data?.type === 'document') {
      setActiveDragItem({
        documentId: data.documentId as string,
        documentTitle: data.documentTitle as string,
        sourceContainerId: data.sourceContainerId as string | null,
      });
      setDragError(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over } = event;
    const dragItem = activeDragItem;
    setActiveDragItem(null);

    if (!over || !dragItem) return;

    const overData = over.data.current;
    if (overData?.type !== 'container') return;

    const targetContainerId = overData.containerId as string;

    // Don't drop on the same container
    if (targetContainerId === dragItem.sourceContainerId) return;

    // Optimistic update: update counts in category groups
    const prevGroups = [...categoryGroups];
    const prevUnorganized = [...unorganizedDocs];

    // Update local state optimistically
    setCategoryGroups((groups) =>
      groups.map((group) => ({
        ...group,
        containers: group.containers.map((c) => {
          if (c.id === targetContainerId) {
            return { ...c, documentCount: c.documentCount + 1 };
          }
          if (c.id === dragItem.sourceContainerId) {
            return { ...c, documentCount: Math.max(0, c.documentCount - 1) };
          }
          return c;
        }),
      }))
    );

    // If source was unorganized, remove from unorganized list
    if (!dragItem.sourceContainerId) {
      setUnorganizedDocs((docs) => docs.filter((d) => d.id !== dragItem.documentId));
    }

    try {
      // Assign to target container
      await strategicService.assignDocumentToContainers(dragItem.documentId, [targetContainerId]);

      // Remove from source container if it had one
      if (dragItem.sourceContainerId) {
        await strategicService.removeDocumentFromContainer(
          dragItem.documentId,
          dragItem.sourceContainerId
        );
      }

      // Refresh data to get accurate counts
      loadData();
    } catch (err) {
      // Revert optimistic update
      setCategoryGroups(prevGroups);
      setUnorganizedDocs(prevUnorganized);
      setDragError(
        err instanceof Error ? err.message : 'Failed to move document'
      );

      // Clear error after 4 seconds
      setTimeout(() => setDragError(null), 4000);
    }
  };

  /**
   * Render breadcrumb navigation.
   */
  const renderBreadcrumb = () => {
    const crumbs: Array<{ label: string; onClick?: () => void }> = [];

    crumbs.push({
      label: 'All Categories',
      onClick:
        browserState.level !== 'categories'
          ? () =>
              setBrowserState({
                level: 'categories',
                categoryFilter: null,
                selectedContainerId: null,
                selectedContainerName: null,
                selectedContainerCategoryColor: null,
              })
          : undefined,
    });

    if (browserState.categoryFilter !== null) {
      const cat = allCategories.find((c) => c.id === browserState.categoryFilter);
      if (cat) {
        crumbs.push({
          label: cat.name,
          onClick:
            browserState.level !== 'categories'
              ? () =>
                  setBrowserState((prev) => ({
                    ...prev,
                    level: 'categories',
                    selectedContainerId: null,
                    selectedContainerName: null,
                    selectedContainerCategoryColor: null,
                  }))
              : undefined,
        });
      }
    }

    if (browserState.level === 'container' && browserState.selectedContainerName) {
      crumbs.push({ label: browserState.selectedContainerName });
    }

    if (browserState.level === 'unorganized') {
      crumbs.push({ label: 'Unorganized' });
    }

    return (
      <nav className="container-breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} className="breadcrumb-segment">
            {i > 0 && <span className="breadcrumb-separator">/</span>}
            {crumb.onClick ? (
              <button className="breadcrumb-link" onClick={crumb.onClick}>
                {crumb.label}
              </button>
            ) : (
              <span className="breadcrumb-current">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>
    );
  };

  // --- Loading state ---
  if (loading && categoryGroups.length === 0) {
    return (
      <div className="container-browser">
        <div className="document-list loading">
          <div className="loading-content">
            <div className="loading-spinner" />
            <span>Loading containers...</span>
          </div>
        </div>
      </div>
    );
  }

  // --- Error state ---
  if (error && categoryGroups.length === 0) {
    return (
      <div className="container-browser">
        <div className="document-list error">
          <div className="error-content">
            <p>{error}</p>
            <button onClick={loadData}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  // --- Container document view ---
  if (
    browserState.level === 'container' &&
    browserState.selectedContainerId
  ) {
    return (
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="container-browser">
          {renderBreadcrumb()}
          {dragError && (
            <div className="drag-error-toast">{dragError}</div>
          )}
          <ContainerDocumentList
            containerId={browserState.selectedContainerId}
            onSelectDocument={onSelectDocument}
            onBack={handleBack}
            containerName={browserState.selectedContainerName || 'Container'}
            categoryColor={browserState.selectedContainerCategoryColor || '#4a90d9'}
            userDID={userDID}
            onManageAgents={() => {
              setAgentPanelContainerId(browserState.selectedContainerId);
              setAgentPanelContainerName(browserState.selectedContainerName || 'Container');
            }}
            agentCount={getContainerAgentCount(browserState.selectedContainerId)}
          />
        </div>

        {/* Drag overlay - ghost card */}
        <DragOverlay>
          {activeDragItem ? (
            <div className="drag-overlay-card">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              <span>{activeDragItem.documentTitle}</span>
            </div>
          ) : null}
        </DragOverlay>

        {/* Container Agent Panel */}
        {agentPanelContainerId && userDID && (
          <ContainerAgentPanel
            containerId={agentPanelContainerId}
            containerName={agentPanelContainerName}
            userDID={userDID}
            onClose={() => {
              setAgentPanelContainerId(null);
              loadData();
            }}
          />
        )}
      </DndContext>
    );
  }

  // --- Unorganized documents view ---
  if (browserState.level === 'unorganized') {
    return (
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="container-browser">
          {renderBreadcrumb()}
          {dragError && (
            <div className="drag-error-toast">{dragError}</div>
          )}
          <div className="container-document-list">
            <button className="back-button" onClick={handleBack}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12,19 5,12 12,5" />
              </svg>
              Back to Containers
            </button>

            <div className="container-doc-header" style={{ borderLeftColor: '#6b7280' }}>
              <h3>Unorganized Documents</h3>
              <span className="doc-count">
                {unorganizedDocs.length} document{unorganizedDocs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {unorganizedDocs.length === 0 ? (
              <div className="document-list empty">
                <div className="empty-content">
                  <p>All documents are organized into containers</p>
                </div>
              </div>
            ) : (
              <div className="document-grid">
                {unorganizedDocs.map((doc) => (
                  <DraggableUnorganizedCard
                    key={doc.id}
                    doc={doc}
                    onSelectDocument={onSelectDocument}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Drag overlay - ghost card */}
        <DragOverlay>
          {activeDragItem ? (
            <div className="drag-overlay-card">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              <span>{activeDragItem.documentTitle}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    );
  }

  // --- Categories view (main) ---
  const totalContainers = categoryGroups.reduce(
    (sum, g) => sum + g.containers.length,
    0
  );

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="container-browser">
        {renderBreadcrumb()}

        {/* Drag error toast */}
        {dragError && (
          <div className="drag-error-toast">{dragError}</div>
        )}

        {/* Category filter bar */}
        <CategoryFilterBar
          categories={allCategories}
          activeFilter={browserState.categoryFilter}
          onFilterChange={handleFilterChange}
          onAddCategory={() => setManagerAction({ type: 'create-category' })}
        />

        {/* Error banner */}
        {error && (
          <div className="list-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        {/* Category groups */}
        {totalContainers === 0 && unorganizedDocs.length === 0 ? (
          <div className="container-browser-empty">
            <div className="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p>No containers yet</p>
            <span>Create a container to organize your strategic documents</span>
          </div>
        ) : (
          <div className="category-groups">
            {visibleGroups.map((group) => (
              <div key={group.category.id} className="category-group">
                {/* Category header */}
                <div
                  className="category-group-header"
                  style={{ borderLeftColor: group.category.color }}
                >
                  <div className="category-group-title">
                    <ActorCategoryBadge
                      name={group.category.name}
                      color={group.category.color}
                    />
                    <span className="category-container-count">
                      {group.containers.length} container
                      {group.containers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <button
                    className="add-container-btn"
                    onClick={() =>
                      setManagerAction({
                        type: 'create-container',
                        categoryId: group.category.id,
                      })
                    }
                    title={`Add container to ${group.category.name}`}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      width="16"
                      height="16"
                    >
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                  </button>
                </div>

                {/* Container cards grid */}
                {group.containers.length === 0 ? (
                  <div className="category-empty">
                    <span>No containers in this category</span>
                    <button
                      className="add-first-container-btn"
                      onClick={() =>
                        setManagerAction({
                          type: 'create-container',
                          categoryId: group.category.id,
                        })
                      }
                    >
                      Add Container
                    </button>
                  </div>
                ) : (
                  <div className="container-cards-grid">
                    {group.containers.map((container) => (
                      <ContainerCard
                        key={container.id}
                        container={container}
                        categoryColor={group.category.color}
                        onClick={() =>
                          handleContainerClick(container, group.category.color)
                        }
                        onRename={(id) =>
                          setManagerAction({
                            type: 'rename-container',
                            containerId: id,
                            currentName: container.name,
                          })
                        }
                        onDelete={(id) =>
                          setManagerAction({
                            type: 'delete-container',
                            containerId: id,
                            containerName: container.name,
                            documentCount: container.documentCount,
                          })
                        }
                        onReassign={(id) =>
                          setManagerAction({
                            type: 'reassign-container',
                            containerId: id,
                            currentCategoryId: container.categoryId,
                          })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Unorganized section */}
            {browserState.categoryFilter === null && (
              <div className="category-group unorganized-group">
                <div
                  className="category-group-header"
                  style={{ borderLeftColor: '#6b7280' }}
                >
                  <div className="category-group-title">
                    <ActorCategoryBadge name="Unorganized" color="#6b7280" />
                    <span className="category-container-count">
                      {unorganizedDocs.length} document
                      {unorganizedDocs.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {unorganizedDocs.length > 0 && (
                  <button
                    className="unorganized-browse-btn"
                    onClick={handleUnorganizedClick}
                  >
                    View {unorganizedDocs.length} unorganized document
                    {unorganizedDocs.length !== 1 ? 's' : ''}
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                      <polyline points="9,18 15,12 9,6" />
                    </svg>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Container Manager for CRUD operations */}
        {environmentId && managerAction && (
          <ContainerManager
            environmentId={environmentId}
            categories={categoryGroups}
            action={managerAction}
            onClose={() => setManagerAction(null)}
            onRefresh={handleRefresh}
          />
        )}

        {/* Container Agent Panel */}
        {agentPanelContainerId && userDID && (
          <ContainerAgentPanel
            containerId={agentPanelContainerId}
            containerName={agentPanelContainerName}
            userDID={userDID}
            onClose={() => {
              setAgentPanelContainerId(null);
              loadData();
            }}
          />
        )}
      </div>

      {/* Drag overlay - ghost card */}
      <DragOverlay>
        {activeDragItem ? (
          <div className="drag-overlay-card">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14,2 14,8 20,8" />
            </svg>
            <span>{activeDragItem.documentTitle}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
