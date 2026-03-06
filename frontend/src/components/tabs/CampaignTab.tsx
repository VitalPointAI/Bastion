import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { MissionList, MissionDetail, MissionWizard } from '../mission/index.js';
import { useUser } from '../../context/UserContext.js';

const CAMPAIGN_ITEMS: SidebarItem[] = [
  { id: 'missions', label: 'Missions' },
];

interface CampaignTabProps {
  problemSetId: string;
}

export function CampaignTab({ problemSetId: _problemSetId }: CampaignTabProps) {
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const { userDID } = useUser();

  return (
    <TabLayout
      items={CAMPAIGN_ITEMS}
      selectedItem="missions"
      onSelectItem={() => {}}
    >
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
    </TabLayout>
  );
}
