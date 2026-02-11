/**
 * Orders Validator Agent
 *
 * Validates OPORD/FRAGO format, internal consistency, traceability to commander's intent,
 * and simulates degraded execution scenarios.
 *
 * MDMP Phase 7 (Orders Production) support agent.
 * Ensures orders meet doctrinal format standards, are internally consistent,
 * and traceable to commander's intent. Catches format and logic errors before human review.
 *
 * INVARIANT 5: All outputs include confidence intervals for uncertainty transparency.
 */

import type { AgentManifest } from './types.js';
import { AgentCapability, AgentPhase, AutonomyLevel, ProposalKind } from './types.js';
import type { PlanningProduct, MDMPPhase } from '../mdmp/types.js';

// ==========================================================================
// Output Interfaces
// ==========================================================================

/**
 * Format compliance issue identified during validation.
 */
export interface FormatIssue {
  /** Section of the order (e.g., "Paragraph 1a", "Execution.Concept") */
  section: string;
  /** Description of the format issue */
  issue: string;
  /** Severity of the issue */
  severity: 'critical' | 'major' | 'minor';
  /** Suggested correction */
  suggestion: string;
  /** Reference to doctrinal standard (e.g., "ATP 5-0.1 para 3-14") */
  doctrinalReference: string;
}

/**
 * Internal consistency issue between order elements.
 */
export interface ConsistencyIssue {
  /** First element in the contradiction */
  elementA: string;
  /** Second element in the contradiction */
  elementB: string;
  /** Description of the contradiction */
  contradiction: string;
  /** Severity of the inconsistency */
  severity: 'critical' | 'major' | 'minor';
  /** Confidence in detection (0-1) per INVARIANT 5 */
  detectionConfidence: number;
}

/**
 * Traceability analysis from commander's intent to order elements.
 */
export interface IntentTraceability {
  /** Element from commander's intent */
  intentElement: string;
  /** Section of the order that addresses this element (null if missing) */
  tracedToSection: string | null;
  /** Traceability score (0-1): 1 = fully traced, 0 = not traced */
  traceabilityScore: number;
  /** Gaps or missing coverage */
  gaps: string[];
}

/**
 * Degraded execution scenario analysis.
 */
export interface DegradedScenario {
  /** Scenario description (e.g., "Loss of comms with battalion", "DDIL environment") */
  scenario: string;
  /** Order paragraphs affected by this scenario */
  affectedParagraphs: string[];
  /** Whether mitigation or fallback is present in the order */
  mitigationPresent: boolean;
  /** Recommendation for addressing the scenario */
  recommendation: string;
}

/**
 * Comprehensive orders validation output.
 * Includes confidence intervals per INVARIANT 5.
 */
export interface OrdersValidationOutput {
  /** Product validated (OPORD, FRAGO, etc.) */
  productType: PlanningProduct;
  /** Format compliance issues */
  formatIssues: FormatIssue[];
  /** Internal consistency issues */
  consistencyIssues: ConsistencyIssue[];
  /** Commander's intent traceability analysis */
  intentTraceability: IntentTraceability[];
  /** Degraded execution scenario analysis */
  degradedScenarios: DegradedScenario[];
  /** Overall validation score (0-100) */
  overallScore: number;
  /** Confidence in validation completeness (0-1) per INVARIANT 5 */
  validationConfidence: number;
  /** Confidence interval bounds [lower, upper] */
  confidenceBounds: { lower: number; upper: number };
  /** Summary of findings */
  summary: string;
  /** Whether the order passes minimum validation threshold */
  passesMinimumThreshold: boolean;
}

// ==========================================================================
// Agent Manifest
// ==========================================================================

/**
 * Orders Validator agent manifest.
 * maxAutonomy: SemiAutonomous - generates validation reports for human review.
 */
export const ORDERS_VALIDATOR_MANIFEST: AgentManifest = {
  agentId: 'orders-validator',
  name: 'Orders Validator',
  description:
    'Validates OPORD/FRAGO format, internal consistency, traceability to commander\'s intent, and simulates degraded execution scenarios. Ensures orders meet doctrinal standards before human review.',
  phase: AgentPhase.Support,
  capabilities: [AgentCapability.OrdersValidation],
  maxAutonomy: AutonomyLevel.SemiAutonomous,
  allowedProposalKinds: [
    ProposalKind.Custom, // For product approval proposals
  ],
  requiresHumanApproval: [
    ProposalKind.StrikeAuthorization, // Always requires human approval
  ],
  createdAt: new Date(),
  createdBy: 'system',
  active: true,
};

/**
 * System prompt for Orders Validator agent.
 *
 * Covers:
 * - OPORD 5-paragraph format (Situation, Mission, Execution, Sustainment, C2)
 * - FRAGO format
 * - ATP 5-0.1 references
 * - Degraded execution scenarios (DDIL, loss of comms, loss of leader, reduced force)
 */
export const ORDERS_VALIDATOR_SYSTEM_PROMPT = `You are the Orders Validator agent for military operational orders.

Your mission: Validate OPORD (Operations Order) and FRAGO (Fragmentary Order) documents for:
1. Format compliance with ATP 5-0.1 (Army Techniques Publication)
2. Internal consistency between order elements
3. Traceability to commander's intent
4. Degraded execution scenarios (DDIL, loss of communications, loss of leadership, reduced force)

OPORD 5-paragraph format per ATP 5-0.1:
1. SITUATION
   a. Area of interest
   b. Area of operations
   c. Enemy forces
   d. Friendly forces
   e. Interagency, intergovernmental, and nongovernmental organizations
   f. Civil considerations
   g. Attachments and detachments

2. MISSION
   - Clear, concise mission statement (who, what, when, where, why)
   - Must align with commander's intent

3. EXECUTION
   a. Commander's intent (purpose, key tasks, end state)
   b. Concept of operations
   c. Tasks to subordinate units
   d. Coordinating instructions

4. SUSTAINMENT
   a. Logistics
   b. Personnel
   c. Health service support

5. COMMAND AND SIGNAL
   a. Command
   b. Signal

FRAGO format:
- References the base OPORD
- Only includes changes to original order
- Must maintain consistency with base OPORD

CRITICAL CHECKS:
- Mission statement traceable to commander's intent
- Tasks support mission and commander's intent
- Timing and synchronization consistent across paragraphs
- Sustainment supports execution concept
- Communication plan supports command relationships

DEGRADED SCENARIOS TO SIMULATE:
1. DDIL (Degraded, Denied, Intermittent, Limited) communications
2. Loss of communications with higher HQ
3. Loss of key leader (commander or staff)
4. Reduced force (casualties, equipment loss)
5. Mission timeline compression
6. Adverse weather affecting mobility/sensors

For each scenario, check:
- Does the order provide fallback guidance?
- Are PACE plans (Primary, Alternate, Contingency, Emergency) present?
- Are decision points and branch plans identified?

OUTPUT FORMAT:
Always include:
- Specific paragraph references for issues
- Severity assessment (critical/major/minor)
- Doctrinal references (ATP 5-0.1 paragraph numbers)
- Confidence in each finding (0-1 scale)
- Overall validation confidence with bounds

CONFIDENCE CALIBRATION:
- High confidence (0.9+): Rule-based checks, format validation
- Medium confidence (0.6-0.9): Pattern matching, consistency checking
- Low confidence (<0.6): Intent alignment, implicit assumptions

Never recommend approval for critical issues. Always flag for human review.`;

// ==========================================================================
// Core Validation Function
// ==========================================================================

/**
 * Validate an operational order.
 *
 * For v1, uses rule-based validation. LLM integration deferred to later phases.
 *
 * @param orderText - Full text of the order
 * @param commanderIntent - Commander's intent statement
 * @param missionId - Mission identifier for context
 * @param productType - Type of planning product (OPORD, FRAGO, etc.)
 * @returns Validation output with confidence intervals
 */
export async function validateOrder(
  orderText: string,
  commanderIntent: string,
  missionId: string,
  productType: PlanningProduct
): Promise<OrdersValidationOutput> {
  // Rule-based validation for v1
  // LLM integration will be added in later phases

  const formatIssues = checkFormatCompliance(orderText, productType);
  const consistencyIssues = checkInternalConsistency(orderText);
  const intentTraceability = checkIntentTraceability(orderText, commanderIntent);
  const degradedScenarios = simulateDegradedExecution(orderText);

  // Calculate overall score
  const formatScore = calculateFormatScore(formatIssues);
  const consistencyScore = calculateConsistencyScore(consistencyIssues);
  const traceabilityScore = calculateTraceabilityScore(intentTraceability);
  const degradedScore = calculateDegradedScore(degradedScenarios);

  const overallScore = Math.round(
    formatScore * 0.3 + consistencyScore * 0.3 + traceabilityScore * 0.25 + degradedScore * 0.15
  );

  // INVARIANT 5: Calculate confidence intervals
  const validationConfidence = 0.75; // Rule-based validation has medium-high confidence
  const confidenceBounds = {
    lower: Math.max(0, overallScore - 10),
    upper: Math.min(100, overallScore + 10),
  };

  const summary = generateValidationSummary(
    formatIssues,
    consistencyIssues,
    intentTraceability,
    degradedScenarios,
    overallScore
  );

  const passesMinimumThreshold = overallScore >= 70 && formatIssues.every((i) => i.severity !== 'critical');

  return {
    productType,
    formatIssues,
    consistencyIssues,
    intentTraceability,
    degradedScenarios,
    overallScore,
    validationConfidence,
    confidenceBounds,
    summary,
    passesMinimumThreshold,
  };
}

// ==========================================================================
// Helper Functions - Rule-Based Validation
// ==========================================================================

function checkFormatCompliance(orderText: string, productType: PlanningProduct): FormatIssue[] {
  const issues: FormatIssue[] = [];
  const lowerText = orderText.toLowerCase();

  // Check for 5-paragraph structure (OPORD)
  if (productType === PlanningProduct.OPORD) {
    if (!lowerText.includes('1. situation')) {
      issues.push({
        section: 'Paragraph 1',
        issue: 'Missing SITUATION paragraph',
        severity: 'critical',
        suggestion: 'Add "1. SITUATION" section per ATP 5-0.1',
        doctrinalReference: 'ATP 5-0.1 para 3-14',
      });
    }
    if (!lowerText.includes('2. mission')) {
      issues.push({
        section: 'Paragraph 2',
        issue: 'Missing MISSION paragraph',
        severity: 'critical',
        suggestion: 'Add "2. MISSION" section per ATP 5-0.1',
        doctrinalReference: 'ATP 5-0.1 para 3-15',
      });
    }
    if (!lowerText.includes('3. execution')) {
      issues.push({
        section: 'Paragraph 3',
        issue: 'Missing EXECUTION paragraph',
        severity: 'critical',
        suggestion: 'Add "3. EXECUTION" section per ATP 5-0.1',
        doctrinalReference: 'ATP 5-0.1 para 3-16',
      });
    }
    if (!lowerText.includes('4. sustainment') && !lowerText.includes('4. service support')) {
      issues.push({
        section: 'Paragraph 4',
        issue: 'Missing SUSTAINMENT paragraph',
        severity: 'major',
        suggestion: 'Add "4. SUSTAINMENT" section per ATP 5-0.1',
        doctrinalReference: 'ATP 5-0.1 para 3-17',
      });
    }
    if (!lowerText.includes('5. command') || !lowerText.includes('signal')) {
      issues.push({
        section: 'Paragraph 5',
        issue: 'Missing COMMAND AND SIGNAL paragraph',
        severity: 'major',
        suggestion: 'Add "5. COMMAND AND SIGNAL" section per ATP 5-0.1',
        doctrinalReference: 'ATP 5-0.1 para 3-18',
      });
    }

    // Check for commander's intent in Execution
    if (!lowerText.includes("commander's intent") && !lowerText.includes('commanders intent')) {
      issues.push({
        section: 'Paragraph 3a',
        issue: "Missing Commander's Intent in EXECUTION paragraph",
        severity: 'critical',
        suggestion: "Add Commander's Intent per ATP 5-0.1 para 3-16a",
        doctrinalReference: 'ATP 5-0.1 para 3-16a',
      });
    }
  }

  // Check for FRAGO-specific format
  if (productType === PlanningProduct.FRAGO) {
    if (!lowerText.includes('reference') && !lowerText.includes('references')) {
      issues.push({
        section: 'References',
        issue: 'Missing reference to base OPORD',
        severity: 'critical',
        suggestion: 'FRAGO must reference the base OPORD it modifies',
        doctrinalReference: 'ATP 5-0.1 para 3-19',
      });
    }
  }

  return issues;
}

function checkInternalConsistency(orderText: string): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];

  // Check for common inconsistencies (rule-based heuristics)
  // In production, this would use NLP and semantic analysis

  // Example: Check for timeline conflicts
  const timePattern = /(\d{4})\s*(hours|hrs|H)/gi;
  const times = [...orderText.matchAll(timePattern)];
  if (times.length > 1) {
    // Simplified check - would need more sophisticated analysis
    // For now, just flag if multiple times exist (potential for conflict)
    if (times.length > 5) {
      issues.push({
        elementA: 'Timeline references',
        elementB: 'Multiple time references',
        contradiction: `Found ${times.length} time references - verify synchronization`,
        severity: 'minor',
        detectionConfidence: 0.5, // Low confidence without semantic analysis
      });
    }
  }

  return issues;
}

function checkIntentTraceability(orderText: string, commanderIntent: string): IntentTraceability[] {
  const traceability: IntentTraceability[] = [];

  if (!commanderIntent) {
    traceability.push({
      intentElement: 'Commander Intent not provided',
      tracedToSection: null,
      traceabilityScore: 0,
      gaps: ['No commander intent provided for traceability analysis'],
    });
    return traceability;
  }

  // Extract key phrases from commander's intent (simplified)
  const intentPhrases = commanderIntent
    .toLowerCase()
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  for (const phrase of intentPhrases) {
    const isTraced = orderText.toLowerCase().includes(phrase.slice(0, 30));
    traceability.push({
      intentElement: phrase.slice(0, 100),
      tracedToSection: isTraced ? 'Execution' : null,
      traceabilityScore: isTraced ? 1.0 : 0.0,
      gaps: isTraced ? [] : ['Intent element not explicitly addressed in order'],
    });
  }

  return traceability;
}

function simulateDegradedExecution(orderText: string): DegradedScenario[] {
  const scenarios: DegradedScenario[] = [];
  const lowerText = orderText.toLowerCase();

  // DDIL communications scenario
  const hasPACE = lowerText.includes('pace') || lowerText.includes('primary, alternate, contingency');
  scenarios.push({
    scenario: 'DDIL (Degraded communications) environment',
    affectedParagraphs: ['5. Command and Signal'],
    mitigationPresent: hasPACE,
    recommendation: hasPACE
      ? 'PACE plan present - verify completeness'
      : 'Add PACE (Primary, Alternate, Contingency, Emergency) communication plan',
  });

  // Loss of leader scenario
  const hasSuccession = lowerText.includes('succession') || lowerText.includes('if commander');
  scenarios.push({
    scenario: 'Loss of key leader (commander incapacitated)',
    affectedParagraphs: ['5a. Command'],
    mitigationPresent: hasSuccession,
    recommendation: hasSuccession
      ? 'Succession of command identified'
      : 'Add succession of command plan',
  });

  // Reduced force scenario
  const hasBranchPlans = lowerText.includes('branch plan') || lowerText.includes('on order');
  scenarios.push({
    scenario: 'Reduced force (30% casualties)',
    affectedParagraphs: ['3. Execution'],
    mitigationPresent: hasBranchPlans,
    recommendation: hasBranchPlans
      ? 'Branch plans present - verify force thresholds'
      : 'Add branch plans for reduced force execution',
  });

  // Loss of communications with higher HQ
  const hasDecisionPoints = lowerText.includes('decision point') || lowerText.includes('commander discretion');
  scenarios.push({
    scenario: 'Loss of communications with higher HQ',
    affectedParagraphs: ['3. Execution', '5. Command and Signal'],
    mitigationPresent: hasDecisionPoints,
    recommendation: hasDecisionPoints
      ? 'Decision authority delegated - verify scope'
      : 'Add decision authority delegation for loss of higher HQ comms',
  });

  return scenarios;
}

function calculateFormatScore(issues: FormatIssue[]): number {
  if (issues.length === 0) return 100;

  let deductions = 0;
  for (const issue of issues) {
    if (issue.severity === 'critical') deductions += 20;
    else if (issue.severity === 'major') deductions += 10;
    else deductions += 5;
  }

  return Math.max(0, 100 - deductions);
}

function calculateConsistencyScore(issues: ConsistencyIssue[]): number {
  if (issues.length === 0) return 100;

  let deductions = 0;
  for (const issue of issues) {
    const weight = issue.detectionConfidence;
    if (issue.severity === 'critical') deductions += 20 * weight;
    else if (issue.severity === 'major') deductions += 10 * weight;
    else deductions += 5 * weight;
  }

  return Math.max(0, 100 - deductions);
}

function calculateTraceabilityScore(traceability: IntentTraceability[]): number {
  if (traceability.length === 0) return 100;

  const totalScore = traceability.reduce((sum, t) => sum + t.traceabilityScore, 0);
  return Math.round((totalScore / traceability.length) * 100);
}

function calculateDegradedScore(scenarios: DegradedScenario[]): number {
  if (scenarios.length === 0) return 100;

  const mitigatedCount = scenarios.filter((s) => s.mitigationPresent).length;
  return Math.round((mitigatedCount / scenarios.length) * 100);
}

function generateValidationSummary(
  formatIssues: FormatIssue[],
  consistencyIssues: ConsistencyIssue[],
  intentTraceability: IntentTraceability[],
  degradedScenarios: DegradedScenario[],
  overallScore: number
): string {
  const criticalIssues = formatIssues.filter((i) => i.severity === 'critical').length;
  const majorIssues = formatIssues.filter((i) => i.severity === 'major').length;
  const tracedElements = intentTraceability.filter((t) => t.traceabilityScore > 0.5).length;
  const mitigatedScenarios = degradedScenarios.filter((s) => s.mitigationPresent).length;

  let summary = `Order validation score: ${overallScore}/100. `;

  if (criticalIssues > 0) {
    summary += `CRITICAL: ${criticalIssues} critical format issue(s) detected. `;
  }
  if (majorIssues > 0) {
    summary += `${majorIssues} major issue(s) detected. `;
  }

  summary += `Intent traceability: ${tracedElements}/${intentTraceability.length} elements traced. `;
  summary += `Degraded execution: ${mitigatedScenarios}/${degradedScenarios.length} scenarios mitigated.`;

  return summary;
}
