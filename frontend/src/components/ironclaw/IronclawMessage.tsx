/**
 * IronclawMessage -- Chat message component with specialist attribution
 *
 * Renders user, Ironclaw, and specialist-attributed messages with
 * inline action cards and step progress when present.
 */

import Markdown from 'react-markdown';
import type { IronclawChatMessage, TrustDecision } from '../../types/ironclaw.ts';
import { IronclawActionCard } from './IronclawActionCard.tsx';
import { IronclawStepStream } from './IronclawStepStream.tsx';
import { generateAgentAvatar } from '../../lib/agent-avatar.ts';

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
        {/* Avatar */}
        {!isUser && (
          <img
            src={generateAgentAvatar(
              isSpecialist ? (message.specialistId || 'specialist') : 'ironclaw',
              senderLabel,
              20
            )}
            alt={senderLabel}
            className="w-5 h-5 rounded"
          />
        )}
        <span className="text-xs text-gray-400 font-medium">{senderLabel}</span>
        {isSpecialist && (
          <span className="text-[10px] text-gray-500 italic">via Ironclaw</span>
        )}
      </div>

      {/* Message bubble */}
      <div className={`${alignment} ${maxWidth} ${bgColor} rounded-lg px-3 py-2`}>
        <div className="ironclaw-md text-sm break-words">
          <Markdown
            components={{
              // Render inline code with styling
              code: ({ children, className }) => {
                const isBlock = className?.startsWith('language-');
                return isBlock ? (
                  <pre className="bg-black/30 rounded px-2 py-1.5 my-1.5 overflow-x-auto text-xs">
                    <code className={className}>{children}</code>
                  </pre>
                ) : (
                  <code className="bg-black/20 rounded px-1 py-0.5 text-xs font-mono">{children}</code>
                );
              },
              pre: ({ children }) => <>{children}</>,
              p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc pl-4 mb-1.5 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 mb-1.5 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              h1: ({ children }) => <h1 className="text-base font-bold mb-1 mt-2">{children}</h1>,
              h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 mt-1.5">{children}</h3>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-slate-500 pl-2 my-1.5 text-slate-300 italic">
                  {children}
                </blockquote>
              ),
              table: ({ children }) => (
                <div className="overflow-x-auto my-1.5">
                  <table className="text-xs border-collapse w-full">{children}</table>
                </div>
              ),
              th: ({ children }) => <th className="border border-slate-600 px-2 py-1 text-left bg-slate-800/50">{children}</th>,
              td: ({ children }) => <td className="border border-slate-700 px-2 py-1">{children}</td>,
            }}
          >
            {message.content}
          </Markdown>
        </div>

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
