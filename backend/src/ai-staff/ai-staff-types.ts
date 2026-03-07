/**
 * AI Staff Backend Types
 *
 * Phase 29 Plan 02: Database row types for AI staff feed, annotations,
 * chat messages, and agent tab routing. Snake_case columns matching
 * PostgreSQL conventions.
 */

// ---------------------------------------------------------------------------
// Priority & Urgency
// ---------------------------------------------------------------------------

export type FeedPriority = 'critical' | 'high' | 'medium' | 'low';
export type FeedUrgency = 'action_required' | 'attention' | 'info';
export type FeedConfidence = 'confirmed' | 'probable' | 'possible' | 'doubtful';
export type AnnotationStatus = 'pending' | 'accepted' | 'dismissed' | 'modified' | 'escalated';
export type ChatSender = 'user' | 'agent';

// ---------------------------------------------------------------------------
// Feed Item Row
// ---------------------------------------------------------------------------

export interface AIFeedItemRow {
  id: string;                        // uuid
  problem_set_id: string;
  agent_id: string;
  agent_display_name: string;
  agent_role: string;
  team_id: string | null;
  team_name: string | null;
  source_tab: string;
  priority: FeedPriority;
  urgency: FeedUrgency;
  content: string;
  content_type: string;
  confidence: FeedConfidence;
  is_read: boolean;
  is_auto_applied: boolean;
  inline_target: Record<string, unknown> | null;   // jsonb
  actions: Record<string, unknown>[] | null;        // jsonb
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Annotation Row
// ---------------------------------------------------------------------------

export interface AIAnnotationRow {
  id: string;
  problem_set_id: string;
  agent_id: string;
  agent_display_name: string;
  content: string;
  suggested_change: string | null;
  confidence: FeedConfidence;
  is_auto_apply: boolean;
  target_content_id: string;
  anchor_id: string;
  status: AnnotationStatus;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Chat Message Row
// ---------------------------------------------------------------------------

export interface ChatMessageRow {
  id: string;
  problem_set_id: string;
  content: string;
  sender: ChatSender;
  agent_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Agent Tab Routing Row
// ---------------------------------------------------------------------------

export interface AgentTabRoutingRow {
  id: string;
  problem_set_id: string;
  tab_id: string;
  agent_ids: string[];               // text[]
  is_user_customized: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Query Options
// ---------------------------------------------------------------------------

export interface FeedQueryOptions {
  tab?: string;
  limit?: number;
  offset?: number;
}

export interface AnnotationQueryOptions {
  tab?: string;
  status?: AnnotationStatus;
  limit?: number;
  offset?: number;
}
