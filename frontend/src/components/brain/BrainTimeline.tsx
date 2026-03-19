import React, { useCallback, useMemo } from 'react';
import './BrainTimeline.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrainTimelineProps {
  /** Start and end of the temporal range covered by the current graph data */
  timeRange: { start: Date; end: Date };
  /** The far future boundary (now + 7 days) */
  futureTime: Date;
  /** Currently selected time or null when live */
  selectedTime: Date | null;
  /** Whether the timeline is in live/current mode */
  isLive: boolean;
  /** Whether a historical snapshot is being fetched */
  loading: boolean;
  /** Called when user scrubs to a new time. Pass null to signal "go live". */
  onTimeChange: (time: Date | null) => void;
  /** Called when user clicks the LIVE button */
  onGoLive: () => void;
  /** Optional array of node creation timestamps for activity density dots */
  nodeTimestamps?: Date[];
  // ── Playback props ─────────────────────────────────────────────────────────
  /** Whether animated playback is currently running */
  isPlaying?: boolean;
  /** Current playback speed multiplier */
  playbackSpeed?: number;
  /** Called when user clicks play */
  onPlayStart?: (speed: number) => void;
  /** Called when user clicks pause */
  onPlayStop?: () => void;
  /** Called when user changes playback speed */
  onSpeedChange?: (speed: number) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLAYBACK_SPEEDS = [0.5, 1, 2, 5] as const;
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatLabel(date: Date, now: Date): string {
  const yearsDiff = Math.abs(date.getFullYear() - now.getFullYear());
  if (yearsDiff >= 1) {
    return date.getFullYear().toString();
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimeDisplay(date: Date | null): string {
  if (!date) return 'Current';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * BrainTimeline
 *
 * Bottom-of-brain timeline scrubber with three visual zones:
 * - Past: left side, subtle gradient, historical data
 * - Now: vertical accent line dividing past from future
 * - Future: right side, diagonal stripe pattern, prediction zone
 *
 * Users drag the thumb to scrub to any point in time. Clicking the LIVE button
 * returns to the current real-time view.
 *
 * Animated playback auto-advances through time, triggering graph re-fetches
 * that show entities appearing and fading based on validFrom/validTo.
 */
export const BrainTimeline: React.FC<BrainTimelineProps> = ({
  timeRange,
  futureTime,
  selectedTime,
  isLive,
  loading,
  onTimeChange,
  onGoLive,
  nodeTimestamps,
  isPlaying = false,
  playbackSpeed = 1,
  onPlayStart,
  onPlayStop,
  onSpeedChange,
}) => {
  const now = useMemo(() => new Date(), []);

  // ── Percentage calculations for absolute positioning ──────────────────────

  const totalSpanMs = futureTime.getTime() - timeRange.start.getTime();

  const nowPct = useMemo(() => {
    if (totalSpanMs <= 0) return 50;
    return ((now.getTime() - timeRange.start.getTime()) / totalSpanMs) * 100;
  }, [now, timeRange.start, totalSpanMs]);

  // ── Range input values ────────────────────────────────────────────────────

  const minVal = timeRange.start.getTime();
  const maxVal = futureTime.getTime();
  const currentVal = selectedTime?.getTime() ?? now.getTime();

  // ── Activity density dots ─────────────────────────────────────────────────

  const densityDots = useMemo(() => {
    if (!nodeTimestamps || nodeTimestamps.length === 0 || totalSpanMs <= 0) return [];
    return nodeTimestamps
      .map((ts) => {
        const pct = ((ts.getTime() - timeRange.start.getTime()) / totalSpanMs) * 100;
        return pct >= 0 && pct <= 100 ? pct : null;
      })
      .filter((pct): pct is number => pct !== null);
  }, [nodeTimestamps, timeRange.start, totalSpanMs]);

  // ── Event handlers ────────────────────────────────────────────────────────

  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const ms = parseInt(e.target.value, 10);
      const date = new Date(ms);
      // If within 1 hour of now, snap to live
      if (Math.abs(date.getTime() - now.getTime()) < 60 * 60 * 1000) {
        onTimeChange(null);
      } else {
        onTimeChange(date);
      }
    },
    [now, onTimeChange],
  );

  const handlePlayPause = useCallback(() => {
    if (isPlaying) {
      onPlayStop?.();
    } else {
      onPlayStart?.(playbackSpeed);
    }
  }, [isPlaying, onPlayStart, onPlayStop, playbackSpeed]);

  const handleSpeedChange = useCallback(
    (speed: PlaybackSpeed) => {
      onSpeedChange?.(speed);
      // If currently playing, restart with new speed
      if (isPlaying) {
        onPlayStop?.();
        onPlayStart?.(speed);
      }
    },
    [isPlaying, onPlayStop, onPlayStart, onSpeedChange],
  );

  // ── Labels ────────────────────────────────────────────────────────────────

  const startLabel = formatLabel(timeRange.start, now);
  const nowLabel = 'NOW';
  const futureLabel = formatLabel(futureTime, now);

  const showPlaybackControls = !!(onPlayStart || onPlayStop);

  return (
    <div className="brain-timeline-container">
      {/* Header: time display + live button + playback controls */}
      <div className="brain-timeline-header">
        <span className="brain-timeline-time-display">{formatTimeDisplay(selectedTime)}</span>

        {/* Playback controls */}
        {showPlaybackControls && (
          <div className="brain-timeline-playback">
            {/* Play / Pause button */}
            <button
              className={`brain-timeline-play-btn${isPlaying ? ' brain-timeline-play-btn--active' : ''}`}
              onClick={handlePlayPause}
              type="button"
              title={isPlaying ? 'Pause playback' : 'Start animated playback'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                // Pause icon (two vertical bars)
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <rect x="1" y="1" width="4" height="10" rx="1" />
                  <rect x="7" y="1" width="4" height="10" rx="1" />
                </svg>
              ) : (
                // Play icon (triangle)
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
                  <polygon points="2,1 11,6 2,11" />
                </svg>
              )}
            </button>

            {/* Speed selector */}
            <div className="brain-timeline-speed-selector" role="group" aria-label="Playback speed">
              {PLAYBACK_SPEEDS.map((speed) => (
                <button
                  key={speed}
                  type="button"
                  className={`brain-timeline-speed-btn${playbackSpeed === speed ? ' brain-timeline-speed-btn--active' : ''}`}
                  onClick={() => handleSpeedChange(speed)}
                  aria-pressed={playbackSpeed === speed}
                  title={`${speed}x speed`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          className={`brain-timeline-live-btn${isLive ? ' brain-timeline-live-btn--active' : ''}`}
          onClick={onGoLive}
          type="button"
          title="Return to live / current view"
        >
          <span className={`brain-timeline-live-dot${isLive ? ' brain-timeline-live-dot--active' : ''}`} />
          LIVE
        </button>
      </div>

      {/* Track */}
      <div className="brain-timeline-track">
        {/* Past zone */}
        <div
          className="brain-timeline-past"
          style={{ width: `${Math.min(nowPct, 100)}%` }}
        />

        {/* Future zone */}
        <div
          className="brain-timeline-future"
          style={{
            left: `${Math.min(Math.max(nowPct, 0), 100)}%`,
            width: `${Math.max(100 - nowPct, 0)}%`,
          }}
        />

        {/* Activity density dots */}
        {densityDots.map((pct, i) => (
          <div
            key={i}
            className="brain-timeline-density-dot"
            style={{ left: `${pct}%` }}
          />
        ))}

        {/* NOW marker */}
        <div
          className="brain-timeline-now"
          style={{ left: `${Math.min(Math.max(nowPct, 0), 100)}%` }}
        >
          <span className="brain-timeline-now-label">{nowLabel}</span>
        </div>

        {/* Loading indicator */}
        {loading && <div className="brain-timeline-loading-bar" />}

        {/* Range input — invisible except for the custom thumb */}
        <input
          type="range"
          className="brain-timeline-input"
          min={minVal}
          max={maxVal}
          value={currentVal}
          step={3_600_000} // 1 hour
          onChange={handleRangeChange}
          aria-label="Timeline scrubber"
        />
      </div>

      {/* Labels */}
      <div className="brain-timeline-labels">
        <span>{startLabel}</span>
        <span style={{ position: 'absolute', left: `${nowPct}%`, transform: 'translateX(-50%)' }}>
          {/* spacer — NOW label is on the marker itself */}
        </span>
        <span>{futureLabel}</span>
      </div>
    </div>
  );
};

export default BrainTimeline;
