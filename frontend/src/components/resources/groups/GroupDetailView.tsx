/**
 * GroupDetailView
 *
 * Detail view for a single resource group. Shows aggregate capabilities,
 * member list with remove, and an add-members section with multi-select.
 * Inline-editable group name via PATCH.
 *
 * Phase 42 Plan 05: Groups sub-view — group detail with member management.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  resourceRegistryService,
  type ResourceGroup,
  type RegisteredResource,
} from '../../../lib/resource-registry-service';

interface GroupDetailViewProps {
  group: ResourceGroup;
  problemSetId: string;
  onBack: () => void;
  onGroupDeleted: () => void;
  onGroupUpdated: (group: ResourceGroup) => void;
}

const TYPE_BADGE: Record<ResourceGroup['groupType'], { label: string; className: string }> = {
  task_force: { label: 'TF', className: 'bg-blue-500/20 text-blue-400' },
  support: { label: 'SPT', className: 'bg-green-500/20 text-green-400' },
  reserve: { label: 'RSV', className: 'bg-amber-500/20 text-amber-400' },
  custom: { label: 'CUST', className: 'bg-gray-500/20 text-gray-400' },
};

export function GroupDetailView({
  group,
  problemSetId,
  onBack,
  onGroupDeleted,
  onGroupUpdated,
}: GroupDetailViewProps) {
  const [members, setMembers] = useState<RegisteredResource[]>([]);
  const [availableResources, setAvailableResources] = useState<RegisteredResource[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(true);

  const badge = TYPE_BADGE[group.groupType] ?? TYPE_BADGE.custom;

  const loadMembers = useCallback(async () => {
    try {
      const m = await resourceRegistryService.getGroupMembers(group.id);
      setMembers(m);
    } catch (err) {
      console.error('Failed to load group members:', err);
    }
  }, [group.id]);

  const loadAvailable = useCallback(async () => {
    try {
      const all = await resourceRegistryService.searchRegistry({ missionId: problemSetId });
      setAvailableResources(all);
    } catch (err) {
      console.error('Failed to load resources:', err);
    }
  }, [problemSetId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadMembers(), loadAvailable()]).finally(() => setLoading(false));
  }, [loadMembers, loadAvailable]);

  const memberIds = new Set(members.map((m) => m.id));
  const nonMembers = availableResources.filter((r) => !memberIds.has(r.id));

  async function handleSaveName() {
    if (editName.trim() && editName !== group.name) {
      try {
        const updated = await resourceRegistryService.updateGroup(group.id, { name: editName.trim() });
        onGroupUpdated(updated);
      } catch (err) {
        console.error('Failed to rename group:', err);
      }
    }
    setEditing(false);
  }

  async function handleDelete() {
    try {
      await resourceRegistryService.deleteGroup(group.id);
      onGroupDeleted();
    } catch (err) {
      console.error('Failed to delete group:', err);
    }
  }

  async function handleRemoveMember(resourceId: string) {
    try {
      await resourceRegistryService.removeFromGroup(group.id, resourceId);
      await loadMembers();
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleAssignSelected() {
    try {
      await Promise.all(
        Array.from(selectedIds).map((rid) => resourceRegistryService.addToGroup(group.id, rid)),
      );
      setSelectedIds(new Set());
      await loadMembers();
    } catch (err) {
      console.error('Failed to assign resources:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading group details...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-900">
      {/* Header */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-700">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          &larr; Back
        </button>

        {editing ? (
          <input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white text-sm font-semibold focus:outline-none focus:border-blue-500"
          />
        ) : (
          <h2
            className="text-white font-semibold text-sm cursor-pointer hover:text-blue-400"
            onClick={() => { setEditName(group.name); setEditing(true); }}
            title="Click to rename"
          >
            {group.name}
          </h2>
        )}

        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${badge.className}`}>
          {badge.label}
        </span>

        <div className="ml-auto">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-red-400">Delete?</span>
              <button
                onClick={handleDelete}
                className="text-xs px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Yes
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs px-2 py-1 text-gray-400 hover:text-white"
              >
                No
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              Delete Group
            </button>
          )}
        </div>
      </div>

      {/* Aggregate Capabilities */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-700">
        <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
          Aggregate Capabilities
        </h3>
        {group.aggregateCapabilities && group.aggregateCapabilities.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {group.aggregateCapabilities.map((cap) => (
              <span
                key={cap}
                className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300"
              >
                {cap}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500 italic">No capabilities aggregated</p>
        )}
      </div>

      {/* Member List */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 py-3">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Members ({members.length})
          </h3>
          {members.length === 0 ? (
            <p className="text-sm text-gray-500 italic">No members in this group</p>
          ) : (
            <div className="space-y-1">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-gray-800 rounded px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-white">{m.name}</span>
                    <span className="text-xs text-gray-500">{m.category}</span>
                    <span className="text-xs text-gray-500">{m.status}</span>
                  </div>
                  <button
                    onClick={() => handleRemoveMember(m.id)}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Members */}
        <div className="px-4 py-3 border-t border-gray-700">
          <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">
            Add Members
          </h3>
          {nonMembers.length === 0 ? (
            <p className="text-sm text-gray-500 italic">All resources already assigned</p>
          ) : (
            <>
              <div className="max-h-48 overflow-auto space-y-1 mb-2">
                {nonMembers.map((r) => (
                  <label
                    key={r.id}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-800 cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                      className="accent-blue-500"
                    />
                    <span className="text-gray-300">{r.name}</span>
                    <span className="text-xs text-gray-500">{r.category}</span>
                  </label>
                ))}
              </div>
              {selectedIds.size > 0 && (
                <button
                  onClick={handleAssignSelected}
                  className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Assign Selected ({selectedIds.size})
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
