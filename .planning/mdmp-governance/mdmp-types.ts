/**
 * MDMP Governance Data Model - TypeScript Types
 *
 * Complete type definitions for integrating the Military Decision Making Process
 * into Bastion's DAO governance framework. These types extend the existing
 * DAO types (dao/types.ts) and Agent types (agents/types.ts).
 *
 * Design principles:
 * - Five authority levels from AI Autonomous to Human Only
 * - Every human-only item remains human-only (command authority, ethics, risk acceptance)
 * - AI Autonomous is restricted to deterministic validation and data pipeline tasks
 * - All activities produce blockchain-auditable records
 * - Safety matrix enforces which authority levels are permitted per activity category
 *
 * References:
 * - near-contracts/src/dao/types.rs (AutonomyLevel, ProposalKind, Proposal)
 * - near-contracts/src/dao/execution.rs (ExecutionState, ProposalExecutor)
 * - near-contracts/src/dao/voting.rs (VotePolicy, ThresholdKind)
 * - near-contracts/src/dao/roles.rs (AgentTier, Role, Permission)
 * - near-contracts/src/dao/linkages.rs (CoalitionProposal, CrossDAORequirement)
 * - backend/src/agents/types.ts (AgentPhase, AgentCapability, AgentManifest)
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 1: EXTENDED ENUMERATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Authority designation for MDMP activities.
 * Five-tier model extending the original checklist's binary AI/Human split.
 *
 * Maps to Bastion's AutonomyLevel:
 *   AI_AUTONOMOUS    -> FullyDelegated (new)
 *   AI_PRIMARY       -> Autonomous (existing)
 *   HYBRID_AI_LED    -> SemiAutonomous (existing)
 *   HYBRID_HUMAN_LED -> NotAutonomous with AI support (existing)
 *   HUMAN_ONLY       -> NotAutonomous, no AI (existing)
 */
export enum AuthorityDesignation {
  /**
   * AI executes independently. No human review required.
   * Output feeds directly into other processes or dashboards.
   * Auditable retroactively but not monitored in real-time.
   * Errors caught by downstream validation or periodic audit.
   *
   * RESTRICTED TO: Deterministic validation, data pipelines,
   * meta-monitoring, pattern extraction from approved outputs.
   *
   * CANNOT BE ASSIGNED TO: Authority decisions, ethical/legal judgment,
   * risk acceptance, intent assessment, or any activity with a GovernanceGate.
   */
  AI_AUTONOMOUS = 'ai_autonomous',

  /**
   * AI executes autonomously within approved constraints.
   * Human spot-checks periodically but is not blocking.
   * Example: Generating wargame decision points from simulation data.
   */
  AI_PRIMARY = 'ai_primary',

  /**
   * AI generates output; human validates before it advances.
   * AI does the analytical heavy lifting; human checks correctness.
   * Example: COA generation, assumption surfacing, effect cascading.
   */
  HYBRID_AI_LED = 'hybrid_ai_led',

  /**
   * Human leads decision process; AI provides structured support.
   * Human frames the problem; AI provides data, alternatives, analysis.
   * Example: Problem framing, risk assessment, escalation judgment.
   */
  HYBRID_HUMAN_LED = 'hybrid_human_led',

  /**
   * Human decides with no AI participation in the decision itself.
   * AI may have contributed upstream inputs, but the decision is human.
   * Example: Use of force, risk acceptance, command authority.
   */
  HUMAN_ONLY = 'human_only',
}

/**
 * Control posture - maps to Bastion's AutonomyLevel enum in smart contracts.
 * Extends the existing three-level model with FullyDelegated.
 */
export enum ControlPosture {
  /** No human monitoring required. Runs as infrastructure. */
  FULLY_DELEGATED = 'fully_delegated',
  /** AI acts, human monitors and can intervene. */
  HUMAN_OUT_OF_LOOP = 'hootl',
  /** AI acts, human can veto within window. */
  HUMAN_ON_LOOP = 'hotl',
  /** AI recommends, human decides and executes. */
  HUMAN_IN_LOOP = 'hitl',
  /** No AI involvement in execution. */
  HUMAN_EXCLUSIVE = 'human_exclusive',
}

/**
 * MDMP phases - maps to the 9-phase checklist structure.
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
 * Activity categories for safety matrix enforcement.
 * The safety matrix uses these to determine which AuthorityDesignation
 * values are permitted for each category.
 */
export enum ActivityCategory {
  DATA_AGGREGATION = 'data_aggregation',
  PATTERN_RECOGNITION = 'pattern_recognition',
  VALIDATION_CONSISTENCY = 'validation_consistency',
  MISSION_ANALYSIS = 'mission_analysis',
  PROBLEM_FRAMING = 'problem_framing',
  COA_GENERATION = 'coa_generation',
  COA_EVALUATION = 'coa_evaluation',
  WARGAMING = 'wargaming',
  DECISION_SUPPORT = 'decision_support',
  RED_TEAMING = 'red_teaming',
  ORDERS_PRODUCTION = 'orders_production',
  ASSESSMENT = 'assessment',
  RISK_JUDGMENT = 'risk_judgment',
  AUTHORITY_DECISION = 'authority_decision',
  ETHICAL_LEGAL = 'ethical_legal',
  INTENT_ASSESSMENT = 'intent_assessment',
  ASSUMPTION_MGMT = 'assumption_management',
  COALITION_MGMT = 'coalition_management',
  SUSTAINMENT = 'sustainment',
  FORCE_PROTECTION = 'force_protection',
  MONITORING = 'monitoring',
  META_COGNITIVE = 'meta_cognitive',
}

/**
 * DAO governance tier - maps to Bastion's three-tier DAO structure.
 */
export enum DAOTier {
  STRATEGIC = 'strategic',
  OPERATIONAL = 'operational',
  TACTICAL = 'tactical',
  CROSS_TIER = 'cross_tier',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 2: AGENT ROLE DEFINITIONS
// Extends backend/src/agents/types.ts AgentCapability enum
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Agent roles for MDMP activities.
 * Includes existing Bastion agents and new agents required by the data model.
 */
export enum AgentRole {
  // ── Existing Bastion agents ──
  STRATEGIC_FUSION = 'strategic_fusion',
  ENTITY_RESOLUTION = 'entity_resolution',
  CONFLICT_DETECTION = 'conflict_detection',
  OSINT_MONITOR = 'osint_monitor',
  VALIDITY_ASSESSMENT = 'validity_assessment',
  RAFT_EXTRACTION = 'raft_extraction',
  RAFT_REASONING = 'raft_reasoning',
  COA_GENERATOR = 'coa_generator',
  RED_TEAM_SIMULATOR = 'red_team_simulator',
  COA_COMPARATOR = 'coa_comparator',

  // ── New agents required by MDMP data model ──
  /** Surfaces explicit and hidden assumptions; tracks validity; sensitivity analysis */
  ASSUMPTION_AUDITOR = 'assumption_auditor',
  /** Generates alternative problem framings from multiple perspectives */
  PROBLEM_FRAMING = 'problem_framing',
  /** Systematically propagates effects across domains, time, actors */
  EFFECT_CASCADER = 'effect_cascader',
  /** Models escalation dynamics using multiple theoretical frameworks */
  ESCALATION_MODELER = 'escalation_modeler',
  /** Monitors coalition cohesion indicators; tracks partner posture */
  COALITION_HEALTH = 'coalition_health',
  /** Detects statistical bias, data staleness, coverage gaps */
  DATA_BIAS_DETECTOR = 'data_bias_detector',
  /** Validates order consistency; simulates degraded execution */
  ORDERS_VALIDATOR = 'orders_validator',
  /** Parses ROE; maps authorities to tasks; validates compliance */
  ROE_COMPLIANCE = 'roe_compliance',
  /** Produces calibrated confidence intervals; flags false precision */
  UNCERTAINTY_QUANTIFIER = 'uncertainty_quantifier',
  /** Synthesizes adversary capability models; generates adversary COAs */
  ADVERSARY_MODELER = 'adversary_modeler',
  /** Identifies inconsistencies between adversary intent and behavior */
  DECEPTION_DETECTOR = 'deception_detector',
  /** Models information operation impact across audience segments */
  NARRATIVE_IMPACT = 'narrative_impact',
}

/**
 * Output types that agents produce for MDMP activities.
 */
export enum AgentOutputType {
  ANALYSIS_REPORT = 'analysis_report',
  RECOMMENDATION = 'recommendation',
  ALERT = 'alert',
  DRAFT_PRODUCT = 'draft_product',
  VALIDATION_RESULT = 'validation_result',
  VISUALIZATION = 'visualization',
  CHALLENGE_SET = 'challenge_set',
  CONFIDENCE_SCORE = 'confidence_score',
  SCENARIO_SET = 'scenario_set',
  GAP_ANALYSIS = 'gap_analysis',
  COMPLIANCE_CHECK = 'compliance_check',
  BIAS_REPORT = 'bias_report',
  STALENESS_REPORT = 'staleness_report',
  EFFECT_CHAIN = 'effect_chain',
  ESCALATION_MODEL = 'escalation_model',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3: AGENT SUPPORT CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Configures how AI agents participate in each MDMP activity.
 * References AgentPhase from backend/src/agents/types.ts.
 */
export interface AgentSupportConfig {
  /** Whether AI agents participate in this activity */
  enabled: boolean;
  /** Agent governance phase: Support, Represent, or Organize */
  agentPhase: 'Support' | 'Represent' | 'Organize';
  /** Which agent roles participate */
  requiredAgents: AgentRole[];
  /** What the agent produces */
  agentOutputType: AgentOutputType;
  /** When human must intervene */
  humanCheckpoint: HumanCheckpointConfig;
  /** Confidence threshold (0-1); below triggers escalation to human */
  confidenceThreshold: number;
  /** Whether commander can override autonomy level upward */
  maxAutonomyOverride: boolean;
}

export interface HumanCheckpointConfig {
  /** Whether a human checkpoint exists */
  required: boolean;
  /** What triggers the checkpoint */
  trigger: 'always' | 'on_low_confidence' | 'on_exception' | 'on_escalation' | 'never';
  /** Role required to clear the checkpoint */
  requiredRole: string | null;
  /** Maximum time before auto-escalation (ms) */
  timeoutMs: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4: GOVERNANCE GATE CONFIGURATION
// Extends near-contracts/src/dao/types.rs ProposalKind
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gate types for MDMP workflow enforcement.
 * Each gate type maps to a ProposalKind in the smart contract.
 */
export enum GateType {
  /** Must pass to advance MDMP phase */
  PHASE_TRANSITION = 'phase_transition',
  /** Specific planning product must be approved */
  PRODUCT_APPROVAL = 'product_approval',
  /** Confirms human authority exercised */
  AUTHORITY_CHECKPOINT = 'authority_checkpoint',
  /** Red team challenge questions must be addressed */
  RED_TEAM_GATE = 'red_team_gate',
  /** Multi-party coalition agreement required */
  COALITION_GATE = 'coalition_gate',
  /** Planning assumptions explicitly accepted/rejected */
  ASSUMPTION_GATE = 'assumption_gate',
}

/**
 * Planning product types that require governance approval.
 */
export enum PlanningProduct {
  RESTATED_MISSION = 'restated_mission',
  CCIR_SET = 'ccir_set',
  COA_SET = 'coa_set',
  COA_RECOMMENDATION = 'coa_recommendation',
  OPLAN = 'oplan',
  OPORD = 'opord',
  ASSESSMENT_FRAMEWORK = 'assessment_framework',
  BRANCH_PLAN = 'branch_plan',
  SEQUEL_PLAN = 'sequel_plan',
  FORCE_FLOW_MODEL = 'force_flow_model',
  SYNC_MATRIX = 'sync_matrix',
}

export interface GovernanceGate {
  /** Whether this gate is required */
  required: boolean;
  /** Type of governance gate */
  gateType: GateType;
  /** Approval threshold configuration */
  approvalThreshold: ThresholdConfig;
  /** Whether veto mechanism is available */
  vetoEnabled: boolean;
  /** Whether cross-DAO coalition approval is required */
  coalitionApproval: boolean;
  /** Time constraint for deliberation */
  timeConstraint: TimeConstraint | null;
  /** Where to escalate if gate is blocked */
  escalationPath: EscalationPath;
  /** Conditions under which gate can be bypassed (e.g., DDIL) */
  bypassConditions: BypassCondition[];
}

export interface ThresholdConfig {
  /** Percentage of approvals required (0-100) */
  approvalPercentage: number;
  /** Minimum participation percentage (0-100) */
  quorumPercentage: number;
  /** Percentage that can trigger veto */
  vetoThreshold: number | null;
  /** Override: unanimous required (e.g., StrikeAuthorization) */
  unanimousRequired: boolean;
}

export interface TimeConstraint {
  /** Maximum deliberation time (ms) */
  maxDeliberationMs: number;
  /** Auto-escalate after this duration (ms) */
  autoEscalateAfterMs: number;
  /** Whether time can be extended */
  extendable: boolean;
}

export enum EscalationPath {
  COMMANDER_OVERRIDE = 'commander_override',
  HIGHER_DAO_TIER = 'higher_dao_tier',
  COALITION_ESCALATION = 'coalition_escalation',
  CHIEF_OF_STAFF = 'chief_of_staff',
}

export interface BypassCondition {
  /** Condition identifier (e.g., "DDIL_DEGRADED", "FLASH_OVERRIDE") */
  condition: string;
  /** Role that pre-authorized this bypass */
  authorizedBy: string;
  /** Whether bypass must be recorded on reconnect */
  auditRequired: boolean;
  /** How long the bypass is valid (ms); null = indefinite until revoked */
  maxDurationMs: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 5: VERIFICATION & AUDIT
// Maps to Bastion's five-layer verifiable zero trust architecture
// ═══════════════════════════════════════════════════════════════════════════

export interface VerificationConfig {
  /** How this activity's execution is verified */
  mechanism: VerificationMechanism;
  /** Whether an immutable record is stored on NEAR blockchain */
  blockchainRecord: boolean;
  /** Whether Phala TEE execution is required */
  teeRequired: boolean;
  /** Types of evidence produced */
  evidenceTypes: EvidenceType[];
  /** How long records must be retained */
  retentionPeriod: RetentionPeriod;
}

export enum VerificationMechanism {
  /** Immutable NEAR blockchain transaction */
  BLOCKCHAIN_AUDIT = 'blockchain_audit',
  /** Signed human attestation */
  HUMAN_ATTESTATION = 'human_attestation',
  /** Five-layer verifiable zero trust proof */
  AI_EXECUTION_PROOF = 'ai_execution_proof',
  /** Multi-party blockchain record */
  COALITION_CONSENSUS = 'coalition_consensus',
  /** Human checkpoint resolution record */
  CHECKPOINT_RESOLUTION = 'checkpoint_resolution',
  /** Both AI proof and human attestation */
  DUAL_VERIFICATION = 'dual_verification',
  /** Automated validation with audit log (for AI_AUTONOMOUS) */
  AUTOMATED_VALIDATION = 'automated_validation',
}

export enum EvidenceType {
  DECISION_RECORD = 'decision_record',
  ANALYSIS_ARTIFACT = 'analysis_artifact',
  VOTE_RECORD = 'vote_record',
  OVERRIDE_JUSTIFICATION = 'override_justification',
  RED_TEAM_RESPONSE = 'red_team_response',
  ASSUMPTION_ACCEPTANCE = 'assumption_acceptance',
  RISK_ACCEPTANCE = 'risk_acceptance',
  COALITION_CONCURRENCE = 'coalition_concurrence',
  VALIDATION_LOG = 'validation_log',
  CONFIDENCE_INTERVAL = 'confidence_interval',
}

export enum RetentionPeriod {
  /** Retained for duration of mission */
  MISSION_DURATION = 'mission_duration',
  /** Retained for campaign duration */
  CAMPAIGN_DURATION = 'campaign_duration',
  /** Permanent retention (command decisions, lethal actions) */
  PERMANENT = 'permanent',
  /** Standard retention per records management policy */
  STANDARD = 'standard',
}

export enum AuditRequirement {
  /** Recorded as it happens */
  REAL_TIME = 'real_time',
  /** Recorded at phase end */
  BATCH = 'batch',
  /** DDIL: sync when connectivity restored */
  ON_RECONNECT = 'on_reconnect',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6: RED TEAM CHALLENGE FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════

export interface RedTeamChallenge {
  /** Unique challenge identifier (e.g., "RT-2-01") */
  id: string;
  /** The challenge question text */
  question: string;
  /** MDMP phase this challenge belongs to */
  mdmpPhase: MDMPPhase;
  /** Type of adversarial challenge */
  challengeType: ChallengeType;
  /** Whether AI can generate challenges of this class */
  aiGeneratable: boolean;
  /** Whether AI can contribute to answering this challenge */
  aiAnswerable: boolean;
  /** Required depth of response */
  requiredResponseDepth: ResponseDepth;
  /** Governance gate that requires this challenge be addressed */
  governanceGateLink: string | null;
  /** AI agent role that supports this challenge */
  agentRole: AgentRole | null;
}

export enum ChallengeType {
  ASSUMPTION_CHALLENGE = 'assumption_challenge',
  ADVERSARY_PERSPECTIVE = 'adversary_perspective',
  COALITION_STRESS = 'coalition_stress',
  ESCALATION_RISK = 'escalation_risk',
  BIAS_CHECK = 'bias_check',
  FAILURE_MODE = 'failure_mode',
  SECOND_ORDER_EFFECT = 'second_order_effect',
  INSTITUTIONAL_BIAS = 'institutional_bias',
}

export enum ResponseDepth {
  /** Noted, no analysis required */
  ACKNOWLEDGMENT = 'acknowledgment',
  /** 1-2 sentence response */
  BRIEF_RESPONSE = 'brief_response',
  /** Full structured assessment */
  STRUCTURED_ANALYSIS = 'structured_analysis',
  /** Tested through simulation/wargaming */
  WARGAME_TESTED = 'wargame_tested',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 7: ASSUMPTION TRACKING
// New capability - no existing Bastion equivalent
// ═══════════════════════════════════════════════════════════════════════════

export interface Assumption {
  /** Unique assumption identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** How much the plan changes if this assumption is wrong */
  sensitivity: SensitivityLevel;
  /** How this assumption can be validated */
  validationMethod: string;
  /** Information requirements that would validate/invalidate */
  linkedCCIRs: string[];
  /** Who explicitly accepted this assumption */
  acceptedBy: string | null;
  /** When it was accepted (epoch ms) */
  acceptedAt: number | null;
  /** When it was last validated against current intelligence */
  lastValidated: number | null;
  /** Current status */
  status: AssumptionStatus;
  /** Source: where this assumption originated */
  source: AssumptionSource;
  /** MDMP phase where assumption was identified */
  identifiedInPhase: MDMPPhase;
  /** Activities that depend on this assumption */
  dependentActivities: string[];
  /** Planning products that depend on this assumption */
  dependentProducts: PlanningProduct[];
}

export enum SensitivityLevel {
  /** Plan survives if wrong */
  LOW = 'low',
  /** Plan degrades if wrong */
  MEDIUM = 'medium',
  /** Plan fails if wrong */
  HIGH = 'high',
  /** Mission fails if wrong */
  CRITICAL = 'critical',
}

export enum AssumptionStatus {
  /** Identified but not yet evaluated */
  PENDING = 'pending',
  /** Explicitly accepted by authorized person */
  ACCEPTED = 'accepted',
  /** Explicitly rejected */
  REJECTED = 'rejected',
  /** Evidence shows it is wrong */
  INVALIDATED = 'invalidated',
  /** Too old, needs revalidation */
  EXPIRED = 'expired',
}

export enum AssumptionSource {
  /** Explicitly stated in planning directive */
  DIRECTIVE = 'directive',
  /** Inherited from previous plans */
  INHERITED = 'inherited',
  /** Identified during analysis */
  ANALYSIS = 'analysis',
  /** Surfaced by AI agent */
  AI_IDENTIFIED = 'ai_identified',
  /** Institutional habit / unstated belief */
  IMPLICIT = 'implicit',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8: COALITION RELEVANCE
// Extends near-contracts/src/dao/linkages.rs
// ═══════════════════════════════════════════════════════════════════════════

export interface CoalitionRelevance {
  /** Scope of coalition impact */
  coalitionImpact: CoalitionImpact;
  /** Whether activity is sensitive to national caveats */
  nationalCaveatSensitive: boolean;
  /** Information sharing level required */
  informationSharingLevel: SharingLevel;
  /** Whether partner concurrence is required */
  partnerConcurrence: boolean;
  /** Whether execution varies by coalition member */
  culturalSensitivity: boolean;
}

export enum CoalitionImpact {
  US_ONLY = 'us_only',
  BILATERAL = 'bilateral',
  MULTILATERAL = 'multilateral',
  FULL_COALITION = 'full_coalition',
}

export enum SharingLevel {
  NATIONAL_ONLY = 'national_only',
  FIVE_EYES = 'five_eyes',
  NATO = 'nato',
  MISSION_PARTNERS = 'mission_partners',
  RELEASABLE = 'releasable',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 9: BASTION COMPONENT MAPPING
// ═══════════════════════════════════════════════════════════════════════════

export interface BastionComponentMapping {
  /** Primary Bastion roadmap phase that implements this activity */
  primaryPhase: string;
  /** Bastion components involved */
  components: BastionComponent[];
  /** Current implementation status */
  implementationStatus: ImplementationStatus;
  /** What is missing if not fully implemented */
  gapAnalysis: string | null;
}

export interface BastionComponent {
  /** Technology layer */
  layer: 'smart_contract' | 'backend' | 'frontend' | 'agent' | 'edge';
  /** Module path (e.g., "dao/voting.rs", "agents/fusion-agent.ts") */
  module: string;
  /** Whether this component already exists */
  existingCapability: boolean;
  /** What enhancement is needed, if any */
  requiredEnhancement: string | null;
}

export enum ImplementationStatus {
  FULLY_IMPLEMENTED = 'fully_implemented',
  PARTIALLY_IMPLEMENTED = 'partially_implemented',
  PLANNED = 'planned',
  GAP_IDENTIFIED = 'gap_identified',
  NEW_REQUIREMENT = 'new_requirement',
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 10: CORE ENTITY - MDMP ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Core entity: A planning activity within the MDMP.
 * Each instance represents one item from the checklist, augmented with
 * Bastion-specific governance, agent, and verification configuration.
 */
export interface MDMPActivity {
  /** Unique identifier (e.g., "MDMP-0-07", "MDMP-2-16") */
  id: string;
  /** MDMP phase this activity belongs to */
  mdmpPhase: MDMPPhase;
  /** Activity category (used for safety matrix enforcement) */
  category: ActivityCategory;
  /** The checklist item description */
  description: string;

  // ── Authority & Control ──
  /** Five-level authority designation */
  authorityDesignation: AuthorityDesignation;
  /** Control posture mapping to Bastion AutonomyLevel */
  controlPosture: ControlPosture;
  /** Which DAO tier governs this activity */
  daoTier: DAOTier;
  /** Governance gate configuration (null = no gate required) */
  governanceGate: GovernanceGate | null;

  // ── AI Agent Configuration ──
  /** How AI agents participate */
  agentSupport: AgentSupportConfig;

  // ── Verification & Accountability ──
  /** Verification mechanism configuration */
  verification: VerificationConfig;
  /** When audit records must be created */
  auditRequirement: AuditRequirement;

  // ── Red Teaming ──
  /** Red team challenges associated with this activity */
  redTeamChallenges: RedTeamChallenge[];

  // ── Doctrine & Traceability ──
  /** Doctrinal references (e.g., "JP 5-0 Ch. III", "ADP 5-0 para 2-14") */
  doctrinalReferences: string[];
  /** Mapping to Bastion components and phases */
  bastionMapping: BastionComponentMapping;

  // ── Dependencies ──
  /** Activity IDs this depends on */
  dependsOn: string[];
  /** Activity IDs this enables */
  enables: string[];

  // ── Classification ──
  /** Minimum classification level for this activity */
  minimumClassification: string;
  /** Coalition relevance configuration */
  coalitionRelevance: CoalitionRelevance;
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 11: MDMP WORKFLOW STATE
// Managed by the MDMP Workflow smart contract
// ═══════════════════════════════════════════════════════════════════════════

/**
 * State of an MDMP planning workflow.
 * Tracked on-chain via the MDMP Workflow smart contract.
 */
export interface MDMPWorkflowState {
  /** Unique mission identifier */
  missionId: string;
  /** Current MDMP phase */
  currentPhase: MDMPPhase;
  /** DAO governing this workflow */
  daoId: string;
  /** Gate status per phase */
  phaseGates: Record<MDMPPhase, GateStatus[]>;
  /** Active assumptions */
  assumptions: Assumption[];
  /** Red team challenge records */
  redTeamChallenges: RedTeamChallengeRecord[];
  /** Phase transition audit trail */
  phaseTransitions: PhaseTransitionRecord[];
  /** When the workflow was created */
  createdAt: number;
  /** Who initiated the workflow */
  createdBy: string;
}

export interface GateStatus {
  /** Gate identifier */
  gateId: string;
  /** Gate type */
  gateType: GateType;
  /** Whether the gate has been satisfied */
  satisfied: boolean;
  /** Who/what satisfied the gate */
  satisfiedBy: string | null;
  /** When it was satisfied */
  satisfiedAt: number | null;
  /** Associated proposal ID (if DAO vote was required) */
  proposalId: number | null;
}

export interface RedTeamChallengeRecord {
  /** Challenge ID */
  challengeId: string;
  /** Response text */
  response: string;
  /** Who responded */
  respondedBy: string;
  /** When the response was submitted */
  respondedAt: number;
  /** Whether the response was AI-assisted */
  aiAssisted: boolean;
  /** Response depth achieved */
  responseDepth: ResponseDepth;
}

export interface PhaseTransitionRecord {
  /** Phase transitioned from */
  fromPhase: MDMPPhase;
  /** Phase transitioned to */
  toPhase: MDMPPhase;
  /** Who authorized the transition */
  authorizedBy: string;
  /** When the transition occurred */
  transitionedAt: number;
  /** Associated proposal ID */
  proposalId: number;
  /** Gates that were satisfied for this transition */
  satisfiedGates: string[];
  /** Assumptions accepted at this transition */
  acceptedAssumptions: string[];
  /** Red team challenges addressed */
  addressedChallenges: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 12: SAFETY MATRIX
// Enforces which AuthorityDesignation values are permitted per category
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Safety matrix entry.
 * Defines the maximum and minimum authority designations for an activity category.
 *
 * CRITICAL: This matrix is enforced at the smart contract level.
 * Attempting to assign an authority designation outside the permitted range
 * for a category will be rejected by the MDMP workflow contract.
 */
export interface SafetyMatrixEntry {
  /** Activity category */
  category: ActivityCategory;
  /** Maximum authority that can be assigned (most autonomous) */
  maxAuthority: AuthorityDesignation;
  /** Minimum authority that must be maintained (least autonomous) */
  minAuthority: AuthorityDesignation;
  /** Whether AI_AUTONOMOUS is permitted for this category */
  fullyDelegatedPermitted: boolean;
  /** Rationale for the boundary */
  rationale: string;
}

/**
 * The complete safety matrix.
 * This is the authoritative definition of human/AI boundaries.
 *
 * Categories where AI_AUTONOMOUS is PERMITTED:
 * - DATA_AGGREGATION: Pure compute, no judgment
 * - VALIDATION_CONSISTENCY: Rule-based checking
 * - MONITORING: Threshold-based alerting
 * - META_COGNITIVE: AI monitoring AI
 *
 * Categories where AI_AUTONOMOUS is PROHIBITED:
 * - Everything else, especially:
 * - AUTHORITY_DECISION: Command decisions (always HUMAN_ONLY)
 * - ETHICAL_LEGAL: Moral/legal judgment (always HUMAN_ONLY)
 * - RISK_JUDGMENT: Risk acceptance (HUMAN_ONLY for decision, hybrid for analysis)
 * - INTENT_ASSESSMENT: Adversary intent (HYBRID_HUMAN_LED minimum)
 */
export const SAFETY_MATRIX: SafetyMatrixEntry[] = [
  // ── AI Autonomous permitted ──
  {
    category: ActivityCategory.DATA_AGGREGATION,
    maxAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    minAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    fullyDelegatedPermitted: true,
    rationale: 'Pure data pipeline operations. No judgment. Errors caught downstream.',
  },
  {
    category: ActivityCategory.VALIDATION_CONSISTENCY,
    maxAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    minAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    fullyDelegatedPermitted: true,
    rationale: 'Deterministic rule-based checking. Same result every time.',
  },
  {
    category: ActivityCategory.MONITORING,
    maxAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    minAuthority: AuthorityDesignation.AI_PRIMARY,
    fullyDelegatedPermitted: true,
    rationale: 'Threshold-based alerting. Human responds to alerts, not the monitoring itself.',
  },
  {
    category: ActivityCategory.META_COGNITIVE,
    maxAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    minAuthority: AuthorityDesignation.AI_AUTONOMOUS,
    fullyDelegatedPermitted: true,
    rationale: 'AI monitoring AI outputs for quality. Architectural enforcement.',
  },
  // ── AI Primary permitted (human spot-checks) ──
  {
    category: ActivityCategory.PATTERN_RECOGNITION,
    maxAuthority: AuthorityDesignation.AI_PRIMARY,
    minAuthority: AuthorityDesignation.HYBRID_AI_LED,
    fullyDelegatedPermitted: false,
    rationale: 'Pattern identification may surface false positives requiring human judgment.',
  },
  {
    category: ActivityCategory.SUSTAINMENT,
    maxAuthority: AuthorityDesignation.AI_PRIMARY,
    minAuthority: AuthorityDesignation.HYBRID_AI_LED,
    fullyDelegatedPermitted: false,
    rationale: 'Logistics modeling is compute; implications require operational judgment.',
  },
  // ── Hybrid AI-Led maximum ──
  {
    category: ActivityCategory.MISSION_ANALYSIS,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'Analysis requires doctrinal interpretation. AI generates, human validates.',
  },
  {
    category: ActivityCategory.COA_GENERATION,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'COA generation uses doctrine and data. Human ensures strategic alignment.',
  },
  {
    category: ActivityCategory.COA_EVALUATION,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'Evaluation criteria and scoring can be systematic. Weighting is human.',
  },
  {
    category: ActivityCategory.WARGAMING,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'AI wargaming is scope enhancement. Model assumptions require human challenge.',
  },
  {
    category: ActivityCategory.DECISION_SUPPORT,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_AI_LED,
    fullyDelegatedPermitted: false,
    rationale: 'AI builds dashboards and matrices. Human decides what matters.',
  },
  {
    category: ActivityCategory.ORDERS_PRODUCTION,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'AI drafts; human ensures clarity, intent, and executability.',
  },
  {
    category: ActivityCategory.ASSESSMENT,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'Assessment data collection is AI. Interpreting what it means is human.',
  },
  {
    category: ActivityCategory.ASSUMPTION_MGMT,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HUMAN_ONLY,
    fullyDelegatedPermitted: false,
    rationale: 'AI surfaces assumptions (AI-led). Accepting them is human-only.',
  },
  {
    category: ActivityCategory.FORCE_PROTECTION,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'Threat modeling is AI-supported. FP decisions involve risk acceptance.',
  },
  // ── Hybrid Human-Led minimum ──
  {
    category: ActivityCategory.RED_TEAMING,
    maxAuthority: AuthorityDesignation.HYBRID_AI_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'AI red team agents contribute. Human red teamers validate and add creative challenges.',
  },
  {
    category: ActivityCategory.PROBLEM_FRAMING,
    maxAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'AI offers alternative framings. Human selects and owns the framing.',
  },
  {
    category: ActivityCategory.COALITION_MGMT,
    maxAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    minAuthority: AuthorityDesignation.HUMAN_ONLY,
    fullyDelegatedPermitted: false,
    rationale: 'Coalition management involves political judgment AI cannot own.',
  },
  {
    category: ActivityCategory.INTENT_ASSESSMENT,
    maxAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    minAuthority: AuthorityDesignation.HYBRID_HUMAN_LED,
    fullyDelegatedPermitted: false,
    rationale: 'AI models behavior patterns. Judging intent requires human understanding.',
  },
  // ── Human Only (no AI in decision) ──
  {
    category: ActivityCategory.RISK_JUDGMENT,
    maxAuthority: AuthorityDesignation.HUMAN_ONLY,
    minAuthority: AuthorityDesignation.HUMAN_ONLY,
    fullyDelegatedPermitted: false,
    rationale: 'Risk acceptance is a command decision. Cannot be delegated to AI.',
  },
  {
    category: ActivityCategory.AUTHORITY_DECISION,
    maxAuthority: AuthorityDesignation.HUMAN_ONLY,
    minAuthority: AuthorityDesignation.HUMAN_ONLY,
    fullyDelegatedPermitted: false,
    rationale: 'Command authority. Non-negotiable. Blockchain records the decision.',
  },
  {
    category: ActivityCategory.ETHICAL_LEGAL,
    maxAuthority: AuthorityDesignation.HUMAN_ONLY,
    minAuthority: AuthorityDesignation.HUMAN_ONLY,
    fullyDelegatedPermitted: false,
    rationale: 'Moral accountability and lawful judgment cannot be delegated.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13: GOVERNANCE INVARIANTS
// These are enforced at the smart contract level
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Governance invariants - immutable rules enforced by smart contracts.
 * Violation of any invariant is a contract-level panic (transaction rejected).
 */
export const GOVERNANCE_INVARIANTS = {
  /**
   * INVARIANT 1: STRIKE_AUTHORIZATION (existing, unchanged)
   * StrikeAuthorization proposals ALWAYS enforce NotAutonomous
   * regardless of DAO configuration. 100% threshold, 100% quorum.
   * Enforced in: near-contracts/src/dao/types.rs Proposal::get_effective_autonomy()
   */
  STRIKE_AUTHORIZATION: {
    rule: 'StrikeAuthorization always NotAutonomous, unanimous approval',
    enforced_in: 'dao/types.rs',
    existing: true,
  },

  /**
   * INVARIANT 2: MDMP_PHASE_PROGRESSION
   * No planning product from Phase N+1 can be approved until all
   * required gates in Phase N are satisfied.
   * Enforced in: mdmp/workflow.rs (new contract)
   */
  MDMP_PHASE_PROGRESSION: {
    rule: 'Phase gates must be satisfied before advancing',
    enforced_in: 'mdmp/workflow.rs',
    existing: false,
  },

  /**
   * INVARIANT 3: ASSUMPTION_ACCOUNTABILITY
   * Every planning assumption must have an explicit human acceptor,
   * a sensitivity rating, a validation method, and an expiration date.
   * Enforced in: mdmp/assumptions.rs (new contract)
   */
  ASSUMPTION_ACCOUNTABILITY: {
    rule: 'Assumptions require explicit human acceptance with full metadata',
    enforced_in: 'mdmp/assumptions.rs',
    existing: false,
  },

  /**
   * INVARIANT 4: RED_TEAM_COMPLETENESS
   * Phase transitions require documented responses to all registered
   * red team challenges for that phase.
   * Enforced in: mdmp/workflow.rs (new contract)
   */
  RED_TEAM_COMPLETENESS: {
    rule: 'All red team challenges must be addressed before phase transition',
    enforced_in: 'mdmp/workflow.rs',
    existing: false,
  },

  /**
   * INVARIANT 5: UNCERTAINTY_TRANSPARENCY
   * All AI agent outputs that inform governance decisions must include
   * calibrated confidence intervals. Outputs without uncertainty
   * metadata are rejected by the governance layer.
   * Enforced in: backend agent wrapper + contract validation
   */
  UNCERTAINTY_TRANSPARENCY: {
    rule: 'AI outputs must include confidence intervals',
    enforced_in: 'orchestration/agent-wrapper.ts + mdmp/workflow.rs',
    existing: false,
  },

  /**
   * INVARIANT 6: ASSUMPTION_INVALIDATION_TRIGGER
   * When a Critical-sensitivity assumption is invalidated, the system
   * automatically creates a mandatory replanning gate.
   * Enforced in: mdmp/assumptions.rs (new contract)
   */
  ASSUMPTION_INVALIDATION_TRIGGER: {
    rule: 'Critical assumption invalidation triggers mandatory replanning',
    enforced_in: 'mdmp/assumptions.rs',
    existing: false,
  },

  /**
   * INVARIANT 7: COMMANDER_GUIDANCE_TRACEABILITY
   * All commander guidance recorded as ProposalKind. Guidance that
   * modifies accepted assumptions triggers re-evaluation.
   * Enforced in: mdmp/workflow.rs (new contract)
   */
  COMMANDER_GUIDANCE_TRACEABILITY: {
    rule: 'Commander guidance recorded and linked to assumptions',
    enforced_in: 'mdmp/workflow.rs',
    existing: false,
  },

  /**
   * INVARIANT 8: FULLY_DELEGATED_SCOPE_RESTRICTION
   * FullyDelegated autonomy can ONLY be assigned to activities
   * categorized as DATA_AGGREGATION, VALIDATION_CONSISTENCY,
   * MONITORING, or META_COGNITIVE.
   * Enforced in: mdmp/workflow.rs (new contract)
   */
  FULLY_DELEGATED_SCOPE: {
    rule: 'AI Autonomous restricted to deterministic/data/monitoring categories',
    enforced_in: 'mdmp/workflow.rs',
    existing: false,
  },

  /**
   * INVARIANT 9: SAFETY_MATRIX_ENFORCEMENT
   * Authority designation for any activity must fall within the
   * permitted range defined by the safety matrix for its category.
   * Commander override can relax within range but not exceed maxAuthority.
   * Enforced in: mdmp/workflow.rs (new contract)
   */
  SAFETY_MATRIX_ENFORCEMENT: {
    rule: 'Authority designation must comply with safety matrix per category',
    enforced_in: 'mdmp/workflow.rs',
    existing: false,
  },
} as const;
