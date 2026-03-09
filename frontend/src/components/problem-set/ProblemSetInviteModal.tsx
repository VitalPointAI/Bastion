/**
 * ProblemSetInviteModal
 *
 * Modal for creating problem set invite links and managing pending invites.
 * - Role selection from problem set roles
 * - Target type: Anyone / Specific DID / Specific Email
 * - Expiration picker
 * - Displays invite link with copy button
 * - Lists pending invites with Cancel and Approve actions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  problemSetService,
  type ProblemSetRole,
  type ProblemSetInviteDetail,
} from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProblemSetInviteModalProps {
  problemSetId: string;
  problemSetName: string;
  onClose: () => void;
}

type TargetType = 'anyone' | 'did' | 'email';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatExpiry(expiresAt: string): string {
  const date = new Date(expiresAt);
  return date.toLocaleString();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProblemSetInviteModal({
  problemSetId,
  problemSetName,
  onClose,
}: ProblemSetInviteModalProps) {
  const { userDID } = useUser();

  // Form state
  const [roles, setRoles] = useState<ProblemSetRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [targetType, setTargetType] = useState<TargetType>('anyone');
  const [targetDid, setTargetDid] = useState('');
  const [targetEmail, setTargetEmail] = useState('');
  const [expiresInHours, setExpiresInHours] = useState(72);

  // Status state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Pending invites
  const [pendingInvites, setPendingInvites] = useState<ProblemSetInviteDetail[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // ─── Load roles and pending invites ─────────────────────────────────────────

  const loadRoles = useCallback(async () => {
    if (!userDID) return;
    try {
      const result = await problemSetService.listRoles(problemSetId, userDID);
      setRoles(result);
      if (result.length > 0) {
        setSelectedRoleId(result[0].id);
      }
    } catch {
      // Silently fail — roles may not be configured
    }
  }, [problemSetId, userDID]);

  const loadPendingInvites = useCallback(async () => {
    if (!userDID) return;
    setPendingLoading(true);
    try {
      const result = await problemSetService.listPendingInvites(problemSetId, userDID);
      setPendingInvites(result);
    } catch {
      // Silently fail
    } finally {
      setPendingLoading(false);
    }
  }, [problemSetId, userDID]);

  useEffect(() => {
    void loadRoles();
    void loadPendingInvites();
  }, [loadRoles, loadPendingInvites]);

  // ─── Form submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDID) return;
    setError(null);

    const selectedRole = roles.find((r) => r.id === selectedRoleId);
    if (!selectedRole) {
      setError('Please select a role.');
      return;
    }

    if (targetType === 'did' && !targetDid.trim()) {
      setError('Please enter a DID (e.g. did:near:alice.near).');
      return;
    }
    if (targetType === 'email' && !targetEmail.trim()) {
      setError('Please enter an email address.');
      return;
    }

    setLoading(true);
    try {
      const options: { inviteeEmail?: string; inviteeDid?: string; expiresInHours?: number } = {
        expiresInHours,
      };
      if (targetType === 'did') options.inviteeDid = targetDid.trim();
      if (targetType === 'email') options.inviteeEmail = targetEmail.trim();

      const result = await problemSetService.createInvite(
        problemSetId,
        selectedRole.militaryLabel,
        selectedRole.daoRoleName,
        userDID,
        options
      );

      // Prefer short code link, fall back to token link
      const r = result as unknown as Record<string, unknown>;
      const shortCode = (r.shortCode as string | undefined)
        ?? ((r.invite as Record<string, unknown> | undefined)?.shortCode as string | undefined);
      const rawToken = (r.rawToken as string | undefined) ?? (r.token as string | undefined);

      const link = shortCode
        ? `${window.location.origin}/join/${shortCode}`
        : `${window.location.origin}/problem-set/invite/${rawToken ?? ''}`;
      setCreatedLink(link);
      void loadPendingInvites();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!createdLink) return;
    void navigator.clipboard.writeText(createdLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setCreatedLink(null);
    setTargetDid('');
    setTargetEmail('');
    setTargetType('anyone');
    setError(null);
    setCopied(false);
    if (roles.length > 0) setSelectedRoleId(roles[0].id);
  };

  // ─── Pending invite actions ──────────────────────────────────────────────────

  const handleCancelInvite = async (inviteId: string) => {
    if (!userDID) return;
    setActionLoading(inviteId);
    try {
      await problemSetService.cancelInvite(problemSetId, inviteId, userDID);
      await loadPendingInvites();
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveInvite = async (inviteId: string) => {
    if (!userDID) return;
    setActionLoading(inviteId);
    try {
      await problemSetService.approveInvite(problemSetId, inviteId, userDID);
      await loadPendingInvites();
    } catch {
      // Silently fail
    } finally {
      setActionLoading(null);
    }
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            Invite to {problemSetName}
          </h2>
          <button
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          {!createdLink ? (
            <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
              {error && (
                <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded-md px-4 py-2">
                  {error}
                </div>
              )}

              {/* Role selection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Role
                </label>
                {roles.length === 0 ? (
                  <p className="text-sm text-gray-500">No roles configured for this problemSet.</p>
                ) : (
                  <select
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={selectedRoleId}
                    onChange={(e) => setSelectedRoleId(e.target.value)}
                    disabled={loading}
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.militaryLabel} ({role.daoRoleName})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Target type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Invite Target
                </label>
                <div className="flex gap-3">
                  {(['anyone', 'did', 'email'] as TargetType[]).map((type) => (
                    <label
                      key={type}
                      className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="targetType"
                        value={type}
                        checked={targetType === type}
                        onChange={() => setTargetType(type)}
                        disabled={loading}
                        className="accent-blue-500"
                      />
                      {type === 'anyone' && 'Anyone with link'}
                      {type === 'did' && 'Specific DID'}
                      {type === 'email' && 'Specific Email'}
                    </label>
                  ))}
                </div>
              </div>

              {/* Conditional target input */}
              {targetType === 'did' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    DID
                  </label>
                  <input
                    type="text"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                    value={targetDid}
                    onChange={(e) => setTargetDid(e.target.value)}
                    placeholder="did:near:alice.near"
                    disabled={loading}
                  />
                </div>
              )}
              {targetType === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500"
                    value={targetEmail}
                    onChange={(e) => setTargetEmail(e.target.value)}
                    placeholder="user@example.com"
                    disabled={loading}
                  />
                </div>
              )}

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Expires In
                </label>
                <select
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(parseInt(e.target.value))}
                  disabled={loading}
                >
                  <option value={24}>24 hours</option>
                  <option value={72}>72 hours (3 days)</option>
                  <option value={168}>7 days</option>
                  <option value={720}>30 days</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors disabled:opacity-50"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50"
                  disabled={loading || roles.length === 0}
                >
                  {loading ? 'Creating...' : 'Create Invite'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-center">
              <div className="w-12 h-12 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto text-green-400 text-xl font-bold">
                &#10003;
              </div>
              <h3 className="text-white font-medium">Invite Created!</h3>
              <p className="text-sm text-gray-400">
                Share this link with the invitee:
              </p>
              <div className="bg-gray-800 border border-gray-600 rounded-md px-4 py-3 text-left">
                <code className="text-xs text-blue-300 break-all">{createdLink}</code>
              </div>
              <div className="flex justify-center gap-3">
                <button
                  className="px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
                  onClick={handleReset}
                >
                  Create Another
                </button>
                <button
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                  onClick={handleCopyLink}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}

          {/* Pending invites */}
          <div className="mt-6 border-t border-gray-700 pt-4">
            <h3 className="text-sm font-medium text-gray-300 mb-3">
              Pending Invites
            </h3>
            {pendingLoading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : pendingInvites.length === 0 ? (
              <p className="text-sm text-gray-500">No pending invites.</p>
            ) : (
              <ul className="space-y-2">
                {pendingInvites.map((invite) => (
                  <li
                    key={invite.id}
                    className="bg-gray-800 border border-gray-700 rounded-md px-4 py-3 flex items-start justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-white font-medium truncate">
                        {invite.inviteeDid ?? invite.inviteeEmail ?? 'Open invite'}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        Role: {invite.role} &middot; Expires: {formatExpiry(invite.expiresAt)}
                      </div>
                      {invite.rawToken && (
                        <div className="text-xs text-yellow-500 mt-0.5">
                          Pending approval
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {invite.rawToken && (
                        <button
                          className="px-2 py-1 text-xs text-green-300 hover:text-green-200 bg-green-900/30 hover:bg-green-900/50 border border-green-700 rounded transition-colors disabled:opacity-50"
                          onClick={() => { void handleApproveInvite(invite.id); }}
                          disabled={actionLoading === invite.id}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        className="px-2 py-1 text-xs text-red-400 hover:text-red-300 bg-red-900/20 hover:bg-red-900/40 border border-red-800 rounded transition-colors disabled:opacity-50"
                        onClick={() => { void handleCancelInvite(invite.id); }}
                        disabled={actionLoading === invite.id}
                      >
                        {actionLoading === invite.id ? '...' : 'Cancel'}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
