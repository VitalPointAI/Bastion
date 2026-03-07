/**
 * AI Staff Panel - Barrel Export
 *
 * Re-exports for the AI staff panel component system.
 */

export {
  PROCESS_TABS,
  WATCH_TABS,
  DEFAULT_TAB_AGENTS,
  isProcessTab,
  isWatchTab,
  getDefaultTabConfig,
} from './AgentRoutingConfig.ts';

export { AIStaffPanel } from './AIStaffPanel.tsx';
export { AIStaffDocked } from './AIStaffDocked.tsx';
export { AIStaffFloating } from './AIStaffFloating.tsx';
export { AIStaffFeedItem } from './AIStaffFeedItem.tsx';
export { AIStaffTeamBadge } from './AIStaffTeamBadge.tsx';
export { AIStaffConfidence } from './AIStaffConfidence.tsx';
export { AIStaffTeamDetail } from './AIStaffTeamDetail.tsx';
export { AIStaffChatInput } from './AIStaffChatInput.tsx';
