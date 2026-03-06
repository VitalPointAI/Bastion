/**
 * InviteAcceptPage
 *
 * Standalone page for /problem-set/invite/:token route.
 * - Unauthenticated users: save token, redirect to login
 * - Authenticated users: call acceptInvite, handle all response states
 * - States: success (joined), pending approval, clearance error,
 *   invalid/expired, already member
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { problemSetService } from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';
import { useProblemSet } from '../../context/ProblemSetContext';

// ─── Accept status ────────────────────────────────────────────────────────────

type AcceptStatus =
  | 'loading'
  | 'joined'
  | 'pending'
  | 'clearance_error'
  | 'invalid'
  | 'already_member'
  | 'unauthenticated'
  | 'error';

// ─── Component ────────────────────────────────────────────────────────────────

export function InviteAcceptPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { userDID, isAuthenticated } = useUser();
  const { refreshMemberships } = useProblemSet();

  // Derive guard states during render to avoid synchronous setState in effects
  const guardStatus: AcceptStatus | null = !token
    ? 'invalid'
    : (!isAuthenticated || !userDID)
      ? 'unauthenticated'
      : null;

  const [asyncStatus, setAsyncStatus] = useState<AcceptStatus | null>(null);
  const [problemSetName, setProblemSetName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [joinedProblemSetId, setJoinedProblemSetId] = useState<string>('');

  const status: AcceptStatus = asyncStatus ?? guardStatus ?? 'loading';

  // Store token for unauthenticated users
  useEffect(() => {
    if (token && !isAuthenticated) {
      sessionStorage.setItem('problem-set-invite-token', token);
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    if (guardStatus || !token || !userDID) return;

    // Authenticated — attempt to accept the invite
    void (async () => {
      try {
        const member = await problemSetService.acceptInvite(token, userDID);

        if (member === null) {
          // 202 = pending approval (gated problem set)
          setAsyncStatus('pending');
        } else {
          // Successful join
          setJoinedProblemSetId(member.problemSetId);
          await refreshMemberships();
          setAsyncStatus('joined');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (
          message.toLowerCase().includes('clearance') ||
          message.toLowerCase().includes('classification')
        ) {
          setProblemSetName(extractProblemSetName(message));
          setAsyncStatus('clearance_error');
        } else if (
          message.toLowerCase().includes('already') ||
          message.toLowerCase().includes('member')
        ) {
          setAsyncStatus('already_member');
        } else if (
          message.toLowerCase().includes('expired') ||
          message.toLowerCase().includes('invalid') ||
          message.toLowerCase().includes('not found') ||
          message.toLowerCase().includes('404')
        ) {
          setAsyncStatus('invalid');
        } else {
          setErrorMessage(message);
          setAsyncStatus('error');
        }
      }
    })();
  }, [guardStatus, token, userDID, refreshMemberships]);

  const handleLoginRedirect = () => {
    navigate(`/login?redirect=/problem-set/invite/${token ?? ''}`);
  };

  const handleGoToProblem Set = () => {
    if (joinedProblemSetId) {
      navigate(`/problem-set/${joinedProblemSetId}`);
    } else {
      navigate('/');
    }
  };

  // ─── Render states ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-2">Joining problemSet...</h2>
            <p className="text-gray-400 text-sm">Processing your invitation.</p>
          </>
        )}

        {status === 'unauthenticated' && (
          <>
            <div className="w-16 h-16 bg-blue-900/40 border border-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-400 text-2xl">&#128274;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Sign in to join</h2>
            <p className="text-gray-400 text-sm mb-6">
              You need an account to accept this problem set invitation.
              After signing in, you will be automatically redirected back.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              onClick={handleLoginRedirect}
            >
              Register / Login to Join
            </button>
          </>
        )}

        {status === 'joined' && (
          <>
            <div className="w-16 h-16 bg-green-900/40 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-400 text-3xl font-bold">&#10003;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Welcome to the problem set!</h2>
            <p className="text-gray-400 text-sm mb-6">
              You have successfully joined
              {problemSetName ? ` ${problemSetName}` : ' the problem set'}.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-700 hover:bg-green-800 rounded-md transition-colors"
              onClick={handleGoToProblem Set}
            >
              Go to Problem Set
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div className="w-16 h-16 bg-yellow-900/40 border border-yellow-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-yellow-400 text-3xl">&#9203;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Request Pending</h2>
            <p className="text-gray-400 text-sm mb-6">
              Your request to join has been submitted and is awaiting admin approval.
              You will be notified once your membership is confirmed.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => navigate('/')}
            >
              Return Home
            </button>
          </>
        )}

        {status === 'clearance_error' && (
          <>
            <div className="w-16 h-16 bg-red-900/40 border border-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-3xl">&#128683;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Insufficient Clearance</h2>
            <p className="text-gray-400 text-sm mb-2">
              You do not have the required clearance level to join this problemSet.
            </p>
            {problemSetName && (
              <p className="text-xs text-gray-500 mb-6">
                Problem Set classification: <span className="text-red-400 font-medium">{problemSetName}</span>
              </p>
            )}
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => navigate('/')}
            >
              Return Home
            </button>
          </>
        )}

        {status === 'invalid' && (
          <>
            <div className="w-16 h-16 bg-gray-800 border border-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-gray-400 text-3xl">&#10007;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Invalid Invite Link</h2>
            <p className="text-gray-400 text-sm mb-6">
              This invite link is invalid or has expired. Please request a new invitation.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => navigate('/')}
            >
              Return Home
            </button>
          </>
        )}

        {status === 'already_member' && (
          <>
            <div className="w-16 h-16 bg-blue-900/40 border border-blue-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-blue-400 text-3xl">&#10003;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Already a Member</h2>
            <p className="text-gray-400 text-sm mb-6">
              You are already a member of this problemSet.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              onClick={() => navigate('/')}
            >
              Go to Problem Set
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-900/40 border border-red-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-3xl">&#9888;</span>
            </div>
            <h2 className="text-white text-xl font-semibold mb-2">Something Went Wrong</h2>
            {errorMessage && (
              <p className="text-gray-400 text-sm mb-2">{errorMessage}</p>
            )}
            <p className="text-gray-500 text-xs mb-6">
              Please try again or contact the problem set admin.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => navigate('/')}
            >
              Return Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Try to extract a problem set name or classification from an error message */
function extractProblemSetName(message: string): string {
  // Common patterns: "clearance required: SECRET", "classification: TOP SECRET"
  const match = /(?:classification|clearance required)[:\s]+([A-Z\s]+)/i.exec(message);
  return match ? match[1].trim() : '';
}
