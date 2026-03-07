/**
 * AIStaffTeamDetail -- Expandable team composition view
 *
 * Shows team members with their badges and contribution summaries.
 * First member is treated as lead agent (star indicator).
 */

import { AIStaffTeamBadge } from './AIStaffTeamBadge.tsx';

interface TeamMember {
  agentId: string;
  agentDisplayName: string;
  agentRole: string;
  contribution?: string;
}

interface AIStaffTeamDetailProps {
  teamId: string;
  teamName: string;
  members: TeamMember[];
}

export function AIStaffTeamDetail({ teamId: _teamId, teamName, members }: AIStaffTeamDetailProps) {
  if (members.length === 0) {
    return (
      <div className="ai-team-detail">
        <span className="ai-staff-subtitle">Team: {teamName} (no members loaded)</span>
      </div>
    );
  }

  return (
    <div className="ai-team-detail">
      <div className="ai-team-detail-header">
        <span className="ai-staff-subtitle">Team: {teamName}</span>
      </div>
      <div className="ai-team-detail-members">
        {members.map((member, index) => (
          <div key={member.agentId} className="ai-team-detail-member">
            <div className="ai-team-detail-member-header">
              {index === 0 && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--accent-yellow, #f59e0b)" className="ai-team-lead-star">
                  <path d="M6 1l1.5 3.1L11 4.5 8.5 7l.6 3.5L6 8.8 2.9 10.5l.6-3.5L1 4.5l3.5-.4L6 1z" />
                </svg>
              )}
              <AIStaffTeamBadge agentDisplayName={member.agentDisplayName} agentRole={member.agentRole} />
            </div>
            {member.contribution && (
              <span className="ai-team-detail-contribution">{member.contribution}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
