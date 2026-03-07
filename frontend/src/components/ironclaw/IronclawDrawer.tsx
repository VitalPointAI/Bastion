/**
 * IronclawDrawer -- Slide-out drawer panel with chat interface
 *
 * Fixed right side panel with message list, loading state, and @mention input.
 * z-index 950. Slides in from right with overlay backdrop.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type {
  IronclawChatMessage,
  TrustDecision,
} from '../../types/ironclaw.ts';
import { IronclawMessage } from './IronclawMessage.tsx';
import { IronclawSuggestion } from './IronclawSuggestion.tsx';
import './IronclawDrawer.css';

// Hardcoded initial specialist list
const SPECIALISTS = [
  { id: 'j1-personnel', name: 'J1 Personnel' },
  { id: 'j2-intelligence', name: 'J2 Intelligence' },
  { id: 'j3-operations', name: 'J3 Operations' },
  { id: 'j4-logistics', name: 'J4 Logistics' },
  { id: 'j5-plans', name: 'J5 Plans' },
  { id: 'j6-communications', name: 'J6 Communications' },
];

interface IronclawDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  messages: IronclawChatMessage[];
  onSendMessage: (content: string, mentionedAgent?: string) => void;
  onActionDecision: (actionId: string, decision: TrustDecision) => void;
  onAcceptSuggestion?: (id: string) => void;
  onDismissSuggestion?: (id: string) => void;
  isLoading?: boolean;
}

export function IronclawDrawer({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  onActionDecision,
  onAcceptSuggestion,
  onDismissSuggestion,
  isLoading,
}: IronclawDrawerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  // Auto-resize textarea
  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      const maxHeight = 4 * 24; // 4 lines * ~24px line height
      ta.style.height = `${Math.min(ta.scrollHeight, maxHeight)}px`;
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setInputValue(value);

    // Detect @mention
    const atIdx = value.lastIndexOf('@');
    if (atIdx !== -1) {
      const afterAt = value.slice(atIdx + 1);
      // Show dropdown if @ is at end or followed by non-space text
      if (!afterAt.includes(' ')) {
        setMentionFilter(afterAt.toLowerCase());
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);

    setTimeout(resizeTextarea, 0);
  };

  const handleMentionSelect = (specialist: typeof SPECIALISTS[0]) => {
    const atIdx = inputValue.lastIndexOf('@');
    if (atIdx !== -1) {
      const before = inputValue.slice(0, atIdx);
      setInputValue(`${before}@${specialist.name} `);
      setSelectedAgent(specialist.id);
    }
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSend = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;

    onSendMessage(trimmed, selectedAgent);
    setInputValue('');
    setSelectedAgent(undefined);
    setShowMentions(false);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredSpecialists = SPECIALISTS.filter((s) =>
    s.name.toLowerCase().includes(mentionFilter)
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay backdrop */}
      <div
        className="ironclaw-overlay fixed inset-0 bg-black/30"
        style={{ zIndex: 949 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className="ironclaw-drawer fixed top-0 right-0 h-full bg-slate-900 border-l border-slate-700
          flex flex-col shadow-2xl"
        style={{ zIndex: 950, width: '420px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700 bg-slate-900/95">
          <div className="flex items-center gap-2">
            {/* Shield icon */}
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <div>
              <h2 className="text-sm font-semibold text-white">Ironclaw</h2>
              <p className="text-[10px] text-gray-400">Chief of Staff</p>
            </div>
            {/* Connection status */}
            <span className="w-2 h-2 rounded-full bg-green-500 ml-1" title="Connected" />
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-slate-700 transition-colors"
            aria-label="Close Ironclaw panel"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Message list */}
        <div className="ironclaw-messages flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <svg className="w-12 h-12 mb-3 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <p className="text-sm">Ironclaw is ready</p>
              <p className="text-xs mt-1">Ask anything or use @agent for specialists</p>
            </div>
          )}

          {messages.map((msg) => {
            // Render suggestion cards as IronclawSuggestion
            if (msg.suggestion && onAcceptSuggestion && onDismissSuggestion) {
              return (
                <IronclawSuggestion
                  key={msg.id}
                  suggestion={msg.suggestion}
                  onAccept={onAcceptSuggestion}
                  onDismiss={onDismissSuggestion}
                />
              );
            }

            return (
              <IronclawMessage
                key={msg.id}
                message={msg}
                onActionDecision={onActionDecision}
              />
            );
          })}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-gray-400">Ironclaw is thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="relative border-t border-slate-700 px-4 py-3 bg-slate-900/95">
          {/* @mention dropdown */}
          {showMentions && filteredSpecialists.length > 0 && (
            <div className="ironclaw-mention-dropdown absolute bottom-full left-4 right-4 mb-1
              bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
              {filteredSpecialists.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleMentionSelect(s)}
                  className="w-full px-3 py-2 text-left text-sm text-gray-200
                    hover:bg-slate-700 flex items-center gap-2 transition-colors"
                >
                  <svg className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask Ironclaw anything... Use @agent for direct specialist access"
              rows={1}
              className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2
                text-sm text-white placeholder-gray-500
                focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                resize-none"
              style={{ maxHeight: `${4 * 24}px` }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors flex-shrink-0"
              aria-label="Send message"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 19V5m0 0l-7 7m7-7l7 7"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
