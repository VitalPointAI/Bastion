/**
 * StaffWorkspace
 *
 * Phase 15 Plan 02: Role-based sidebar navigation for the exercise area.
 *
 * Replaces the flat horizontal tab navigation with a collapsible, category-grouped
 * role sidebar. 31 roles are organized into 6 categories matching STAFF_ROLE_CONFIG.
 * Clicking a role loads the RoleDashboard for that role in the content area.
 *
 * Reuses TabLayout CSS class patterns (.tab-layout, .tab-sidebar, .tab-content)
 * for structural consistency, extended with category grouping styles in StaffWorkspace.css.
 */

import { useState } from 'react';
import type { ExerciseScenario } from '../../types/exercise';
import {
  STAFF_ROLE_CONFIG,
  STAFF_ROLE_CATEGORIES,
} from '../../types/exercise';
import { RoleDashboard } from './RoleDashboard';
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
                      {roles.map((role) => (
                        <button
                          key={role.key}
                          className={`sidebar-item staff-role-btn ${activeRole === role.key ? 'active' : ''}`}
                          onClick={() => setActiveRole(role.key)}
                          title={role.doctrinalFocus}
                        >
                          {role.label}
                        </button>
                      ))}
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
  );
}
