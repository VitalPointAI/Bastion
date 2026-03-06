import { useState, useEffect } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';
import { SubscriptionManager } from '../problem-set/SubscriptionManager.js';
import { TrainingPackagesView } from './TrainingPackagesView.js';
import { StrategicContextPreview } from '../strategic/StrategicContextPreview.js';
import { TeamRoster } from '../exercise/TeamRoster.js';
import { useMode } from '../../context/ModeContext.js';

type UnderstandView = 'strategic-docs' | 'subscriptions' | 'ai-context-preview' | 'training-packages' | 'team-roster';

interface UnderstandTabProps {
  problemSetId: string;
}

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  const { mode } = useMode();
  const [selectedView, setSelectedView] = useState<UnderstandView>('strategic-docs');
  const [trainingDocCount, setTrainingDocCount] = useState(0);
  const [hasPendingExtraction, setHasPendingExtraction] = useState(false);

  // Reset to strategic-docs when mode switches away from training while viewing training-only views
  useEffect(() => {
    if (mode !== 'training' && (selectedView === 'training-packages' || selectedView === 'team-roster')) {
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
    {
      id: 'ai-context-preview',
      label: 'AI Context Preview',
      tooltip: 'Preview what AI agents know about the strategic environment',
    },
    ...(mode === 'training' ? [
      {
        id: 'training-packages',
        label: `Training Packages${trainingDocCount > 0 ? ` (${trainingDocCount})` : ''}${hasPendingExtraction ? ' *' : ''}`,
      },
      {
        id: 'team-roster',
        label: 'Team Roster',
        tooltip: 'Manage exercise positions and phase-transition mappings',
      },
    ] : []),
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
      {selectedView === 'ai-context-preview' && (
        <StrategicContextPreview problemSetId={problemSetId} />
      )}
      {selectedView === 'training-packages' && mode === 'training' && (
        <TrainingPackagesView
          problemSetId={problemSetId}
          onDocCountChange={setTrainingDocCount}
          onPendingChange={setHasPendingExtraction}
        />
      )}
      {selectedView === 'team-roster' && mode === 'training' && (
        <TeamRoster problemSetId={problemSetId} />
      )}
    </TabLayout>
  );
}
