/**
 * SubscriptionManager
 *
 * Panel for managing cross-problem set data subscriptions.
 * Shows outgoing subscriptions (this problem set as subscriber) and
 * incoming subscriptions (this problem set as publisher).
 *
 * Commander/XO required for creating new subscriptions and
 * approving/rejecting incoming requests.
 */

import { useState, useEffect, useCallback } from 'react';
import { problemSetService, type Subscription } from '../../lib/problem-set-service';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';

// ─── Props ────────────────────────────────────────────────────────────────────

interface SubscriptionManagerProps {
  problemSetId: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DATA_TYPE_OPTIONS = ['understand', 'design', 'plan', 'direct', 'cop', 'assess'];

const COMMANDER_ROLES = ['commander', 'xo', 'Commander', 'XO'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  switch (status?.toLowerCase()) {
    case 'approved':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-900/50 text-green-300 border border-green-700/50">
          Active
        </span>
      );
    case 'pending':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-900/50 text-yellow-300 border border-yellow-700/50">
          Awaiting approval
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-900/50 text-red-300 border border-red-700/50">
          Rejected
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-400">
          {status}
        </span>
      );
  }
}

// ─── SubscriptionManager ──────────────────────────────────────────────────────

export function SubscriptionManager({ problemSetId }: SubscriptionManagerProps) {
  const { memberships, userRoleInActive } = useProblemSet();
  const { userDID } = useUser();

  const [outgoing, setOutgoing] = useState<Subscription[]>([]);
  const [incoming, setIncoming] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPublisherId, setSelectedPublisherId] = useState<string>('');
  const [selectedDataTypes, setSelectedDataTypes] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Action loading states
  const [processingId, setProcessingId] = useState<string | null>(null);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const isCommander = userRoleInActive
    ? COMMANDER_ROLES.includes(userRoleInActive)
    : false;

  // Available problem sets for subscription creation (exclude current problem set)
  const availableProblemSets = memberships.filter(
    (m) => m.problemSetId !== problemSetId
  );

  // ─── Load subscriptions ────────────────────────────────────────────────────

  const loadSubscriptions = useCallback(async () => {
    if (!userDID) return;
    setLoading(true);
    setError(null);
    try {
      const { asSubscriber, asPublisher } = await problemSetService.getSubscriptions(
        problemSetId,
        userDID
      );
      setOutgoing(asSubscriber);
      setIncoming(asPublisher);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
    }
  }, [problemSetId, userDID]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  // ─── Action handlers ───────────────────────────────────────────────────────

  const handleApprove = async (subId: string) => {
    if (!userDID) return;
    setProcessingId(subId);
    setActionError(null);
    try {
      await problemSetService.updateSubscriptionStatus(problemSetId, subId, 'approved', userDID);
      await loadSubscriptions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve subscription.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (subId: string) => {
    if (!userDID) return;
    setProcessingId(subId);
    setActionError(null);
    try {
      await problemSetService.updateSubscriptionStatus(problemSetId, subId, 'rejected', userDID);
      await loadSubscriptions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject subscription.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleUnsubscribe = async (subId: string) => {
    if (!userDID) return;
    setProcessingId(subId);
    setActionError(null);
    try {
      await problemSetService.deleteSubscription(problemSetId, subId, userDID);
      await loadSubscriptions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove subscription.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRevoke = async (subId: string) => {
    if (!userDID) return;
    setProcessingId(subId);
    setActionError(null);
    try {
      await problemSetService.updateSubscriptionStatus(problemSetId, subId, 'rejected', userDID);
      await loadSubscriptions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to revoke subscription.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDID || !selectedPublisherId || selectedDataTypes.length === 0) return;
    setCreating(true);
    setActionError(null);
    try {
      await problemSetService.createSubscription(
        problemSetId,
        selectedPublisherId,
        selectedDataTypes,
        userDID
      );
      setShowCreateForm(false);
      setSelectedPublisherId('');
      setSelectedDataTypes([]);
      await loadSubscriptions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to create subscription.');
    } finally {
      setCreating(false);
    }
  };

  const toggleDataType = (type: string) => {
    setSelectedDataTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  // ─── Render helpers ────────────────────────────────────────────────────────

  const renderEmptyState = (label: string) => (
    <p className="text-sm text-gray-500 italic py-3">{label}</p>
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Data Sharing</h2>
        <p className="text-sm text-gray-500">Loading subscriptions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-base font-semibold text-gray-100 mb-4">Data Sharing</h2>
        <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">
          {error}
        </div>
        <button
          className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline"
          onClick={() => { void loadSubscriptions(); }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-100">Data Sharing</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage cross-problem set intelligence subscriptions.
          </p>
        </div>
        {isCommander && !showCreateForm && (
          <button
            className="text-sm px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
            onClick={() => setShowCreateForm(true)}
          >
            Request Subscription
          </button>
        )}
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-red-900/30 border border-red-700/50 rounded p-3 text-sm text-red-300">
          {actionError}
          <button
            className="ml-3 text-xs text-red-400 hover:text-red-300 underline"
            onClick={() => setActionError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <form
          onSubmit={(e) => { void handleCreate(e); }}
          className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 space-y-4"
        >
          <h3 className="text-sm font-semibold text-gray-200">Request New Subscription</h3>

          {/* Problem Set picker */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5">
              Publisher Problem Set
            </label>
            {availableProblemSets.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No other problem sets available.</p>
            ) : (
              <select
                value={selectedPublisherId}
                onChange={(e) => setSelectedPublisherId(e.target.value)}
                required
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">Select problem set...</option>
                {availableProblemSets.map((m) => (
                  <option key={m.problemSetId} value={m.problemSetId}>
                    {m.name} ({m.echelon})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Data types */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">
              Data Types
              <span className="text-gray-500 font-normal ml-1">(select at least one)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {DATA_TYPE_OPTIONS.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-1.5 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDataTypes.includes(type)}
                    onChange={() => toggleDataType(type)}
                    className="text-blue-500"
                  />
                  <span className="text-sm text-gray-300 capitalize">{type}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={creating || !selectedPublisherId || selectedDataTypes.length === 0}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded transition-colors"
            >
              {creating ? 'Requesting...' : 'Submit Request'}
            </button>
            <button
              type="button"
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-gray-200 text-sm rounded transition-colors"
              onClick={() => {
                setShowCreateForm(false);
                setSelectedPublisherId('');
                setSelectedDataTypes([]);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Outgoing (as subscriber) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
          Outgoing Subscriptions
          <span className="text-xs font-normal text-gray-500">
            (data you receive from others)
          </span>
        </h3>

        {outgoing.length === 0 ? (
          renderEmptyState('No outgoing subscriptions. Request access to another problem set\'s data above.')
        ) : (
          <div className="space-y-2">
            {outgoing.map((sub) => {
              const publisherName = memberships.find(
                (m) => m.problemSetId === sub.publisherProblemSetId
              )?.name ?? sub.publisherProblemSetId;

              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-4 bg-gray-700/50 border border-gray-600/50 rounded-lg px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 font-medium truncate">{publisherName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {sub.dataTypes.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={sub.approvalStatus} />

                    {sub.approvalStatus === 'approved' && isCommander && (
                      <button
                        className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700/50 text-red-300 rounded transition-colors disabled:opacity-50"
                        onClick={() => { void handleUnsubscribe(sub.id); }}
                        disabled={processingId === sub.id}
                      >
                        {processingId === sub.id ? '...' : 'Unsubscribe'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-700" />

      {/* Incoming (as publisher) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
          Incoming Requests
          <span className="text-xs font-normal text-gray-500">
            (others requesting your problem set's data)
          </span>
        </h3>

        {incoming.length === 0 ? (
          renderEmptyState('No incoming subscription requests.')
        ) : (
          <div className="space-y-2">
            {incoming.map((sub) => {
              const subscriberName = memberships.find(
                (m) => m.problemSetId === sub.subscriberProblemSetId
              )?.name ?? sub.subscriberProblemSetId;

              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-4 bg-gray-700/50 border border-gray-600/50 rounded-lg px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-200 font-medium truncate">{subscriberName}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Requesting: {sub.dataTypes.join(', ')}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={sub.approvalStatus} />

                    {sub.approvalStatus === 'pending' && isCommander && (
                      <>
                        <button
                          className="text-xs px-2 py-1 bg-green-700 hover:bg-green-600 text-white rounded transition-colors disabled:opacity-50"
                          onClick={() => { void handleApprove(sub.id); }}
                          disabled={processingId === sub.id}
                        >
                          {processingId === sub.id ? '...' : 'Approve'}
                        </button>
                        <button
                          className="text-xs px-2 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700/50 text-red-300 rounded transition-colors disabled:opacity-50"
                          onClick={() => { void handleReject(sub.id); }}
                          disabled={processingId === sub.id}
                        >
                          {processingId === sub.id ? '...' : 'Reject'}
                        </button>
                      </>
                    )}

                    {sub.approvalStatus === 'approved' && isCommander && (
                      <button
                        className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 text-gray-300 rounded transition-colors disabled:opacity-50"
                        onClick={() => { void handleRevoke(sub.id); }}
                        disabled={processingId === sub.id}
                      >
                        {processingId === sub.id ? '...' : 'Revoke'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
