/**
 * JoinByCodePage
 *
 * Handles /join/:code route — accepts problem set invites via short codes
 * like "BRAVO-742". Authenticates user then calls accept-by-code endpoint.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { problemSetService } from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';
import { useProblemSet } from '../../context/ProblemSetContext';

type JoinStatus = 'loading' | 'joined' | 'pending' | 'invalid' | 'already_member' | 'unauthenticated' | 'error';

export function JoinByCodePage() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { userDID, isAuthenticated } = useUser();
  const { refreshMemberships } = useProblemSet();

  const guardStatus: JoinStatus | null = !code
    ? 'invalid'
    : (!isAuthenticated || !userDID)
      ? 'unauthenticated'
      : null;

  const [asyncStatus, setAsyncStatus] = useState<JoinStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [joinedProblemSetId, setJoinedProblemSetId] = useState('');

  const status: JoinStatus = asyncStatus ?? guardStatus ?? 'loading';

  // Store code for unauthenticated users
  useEffect(() => {
    if (code && !isAuthenticated) {
      sessionStorage.setItem('problem-set-join-code', code);
    }
  }, [code, isAuthenticated]);

  useEffect(() => {
    if (guardStatus || !code || !userDID) return;

    void (async () => {
      try {
        const member = await problemSetService.acceptInviteByCode(code, userDID);
        if (member === null) {
          setAsyncStatus('pending');
        } else {
          setJoinedProblemSetId(member.problemSetId);
          await refreshMemberships();
          setAsyncStatus('joined');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        if (message.toLowerCase().includes('already')) {
          setAsyncStatus('already_member');
        } else if (message.toLowerCase().includes('not found') || message.toLowerCase().includes('expired')) {
          setAsyncStatus('invalid');
        } else {
          setErrorMessage(message);
          setAsyncStatus('error');
        }
      }
    })();
  }, [guardStatus, code, userDID, refreshMemberships]);

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
        {/* Code display */}
        {code && (
          <div className="mb-6">
            <span className="inline-block bg-gray-800 border border-gray-600 rounded-lg px-4 py-2 font-mono text-lg text-blue-300 tracking-wider">
              {code.toUpperCase()}
            </span>
          </div>
        )}

        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-2">Joining...</h2>
            <p className="text-gray-400 text-sm">Processing your invite code.</p>
          </>
        )}

        {status === 'unauthenticated' && (
          <>
            <h2 className="text-white text-xl font-semibold mb-2">Sign in to join</h2>
            <p className="text-gray-400 text-sm mb-6">
              You need an account to accept this invitation. After signing in you'll be redirected back.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              onClick={() => navigate(`/login?redirect=/join/${code ?? ''}`)}
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
            <h2 className="text-white text-xl font-semibold mb-2">Welcome!</h2>
            <p className="text-gray-400 text-sm mb-6">You have successfully joined the problem set.</p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-700 hover:bg-green-800 rounded-md transition-colors"
              onClick={() => navigate(joinedProblemSetId ? `/problem-set/${joinedProblemSetId}` : '/')}
            >
              Go to Problem Set
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <h2 className="text-white text-xl font-semibold mb-2">Request Pending</h2>
            <p className="text-gray-400 text-sm mb-6">
              Your request to join has been submitted and is awaiting admin approval.
            </p>
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
            <h2 className="text-white text-xl font-semibold mb-2">Invalid Code</h2>
            <p className="text-gray-400 text-sm mb-6">
              This invite code is invalid or has expired. Ask for a new one.
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
            <h2 className="text-white text-xl font-semibold mb-2">Already a Member</h2>
            <p className="text-gray-400 text-sm mb-6">You are already a member of this problem set.</p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              onClick={() => navigate('/')}
            >
              Go to Problem Sets
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <h2 className="text-white text-xl font-semibold mb-2">Something Went Wrong</h2>
            {errorMessage && <p className="text-gray-400 text-sm mb-2">{errorMessage}</p>}
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
