/**
 * GroupsSubView
 *
 * Main groups sub-view with group list, type filtering, create modal,
 * DndContext for drag-and-drop resource assignment, and detail drill-down.
 *
 * Phase 42 Plan 05: Groups sub-view with CRUD, DnD, type badges, filtering.
 */

import { useState, useEffect, useCallback } from 'react';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import {
  resourceRegistryService,
  type ResourceGroup,
} from '../../../lib/resource-registry-service';
import { GroupCard } from './GroupCard';
import { GroupDetailView } from './GroupDetailView';
import { CreateGroupModal } from './CreateGroupModal';

interface GroupsSubViewProps {
  problemSetId: string;
}

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'task_force', label: 'Task Force' },
  { value: 'support', label: 'Support' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'custom', label: 'Custom' },
];

export function GroupsSubView({ problemSetId }: GroupsSubViewProps) {
  const [groups, setGroups] = useState<ResourceGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ResourceGroup | null>(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadGroups = useCallback(async () => {
    try {
      const result = await resourceRegistryService.listGroups(problemSetId);
      setGroups(result);
    } catch (err) {
      console.error('Failed to load groups:', err);
    }
  }, [problemSetId]);

  useEffect(() => {
    setLoading(true);
    loadGroups().finally(() => setLoading(false));
  }, [loadGroups]);

  const filteredGroups =
    typeFilter === 'all' ? groups : groups.filter((g) => g.groupType === typeFilter);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const resourceId = (active.data.current?.resourceId || active.id) as string;
    const groupId = over.id as string;
    try {
      await resourceRegistryService.addToGroup(groupId, resourceId);
      await loadGroups();
    } catch (err) {
      console.error('Failed to assign resource to group:', err);
    }
  };

  function handleGroupCreated(newGroup: ResourceGroup) {
    setGroups((prev) => [...prev, newGroup]);
  }

  function handleGroupDeleted() {
    setSelectedGroup(null);
    loadGroups();
  }

  function handleGroupUpdated(updated: ResourceGroup) {
    setGroups((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    setSelectedGroup(updated);
  }

  if (selectedGroup) {
    return (
      <GroupDetailView
        group={selectedGroup}
        problemSetId={problemSetId}
        onBack={() => setSelectedGroup(null)}
        onGroupDeleted={handleGroupDeleted}
        onGroupUpdated={handleGroupUpdated}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading groups...
      </div>
    );
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full overflow-hidden bg-gray-900">
        {/* Toolbar */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-medium text-gray-300">Resource Groups</h3>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-blue-500"
            >
              {TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Create Group
          </button>
        </div>

        {/* Group grid */}
        <div className="flex-1 overflow-auto p-4">
          {filteredGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <p className="text-sm">
                {groups.length === 0
                  ? 'No groups yet. Create one to organize your resources.'
                  : 'No groups match the current filter.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredGroups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  onClick={() => setSelectedGroup(group)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create Modal */}
        <CreateGroupModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreated={handleGroupCreated}
          problemSetId={problemSetId}
        />
      </div>
    </DndContext>
  );
}
