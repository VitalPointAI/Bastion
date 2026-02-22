import { useState } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicDashboard } from '../strategic/index.js';

type DesignView =
  | 'strategic-docs'
  | 'coa-development'
  | 'escalation'
  | 'force-ratio'
  | 'branch-sequel'
  | 'sustainment';

const DESIGN_ITEMS: SidebarItem[] = [
  { id: 'strategic-docs', label: 'Strategic Documents' },
  {
    id: 'coa-development',
    label: 'COA Development',
    tooltip: 'Course of Action development — JP 5-0 Steps 4-5 (requires mission context)',
  },
  { id: 'escalation', label: 'Escalation Modeling' },
  {
    id: 'force-ratio',
    label: 'Force Ratio',
    tooltip: 'Comparative force strength analysis',
  },
  {
    id: 'branch-sequel',
    label: 'Branch / Sequel',
    tooltip: 'Contingency plan timelines with decision points',
  },
  {
    id: 'sustainment',
    label: 'Sustainment',
    tooltip: 'Logistics feasibility analysis',
  },
];

export function DesignTab() {
  const [selectedView, setSelectedView] = useState<DesignView>('strategic-docs');

  return (
    <TabLayout
      items={DESIGN_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DesignView)}
    >
      {selectedView === 'strategic-docs' && <StrategicDashboard />}
      {selectedView === 'coa-development' && (
        <div className="tab-placeholder">
          <p>
            COA Development requires a mission context. Navigate to Campaign &gt; Missions to
            select a mission, then access the Planning Dashboard.
          </p>
        </div>
      )}
      {selectedView === 'escalation' && (
        <div className="tab-placeholder">
          <p>
            Escalation Modeling requires a mission/plan context. Navigate to Campaign &gt;
            Missions to select a mission, then run escalation analysis from the Planning Dashboard.
          </p>
        </div>
      )}
      {selectedView === 'force-ratio' && (
        <div className="tab-placeholder">
          <p>
            Force Ratio analysis requires a mission/plan context. Navigate to Campaign &gt;
            Missions to select a mission, then run force ratio analysis from the Planning Dashboard.
          </p>
        </div>
      )}
      {selectedView === 'branch-sequel' && (
        <div className="tab-placeholder">
          <p>
            Branch / Sequel planning requires a mission/plan context. Navigate to Campaign &gt;
            Missions to select a mission, then access branch/sequel planning from the Planning
            Dashboard.
          </p>
        </div>
      )}
      {selectedView === 'sustainment' && (
        <div className="tab-placeholder">
          <p>
            Sustainment analysis requires a mission/plan context. Navigate to Campaign &gt;
            Missions to select a mission, then run sustainment analysis from the Planning Dashboard.
          </p>
        </div>
      )}
    </TabLayout>
  );
}
