import { TabLayout, type SidebarItem } from './TabLayout.js';
import { ExerciseDashboard } from '../exercise/index.js';

const TRAIN_ITEMS: SidebarItem[] = [
  { id: 'exercises', label: 'Exercises & Training' },
];

interface TrainTabProps {
  problemSetId: string;
}

export function TrainTab({ problemSetId: _problemSetId }: TrainTabProps) {
  // TODO Phase 20: Pass problemSetId to ExerciseDashboard for problem-set-scoped exercise filtering
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
