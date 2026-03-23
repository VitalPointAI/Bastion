/**
 * DesignInterviewProgress — 4-section progress bar for design interview
 *
 * Phase 55 Plan 04: Shows which doctrinal section is active and coverage
 * criteria status for each. Compact horizontal bar for Design tab or drawer.
 */

import React from 'react';
import type { DesignInterviewMeta } from '../../hooks/useDesignInterview.ts';

const SECTIONS = [
  { key: 'problem-framing', label: 'Problem Framing' },
  { key: 'cog-analysis', label: 'CoG Analysis' },
  { key: 'loes', label: 'Lines of Effort' },
  { key: 'operational-approach', label: 'Operational Approach' },
] as const;

interface Props {
  interviewState: DesignInterviewMeta | null;
}

export function DesignInterviewProgress({ interviewState }: Props) {
  if (!interviewState) return null;

  const { currentSection, sectionCoverage } = interviewState;

  return (
    <div className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
      {SECTIONS.map((section, idx) => {
        const coverage = sectionCoverage[section.key];
        const isCurrent = section.key === currentSection;
        const isComplete = coverage?.met === true;
        const isPending = !isCurrent && !isComplete;

        const metCount = coverage?.metCriteria?.length ?? 0;
        const totalCount = coverage?.criteria?.length ?? 0;

        return (
          <React.Fragment key={section.key}>
            {idx > 0 && (
              <div className={`h-px w-4 flex-shrink-0 ${isComplete || isCurrent ? 'bg-blue-500' : 'bg-gray-600'}`} />
            )}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                isCurrent
                  ? 'bg-blue-500/20 border border-blue-500/50 text-blue-300'
                  : isComplete
                  ? 'text-green-400'
                  : 'text-gray-500'
              }`}
            >
              {/* Status icon */}
              {isComplete ? (
                <span className="text-green-400">✓</span>
              ) : isCurrent ? (
                <span className="animate-pulse text-blue-400">◆</span>
              ) : isPending ? (
                <span className="text-gray-600">○</span>
              ) : null}

              <span className="whitespace-nowrap">{section.label}</span>

              {/* Coverage badge */}
              {totalCount > 0 && (
                <span className={`text-[10px] px-1 rounded ${
                  isComplete ? 'bg-green-900/50 text-green-400' : 'bg-gray-700 text-gray-400'
                }`}>
                  {metCount}/{totalCount}
                </span>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
