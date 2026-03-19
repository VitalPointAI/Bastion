/**
 * Agent Avatar Generator
 *
 * Generates deterministic SVG avatars from agent name/ID.
 * Colors are derived from a hash of the agent ID for consistency.
 * Returns inline SVG data URIs — no external dependencies.
 */

// Role-based color palette (BASTION theme)
const AVATAR_COLORS = [
  { bg: '#1e3a5f', fg: '#60a5fa' },  // blue — intelligence
  { bg: '#3b1f1f', fg: '#f87171' },  // red — adversary/threat
  { bg: '#1f3b2e', fg: '#4ade80' },  // green — operations
  { bg: '#3b2f1f', fg: '#fbbf24' },  // amber — command/governance
  { bg: '#2d1f3b', fg: '#a78bfa' },  // purple — strategy
  { bg: '#1f3b3b', fg: '#2dd4bf' },  // teal — cyber/tech
  { bg: '#3b1f2f', fg: '#fb7185' },  // pink — medical/support
  { bg: '#2f3b1f', fg: '#a3e635' },  // lime — engineering
  { bg: '#1f2d3b', fg: '#38bdf8' },  // sky — osint/monitor
  { bg: '#3b3b1f', fg: '#facc15' },  // yellow — validation
];

// Keyword -> color index mapping for role-appropriate colors
const ROLE_COLOR_MAP: Record<string, number> = {
  governance: 3, copilot: 3,
  intelligence: 0, fusion: 0, osint: 8,
  adversary: 1, threat: 1, escalation: 1, deception: 1,
  strategy: 4, feasibility: 4, framing: 4,
  cyber: 5, detection: 5, entity: 5,
  compliance: 3, roe: 3, orders: 3,
  validity: 9, assessment: 9,
  extraction: 0, reasoning: 4,
  effect: 7, engineer: 7,
  surgeon: 6, medical: 6,
  bias: 1, uncertainty: 9,
  screener: 0, proposal: 3,
  monitor: 8,
};

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function getColorForAgent(agentId: string): { bg: string; fg: string } {
  const id = agentId.toLowerCase();
  for (const [keyword, idx] of Object.entries(ROLE_COLOR_MAP)) {
    if (id.includes(keyword)) return AVATAR_COLORS[idx];
  }
  return AVATAR_COLORS[hashString(agentId) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/**
 * Generate an SVG avatar data URI for an agent.
 */
export function generateAgentAvatar(agentId: string, name: string, size = 40): string {
  const { bg, fg } = getColorForAgent(agentId);
  const initials = getInitials(name);
  const fontSize = size * 0.4;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="${bg}"/>
    <text x="50%" y="50%" dy=".1em" text-anchor="middle" dominant-baseline="central"
      font-family="system-ui,-apple-system,sans-serif" font-size="${fontSize}" font-weight="600" fill="${fg}">
      ${initials}
    </text>
  </svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Get avatar URL for an agent — uses avatarUrl if set, otherwise generates one.
 */
export function getAgentAvatarUrl(agent: { agentId: string; name: string; avatarUrl?: string }): string {
  if (agent.avatarUrl) return agent.avatarUrl;
  return generateAgentAvatar(agent.agentId, agent.name);
}
