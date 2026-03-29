import { useState, useCallback } from 'react';
import { BrainController } from '../brain/BrainController.js';
import { InheritedContextSection } from '../inheritance/InheritedContextSection.tsx';
import { DecisionGateBanner } from '../governance/index.js';
import { TabLayout } from './TabLayout.tsx';
import type { SidebarItem } from './TabLayout.tsx';
import { ObjectivesReviewPage } from '../understand/ObjectivesReviewPage.tsx';

type UnderstandView = 'brain' | 'objectives';

interface UnderstandTabProps {
  problemSetId: string;
}

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  const [selectedView, setSelectedView] = useState<UnderstandView>('brain');
  const [draftCount, setDraftCount] = useState(0);

  const handleDraftCountChange = useCallback((count: number) => {
    setDraftCount(count);
  }, []);

  const sidebarItems: SidebarItem[] = [
    { id: 'brain', label: 'Brain' },
    {
      id: 'objectives',
      label: draftCount > 0 ? `Objectives (${draftCount})` : 'Objectives',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Inherited context from parent problem sets */}
      {problemSetId && (
        <InheritedContextSection problemSetId={problemSetId} />
      )}

      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="understand" />

      {/* Content area with sidebar navigation */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <TabLayout
          items={sidebarItems}
          selectedItem={selectedView}
          onSelectItem={(id) => setSelectedView(id as UnderstandView)}
        >
          {selectedView === 'brain' && (
            <div style={{ height: '100%', position: 'relative' }}>
              <BrainController problemSetId={problemSetId} />
            </div>
          )}

          {selectedView === 'objectives' && (
            <ObjectivesReviewPage
              problemSetId={problemSetId}
              onDraftCountChange={handleDraftCountChange}
            />
          )}
        </TabLayout>
      </div>
    </div>
  );
}
