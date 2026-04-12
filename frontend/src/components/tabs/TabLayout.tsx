import { useState, type ReactNode } from 'react';
import { DesignStatusBadge } from '../design/DesignStatusBadge.tsx';
import './TabLayout.css';

export interface SidebarItem {
  id: string;
  label: string;
  tooltip?: string;
  status?: 'not-started' | 'in-progress' | 'complete';
  /** Optional secondary line shown under the label (e.g., "→ Step 2: Mission Analysis") */
  subtitle?: string;
}

export interface TabLayoutProps {
  items: SidebarItem[];
  selectedItem: string;
  onSelectItem: (id: string) => void;
  children: React.ReactNode;
  /** Optional header slot rendered above sidebar nav (e.g., echelon badge) */
  header?: ReactNode;
  /** Optional slot for decision history section below sidebar items */
  decisionHistory?: ReactNode;
  /** Additional CSS class(es) for the content area */
  contentClassName?: string;
}

export function TabLayout({ items, selectedItem, onSelectItem, children, header, decisionHistory, contentClassName }: TabLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const showSidebar = items.length > 1;

  return (
    <div className="tab-layout">
      {showSidebar && (
        <aside className={`tab-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            {sidebarOpen ? '‹' : '›'}
          </button>
          {sidebarOpen && (
            <>
              {header && (
                <div className="sidebar-header">
                  {header}
                </div>
              )}
              <nav className="sidebar-nav">
                {items.map(item => (
                  <button
                    key={item.id}
                    className={`sidebar-item ${selectedItem === item.id ? 'active' : ''}`}
                    onClick={() => onSelectItem(item.id)}
                    title={item.tooltip}
                  >
                    <div className="sidebar-item-row">
                      <span className="sidebar-item-label">{item.label}</span>
                      {item.status !== undefined && (
                        <DesignStatusBadge status={item.status} compact />
                      )}
                    </div>
                    {item.subtitle && (
                      <span className="sidebar-item-subtitle">{item.subtitle}</span>
                    )}
                  </button>
                ))}
              </nav>
              {decisionHistory && (
                <div className="sidebar-decision-history">
                  {decisionHistory}
                </div>
              )}
            </>
          )}
        </aside>
      )}
      <main className={`tab-content${contentClassName ? ` ${contentClassName}` : ''}`}>
        {children}
      </main>
    </div>
  );
}
