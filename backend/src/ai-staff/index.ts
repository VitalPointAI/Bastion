/**
 * AI Staff Module
 *
 * Phase 29 Plan 02: Backend AI staff module barrel export.
 * Provides PostgreSQL persistence, REST API, feed priority ranking,
 * and WebSocket channel integration.
 */

// Store
export { AIStaffStore, aiStaffStore } from './ai-staff-store.js';

// Router
export { aiStaffRouter } from './ai-staff-router.js';

// Types
export type {
  AIFeedItemRow,
  AIAnnotationRow,
  ChatMessageRow,
  AgentTabRoutingRow,
  FeedQueryOptions,
  AnnotationQueryOptions,
  FeedPriority,
  FeedUrgency,
  FeedConfidence,
  AnnotationStatus,
  ChatSender,
} from './ai-staff-types.js';

// Priority algorithm
export { rankFeedItems, batchForWebSocket } from './feed-priority.js';
