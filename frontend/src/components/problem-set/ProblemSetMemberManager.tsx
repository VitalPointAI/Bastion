/**
 * Problem SetMemberManager
 *
 * Member management component for problem set admins.
 * - Lists all problem set members with role, status, join date
 * - Actions: change role, suspend, unsuspend, remove (permission gated)
 * - Confirmation dialogs for all destructive actions
 * - Search/filter by name or DID
 * - AI agent badge for agent DIDs
 * - Cannot act on own row
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  problemSetService,
  type ProblemSetMemberDetail,
  type ProblemSetRole,
} from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';
import { useProblemSet } from '../../context/ProblemSetContext';
import { ProblemSetInviteModal } from './ProblemSetInviteModal';
import { MemberDetailModal } from './MemberDetailModal';
import { OrbatModal } from './OrbatModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProblemSetMemberManagerProps {
  problemSetId: string;
}

type ConfirmAction =
  | { type: 'change_role'; member: ProblemSetMemberDetail; roleId: string }
  | { type: 'suspend'; member: ProblemSetMemberDetail }
  | { type: 'unsuspend'; member: ProblemSetMemberDetail }
  | { type: 'remove'; member: ProblemSetMemberDetail };

// ─── Agent DID detection ─────────────────────────────────────────────────────

/** Returns true if this DID belongs to an AI agent (heuristic). */
function isAgentDid(did: string): boolean {
  return (
    did.includes('agent') ||
    did.includes('bot') ||
    did.includes('ai.') ||
    did.endsWith('.agent.near') ||
    did.includes(':agent:')
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function shortenDid(did: string): string {
  if (did.length <= 30) return did;
  return did.slice(0, 14) + '...' + did.slice(-12);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProblemSetMemberManager({ problemSetId }: ProblemSetMemberManagerProps) {
  const { userDID } = useUser();
  const { userRoleInActive } = useProblemSet();

  // Data
  const [members, setMembers] = useState<ProblemSetMemberDetail[]>([]);
  const [roles, setRoles] = useState<ProblemSetRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // UI state
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [quickInviteLink, setQuickInviteLink] = useState<string | null>(null);
  const [quickInviteCopied, setQuickInviteCopied] = useState(false);
  const [quickInviteLoading, setQuickInviteLoading] = useState(false);

  // Member detail modal
  const [detailMember, setDetailMember] = useState<ProblemSetMemberDetail | null>(null);

  // ORBAT modal
  const [showOrbat, setShowOrbat] = useState(false);

  // ─── Load data ─────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!userDID) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [memberResult, roleResult] = await Promise.all([
        problemSetService.listMembers(problemSetId, userDID),
        problemSetService.listRoles(problemSetId, userDID),
      ]);
      setMembers(memberResult);
      setRoles(roleResult);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load members.');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, userDID]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Derived values ────────────────────────────────────────────────────────

  const canManageMembers = useMemo(() => {
    if (!userRoleInActive) return false;
    // Check if current user's role has manage_members permission
    const myRole = roles.find(
      (r) =>
        r.militaryLabel === userRoleInActive ||
        r.daoRoleName === userRoleInActive
    );
    return myRole?.permissions.includes('manage_members') ?? false;
  }, [roles, userRoleInActive]);

  // Member counts
  const activeCount = members.filter((m) => m.status === 'active').length;
  const suspendedCount = members.filter((m) => m.status === 'suspended').length;

  // Sorted: commander/highest-role first, then alphabetical by DID
  const sortedMembers = useMemo(() => {
    return [...members].sort((a, b) => {
      // Commander role first
      const aIsCommander = a.role.toLowerCase().includes('commander');
      const bIsCommander = b.role.toLowerCase().includes('commander');
      if (aIsCommander && !bIsCommander) return -1;
      if (!aIsCommander && bIsCommander) return 1;
      return a.userDid.localeCompare(b.userDid);
    });
  }, [members]);

  // Filtered by search
  const filteredMembers = useMemo(() => {
    if (!search.trim()) return sortedMembers;
    const q = search.toLowerCase();
    return sortedMembers.filter(
      (m) =>
        m.userDid.toLowerCase().includes(q) ||
        (m.displayName?.toLowerCase().includes(q) ?? false) ||
        m.role.toLowerCase().includes(q) ||
        m.daoRole.toLowerCase().includes(q)
    );
  }, [sortedMembers, search]);

  // ─── Role permission filtering ─────────────────────────────────────────────

  /**
   * Returns roles the current user is allowed to assign (at or below their own level).
   * Falls back to all roles if we can't determine level.
   */
  const assignableRoles = useMemo(() => {
    if (roles.length === 0) return [];
    if (!userRoleInActive) return roles;

    const myRoleIndex = roles.findIndex(
      (r) =>
        r.militaryLabel === userRoleInActive ||
        r.daoRoleName === userRoleInActive
    );
    if (myRoleIndex === -1) return roles;
    // Return roles from myRoleIndex onward (equal or lower rank)
    return roles.slice(myRoleIndex);
  }, [roles, userRoleInActive]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const handleConfirmedAction = async () => {
    if (!confirm || !userDID) return;
    const { member } = confirm;
    setActionLoading(member.userDid);
    setActionError(null);

    try {
      if (confirm.type === 'change_role') {
        const newRole = roles.find((r) => r.id === confirm.roleId);
        if (!newRole) throw new Error('Invalid role selected.');
        await problemSetService.changeRole(
          problemSetId,
          member.userDid,
          newRole.militaryLabel,
          newRole.daoRoleName,
          userDID
        );
      } else if (confirm.type === 'suspend') {
        await problemSetService.suspendMember(problemSetId, member.userDid, userDID);
      } else if (confirm.type === 'unsuspend') {
        await problemSetService.unsuspendMember(problemSetId, member.userDid, userDID);
      } else if (confirm.type === 'remove') {
        await problemSetService.removeMember(problemSetId, member.userDid, userDID);
      }
      setConfirm(null);
      await loadData();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="ml-3 text-gray-400 text-sm">Loading members...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-md px-4 py-3">
        {loadError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header: counts + invite actions + search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-gray-400">
            <span className="text-white font-medium">{members.length}</span> members
            &nbsp;&middot;&nbsp;
            <span className="text-green-400">{activeCount} active</span>
            {suspendedCount > 0 && (
              <>
                &nbsp;&middot;&nbsp;
                <span className="text-yellow-400">{suspendedCount} suspended</span>
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            {/* ORBAT */}
            <button
              onClick={() => setShowOrbat(true)}
              className="px-3 py-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-800 rounded transition-colors flex items-center gap-1"
              title="View organizational breakdown"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
              </svg>
              ORBAT
            </button>
            {/* Quick invite */}
            {quickInviteLink ? (
              <div className="flex items-center gap-1 bg-gray-800 border border-gray-600 rounded px-2 py-1">
                <code className="text-xs text-blue-300 font-mono">{quickInviteLink}</code>
                <button
                  onClick={() => {
                    void navigator.clipboard.writeText(`${window.location.origin}/join/${quickInviteLink}`);
                    setQuickInviteCopied(true);
                    setTimeout(() => setQuickInviteCopied(false), 2000);
                  }}
                  className="px-1.5 py-0.5 text-xs text-green-400 hover:text-green-300 transition-colors"
                >
                  {quickInviteCopied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={() => setQuickInviteLink(null)}
                  className="text-gray-500 hover:text-gray-300 text-xs ml-1"
                >
                  &times;
                </button>
              </div>
            ) : (
              <button
                onClick={async () => {
                  if (!problemSetId || !userDID || quickInviteLoading) return;
                  setQuickInviteLoading(true);
                  try {
                    const result = await problemSetService.createInvite(
                      problemSetId,
                      'member',
                      'member',
                      userDID,
                      { expiresInHours: 168 },
                    );
                    const r = result as unknown as Record<string, unknown>;
                    const shortCode = (r.shortCode as string | undefined)
                      ?? ((r.invite as Record<string, unknown> | undefined)?.shortCode as string | undefined);
                    if (shortCode) {
                      setQuickInviteLink(shortCode);
                    }
                  } catch {
                    setShowInviteModal(true);
                  } finally {
                    setQuickInviteLoading(false);
                  }
                }}
                disabled={quickInviteLoading}
                className="px-3 py-1.5 text-xs font-medium text-green-400 hover:text-green-300 bg-green-900/20 hover:bg-green-900/40 border border-green-800 rounded transition-colors disabled:opacity-50"
                title="Create a quick invite link anyone can use to join as a member"
              >
                {quickInviteLoading ? 'Creating...' : 'Quick Invite'}
              </button>
            )}
            {/* Full invite */}
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-3 py-1.5 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-900/20 hover:bg-blue-900/40 border border-blue-800 rounded transition-colors"
              title="Create a targeted invite with specific role"
            >
              Invite
            </button>
          </div>
        </div>
        <input
          type="text"
          className="bg-gray-800 border border-gray-600 text-white text-sm rounded-md px-3 py-1.5 w-full focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
          placeholder="Search by name, DID, or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-red-900/30 border border-red-700 text-red-300 text-sm rounded-md px-4 py-2">
          {actionError}
          <button
            className="ml-2 text-red-400 hover:text-red-200"
            onClick={() => setActionError(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Member table */}
      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-left text-gray-400 text-xs uppercase tracking-wider">
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">DAO Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              {canManageMembers && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredMembers.length === 0 ? (
              <tr>
                <td
                  colSpan={canManageMembers ? 6 : 5}
                  className="px-4 py-6 text-center text-gray-500"
                >
                  No members found.
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const isSelf = member.userDid === userDID;
                const isSuspended = member.status === 'suspended';
                const isAgent = isAgentDid(member.userDid);
                const isProcessing = actionLoading === member.userDid;

                return (
                  <tr
                    key={member.id}
                    className={`bg-gray-900 hover:bg-gray-800/60 transition-colors cursor-pointer ${
                      isSuspended ? 'opacity-60' : ''
                    }`}
                    onClick={() => setDetailMember(member)}
                    title="Click to view member details"
                  >
                    {/* Name + DID + badges */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-gray-200 text-sm font-medium"
                          title={member.userDid}
                        >
                          {member.displayName || shortenDid(member.userDid)}
                        </span>
                        {member.displayName && (
                          <span className="text-gray-500 font-mono text-xs">
                            {shortenDid(member.userDid)}
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-xs bg-blue-800/40 border border-blue-700 text-blue-300 rounded px-1.5 py-0.5">
                            You
                          </span>
                        )}
                        {isAgent && (
                          <span className="text-xs bg-violet-800/40 border border-violet-700 text-violet-300 rounded px-1.5 py-0.5">
                            AI Agent
                          </span>
                        )}
                        {isSuspended && (
                          <span className="text-xs bg-yellow-900/40 border border-yellow-700 text-yellow-300 rounded px-1.5 py-0.5">
                            Suspended
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Role (military label) */}
                    <td className="px-4 py-3 text-gray-300">{member.role}</td>

                    {/* DAO role */}
                    <td className="px-4 py-3 text-gray-500">{member.daoRole}</td>

                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs font-medium ${
                          isSuspended ? 'text-yellow-400' : 'text-green-400'
                        }`}
                      >
                        {member.status}
                      </span>
                    </td>

                    {/* Joined */}
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {formatDate(member.joinedAt)}
                    </td>

                    {/* Actions */}
                    {canManageMembers && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {!isSelf && (
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {/* Change Role dropdown */}
                            <select
                              className="bg-gray-800 border border-gray-600 text-gray-300 text-xs rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                              defaultValue=""
                              disabled={isProcessing}
                              onChange={(e) => {
                                if (!e.target.value) return;
                                setConfirm({
                                  type: 'change_role',
                                  member,
                                  roleId: e.target.value,
                                });
                                e.target.value = '';
                              }}
                              title="Change role"
                            >
                              <option value="">Change role...</option>
                              {assignableRoles.map((role) => (
                                <option key={role.id} value={role.id}>
                                  {role.militaryLabel}
                                </option>
                              ))}
                            </select>

                            {/* Suspend / Unsuspend */}
                            {isSuspended ? (
                              <button
                                className="px-2 py-1 text-xs text-green-300 hover:text-green-200 bg-green-900/30 hover:bg-green-900/50 border border-green-700 rounded transition-colors disabled:opacity-50"
                                onClick={() => setConfirm({ type: 'unsuspend', member })}
                                disabled={isProcessing}
                              >
                                Unsuspend
                              </button>
                            ) : (
                              <button
                                className="px-2 py-1 text-xs text-yellow-300 hover:text-yellow-200 bg-yellow-900/30 hover:bg-yellow-900/50 border border-yellow-700 rounded transition-colors disabled:opacity-50"
                                onClick={() => setConfirm({ type: 'suspend', member })}
                                disabled={isProcessing}
                              >
                                Suspend
                              </button>
                            )}

                            {/* Remove */}
                            <button
                              className="px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 border border-red-800 rounded transition-colors disabled:opacity-50"
                              onClick={() => setConfirm({ type: 'remove', member })}
                              disabled={isProcessing}
                            >
                              {isProcessing ? '...' : 'Remove'}
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation dialog */}
      {confirm && (
        <ConfirmDialog
          action={confirm}
          roles={roles}
          onConfirm={() => { void handleConfirmedAction(); }}
          onCancel={() => {
            setConfirm(null);
            setActionError(null);
          }}
          loading={actionLoading !== null}
        />
      )}

      {/* Invite modal */}
      {showInviteModal && (
        <ProblemSetInviteModal
          problemSetId={problemSetId}
          problemSetName="Problem Set"
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {/* ORBAT modal */}
      {showOrbat && (
        <OrbatModal
          members={members}
          problemSetId={problemSetId}
          onClose={() => setShowOrbat(false)}
          onSelectMember={(m) => {
            setShowOrbat(false);
            setDetailMember(m);
          }}
        />
      )}

      {/* Member detail modal */}
      {detailMember && (
        <MemberDetailModal
          member={detailMember}
          onClose={() => setDetailMember(null)}
        />
      )}
    </div>
  );
}

// ─── ConfirmDialog ────────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  action: ConfirmAction;
  roles: ProblemSetRole[];
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function ConfirmDialog({ action, roles, onConfirm, onCancel, loading }: ConfirmDialogProps) {
  const did = shortenDid(action.member.userDid);

  let title = '';
  let body = '';
  let confirmLabel = 'Confirm';
  let confirmClass = 'bg-blue-600 hover:bg-blue-700';

  if (action.type === 'change_role') {
    const newRole = roles.find((r) => r.id === action.roleId);
    title = 'Change Role';
    body = `Change ${did}'s role to "${newRole?.militaryLabel ?? '—'}"?`;
    confirmLabel = 'Change Role';
  } else if (action.type === 'suspend') {
    title = 'Suspend Member';
    body = `Suspend ${did}? They will lose access to the problem set until unsuspended.`;
    confirmLabel = 'Suspend';
    confirmClass = 'bg-yellow-600 hover:bg-yellow-700';
  } else if (action.type === 'unsuspend') {
    title = 'Unsuspend Member';
    body = `Restore access for ${did}?`;
    confirmLabel = 'Unsuspend';
    confirmClass = 'bg-green-700 hover:bg-green-800';
  } else if (action.type === 'remove') {
    title = 'Remove Member';
    body = `Remove ${did} from the problem set? This action cannot be undone.`;
    confirmLabel = 'Remove';
    confirmClass = 'bg-red-700 hover:bg-red-800';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-sm mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-white font-semibold text-base mb-2">{title}</h3>
        <p className="text-gray-400 text-sm mb-5">{body}</p>
        <div className="flex justify-end gap-3">
          <button
            className="px-4 py-2 text-sm text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`px-4 py-2 text-sm text-white font-medium rounded-md transition-colors disabled:opacity-50 ${confirmClass}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
