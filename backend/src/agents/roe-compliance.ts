/**
 * ROE Compliance Agent
 *
 * Parses Rules of Engagement (ROE), maps authorities to planning activities,
 * and validates that planned actions comply with legal and command authority constraints.
 *
 * CRITICAL: This agent provides ANALYSIS ONLY. It does NOT make compliance DECISIONS.
 * All compliance decisions remain HUMAN-ONLY per the safety matrix (ETHICAL_LEGAL and
 * AUTHORITY_DECISION categories). The agent supports human decision-making by surfacing
 * potential violations and authority gaps.
 *
 * Per FM 6-27, ROE consist of:
 * - Standing ROE (SROE): persistent authorities and restrictions
 * - Supplemental ROE: mission-specific authorities and caveats
 * - National caveats: country-specific restrictions in coalition operations
 */

import type { AgentManifest } from './types.js';
import { AgentPhase, AgentCapability, AutonomyLevel, ProposalKind } from './types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * Parsed ROE rule with metadata.
 */
export interface ROERule {
  /** Unique rule identifier (e.g., "SROE-4.2", "SUPPL-001") */
  ruleId: string;
  /** Full text of the rule */
  text: string;
  /** Rule category */
  category: 'authorization' | 'prohibition' | 'restriction' | 'caveat';
  /** Authority level granting this rule */
  authority: string;
  /** Effective start time (epoch ms), null if always effective */
  effectiveFrom: number | null;
  /** Effective end time (epoch ms), null if no expiration */
  effectiveUntil: number | null;
  /** National caveats from coalition partners */
  nationalCaveats: string[];
  /** Confidence in parsing accuracy (0-1) */
  parseConfidence: number;
}

/**
 * Authority mapping from planned activities to ROE rules.
 */
export interface AuthorityMapping {
  /** Activity identifier and description */
  activity: string;
  /** Level of authority required for this activity */
  requiredAuthority: string;
  /** ROE rules that grant authority */
  grantedBy: ROERule[];
  /** Whether current ROE provides sufficient authority */
  sufficient: boolean;
  /** Authority gaps identified */
  gaps: string[];
  /** Confidence in mapping accuracy (0-1) */
  mappingConfidence: number;
}

/**
 * Detected compliance violation with remediation guidance.
 */
export interface ComplianceViolation {
  /** Activity that violates ROE */
  activity: string;
  /** Rule that is violated */
  violatedRule: ROERule;
  /** Type of violation */
  violationType: 'exceeds_authority' | 'prohibited_action' | 'missing_authorization' | 'caveat_conflict' | 'temporal_violation';
  /** Severity of the violation */
  severity: 'critical' | 'major' | 'minor';
  /** Human-readable description */
  description: string;
  /** Suggested remediation steps */
  suggestedRemediation: string;
  /** Confidence in violation detection (0-1) */
  detectionConfidence: number;
  /** Confidence interval bounds per INVARIANT 5 */
  confidenceBounds: { lower: number; upper: number };
}

/**
 * Complete ROE compliance analysis output.
 */
export interface ROEComplianceOutput {
  /** Parsed ROE rules */
  parsedRules: ROERule[];
  /** Authority mappings for planned activities */
  authorityMappings: AuthorityMapping[];
  /** Compliance violations found */
  violations: ComplianceViolation[];
  /** National caveat conflicts between coalition partners */
  caveatConflicts: Array<{
    partnerA: string;
    partnerB: string;
    conflictDescription: string;
    affectedActivities: string[];
  }>;
  /** Overall compliance status (ANALYSIS ONLY - not a decision) */
  overallCompliant: boolean;
  /** Compliance confidence (0-1) per INVARIANT 5 */
  complianceConfidence: number;
  /** Summary of findings */
  summary: string;
  /** Critical issues requiring immediate human attention */
  criticalIssues: string[];
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * ROE Compliance Agent manifest.
 *
 * CRITICAL: maxAutonomy is NotAutonomous because ROE compliance involves
 * ETHICAL_LEGAL and AUTHORITY_DECISION domains, which are HUMAN_ONLY per
 * the safety matrix. This agent provides analysis support only.
 */
export const ROE_COMPLIANCE_MANIFEST: AgentManifest = {
  agentId: 'roe-compliance',
  name: 'ROE Compliance Agent',
  description: 'Parses Rules of Engagement, maps authorities to planning activities, and identifies compliance violations. Provides analysis only - compliance decisions remain human-only.',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.ROECompliance],
  maxAutonomy: AutonomyLevel.NotAutonomous,
  allowedProposalKinds: [
    ProposalKind.MissionOrder,
    ProposalKind.Custom,
  ],
  requiresHumanApproval: [
    ProposalKind.StrikeAuthorization,
    ProposalKind.MissionOrder,
  ],
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
};

// ==========================================================================
// System Prompt
// ==========================================================================

/**
 * System prompt for the ROE Compliance agent.
 *
 * Emphasizes:
 * - Analysis-only role (not decision-making)
 * - ROE structure understanding (SROE vs. supplemental)
 * - Authority chain mapping
 * - National caveat identification
 * - Temporal constraint validation
 * - FM 6-27 references
 * - Confidence intervals per INVARIANT 5
 */
export const ROE_COMPLIANCE_SYSTEM_PROMPT = `You are the ROE Compliance Agent. Your role is to analyze Rules of Engagement (ROE) and identify potential compliance issues for human decision-makers.

# YOUR ROLE

You provide ANALYSIS ONLY. You do NOT make compliance decisions. All compliance decisions remain HUMAN-ONLY per the safety matrix (ETHICAL_LEGAL and AUTHORITY_DECISION domains).

Your outputs support human commanders who make the actual compliance decisions.

# WHAT YOU DO

1. **Parse ROE Documents**
   - Extract Standing ROE (SROE) authorities and restrictions
   - Extract Supplemental ROE mission-specific guidance
   - Identify national caveats from coalition partners
   - Map authority chains from higher headquarters to tactical units

2. **Map Authorities to Activities**
   - Match planned activities to required authorities
   - Identify which ROE rules grant authority for each activity
   - Flag activities where authority is insufficient or unclear
   - Note temporal constraints (time-limited authorities)

3. **Detect Compliance Violations**
   - Exceeds authority: Activity requires higher authority than granted
   - Prohibited action: Activity explicitly prohibited by ROE
   - Missing authorization: No ROE rule covers this activity
   - Caveat conflict: National caveats from different coalition partners conflict
   - Temporal violation: Activity planned outside time window of authority

4. **Coalition Caveat Analysis**
   - Track national caveats from each coalition partner
   - Identify conflicts between partner restrictions
   - Flag activities affected by caveat conflicts

# ROE STRUCTURE (per FM 6-27)

- **SROE (Standing ROE)**: Persistent authorities for self-defense, force protection
- **Supplemental ROE**: Mission-specific authorities and restrictions
- **National Caveats**: Country-specific restrictions (e.g., "German forces may not conduct offensive cyber operations")
- **Authority Levels**: Tactical (company/battalion) → Operational (brigade/division) → Strategic (theater/national)

# OUTPUT REQUIREMENTS

Every output MUST include:
- **Confidence intervals** (per INVARIANT 5): All confidence scores must include lower/upper bounds
- **Severity classification**: Critical/Major/Minor for violations
- **Remediation guidance**: Suggested steps to resolve violations
- **Critical issues list**: Issues requiring immediate human attention

# EXAMPLES

**Input**: Planned activity "Conduct cyber attack on enemy C2 node"
**Analysis**:
- Required authority: Theater-level offensive cyber authority
- ROE check: SUPPL-ROE-023 grants offensive cyber at theater level for C2 targets
- National caveats: UK partner restricts cyber to defensive only
- Violation: Caveat conflict (UK restriction)
- Confidence: 0.82 (bounds: 0.75-0.88)

**Input**: Planned activity "Return fire if attacked"
**Analysis**:
- Required authority: Unit self-defense
- ROE check: SROE grants self-defense authority to all echelons
- National caveats: None applicable
- Violation: None
- Confidence: 0.95 (bounds: 0.92-0.97)

# CRITICAL REMINDERS

- You analyze. Humans decide.
- Flag ambiguities loudly. Compliance is not a guess.
- National caveats override general authorities.
- Temporal constraints matter. Authority today ≠ authority tomorrow.
- When unsure, flag for human review with confidence bounds.
`;

// ==========================================================================
// Core Functions
// ==========================================================================

/**
 * Parse ROE document into structured rules.
 *
 * @param roeDocument - Raw ROE text (SROE, supplemental, caveats)
 * @returns Parsed ROE rules with metadata
 */
export async function parseROE(
  roeDocument: string,
): Promise<ROERule[]> {
  // Placeholder implementation.
  // Production version would use LLM with the system prompt to parse ROE.
  // For now, return empty array to satisfy TypeScript compilation.

  const rules: ROERule[] = [];

  // Example parsing logic (would be replaced with LLM call):
  // - Identify SROE sections vs. supplemental sections
  // - Extract rule identifiers and text
  // - Classify as authorization/prohibition/restriction/caveat
  // - Extract authority levels
  // - Parse effective dates
  // - Identify national caveats

  return rules;
}

/**
 * Check compliance of planned activities against ROE.
 *
 * @param parsedRules - Parsed ROE rules from parseROE()
 * @param plannedActivities - Activities to check for compliance
 * @param coalitionPartners - List of coalition partner nations
 * @returns Comprehensive compliance analysis
 */
export async function checkCompliance(
  parsedRules: ROERule[],
  plannedActivities: Array<{ activityId: string; description: string; requiredAuthority: string }>,
  coalitionPartners: string[],
): Promise<ROEComplianceOutput> {
  // Placeholder implementation.
  // Production version would use LLM with the system prompt to analyze compliance.

  const authorityMappings: AuthorityMapping[] = [];
  const violations: ComplianceViolation[] = [];
  const caveatConflicts: ROEComplianceOutput['caveatConflicts'] = [];
  const criticalIssues: string[] = [];

  // Example compliance checking logic (would be replaced with LLM call):
  // - For each activity, find applicable ROE rules
  // - Check if authority is sufficient
  // - Identify violations (exceeds, prohibited, missing, temporal)
  // - Check for national caveat conflicts
  // - Classify severity
  // - Generate remediation guidance

  // Calculate overall compliance (example logic)
  const overallCompliant = violations.length === 0;
  const complianceConfidence = violations.length === 0 ? 0.9 : 0.6;

  const summary = violations.length === 0
    ? `All ${plannedActivities.length} planned activities appear compliant with current ROE. No violations detected.`
    : `Detected ${violations.length} potential compliance violations across ${plannedActivities.length} planned activities. Human review required.`;

  return {
    parsedRules,
    authorityMappings,
    violations,
    caveatConflicts,
    overallCompliant,
    complianceConfidence,
    summary,
    criticalIssues,
  };
}
