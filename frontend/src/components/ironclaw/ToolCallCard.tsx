/**
 * ToolCallCard -- Expandable tool call display card
 *
 * Shows tool name and status with a collapsible detail pane
 * showing input/output JSON per D-04 of the UI-SPEC.
 */

import type { ToolCallState } from '../../types/ironclaw.ts';

interface ToolCallCardProps {
  toolCall: ToolCallState;
  onToggleExpand: () => void;
}

function StatusDot({ status }: { status: ToolCallState['status'] }) {
  switch (status) {
    case 'running':
      return <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />;
    case 'complete':
      return (
        <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'failed':
      return (
        <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'pending':
    default:
      return <span className="w-2 h-2 rounded-full border border-gray-500 flex-shrink-0" />;
  }
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-3 h-3 flex-shrink-0 transition-transform duration-150 ${expanded ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

export function ToolCallCard({ toolCall, onToggleExpand }: ToolCallCardProps) {
  const label = `${toolCall.toolName}: ${toolCall.statusMessage}`;
  const elapsedText = toolCall.elapsed != null ? `${toolCall.elapsed}ms` : '';

  return (
    <div className="my-1">
      {/* Collapsed row */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-lg px-3 py-2 flex items-center gap-2">
        <StatusDot status={toolCall.status} />

        {/* Tool name + status message */}
        <span className="text-xs text-gray-300 flex-1 truncate" title={label}>
          {label}
        </span>

        {/* Elapsed + expand button */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {elapsedText && (
            <span className="text-[10px] text-gray-500">{elapsedText}</span>
          )}
          <button
            type="button"
            onClick={onToggleExpand}
            className="text-gray-400 hover:text-gray-200 cursor-pointer flex items-center gap-0.5"
            aria-label={toolCall.expanded ? 'Hide details' : 'Show details'}
          >
            <span className="text-[10px]">{toolCall.expanded ? 'Hide details' : 'Show details'}</span>
            <ChevronIcon expanded={toolCall.expanded} />
          </button>
        </div>
      </div>

      {/* Expanded detail pane */}
      <div
        className={`transition-all duration-200 ease-in-out overflow-hidden ${
          toolCall.expanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-slate-900/60 border border-slate-700 border-t-0 rounded-b-lg px-3 py-2 space-y-2">
          {toolCall.input !== undefined && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Input</p>
              <pre className="bg-black/30 rounded px-2 py-1.5 text-xs text-gray-300 overflow-x-auto max-h-48">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.output !== undefined && (
            <div>
              <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1">Output</p>
              <pre className="bg-black/30 rounded px-2 py-1.5 text-xs text-gray-300 overflow-x-auto max-h-48">
                {JSON.stringify(toolCall.output, null, 2)}
              </pre>
            </div>
          )}
          {toolCall.input === undefined && toolCall.output === undefined && (
            <p className="text-[10px] text-gray-500 italic">No details available</p>
          )}
        </div>
      </div>
    </div>
  );
}
