import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { MissionList, MissionDetail, MissionWizard } from '../mission/index.js';
import { useUser } from '../../context/UserContext.js';

type CampaignView = 'missions' | 'orders' | 'command' | 'resources';

const CAMPAIGN_ITEMS: SidebarItem[] = [
  { id: 'missions', label: 'Missions' },
  {
    id: 'orders',
    label: 'OPORD / WARNORD',
    tooltip: 'Operational Order / Warning Order — orders production',
  },
  {
    id: 'command',
    label: 'Command Structure',
    tooltip: 'Chain of command visualization',
  },
  {
    id: 'resources',
    label: 'Force Allocation',
    tooltip: 'Resource assignment and equipment tracking',
  },
];

export function CampaignTab() {
  const [selectedView, setSelectedView] = useState<CampaignView>('missions');
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const { userDID } = useUser();

  return (
    <TabLayout
      items={CAMPAIGN_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as CampaignView)}
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
      {selectedView === 'orders' && (
        <div className="tab-placeholder">
          <p>
            Orders (OPORD / WARNORD) are generated from within a mission context. Navigate to
            Missions to select a mission, then access orders production from the Planning Dashboard.
          </p>
        </div>
      )}
      {selectedView === 'command' && (
        <div className="tab-placeholder">
          <p>
            Command Structure visualization is available within a selected mission. Navigate to
            Missions to select a mission, then access the Command tab.
          </p>
        </div>
      )}
      {selectedView === 'resources' && (
        <div className="tab-placeholder">
          <p>
            Force Allocation is managed within a selected mission. Navigate to Missions to select
            a mission, then access the Resources tab.
          </p>
        </div>
      )}
    </TabLayout>
  );
}
