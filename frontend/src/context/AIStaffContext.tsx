/**
 * AIStaffContext
 *
 * Provides shared cross-tab AI staff state to all child components.
 * Uses split state/dispatch pattern (two separate contexts) to prevent
 * excessive re-renders -- components reading only dispatch won't re-render
 * when state changes.
 *
 * - AIStaffProvider wraps tab content at ProblemSetTabContainer level
 * - useAIStaff() returns read-only state (feedItems, annotations, isOpen, etc.)
 * - useAIStaffDispatch() returns action functions (addFeedItem, markRead, etc.)
 * - Feed items sorted by priority then timestamp descending
 * - Panel auto-opens for process tabs, auto-closes for watch tabs
 */

import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';

import type {
  AIFeedItem,
  AIAnnotation,
  ChatMessage,
} from '../types/ai-staff.ts';

import { isProcessTab } from '../components/ai-staff/AgentRoutingConfig.ts';

// ============================================================================
// State Shape
// ============================================================================

interface AIStaffStateValue {
  feedItems: AIFeedItem[];
  annotations: AIAnnotation[];
  isOpen: boolean;
  activeTab: string;
  unreadCount: number;
  chatHistory: ChatMessage[];
}

// ============================================================================
// Dispatch Actions
// ============================================================================

interface AIStaffDispatchValue {
  addFeedItem: (item: AIFeedItem) => void;
  markRead: (itemId: string) => void;
  markAllRead: () => void;
  togglePanel: () => void;
  setOpen: (open: boolean) => void;
  addAnnotation: (annotation: AIAnnotation) => void;
  updateAnnotationStatus: (annotationId: string, status: AIAnnotation['status']) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearFeed: () => void;
}

// ============================================================================
// Contexts (split for render optimization)
// ============================================================================

const AIStaffStateContext = createContext<AIStaffStateValue | null>(null);
const AIStaffDispatchContext = createContext<AIStaffDispatchValue | null>(null);

// ============================================================================
// Reducer
// ============================================================================

type Action =
  | { type: 'ADD_FEED_ITEM'; item: AIFeedItem }
  | { type: 'MARK_READ'; itemId: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'TOGGLE_PANEL' }
  | { type: 'SET_OPEN'; open: boolean }
  | { type: 'ADD_ANNOTATION'; annotation: AIAnnotation }
  | { type: 'UPDATE_ANNOTATION_STATUS'; annotationId: string; status: AIAnnotation['status'] }
  | { type: 'ADD_CHAT_MESSAGE'; message: ChatMessage }
  | { type: 'CLEAR_FEED' }
  | { type: 'SET_ACTIVE_TAB'; tab: string };

/** Priority sort order: critical=0, high=1, medium=2, low=3 */
const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function sortFeedItems(items: AIFeedItem[]): AIFeedItem[] {
  return [...items].sort((a, b) => {
    const priorityDiff = (PRIORITY_ORDER[a.priority] ?? 4) - (PRIORITY_ORDER[b.priority] ?? 4);
    if (priorityDiff !== 0) return priorityDiff;
    // Same priority: newest first
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
}

function countUnread(items: AIFeedItem[]): number {
  return items.filter((i) => !i.isRead).length;
}

function reducer(state: AIStaffStateValue, action: Action): AIStaffStateValue {
  switch (action.type) {
    case 'ADD_FEED_ITEM': {
      const feedItems = sortFeedItems([action.item, ...state.feedItems]);
      return { ...state, feedItems, unreadCount: countUnread(feedItems) };
    }
    case 'MARK_READ': {
      const feedItems = state.feedItems.map((item) =>
        item.id === action.itemId ? { ...item, isRead: true } : item
      );
      return { ...state, feedItems, unreadCount: countUnread(feedItems) };
    }
    case 'MARK_ALL_READ': {
      const feedItems = state.feedItems.map((item) => ({ ...item, isRead: true }));
      return { ...state, feedItems, unreadCount: 0 };
    }
    case 'TOGGLE_PANEL':
      return { ...state, isOpen: !state.isOpen };
    case 'SET_OPEN':
      return { ...state, isOpen: action.open };
    case 'ADD_ANNOTATION':
      return { ...state, annotations: [...state.annotations, action.annotation] };
    case 'UPDATE_ANNOTATION_STATUS': {
      const annotations = state.annotations.map((ann) =>
        ann.annotationId === action.annotationId ? { ...ann, status: action.status } : ann
      );
      return { ...state, annotations };
    }
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.message] };
    case 'CLEAR_FEED':
      return { ...state, feedItems: [], unreadCount: 0 };
    case 'SET_ACTIVE_TAB': {
      const isOpen = isProcessTab(action.tab);
      return { ...state, activeTab: action.tab, isOpen };
    }
    default:
      return state;
  }
}

// ============================================================================
// Provider
// ============================================================================

interface AIStaffProviderProps {
  problemSetId: string;
  activeTab: string;
  children: ReactNode;
}

export function AIStaffProvider({ problemSetId: _problemSetId, activeTab, children }: AIStaffProviderProps) {
  const initialState: AIStaffStateValue = {
    feedItems: [],
    annotations: [],
    isOpen: isProcessTab(activeTab),
    activeTab,
    unreadCount: 0,
    chatHistory: [],
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  // Sync activeTab changes into state -- auto-toggle panel open/close
  useEffect(() => {
    if (state.activeTab !== activeTab) {
      dispatch({ type: 'SET_ACTIVE_TAB', tab: activeTab });
    }
  }, [activeTab, state.activeTab]);

  // Memoize state value to prevent re-renders on dispatch changes
  const stateValue = useMemo<AIStaffStateValue>(
    () => ({
      feedItems: state.feedItems,
      annotations: state.annotations,
      isOpen: state.isOpen,
      activeTab: state.activeTab,
      unreadCount: state.unreadCount,
      chatHistory: state.chatHistory,
    }),
    [state.feedItems, state.annotations, state.isOpen, state.activeTab, state.unreadCount, state.chatHistory]
  );

  // Memoize dispatch actions -- these never change identity
  const dispatchValue = useMemo<AIStaffDispatchValue>(
    () => ({
      addFeedItem: (item: AIFeedItem) => dispatch({ type: 'ADD_FEED_ITEM', item }),
      markRead: (itemId: string) => dispatch({ type: 'MARK_READ', itemId }),
      markAllRead: () => dispatch({ type: 'MARK_ALL_READ' }),
      togglePanel: () => dispatch({ type: 'TOGGLE_PANEL' }),
      setOpen: (open: boolean) => dispatch({ type: 'SET_OPEN', open }),
      addAnnotation: (annotation: AIAnnotation) => dispatch({ type: 'ADD_ANNOTATION', annotation }),
      updateAnnotationStatus: (annotationId: string, status: AIAnnotation['status']) =>
        dispatch({ type: 'UPDATE_ANNOTATION_STATUS', annotationId, status }),
      addChatMessage: (message: ChatMessage) => dispatch({ type: 'ADD_CHAT_MESSAGE', message }),
      clearFeed: () => dispatch({ type: 'CLEAR_FEED' }),
    }),
    []
  );

  return (
    <AIStaffStateContext.Provider value={stateValue}>
      <AIStaffDispatchContext.Provider value={dispatchValue}>
        {children}
      </AIStaffDispatchContext.Provider>
    </AIStaffStateContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================

/**
 * Read-only access to AI staff state.
 * Components using only this hook won't re-render when dispatch is called
 * (unless state actually changes).
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAIStaff(): AIStaffStateValue {
  const context = useContext(AIStaffStateContext);
  if (!context) {
    throw new Error('useAIStaff must be used within an AIStaffProvider');
  }
  return context;
}

/**
 * Access to AI staff dispatch actions.
 * Components using only this hook won't re-render when state changes.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAIStaffDispatch(): AIStaffDispatchValue {
  const context = useContext(AIStaffDispatchContext);
  if (!context) {
    throw new Error('useAIStaffDispatch must be used within an AIStaffProvider');
  }
  return context;
}
