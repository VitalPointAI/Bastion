import { useState, useEffect } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';
import { SubscriptionManager } from '../problem-set/SubscriptionManager.js';
import { TrainingPackagesView } from './TrainingPackagesView.js';
import { useMode } from '../../context/ModeContext.js';

type UnderstandView = 'strategic-docs' | 'subscriptions' | 'training-packages';

interface UnderstandTabProps {
  problemSetId: string;
}

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  const { mode } = useMode();
  const [selectedView, setSelectedView] = useState<UnderstandView>('strategic-docs');
  const [trainingDocCount, setTrainingDocCount] = useState(0);
  const [hasPendingExtraction, setHasPendingExtraction] = useState(false);

  // Reset to strategic-docs when mode switches away from training while viewing training-packages
  useEffect(() => {
    if (mode !== 'training' && selectedView === 'training-packages') {
      setSelectedView('strategic-docs');
    }
  }, [mode, selectedView]);

  const items: SidebarItem[] = [
    { id: 'strategic-docs', label: 'Strategic Documents' },
    {
      id: 'subscriptions',
      label: 'Data Sharing',
      tooltip: 'Manage cross-problem-set data subscriptions',
    },
    ...(mode === 'training' ? [{
      id: 'training-packages',
      label: `Training Packages${trainingDocCount > 0 ? ` (${trainingDocCount})` : ''}${hasPendingExtraction ? ' *' : ''}`,
    }] : []),
  ];

  return (
    <TabLayout
      items={items}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as UnderstandView)}
    >
      {selectedView === 'strategic-docs' && (
        <StrategicDashboard problemSetId={problemSetId} />
      )}
      {selectedView === 'subscriptions' && (
        <SubscriptionManager problemSetId={problemSetId} />
      )}
      {selectedView === 'training-packages' && mode === 'training' && (
        <TrainingPackagesView
          problemSetId={problemSetId}
          onDocCountChange={setTrainingDocCount}
          onPendingChange={setHasPendingExtraction}
        />
      )}
    </TabLayout>
  );
}
