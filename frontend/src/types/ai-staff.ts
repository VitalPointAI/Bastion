/**
 * AI Staff Type System
 *
 * Complete type definitions for the AI staff panel system including
 * feed items, annotations, confidence levels, agent routing, and
 * shared state interfaces.
 */

// ============================================================================
// Tab Types
// ============================================================================

export type ProblemSetTab = 'understand' | 'design' | 'plan' | 'direct' | 'cop' | 'assess';

// ============================================================================
// Doctrinal Confidence
// ============================================================================

export type DoctrinalConfidence = 'confirmed' | 'probable' | 'possible' | 'doubtful';

/**
 * Convert a numeric confidence score (0-1) to doctrinal confidence level.
 * Thresholds: >= 0.85 confirmed, >= 0.60 probable, >= 0.30 possible, else doubtful
 */
export function toDoctrinalConfidence(score: number): DoctrinalConfidence {
  if (score >= 0.85) return 'confirmed';
  if (score >= 0.60) return 'probable';
  if (score >= 0.30) return 'possible';
  return 'doubtful';
}

export const CONFIDENCE_STYLES: Record<DoctrinalConfidence, { label: string; color: string }> = {
  confirmed: { label: 'Confirmed', color: 'var(--accent-green)' },
  probable: { label: 'Probable', color: 'var(--accent-blue)' },
  possible: { label: 'Possible', color: 'var(--accent-yellow)' },
  doubtful: { label: 'Doubtful', color: 'var(--accent-red)' },
};

// ============================================================================
// Feed Item Types
// ============================================================================

export type FeedItemAction = 'accept' | 'dismiss' | 'modify' | 'escalate';

export interface AIFeedItem {
  id: string;
  agentId: string;
  agentDisplayName: string;
  agentRole: string;
  teamId?: string;
  teamName?: string;
  sourceTab: ProblemSetTab;
  priority: 'critical' | 'high' | 'medium' | 'low';
  urgency: 'action_required' | 'attention' | 'info';
  content: string;
  contentType: 'recommendation' | 'analysis' | 'warning' | 'status';
  confidence: DoctrinalConfidence;
  timestamp: string;
  isRead: boolean;
  actions?: FeedItemAction[];
  inlineTarget?: { contentId: string; anchorId: string };
  isAutoApplied?: boolean;
  appliedAt?: string;
}

// ============================================================================
// Urgency Styles
// ============================================================================

export const URGENCY_STYLES: Record<AIFeedItem['urgency'], { label: string; className: string }> = {
  action_required: { label: 'Action Required', className: 'urgency-red' },
  attention: { label: 'Attention', className: 'urgency-amber' },
  info: { label: 'Info', className: 'urgency-green' },
};

// ============================================================================
// Inline Annotations
// ============================================================================

export interface AIAnnotation {
  annotationId: string;
  agentId: string;
  agentDisplayName: string;
  content: string;
  suggestedChange?: string;
  confidence: DoctrinalConfidence;
  isAutoApply: boolean;
  targetContentId: string;
  anchorId: string;
  status: 'pending' | 'accepted' | 'dismissed' | 'modified' | 'escalated';
}

// ============================================================================
// Chat Messages
// ============================================================================

export interface ChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'agent';
  agentId?: string;
  timestamp: string;
}

// ============================================================================
// AI Staff State
// ============================================================================

export interface AIStaffState {
  feedItems: AIFeedItem[];
  annotations: AIAnnotation[];
  isOpen: boolean;
  activeTab: string;
  unreadCount: number;
  chatHistory: ChatMessage[];
}

// ============================================================================
// Agent Routing
// ============================================================================

export interface TabAgentConfig {
  tabId: ProblemSetTab;
  defaultAgents: string[];
  userAddedAgents: string[];
}
