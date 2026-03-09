/**
 * MissionControl - Mission control dashboard for document intelligence processing
 *
 * NASA mission control / Bloomberg terminal aesthetic with dark theme,
 * animated specialist agent status cards, processing progress bar,
 * and flagged source banner.
 */

import { useState, useEffect } from 'react';
import type { DocProcessingState, SpecialistAgentStatus } from '../../hooks/useDocProcessing';

// ============================================================================
// Specialist Icons (emoji-based for simplicity, upgradeable to SVG)
// ============================================================================

const SPECIALIST_ICONS: Record<string, string> = {
  'format-converter': '\u2699',      // gear
  'document-classifier': '\uD83D\uDCCB', // clipboard
  'trust-agent': '\uD83D\uDEE1',         // shield
  'fact-extractor': '\uD83D\uDD0D',      // magnifying glass
  'objective-extractor': '\uD83C\uDFAF', // target
  'perspective-analyst': '\uD83D\uDC41',  // eye
  'bias-identifier': '\u2696',        // scales
  'cross-doc-linker': '\uD83D\uDD17',    // link
  'quality-assessor': '\u2B50',       // star
  'researcher': '\uD83D\uDCDA',          // books
};

// ============================================================================
// Status styling
// ============================================================================

const STATUS_STYLES: Record<SpecialistAgentStatus, { bg: string; border: string; text: string; badge: string }> = {
  queued: {
    bg: 'bg-gray-800/50',
    border: 'border-gray-700',
    text: 'text-gray-400',
    badge: 'bg-gray-600 text-gray-300',
  },
  running: {
    bg: 'bg-blue-950/40',
    border: 'border-blue-500 animate-pulse',
    text: 'text-blue-300',
    badge: 'bg-blue-600 text-blue-100',
  },
  complete: {
    bg: 'bg-green-950/30',
    border: 'border-green-600',
    text: 'text-green-400',
    badge: 'bg-green-700 text-green-100',
  },
  error: {
    bg: 'bg-red-950/30',
    border: 'border-red-600',
    text: 'text-red-400',
    badge: 'bg-red-700 text-red-100',
  },
  skipped: {
    bg: 'bg-gray-900/40',
    border: 'border-gray-600 border-dashed',
    text: 'text-gray-500',
    badge: 'bg-gray-700 text-gray-400',
  },
};

const STATUS_LABELS: Record<SpecialistAgentStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  complete: 'Complete',
  error: 'Error',
  skipped: 'Skipped',
};

// ============================================================================
// Elapsed Timer Component
// ============================================================================

function ElapsedTimer({ startTime }: { startTime: string }) {
  const [elapsed, setElapsed] = useState('00:00');

  useEffect(() => {
    const start = new Date(startTime).getTime();
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60).toString().padStart(2, '0');
      const s = (diff % 60).toString().padStart(2, '0');
      setElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  return <span className="font-mono text-cyan-400">{elapsed}</span>;
}

// ============================================================================
// MissionControl Component
// ============================================================================

interface MissionControlProps {
  problemSetId: string;
  processingState: DocProcessingState;
  onApproveFlag?: () => void;
  onRejectFlag?: () => void;
}

export function MissionControl({
  processingState,
  onApproveFlag,
  onRejectFlag,
}: MissionControlProps) {
  const {
    specialists,
    isProcessing,
    flagged,
    error,
    documentName,
    startTime,
  } = processingState;

  // Calculate overall progress
  const specialistArray = Array.from(specialists.values());
  const totalSpecialists = specialistArray.length;
  const completedCount = specialistArray.filter(
    (s) => s.status === 'complete' || s.status === 'skipped'
  ).length;
  const progressPercent = totalSpecialists > 0 ? (completedCount / totalSpecialists) * 100 : 0;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Top Bar */}
      <div className="bg-gray-950 border-b border-gray-700 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-semibold text-gray-200 uppercase tracking-wide">
            Mission Control
          </span>
          {documentName && (
            <span className="text-xs text-gray-400 truncate max-w-50">
              {documentName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-400">
          {startTime && (
            <>
              <span>Started: {new Date(startTime).toLocaleTimeString()}</span>
              <span>Elapsed: <ElapsedTimer startTime={startTime} /></span>
            </>
          )}
          <span className="font-mono text-gray-300">
            {completedCount}/{totalSpecialists} specialists
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-linear-to-r from-blue-600 to-cyan-500 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Flagged Source Banner */}
      {flagged && (
        <div className="bg-amber-900/40 border-b border-amber-600 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-400 text-lg">!</span>
            <div>
              <p className="text-sm font-medium text-amber-300">
                Source Flagged for Review
              </p>
              <p className="text-xs text-amber-400/80">{flagged.reason}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {onApproveFlag && (
              <button
                onClick={onApproveFlag}
                className="px-3 py-1 text-xs font-medium bg-green-700 hover:bg-green-600 text-green-100 rounded transition-colors"
              >
                Approve
              </button>
            )}
            {onRejectFlag && (
              <button
                onClick={onRejectFlag}
                className="px-3 py-1 text-xs font-medium bg-red-700 hover:bg-red-600 text-red-100 rounded transition-colors"
              >
                Reject
              </button>
            )}
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="bg-red-900/30 border-b border-red-700 px-4 py-2">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Specialist Cards Grid */}
      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {specialistArray.map((specialist) => {
          const style = STATUS_STYLES[specialist.status];
          return (
            <div
              key={specialist.id}
              className={`${style.bg} border ${style.border} rounded-lg p-3 transition-all duration-300`}
            >
              {/* Card Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">
                    {SPECIALIST_ICONS[specialist.id] || '\uD83E\uDD16'}
                  </span>
                  <span className={`text-sm font-medium ${style.text}`}>
                    {specialist.name}
                  </span>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${style.badge}`}>
                  {STATUS_LABELS[specialist.status]}
                </span>
              </div>

              {/* Running state detail */}
              {specialist.status === 'running' && (
                <div className="mt-1">
                  {specialist.stage && (
                    <p className="text-xs text-blue-300/80 truncate">
                      {specialist.stage}
                    </p>
                  )}
                  {specialist.entitiesFound != null && specialist.entitiesFound > 0 && (
                    <p className="text-xs text-blue-400 font-mono mt-1">
                      {specialist.entitiesFound} entities found
                    </p>
                  )}
                </div>
              )}

              {/* Complete state detail */}
              {specialist.status === 'complete' && (
                <div className="mt-1 flex items-center justify-between text-xs text-green-400/80">
                  {specialist.duration != null && (
                    <span>{(specialist.duration / 1000).toFixed(1)}s</span>
                  )}
                  {specialist.entitiesFound != null && (
                    <span className="font-mono">{specialist.entitiesFound} entities</span>
                  )}
                </div>
              )}

              {/* Error state detail */}
              {specialist.status === 'error' && specialist.error && (
                <p className="mt-1 text-xs text-red-400/80 truncate">
                  {specialist.error}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
