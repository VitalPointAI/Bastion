/**
 * ParticipantsStep Component
 *
 * Step 3: Participants
 * - Invite form: DID or email input, role selector
 * - Add invite button (stores locally until mission creation)
 * - List of pending invites with remove button
 */

import { useState } from 'react';
import type { MissionFormData, PendingInvite } from '../MissionWizard.js';
import type { ParticipantRole } from '../../../../lib/mission-service.js';
import './WizardSteps.css';

interface ParticipantsStepProps {
  formData: MissionFormData;
  updateFormData: <K extends keyof MissionFormData>(
    field: K,
    value: MissionFormData[K]
  ) => void;
}

export function ParticipantsStep({ formData, updateFormData }: ParticipantsStepProps) {
  const [inviteeDID, setInviteeDID] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<ParticipantRole>('observer');
  const [expiresInHours, setExpiresInHours] = useState(72);
  const [error, setError] = useState<string | null>(null);

  const handleAddInvite = () => {
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

    const newInvite: PendingInvite = {
      inviteeDID: inviteeDID.trim() || undefined,
      email: email.trim() || undefined,
      role,
      expiresInHours,
    };

    updateFormData('pendingInvites', [...formData.pendingInvites, newInvite]);

    // Reset form
    setInviteeDID('');
    setEmail('');
    setRole('observer');
    setExpiresInHours(72);
  };

  const handleRemoveInvite = (index: number) => {
    updateFormData(
      'pendingInvites',
      formData.pendingInvites.filter((_, i) => i !== index)
    );
  };

  return (
    <div className="wizard-step-content participants-step">
      <h3>Invite Participants</h3>
      <p className="step-description">
        Add team members to this mission. Invites will be sent after mission creation.
      </p>

      <div className="invite-form">
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="invite-did">Invitee DID</label>
            <input
              id="invite-did"
              type="text"
              value={inviteeDID}
              onChange={(e) => setInviteeDID(e.target.value)}
              placeholder="did:near:alice.near"
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
            >
              <option value={24}>24 hours</option>
              <option value={72}>72 hours (3 days)</option>
              <option value={168}>7 days</option>
            </select>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <button
          type="button"
          className="btn-add-invite"
          onClick={handleAddInvite}
        >
          Add Invite
        </button>
      </div>

      {formData.pendingInvites.length > 0 && (
        <div className="pending-invites">
          <h4>Pending Invites ({formData.pendingInvites.length})</h4>
          <div className="invites-list">
            {formData.pendingInvites.map((invite, index) => (
              <div key={index} className="invite-item">
                <div className="invite-info">
                  <span className="invite-target">
                    {invite.inviteeDID || invite.email}
                  </span>
                  <span className={`role-badge role-${invite.role}`}>
                    {invite.role}
                  </span>
                  <span className="invite-expiry">
                    Expires in {invite.expiresInHours}h
                  </span>
                </div>
                <button
                  type="button"
                  className="btn-remove"
                  onClick={() => handleRemoveInvite(index)}
                  aria-label="Remove invite"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {formData.pendingInvites.length === 0 && (
        <div className="no-invites">
          <p>No invites added yet. You can add participants later.</p>
        </div>
      )}
    </div>
  );
}
