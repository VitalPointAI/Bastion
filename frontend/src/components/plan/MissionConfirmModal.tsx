/**
 * Mission Confirm Modal
 *
 * Phase 35 Plan 03: Preview and confirm modal with role assignment.
 * Shows inherited context summary, editable mission name, and
 * role assignment table for humans and AI agents.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type {
  MissionGroup,
  OPORDSubordinateTask,
  CreateMissionInput,
  CommandersIntentChain,
  RoleAssignment,
} from '../../lib/mission-creation-service';

// ─── Tactical Role Options ──────────────────────────────────────────────────

const TACTICAL_ROLES = [
  'commander',
  'xo',
  's2',
  's3',
  's4',
  'fso',
  'member',
] as const;

const DAO_ROLES = [
  'council',
  'member',
] as const;

// ─── Props ──────────────────────────────────────────────────────────────────

export interface MissionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  group: MissionGroup;
  tasks: OPORDSubordinateTask[];
  parentProblemSetId: string;
  parentPsName: string;
  onConfirm: (input: CreateMissionInput) => Promise<void>;
  parentMembers: Array<{ did: string; displayName: string; role: string }>;
  availableAgents: Array<{ did: string; displayName: string; role: string }>;
  /** Optional pre-fetched commander's intent chain */
  commandersIntent?: CommandersIntentChain;
  /** Optional inherited context fields */
  inheritedContext?: {
    taskOrganization?: Record<string, unknown>;
    constraints?: Record<string, unknown>;
    roeReferences?: string[];
    ccirs?: Record<string, unknown>;
    areaOfOperations?: { type: string; coordinates: number[][][] } | null;
    timeline?: Record<string, unknown>;
  };
}

// ─── Section Component ──────────────────────────────────────────────────────

interface SectionProps {
  title: string;
  source?: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, source, children }) => (
  <div className="mb-4">
    <div className="flex items-center justify-between mb-1">
      <h4 className="text-slate-400 font-mono text-xs font-bold tracking-wider uppercase">
        {title}
      </h4>
      {source && (
        <span className="text-slate-600 font-mono text-xs italic">
          {source}
        </span>
      )}
    </div>
    <div className="bg-slate-800/50 border border-slate-700 rounded p-3">
      {children}
    </div>
  </div>
);

// ─── Role Row ───────────────────────────────────────────────────────────────

interface RoleRowProps {
  assignment: RoleAssignment;
  index: number;
  onUpdate: (index: number, field: keyof RoleAssignment, value: string) => void;
  onRemove: (index: number) => void;
}

const RoleRow: React.FC<RoleRowProps> = ({ assignment, index, onUpdate, onRemove }) => (
  <tr className="border-b border-slate-700/50 last:border-0">
    <td className="py-2 pr-3">
      <div className="flex items-center gap-2">
        <span className="text-slate-300 font-mono text-xs truncate max-w-[160px]">
          {assignment.displayName}
        </span>
        {assignment.isAgent && (
          <span className="px-1.5 py-0.5 bg-purple-900/50 text-purple-400 border border-purple-700/50 rounded text-xs font-mono font-bold">
            AI
          </span>
        )}
      </div>
    </td>
    <td className="py-2 pr-3">
      <select
        value={assignment.role}
        onChange={(e) => onUpdate(index, 'role', e.target.value)}
        className="bg-slate-800 border border-slate-600 text-slate-300 font-mono text-xs rounded px-2 py-1 w-full"
      >
        {TACTICAL_ROLES.map((r) => (
          <option key={r} value={r}>
            {r.toUpperCase()}
          </option>
        ))}
      </select>
    </td>
    <td className="py-2 pr-3">
      <select
        value={assignment.daoRole}
        onChange={(e) => onUpdate(index, 'daoRole', e.target.value)}
        className="bg-slate-800 border border-slate-600 text-slate-300 font-mono text-xs rounded px-2 py-1 w-full"
      >
        {DAO_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
    </td>
    <td className="py-2">
      <button
        onClick={() => onRemove(index)}
        className="text-slate-500 hover:text-red-400 transition-colors text-xs"
        title="Remove"
      >
        &#10005;
      </button>
    </td>
  </tr>
);

// ─── Agent Search Panel ─────────────────────────────────────────────────────

interface AgentSearchProps {
  agents: Array<{ did: string; displayName: string; role: string }>;
  assignedDids: Set<string>;
  onSelect: (agent: { did: string; displayName: string; role: string }) => void;
  onClose: () => void;
}

const AgentSearchPanel: React.FC<AgentSearchProps> = ({
  agents,
  assignedDids,
  onSelect,
  onClose,
}) => {
  const [search, setSearch] = useState('');
  const filtered = agents.filter(
    (a) =>
      !assignedDids.has(a.did) &&
      a.displayName.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="mt-2 bg-slate-800 border border-slate-600 rounded p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-slate-400 font-mono text-xs font-bold">Select AI Agent</span>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xs">
          &#10005;
        </button>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search agents..."
        className="w-full bg-slate-900 border border-slate-600 text-slate-300 font-mono text-xs rounded px-2 py-1 mb-2"
      />
      <div className="max-h-32 overflow-y-auto space-y-1">
        {filtered.length === 0 && (
          <p className="text-slate-600 font-mono text-xs p-2">No agents found</p>
        )}
        {filtered.map((a) => (
          <button
            key={a.did}
            onClick={() => onSelect(a)}
            className="w-full text-left px-2 py-1.5 rounded hover:bg-slate-700 transition-colors"
          >
            <span className="text-slate-300 font-mono text-xs">{a.displayName}</span>
            <span className="text-purple-400 font-mono text-xs ml-2">({a.role})</span>
          </button>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ─────────────────────────────────────────────────────────

export const MissionConfirmModal: React.FC<MissionConfirmModalProps> = ({
  isOpen,
  onClose,
  group,
  tasks,
  parentProblemSetId,
  parentPsName,
  onConfirm,
  parentMembers,
  availableAgents,
  commandersIntent,
  inheritedContext,
}) => {
  const [missionName, setMissionName] = useState(group.name);
  const [roleAssignments, setRoleAssignments] = useState<RoleAssignment[]>(() =>
    // Pre-populate from parentMembers who match the assigned unit -- all start as 'member'
    parentMembers.map((m) => ({
      did: m.did,
      displayName: m.displayName,
      role: 'member',
      daoRole: 'member',
      isAgent: false,
    })),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAgentSearch, setShowAgentSearch] = useState(false);

  // Derived data
  const taskStatement = useMemo(
    () => tasks.map((t) => t.task).join('; '),
    [tasks],
  );
  const purpose = useMemo(
    () => tasks.map((t) => t.purpose).filter(Boolean).join('; '),
    [tasks],
  );
  const assignedDids = useMemo(
    () => new Set(roleAssignments.map((r) => r.did)),
    [roleAssignments],
  );

  // ── Role Management ──

  const handleUpdateRole = useCallback(
    (index: number, field: keyof RoleAssignment, value: string) => {
      setRoleAssignments((prev) =>
        prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const handleRemoveRole = useCallback((index: number) => {
    setRoleAssignments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleAddMember = useCallback(() => {
    // Add from remaining parentMembers not yet assigned
    const unassigned = parentMembers.find((m) => !assignedDids.has(m.did));
    if (unassigned) {
      setRoleAssignments((prev) => [
        ...prev,
        {
          did: unassigned.did,
          displayName: unassigned.displayName,
          role: 'member',
          daoRole: 'member',
          isAgent: false,
        },
      ]);
    }
  }, [parentMembers, assignedDids]);

  const handleAddAgent = useCallback(
    (agent: { did: string; displayName: string; role: string }) => {
      setRoleAssignments((prev) => [
        ...prev,
        {
          did: agent.did,
          displayName: agent.displayName,
          role: 'member',
          daoRole: 'member',
          isAgent: true,
        },
      ]);
      setShowAgentSearch(false);
    },
    [],
  );

  // ── Submit ──

  const handleConfirm = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const input: CreateMissionInput = {
        missionName,
        missionStatement: `${taskStatement} in order to ${purpose}`,
        parentProblemSetId,
        classification: 'unclassified',
        mode: 'training',
        taskIds: tasks.map((t) => t.id),
        taskStatement,
        purpose,
        commandersIntent: commandersIntent || { own: null, parent: null, grandparent: null },
        taskOrganization: inheritedContext?.taskOrganization || {},
        constraints: inheritedContext?.constraints || {},
        ccirs: inheritedContext?.ccirs || {},
        roeReferences: inheritedContext?.roeReferences || [],
        areaOfOperations: inheritedContext?.areaOfOperations || null,
        timeline: inheritedContext?.timeline || {},
        roleAssignments,
      };
      await onConfirm(input);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setLoading(false);
    }
  }, [
    missionName,
    taskStatement,
    purpose,
    parentProblemSetId,
    tasks,
    commandersIntent,
    inheritedContext,
    roleAssignments,
    onConfirm,
    onClose,
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999]">
      <div className="bg-slate-900 border border-slate-600 rounded-lg w-full max-w-3xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <h2 className="text-cyan-400 font-mono text-sm font-bold tracking-wider uppercase">
            Create Tactical Mission
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            &#10005;
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {/* 1. Mission Name */}
          <Section title="Mission Name">
            <input
              type="text"
              value={missionName}
              onChange={(e) => setMissionName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-600 text-slate-300 font-mono text-sm rounded px-3 py-2 focus:border-cyan-500 outline-none"
              placeholder="Enter mission name..."
            />
          </Section>

          {/* 2. Inherited Context Summary */}
          <Section title="Task Statement" source={`From ${parentPsName}`}>
            <p className="text-slate-300 font-mono text-xs leading-relaxed">
              {taskStatement || 'No tasks selected'}
            </p>
          </Section>

          <Section title="Purpose" source={`From ${parentPsName}`}>
            <p className="text-slate-300 font-mono text-xs leading-relaxed">
              {purpose || 'No purpose specified'}
            </p>
          </Section>

          <Section title="Commander's Intent Chain (2-Up)" source="From parent campaign">
            {commandersIntent ? (
              <div className="space-y-2">
                {commandersIntent.grandparent && (
                  <div>
                    <span className="text-amber-400 font-mono text-xs font-bold">
                      Strategic ({commandersIntent.grandparent.psName}):
                    </span>
                    <p className="text-slate-300 font-mono text-xs mt-0.5">
                      End State: {commandersIntent.grandparent.endState}
                    </p>
                    <p className="text-slate-400 font-mono text-xs">
                      Purpose: {commandersIntent.grandparent.purpose}
                    </p>
                  </div>
                )}
                {commandersIntent.parent && (
                  <div>
                    <span className="text-cyan-400 font-mono text-xs font-bold">
                      Operational ({commandersIntent.parent.psName}):
                    </span>
                    <p className="text-slate-300 font-mono text-xs mt-0.5">
                      End State: {commandersIntent.parent.endState}
                    </p>
                    <p className="text-slate-400 font-mono text-xs">
                      Purpose: {commandersIntent.parent.purpose}
                    </p>
                  </div>
                )}
                {commandersIntent.own && (
                  <div>
                    <span className="text-green-400 font-mono text-xs font-bold">
                      Own ({commandersIntent.own.psName}):
                    </span>
                    <p className="text-slate-300 font-mono text-xs mt-0.5">
                      End State: {commandersIntent.own.endState}
                    </p>
                    <p className="text-slate-400 font-mono text-xs">
                      Purpose: {commandersIntent.own.purpose}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-slate-500 font-mono text-xs italic">
                Commander&apos;s intent will be resolved at creation time
              </p>
            )}
          </Section>

          <Section title="Task Organization" source={`From ${parentPsName}`}>
            <p className="text-slate-300 font-mono text-xs">
              {inheritedContext?.taskOrganization
                ? JSON.stringify(inheritedContext.taskOrganization, null, 2).slice(0, 200)
                : 'Inherited at creation'}
            </p>
          </Section>

          <Section title="Constraints & ROE" source="From parent campaign">
            <div className="space-y-1">
              <p className="text-slate-300 font-mono text-xs">
                Constraints: {inheritedContext?.constraints
                  ? JSON.stringify(inheritedContext.constraints)
                  : 'Inherited at creation'}
              </p>
              <p className="text-slate-300 font-mono text-xs">
                ROE: {inheritedContext?.roeReferences?.join(', ') || 'Inherited at creation'}
              </p>
            </div>
          </Section>

          <Section title="CCIRs" source={`From ${parentPsName}`}>
            <p className="text-slate-300 font-mono text-xs">
              {inheritedContext?.ccirs
                ? JSON.stringify(inheritedContext.ccirs)
                : 'Inherited at creation'}
            </p>
          </Section>

          <Section title="AO Boundaries" source="From parent campaign">
            <p className="text-slate-300 font-mono text-xs">
              {inheritedContext?.areaOfOperations
                ? `GeoJSON: ${inheritedContext.areaOfOperations.type}`
                : 'Inherited at creation'}
            </p>
          </Section>

          <Section title="Timeline" source={`From ${parentPsName}`}>
            <p className="text-slate-300 font-mono text-xs">
              {inheritedContext?.timeline
                ? JSON.stringify(inheritedContext.timeline)
                : 'Inherited at creation'}
            </p>
          </Section>

          {/* 3. Assigned Unit */}
          <Section title="Assigned Unit">
            <p className="text-slate-300 font-mono text-xs">
              {tasks[0]?.unitName || group.assignedUnitId || 'Not assigned'}
            </p>
          </Section>

          {/* 4. Role Assignments */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-slate-400 font-mono text-xs font-bold tracking-wider uppercase">
                Role Assignments
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={handleAddMember}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-xs rounded transition-colors"
                >
                  + Add Member
                </button>
                <button
                  onClick={() => setShowAgentSearch(!showAgentSearch)}
                  className="px-2 py-1 bg-purple-900/50 hover:bg-purple-800/50 text-purple-300 border border-purple-700/50 font-mono text-xs rounded transition-colors"
                >
                  + Add AI Agent
                </button>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left text-slate-500 font-mono text-xs py-2 px-3">Member</th>
                    <th className="text-left text-slate-500 font-mono text-xs py-2 px-3">Role</th>
                    <th className="text-left text-slate-500 font-mono text-xs py-2 px-3">DAO Role</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody className="px-3">
                  {roleAssignments.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center">
                        <p className="text-slate-600 font-mono text-xs">
                          No members assigned. Add members or AI agents above.
                        </p>
                      </td>
                    </tr>
                  )}
                  {roleAssignments.map((ra, i) => (
                    <RoleRow
                      key={`${ra.did}-${i}`}
                      assignment={ra}
                      index={i}
                      onUpdate={handleUpdateRole}
                      onRemove={handleRemoveRole}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {showAgentSearch && (
              <AgentSearchPanel
                agents={availableAgents}
                assignedDids={assignedDids}
                onSelect={handleAddAgent}
                onClose={() => setShowAgentSearch(false)}
              />
            )}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="px-4 pb-2">
            <p className="text-red-400 font-mono text-xs">{error}</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-700">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 font-mono text-xs rounded transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || !missionName.trim()}
            className={`
              px-4 py-2 rounded font-mono text-xs font-bold transition-colors
              ${loading || !missionName.trim()
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-cyan-700 hover:bg-cyan-600 text-white'}
            `}
          >
            {loading ? 'Creating...' : 'Create Tactical Mission'}
          </button>
        </div>
      </div>
    </div>
  );
};
