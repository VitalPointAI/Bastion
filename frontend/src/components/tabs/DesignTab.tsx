import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';

const DESIGN_ITEMS: SidebarItem[] = [
  { id: 'strategic-docs', label: 'Strategic Documents' },
];

interface DesignTabProps {
  workspaceId: string;
}

export function DesignTab({ workspaceId: _workspaceId }: DesignTabProps) {
  // TODO Phase 20: Pass workspaceId to filter strategic docs by workspace
  // StrategicDashboard needs internal update to accept workspaceId prop
  return (
    <TabLayout
      items={DESIGN_ITEMS}
      selectedItem="strategic-docs"
      onSelectItem={() => {}}
    >
      <StrategicDashboard />
    </TabLayout>
  );
}
