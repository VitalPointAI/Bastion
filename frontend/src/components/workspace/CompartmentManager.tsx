/**
 * CompartmentManager
 *
 * Compartment CRUD and member assignment for workspace administrators.
 * Only visible to members with manage_workspace or manage_members permission
 * (Commanders and XOs in practice).
 *
 * Phase 19 Plan 08: Org Tree + Member Directory + Compartment Manager
 */

import { useEffect, useState, useCallback } from 'react';
import {
  workspaceService,
  type WorkspaceCompartment,
  type WorkspaceMemberDetail,
} from '../../lib/workspace-service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const ADMIN_ROLES = ['commander', 'xo', 'team_lead'] as const;

// ─── Props ─────────────────────────────────────────────────────────────────────

interface CompartmentManagerProps {
  workspaceId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDid(did: string): string {
  if (did.startsWith('did:near:')) {
    const account = did.replace('did:near:', '');
    if (account.length > 20) {
      return `${account.slice(0, 10)}…${account.slice(-8)}`;
    }
    return account;
  }
  return did.length > 24 ? `${did.slice(0, 12)}…${did.slice(-8)}` : did;
}

// ─── CompartmentCard ──────────────────────────────────────────────────────────

interface CompartmentCardProps {
  compartment: WorkspaceCompartment & { memberDids: string[] };
  allMembers: WorkspaceMemberDetail[];
  workspaceId: string;
  userDID: string;
  onChanged: () => void;
}

function CompartmentCard({
  compartment,
  allMembers,
  workspaceId,
  userDID,
  onChanged,
}: CompartmentCardProps) {
  const [assigning, setAssigning] = useState(false);
  const [selectedMemberDid, setSelectedMemberDid] = useState('');
  const [loadingAction, setLoadingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const unassignedMembers = allMembers.filter(
    (m) => !compartment.memberDids.includes(m.userDid),
  );

  async function handleAssign() {
    if (!selectedMemberDid) return;
    setLoadingAction(true);
    setActionError(null);
    try {
      await workspaceService.assignMemberToCompartment(
        workspaceId,
        compartment.id,
        selectedMemberDid,
        userDID,
      );
      setSelectedMemberDid('');
      setAssigning(false);
      onChanged();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to assign member');
    } finally {
      setLoadingAction(false);
    }
  }

  async function handleRemove(memberDid: string) {
    setLoadingAction(true);
    setActionError(null);
    try {
      await workspaceService.removeMemberFromCompartment(
        workspaceId,
        compartment.id,
        memberDid,
        userDID,
      );
      onChanged();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setLoadingAction(false);
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span className="font-mono font-bold text-indigo-300 text-sm">{compartment.name}</span>
          {compartment.description && (
            <p className="text-xs text-gray-500 mt-0.5">{compartment.description}</p>
          )}
        </div>
        <span className="text-xs text-gray-600">
          {compartment.memberDids.length} member{compartment.memberDids.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Assigned members list */}
      <div className="mt-3 space-y-1">
        {compartment.memberDids.length === 0 ? (
          <p className="text-xs text-gray-600 italic">No members assigned</p>
        ) : (
          compartment.memberDids.map((did) => (
            <div key={did} className="flex items-center justify-between">
              <span className="font-mono text-xs text-gray-400" title={did}>
                {formatDid(did)}
              </span>
              <button
                type="button"
                onClick={() => void handleRemove(did)}
                disabled={loadingAction}
                className="text-xs text-red-500 hover:text-red-400 disabled:opacity-50 transition-colors"
              >
                Remove
              </button>
            </div>
          ))
        )}
      </div>

      {/* Assign member UI */}
      {assigning ? (
        <div className="mt-3 flex gap-2">
          <select
            value={selectedMemberDid}
            onChange={(e) => setSelectedMemberDid(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none focus:border-indigo-600"
          >
            <option value="">Select member…</option>
            {unassignedMembers.map((m) => (
              <option key={m.userDid} value={m.userDid}>
                {formatDid(m.userDid)} ({m.role})
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleAssign()}
            disabled={!selectedMemberDid || loadingAction}
            className="px-2 py-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 rounded text-xs text-white transition-colors"
          >
            {loadingAction ? '…' : 'Assign'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAssigning(false);
              setSelectedMemberDid('');
            }}
            className="px-2 py-1 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAssigning(true)}
          disabled={unassignedMembers.length === 0}
          className="mt-3 text-xs text-indigo-400 hover:text-indigo-300 disabled:text-gray-700 disabled:cursor-not-allowed transition-colors"
        >
          + Assign member
        </button>
      )}

      {actionError && (
        <p className="mt-2 text-xs text-red-400">{actionError}</p>
      )}
    </div>
  );
}

// ─── CompartmentManager Component ─────────────────────────────────────────────

export function CompartmentManager({ workspaceId }: CompartmentManagerProps) {
  const { userDID } = useUser();
  const { userRoleInActive } = useWorkspace();

  const [compartments, setCompartments] = useState<
    Array<WorkspaceCompartment & { memberDids: string[] }>
  >([]);
  const [allMembers, setAllMembers] = useState<WorkspaceMemberDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create compartment form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Permission check
  const canManage = ADMIN_ROLES.includes(
    (userRoleInActive ?? '') as (typeof ADMIN_ROLES)[number],
  );

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!workspaceId || !userDID) return;
    setLoading(true);
    setError(null);
    try {
      const [comps, members] = await Promise.all([
        workspaceService.listCompartments(workspaceId, userDID),
        workspaceService.listMembers(workspaceId, userDID),
      ]);
      // Enrich compartments with member DIDs
      const enriched = await Promise.all(
        comps.map(async (c) => {
          const memberDids = c.memberDids ?? [];
          return { ...c, memberDids };
        }),
      );
      setCompartments(enriched);
      setAllMembers(members);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load compartments');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userDID]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Create compartment ────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim() || !userDID) return;
    setCreating(true);
    setCreateError(null);
    try {
      await workspaceService.createCompartment(
        workspaceId,
        newName.trim(),
        newDescription.trim() || null,
        userDID,
      );
      setNewName('');
      setNewDescription('');
      setShowCreateForm(false);
      await loadData();
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Failed to create compartment');
    } finally {
      setCreating(false);
    }
  }

  // ─── Delete compartment ────────────────────────────────────────────────────

  async function handleDelete(compartmentId: string, name: string) {
    if (!userDID) return;
    if (!window.confirm(`Delete compartment "${name}"? This will remove all member assignments.`)) {
      return;
    }
    try {
      await workspaceService.deleteCompartment(workspaceId, compartmentId, userDID);
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete compartment');
    }
  }

  // ─── Guard: non-admin ──────────────────────────────────────────────────────

  if (!canManage) {
    return (
      <div className="text-gray-500 text-sm p-4 bg-gray-900/50 rounded-lg border border-gray-800">
        You do not have permission to manage compartments. This feature is available to
        Commanders, XOs, and Team Leads.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        <div className="h-6 w-32 bg-gray-800 rounded" />
        <div className="h-24 bg-gray-800 rounded-lg" />
        <div className="h-24 bg-gray-800 rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm p-4 bg-red-900/20 rounded-lg border border-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-200">Compartments</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Enforce need-to-know access beyond classification. Members only see others in shared
            compartments.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 rounded text-xs text-white font-medium transition-colors"
        >
          + New Compartment
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="bg-gray-900 border border-indigo-800/50 rounded-lg p-4 space-y-3"
        >
          <h4 className="text-xs font-semibold text-indigo-300 uppercase tracking-wide">
            Create Compartment
          </h4>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Name <span className="text-gray-600">(e.g., SIGINT, HUMINT, OP-PLAN-X)</span>
            </label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value.toUpperCase())}
              maxLength={50}
              placeholder="COMPARTMENT-NAME"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Description <span className="text-gray-600">(optional)</span>
            </label>
            <input
              type="text"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              maxLength={200}
              placeholder="Brief description of compartment purpose"
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-indigo-600"
            />
          </div>

          {createError && <p className="text-xs text-red-400">{createError}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={creating || !newName.trim()}
              className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-50 rounded text-xs text-white font-medium transition-colors"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setNewName('');
                setNewDescription('');
                setCreateError(null);
              }}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-xs text-gray-400 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Compartment list */}
      {compartments.length === 0 ? (
        <div className="text-center py-10 text-gray-600 text-sm">
          No compartments yet. Create one to enforce need-to-know access.
        </div>
      ) : (
        <div className="space-y-3">
          {compartments.map((compartment) => (
            <div key={compartment.id} className="relative">
              <CompartmentCard
                compartment={compartment}
                allMembers={allMembers}
                workspaceId={workspaceId}
                userDID={userDID ?? ''}
                onChanged={() => void loadData()}
              />
              {/* Delete button */}
              <button
                type="button"
                onClick={() => void handleDelete(compartment.id, compartment.name)}
                className="absolute top-3 right-3 text-xs text-gray-600 hover:text-red-400 transition-colors"
                title={`Delete ${compartment.name}`}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default CompartmentManager;
