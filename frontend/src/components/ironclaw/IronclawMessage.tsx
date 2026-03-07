/**
 * IronclawMessage -- Chat message component with specialist attribution
 *
 * Renders user, Ironclaw, and specialist-attributed messages with
 * inline action cards and step progress when present.
 */

import type { IronclawChatMessage, TrustDecision } from '../../types/ironclaw.ts';
import { IronclawActionCard } from './IronclawActionCard.tsx';
import { IronclawStepStream } from './IronclawStepStream.tsx';

interface IronclawMessageProps {
  message: IronclawChatMessage;
  onActionDecision?: (actionId: string, decision: TrustDecision) => void;
}

/** Format a date string as relative time (e.g., "2m ago") */
function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function IronclawMessage({ message, onActionDecision }: IronclawMessageProps) {
  const isUser = message.sender === 'user';
  const isSpecialist = message.sender === 'specialist';

  // Alignment and background
  const alignment = isUser ? 'ml-auto' : 'mr-auto';
  const maxWidth = 'max-w-[85%]';
  const bgColor = isUser
    ? 'bg-indigo-600 text-white'
    : isSpecialist
      ? 'bg-slate-700 text-gray-100'
      : 'bg-slate-800 text-gray-100';

  // Sender label
  const senderLabel = isUser
    ? 'You'
    : isSpecialist
      ? message.specialistDisplayName || 'Specialist'
      : 'Ironclaw';

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} mb-3`}>
      {/* Sender label */}
      <div className={`flex items-center gap-1.5 mb-1 px-1 ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Icon */}
        {!isUser && (
          <span className="text-xs">
            {isSpecialist ? (
              <svg className="w-3.5 h-3.5 text-blue-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 text-amber-400 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            )}
          </span>
        )}
        <span className="text-xs text-gray-400 font-medium">{senderLabel}</span>
        {isSpecialist && (
          <span className="text-[10px] text-gray-500 italic">via Ironclaw</span>
        )}
      </div>

      {/* Message bubble */}
      <div className={`${alignment} ${maxWidth} ${bgColor} rounded-lg px-3 py-2`}>
        <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>

        {/* Inline action card */}
        {message.actionCard && onActionDecision && (
          <div className="mt-2">
            <IronclawActionCard card={message.actionCard} onDecision={onActionDecision} />
          </div>
        )}

        {/* Inline step progress */}
        {message.stepProgress && (
          <div className="mt-2">
            <IronclawStepStream progress={message.stepProgress} />
          </div>
        )}
      </div>

      {/* Timestamp */}
      <span className="text-[10px] text-gray-500 mt-0.5 px-1">
        {relativeTime(message.createdAt)}
      </span>
    </div>
  );
}
