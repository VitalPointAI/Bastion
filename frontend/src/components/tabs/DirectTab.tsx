import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DAODashboard } from '../dao/index.js';
import { EscalationPanel } from '../problem-set/EscalationPanel.js';

type DirectView = 'governance' | 'proposals' | 'escalation';

const DIRECT_ITEMS: SidebarItem[] = [
  { id: 'governance', label: 'Governance Overview' },
  {
    id: 'proposals',
    label: 'Proposals & Voting',
    tooltip: 'Active proposals requiring action',
  },
  {
    id: 'escalation',
    label: 'Escalation',
    tooltip: 'Escalate decisions to parent problem set',
  },
];

const DAO_VIEWS = new Set<DirectView>(['governance', 'proposals']);

const VIEW_TO_INITIAL: Record<'governance' | 'proposals', 'governance' | 'proposals'> = {
  governance: 'governance',
  proposals: 'proposals',
};

interface DirectTabProps {
  problemSetId: string;
  daoId?: string;
}

export function DirectTab({ problemSetId, daoId }: DirectTabProps) {
  const [selectedView, setSelectedView] = useState<DirectView>('governance');

  return (
    <TabLayout
      items={DIRECT_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DirectView)}
    >
      {DAO_VIEWS.has(selectedView) && (
        <DAODashboard
          key={selectedView}
          daoId={daoId}
          initialView={VIEW_TO_INITIAL[selectedView as 'governance' | 'proposals']}
        />
      )}
      {selectedView === 'escalation' && (
        <EscalationPanel problemSetId={problemSetId} />
      )}
    </TabLayout>
  );
}
