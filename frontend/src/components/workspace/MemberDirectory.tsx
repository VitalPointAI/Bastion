/**
 * MemberDirectory
 *
 * Compartment-filtered member list for workspace members.
 * Commanders/XOs see all members. Staff see members in their
 * compartment(s) plus unrestricted members. Observers see only
 * members flagged as observer-visible.
 *
 * Phase 19 Plan 08: Org Tree + Member Directory + Compartment Manager
 */

import { useEffect, useState, useMemo } from 'react';
import {
  workspaceService,
  type WorkspaceMemberDetail,
  type WorkspaceCompartment,
} from '../../lib/workspace-service';
import { useWorkspace } from '../../context/WorkspaceContext';
import { useUser } from '../../context/UserContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMANDER_ROLES = ['commander', 'xo', 'team_lead'] as const;
const OBSERVER_ROLE = 'observer';

/** Military role display labels */
const ROLE_LABELS: Record<string, string> = {
  commander: 'Commander',
  xo: 'Executive Officer',
  s1: 'S1 – Personnel',
  s2: 'S2 – Intelligence',
  s3: 'S3 – Operations',
  s4: 'S4 – Logistics',
  s5: 'S5 – Plans',
  s6: 'S6 – Comms',
  s7: 'S7 – Training',
  s8: 'S8 – Finance',
  s9: 'S9 – Civil Affairs',
  team_lead: 'Team Lead',
  member: 'Member',
  observer: 'Observer',
};

/** Sort priority for roles — lower is higher in list */
const ROLE_SORT_ORDER: Record<string, number> = {
  commander: 0,
  xo: 1,
  team_lead: 2,
  s3: 3,
  s2: 4,
  s1: 5,
  s4: 6,
  s5: 7,
  s6: 8,
  s7: 9,
  s8: 10,
  s9: 11,
  member: 90,
  observer: 99,
};

// ─── Props ─────────────────────────────────────────────────────────────────────

interface MemberDirectoryProps {
  workspaceId: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleSortKey(role: string): number {
  return ROLE_SORT_ORDER[role] ?? 50;
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

function formatDid(did: string): string {
  // Show last 12 chars of DID for brevity
  if (did.startsWith('did:near:')) {
    const account = did.replace('did:near:', '');
    if (account.length > 20) {
      return `${account.slice(0, 10)}…${account.slice(-8)}`;
    }
    return account;
  }
  return did.length > 24 ? `${did.slice(0, 12)}…${did.slice(-8)}` : did;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active';
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
        isActive
          ? 'bg-green-900/40 text-green-400 border border-green-800'
          : 'bg-red-900/40 text-red-400 border border-red-800'
      }`}
    >
      {isActive ? 'Active' : 'Suspended'}
    </span>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

interface MemberCardProps {
  member: WorkspaceMemberDetail;
  compartments: WorkspaceCompartment[];
  memberCompartmentIds: string[];
}

function MemberCard({ member, compartments, memberCompartmentIds }: MemberCardProps) {
  const memberCompartments = compartments.filter((c) => memberCompartmentIds.includes(c.id));

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs text-gray-400 truncate" title={member.userDid}>
            {formatDid(member.userDid)}
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-200">
              {getRoleLabel(member.role)}
            </span>
            <span className="text-xs text-gray-500">·</span>
            <span className="text-xs text-gray-500 uppercase tracking-wide">
              DAO: {member.daoRole}
            </span>
          </div>
        </div>
        <StatusBadge status={member.status} />
      </div>

      {/* Compartments */}
      {memberCompartments.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {memberCompartments.map((c) => (
            <span
              key={c.id}
              className="inline-block px-1.5 py-0.5 bg-indigo-900/40 border border-indigo-800 rounded text-xs text-indigo-300"
              title={c.description ?? undefined}
            >
              {c.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="mt-2 text-xs text-gray-600">
        Joined {formatDate(member.joinedAt)}
      </div>
    </div>
  );
}

// ─── MemberDirectory Component ────────────────────────────────────────────────

export function MemberDirectory({ workspaceId }: MemberDirectoryProps) {
  const { userDID } = useUser();
  const { userRoleInActive } = useWorkspace();

  const [members, setMembers] = useState<WorkspaceMemberDetail[]>([]);
  const [compartments, setCompartments] = useState<WorkspaceCompartment[]>([]);
  const [myCompartmentIds, setMyCompartmentIds] = useState<string[]>([]);
  const [memberCompartmentMap, setMemberCompartmentMap] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Filter state ──────────────────────────────────────────────────────────

  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended'>('active');

  // ─── Load data ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!workspaceId || !userDID) return;
    setLoading(true);
    setError(null);

    const loadAll = async () => {
      const [allMembers, allCompartments, myCompIds] = await Promise.all([
        workspaceService.listMembers(workspaceId, userDID),
        workspaceService.listCompartments(workspaceId, userDID).catch(() => [] as WorkspaceCompartment[]),
        workspaceService.getMyCompartments(workspaceId, userDID).catch(() => [] as string[]),
      ]);

      setMembers(allMembers);
      setCompartments(allCompartments);
      setMyCompartmentIds(myCompIds);

      // Build compartment map for each member (run in parallel)
      const compMap: Record<string, string[]> = {};
      await Promise.all(
        allMembers.map(async (m) => {
          const cids = await workspaceService
            .getMyCompartments(workspaceId, m.userDid)
            .catch(() => [] as string[]);
          compMap[m.userDid] = cids;
        }),
      );
      setMemberCompartmentMap(compMap);
    };

    loadAll()
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load members');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspaceId, userDID]);

  // ─── Need-to-know filter logic ─────────────────────────────────────────────

  const visibleMembers = useMemo(() => {
    const role = userRoleInActive ?? '';

    // Commanders and XOs see ALL members
    if (COMMANDER_ROLES.includes(role as (typeof COMMANDER_ROLES)[number])) {
      return members;
    }

    // Observers see only other observers or commander/xo (public roles)
    if (role === OBSERVER_ROLE) {
      return members.filter(
        (m) =>
          m.role === OBSERVER_ROLE ||
          COMMANDER_ROLES.includes(m.role as (typeof COMMANDER_ROLES)[number]),
      );
    }

    // Staff see: members in their own compartment(s) + members with no compartments assigned
    return members.filter((m) => {
      const mCompIds = memberCompartmentMap[m.userDid] ?? [];
      const memberHasNoCompartments = mCompIds.length === 0;
      const sharesCompartment = mCompIds.some((cid) => myCompartmentIds.includes(cid));
      return memberHasNoCompartments || sharesCompartment;
    });
  }, [members, memberCompartmentMap, myCompartmentIds, userRoleInActive]);

  // ─── UI filters ───────────────────────────────────────────────────────────

  const filteredMembers = useMemo(() => {
    return visibleMembers
      .filter((m) => {
        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          return m.userDid.toLowerCase().includes(q) || m.role.toLowerCase().includes(q);
        }
        return true;
      })
      .filter((m) => roleFilter === 'all' || m.role === roleFilter)
      .filter((m) => statusFilter === 'all' || m.status === statusFilter)
      .sort((a, b) => getRoleSortKey(a.role) - getRoleSortKey(b.role));
  }, [visibleMembers, searchQuery, roleFilter, statusFilter]);

  // ─── Unique roles for filter dropdown ─────────────────────────────────────

  const availableRoles = useMemo(() => {
    const roles = [...new Set(visibleMembers.map((m) => m.role))].sort(
      (a, b) => getRoleSortKey(a) - getRoleSortKey(b),
    );
    return roles;
  }, [visibleMembers]);

  const isCommander = COMMANDER_ROLES.includes(
    (userRoleInActive ?? '') as (typeof COMMANDER_ROLES)[number],
  );

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-800 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400 text-sm p-4 bg-red-900/20 rounded-lg border border-red-800">
        Failed to load members: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compartment filtering notice for non-commanders */}
      {!isCommander && myCompartmentIds.length > 0 && (
        <div className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-800/50 rounded px-3 py-2">
          Showing members based on need-to-know access. You are in{' '}
          {myCompartmentIds.length} compartment{myCompartmentIds.length !== 1 ? 's' : ''}.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by DID or role..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500"
          />
        </div>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
        >
          <option value="all">All roles</option>
          {availableRoles.map((r) => (
            <option key={r} value={r}>
              {getRoleLabel(r)}
            </option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'suspended')}
          className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-gray-500"
        >
          <option value="active">Active only</option>
          <option value="all">All statuses</option>
          <option value="suspended">Suspended only</option>
        </select>
      </div>

      {/* Member count */}
      <div className="text-xs text-gray-500">
        {filteredMembers.length} of {visibleMembers.length} member
        {visibleMembers.length !== 1 ? 's' : ''} visible
        {members.length !== visibleMembers.length && (
          <span className="ml-1">(compartment-filtered)</span>
        )}
      </div>

      {/* Grid / list */}
      {filteredMembers.length === 0 ? (
        <div className="text-center py-12 text-gray-600 text-sm">
          No members match the current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredMembers.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              compartments={compartments}
              memberCompartmentIds={memberCompartmentMap[member.userDid] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default MemberDirectory;
