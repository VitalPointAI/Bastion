/**
 * AIStaffTeamBadge -- Agent name + role icon
 *
 * Renders a compact horizontal badge: [icon] [name]
 * Icon mapped from agent role to staff section.
 */

/** Map agent role prefix to a simple SVG icon path (16x16 viewBox) */
function getRoleIcon(role: string): string {
  const r = role.toLowerCase();
  // J2 / Intelligence roles -> shield icon
  if (r.includes('j2') || r.includes('intel') || r.includes('fusion') || r.includes('osint') || r.includes('entity') || r.includes('bias') || r.includes('extraction') || r.includes('raft')) {
    return 'M8 1L2 4v4c0 3.5 2.6 6.8 6 7.9 3.4-1.1 6-4.4 6-7.9V4L8 1z';
  }
  // J3 / Operations roles -> ops/lightning icon
  if (r.includes('j3') || r.includes('ops') || r.includes('direct') || r.includes('orders') || r.includes('conflict') || r.includes('deception')) {
    return 'M9 1L4 9h3l-1 6 5-8H8l1-6z';
  }
  // J5 / Plans roles -> planning/clipboard icon
  if (r.includes('j5') || r.includes('plan') || r.includes('coa') || r.includes('design') || r.includes('problem') || r.includes('cog') || r.includes('loe') || r.includes('assumption') || r.includes('narrative')) {
    return 'M5 1h6v2h2v12H3V3h2V1zm1 1v1h4V2H6zm-2 3h8v1H4V5zm0 2h8v1H4V7zm0 2h5v1H4V9z';
  }
  // Red team / adversary roles -> target icon
  if (r.includes('red') || r.includes('adversary')) {
    return 'M8 2a6 6 0 100 12A6 6 0 008 2zm0 2a4 4 0 110 8 4 4 0 010-8zm0 2a2 2 0 100 4 2 2 0 000-4z';
  }
  // Effects / escalation / ROE roles -> graph/chart icon
  if (r.includes('effect') || r.includes('escalation') || r.includes('roe') || r.includes('compliance') || r.includes('coalition')) {
    return 'M2 13V7l3-2 3 3 3-5 3 2v8H2zm3-6l-1 .7V12h2V8.4L4 7zm3 1.6V12h2V6.4L9 5l-1 3.6zm3-3V12h2V5.6l-2-1z';
  }
  // Default: generic agent icon (person)
  return 'M8 2a3 3 0 100 6 3 3 0 000-6zM4 12c0-2.2 1.8-3 4-3s4 .8 4 3v1H4v-1z';
}

interface AIStaffTeamBadgeProps {
  agentDisplayName: string;
  agentRole: string;
}

export function AIStaffTeamBadge({ agentDisplayName, agentRole }: AIStaffTeamBadgeProps) {
  const iconPath = getRoleIcon(agentRole);

  return (
    <div className="ai-team-badge" title={agentRole}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" className="ai-team-badge-icon">
        <path d={iconPath} />
      </svg>
      <span className="ai-team-badge-name">{agentDisplayName}</span>
    </div>
  );
}
