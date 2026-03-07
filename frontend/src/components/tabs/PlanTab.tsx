import { useState, useCallback } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { MissionList, MissionDetail, MissionWizard } from '../mission/index.js';
import { DAODashboard } from '../dao/index.js';
import { useUser } from '../../context/UserContext.js';
import { DecisionGateBanner, GateSubmitButton, DecisionGateTimeline } from '../governance/index.js';
import type { DecisionGate } from '../../lib/gate-service';

type PlanView = 'missions' | 'mdmp-workflow';

const PLAN_ITEMS: SidebarItem[] = [
  { id: 'missions', label: 'Missions' },
  {
    id: 'mdmp-workflow',
    label: 'MDMP Workflow',
    tooltip: 'Military Decision Making Process phase progression and governance gates',
  },
];

interface PlanTabProps {
  problemSetId: string;
  daoId?: string;
}

export function PlanTab({ problemSetId: _problemSetId, daoId }: PlanTabProps) {
  const [selectedView, setSelectedView] = useState<PlanView>('missions');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const { userDID } = useUser();
  const [_selectedGate, setSelectedGate] = useState<DecisionGate | null>(null);

  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    setSelectedGate(gate);
    console.log('[PlanTab] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

  return (
    <TabLayout
      items={PLAN_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as PlanView)}
      decisionHistory={
        <DecisionGateTimeline tabId="plan" onEntryClick={handleGateDetailClick} />
      }
    >
      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="plan" />

      {selectedView === 'missions' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
            <GateSubmitButton
              gateType="coa_selection"
              itemId={selectedMissionId || `${_problemSetId}-missions`}
              itemTitle={selectedMissionId ? `Mission ${selectedMissionId.slice(0, 8)}` : 'COA Selection'}
              itemDescription="Submit course of action for selection approval"
              tabId="plan"
            />
          </div>
          {showWizard && userDID ? (
            <MissionWizard
              userDID={userDID}
              onClose={() => setShowWizard(false)}
              onMissionCreated={(id) => {
                setSelectedMissionId(id);
                setShowWizard(false);
              }}
            />
          ) : selectedMissionId ? (
            <MissionDetail
              missionId={selectedMissionId}
              onBack={() => setSelectedMissionId(null)}
            />
          ) : (
            <MissionList
              onSelectMission={(id) => setSelectedMissionId(id)}
              onCreateMission={() => setShowWizard(true)}
            />
          )}
        </>
      )}
      {selectedView === 'mdmp-workflow' && (
        <DAODashboard daoId={daoId} initialView="mdmp" />
      )}
    </TabLayout>
  );
}
