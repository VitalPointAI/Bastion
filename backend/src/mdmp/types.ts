/**
 * MDMP (Military Decision-Making Process) Types
 *
 * TypeScript types mirroring near-contracts/src/mdmp/types.rs
 * Defines governance types for AI-enabled military planning.
 */

/**
 * Authority designation levels for MDMP activities
 */
export enum AuthorityDesignation {
  /** General officer authority required */
  GeneralOfficer = 'GeneralOfficer',
  /** Field grade officer authority */
  FieldGrade = 'FieldGrade',
  /** Company grade officer authority */
  CompanyGrade = 'CompanyGrade',
  /** NCO authority */
  NCO = 'NCO',
  /** Individual soldier */
  Individual = 'Individual',
}

/**
 * Control posture for autonomous operations
 */
export enum ControlPosture {
  /** Fully autonomous - AI operates independently */
  FullyAutonomous = 'FullyAutonomous',
  /** Semi-autonomous - Human monitors with veto */
  SemiAutonomous = 'SemiAutonomous',
  /** Human-in-loop - Human approves each action */
  HumanInLoop = 'HumanInLoop',
  /** Human-on-loop - Human monitors and can intervene */
  HumanOnLoop = 'HumanOnLoop',
  /** Manual - No automation */
  Manual = 'Manual',
}

/**
 * MDMP planning phases following JP 5-0 doctrine
 */
export enum MDMPPhase {
  Phase0Continuous = 'phase_0_continuous',
  Phase1Receipt = 'phase_1_receipt_of_mission',
  Phase2Analysis = 'phase_2_mission_analysis',
  Phase3CoaDev = 'phase_3_coa_development',
  Phase4CoaAnalysis = 'phase_4_coa_analysis',
  Phase5CoaCompare = 'phase_5_coa_comparison',
  Phase6CoaApproval = 'phase_6_coa_approval',
  Phase7Orders = 'phase_7_orders_production',
  Phase8Assessment = 'phase_8_assessment',
}

/**
 * Activity categories for MDMP governance with safety classification
 */
export enum ActivityCategory {
  // Fully-delegated categories (4)
  DataAggregation = 'DataAggregation',
  ValidationConsistency = 'ValidationConsistency',
  Monitoring = 'Monitoring',
  MetaCognitive = 'MetaCognitive',

  // Hybrid categories (15)
  PatternRecognition = 'PatternRecognition',
  MissionAnalysis = 'MissionAnalysis',
  ProblemFraming = 'ProblemFraming',
  CoaGeneration = 'CoaGeneration',
  CoaEvaluation = 'CoaEvaluation',
  Wargaming = 'Wargaming',
  DecisionSupport = 'DecisionSupport',
  RedTeaming = 'RedTeaming',
  OrdersProduction = 'OrdersProduction',
  Assessment = 'Assessment',
  Sustainment = 'Sustainment',
  ForceProtection = 'ForceProtection',
  AssumptionMgmt = 'AssumptionMgmt',
  CoalitionMgmt = 'CoalitionMgmt',
  IntentAssessment = 'IntentAssessment',

  // Human-in-loop required categories (3)
  RiskJudgment = 'RiskJudgment',
  AuthorityDecision = 'AuthorityDecision',
  EthicalLegal = 'EthicalLegal',
}

/**
 * Gate types for phase transitions
 */
export enum GateType {
  /** Red team challenge gate */
  RedTeam = 'RedTeam',
  /** Commander approval gate */
  Commander = 'Commander',
  /** Legal review gate */
  Legal = 'Legal',
  /** Coalition approval gate */
  Coalition = 'Coalition',
  /** Resource availability gate */
  Resource = 'Resource',
  /** Time-based gate */
  Temporal = 'Temporal',
}

/**
 * Planning product types
 */
export enum PlanningProduct {
  /** Initial Planning Guidance */
  IPG = 'IPG',
  /** Commander's Intent */
  CommandersIntent = 'CommandersIntent',
  /** Mission Statement */
  MissionStatement = 'MissionStatement',
  /** Course of Action */
  COA = 'COA',
  /** Wargaming Results */
  WargamingResults = 'WargamingResults',
  /** Decision Matrix */
  DecisionMatrix = 'DecisionMatrix',
  /** Operations Order */
  OPORD = 'OPORD',
  /** Fragmentary Order */
  FRAGO = 'FRAGO',
  /** Warning Order */
  WARNORD = 'WARNORD',
  /** Battle Update Brief */
  BUB = 'BUB',
  /** After Action Review */
  AAR = 'AAR',
}

/**
 * Information sensitivity levels
 */
export enum SensitivityLevel {
  /** Public information */
  Public = 'Public',
  /** For Official Use Only */
  FOUO = 'FOUO',
  /** Secret classification */
  Secret = 'Secret',
  /** Top Secret classification */
  TopSecret = 'TopSecret',
}

/**
 * Assumption status in planning
 */
export enum AssumptionStatus {
  /** Proposed assumption */
  Proposed = 'Proposed',
  /** Accepted by commander */
  Accepted = 'Accepted',
  /** Validated through intelligence */
  Validated = 'Validated',
  /** Invalidated - no longer holds */
  Invalidated = 'Invalidated',
  /** Under review */
  UnderReview = 'UnderReview',
}

/**
 * Source of planning assumption
 */
export enum AssumptionSource {
  /** AI-generated assumption */
  AI = 'AI',
  /** Human planner assumption */
  Human = 'Human',
  /** Intelligence assessment */
  Intelligence = 'Intelligence',
  /** Higher headquarters guidance */
  HigherHQ = 'HigherHQ',
  /** Coalition partner input */
  Coalition = 'Coalition',
}

/**
 * Safety matrix entry defining permitted authority ranges per activity
 */
export interface SafetyMatrixEntry {
  category: ActivityCategory;
  minAuthority: AuthorityDesignation;
  maxAuthority: AuthorityDesignation;
  controlPosture: ControlPosture;
  requiresHumanInLoop: boolean;
  permitsFullyDelegated: boolean;
}

/**
 * Safety matrix: Defines permitted authority ranges for each activity category
 */
export const SAFETY_MATRIX: SafetyMatrixEntry[] = [
  // Fully-delegated activities (4)
  {
    category: ActivityCategory.DataAggregation,
    minAuthority: AuthorityDesignation.Individual,
    maxAuthority: AuthorityDesignation.NCO,
    controlPosture: ControlPosture.FullyAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: true,
  },
  {
    category: ActivityCategory.ValidationConsistency,
    minAuthority: AuthorityDesignation.Individual,
    maxAuthority: AuthorityDesignation.NCO,
    controlPosture: ControlPosture.FullyAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: true,
  },
  {
    category: ActivityCategory.Monitoring,
    minAuthority: AuthorityDesignation.Individual,
    maxAuthority: AuthorityDesignation.NCO,
    controlPosture: ControlPosture.FullyAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: true,
  },
  {
    category: ActivityCategory.MetaCognitive,
    minAuthority: AuthorityDesignation.Individual,
    maxAuthority: AuthorityDesignation.CompanyGrade,
    controlPosture: ControlPosture.FullyAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: true,
  },

  // Hybrid activities (15)
  {
    category: ActivityCategory.PatternRecognition,
    minAuthority: AuthorityDesignation.NCO,
    maxAuthority: AuthorityDesignation.CompanyGrade,
    controlPosture: ControlPosture.SemiAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.MissionAnalysis,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.ProblemFraming,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.CoaGeneration,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.SemiAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.CoaEvaluation,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.Wargaming,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.SemiAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.DecisionSupport,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.RedTeaming,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.OrdersProduction,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.SemiAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.Assessment,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.Sustainment,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.SemiAutonomous,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.ForceProtection,
    minAuthority: AuthorityDesignation.CompanyGrade,
    maxAuthority: AuthorityDesignation.FieldGrade,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.AssumptionMgmt,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.CoalitionMgmt,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.IntentAssessment,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanOnLoop,
    requiresHumanInLoop: false,
    permitsFullyDelegated: false,
  },

  // Human-in-loop required activities (3)
  {
    category: ActivityCategory.RiskJudgment,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanInLoop,
    requiresHumanInLoop: true,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.AuthorityDecision,
    minAuthority: AuthorityDesignation.GeneralOfficer,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanInLoop,
    requiresHumanInLoop: true,
    permitsFullyDelegated: false,
  },
  {
    category: ActivityCategory.EthicalLegal,
    minAuthority: AuthorityDesignation.FieldGrade,
    maxAuthority: AuthorityDesignation.GeneralOfficer,
    controlPosture: ControlPosture.HumanInLoop,
    requiresHumanInLoop: true,
    permitsFullyDelegated: false,
  },
];

/**
 * Governance invariants that must hold across all MDMP operations
 */
export const GOVERNANCE_INVARIANTS = {
  /** Lethal decisions always require human-in-loop */
  LETHAL_DECISIONS_HUMAN_ONLY: 'AutonomyLevel::NotAutonomous for StrikeAuthorization',

  /** FullyDelegated restricted to 4 safe categories */
  FULLY_DELEGATED_RESTRICTED:
    'FullyDelegated only for: DataAggregation, ValidationConsistency, Monitoring, MetaCognitive',

  /** 3 categories always require human-in-loop */
  HUMAN_IN_LOOP_REQUIRED: 'RiskJudgment, AuthorityDecision, EthicalLegal always NotAutonomous',

  /** Phase transitions require red team gate passage */
  PHASE_TRANSITION_GATED: 'PhaseTransition requires red_team_responses and accepted_assumptions',

  /** Assumptions must have designated risk owner */
  ASSUMPTION_RISK_OWNER: 'AssumptionAcceptance requires risk_owner AccountId',

  /** AI confidence tracked for product approvals */
  AI_CONFIDENCE_TRACKED: 'ProductApproval records ai_confidence and product_hash',

  /** Commander guidance modifies assumptions explicitly */
  COMMANDER_GUIDANCE_EXPLICIT: 'CommanderGuidance lists modifies_assumptions',

  /** All backward phase transitions permitted */
  BACKWARD_TRANSITIONS_ALLOWED: 'MDMPPhase::can_revisit() always true per JP 5-0',

  /** Activity-authority alignment enforced */
  ACTIVITY_AUTHORITY_ALIGNED: 'SAFETY_MATRIX defines min/max authority per ActivityCategory',
};

// ═══════════════════════════════════════════════════════════════════════════
// EXTENDED TYPES FOR MDMP ACTIVITY REGISTRY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Updated Authority Designation enum matching the five-tier model
 */
export enum AuthorityDesignation {
  AI_AUTONOMOUS = 'ai_autonomous',
  AI_PRIMARY = 'ai_primary',
  HYBRID_AI_LED = 'hybrid_ai_led',
  HYBRID_HUMAN_LED = 'hybrid_human_led',
  HUMAN_ONLY = 'human_only',
}

/**
 * Updated Control Posture enum
 */
export enum ControlPosture {
  FULLY_DELEGATED = 'fully_delegated',
  HUMAN_OUT_OF_LOOP = 'hootl',
  HUMAN_ON_LOOP = 'hotl',
  HUMAN_IN_LOOP = 'hitl',
  HUMAN_EXCLUSIVE = 'human_exclusive',
}

/**
 * Updated MDMP Phase enum
 */
export enum MDMPPhase {
  PHASE_0_CONTINUOUS = 'phase_0_continuous',
  PHASE_1_RECEIPT = 'phase_1_receipt_of_mission',
  PHASE_2_ANALYSIS = 'phase_2_mission_analysis',
  PHASE_3_COA_DEV = 'phase_3_coa_development',
  PHASE_4_COA_ANALYSIS = 'phase_4_coa_analysis',
  PHASE_5_COA_COMPARE = 'phase_5_coa_comparison',
  PHASE_6_COA_APPROVAL = 'phase_6_coa_approval',
  PHASE_7_ORDERS = 'phase_7_orders_production',
  PHASE_8_ASSESSMENT = 'phase_8_assessment',
}

/**
 * DAO tier levels
 */
export enum DAOTier {
  STRATEGIC = 'strategic',
  OPERATIONAL = 'operational',
  TACTICAL = 'tactical',
}

/**
 * Agent roles for MDMP activities
 */
export enum AgentRole {
  STRATEGIC_FUSION = 'strategic_fusion',
  OSINT_MONITOR = 'osint_monitor',
  ENTITY_RESOLUTION = 'entity_resolution',
  CONFLICT_DETECTION = 'conflict_detection',
  DATA_BIAS_DETECTOR = 'data_bias_detector',
  ORDERS_VALIDATOR = 'orders_validator',
  ADVERSARY_MODELER = 'adversary_modeler',
  DECEPTION_DETECTOR = 'deception_detector',
  COALITION_HEALTH = 'coalition_health',
  ASSUMPTION_AUDITOR = 'assumption_auditor',
  RAFT_EXTRACTION = 'raft_extraction',
  RAFT_REASONING = 'raft_reasoning',
  ROE_COMPLIANCE = 'roe_compliance',
  COA_GENERATOR = 'coa_generator',
  EFFECT_CASCADER = 'effect_cascader',
  ESCALATION_MODELER = 'escalation_modeler',
  NARRATIVE_IMPACT = 'narrative_impact',
  RED_TEAM_SIMULATOR = 'red_team_simulator',
  PROBLEM_FRAMING = 'problem_framing',
}

/**
 * Agent output types
 */
export enum AgentOutputType {
  VALIDATION_RESULT = 'validation_result',
  ALERT = 'alert',
  BIAS_REPORT = 'bias_report',
  STALENESS_REPORT = 'staleness_report',
  ANALYSIS_REPORT = 'analysis_report',
  SCENARIO_SET = 'scenario_set',
  GAP_ANALYSIS = 'gap_analysis',
  COMPLIANCE_CHECK = 'compliance_check',
  DRAFT_PRODUCT = 'draft_product',
  EFFECT_CHAIN = 'effect_chain',
  ESCALATION_MODEL = 'escalation_model',
}

/**
 * Updated Gate Type enum
 */
export enum GateType {
  PHASE_TRANSITION = 'phase_transition',
  AUTHORITY_CHECKPOINT = 'authority_checkpoint',
  PRODUCT_APPROVAL = 'product_approval',
  ASSUMPTION_GATE = 'assumption_gate',
  RED_TEAM = 'red_team',
  LEGAL_REVIEW = 'legal_review',
  COALITION_APPROVAL = 'coalition_approval',
}

/**
 * Verification mechanisms
 */
export enum VerificationMechanism {
  AUTOMATED_VALIDATION = 'automated_validation',
  AI_EXECUTION_PROOF = 'ai_execution_proof',
  DUAL_VERIFICATION = 'dual_verification',
  HUMAN_ATTESTATION = 'human_attestation',
}

/**
 * Evidence types for verification
 */
export enum EvidenceType {
  VALIDATION_LOG = 'validation_log',
  ANALYSIS_ARTIFACT = 'analysis_artifact',
  CONFIDENCE_INTERVAL = 'confidence_interval',
  DECISION_RECORD = 'decision_record',
  VOTE_RECORD = 'vote_record',
  ASSUMPTION_ACCEPTANCE = 'assumption_acceptance',
  RISK_ACCEPTANCE = 'risk_acceptance',
  COMPLIANCE_CHECK = 'compliance_check',
  COALITION_CONCURRENCE = 'coalition_concurrence',
}

/**
 * Retention periods for audit records
 */
export enum RetentionPeriod {
  STANDARD = 'standard',
  MISSION_DURATION = 'mission_duration',
  CAMPAIGN_DURATION = 'campaign_duration',
  PERMANENT = 'permanent',
}

/**
 * Audit requirement levels
 */
export enum AuditRequirement {
  REAL_TIME = 'real_time',
  BATCH = 'batch',
  NONE = 'none',
}

/**
 * Red team challenge types
 */
export enum ChallengeType {
  ADVERSARY_PERSPECTIVE = 'adversary_perspective',
  ASSUMPTION_CHALLENGE = 'assumption_challenge',
  INSTITUTIONAL_BIAS = 'institutional_bias',
  BIAS_CHECK = 'bias_check',
  ESCALATION_RISK = 'escalation_risk',
  SECOND_ORDER_EFFECT = 'second_order_effect',
  COALITION_STRESS = 'coalition_stress',
}

/**
 * Response depth requirements
 */
export enum ResponseDepth {
  STRUCTURED_ANALYSIS = 'structured_analysis',
  WARGAME_TESTED = 'wargame_tested',
  DATA_DRIVEN = 'data_driven',
}

/**
 * Coalition impact levels
 */
export enum CoalitionImpact {
  US_ONLY = 'us_only',
  MULTILATERAL = 'multilateral',
  FULL_COALITION = 'full_coalition',
}

/**
 * Information sharing levels
 */
export enum SharingLevel {
  NATIONAL_ONLY = 'national_only',
  FIVE_EYES = 'five_eyes',
  NATO = 'nato',
  MISSION_PARTNERS = 'mission_partners',
  RELEASABLE = 'releasable',
}

/**
 * Implementation status
 */
export enum ImplementationStatus {
  FULLY_IMPLEMENTED = 'fully_implemented',
  PARTIALLY_IMPLEMENTED = 'partially_implemented',
  GAP_IDENTIFIED = 'gap_identified',
  PLANNED = 'planned',
  NEW_REQUIREMENT = 'new_requirement',
}

/**
 * Escalation paths for governance gates
 */
export enum EscalationPath {
  HIGHER_DAO_TIER = 'higher_dao_tier',
  COMMANDER_OVERRIDE = 'commander_override',
  CHIEF_OF_STAFF = 'chief_of_staff',
  LEGAL_ADVISOR = 'legal_advisor',
}

/**
 * Governance gate configuration
 */
export interface GovernanceGate {
  required: boolean;
  gateType: GateType;
  approvalThreshold: {
    approvalPercentage: number;
    quorumPercentage: number;
    vetoThreshold: number | null;
    unanimousRequired: boolean;
  };
  vetoEnabled: boolean;
  coalitionApproval: boolean;
  timeConstraint: number | null;
  escalationPath: EscalationPath;
  bypassConditions: Array<{
    condition: string;
    authorizedBy: string;
    auditRequired: boolean;
    maxDurationMs: number | null;
  }>;
}

/**
 * Agent support configuration
 */
export interface AgentSupportConfig {
  enabled: boolean;
  agentPhase: string;
  requiredAgents: AgentRole[];
  agentOutputType: AgentOutputType;
  humanCheckpoint: {
    required: boolean;
    trigger: string;
    requiredRole: string | null;
    timeoutMs: number | null;
  };
  confidenceThreshold: number;
  maxAutonomyOverride: boolean;
}

/**
 * Verification configuration
 */
export interface VerificationConfig {
  mechanism: VerificationMechanism;
  blockchainRecord: boolean;
  teeRequired: boolean;
  evidenceTypes: EvidenceType[];
  retentionPeriod: RetentionPeriod;
}

/**
 * Red team challenge
 */
export interface RedTeamChallenge {
  id: string;
  question: string;
  mdmpPhase: MDMPPhase;
  challengeType: ChallengeType;
  aiGeneratable: boolean;
  aiAnswerable: boolean;
  requiredResponseDepth: ResponseDepth;
  governanceGateLink: string | null;
  agentRole: AgentRole;
}

/**
 * Bastion component mapping
 */
export interface BastionComponentMapping {
  primaryPhase: string;
  components: Array<{
    layer: string;
    module: string;
    existingCapability: boolean;
    requiredEnhancement: string | null;
  }>;
  implementationStatus: ImplementationStatus;
  gapAnalysis: string | null;
}

/**
 * Coalition relevance
 */
export interface CoalitionRelevance {
  coalitionImpact: CoalitionImpact;
  nationalCaveatSensitive: boolean;
  informationSharingLevel: SharingLevel;
  partnerConcurrence: boolean;
  culturalSensitivity: boolean;
}

/**
 * Complete MDMP Activity interface
 */
export interface MDMPActivity {
  id: string;
  mdmpPhase: MDMPPhase;
  category: ActivityCategory;
  description: string;
  authorityDesignation: AuthorityDesignation;
  controlPosture: ControlPosture;
  daoTier: DAOTier;
  governanceGate: GovernanceGate | null;
  agentSupport: AgentSupportConfig;
  verification: VerificationConfig;
  auditRequirement: AuditRequirement;
  redTeamChallenges: RedTeamChallenge[];
  doctrinalReferences: string[];
  bastionMapping: BastionComponentMapping;
  dependsOn: string[];
  enables: string[];
  minimumClassification: string;
  coalitionRelevance: CoalitionRelevance;
}
