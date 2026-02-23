/**
 * MDMP Activity Registry - Phases 3-8
 * Continuation of mdmp-activity-registry.ts
 */

import {
  MDMPPhase, ActivityCategory, AuthorityDesignation, ControlPosture,
  DAOTier, AgentRole, AgentOutputType, GateType,
  VerificationMechanism, EvidenceType, RetentionPeriod, AuditRequirement,
  ChallengeType, ResponseDepth, CoalitionImpact, SharingLevel,
  ImplementationStatus, EscalationPath,
  type MDMPActivity,
} from './mdmp-types.js';

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 3: COA DEVELOPMENT
// AI-heavy generation phase. AI generates COA candidates; human validates
// strategic alignment and feasibility.
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_3_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-3-01',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.COA_GENERATION,
    description: 'Generate initial COA set: at least 3 viable COAs exploring different force combinations, phasing, and approaches',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true,
      agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_GENERATOR, AgentRole.RAFT_REASONING, AgentRole.STRATEGIC_FUSION],
      agentOutputType: AgentOutputType.SCENARIO_SET,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'planning_officer', timeoutMs: 28800000 },
      confidenceThreshold: 0.7,
      maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION,
      blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [
      {
        id: 'RT-3-01', question: 'Are all COAs actually distinct, or are they variations of the same approach?',
        mdmpPhase: MDMPPhase.PHASE_3_COA_DEV, challengeType: ChallengeType.INSTITUTIONAL_BIAS,
        aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
        governanceGateLink: null, agentRole: AgentRole.RED_TEAM_SIMULATOR,
      },
      {
        id: 'RT-3-02', question: 'What COA would the adversary most want us to adopt?',
        mdmpPhase: MDMPPhase.PHASE_3_COA_DEV, challengeType: ChallengeType.ADVERSARY_PERSPECTIVE,
        aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
        governanceGateLink: null, agentRole: AgentRole.ADVERSARY_MODELER,
      },
    ],
    doctrinalReferences: ['ADP 5-0 para 3-2', 'FM 6-0 Ch. 10'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [
        { layer: 'backend', module: 'agents/coa-generator.ts', existingCapability: true, requiredEnhancement: 'Add multi-domain COA templates' },
      ],
      implementationStatus: ImplementationStatus.PARTIALLY_IMPLEMENTED,
      gapAnalysis: 'COA generator exists but needs MDMP-specific templates',
    },
    dependsOn: ['MDMP-2-11', 'MDMP-2-13', 'MDMP-2-08', 'MDMP-2-06'],
    enables: ['MDMP-3-02', 'MDMP-3-03', 'MDMP-3-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-3-02',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.VALIDATION_CONSISTENCY,
    description: 'Validate each COA against doctrine, ROE, constraints, and commander guidance; flag violations',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ORDERS_VALIDATOR, AgentRole.ROE_COMPLIANCE],
      agentOutputType: AgentOutputType.COMPLIANCE_CHECK,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG, EvidenceType.COMPLIANCE_CHECK],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 3-6', 'FM 6-27'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/orders-validator.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'agent', module: 'agents/roe-compliance.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-3-01', 'MDMP-2-05', 'MDMP-2-09', 'MDMP-2-12'],
    enables: ['MDMP-3-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-3-03',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.COA_GENERATION,
    description: 'Develop COA sketches: scheme of maneuver, task org, force flow, sync matrix per COA',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_GENERATOR, AgentRole.EFFECT_CASCADER],
      agentOutputType: AgentOutputType.DRAFT_PRODUCT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'operations_officer', timeoutMs: 28800000 },
      confidenceThreshold: 0.7, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 3-8', 'FM 6-0 para 10-12'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [
        { layer: 'backend', module: 'agents/coa-generator.ts', existingCapability: true, requiredEnhancement: 'Add COA sketch generation' },
        { layer: 'agent', module: 'agents/effect-cascader.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED,
      gapAnalysis: 'COA sketch generation and effect cascading are new capabilities',
    },
    dependsOn: ['MDMP-3-01', 'MDMP-2-06', 'MDMP-2-14'],
    enables: ['MDMP-3-05', 'MDMP-4-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-3-04',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.ASSUMPTION_MGMT,
    description: 'Surface new assumptions introduced by each COA; link to assumption registry',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ASSUMPTION_AUDITOR],
      agentOutputType: AgentOutputType.GAP_ANALYSIS,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'planning_officer', timeoutMs: 14400000 },
      confidenceThreshold: 0.65, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.ASSUMPTION_ACCEPTANCE],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-3-03', question: 'What hidden assumptions does each COA introduce that we are not tracking?',
      mdmpPhase: MDMPPhase.PHASE_3_COA_DEV, challengeType: ChallengeType.ASSUMPTION_CHALLENGE,
      aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
      governanceGateLink: null, agentRole: AgentRole.ASSUMPTION_AUDITOR,
    }],
    doctrinalReferences: ['ADP 5-0 para 2-14'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/assumption-auditor.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'smart_contract', module: 'mdmp/assumptions.rs', existingCapability: false, requiredEnhancement: 'New contract' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-3-01', 'MDMP-3-02'],
    enables: ['MDMP-4-03'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-3-05',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.COA_GENERATION,
    description: 'Cascade effects analysis: map second/third-order effects of each COA across all domains',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.EFFECT_CASCADER, AgentRole.ESCALATION_MODELER, AgentRole.NARRATIVE_IMPACT],
      agentOutputType: AgentOutputType.EFFECT_CHAIN,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'planning_officer', timeoutMs: 14400000 },
      confidenceThreshold: 0.6, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [
      {
        id: 'RT-3-04', question: 'What unintended escalation dynamics could each COA trigger?',
        mdmpPhase: MDMPPhase.PHASE_3_COA_DEV, challengeType: ChallengeType.ESCALATION_RISK,
        aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.WARGAME_TESTED,
        governanceGateLink: null, agentRole: AgentRole.ESCALATION_MODELER,
      },
      {
        id: 'RT-3-05', question: 'What second-order effects on civilian population or information environment are we not modeling?',
        mdmpPhase: MDMPPhase.PHASE_3_COA_DEV, challengeType: ChallengeType.SECOND_ORDER_EFFECT,
        aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
        governanceGateLink: null, agentRole: AgentRole.NARRATIVE_IMPACT,
      },
    ],
    doctrinalReferences: ['JP 5-0 Ch. IV para 7', 'ADP 3-0 para 3-4'],
    bastionMapping: {
      primaryPhase: 'Phase 5.2: Escalation & Competition Modeling',
      components: [
        { layer: 'agent', module: 'agents/effect-cascader.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'agent', module: 'agents/escalation-modeler.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'agent', module: 'agents/narrative-impact.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Effect cascading, escalation modeling, narrative impact are all new',
    },
    dependsOn: ['MDMP-3-03'],
    enables: ['MDMP-4-01', 'MDMP-4-02'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: true,
    },
  },
  {
    id: 'MDMP-3-06',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.COA_GENERATION,
    description: 'Develop branch plans and sequel plans for each COA; model decision points for transition',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_GENERATOR, AgentRole.RAFT_REASONING],
      agentOutputType: AgentOutputType.SCENARIO_SET,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'planning_officer', timeoutMs: 28800000 },
      confidenceThreshold: 0.65, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 3-12', 'JP 5-0 Ch. IV para 12'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/coa-generator.ts', existingCapability: true, requiredEnhancement: 'Add branch/sequel planning' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Branch/sequel planning templates needed',
    },
    dependsOn: ['MDMP-3-03'],
    enables: ['MDMP-4-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-3-07',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.SUSTAINMENT,
    description: 'Model sustainment requirements per COA: logistics, force flow, medical, maintenance',
    authorityDesignation: AuthorityDesignation.AI_PRIMARY,
    controlPosture: ControlPosture.HUMAN_OUT_OF_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'on_exception', requiredRole: 'logistics_officer', timeoutMs: 14400000 },
      confidenceThreshold: 0.7, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.AI_EXECUTION_PROOF, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 4-0', 'FM 4-0 Ch. 6'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/fusion-agent.ts', existingCapability: true, requiredEnhancement: 'Add sustainment modeling' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Sustainment modeling module needed',
    },
    dependsOn: ['MDMP-3-03'],
    enables: ['MDMP-4-01', 'MDMP-5-03'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-3-08',
    mdmpPhase: MDMPPhase.PHASE_3_COA_DEV,
    category: ActivityCategory.AUTHORITY_DECISION,
    description: 'COA Development brief to Commander; authorize transition to COA Analysis (Wargaming)',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.PHASE_TRANSITION,
      approvalThreshold: { approvalPercentage: 67, quorumPercentage: 67, vetoThreshold: 33, unanimousRequired: false },
      vetoEnabled: true, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.COMMANDER_OVERRIDE, bypassConditions: [],
    },
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.VOTE_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 3-14'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [{ layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'Phase transition gate' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-3-01', 'MDMP-3-03', 'MDMP-3-05'],
    enables: ['MDMP-4-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 4: COA ANALYSIS (WARGAMING)
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_4_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-4-01',
    mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS,
    category: ActivityCategory.WARGAMING,
    description: 'Conduct wargaming: action-reaction-counteraction across all COAs against adversary MLCOA and MDCOA',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.RED_TEAM_SIMULATOR, AgentRole.ADVERSARY_MODELER, AgentRole.COA_GENERATOR],
      agentOutputType: AgentOutputType.SCENARIO_SET,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'planning_officer', timeoutMs: 28800000 },
      confidenceThreshold: 0.6, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [
      {
        id: 'RT-4-01', question: 'What are the wargame model\'s built-in assumptions? How do they bias outcomes?',
        mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS, challengeType: ChallengeType.BIAS_CHECK,
        aiGeneratable: true, aiAnswerable: false, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
        governanceGateLink: null, agentRole: AgentRole.DATA_BIAS_DETECTOR,
      },
      {
        id: 'RT-4-02', question: 'What unexpected adversary response would break our plan?',
        mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS, challengeType: ChallengeType.ADVERSARY_PERSPECTIVE,
        aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.WARGAME_TESTED,
        governanceGateLink: null, agentRole: AgentRole.RED_TEAM_SIMULATOR,
      },
    ],
    doctrinalReferences: ['ADP 5-0 para 4-2', 'FM 6-0 Ch. 11'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [
        { layer: 'backend', module: 'agents/red-team-simulator.ts', existingCapability: true, requiredEnhancement: 'Expand to full wargaming' },
        { layer: 'agent', module: 'agents/adversary-modeler.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.PARTIALLY_IMPLEMENTED,
      gapAnalysis: 'Red team simulator exists; needs full wargaming capability',
    },
    dependsOn: ['MDMP-3-08', 'MDMP-3-03', 'MDMP-3-05', 'MDMP-3-06', 'MDMP-2-08'],
    enables: ['MDMP-4-02', 'MDMP-4-03', 'MDMP-4-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.FIVE_EYES, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-4-02',
    mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS,
    category: ActivityCategory.WARGAMING,
    description: 'Model escalation dynamics for each COA; run escalation ladder simulations at multiple intensity levels',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ESCALATION_MODELER, AgentRole.RED_TEAM_SIMULATOR],
      agentOutputType: AgentOutputType.ESCALATION_MODEL,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'operations_officer', timeoutMs: 14400000 },
      confidenceThreshold: 0.55, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-4-03', question: 'What escalation pathway are we most blind to?',
      mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS, challengeType: ChallengeType.ESCALATION_RISK,
      aiGeneratable: true, aiAnswerable: false, requiredResponseDepth: ResponseDepth.WARGAME_TESTED,
      governanceGateLink: null, agentRole: AgentRole.ESCALATION_MODELER,
    }],
    doctrinalReferences: ['JP 5-0 Ch. IV para 14', 'JP 3-0 Ch. III'],
    bastionMapping: {
      primaryPhase: 'Phase 5.2: Escalation & Competition Modeling',
      components: [{ layer: 'agent', module: 'agents/escalation-modeler.ts', existingCapability: false, requiredEnhancement: 'New agent' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT,
      gapAnalysis: 'Escalation modeling is entirely new capability',
    },
    dependsOn: ['MDMP-4-01', 'MDMP-3-05'],
    enables: ['MDMP-5-01', 'MDMP-5-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.FIVE_EYES, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-4-03',
    mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS,
    category: ActivityCategory.ASSUMPTION_MGMT,
    description: 'Test planning assumptions through wargame outcomes; flag assumptions that break under stress',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ASSUMPTION_AUDITOR, AgentRole.RED_TEAM_SIMULATOR],
      agentOutputType: AgentOutputType.GAP_ANALYSIS,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'planning_officer', timeoutMs: 14400000 },
      confidenceThreshold: 0.6, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.ASSUMPTION_ACCEPTANCE],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 4-8'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [{ layer: 'agent', module: 'agents/assumption-auditor.ts', existingCapability: false, requiredEnhancement: 'New agent' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-4-01', 'MDMP-3-04'],
    enables: ['MDMP-5-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-4-04',
    mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS,
    category: ActivityCategory.DATA_AGGREGATION,
    description: 'Extract decision points, HPTs, and information requirements from wargame outcomes',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.RAFT_EXTRACTION],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 4-10', 'FM 6-0 para 11-16'],
    bastionMapping: {
      primaryPhase: 'Phase 4.2: RAFT Pipeline',
      components: [{ layer: 'backend', module: 'agents/raft-extraction.ts', existingCapability: true, requiredEnhancement: 'Add wargame data extraction' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Wargame output extraction templates needed',
    },
    dependsOn: ['MDMP-4-01'],
    enables: ['MDMP-5-01', 'MDMP-7-02'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-4-05',
    mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS,
    category: ActivityCategory.RED_TEAMING,
    description: 'Formal red team review of wargame methodology, assumptions, and outcomes',
    authorityDesignation: AuthorityDesignation.HYBRID_HUMAN_LED,
    controlPosture: ControlPosture.HUMAN_IN_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: {
      required: true, gateType: GateType.RED_TEAM_GATE,
      approvalThreshold: { approvalPercentage: 50, quorumPercentage: 50, vetoThreshold: null, unanimousRequired: false },
      vetoEnabled: false, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.CHIEF_OF_STAFF, bypassConditions: [],
    },
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.RED_TEAM_SIMULATOR, AgentRole.DATA_BIAS_DETECTOR],
      agentOutputType: AgentOutputType.CHALLENGE_SET,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'red_team_lead', timeoutMs: 14400000 },
      confidenceThreshold: 0.5, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.RED_TEAM_RESPONSE, EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ATP 2-01 Appendix G', 'ADP 5-0 para 4-12'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [
        { layer: 'backend', module: 'agents/red-team-simulator.ts', existingCapability: true, requiredEnhancement: 'Add formal red team workflow' },
        { layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'Red team gate' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED,
      gapAnalysis: 'Red team gate enforcement needed',
    },
    dependsOn: ['MDMP-4-01'],
    enables: ['MDMP-4-06'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.FIVE_EYES, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-4-06',
    mdmpPhase: MDMPPhase.PHASE_4_COA_ANALYSIS,
    category: ActivityCategory.AUTHORITY_DECISION,
    description: 'Commander reviews wargaming results; authorize transition to COA Comparison',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.PHASE_TRANSITION,
      approvalThreshold: { approvalPercentage: 67, quorumPercentage: 67, vetoThreshold: 33, unanimousRequired: false },
      vetoEnabled: true, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.COMMANDER_OVERRIDE, bypassConditions: [],
    },
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.VOTE_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 4-14'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [{ layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'Phase transition gate' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-4-01', 'MDMP-4-05'],
    enables: ['MDMP-5-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 5: COA COMPARISON
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_5_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-5-01',
    mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE,
    category: ActivityCategory.COA_EVALUATION,
    description: 'Build decision matrix: weight criteria; score each COA using wargame data with confidence intervals',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_COMPARATOR, AgentRole.UNCERTAINTY_QUANTIFIER],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'chief_of_staff', timeoutMs: 14400000 },
      confidenceThreshold: 0.7, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-5-01', question: 'Do our evaluation criteria actually distinguish between COAs, or produce false precision?',
      mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE, challengeType: ChallengeType.BIAS_CHECK,
      aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
      governanceGateLink: null, agentRole: AgentRole.UNCERTAINTY_QUANTIFIER,
    }],
    doctrinalReferences: ['ADP 5-0 para 5-2', 'FM 6-0 Ch. 12'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [
        { layer: 'backend', module: 'agents/coa-comparator.ts', existingCapability: true, requiredEnhancement: 'Add uncertainty quantification' },
        { layer: 'agent', module: 'agents/uncertainty-quantifier.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED,
      gapAnalysis: 'Uncertainty quantifier needed',
    },
    dependsOn: ['MDMP-4-06', 'MDMP-4-02', 'MDMP-4-03', 'MDMP-4-04'],
    enables: ['MDMP-5-02', 'MDMP-5-03'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-5-02',
    mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE,
    category: ActivityCategory.COA_EVALUATION,
    description: 'Sensitivity analysis: how do rankings change under different weights and uncertainty bounds?',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_COMPARATOR, AgentRole.UNCERTAINTY_QUANTIFIER],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'on_low_confidence', requiredRole: 'planning_officer', timeoutMs: 7200000 },
      confidenceThreshold: 0.65, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 5-6'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/coa-comparator.ts', existingCapability: true, requiredEnhancement: 'Add sensitivity analysis' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Sensitivity analysis capability needed',
    },
    dependsOn: ['MDMP-5-01'],
    enables: ['MDMP-5-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-5-03',
    mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE,
    category: ActivityCategory.SUSTAINMENT,
    description: 'Compare sustainment feasibility across COAs: risk to sustainment, logistics reach, constraints',
    authorityDesignation: AuthorityDesignation.AI_PRIMARY,
    controlPosture: ControlPosture.HUMAN_OUT_OF_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION, AgentRole.COA_COMPARATOR],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'on_exception', requiredRole: 'logistics_officer', timeoutMs: 7200000 },
      confidenceThreshold: 0.7, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.AI_EXECUTION_PROOF, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 4-0 Ch. 5'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/fusion-agent.ts', existingCapability: true, requiredEnhancement: 'Add sustainment comparison' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Sustainment comparison module needed',
    },
    dependsOn: ['MDMP-5-01', 'MDMP-3-07'],
    enables: ['MDMP-5-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-5-04',
    mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE,
    category: ActivityCategory.DECISION_SUPPORT,
    description: 'Generate COA recommendation brief with confidence intervals, risk profile, and assumption dependencies',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: {
      required: true, gateType: GateType.PRODUCT_APPROVAL,
      approvalThreshold: { approvalPercentage: 67, quorumPercentage: 50, vetoThreshold: 33, unanimousRequired: false },
      vetoEnabled: true, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.CHIEF_OF_STAFF, bypassConditions: [],
    },
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_COMPARATOR, AgentRole.UNCERTAINTY_QUANTIFIER],
      agentOutputType: AgentOutputType.RECOMMENDATION,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'chief_of_staff', timeoutMs: 14400000 },
      confidenceThreshold: 0.75, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL, EvidenceType.DECISION_RECORD],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-5-02', question: 'Is the recommended COA the best, or just the one with most data support?',
      mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE, challengeType: ChallengeType.BIAS_CHECK,
      aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
      governanceGateLink: null, agentRole: AgentRole.RED_TEAM_SIMULATOR,
    }],
    doctrinalReferences: ['ADP 5-0 para 5-8', 'FM 6-0 para 12-10'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/coa-comparator.ts', existingCapability: true, requiredEnhancement: 'Add recommendation with uncertainty' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Recommendation with uncertainty quantification needed',
    },
    dependsOn: ['MDMP-5-01', 'MDMP-5-02', 'MDMP-5-03', 'MDMP-4-02'],
    enables: ['MDMP-5-05'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-5-05',
    mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE,
    category: ActivityCategory.AUTHORITY_DECISION,
    description: 'Commander selects COA; staff records rationale for selection and rejected alternatives',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.PHASE_TRANSITION,
      approvalThreshold: { approvalPercentage: 67, quorumPercentage: 67, vetoThreshold: 33, unanimousRequired: false },
      vetoEnabled: true, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.COMMANDER_OVERRIDE, bypassConditions: [],
    },
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.VOTE_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 6-2'],
    bastionMapping: {
      primaryPhase: 'Phase 5: DAO Governance',
      components: [{ layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'COA approval gate' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-5-04'],
    enables: ['MDMP-6-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-5-06',
    mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE,
    category: ActivityCategory.COALITION_MGMT,
    description: 'Assess coalition partner acceptance of each COA; identify national caveat conflicts',
    authorityDesignation: AuthorityDesignation.HYBRID_HUMAN_LED,
    controlPosture: ControlPosture.HUMAN_IN_LOOP,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.COALITION_GATE,
      approvalThreshold: { approvalPercentage: 100, quorumPercentage: 67, vetoThreshold: null, unanimousRequired: false },
      vetoEnabled: false, coalitionApproval: true,
      timeConstraint: { maxDeliberationMs: 86400000, autoEscalateAfterMs: 43200000, extendable: true },
      escalationPath: EscalationPath.COALITION_ESCALATION, bypassConditions: [],
    },
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COALITION_HEALTH],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'coalition_liaison', timeoutMs: 43200000 },
      confidenceThreshold: 0.5, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.COALITION_CONSENSUS, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.COALITION_CONCURRENCE, EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-5-03', question: 'Which partner\'s constraints are we underweighting? What if they withdraw mid-execution?',
      mdmpPhase: MDMPPhase.PHASE_5_COA_COMPARE, challengeType: ChallengeType.COALITION_STRESS,
      aiGeneratable: true, aiAnswerable: false, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
      governanceGateLink: 'coalition_gate_phase_5', agentRole: AgentRole.COALITION_HEALTH,
    }],
    doctrinalReferences: ['JP 3-16 Ch. IV'],
    bastionMapping: {
      primaryPhase: 'Phase 12.1: Coalition Health Monitoring',
      components: [
        { layer: 'agent', module: 'agents/coalition-health.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'smart_contract', module: 'dao/linkages.rs', existingCapability: true, requiredEnhancement: 'Add coalition gate' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED,
      gapAnalysis: 'Coalition gate mechanism needed',
    },
    dependsOn: ['MDMP-5-01', 'MDMP-2-14', 'MDMP-0-09'],
    enables: ['MDMP-5-05'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.FULL_COALITION, nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.NATO, partnerConcurrence: true, culturalSensitivity: true,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 6: COA APPROVAL (brief phase - commander decision)
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_6_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-6-01',
    mdmpPhase: MDMPPhase.PHASE_6_COA_APPROVAL,
    category: ActivityCategory.DECISION_SUPPORT,
    description: 'Prepare decision brief: synthesize all analysis, wargame results, comparison data, and risk profiles',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.COA_COMPARATOR, AgentRole.UNCERTAINTY_QUANTIFIER, AgentRole.RAFT_REASONING],
      agentOutputType: AgentOutputType.DRAFT_PRODUCT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'chief_of_staff', timeoutMs: 14400000 },
      confidenceThreshold: 0.8, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 6-2'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/coa-comparator.ts', existingCapability: true, requiredEnhancement: 'Add brief generation' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Decision brief generation needed',
    },
    dependsOn: ['MDMP-5-05'],
    enables: ['MDMP-6-02'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-6-02',
    mdmpPhase: MDMPPhase.PHASE_6_COA_APPROVAL,
    category: ActivityCategory.AUTHORITY_DECISION,
    description: 'Commander approves COA; issues final planning guidance; records commander\'s intent',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.AUTHORITY_CHECKPOINT,
      approvalThreshold: { approvalPercentage: 100, quorumPercentage: 100, vetoThreshold: null, unanimousRequired: true },
      vetoEnabled: false, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.HIGHER_DAO_TIER, bypassConditions: [],
    },
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.VOTE_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 6-4', 'ADP 6-0 para 1-3'],
    bastionMapping: {
      primaryPhase: 'Phase 5: DAO Governance',
      components: [
        { layer: 'smart_contract', module: 'dao/types.rs', existingCapability: true, requiredEnhancement: 'CommanderGuidance ProposalKind' },
        { layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'Authority checkpoint + phase transition' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Combined authority checkpoint needed',
    },
    dependsOn: ['MDMP-6-01'],
    enables: ['MDMP-7-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-6-03',
    mdmpPhase: MDMPPhase.PHASE_6_COA_APPROVAL,
    category: ActivityCategory.RISK_JUDGMENT,
    description: 'Commander formally accepts residual risk for approved COA; record risk acceptance on blockchain',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: null,
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.RISK_ACCEPTANCE, EvidenceType.DECISION_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ATP 5-19', 'ADP 5-0 para 6-6'],
    bastionMapping: {
      primaryPhase: 'Phase 5: DAO Governance',
      components: [{ layer: 'smart_contract', module: 'dao/types.rs', existingCapability: true, requiredEnhancement: null }],
      implementationStatus: ImplementationStatus.FULLY_IMPLEMENTED, gapAnalysis: null,
    },
    dependsOn: ['MDMP-6-02'],
    enables: ['MDMP-7-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7: ORDERS PRODUCTION
// AI drafts; human validates intent, clarity, and executability
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_7_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-7-01',
    mdmpPhase: MDMPPhase.PHASE_7_ORDERS,
    category: ActivityCategory.ORDERS_PRODUCTION,
    description: 'Draft OPLAN/OPORD from approved COA: base order, annexes, appendices in standard format',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.RAFT_REASONING, AgentRole.ORDERS_VALIDATOR],
      agentOutputType: AgentOutputType.DRAFT_PRODUCT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'operations_officer', timeoutMs: 28800000 },
      confidenceThreshold: 0.8, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 7-2', 'FM 6-0 Ch. 13'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'backend', module: 'agents/raft-reasoning.ts', existingCapability: true, requiredEnhancement: 'Add OPORD generation templates' },
        { layer: 'agent', module: 'agents/orders-validator.ts', existingCapability: false, requiredEnhancement: 'New agent' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'OPORD generation templates needed',
    },
    dependsOn: ['MDMP-6-02', 'MDMP-6-03'],
    enables: ['MDMP-7-02', 'MDMP-7-03'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-7-02',
    mdmpPhase: MDMPPhase.PHASE_7_ORDERS,
    category: ActivityCategory.VALIDATION_CONSISTENCY,
    description: 'Validate orders for internal consistency, completeness, and traceability to commander intent',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ORDERS_VALIDATOR],
      agentOutputType: AgentOutputType.VALIDATION_RESULT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG, EvidenceType.COMPLIANCE_CHECK],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 7-6'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [{ layer: 'agent', module: 'agents/orders-validator.ts', existingCapability: false, requiredEnhancement: 'New agent' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-7-01', 'MDMP-4-04'],
    enables: ['MDMP-7-03'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-7-03',
    mdmpPhase: MDMPPhase.PHASE_7_ORDERS,
    category: ActivityCategory.ORDERS_PRODUCTION,
    description: 'Simulate degraded execution: model what happens if comms fail, units delayed, or assumptions break',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ORDERS_VALIDATOR, AgentRole.RED_TEAM_SIMULATOR],
      agentOutputType: AgentOutputType.SCENARIO_SET,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'operations_officer', timeoutMs: 14400000 },
      confidenceThreshold: 0.6, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.MISSION_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-7-01', question: 'What single point of failure in our orders would cause mission collapse under DDIL?',
      mdmpPhase: MDMPPhase.PHASE_7_ORDERS, challengeType: ChallengeType.FAILURE_MODE,
      aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.WARGAME_TESTED,
      governanceGateLink: null, agentRole: AgentRole.RED_TEAM_SIMULATOR,
    }],
    doctrinalReferences: ['ADP 5-0 para 7-8', 'ADP 6-0 para 4-6'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/orders-validator.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'backend', module: 'agents/red-team-simulator.ts', existingCapability: true, requiredEnhancement: 'Add degraded execution sim' },
      ],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Degraded execution simulation needed',
    },
    dependsOn: ['MDMP-7-01', 'MDMP-7-02'],
    enables: ['MDMP-7-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-7-04',
    mdmpPhase: MDMPPhase.PHASE_7_ORDERS,
    category: ActivityCategory.ETHICAL_LEGAL,
    description: 'Legal review of orders: ROE compliance, LOAC adherence, targeting authority verification',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: null,
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.COMPLIANCE_CHECK,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'legal_advisor', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.COMPLIANCE_CHECK],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['FM 6-27', 'DoD Law of War Manual'],
    bastionMapping: {
      primaryPhase: 'Phase 5: DAO Governance',
      components: [{ layer: 'smart_contract', module: 'dao/types.rs', existingCapability: true, requiredEnhancement: null }],
      implementationStatus: ImplementationStatus.FULLY_IMPLEMENTED, gapAnalysis: null,
    },
    dependsOn: ['MDMP-7-01', 'MDMP-2-09'],
    enables: ['MDMP-7-05'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: true,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: true, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-7-05',
    mdmpPhase: MDMPPhase.PHASE_7_ORDERS,
    category: ActivityCategory.AUTHORITY_DECISION,
    description: 'Commander signs orders; approve for publication and dissemination',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.PRODUCT_APPROVAL,
      approvalThreshold: { approvalPercentage: 100, quorumPercentage: 100, vetoThreshold: null, unanimousRequired: true },
      vetoEnabled: false, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.HIGHER_DAO_TIER, bypassConditions: [],
    },
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.VOTE_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 7-10'],
    bastionMapping: {
      primaryPhase: 'Phase 5: DAO Governance',
      components: [{ layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'OPORD approval gate' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-7-01', 'MDMP-7-04'],
    enables: ['MDMP-8-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 8: ASSESSMENT
// Continuous loop back to Phase 0. AI monitors execution; human decides.
// ═══════════════════════════════════════════════════════════════════════════

export const PHASE_8_ACTIVITIES: MDMPActivity[] = [
  {
    id: 'MDMP-8-01',
    mdmpPhase: MDMPPhase.PHASE_8_ASSESSMENT,
    category: ActivityCategory.ASSESSMENT,
    description: 'Monitor execution against plan: track MOE, MOP, and indicator status across all domains',
    authorityDesignation: AuthorityDesignation.AI_PRIMARY,
    controlPosture: ControlPosture.HUMAN_OUT_OF_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION, AgentRole.OSINT_MONITOR],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'on_exception', requiredRole: 'operations_officer', timeoutMs: 3600000 },
      confidenceThreshold: 0.6, maxAutonomyOverride: true,
    },
    verification: {
      mechanism: VerificationMechanism.AI_EXECUTION_PROOF, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [{
      id: 'RT-8-01', question: 'Are our MOE/MOP actually measuring progress, or just measuring what is easy to measure?',
      mdmpPhase: MDMPPhase.PHASE_8_ASSESSMENT, challengeType: ChallengeType.BIAS_CHECK,
      aiGeneratable: true, aiAnswerable: true, requiredResponseDepth: ResponseDepth.STRUCTURED_ANALYSIS,
      governanceGateLink: null, agentRole: AgentRole.DATA_BIAS_DETECTOR,
    }],
    doctrinalReferences: ['ADP 5-0 para 8-2', 'JP 5-0 Ch. VI'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [{ layer: 'backend', module: 'agents/fusion-agent.ts', existingCapability: true, requiredEnhancement: 'Add assessment tracking' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Assessment tracking module needed',
    },
    dependsOn: ['MDMP-7-05', 'MDMP-0-04'],
    enables: ['MDMP-8-02', 'MDMP-8-03', 'MDMP-8-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-8-02',
    mdmpPhase: MDMPPhase.PHASE_8_ASSESSMENT,
    category: ActivityCategory.ASSESSMENT,
    description: 'Detect significant deviations from plan; generate branch plan activation recommendations',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.STRATEGIC_FUSION, AgentRole.COA_COMPARATOR],
      agentOutputType: AgentOutputType.RECOMMENDATION,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'operations_officer', timeoutMs: 3600000 },
      confidenceThreshold: 0.65, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: true,
      evidenceTypes: [EvidenceType.ANALYSIS_ARTIFACT, EvidenceType.CONFIDENCE_INTERVAL],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 8-6', 'JP 5-0 Ch. VI para 8'],
    bastionMapping: {
      primaryPhase: 'Phase 4.3: COA Analysis',
      components: [{ layer: 'backend', module: 'agents/coa-comparator.ts', existingCapability: true, requiredEnhancement: 'Add deviation detection' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Deviation detection and branch plan recommendation needed',
    },
    dependsOn: ['MDMP-8-01'],
    enables: ['MDMP-8-05'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.MULTILATERAL, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-8-03',
    mdmpPhase: MDMPPhase.PHASE_8_ASSESSMENT,
    category: ActivityCategory.MONITORING,
    description: 'Continuous intelligence update: feed assessment data back to Phase 0 monitoring loop',
    authorityDesignation: AuthorityDesignation.AI_AUTONOMOUS,
    controlPosture: ControlPosture.FULLY_DELEGATED,
    daoTier: DAOTier.TACTICAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.OSINT_MONITOR, AgentRole.STRATEGIC_FUSION],
      agentOutputType: AgentOutputType.ALERT,
      humanCheckpoint: { required: false, trigger: 'never', requiredRole: null, timeoutMs: null },
      confidenceThreshold: 0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.AUTOMATED_VALIDATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.VALIDATION_LOG],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.BATCH,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 8-8'],
    bastionMapping: {
      primaryPhase: 'Phase 3: Intelligence Framework',
      components: [{ layer: 'backend', module: 'agents/osint-monitor.ts', existingCapability: true, requiredEnhancement: 'Add assessment feedback loop' }],
      implementationStatus: ImplementationStatus.GAP_IDENTIFIED, gapAnalysis: 'Assessment-to-monitoring feedback loop needed',
    },
    dependsOn: ['MDMP-8-01'],
    enables: ['MDMP-0-01', 'MDMP-0-04'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.FULL_COALITION, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.MISSION_PARTNERS, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-8-04',
    mdmpPhase: MDMPPhase.PHASE_8_ASSESSMENT,
    category: ActivityCategory.ASSUMPTION_MGMT,
    description: 'Re-evaluate assumptions against execution reality; flag invalidated assumptions for replanning',
    authorityDesignation: AuthorityDesignation.HYBRID_AI_LED,
    controlPosture: ControlPosture.HUMAN_ON_LOOP,
    daoTier: DAOTier.OPERATIONAL,
    governanceGate: null,
    agentSupport: {
      enabled: true, agentPhase: 'Support',
      requiredAgents: [AgentRole.ASSUMPTION_AUDITOR],
      agentOutputType: AgentOutputType.ALERT,
      humanCheckpoint: { required: true, trigger: 'on_escalation', requiredRole: 'planning_officer', timeoutMs: 3600000 },
      confidenceThreshold: 0.6, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.DUAL_VERIFICATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.ASSUMPTION_ACCEPTANCE, EvidenceType.ANALYSIS_ARTIFACT],
      retentionPeriod: RetentionPeriod.CAMPAIGN_DURATION,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 2-14', 'JP 5-0 Ch. VI para 12'],
    bastionMapping: {
      primaryPhase: 'Phase 5.1: MDMP Governance Integration',
      components: [
        { layer: 'agent', module: 'agents/assumption-auditor.ts', existingCapability: false, requiredEnhancement: 'New agent' },
        { layer: 'smart_contract', module: 'mdmp/assumptions.rs', existingCapability: false, requiredEnhancement: 'INVARIANT 6 enforcement' },
      ],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-8-01', 'MDMP-2-13', 'MDMP-0-10'],
    enables: ['MDMP-8-05'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
  {
    id: 'MDMP-8-05',
    mdmpPhase: MDMPPhase.PHASE_8_ASSESSMENT,
    category: ActivityCategory.AUTHORITY_DECISION,
    description: 'Commander decides: continue current plan, activate branch plan, or initiate replanning (back to Phase 2)',
    authorityDesignation: AuthorityDesignation.HUMAN_ONLY,
    controlPosture: ControlPosture.HUMAN_EXCLUSIVE,
    daoTier: DAOTier.STRATEGIC,
    governanceGate: {
      required: true, gateType: GateType.AUTHORITY_CHECKPOINT,
      approvalThreshold: { approvalPercentage: 100, quorumPercentage: 100, vetoThreshold: null, unanimousRequired: true },
      vetoEnabled: false, coalitionApproval: false, timeConstraint: null,
      escalationPath: EscalationPath.HIGHER_DAO_TIER, bypassConditions: [
        { condition: 'DDIL_DEGRADED', authorizedBy: 'commanding_general', auditRequired: true, maxDurationMs: 86400000 },
      ],
    },
    agentSupport: {
      enabled: false, agentPhase: 'Support', requiredAgents: [],
      agentOutputType: AgentOutputType.ANALYSIS_REPORT,
      humanCheckpoint: { required: true, trigger: 'always', requiredRole: 'commander', timeoutMs: null },
      confidenceThreshold: 1.0, maxAutonomyOverride: false,
    },
    verification: {
      mechanism: VerificationMechanism.HUMAN_ATTESTATION, blockchainRecord: true, teeRequired: false,
      evidenceTypes: [EvidenceType.DECISION_RECORD, EvidenceType.VOTE_RECORD],
      retentionPeriod: RetentionPeriod.PERMANENT,
    },
    auditRequirement: AuditRequirement.REAL_TIME,
    redTeamChallenges: [],
    doctrinalReferences: ['ADP 5-0 para 8-10', 'JP 5-0 Ch. VI para 14'],
    bastionMapping: {
      primaryPhase: 'Phase 5: DAO Governance',
      components: [{ layer: 'smart_contract', module: 'mdmp/workflow.rs', existingCapability: false, requiredEnhancement: 'Assessment decision gate' }],
      implementationStatus: ImplementationStatus.NEW_REQUIREMENT, gapAnalysis: null,
    },
    dependsOn: ['MDMP-8-02', 'MDMP-8-04'],
    enables: ['MDMP-2-01'],
    minimumClassification: 'SECRET',
    coalitionRelevance: {
      coalitionImpact: CoalitionImpact.US_ONLY, nationalCaveatSensitive: false,
      informationSharingLevel: SharingLevel.NATIONAL_ONLY, partnerConcurrence: false, culturalSensitivity: false,
    },
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY AGGREGATE
// ═══════════════════════════════════════════════════════════════════════════

export const ALL_ACTIVITIES: MDMPActivity[] = [
  ...PHASE_3_ACTIVITIES,
  ...PHASE_4_ACTIVITIES,
  ...PHASE_5_ACTIVITIES,
  ...PHASE_6_ACTIVITIES,
  ...PHASE_7_ACTIVITIES,
  ...PHASE_8_ACTIVITIES,
];

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Activity counts by authority designation (Phases 3-8):
 *
 * AI_AUTONOMOUS:     4  (MDMP-3-02, 4-04, 7-02, 8-03)
 * AI_PRIMARY:        3  (MDMP-3-07, 5-03, 8-01)
 * HYBRID_AI_LED:    16  (MDMP-3-01,03,04,05,06, 4-01,02,03, 5-01,02,04, 6-01, 7-01,03, 8-02,04)
 * HYBRID_HUMAN_LED:  3  (MDMP-4-05, 5-06, 2-02)
 * HUMAN_ONLY:       10  (MDMP-3-08, 4-06, 5-05, 6-02,03, 7-04,05, 8-05)
 *
 * Combined with Phases 0-2 (from mdmp-activity-registry.ts):
 *   Phase 0: 11 activities (7 AI_AUTONOMOUS, 2 AI_PRIMARY, 1 HYBRID_AI_LED, 1 META)
 *   Phase 1:  6 activities (2 AI_AUTONOMOUS, 1 HYBRID_AI_LED, 1 HYBRID_AI_LED, 2 HUMAN_ONLY)
 *   Phase 2: 15 activities (0 AI_AUTONOMOUS, 0 AI_PRIMARY, 7 HYBRID_AI_LED, 3 HYBRID_HUMAN_LED, 5 HUMAN_ONLY)
 *   Phase 3:  8 activities (1 AI_AUTONOMOUS, 1 AI_PRIMARY, 5 HYBRID_AI_LED, 0 HYBRID_HUMAN_LED, 1 HUMAN_ONLY)
 *   Phase 4:  6 activities (1 AI_AUTONOMOUS, 0 AI_PRIMARY, 3 HYBRID_AI_LED, 1 HYBRID_HUMAN_LED, 1 HUMAN_ONLY)
 *   Phase 5:  6 activities (0 AI_AUTONOMOUS, 1 AI_PRIMARY, 3 HYBRID_AI_LED, 1 HYBRID_HUMAN_LED, 1 HUMAN_ONLY)
 *   Phase 6:  3 activities (0 AI_AUTONOMOUS, 0 AI_PRIMARY, 1 HYBRID_AI_LED, 0 HYBRID_HUMAN_LED, 2 HUMAN_ONLY)
 *   Phase 7:  5 activities (1 AI_AUTONOMOUS, 0 AI_PRIMARY, 2 HYBRID_AI_LED, 0 HYBRID_HUMAN_LED, 2 HUMAN_ONLY)
 *   Phase 8:  5 activities (1 AI_AUTONOMOUS, 1 AI_PRIMARY, 2 HYBRID_AI_LED, 0 HYBRID_HUMAN_LED, 2 HUMAN_ONLY)
 *
 * TOTAL: 65 activities
 *   AI_AUTONOMOUS:    13 (20%) — Data pipelines, validation, monitoring, meta-cognitive
 *   AI_PRIMARY:        5  (8%) — Pattern recognition, sustainment, assessment monitoring
 *   HYBRID_AI_LED:    24 (37%) — Analysis, COA gen, wargaming, orders, comparison
 *   HYBRID_HUMAN_LED:  5  (8%) — Problem framing, intent, coalition, red teaming
 *   HUMAN_ONLY:       18 (27%) — Authority, ethics, risk acceptance, legal
 *
 * GOVERNANCE GATES: 18 total
 *   PHASE_TRANSITION:     7 (one per phase boundary)
 *   PRODUCT_APPROVAL:     3 (CCIR, restated mission, COA recommendation, OPORD)
 *   AUTHORITY_CHECKPOINT:  4 (commander guidance, mission approval, COA approval, assessment)
 *   RED_TEAM_GATE:        1 (post-wargaming)
 *   COALITION_GATE:       1 (COA comparison)
 *   ASSUMPTION_GATE:      1 (Phase 2 assumption acceptance)
 */
