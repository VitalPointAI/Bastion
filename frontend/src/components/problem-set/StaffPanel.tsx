/**
 * StaffPanel
 *
 * Generic staff section panel that adapts to the specific military staff role.
 * Displays role header, content placeholder, and quick links.
 * Activity is handled by the dashboard-level ActivityFeed.
 */

import { useNavigate } from 'react-router-dom';

// ─── Role metadata ─────────────────────────────────────────────────────────────

interface RoleMeta {
  label: string;
  description: string;
  color: string;
}

const ROLE_META: Record<string, RoleMeta> = {
  s1: {
    label: 'S1 - Personnel & Administration',
    description: 'Responsible for personnel management, administration, and human resources within this problemSet.',
    color: 'text-blue-400',
  },
  s2: {
    label: 'S2 - Intelligence',
    description: 'Responsible for intelligence collection, analysis, and dissemination to support decision-making.',
    color: 'text-yellow-400',
  },
  s3: {
    label: 'S3 - Operations',
    description: 'Responsible for planning, directing, and coordinating current and future operations.',
    color: 'text-green-400',
  },
  s4: {
    label: 'S4 - Logistics',
    description: 'Responsible for supply, maintenance, transportation, and sustainment operations.',
    color: 'text-orange-400',
  },
  s5: {
    label: 'S5 - Plans',
    description: 'Responsible for future operations planning and campaign assessment.',
    color: 'text-purple-400',
  },
  s6: {
    label: 'S6 - Communications',
    description: 'Responsible for communications systems, networks, and information technology.',
    color: 'text-cyan-400',
  },
  s7: {
    label: 'S7 - Training',
    description: 'Responsible for individual and collective training programs and exercises.',
    color: 'text-amber-400',
  },
  s8: {
    label: 'S8 - Finance',
    description: 'Responsible for budgeting, financial management, and resource allocation.',
    color: 'text-emerald-400',
  },
  s9: {
    label: 'S9 - Civil Affairs',
    description: 'Responsible for civil-military operations and engagement with local populations.',
    color: 'text-rose-400',
  },
  team_lead: {
    label: 'Team Lead',
    description: 'Leads a specialized team within this problemSet.',
    color: 'text-indigo-400',
  },
  member: {
    label: 'Member',
    description: 'Contributing member of this problemSet.',
    color: 'text-gray-300',
  },
};

const DEFAULT_ROLE_META: RoleMeta = {
  label: 'Staff Member',
  description: 'Staff role within this problemSet.',
  color: 'text-gray-300',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface StaffPanelProps {
  problemSetId: string;
  staffRole?: string;
}

// ─── StaffPanel ───────────────────────────────────────────────────────────────

export function StaffPanel({ problemSetId, staffRole }: StaffPanelProps) {
  const navigate = useNavigate();

  const meta = staffRole ? (ROLE_META[staffRole.toLowerCase()] ?? DEFAULT_ROLE_META) : DEFAULT_ROLE_META;

  return (
    <div className="flex flex-col gap-6">

      {/* Role Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${meta.color} mb-1`}>{meta.label}</h3>
            <p className="text-sm text-gray-400">{meta.description}</p>
          </div>
          {staffRole && (
            <span className="shrink-0 text-xs font-mono px-2 py-1 rounded bg-gray-700 text-gray-300 border border-gray-600 uppercase">
              {staffRole}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Staff Section Content */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-gray-100 mb-3">Section Content</h4>

          <div className="flex flex-col items-center justify-center py-8 text-center border border-dashed border-gray-600 rounded">
            <span className={`text-3xl font-bold ${meta.color} opacity-40 mb-3`}>
              {staffRole?.toUpperCase() ?? 'STAFF'}
            </span>
            <p className="text-sm text-gray-500 max-w-xs">
              {meta.label.split(' - ')[0]} problem set content will appear here as missions
              and exercises are created and assigned to this section.
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
          <h4 className="text-sm font-semibold text-gray-100 mb-3">Quick Links</h4>

          <div className="flex flex-col gap-2">
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
              onClick={() => navigate(`/problem-set/${problemSetId}/members`)}
            >
              <span className="text-blue-400 w-5 text-center">&#128101;</span>
              View Members
            </button>
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
              onClick={() => navigate('/campaign')}
            >
              <span className="text-green-400 w-5 text-center">&#128203;</span>
              Active Missions
            </button>
            <button
              className="flex items-center gap-3 w-full px-4 py-3 rounded bg-gray-700 hover:bg-gray-600 text-left text-sm text-white transition-colors"
              onClick={() => navigate('/exercise')}
            >
              <span className="text-yellow-400 w-5 text-center">&#127937;</span>
              Exercise Scenarios
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
