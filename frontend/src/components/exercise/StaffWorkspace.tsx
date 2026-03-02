/**
 * StaffWorkspace
 *
 * Phase 15 Plan 02: Role-based sidebar navigation for the exercise area.
 * Phase 15 Plan 04: Integrated NotificationPanel (bell icon + real-time WebSocket).
 * Phase 15 Plan 05: ProductDiffView modal for cross-staff integration review.
 *
 * Replaces the flat horizontal tab navigation with a collapsible, category-grouped
 * role sidebar. 31 roles are organized into 6 categories matching STAFF_ROLE_CONFIG.
 * Clicking a role loads the RoleDashboard for that role in the content area.
 *
 * Reuses TabLayout CSS class patterns (.tab-layout, .tab-sidebar, .tab-content)
 * for structural consistency, extended with category grouping styles in StaffWorkspace.css.
 *
 * Plan 04 additions:
 *   - useStaffNotifications hook provides real-time notification state
 *   - NotificationPanel rendered in workspace header area (top-right bell icon)
 *   - Per-role unread badge counts in sidebar role buttons
 *   - onViewProduct navigates to source role workspace
 *   - onIntegrate opens ProductDiffView modal (Plan 05)
 *
 * Plan 05 additions:
 *   - diffViewNotification state drives ProductDiffView modal
 *   - onAccept handler: fetches source/target products, merges, saves, marks integrated
 */

import { useState, useMemo } from 'react';
import type { ExerciseScenario, StaffNotification, StaffProduct } from '../../types/exercise';
import {
  STAFF_ROLE_CONFIG,
  STAFF_ROLE_CATEGORIES,
} from '../../types/exercise';
import { exerciseService } from '../../services/exercise-service';
import { RoleDashboard } from './RoleDashboard';
import { NotificationPanel } from './NotificationPanel';
import { ProductDiffView } from './ProductDiffView';
import { useStaffNotifications } from '../../hooks/useStaffNotifications';
import './StaffWorkspace.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface StaffWorkspaceProps {
  scenario: ExerciseScenario;
  perspective: string;
  exercisePhase: string;
  isControllerView: boolean;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export function StaffWorkspace({
  scenario,
  perspective,
  exercisePhase,
  isControllerView,
}: StaffWorkspaceProps) {
  // Default to commander if enabled, otherwise first enabled role
  const defaultRole = (scenario.enabledRoles ?? []).includes('commander')
    ? 'commander'
    : (scenario.enabledRoles ?? [])[0] ?? 'commander';

  const [activeRole, setActiveRole] = useState<string>(defaultRole);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const enabledRoles = scenario.enabledRoles ?? [];

  // ── Notifications (Plan 04) ──────────────────────────────────────────────────
  const {
    notifications,
    unreadCount,
    roleUnreadCount,
    markRead,
    markIntegrated,
    refresh: refreshNotifications,
  } = useStaffNotifications(scenario.id, activeRole);

  // Build per-role unread count map for sidebar badges
  const roleUnreadCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const n of notifications) {
      if (!n.isRead) {
        map[n.targetRole] = (map[n.targetRole] ?? 0) + 1;
      }
    }
    return map;
  }, [notifications]);

  // ── Diff view state (Plan 05) ────────────────────────────────────────────────
  const [diffViewNotification, setDiffViewNotification] = useState<StaffNotification | null>(null);
  const [diffSourceProduct, setDiffSourceProduct] = useState<StaffProduct | null>(null);
  const [diffTargetProduct, setDiffTargetProduct] = useState<StaffProduct | null>(null);
  const [diffViewLoading, setDiffViewLoading] = useState(false);

  // Navigate to source role when user clicks "View" on a notification
  const handleViewProduct = (notification: StaffNotification) => {
    setActiveRole(notification.sourceRole);
  };

  // Integrate: fetch source product + current target product, open diff view
  const handleIntegrate = async (notification: StaffNotification) => {
    setDiffViewLoading(true);
    try {
      // Fetch the source product
      const source = await exerciseService.getStaffProduct(scenario.id, notification.sourceProductId);

      // Attempt to find a matching target product for the active role
      // Match by product type in the same role as the active role
      let target: StaffProduct | null = null;
      try {
        const roleProducts = await exerciseService.getStaffProducts(scenario.id, notification.targetRole);
        const match = roleProducts.find((p) => p.productType === source.productType);
        target = match ?? null;
      } catch {
        // No target products found — diff view will show source only
      }

      setDiffSourceProduct(source);
      setDiffTargetProduct(target);
      setDiffViewNotification(notification);
    } catch (err) {
      console.error('Failed to load diff view:', err);
    } finally {
      setDiffViewLoading(false);
    }
  };

  // Accept & Integrate: merge source fields + content into target product, mark as integrated
  const handleDiffAccept = async () => {
    if (!diffViewNotification || !diffSourceProduct) return;

    // Build merged structured data from the diff snapshot
    const diffSnapshot = diffViewNotification.diffSnapshot as {
      structuredChanges?: Array<{ field: string; oldValue: unknown; newValue: unknown }>;
      contentChanged?: boolean;
    } | null;

    if (diffTargetProduct) {
      // Merge structured field changes from the source into target
      const mergedStructured = { ...diffTargetProduct.structured };
      for (const change of diffSnapshot?.structuredChanges ?? []) {
        mergedStructured[change.field] = change.newValue;
      }

      // Merge content if changed
      let mergedContent = diffTargetProduct.content;
      if (diffSnapshot?.contentChanged && diffSourceProduct.content) {
        mergedContent = diffTargetProduct.content
          ? `${diffTargetProduct.content}\n\n---\n\n[Integrated from ${STAFF_ROLE_CONFIG[diffViewNotification.sourceRole]?.label ?? diffViewNotification.sourceRole} v${diffSourceProduct.version}]\n\n${diffSourceProduct.content}`
          : diffSourceProduct.content;
      }

      await exerciseService.updateStaffProduct(scenario.id, diffTargetProduct.id, {
        structured: mergedStructured,
        content: mergedContent,
      });
    }

    // Mark the notification as integrated
    await markIntegrated(diffViewNotification.id);
    refreshNotifications();

    // Close the diff view
    setDiffViewNotification(null);
    setDiffSourceProduct(null);
    setDiffTargetProduct(null);
  };

  // Reject: mark as read, close diff view
  const handleDiffReject = () => {
    if (diffViewNotification) {
      void markRead(diffViewNotification.id);
    }
    setDiffViewNotification(null);
    setDiffSourceProduct(null);
    setDiffTargetProduct(null);
  };

  const handleDiffClose = () => {
    setDiffViewNotification(null);
    setDiffSourceProduct(null);
    setDiffTargetProduct(null);
  };

  // Toggle a category's collapsed state
  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  // Build grouped roles — only roles enabled for this scenario
  const groupedRoles = STAFF_ROLE_CATEGORIES.map((category) => {
    const roles = Object.values(STAFF_ROLE_CONFIG).filter(
      (role) => role.category === category && enabledRoles.includes(role.key)
    );
    return { category, roles };
  }).filter((group) => group.roles.length > 0);

  return (
    <div className="tab-layout staff-workspace">
      {/* ── Workspace header bar (notifications live here) ── */}
      <div className="staff-workspace-topbar">
        <div className="staff-workspace-topbar-spacer" />
        <NotificationPanel
          notifications={notifications}
          unreadCount={unreadCount}
          roleUnreadCount={roleUnreadCount}
          activeRole={activeRole}
          onMarkRead={markRead}
          onMarkIntegrated={markIntegrated}
          onViewProduct={handleViewProduct}
          onIntegrate={(notification) => { void handleIntegrate(notification); }}
        />
        {diffViewLoading && (
          <div className="staff-diff-loading" aria-live="polite">
            Loading integration review...
          </div>
        )}
      </div>

      {/* ── Main layout (sidebar + content) ── */}
      <div className="staff-workspace-body">
        {/* ── Sidebar ── */}
        <aside className={`tab-sidebar staff-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
          {/* Sidebar collapse toggle */}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((c) => !c)}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? '»' : '«'}
          </button>

          {/* Role navigation grouped by category */}
          {!sidebarCollapsed && (
            <nav className="sidebar-nav staff-sidebar-nav" aria-label="Staff roles">
              {groupedRoles.map(({ category, roles }) => {
                const isCollapsed = collapsedCategories.has(category);
                return (
                  <div key={category} className="staff-category">
                    {/* Category header — collapsible */}
                    <button
                      className="staff-category-header"
                      onClick={() => toggleCategory(category)}
                      aria-expanded={!isCollapsed}
                      title={isCollapsed ? `Expand ${category}` : `Collapse ${category}`}
                    >
                      <span className="staff-category-label">{category}</span>
                      <span className={`staff-category-chevron ${isCollapsed ? 'collapsed' : ''}`}>
                        ›
                      </span>
                    </button>

                    {/* Role buttons — visible when category is expanded */}
                    {!isCollapsed && (
                      <div className="staff-category-roles">
                        {roles.map((role) => {
                          const roleBadgeCount = roleUnreadCounts[role.key] ?? 0;
                          return (
                            <button
                              key={role.key}
                              className={`sidebar-item staff-role-btn ${activeRole === role.key ? 'active' : ''}`}
                              onClick={() => setActiveRole(role.key)}
                              title={role.doctrinalFocus}
                            >
                              <span className="staff-role-btn-label">{role.label}</span>
                              {roleBadgeCount > 0 && (
                                <span className="staff-role-unread-badge" aria-label={`${roleBadgeCount} unread`}>
                                  {roleBadgeCount > 9 ? '9+' : roleBadgeCount}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {enabledRoles.length === 0 && (
                <div className="staff-no-roles">
                  <p>No roles enabled.</p>
                  <p>Use "Manage Roles" to add staff roles.</p>
                </div>
              )}
            </nav>
          )}
        </aside>

        {/* ── Content area ── */}
        <div className="tab-content staff-content">
          <RoleDashboard
            key={activeRole}
            roleKey={activeRole}
            scenarioId={scenario.id}
            exercisePhase={exercisePhase}
            perspective={perspective}
            isControllerView={isControllerView}
          />
        </div>
      </div>

      {/* ── Product Diff View Modal (Plan 05) ── */}
      {diffViewNotification && diffSourceProduct && (
        <ProductDiffView
          notification={diffViewNotification}
          sourceProduct={diffSourceProduct}
          targetProduct={diffTargetProduct}
          onAccept={handleDiffAccept}
          onReject={handleDiffReject}
          onClose={handleDiffClose}
        />
      )}
    </div>
  );
}
