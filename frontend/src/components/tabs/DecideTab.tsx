import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { DAODashboard } from '../dao/index.js';
import { EscalationPanel } from '../workspace/EscalationPanel.js';
import { SubscriptionManager } from '../workspace/SubscriptionManager.js';

type DecideView = 'governance' | 'proposals' | 'mdmp-workflow' | 'escalation' | 'subscriptions';

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
  {
    id: 'escalation',
    label: 'Escalation',
    tooltip: 'Escalate decisions to parent workspace',
  },
  {
    id: 'subscriptions',
    label: 'Data Sharing',
    tooltip: 'Manage cross-workspace data subscriptions',
  },
];

const DAO_VIEWS = new Set<DecideView>(['governance', 'proposals', 'mdmp-workflow']);

const VIEW_TO_INITIAL: Record<'governance' | 'proposals' | 'mdmp-workflow', 'governance' | 'proposals' | 'mdmp'> = {
  governance: 'governance',
  proposals: 'proposals',
  'mdmp-workflow': 'mdmp',
};

interface DecideTabProps {
  workspaceId: string;
  daoId?: string;
}

export function DecideTab({ workspaceId, daoId }: DecideTabProps) {
  const [selectedView, setSelectedView] = useState<DecideView>('governance');

  return (
    <TabLayout
      items={DECIDE_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DecideView)}
    >
      {DAO_VIEWS.has(selectedView) && (
        <DAODashboard
          key={selectedView}
          daoId={daoId}
          initialView={VIEW_TO_INITIAL[selectedView as 'governance' | 'proposals' | 'mdmp-workflow']}
        />
      )}
      {selectedView === 'escalation' && (
        <EscalationPanel workspaceId={workspaceId} />
      )}
      {selectedView === 'subscriptions' && (
        <SubscriptionManager workspaceId={workspaceId} />
      )}
    </TabLayout>
  );
}
