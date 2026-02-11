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
