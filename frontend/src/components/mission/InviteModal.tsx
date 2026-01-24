/**
 * InviteModal Component
 *
 * Modal dialog for creating new invites:
 * - Form fields: invitee DID or email, role, expiration
 * - Generate invite link display after creation
 * - Copy link button
 * - Success/error feedback
 */

import { useState } from 'react';
import { missionService, type ParticipantRole } from '../../lib/mission-service.js';
import './InviteModal.css';

interface InviteModalProps {
  missionId: string;
  userDID: string;
  onClose: () => void;
  onInviteCreated?: () => void;
}

export function InviteModal({
  missionId,
  userDID,
  onClose,
  onInviteCreated,
}: InviteModalProps) {
  const [inviteeDID, setInviteeDID] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ParticipantRole>('observer');
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate: must have DID or email
    if (!inviteeDID.trim() && !email.trim()) {
      setError('Please provide either a DID or email address');
      return;
    }

    // Validate: cannot have both
    if (inviteeDID.trim() && email.trim()) {
      setError('Please provide only DID or email, not both');
      return;
    }

    setLoading(true);

    try {
      const invite = await missionService.createInvite(
        missionId,
        {
          inviteeDID: inviteeDID.trim() || undefined,
          email: email.trim() || undefined,
          role,
          expiresInHours,
        },
        userDID
      );

      setInviteToken(invite.token);
      onInviteCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invite');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    const inviteLink = `${window.location.origin}/mission/accept/${inviteToken}`;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleReset = () => {
    setInviteToken(null);
    setInviteeDID('');
    setEmail('');
    setRole('observer');
    setExpiresInHours(72);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="invite-modal-overlay" onClick={onClose}>
      <div className="invite-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Invite Participant</h3>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>

        <div className="modal-body">
          {!inviteToken ? (
            <form onSubmit={handleSubmit}>
              {error && <div className="modal-error">{error}</div>}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="invite-did">Invitee DID</label>
                  <input
                    id="invite-did"
                    type="text"
                    value={inviteeDID}
                    onChange={(e) => setInviteeDID(e.target.value)}
                    placeholder="did:near:alice.near"
                    disabled={loading}
                  />
                </div>

                <div className="form-divider">OR</div>

                <div className="form-group">
                  <label htmlFor="invite-email">Email Address</label>
                  <input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="invite-role">Role</label>
                  <select
                    id="invite-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as ParticipantRole)}
                    disabled={loading}
                  >
                    <option value="commander">Commander</option>
                    <option value="staff">Staff</option>
                    <option value="observer">Observer</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="invite-expiration">Expires In</label>
                  <select
                    id="invite-expiration"
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(parseInt(e.target.value))}
                    disabled={loading}
                  >
                    <option value={24}>24 hours</option>
                    <option value={72}>72 hours (3 days)</option>
                    <option value={168}>7 days</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={onClose}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}
                >
                  {loading ? 'Creating...' : 'Create Invite'}
                </button>
              </div>
            </form>
          ) : (
            <div className="invite-success">
              <div className="success-icon">✓</div>
              <h4>Invite Created Successfully!</h4>
              <p className="success-message">
                Share this link with the participant:
              </p>

              <div className="invite-link-box">
                <code className="invite-link">
                  {`${window.location.origin}/mission/accept/${inviteToken}`}
                </code>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleReset}
                >
                  Create Another
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleCopyLink}
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
