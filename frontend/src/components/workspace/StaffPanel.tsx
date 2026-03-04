/**
 * StaffPanel
 *
 * Generic staff section panel that adapts to the specific military staff role.
 * Displays role header, content placeholder, recent activity, and quick links.
 *
 * Phase 19 Plan 07: Role-adaptive dashboard panels.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { workspaceService, type WorkspaceActivityItem } from '../../lib/workspace-service';
import { useUser } from '../../context/UserContext';

// ─── Role metadata ─────────────────────────────────────────────────────────────

interface RoleMeta {
  label: string;
  description: string;
  color: string;
}

const ROLE_META: Record<string, RoleMeta> = {
  s1: {
    label: 'S1 - Personnel & Administration',
    description: 'Responsible for personnel management, administration, and human resources within this workspace.',
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
    description: 'Responsible for communications, information systems, and cybersecurity.',
    color: 'text-cyan-400',
  },
  s7: {
    label: 'S7 - Training',
    description: 'Responsible for training management, exercises, and readiness.',
    color: 'text-pink-400',
  },
  s8: {
    label: 'S8 - Finance',
    description: 'Responsible for financial management, budget execution, and resource allocation.',
    color: 'text-emerald-400',
  },
  s9: {
    label: 'S9 - Civil Affairs',
    description: 'Responsible for civil-military operations and engagement with civil authorities.',
    color: 'text-indigo-400',
  },
  xo: {
    label: 'XO - Executive Officer',
    description: 'Second in command. Manages day-to-day operations and staff coordination.',
    color: 'text-amber-400',
  },
};

const DEFAULT_ROLE_META: RoleMeta = {
  label: 'Staff Member',
  description: 'Workspace staff member with assigned duties.',
  color: 'text-gray-400',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatActivityType(activityType: string): string {
  // Show joins/departures only to staff (filter out sensitive types)
  const STAFF_VISIBLE = ['member_joined', 'member_left', 'member_suspended', 'member_unsuspended', 'role_changed'];
  if (!STAFF_VISIBLE.includes(activityType)) return '';
  return activityType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface StaffPanelProps {
  workspaceId: string;
  staffRole?: string;
}

// ─── StaffPanel ───────────────────────────────────────────────────────────────

export function StaffPanel({ workspaceId, staffRole }: StaffPanelProps) {
  const navigate = useNavigate();
  const { userDID } = useUser();

  const [activity, setActivity] = useState<WorkspaceActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = staffRole ? (ROLE_META[staffRole.toLowerCase()] ?? DEFAULT_ROLE_META) : DEFAULT_ROLE_META;

  // ─── Load activity ──────────────────────────────────────────────────────────

  const loadActivity = useCallback(async () => {
    if (!userDID) return;
    setLoading(true);
    try {
      const items = await workspaceService.listActivity(workspaceId, userDID, { limit: 10 });
      // Filter to staff-visible activity types
      const filtered = items.filter((item) => formatActivityType(item.activityType) !== '');
      setActivity(filtered.slice(0, 5));
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [workspaceId, userDID]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  // ─── Render ─────────────────────────────────────────────────────────────────

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
              {meta.label.split(' - ')[0]} workspace content will appear here as missions
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
              onClick={() => navigate(`/workspace/${workspaceId}/members`)}
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

      {/* Recent Activity */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
        <h4 className="text-sm font-semibold text-gray-100 mb-3">Member Activity</h4>

        {loading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : activity.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No recent member activity.</p>
        ) : (
          <ul className="divide-y divide-gray-700">
            {activity.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-gray-200">{formatActivityType(item.activityType)}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {item.actorDid.replace('did:near:', '')}
                  </p>
                </div>
                <span className="text-xs text-gray-500 shrink-0">{timeAgo(item.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

    </div>
  );
}
