import { useState } from 'react';
import './TabLayout.css';

export interface SidebarItem {
  id: string;
  label: string;
  tooltip?: string;
}

export interface TabLayoutProps {
  items: SidebarItem[];
  selectedItem: string;
  onSelectItem: (id: string) => void;
  children: React.ReactNode;
}

export function TabLayout({ items, selectedItem, onSelectItem, children }: TabLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="tab-layout">
      <aside className={`tab-sidebar ${sidebarOpen ? 'open' : 'collapsed'}`}>
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {sidebarOpen ? '‹' : '›'}
        </button>
        {sidebarOpen && (
          <nav className="sidebar-nav">
            {items.map(item => (
              <button
                key={item.id}
                className={`sidebar-item ${selectedItem === item.id ? 'active' : ''}`}
                onClick={() => onSelectItem(item.id)}
                title={item.tooltip}
              >
                {item.label}
              </button>
            ))}
          </nav>
        )}
      </aside>
      <main className="tab-content">
        {children}
      </main>
    </div>
  );
}
