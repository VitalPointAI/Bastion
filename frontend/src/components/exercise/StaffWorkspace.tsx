/**
 * StaffWorkspace
 *
 * Phase 15 Plan 02: Role-based sidebar navigation for the exercise area.
 * Phase 15 Plan 04: Integrated NotificationPanel (bell icon + real-time WebSocket).
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
 *   - onIntegrate marks as integrated + shows placeholder alert
 */

import { useState, useMemo } from 'react';
import type { ExerciseScenario, StaffNotification } from '../../types/exercise';
import {
  STAFF_ROLE_CONFIG,
  STAFF_ROLE_CATEGORIES,
} from '../../types/exercise';
import { RoleDashboard } from './RoleDashboard';
import { NotificationPanel } from './NotificationPanel';
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

  // Navigate to source role when user clicks "View" on a notification
  const handleViewProduct = (notification: StaffNotification) => {
    setActiveRole(notification.sourceRole);
  };

  // Integrate: mark as integrated + show placeholder (diff view in Plan 15-05)
  const handleIntegrate = (notification: StaffNotification) => {
    void markIntegrated(notification.id);
    alert(`Integration view coming soon (Plan 15-05).\nSource: ${notification.sourceRole} — Product ID: ${notification.sourceProductId}`);
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
          onIntegrate={handleIntegrate}
        />
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
    </div>
  );
}
