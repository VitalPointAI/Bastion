/**
 * Ironclaw Frontend Type Definitions
 *
 * CamelCase frontend types mirroring backend snake_case.
 * Duplicated per project convention (no shared package, backend authoritative).
 */

// ============================================================================
// Enums / Union Types
// ============================================================================

export type IronclawSender = 'user' | 'ironclaw' | 'specialist';
export type ActionRiskLevel = 'low' | 'medium' | 'high';
export type TrustDecision = 'yes' | 'no' | 'always';
export type StepStatus = 'pending' | 'running' | 'complete' | 'failed';

// ============================================================================
// Chat Messages
// ============================================================================

export interface IronclawChatMessage {
  id: string;
  problemSetId: string;
  content: string;
  sender: IronclawSender;
  specialistId?: string;
  specialistDisplayName?: string;
  delegatedBy?: string;
  actionCard?: ActionCardData;
  stepProgress?: StepProgressData;
  suggestion?: SuggestionData;
  threadId?: string;
  createdAt: string;
}

// ============================================================================
// Action Cards
// ============================================================================

export interface ActionCardData {
  actionId: string;
  actionType: string;
  description: string;
  /** Specific target — URL, file path, resource name, etc. */
  detail?: string | null;
  riskLevel: ActionRiskLevel;
  options: TrustDecision[];
}

// ============================================================================
// Step Progress
// ============================================================================

export interface StepProgressData {
  actionId: string;
  steps: StepInfo[];
  currentStep: number;
  startedAt: string;
}

export interface StepInfo {
  label: string;
  status: StepStatus;
  startedAt?: string;
  completedAt?: string;
}

// ============================================================================
// Suggestions
// ============================================================================

export interface SuggestionData {
  id: string;
  content: string;
  agentId: string;
  agentDisplayName: string;
  actionType?: string;
  /** Target field path for write-back (e.g., 'problemStatement', 'design.cogAnalysis.friendly') */
  targetField?: string;
  /** Human-readable field label (e.g., 'Problem Statement') */
  targetFieldLabel?: string;
  /** The value to write to the field when accepted */
  fieldValue?: string;
}

// ============================================================================
// Task Orchestration
// ============================================================================

export interface IronclawTaskData {
  taskId: string;
  title: string;
  status: string;
  stepProgress: StepProgressData;
  suggestions: SuggestionData[];
  currentStep: number;
}

// ============================================================================
// Trust Preferences
// ============================================================================

export interface TrustPreference {
  id: string;
  actionType: string;
  problemSetId: string;
  grantedAt: string;
  expiresAt: string;
}

// ============================================================================
// User Memory (Plan 03)
// ============================================================================

export interface IronclawMemoryEntry {
  id: string;
  memory_key: string;
  memory_value: Record<string, unknown>;
  confidence: number;
  source: 'inferred' | 'explicit';
  created_at: string;
  updated_at: string;
  expires_at: string;
}
