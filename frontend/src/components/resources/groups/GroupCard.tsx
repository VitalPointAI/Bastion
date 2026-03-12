/**
 * GroupCard
 *
 * Displays a single resource group as a card with a color-coded type badge.
 * Acts as a droppable zone for drag-and-drop resource assignment.
 *
 * Phase 42 Plan 05: Groups sub-view — card with DnD drop target.
 */

import { useDroppable } from '@dnd-kit/core';
import type { ResourceGroup } from '../../../lib/resource-registry-service';

interface GroupCardProps {
  group: ResourceGroup;
  onClick: () => void;
}

const TYPE_BADGE: Record<ResourceGroup['groupType'], { label: string; className: string }> = {
  task_force: { label: 'TF', className: 'bg-blue-500/20 text-blue-400' },
  support: { label: 'SPT', className: 'bg-green-500/20 text-green-400' },
  reserve: { label: 'RSV', className: 'bg-amber-500/20 text-amber-400' },
  custom: { label: 'CUST', className: 'bg-gray-500/20 text-gray-400' },
};

const TYPE_LABEL: Record<ResourceGroup['groupType'], string> = {
  task_force: 'Task Force',
  support: 'Support',
  reserve: 'Reserve',
  custom: 'Custom',
};

export function GroupCard({ group, onClick }: GroupCardProps) {
  const { setNodeRef, isOver } = useDroppable({ id: group.id });

  const badge = TYPE_BADGE[group.groupType] ?? TYPE_BADGE.custom;

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      className={`bg-gray-800 border rounded-lg p-3 cursor-pointer hover:bg-gray-750 transition-colors ${
        isOver ? 'border-blue-400 bg-blue-900/20' : 'border-gray-600'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-white text-sm truncate mr-2">{group.name}</span>
        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badge.className} shrink-0`}>
          {badge.label}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>{TYPE_LABEL[group.groupType] ?? 'Custom'}</span>
        <span>{group.memberCount ?? 0} member{(group.memberCount ?? 0) !== 1 ? 's' : ''}</span>
      </div>
      {isOver && (
        <div className="mt-2 text-xs text-blue-400 text-center border border-blue-400/30 rounded py-1">
          Drop to assign
        </div>
      )}
    </div>
  );
}
