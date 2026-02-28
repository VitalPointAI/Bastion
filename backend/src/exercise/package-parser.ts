/**
 * Scenario Package Parser
 *
 * Phase 14 Plan 02: Heuristic inference of team, exercise phase, and document type
 * from file paths within a scenario package upload.
 *
 * Matches directory naming conventions used in actual scenario packages:
 *   - "blue team/Team BLUE/..." → team=blue
 *   - "red team/..." → team=red
 *   - "scenario phases/..." → team=controller
 *   - "Phase 3 (Day 4)" → exercisePhase=Conflict Day 4
 *   - "Country Policy Sheet" → documentType=COUNTRY_POLICY
 */

import type { ExerciseDocumentType } from './types.js';

// ─── PackageTags ──────────────────────────────────────────────────────────────

/**
 * Inferred structural tags for a file within a scenario package
 */
export interface PackageTags {
  team: 'blue' | 'red' | 'controller';
  exercisePhase: string; // 'Competition' | 'Crisis' | 'Conflict Day 4' | etc.
  documentType: ExerciseDocumentType;
  /** Confidence score: 1.0=all three matched, 0.7=team matched+defaults, 0.5=all defaults */
  confidence: number;
}

// ─── Heuristic Arrays ─────────────────────────────────────────────────────────

/**
 * Ordered team heuristics — tested against each path segment
 * First match wins.
 */
export const TEAM_HEURISTICS: Array<{ pattern: RegExp; team: PackageTags['team'] }> = [
  { pattern: /blue[\s_-]?team|team[\s_-]?blue/i, team: 'blue' },
  { pattern: /red[\s_-]?team|team[\s_-]?red/i, team: 'red' },
  { pattern: /scenario[\s_-]?phases?|exercise[\s_-]?control|excon/i, team: 'controller' },
];

/**
 * Ordered phase heuristics — tested against the full relative path.
 * First match wins.
 */
export const PHASE_HEURISTICS: Array<{ pattern: RegExp; phase: string }> = [
  { pattern: /competition|phase[\s_-]?1\b/i, phase: 'Competition' },
  { pattern: /crisis|phase[\s_-]?2\b/i, phase: 'Crisis' },
  { pattern: /day[\s_-]?4|conflict[\s_-]?day[\s_-]?4|phase[\s_-]?3\b/i, phase: 'Conflict Day 4' },
  { pattern: /day[\s_-]?10|conflict[\s_-]?day[\s_-]?10|phase[\s_-]?4\b/i, phase: 'Conflict Day 10' },
  { pattern: /day[\s_-]?22|conflict[\s_-]?day[\s_-]?22|phase[\s_-]?5\b/i, phase: 'Conflict Day 22' },
  { pattern: /negotiat|phase[\s_-]?6\b/i, phase: 'Negotiation' },
  // "Overall (Phase 3-5)" → treat as first conflict phase
  { pattern: /overall|phase[\s_-]?3[\s_-]?-?[\s_-]?5/i, phase: 'Conflict Day 4' },
];

/**
 * Ordered document type heuristics — tested against full path + filename.
 * First match wins.
 */
export const TYPE_HEURISTICS: Array<{ pattern: RegExp; type: ExerciseDocumentType }> = [
  { pattern: /sitrep|situation[\s_-]?report|situation[\s_-]?update/i, type: 'SITREP' },
  { pattern: /alertord|alert[\s_-]?order/i, type: 'ALERTORD' },
  { pattern: /frago|fragmentary/i, type: 'FRAGO' },
  { pattern: /oob|order[\s_-]?of[\s_-]?battle/i, type: 'OOB' },
  { pattern: /campaign[\s_-]?plan/i, type: 'CAMPAIGN_PLAN' },
  { pattern: /policy[\s_-]?sheet|country[\s_-]?policy/i, type: 'COUNTRY_POLICY' },
  { pattern: /planning[\s_-]?map|hex/i, type: 'PLANNING_MAP' },
  { pattern: /directive|learning[\s_-]?event/i, type: 'DIRECTIVE' },
  // CONOP → CAMPAIGN_PLAN (concept of operations is plan-level content)
  { pattern: /conop|concept[\s_-]?of[\s_-]?operations/i, type: 'CAMPAIGN_PLAN' },
];

// ─── Core Function ────────────────────────────────────────────────────────────

/**
 * Infer team, exercise phase, and document type from a relative file path
 * using ordered heuristic regex arrays.
 *
 * @example
 * inferTagsFromPath("blue team/Team BLUE/2.1 - Phase 3 (Day 4) - Blue Sitrep/CJTF-WP Day 4 Sitrep_AY26 PS.docx")
 * // → { team: 'blue', exercisePhase: 'Conflict Day 4', documentType: 'SITREP', confidence: 1.0 }
 *
 * @example
 * inferTagsFromPath("scenario phases/02. Phase 1 - Competition (Fri am)/03. Country Sheets.../Japan_Policy_Sheet_2028_2030.docx")
 * // → { team: 'controller', exercisePhase: 'Competition', documentType: 'COUNTRY_POLICY', confidence: 1.0 }
 */
export function inferTagsFromPath(relativePath: string): PackageTags {
  // Normalize path separators and split into segments
  const normalizedPath = relativePath.replace(/\\/g, '/');
  const segments = normalizedPath.split('/');

  // ─ Team detection: test each segment, take first match ─────────────────────
  let team: PackageTags['team'] | null = null;

  for (const segment of segments) {
    for (const heuristic of TEAM_HEURISTICS) {
      if (heuristic.pattern.test(segment)) {
        team = heuristic.team;
        break;
      }
    }
    if (team !== null) break;
  }

  const teamMatched = team !== null;
  if (team === null) {
    // Default: controller (shared/top-level documents)
    team = 'controller';
  }

  // ─ Phase detection: test against full path ─────────────────────────────────
  let exercisePhase: string | null = null;

  for (const heuristic of PHASE_HEURISTICS) {
    if (heuristic.pattern.test(normalizedPath)) {
      exercisePhase = heuristic.phase;
      break;
    }
  }

  const phaseMatched = exercisePhase !== null;
  if (exercisePhase === null) {
    // Default: earliest phase
    exercisePhase = 'Competition';
  }

  // ─ Document type detection: test against full path + filename ───────────────
  const filename = segments[segments.length - 1] ?? '';
  const searchText = normalizedPath + ' ' + filename;

  let documentType: ExerciseDocumentType | null = null;

  for (const heuristic of TYPE_HEURISTICS) {
    if (heuristic.pattern.test(searchText)) {
      documentType = heuristic.type;
      break;
    }
  }

  const typeMatched = documentType !== null;
  if (documentType === null) {
    documentType = 'OTHER';
  }

  // ─ Confidence score ─────────────────────────────────────────────────────────
  // 1.0 = all three explicitly matched
  // 0.7 = team matched but phase and/or type defaulted
  // 0.5 = all defaults (no heuristic matches)
  let confidence: number;
  if (teamMatched && phaseMatched && typeMatched) {
    confidence = 1.0;
  } else if (teamMatched && (phaseMatched || typeMatched)) {
    confidence = 0.7;
  } else if (!teamMatched && !phaseMatched && !typeMatched) {
    confidence = 0.5;
  } else {
    // Partial match (team matched but nothing else, or phase/type matched but not team)
    confidence = 0.7;
  }

  return { team, exercisePhase, documentType, confidence };
}

// ─── Convenience Batch Function ───────────────────────────────────────────────

/**
 * Input item for parseScenarioPackage
 */
export interface ScenarioPackageFile {
  relativePath: string;
  buffer: Buffer;
  mimeType: string;
}

/**
 * Output item from parseScenarioPackage — original file with inferred tags
 */
export interface TaggedScenarioFile {
  tags: PackageTags;
  file: ScenarioPackageFile;
}

/**
 * Map over a collection of uploaded scenario files, applying inferTagsFromPath to each.
 * Returns the original file data alongside its inferred structural tags.
 *
 * @example
 * const tagged = parseScenarioPackage(uploadedFiles);
 * const blueFiles = tagged.filter(f => f.tags.team === 'blue');
 */
export function parseScenarioPackage(files: ScenarioPackageFile[]): TaggedScenarioFile[] {
  return files.map((file) => ({
    tags: inferTagsFromPath(file.relativePath),
    file,
  }));
}
