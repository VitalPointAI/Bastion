import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DAODashboard } from '../dao/index.js';

type DecideView = 'governance' | 'proposals' | 'mdmp-workflow';

const DECIDE_ITEMS: SidebarItem[] = [
  { id: 'governance', label: 'Governance Overview' },
  {
    id: 'proposals',
    label: 'Proposals & Voting',
    tooltip: 'Active proposals requiring action',
  },
  {
    id: 'mdmp-workflow',
    label: 'MDMP Workflow',
    tooltip: 'Military Decision Making Process phase progression and governance gates',
  },
];

const VIEW_TO_INITIAL: Record<DecideView, 'governance' | 'proposals' | 'mdmp'> = {
  governance: 'governance',
  proposals: 'proposals',
  'mdmp-workflow': 'mdmp',
};

export function DecideTab() {
  const [selectedView, setSelectedView] = useState<DecideView>('governance');

  return (
    <TabLayout
      items={DECIDE_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DecideView)}
    >
      <DAODashboard key={selectedView} initialView={VIEW_TO_INITIAL[selectedView]} />
    </TabLayout>
  );
}
