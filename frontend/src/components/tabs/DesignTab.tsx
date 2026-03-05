import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';

const DESIGN_ITEMS: SidebarItem[] = [
  { id: 'strategic-docs', label: 'Strategic Documents' },
];

interface DesignTabProps {
  workspaceId: string;
}

export function DesignTab({ workspaceId }: DesignTabProps) {
  return (
    <TabLayout
      items={DESIGN_ITEMS}
      selectedItem="strategic-docs"
      onSelectItem={() => {}}
    >
      <StrategicDashboard workspaceId={workspaceId} />
    </TabLayout>
  );
}
