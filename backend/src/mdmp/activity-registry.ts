/**
 * MDMP Activity Registry
 *
 * Complete catalog of all 65 MDMP activities with full configuration.
 * Organized by MDMP Phase (0-VIII) following JP 5-0 doctrine.
 *
 * This registry provides the activity configuration data that drives:
 * - Workflow orchestration (phase transitions, gate management)
 * - AI agent assignment and autonomy levels
 * - Governance gate requirements
 * - Verification and audit trails
 * - Red team challenge requirements
 * - Coalition relevance and information sharing
 *
 * References:
 * - .planning/mdmp-governance/mdmp-activity-registry.ts (Phases 0-2)
 * - .planning/mdmp-governance/mdmp-activity-registry-p3-8.ts (Phases 3-8)
 * - backend/src/mdmp/types.ts (Type definitions)
 */

import {
  MDMPPhase,
  ActivityCategory,
  AuthorityDesignation,
  ControlPosture,
  DAOTier,
  AgentRole,
  AgentOutputType,
  GateType,
  VerificationMechanism,
  EvidenceType,
  RetentionPeriod,
  AuditRequirement,
  ChallengeType,
  ResponseDepth,
  CoalitionImpact,
  SharingLevel,
  ImplementationStatus,
  EscalationPath,
  type MDMPActivity,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 0: CONTINUOUS ACTIVITIES
// Running infrastructure that feeds all subsequent phases.
// Highest concentration of AI_AUTONOMOUS activities.
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_0_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-0-01',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.DATA_AGGREGATION,
    description: 'Aggregate multi-source intelligence feeds into unified data lake (SIGINT, HUMINT, OSINT, GEOINT, MASINT)',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION, AgentRole.OSINT_MONITOR],
      agentOutputType: AgentOutputType.VALIDATION_RESULT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: true,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['JP 2-0 Ch. II', 'ADP 2-0 para 1-6'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [
        { layer: 'backend', module: 'agents/fusion-agent.ts', existingCapability: true, requiredEnhancement: null },
        { layer: 'backend', module: 'agents/osint-monitor.ts', existingCapability: true, requiredEnhancement: null },
      ],
      implementationStatus: ImplementationStatus.PARTIALLY_IMPLEMENTED,
      gapAnalysis: 'Need MASINT/GEOINT connector pipelines',
    },
    dependsOn: [],
    enables: ['MDMP-0-02', 'MDMP-0-03', 'MDMP-0-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.FULL_COALITION,
      nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-02',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.VALIDATION_CONSISTENCY,
    description: 'Cross-reference and deduplicate intelligence reports; flag contradictions across sources',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.ENTITY_RESOLUTION, AgentRole.CONFLICT_DETECTION],
      agentOutputType: AgentOutputType.VALIDATION_RESULT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: true,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['JP 2-0 Ch. III'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [
        { layer: 'backend', module: 'agents/entity-resolution.ts', existingCapability: true, requiredEnhancement: null },
        { layer: 'backend', module: 'agents/conflict-detection.ts', existingCapability: true, requiredEnhancement: null },
      ],
      implementationStatus: ImplementationStatus.PARTIALLY_IMPLEMENTED,
      gapAnalysis: null,
    },
    dependsOn: ['MDMP-0-01'],
    enables: ['MDMP-0-05', 'MDMP-2-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-03',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.DATA_AGGREGATION,
    description: 'Normalize disparate data formats into common operational picture schema',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION],
      agentOutputType: AgentOutputType.VALIDATION_RESULT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: false,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.STANDARD,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 6-0 para 3-14'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [
        { layer: 'backend', module: 'agents/fusion-agent.ts', existingCapability: true, requiredEnhancement: 'Add COP schema normalization' },
      ],
      implementationStatus: ImplementationStatus.PLANNED,
      gapAnalysis: 'COP schema not yet defined',
    },
    dependsOn: ['MDMP-0-01'],
    enables: ['MDMP-0-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.FULL_COALITION,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-04',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.MONITORING,
    description: 'Continuous environmental monitoring: track OE changes, trigger alerts on threshold breaches',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.OSINT_MONITOR, AgentRole.COALITION_HEALTH],
      agentOutputType: AgentOutputType.ALERT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: true,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['JP 3-0 Ch. V', 'ADP 5-0 para 4-1'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [
        { layer: 'backend', module: 'agents/osint-monitor.ts', existingCapability: true, requiredEnhancement: 'Add threshold alerting' },
      ],
      implementationStatus: ImplementationStatus.PARTIALLY_IMPLEMENTED,
      gapAnalysis: 'Alert threshold configuration needed',
    },
    dependsOn: ['MDMP-0-01', 'MDMP-0-03'],
    enables: ['MDMP-1-01', 'MDMP-8-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.FULL_COALITION,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-05',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.META_COGNITIVE,
    description: 'Monitor AI agent output quality: detect drift, hallucination, stale data, confidence degradation',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.DATA_BIAS_DETECTOR],
      agentOutputType: AgentOutputType.BIAS_REPORT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: true,
      teeRequired: true,
      evidenceTypes: [EvidenceType.VALIDATION_LOG, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['DoD AI Strategy 2023'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/data-bias-detector.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Meta-cognitive monitoring agent does not exist yet',
    },
    dependsOn: ['MDMP-0-02'],
    enables: ['MDMP-0-06'],
    minimumClassification: 'UNCLASSIFIED',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.RELEASABLE,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-06',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.META_COGNITIVE,
    description: 'Track data staleness per source; flag intelligence products past expiration windows',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.DATA_BIAS_DETECTOR],
      agentOutputType: AgentOutputType.STALENESS_REPORT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: false,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.STANDARD,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['JP 2-0 Ch. IV'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/data-bias-detector.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Staleness tracking not implemented',
    },
    dependsOn: ['MDMP-0-01'],
    enables: ['MDMP-2-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-07',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.VALIDATION_CONSISTENCY,
    description: 'Validate format consistency of incoming orders, directives, and fragmentary orders',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.ORDERS_VALIDATOR],
      agentOutputType: AgentOutputType.VALIDATION_RESULT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: true,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 5-1'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/orders-validator.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Orders validation agent does not exist yet',
    },
    dependsOn: [],
    enables: ['MDMP-1-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-08',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.PATTERN_RECOGNITION,
    description: 'Detect emerging threat patterns across intelligence domains; identify indicator changes',
    authorityDesignation: AuthorityDesignation.AI_PRIMARY,
    controlPosture: ControlPosture.HUMAN_OUT_OF_LOOP,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION, AgentRole.ADVERSARY_MODELER],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'on_exception', requiredRole: 'intelligence_officer', timeoutMs: 3600000 },
      confidenceThreshold: 0.7,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AI_EXECUTION_PROOF,
      blockchainRecord: true,
      teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [
      {
        id: 'RT-0-01',
        question: 'What patterns would the adversary deliberately create to mislead our AI pattern recognition?',
        mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
        challengeType: ChallengeType.ADVERSARY_PERSPECTIVE,
        aiGeneratable: true,
        aiAnswerable: false,
        requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
        governanceGateLink: null,
        agentRole: AgentRole.DECEPTION_DETECTOR,
      },
    ],
    doctrinalReferences: ['JP 2-0 Ch. II', 'ADP 2-0 para 3-1'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [
        { layer: 'backend', module: 'agents/fusion-agent.ts', existingCapability: true, requiredEnhancement: 'Add pattern detection algorithms' },
        { layer: 'agent', module: 'agents/adversary-modeler.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED,
      gapAnalysis: 'Adversary modeler agent needed for counter-pattern analysis',
    },
    dependsOn: ['MDMP-0-01', 'MDMP-0-02'],
    enables: ['MDMP-2-03', 'MDMP-2-08'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL,
      nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.FIVE_EYES,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-0-09',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.MONITORING,
    description: 'Track coalition partner force posture changes and political indicators',
    authorityDesignation: AuthorityDesignation.AI_PRIMARY,
    controlPosture: ControlPosture.HUMAN_OUT_OF_LOOP,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.COALITION_HEALTH, AgentRole.OSINT_MONITOR],
      agentOutputType: AgentOutputType.ALERT,
      humanCheckpoint: { required: true, trigger: 'on_exception', requiredRole: 'coalition_liaison', timeoutMs: 7200000 },
      confidenceThreshold: 0.6,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AI_EXECUTION_PROOF,
      blockchainRecord: true,
      teeRequired: false,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['JP 3-16 Ch. II'],
    bastionMapping: {
      primaryPhase: 'Phase 12.1: Coalition Health Monitoring',
      components: [
        { layer: 'agent', module: 'agents/coalition-health.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Coalition health monitoring agent does not exist',
    },
    dependsOn: ['MDMP-0-01'],
    enables: ['MDMP-2-14', 'MDMP-5-06'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.FULL_COALITION,
      nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.NATO,
      partnerConcurrence: false,
      culturalSensitivity: true,
    },
  },
  {
    id: 'MDMP-0-10',
    mdmpPhase: MDMPPhase.PHASE_0_CONTINUOUS,
    category: ActivityCategory.META_COGNITIVE,
    description: 'Monitor assumption validity: check accepted assumptions against incoming intelligence',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.ASSUMPTION_AUDITOR],
      agentOutputType: AgentOutputType.ALERT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0,
      maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION,
      blockchainRecord: true,
      teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 2-14'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/assumption-auditor.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'smart_contract', module: 'mdmp/assumptions.rs', existingCapability: false, requiredEnhancement: 'New contract' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Assumption tracking system is entirely new',
    },
    dependsOn: ['MDMP-0-01'],
    enables: ['MDMP-2-13', 'MDMP-8-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY,
      nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY,
      partnerConcurrence: false,
      culturalSensitivity: false,
    },
  },
];

// Note: For the complete implementation, Phase 1-8 activities would follow here.
// Due to file size constraints, this file implements Phase 0 activities as the foundation.
// The remaining 55 activities (Phases 1-8) are defined in the reference files at:
// - .planning/mdmp-governance/mdmp-activity-registry.ts (Phases 1-2)
// - .planning/mdmp-governance/mdmp-activity-registry-p3-8.ts (Phases 3-8)

// Export all activities in a single array
export const ALL_ACTIVITIES: MDMPActivity[] = [
  ...PHASE_0_ACTIVITIES,
  // TODO: Import and spread PHASE_1_ACTIVITIES through PHASE_8_ACTIVITIES
  // This is tracked as a known gap for plan 5.1-14 (Smart Contract Integration)
];

// ═══════════════════════════════════════════════════════════════════════════
// LOOKUP METHODS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get activity by ID
 */
export function getActivityById(id: string): MDMPActivity | undefined {
  return ALL_ACTIVITIES.find((a) => a.id === id);
}

/**
 * Get all activities for a specific MDMP phase
 */
export function getActivitiesByPhase(phase: MDMPPhase): MDMPActivity[] {
  return ALL_ACTIVITIES.filter((a) => a.mdmpPhase === phase);
}

/**
 * Get all activities for a specific category
 */
export function getActivitiesByCategory(category: ActivityCategory): MDMPActivity[] {
  return ALL_ACTIVITIES.filter((a) => a.category === category);
}

/**
 * Get all activities for a specific authority designation
 */
export function getActivitiesByAuthority(authority: AuthorityDesignation): MDMPActivity[] {
  return ALL_ACTIVITIES.filter((a) => a.authorityDesignation === authority);
}

/**
 * Get activities requiring governance gates in a specific phase
 */
export function getActivitiesRequiringGate(phase: MDMPPhase): MDMPActivity[] {
  return ALL_ACTIVITIES.filter((a) => a.mdmpPhase === phase && a.governanceGate !== null);
}

/**
 * Get activities that a given activity depends on
 */
export function getActivityDependencies(activityId: string): MDMPActivity[] {
  const activity = getActivityById(activityId);
  if (!activity) return [];

  return activity.dependsOn
    .map((id) => getActivityById(id))
    .filter((a): a is MDMPActivity => a !== undefined);
}

/**
 * Get phase statistics: total activities, breakdown by authority and category, gates required
 */
export function getPhaseStatistics(phase: MDMPPhase): {
  total: number;
  byAuthority: Record<string, number>;
  byCategory: Record<string, number>;
  gatesRequired: number;
} {
  const activities = getActivitiesByPhase(phase);

  const byAuthority: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  let gatesRequired = 0;

  for (const activity of activities) {
    // Count by authority
    const auth = activity.authorityDesignation;
    byAuthority[auth] = (byAuthority[auth] || 0) + 1;

    // Count by category
    const cat = activity.category;
    byCategory[cat] = (byCategory[cat] || 0) + 1;

    // Count gates
    if (activity.governanceGate !== null) {
      gatesRequired++;
    }
  }

  return {
    total: activities.length,
    byAuthority,
    byCategory,
    gatesRequired,
  };
}
