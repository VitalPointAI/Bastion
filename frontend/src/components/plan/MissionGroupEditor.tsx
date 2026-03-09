/**
 * Mission Group Editor
 *
 * Phase 35 Plan 03: Drag-to-group task assembly for OPORD Para 3.
 * Two-column layout: ungrouped tasks (left) and mission groups (right).
 * HTML5 drag-and-drop for moving tasks between groups and ungrouped pool.
 */

import React, { useState, useCallback } from 'react';
import type {
  OPORDSubordinateTask,
  MissionGroup,
} from '../../lib/mission-creation-service';

// ─── Props ──────────────────────────────────────────────────────────────────

export interface MissionGroupEditorProps {
  tasks: OPORDSubordinateTask[];
  groups: MissionGroup[];
  onTasksChange: (tasks: OPORDSubordinateTask[]) => void;
  onGroupsChange: (groups: MissionGroup[]) => void;
  onCreateMission: (group: MissionGroup) => void;
  problemSetId: string;
}

// ─── Task Card ──────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: OPORDSubordinateTask;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, isDragging, onDragStart }) => (
  <div
    draggable
    onDragStart={(e) => onDragStart(e, task.id)}
    className={`
      p-3 bg-slate-800 border border-slate-600 rounded cursor-grab
      hover:border-cyan-500/50 transition-colors select-none
      ${isDragging ? 'opacity-50' : ''}
    `}
  >
    <div className="flex items-center gap-2 mb-1">
      <span className="text-slate-500 text-xs">&#9776;</span>
      <span className="text-cyan-400 font-mono text-xs font-bold truncate">
        {task.unitName}
      </span>
    </div>
    <p className="text-slate-300 font-mono text-xs leading-relaxed line-clamp-2">
      {task.task}
    </p>
    {task.purpose && (
      <p className="text-slate-500 font-mono text-xs mt-1 line-clamp-1">
        Purpose: {task.purpose}
      </p>
    )}
  </div>
);

// ─── Group Panel ────────────────────────────────────────────────────────────

interface GroupPanelProps {
  group: MissionGroup;
  tasks: OPORDSubordinateTask[];
  allTasks: OPORDSubordinateTask[];
  dragOverGroupId: string | null;
  draggingTaskId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, groupId: string) => void;
  onDragLeave: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
  onNameChange: (groupId: string, name: string) => void;
  onDelete: (groupId: string) => void;
  onCreateMission: (group: MissionGroup) => void;
}

const GroupPanel: React.FC<GroupPanelProps> = ({
  group,
  tasks,
  dragOverGroupId,
  draggingTaskId,
  onDragOver,
  onDrop,
  onDragLeave,
  onDragStart,
  onNameChange,
  onDelete,
  onCreateMission,
}) => {
  const isDragTarget = dragOverGroupId === group.id;
  const isCreated = group.status === 'created';
  const canCreate = group.taskIds.length > 0 && !isCreated;

  return (
    <div
      onDragOver={onDragOver}
      onDrop={(e) => onDrop(e, group.id)}
      onDragLeave={onDragLeave}
      className={`
        border rounded-lg p-3 transition-colors
        ${isDragTarget ? 'border-cyan-400 bg-cyan-900/10' : 'border-slate-600 bg-slate-850'}
        ${isCreated ? 'border-green-700/50' : ''}
      `}
    >
      {/* Group Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isCreated ? (
            <span className="text-slate-300 font-mono text-sm font-bold truncate">
              {group.name}
            </span>
          ) : (
            <input
              type="text"
              value={group.name}
              onChange={(e) => onNameChange(group.id, e.target.value)}
              className="flex-1 bg-transparent text-slate-300 font-mono text-sm font-bold
                border-b border-slate-600 focus:border-cyan-500 outline-none px-1 py-0.5"
              placeholder="Mission name..."
            />
          )}
          <span
            className={`
              px-2 py-0.5 rounded text-xs font-mono font-bold uppercase
              ${isCreated ? 'bg-green-900/50 text-green-400 border border-green-700/50' : 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50'}
            `}
          >
            {group.status}
          </span>
        </div>
        <div className="flex items-center gap-1 ml-2">
          {!isCreated && (
            <button
              onClick={() => onDelete(group.id)}
              className="p-1 text-slate-500 hover:text-red-400 transition-colors"
              title="Delete group"
            >
              <span className="text-xs">&#10005;</span>
            </button>
          )}
        </div>
      </div>

      {/* Task Count */}
      <div className="text-slate-500 font-mono text-xs mb-2">
        {tasks.length} task{tasks.length !== 1 ? 's' : ''} assigned
        {group.assignedUnitId && (
          <span className="ml-2 text-slate-400">
            | Unit: {tasks[0]?.unitName || group.assignedUnitId}
          </span>
        )}
      </div>

      {/* Tasks in Group */}
      <div className="space-y-2 min-h-[40px]">
        {tasks.length === 0 && (
          <div className="border border-dashed border-slate-700 rounded p-3 text-center">
            <p className="text-slate-600 font-mono text-xs">
              Drop tasks here
            </p>
          </div>
        )}
        {tasks.map((t) => (
          <TaskCard
            key={t.id}
            task={t}
            isDragging={draggingTaskId === t.id}
            onDragStart={onDragStart}
          />
        ))}
      </div>

      {/* Group Actions */}
      <div className="mt-3 flex justify-end">
        {isCreated && group.childProblemSetId ? (
          <span className="text-green-400 font-mono text-xs">
            Mission PS created
          </span>
        ) : (
          <button
            onClick={() => onCreateMission(group)}
            disabled={!canCreate}
            className={`
              px-3 py-1.5 rounded font-mono text-xs font-bold transition-colors
              ${canCreate
                ? 'bg-cyan-700 hover:bg-cyan-600 text-white'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
            `}
          >
            Create Mission
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const MissionGroupEditor: React.FC<MissionGroupEditorProps> = ({
  tasks,
  groups,
  onTasksChange,
  onGroupsChange,
  onCreateMission,
}) => {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverUngrouped, setDragOverUngrouped] = useState(false);

  const ungroupedTasks = tasks.filter((t) => t.missionGroupId === null);

  const getGroupTasks = useCallback(
    (groupId: string) => tasks.filter((t) => t.missionGroupId === groupId),
    [tasks],
  );

  // ── Drag Handlers ──

  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingTaskId(taskId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingTaskId(null);
    setDragOverGroupId(null);
    setDragOverUngrouped(false);
  }, []);

  const moveTaskToGroup = useCallback(
    (taskId: string, targetGroupId: string | null) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const oldGroupId = task.missionGroupId;
      if (oldGroupId === targetGroupId) return;

      // Update task's missionGroupId
      const updatedTasks = tasks.map((t) =>
        t.id === taskId ? { ...t, missionGroupId: targetGroupId } : t,
      );
      onTasksChange(updatedTasks);

      // Update groups' taskIds
      const updatedGroups = groups.map((g) => {
        if (g.id === oldGroupId) {
          return { ...g, taskIds: g.taskIds.filter((id) => id !== taskId) };
        }
        if (g.id === targetGroupId) {
          return {
            ...g,
            taskIds: [...g.taskIds, taskId],
            assignedUnitId: g.assignedUnitId || task.unitId,
          };
        }
        return g;
      });
      onGroupsChange(updatedGroups);
    },
    [tasks, groups, onTasksChange, onGroupsChange],
  );

  const handleDropOnGroup = useCallback(
    (e: React.DragEvent, groupId: string) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) moveTaskToGroup(taskId, groupId);
      setDragOverGroupId(null);
      setDraggingTaskId(null);
    },
    [moveTaskToGroup],
  );

  const handleDropOnUngrouped = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const taskId = e.dataTransfer.getData('text/plain');
      if (taskId) moveTaskToGroup(taskId, null);
      setDragOverUngrouped(false);
      setDraggingTaskId(null);
    },
    [moveTaskToGroup],
  );

  // ── Group Management ──

  const handleNewGroup = useCallback(() => {
    const groupNum = groups.length + 1;
    const newGroup: MissionGroup = {
      id: `mg-${Date.now()}-${groupNum}`,
      name: `Mission ${groupNum}`,
      taskIds: [],
      assignedUnitId: null,
      status: 'draft',
      childProblemSetId: null,
    };
    onGroupsChange([...groups, newGroup]);
  }, [groups, onGroupsChange]);

  const handleDeleteGroup = useCallback(
    (groupId: string) => {
      const group = groups.find((g) => g.id === groupId);
      if (!group || group.status === 'created') return;

      // Move all tasks in this group back to ungrouped
      const updatedTasks = tasks.map((t) =>
        t.missionGroupId === groupId ? { ...t, missionGroupId: null } : t,
      );
      onTasksChange(updatedTasks);
      onGroupsChange(groups.filter((g) => g.id !== groupId));
    },
    [tasks, groups, onTasksChange, onGroupsChange],
  );

  const handleGroupNameChange = useCallback(
    (groupId: string, name: string) => {
      onGroupsChange(
        groups.map((g) => (g.id === groupId ? { ...g, name } : g)),
      );
    },
    [groups, onGroupsChange],
  );

  return (
    <div className="flex flex-col h-full" onDragEnd={handleDragEnd}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-slate-300 font-mono text-sm font-bold tracking-wider uppercase">
          Mission Task Grouping
        </h3>
        <button
          onClick={handleNewGroup}
          className="px-3 py-1.5 bg-cyan-700 hover:bg-cyan-600 text-white font-mono text-xs font-bold rounded transition-colors"
        >
          + New Group
        </button>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
        {/* LEFT: Ungrouped Tasks */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOverUngrouped(true);
          }}
          onDrop={handleDropOnUngrouped}
          onDragLeave={() => setDragOverUngrouped(false)}
          className={`
            flex flex-col border rounded-lg p-3 overflow-y-auto transition-colors
            ${dragOverUngrouped ? 'border-cyan-400 bg-cyan-900/10' : 'border-slate-700 bg-slate-900/50'}
          `}
        >
          <h4 className="text-slate-400 font-mono text-xs font-bold tracking-wider uppercase mb-3">
            Ungrouped Tasks ({ungroupedTasks.length})
          </h4>
          <div className="space-y-2 flex-1">
            {ungroupedTasks.length === 0 && (
              <div className="border border-dashed border-slate-700 rounded p-4 text-center">
                <p className="text-slate-600 font-mono text-xs">
                  All tasks assigned to groups
                </p>
              </div>
            )}
            {ungroupedTasks.map((t) => (
              <TaskCard
                key={t.id}
                task={t}
                isDragging={draggingTaskId === t.id}
                onDragStart={handleDragStart}
              />
            ))}
          </div>
        </div>

        {/* RIGHT: Mission Groups */}
        <div className="flex flex-col overflow-y-auto">
          <h4 className="text-slate-400 font-mono text-xs font-bold tracking-wider uppercase mb-3">
            Mission Groups ({groups.length})
          </h4>
          <div className="space-y-3 flex-1">
            {groups.length === 0 && (
              <div className="border border-dashed border-slate-700 rounded-lg p-6 text-center">
                <p className="text-slate-600 font-mono text-xs">
                  Click &quot;+ New Group&quot; to create a mission group
                </p>
              </div>
            )}
            {groups.map((g) => (
              <GroupPanel
                key={g.id}
                group={g}
                tasks={getGroupTasks(g.id)}
                allTasks={tasks}
                dragOverGroupId={dragOverGroupId}
                draggingTaskId={draggingTaskId}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverGroupId(g.id);
                }}
                onDrop={handleDropOnGroup}
                onDragLeave={() => setDragOverGroupId(null)}
                onDragStart={handleDragStart}
                onNameChange={handleGroupNameChange}
                onDelete={handleDeleteGroup}
                onCreateMission={onCreateMission}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
