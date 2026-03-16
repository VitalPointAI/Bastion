/**
 * CoalitionCaveatDashboard
 *
 * Phase 48 Plan 06: Pre-flight coalition caveat check dashboard.
 *
 * Shows a grid of swarm members x mission type with green/amber/red status
 * badges per national DID caveat policy. Surfaces specific restriction reasons
 * on block and offers alternative asset suggestion via the backend API.
 */

import { useEffect, useState, useCallback } from 'react';

// ─── Types (mirrors backend/src/robot/coalition-caveat-service.ts) ───────────

interface CaveatRestriction {
  mission_type: string;
  area_type?: 'urban' | 'rural' | 'unknown';
  except?: string[];
  reason: string;
}

interface CoalitionProfile {
  nation: string;
  did: string;
  authority: 'full' | 'restricted' | 'observer';
  allowed_missions: string[];
  restrictions: CaveatRestriction[];
}

interface CaveatCheckResult {
  allowed: boolean;
  blockedRobots: Array<{
    robotId: string;
    nationalDid: string;
    nation: string;
    reason: string;
  }>;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CoalitionCaveatDashboardProps {
  swarmMembers: Array<{ robotId: string; nationalDid: string }>;
  missionType: string;
  areaType: 'urban' | 'rural' | 'unknown';
  onCaveatResult: (result: CaveatCheckResult) => void;
}

// ─── Nation display helpers ───────────────────────────────────────────────────

const NATION_FLAGS: Record<string, string> = {
  Taiwan: '\u{1F1F9}\u{1F1FC}',           // TW
  'United States': '\u{1F1FA}\u{1F1F8}',  // US
  Australia: '\u{1F1E6}\u{1F1FA}',        // AU
};

function nationFlag(nation: string): string {
  return NATION_FLAGS[nation] ?? '?';
}

/** Derive display nation from a DID or nation string */
function didToNation(profiles: Record<string, CoalitionProfile>, did: string): string {
  const profile = Object.values(profiles).find((p) => p.did === did);
  return profile?.nation ?? 'Unknown';
}

// ─── Caveat evaluation (client-side mirror of backend logic) ─────────────────

type MemberStatus = 'allowed' | 'blocked' | 'partial';

interface MemberCaveatStatus {
  status: MemberStatus;
  reason?: string;
  nation: string;
}

function evaluateMember(
  robotId: string,
  nationalDid: string,
  missionType: string,
  areaType: 'urban' | 'rural' | 'unknown',
  profiles: Record<string, CoalitionProfile>,
): MemberCaveatStatus {
  const profile = Object.values(profiles).find((p) => p.did === nationalDid);

  if (!profile) {
    return {
      status: 'blocked',
      reason: `No coalition profile for DID ${nationalDid}`,
      nation: 'Unknown',
    };
  }

  // Walk restrictions (first-match wins)
  for (const r of profile.restrictions) {
    const exceptList = r.except ?? [];

    if (r.mission_type === '*') {
      if (!exceptList.includes(missionType)) {
        // Check area constraint
        if (r.area_type === undefined || r.area_type === areaType) {
          // Wildcard block — check if it's area-specific (partial for other areas)
          if (r.area_type !== undefined) {
            return { status: 'partial', reason: r.reason, nation: profile.nation };
          }
          return { status: 'blocked', reason: r.reason, nation: profile.nation };
        }
      }
    } else if (r.mission_type === missionType) {
      if (r.area_type === undefined || r.area_type === areaType) {
        // Area-specific restriction = partial status (blocked in this area, allowed in others)
        if (r.area_type !== undefined) {
          return { status: 'partial', reason: r.reason, nation: profile.nation };
        }
        return { status: 'blocked', reason: r.reason, nation: profile.nation };
      }
    }
  }

  // Check allowed_missions
  if (!profile.allowed_missions.includes(missionType)) {
    return {
      status: 'blocked',
      reason: `${profile.nation}: mission type '${missionType}' not in allowed_missions`,
      nation: profile.nation,
    };
  }

  return { status: 'allowed', nation: profile.nation };
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, reason }: { status: MemberStatus; reason?: string }) {
  const config = {
    allowed: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.4)', color: '#86efac', symbol: '\u2714' },
    blocked: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', color: '#fca5a5', symbol: '\u2715' },
    partial: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.4)', color: '#fde047', symbol: '~' },
  }[status];

  return (
    <div
      title={reason}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: config.bg,
        border: `2px solid ${config.border}`,
        color: config.color,
        fontSize: '0.8125rem',
        fontWeight: 700,
        cursor: reason ? 'help' : 'default',
      }}
    >
      {config.symbol}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CoalitionCaveatDashboard({
  swarmMembers,
  missionType,
  areaType,
  onCaveatResult,
}: CoalitionCaveatDashboardProps) {
  const [profiles, setProfiles] = useState<Record<string, CoalitionProfile>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [altSuggestion, setAltSuggestion] = useState<string | null>(null);
  const [fetchingAlt, setFetchingAlt] = useState(false);

  // Load coalition profiles from the backend
  useEffect(() => {
    let cancelled = false;
    fetch('/api/robot/coalition-profiles')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Record<string, CoalitionProfile>>;
      })
      .then((data) => {
        if (!cancelled) setProfiles(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(String(err));
      });
    return () => { cancelled = true; };
  }, []);

  // Evaluate all members and build check result
  const memberStatuses = swarmMembers.map((m) => ({
    ...m,
    ...evaluateMember(m.robotId, m.nationalDid, missionType, areaType, profiles),
  }));

  const blockedRobots = memberStatuses
    .filter((m) => m.status === 'blocked')
    .map((m) => ({
      robotId: m.robotId,
      nationalDid: m.nationalDid,
      nation: m.nation,
      reason: m.reason ?? '',
    }));

  const checkResult: CaveatCheckResult = {
    allowed: blockedRobots.length === 0,
    blockedRobots,
  };

  // Notify parent whenever result changes
  // We use a string comparison to avoid infinite loops
  const resultKey = `${checkResult.allowed}:${blockedRobots.map((r) => r.robotId).join(',')}`;
  useEffect(() => {
    onCaveatResult(checkResult);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultKey]);

  // Fetch alternative asset suggestion from backend
  const handleSuggestAlternative = useCallback(async () => {
    if (blockedRobots.length === 0) return;
    setFetchingAlt(true);
    setAltSuggestion(null);
    try {
      const res = await fetch('/api/robot/coalition-profiles');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const profileData = await res.json() as Record<string, CoalitionProfile>;

      // Find first non-blocked member whose profile allows the mission
      const blockedIds = new Set(blockedRobots.map((r) => r.robotId));
      let alt: string | null = null;

      for (const member of swarmMembers) {
        if (blockedIds.has(member.robotId)) continue;
        const profile = Object.values(profileData).find((p) => p.did === member.nationalDid);
        if (!profile) continue;
        if (profile.allowed_missions.includes(missionType)) {
          const globalBlock = profile.restrictions.find(
            (r) => r.mission_type === missionType && r.area_type === undefined,
          );
          if (!globalBlock) {
            alt = member.robotId;
            break;
          }
        }
      }

      setAltSuggestion(alt ?? 'No suitable alternative found in current swarm');
    } catch (err: unknown) {
      setAltSuggestion(`Error: ${String(err)}`);
    } finally {
      setFetchingAlt(false);
    }
  }, [blockedRobots, swarmMembers, missionType]);

  if (swarmMembers.length === 0) return null;

  const allClear = checkResult.allowed;

  return (
    <div style={{
      padding: '0.75rem',
      background: allClear ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
      border: `1px solid ${allClear ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
      borderRadius: '0.375rem',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.625rem' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={allClear ? '#22c55e' : '#ef4444'} strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8' }}>
          Coalition Pre-Flight Caveat Check
        </span>
        {loadError && (
          <span style={{ fontSize: '0.6875rem', color: '#fca5a5', marginLeft: 'auto' }}>
            Profile load error
          </span>
        )}
      </div>

      {/* Member x Mission matrix */}
      <div style={{ overflowX: 'auto', marginBottom: '0.5rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.6875rem', borderBottom: '1px solid #1e293b' }}>
                Robot
              </th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.6875rem', borderBottom: '1px solid #1e293b' }}>
                Nation
              </th>
              <th style={{ textAlign: 'center', padding: '0.25rem 0.5rem', color: '#64748b', fontWeight: 600, fontSize: '0.6875rem', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>
                {missionType.replace(/_/g, ' ')}
              </th>
            </tr>
          </thead>
          <tbody>
            {memberStatuses.map((m) => (
              <tr key={m.robotId}>
                <td style={{ padding: '0.3125rem 0.5rem', color: '#e2e8f0', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {m.robotId}
                </td>
                <td style={{ padding: '0.3125rem 0.5rem', color: '#94a3b8', fontSize: '0.75rem' }}>
                  {Object.keys(profiles).length > 0
                    ? `${nationFlag(didToNation(profiles, m.nationalDid))} ${didToNation(profiles, m.nationalDid)}`
                    : m.nationalDid.split(':').pop() ?? m.nationalDid
                  }
                </td>
                <td style={{ padding: '0.3125rem 0.5rem', textAlign: 'center' }}>
                  <StatusBadge status={m.status} reason={m.reason} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.625rem', color: '#475569', marginBottom: '0.5rem' }}>
        <span style={{ color: '#86efac' }}>\u2714 Allowed</span>
        <span style={{ color: '#fde047' }}>~ Area restriction</span>
        <span style={{ color: '#fca5a5' }}>\u2715 Blocked</span>
        <span style={{ color: '#64748b', marginLeft: 'auto' }}>Hover \u2715/~ for reason</span>
      </div>

      {/* Summary line */}
      {allClear ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.375rem 0.625rem',
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '0.25rem',
          fontSize: '0.8125rem',
          color: '#86efac',
          fontWeight: 600,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          All Clear — Pre-Flight Passed
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
          {blockedRobots.map((br) => (
            <div key={br.robotId} style={{
              padding: '0.375rem 0.625rem',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              color: '#fca5a5',
            }}>
              <span style={{ fontWeight: 700 }}>BLOCKED: {br.robotId}</span>
              {' — '}
              <span style={{ color: '#fda4af' }}>{br.reason}</span>
            </div>
          ))}

          {/* Suggest alternative button */}
          <button
            onClick={() => { void handleSuggestAlternative(); }}
            disabled={fetchingAlt}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.375rem',
              padding: '0.375rem 0.75rem',
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)',
              borderRadius: '0.25rem',
              color: '#fde047',
              fontSize: '0.75rem',
              cursor: fetchingAlt ? 'not-allowed' : 'pointer',
              opacity: fetchingAlt ? 0.7 : 1,
            }}
          >
            {fetchingAlt ? 'Checking...' : 'Suggest Alternative Asset'}
          </button>

          {altSuggestion && (
            <div style={{
              padding: '0.375rem 0.625rem',
              background: 'rgba(234,179,8,0.08)',
              border: '1px solid rgba(234,179,8,0.25)',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              color: '#fde047',
            }}>
              Alternative: <span style={{ fontWeight: 700 }}>{altSuggestion}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
