import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { MissionList, MissionDetail, MissionWizard } from '../mission/index.js';
import { DAODashboard } from '../dao/index.js';
import { useUser } from '../../context/UserContext.js';

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

  return (
    <TabLayout
      items={PLAN_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as PlanView)}
    >
      {selectedView === 'missions' && (
        <>
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
