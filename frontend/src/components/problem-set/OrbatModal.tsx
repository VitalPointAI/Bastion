/**
 * OrbatModal
 *
 * Displays an ORBAT (Order of Battle) org tree of problem set members.
 * Members are arranged hierarchically by role:
 *   Commander → XO/Team Lead → Staff (S1-S9) → Members → Observers
 *
 * Lines connect parent→child nodes to visualise the chain of command.
 */

import { useMemo } from 'react';
import type { ProblemSetMemberDetail } from '../../lib/problem-set-service';

// ─── Props ───────────────────────────────────────────────────────────────────

interface OrbatModalProps {
  members: ProblemSetMemberDetail[];
  onClose: () => void;
  onSelectMember?: (member: ProblemSetMemberDetail) => void;
}

// ─── Role hierarchy ──────────────────────────────────────────────────────────

/** ORBAT tier mapping — roles grouped into tiers for tree layout */
const ROLE_TIERS: Record<string, number> = {
  commander: 0,
  xo: 1,
  team_lead: 1,
  s1: 2,
  s2: 2,
  s3: 2,
  s4: 2,
  s5: 2,
  s6: 2,
  s7: 2,
  s8: 2,
  s9: 2,
  member: 3,
  observer: 4,
};

const ROLE_LABELS: Record<string, string> = {
  commander: 'CDR',
  xo: 'XO',
  team_lead: 'TL',
  s1: 'S1',
  s2: 'S2',
  s3: 'S3',
  s4: 'S4',
  s5: 'S5',
  s6: 'S6',
  s7: 'S7',
  s8: 'S8',
  s9: 'S9',
  member: 'MBR',
  observer: 'OBS',
};

const TIER_LABELS: Record<number, string> = {
  0: 'Command',
  1: 'Deputy / Team Lead',
  2: 'Staff',
  3: 'Members',
  4: 'Observers',
};

const TIER_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  0: { bg: 'bg-yellow-900/40', border: 'border-yellow-700', text: 'text-yellow-300' },
  1: { bg: 'bg-blue-900/40', border: 'border-blue-700', text: 'text-blue-300' },
  2: { bg: 'bg-indigo-900/40', border: 'border-indigo-700', text: 'text-indigo-300' },
  3: { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300' },
  4: { bg: 'bg-gray-800/50', border: 'border-gray-700', text: 'text-gray-500' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getTier(role: string): number {
  return ROLE_TIERS[role.toLowerCase()] ?? 3;
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role.toLowerCase()] ?? role.toUpperCase().slice(0, 3);
}

function shortenDid(did: string): string {
  if (did.startsWith('did:near:')) {
    const acct = did.replace('did:near:', '');
    return acct.length > 16 ? acct.slice(0, 8) + '...' + acct.slice(-6) : acct;
  }
  return did.length > 20 ? did.slice(0, 10) + '...' + did.slice(-8) : did;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function OrbatModal({ members, onClose, onSelectMember }: OrbatModalProps) {
  // Group members by tier
  const tiers = useMemo(() => {
    const grouped = new Map<number, ProblemSetMemberDetail[]>();
    for (const m of members) {
      const tier = getTier(m.role);
      if (!grouped.has(tier)) grouped.set(tier, []);
      grouped.get(tier)!.push(m);
    }
    // Sort tiers by number, sort members within tier by role then name
    const sorted = [...grouped.entries()].sort(([a], [b]) => a - b);
    for (const [, tierMembers] of sorted) {
      tierMembers.sort((a, b) => {
        const ra = ROLE_TIERS[a.role.toLowerCase()] ?? 99;
        const rb = ROLE_TIERS[b.role.toLowerCase()] ?? 99;
        if (ra !== rb) return ra - rb;
        const nameA = a.displayName ?? a.userDid;
        const nameB = b.displayName ?? b.userDid;
        return nameA.localeCompare(nameB);
      });
    }
    return sorted;
  }, [members]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">
            ORBAT — Order of Battle
          </h2>
          <button
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none ml-3"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body — tiered org tree */}
        <div className="px-6 py-5 space-y-6">
          {tiers.map(([tierNum, tierMembers], tierIdx) => {
            const colors = TIER_COLORS[tierNum] ?? TIER_COLORS[3];
            const tierLabel = TIER_LABELS[tierNum] ?? `Tier ${tierNum}`;

            return (
              <div key={tierNum}>
                {/* Tier label */}
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {tierLabel}
                </div>

                {/* Connector line from previous tier */}
                {tierIdx > 0 && (
                  <div className="flex justify-center -mt-4 mb-2">
                    <div className="w-px h-4 bg-gray-700" />
                  </div>
                )}

                {/* Member cards in a flex row */}
                <div className="flex flex-wrap justify-center gap-3">
                  {tierMembers.map((m) => {
                    const isSuspended = m.status === 'suspended';
                    return (
                      <button
                        key={m.id}
                        onClick={() => onSelectMember?.(m)}
                        className={[
                          'flex flex-col items-center px-4 py-3 rounded-lg border transition-colors min-w-[120px]',
                          colors.bg,
                          colors.border,
                          isSuspended ? 'opacity-50' : '',
                          onSelectMember ? 'hover:brightness-125 cursor-pointer' : 'cursor-default',
                        ].join(' ')}
                        title={`${m.displayName ?? m.userDid} — ${m.role}`}
                      >
                        {/* Role badge */}
                        <span className={`text-xs font-bold ${colors.text}`}>
                          {getRoleLabel(m.role)}
                        </span>
                        {/* Name */}
                        <span className="text-sm text-gray-200 mt-1 text-center truncate max-w-[140px]">
                          {m.displayName || shortenDid(m.userDid)}
                        </span>
                        {/* Status */}
                        {isSuspended && (
                          <span className="text-[10px] text-yellow-400 mt-0.5">SUSPENDED</span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Down connector to next tier */}
                {tierIdx < tiers.length - 1 && (
                  <div className="flex justify-center mt-2">
                    <div className="w-px h-4 bg-gray-700" />
                  </div>
                )}
              </div>
            );
          })}

          {tiers.length === 0 && (
            <p className="text-center text-gray-500 text-sm py-8">
              No members to display.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
