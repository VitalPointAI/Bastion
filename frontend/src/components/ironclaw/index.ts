/**
 * Ironclaw Components -- Barrel export
 *
 * All Ironclaw UI components and frontend types.
 */

// Components
export { IronclawButton } from './IronclawButton.tsx';
export { IronclawDrawer } from './IronclawDrawer.tsx';
export { IronclawMessage } from './IronclawMessage.tsx';
export { IronclawActionCard } from './IronclawActionCard.tsx';
export { IronclawSuggestion } from './IronclawSuggestion.tsx';
export { IronclawStepStream } from './IronclawStepStream.tsx';
export { IronclawTaskPanel } from './IronclawTaskPanel.tsx';
export { IronclawMemoryPanel } from './IronclawMemoryPanel.tsx';
export { IronclawActivityFeed } from './IronclawActivityFeed.tsx';
export { ToolCallCard } from './ToolCallCard.tsx';
export { DelegationNotice } from './DelegationNotice.tsx';
export { InlineError } from './InlineError.tsx';
export { SSEConnectionIndicator } from './SSEConnectionIndicator.tsx';

// Types (re-exported from types module)
export type {
  IronclawSender,
  ActionRiskLevel,
  TrustDecision,
  StepStatus,
  IronclawChatMessage,
  ActionCardData,
  StepProgressData,
  StepInfo,
  SuggestionData,
  IronclawTaskData,
  TrustPreference,
  AutonomousActivityEntry,
  StreamingResponse,
  ToolCallState,
  DelegationState,
  InlineErrorState,
  SSEConnectionState,
} from '../../types/ironclaw.ts';
