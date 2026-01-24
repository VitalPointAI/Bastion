/**
 * ParticipantList Component
 *
 * Displays current mission participants:
 * - Shows name/DID, role, joined date
 * - Role badges with colors
 * - Remove button (only for mission commander/creator)
 * - Empty state message
 */

import { useState } from 'react';
import { missionService, type Participant } from '../../lib/mission-service.js';
import './ParticipantList.css';

interface ParticipantListProps {
  missionId: string;
  participants: Participant[];
  userDID: string;
  isCommander: boolean;
  onParticipantRemoved?: () => void;
}

export function ParticipantList({
  missionId,
  participants,
  userDID,
  isCommander,
  onParticipantRemoved,
}: ParticipantListProps) {
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async (participantId: string) => {
    if (!confirm('Are you sure you want to remove this participant?')) {
      return;
    }

    setRemovingId(participantId);
    setError(null);

    try {
      await missionService.removeParticipant(missionId, participantId, userDID);
      onParticipantRemoved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove participant');
    } finally {
      setRemovingId(null);
    }
  };

  const getRoleBadgeClass = (role: string) => {
    return `role-badge role-${role}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (participants.length === 0) {
    return (
      <div className="participant-list">
        <div className="empty-state">
          <p>No participants yet. Invite team members to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="participant-list">
      {error && (
        <div className="participant-error">
          {error}
        </div>
      )}

      <div className="participants-grid">
        {participants.map((participant) => (
          <div key={participant.participantId} className="participant-card">
            <div className="participant-info">
              <div className="participant-did">{participant.userDID}</div>
              <span className={getRoleBadgeClass(participant.role)}>
                {participant.role}
              </span>
            </div>

            <div className="participant-meta">
              <span className="joined-date">
                Joined {formatDate(participant.joinedAt)}
              </span>
              {participant.addedBy && (
                <span className="added-by">Added by {participant.addedBy}</span>
              )}
            </div>

            {isCommander && participant.userDID !== userDID && (
              <button
                className="btn-remove-participant"
                onClick={() => handleRemove(participant.participantId)}
                disabled={removingId === participant.participantId}
                aria-label="Remove participant"
              >
                {removingId === participant.participantId ? 'Removing...' : 'Remove'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
