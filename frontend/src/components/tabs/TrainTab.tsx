import { TabLayout, type SidebarItem } from './TabLayout.js';
import { ExerciseDashboard } from '../exercise/index.js';

const TRAIN_ITEMS: SidebarItem[] = [
  { id: 'exercises', label: 'Exercises & Training' },
];

interface TrainTabProps {
  workspaceId: string;
}

export function TrainTab({ workspaceId: _workspaceId }: TrainTabProps) {
  // TODO Phase 20: Pass workspaceId to ExerciseDashboard for workspace-scoped exercise filtering
  return (
    <TabLayout
      items={TRAIN_ITEMS}
      selectedItem="exercises"
      onSelectItem={() => {}}
    >
      <ExerciseDashboard />
    </TabLayout>
  );
}
