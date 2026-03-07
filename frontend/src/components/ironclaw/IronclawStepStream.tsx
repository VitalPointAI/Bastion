/**
 * IronclawStepStream -- Multi-step action progress stepper
 *
 * Vertical stepper showing status icons for each step:
 * pending (circle), running (pulsing), complete (check), failed (X).
 * Compact design for inline chat display.
 */

import type { StepProgressData, StepStatus } from '../../types/ironclaw.ts';

interface IronclawStepStreamProps {
  progress: StepProgressData;
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ago`;
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'complete':
      return (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'failed':
      return (
        <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
        </svg>
      );
    case 'running':
      return (
        <span className="block w-3 h-3 rounded-full bg-blue-400 animate-pulse" />
      );
    case 'pending':
    default:
      return (
        <span className="block w-3 h-3 rounded-full border-2 border-gray-500" />
      );
  }
}

export function IronclawStepStream({ progress }: IronclawStepStreamProps) {
  return (
    <div className="mt-1">
      <div className="space-y-1">
        {progress.steps.map((step, idx) => {
          const isCurrent = idx === progress.currentStep;
          return (
            <div key={idx} className="flex items-center gap-2">
              {/* Connector line + icon */}
              <div className="flex flex-col items-center w-4">
                <StepIcon status={step.status} />
                {idx < progress.steps.length - 1 && (
                  <div className="w-px h-3 bg-gray-600 mt-0.5" />
                )}
              </div>

              {/* Label */}
              <span
                className={`text-xs ${
                  isCurrent
                    ? 'text-white font-semibold'
                    : step.status === 'complete'
                      ? 'text-gray-400'
                      : step.status === 'failed'
                        ? 'text-red-400'
                        : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Elapsed time */}
      <p className="text-[10px] text-gray-500 mt-1.5 pl-6">
        Started {relativeTime(progress.startedAt)}
      </p>
    </div>
  );
}
