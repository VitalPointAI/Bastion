import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DAODashboard } from '../dao/index.js';

type DecideView =
  | 'governance'
  | 'proposals'
  | 'voting'
  | 'mdmp-workflow'
  | 'commander-guidance'
  | 'assumptions';

const DECIDE_ITEMS: SidebarItem[] = [
  { id: 'governance', label: 'Governance Overview' },
  { id: 'proposals', label: 'Proposals', tooltip: 'Active proposals requiring action' },
  { id: 'voting', label: 'Voting', tooltip: 'Vote on active proposals' },
  {
    id: 'mdmp-workflow',
    label: 'MDMP Workflow',
    tooltip: 'Military Decision Making Process phase progression and governance gates',
  },
  {
    id: 'commander-guidance',
    label: "Commander's Guidance",
    tooltip: 'Intent and authority delegation',
  },
  { id: 'assumptions', label: 'Assumptions', tooltip: 'Planning assumption registry' },
];

export function DecideTab() {
  const [selectedView, setSelectedView] = useState<DecideView>('governance');

  return (
    <TabLayout
      items={DECIDE_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DecideView)}
    >
      {/* v1: All sidebar items render DAODashboard which contains proposals, voting,
          MDMP toggle, commander guidance, and assumptions internally.
          The sidebar acts as a preview of future decomposition. */}
      <DAODashboard />
    </TabLayout>
  );
}
