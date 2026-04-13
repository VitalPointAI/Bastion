/**
 * Scope Fingerprint Service
 *
 * Builds a compact, scope-defining text block for a problem set that the
 * brain curator routine uses to:
 *   - Decide which global-KG actors are relevant to this PS slice
 *   - Construct targeted web-search queries
 *   - Filter incoming OSINT events
 *   - Identify pruning candidates when scope shifts
 *
 * Authoritative source: `problem_set_context` (the scoping interview output).
 * Fallback when no interview has been run: name + description + top actors
 * already present in the slice (degraded mode — logged so the operator knows
 * to run scoping).
 */

import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';
import type { ProblemSetContext } from '../doc-intelligence/schemas.js';
import { problemSetStore } from '../problem-set/problem-set-store.js';

interface CachedFingerprint {
  text: string;
  version: number;
  builtAt: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hour
const cache = new Map<string, CachedFingerprint>();

/**
 * Build (or return cached) compact scope fingerprint for a problem set.
 *
 * Returns an empty string only if the problem set itself does not exist.
 * Always-on best-effort: any sub-fetch failure is swallowed and the
 * available pieces are returned.
 */
export async function buildScopeFingerprint(problemSetId: string): Promise<string> {
  const cached = cache.get(problemSetId);
  if (cached && Date.now() - cached.builtAt < TTL_MS) {
    return cached.text;
  }

  let context: ProblemSetContext | null = null;
  try {
    context = await getProblemSetContext(problemSetId);
  } catch {
    // non-fatal — fall through to degraded fingerprint
  }

  const ps = await problemSetStore.getProblemSet(problemSetId).catch(() => null);
  if (!ps) {
    return '';
  }

  const lines: string[] = ['[PROBLEM SET SCOPE FINGERPRINT]'];
  lines.push(`PS: ${ps.name} (${problemSetId})`);

  if (context) {
    const geo = context.geographicScope;
    const geoParts: string[] = [];
    if (geo.regions?.length) geoParts.push(`regions=${geo.regions.join(', ')}`);
    if (geo.countries?.length) geoParts.push(`countries=${geo.countries.join(', ')}`);
    if (geo.specificAreas?.length) geoParts.push(`areas=${geo.specificAreas.join(', ')}`);
    if (geoParts.length) lines.push(`GEO: ${geoParts.join(' | ')}`);
    if (geo.exclusions?.length) lines.push(`GEO_EXCLUDE: ${geo.exclusions.join(', ')}`);

    const tr = context.temporalRange;
    const trParts: string[] = [];
    if (tr.startDate || tr.endDate) trParts.push(`window=${tr.startDate ?? '?'}→${tr.endDate ?? '?'}`);
    if (tr.historicalDepth) trParts.push(`history=${tr.historicalDepth}`);
    if (tr.futureHorizon) trParts.push(`horizon=${tr.futureHorizon}`);
    if (trParts.length) lines.push(`TIME: ${trParts.join(' | ')}`);

    const actors = context.actorFocus;
    if (actors.primaryActors?.length) {
      lines.push(`PRIMARY ACTORS: ${actors.primaryActors.join(', ')}`);
    }
    if (actors.alliances?.length) {
      const allianceStrs = actors.alliances.map((a) => `${a.name}[${a.members.join('+')}]`);
      lines.push(`ALLIANCES: ${allianceStrs.join('; ')}`);
    }
    if (actors.excludedActors?.length) {
      lines.push(`ACTOR_EXCLUDE: ${actors.excludedActors.join(', ')}`);
    }

    lines.push(`CORE: ${truncate(context.coreProblem, 280)}`);
    if (context.additionalNuance) {
      lines.push(`NUANCE: ${truncate(context.additionalNuance, 200)}`);
    }
    lines.push(`ECHELON: ${context.echelon} | CLASSIFICATION: ${context.classificationCeiling}`);
    if (context.standingRequirements?.length) {
      lines.push(`STANDING REQS: ${context.standingRequirements.slice(0, 5).join(' | ')}`);
    }
  } else {
    // Degraded fingerprint — no scoping interview has been run.
    if (ps.description) {
      lines.push(`DESCRIPTION: ${truncate(ps.description, 400)}`);
    }
    lines.push(
      'NOTE: scoping interview not yet run — fingerprint is degraded. Run the problem set scoping interview to give the curator authoritative scope.',
    );
    console.warn(
      `[scope-fingerprint] No problem_set_context for ${problemSetId} — using degraded fingerprint`,
    );
  }

  const text = lines.join('\n');
  cache.set(problemSetId, {
    text,
    version: context?.version ?? 0,
    builtAt: Date.now(),
  });
  return text;
}

/**
 * Drop the cached fingerprint for a problem set. Called when the scoping
 * interview is re-run so the next curator cycle picks up the new scope.
 */
export function invalidateScopeFingerprint(problemSetId: string): void {
  cache.delete(problemSetId);
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '...' : s;
}
