/**
 * ResourcesTab
 *
 * Top-level Resources tab shell. Renders a TabLayout with 4 sidebar
 * sub-views: Inventory | Discovery | Network | Groups.
 *
 * Default sub-view is always Inventory (no "remember last" behavior — locked
 * decision per Phase 42 Plan 01).
 *
 * Search bar and stat cards are always visible above sub-view content (locked
 * decision per Phase 42 Plan 06 — they live in the content area, NOT the sidebar).
 *
 * Phase 42 Plan 01: Initial shell with placeholder sub-views.
 * Phase 42 Plan 06: ResourceSearchBar and ResourceStatCards wired in.
 */

import { useState } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout';
import { useDiscovery } from '../../hooks/useDiscovery';
import { ResourcesProvider } from './ResourcesContext';
import { DiscoverySubView } from './discovery/DiscoverySubView';
import { GroupsSubView } from './groups/GroupsSubView';
import { InventorySubView } from './inventory/InventorySubView';
import { NetworkSubView } from './network/NetworkSubView';
import { ResourceSearchBar } from './ResourceSearchBar';
import { ResourceStatCards } from './ResourceStatCards';

interface ResourcesTabProps {
  problemSetId: string;
}

interface QuickFilter {
  key: string;
  value: string;
}

const RESOURCE_NAV_ITEMS: SidebarItem[] = [
  { id: 'inventory', label: 'Inventory' },
  { id: 'discovery', label: 'Discovery' },
  { id: 'network', label: 'Network' },
  { id: 'groups', label: 'Groups' },
];

export function ResourcesTab({ problemSetId }: ResourcesTabProps) {
  const [activeView, setActiveView] = useState<string>('inventory');
  const [activeQuickFilter, setActiveQuickFilter] = useState<QuickFilter | null>(null);
  const { devices, scannerStatus } = useDiscovery();
  const connectedCount = devices.filter((d) => d.state === 'connected').length;

  function handleNavigate(subView: string, _resourceId?: string) {
    setActiveView(subView);
    // TODO: pass resourceId into sub-view for auto-selection when sub-views expose a selection prop
  }

  function renderSubView() {
    switch (activeView) {
      case 'inventory':
        return <InventorySubView problemSetId={problemSetId} />;
      case 'discovery':
        return (
          <DiscoverySubView
            devices={devices}
            scannerStatus={scannerStatus}
          />
        );
      case 'network':
        return (
          <NetworkSubView
            devices={devices}
            scannerStatus={scannerStatus}
            connected={connectedCount}
          />
        );
      case 'groups':
        return <GroupsSubView problemSetId={problemSetId} />;
      default:
        return null;
    }
  }

  return (
    <ResourcesProvider>
      <TabLayout
        items={RESOURCE_NAV_ITEMS}
        selectedItem={activeView}
        onSelectItem={setActiveView}
      >
        {/* Search bar and stat cards are always visible above the sub-view content */}
        <div className="flex flex-col flex-1 min-h-0">
          <ResourceSearchBar
            problemSetId={problemSetId}
            onNavigate={handleNavigate}
            activeFilter={activeQuickFilter}
          />
          <ResourceStatCards
            problemSetId={problemSetId}
            onQuickFilter={setActiveQuickFilter}
          />
          <div className="flex-1 min-h-0 overflow-auto">
            {renderSubView()}
          </div>
        </div>
      </TabLayout>
    </ResourcesProvider>
  );
}
