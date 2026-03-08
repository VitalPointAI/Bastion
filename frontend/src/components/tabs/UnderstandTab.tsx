import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';
import { SubscriptionManager } from '../problem-set/SubscriptionManager.js';
import { TrainingPackagesView } from './TrainingPackagesView.js';
import { StrategicContextPreview } from '../strategic/StrategicContextPreview.js';

import { InheritedContextSection } from '../inheritance/InheritedContextSection.tsx';
import { useMode } from '../../context/ModeContext.js';
import { DecisionGateBanner, GateSubmitButton, DecisionGateTimeline } from '../governance/index.js';
import type { DecisionGate } from '../../lib/gate-service';

type UnderstandView = 'strategic-docs' | 'subscriptions' | 'ai-context-preview' | 'training-packages';

interface UnderstandTabProps {
  problemSetId: string;
}

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  const { mode } = useMode();
  const [selectedView, setSelectedView] = useState<UnderstandView>('strategic-docs');
  const [trainingDocCount, setTrainingDocCount] = useState(0);
  const [hasPendingExtraction, setHasPendingExtraction] = useState(false);
  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    // Gate detail display — currently logs; full detail modal can be added later
    console.log('[UnderstandTab] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

  // Reset to strategic-docs when mode switches away from training while viewing training-only views
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
    ] : []),
  ];

  return (
    <>
    {problemSetId && (
      <InheritedContextSection problemSetId={problemSetId} />
    )}
    <TabLayout
      items={items}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as UnderstandView)}
      decisionHistory={
        <DecisionGateTimeline tabId="understand" onEntryClick={handleGateDetailClick} />
      }
    >
      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="understand" />

      {selectedView === 'strategic-docs' && (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexShrink: 0 }}>
            <span />
            <GateSubmitButton
              gateType="objective_approval"
              itemId={`${problemSetId}-strategic-docs`}
              itemTitle="Strategic Documents Review"
              itemDescription="Submit strategic documents for objective approval"
              tabId="understand"
            />
          </div>
          <StrategicDashboard problemSetId={problemSetId} />
        </div>
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
    </TabLayout>
    </>
  );
}
