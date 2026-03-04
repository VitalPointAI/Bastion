/**
 * InviteAcceptPage
 *
 * Standalone page for /workspace/invite/:token route.
 * - Unauthenticated users: save token, redirect to login
 * - Authenticated users: call acceptInvite, handle all response states
 * - States: success (joined), pending approval, clearance error,
 *   invalid/expired, already member
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { workspaceService } from '../../lib/workspace-service';
import { useUser } from '../../context/UserContext';
import { useWorkspace } from '../../context/WorkspaceContext';

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
  const { refreshMemberships } = useWorkspace();

  const [status, setStatus] = useState<AcceptStatus>('loading');
  const [workspaceName, setWorkspaceName] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [joinedWorkspaceId, setJoinedWorkspaceId] = useState<string>('');

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    // Not authenticated — store token and redirect to login
    if (!isAuthenticated || !userDID) {
      sessionStorage.setItem('workspace-invite-token', token);
      setStatus('unauthenticated');
      return;
    }

    // Authenticated — attempt to accept the invite
    void (async () => {
      try {
        const member = await workspaceService.acceptInvite(token, userDID);

        if (member === null) {
          // 202 = pending approval (gated workspace)
          setStatus('pending');
        } else {
          // Successful join
          setJoinedWorkspaceId(member.workspaceId);
          await refreshMemberships();
          setStatus('joined');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';

        if (
          message.toLowerCase().includes('clearance') ||
          message.toLowerCase().includes('classification')
        ) {
          setWorkspaceName(extractWorkspaceName(message));
          setStatus('clearance_error');
        } else if (
          message.toLowerCase().includes('already') ||
          message.toLowerCase().includes('member')
        ) {
          setStatus('already_member');
        } else if (
          message.toLowerCase().includes('expired') ||
          message.toLowerCase().includes('invalid') ||
          message.toLowerCase().includes('not found') ||
          message.toLowerCase().includes('404')
        ) {
          setStatus('invalid');
        } else {
          setErrorMessage(message);
          setStatus('error');
        }
      }
    })();
  }, [token, isAuthenticated, userDID, refreshMemberships]);

  const handleLoginRedirect = () => {
    navigate(`/login?redirect=/workspace/invite/${token ?? ''}`);
  };

  const handleGoToWorkspace = () => {
    if (joinedWorkspaceId) {
      navigate(`/workspace/${joinedWorkspaceId}`);
    } else {
      navigate('/monitor');
    }
  };

  // ─── Render states ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h2 className="text-white text-xl font-semibold mb-2">Joining workspace...</h2>
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
              You need an account to accept this workspace invitation.
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
            <h2 className="text-white text-xl font-semibold mb-2">Welcome to the workspace!</h2>
            <p className="text-gray-400 text-sm mb-6">
              You have successfully joined
              {workspaceName ? ` ${workspaceName}` : ' the workspace'}.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-green-700 hover:bg-green-800 rounded-md transition-colors"
              onClick={handleGoToWorkspace}
            >
              Go to Workspace
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
              onClick={() => navigate('/monitor')}
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
              You do not have the required clearance level to join this workspace.
            </p>
            {workspaceName && (
              <p className="text-xs text-gray-500 mb-6">
                Workspace classification: <span className="text-red-400 font-medium">{workspaceName}</span>
              </p>
            )}
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => navigate('/monitor')}
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
              onClick={() => navigate('/monitor')}
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
              You are already a member of this workspace.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              onClick={() => navigate('/monitor')}
            >
              Go to Workspace
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
              Please try again or contact the workspace admin.
            </p>
            <button
              className="w-full px-4 py-2.5 text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 rounded-md transition-colors"
              onClick={() => navigate('/monitor')}
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

/** Try to extract a workspace name or classification from an error message */
function extractWorkspaceName(message: string): string {
  // Common patterns: "clearance required: SECRET", "classification: TOP SECRET"
  const match = /(?:classification|clearance required)[:\s]+([A-Z\s]+)/i.exec(message);
  return match ? match[1].trim() : '';
}
