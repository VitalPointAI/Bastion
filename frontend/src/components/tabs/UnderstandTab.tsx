import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';
import { SubscriptionManager } from '../problem-set/SubscriptionManager.js';

type UnderstandView = 'strategic-docs' | 'subscriptions';

const UNDERSTAND_ITEMS: SidebarItem[] = [
  { id: 'strategic-docs', label: 'Strategic Documents' },
  {
    id: 'subscriptions',
    label: 'Data Sharing',
    tooltip: 'Manage cross-problem-set data subscriptions',
  },
];

interface UnderstandTabProps {
  problemSetId: string;
}

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  const [selectedView, setSelectedView] = useState<UnderstandView>('strategic-docs');

  return (
    <TabLayout
      items={UNDERSTAND_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as UnderstandView)}
    >
      {selectedView === 'strategic-docs' && (
        <StrategicDashboard problemSetId={problemSetId} />
      )}
      {selectedView === 'subscriptions' && (
        <SubscriptionManager problemSetId={problemSetId} />
      )}
    </TabLayout>
  );
}
