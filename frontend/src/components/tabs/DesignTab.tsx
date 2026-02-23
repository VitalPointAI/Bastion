import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';

const DESIGN_ITEMS: SidebarItem[] = [
  { id: 'strategic-docs', label: 'Strategic Documents' },
];

export function DesignTab() {
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
