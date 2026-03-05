/**
 * COPPhaseSlider
 *
 * Phase 21 Plan 10: Temporal phase scrub control with animated playback.
 * Provides manual scrubbing, play/pause with configurable speed,
 * phase markers, loop toggle, and a phase indicator bar.
 *
 * Designed to sit at the bottom of the COP map and drive the
 * currentPhase prop on COPMapView for temporal symbol positioning.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { COPPhaseSpec } from '../../types/cop.js';
import './COPPhaseSlider.css';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPPhaseSliderProps {
  /** Available temporal phases */
  phases: COPPhaseSpec[];
  /** Currently displayed phase number */
  currentPhase: number;
  /** Callback when user changes phase (scrub, click, or playback) */
  onPhaseChange: (phase: number) => void;
}

// ─── Speed Presets ──────────────────────────────────────────────────────────

interface SpeedPreset {
  label: string;
  multiplier: number;
}

const SPEED_PRESETS: SpeedPreset[] = [
  { label: '0.5x', multiplier: 2 },
  { label: '1x', multiplier: 1 },
  { label: '2x', multiplier: 0.5 },
];

/** Base interval between phase steps (ms) */
const BASE_INTERVAL_MS = 2000;

// ─── Component ──────────────────────────────────────────────────────────────

export function COPPhaseSlider({
  phases,
  currentPhase,
  onPhaseChange,
}: COPPhaseSliderProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1); // default 1x
  const [loop, setLoop] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sorted phase numbers for navigation
  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => a.phaseNumber - b.phaseNumber),
    [phases],
  );
  const phaseNumbers = useMemo(
    () => sortedPhases.map((p) => p.phaseNumber),
    [sortedPhases],
  );
  const minPhase = phaseNumbers.length > 0 ? phaseNumbers[0] : 0;
  const maxPhase = phaseNumbers.length > 0 ? phaseNumbers[phaseNumbers.length - 1] : 0;

  // Current phase info
  const currentPhaseSpec = sortedPhases.find((p) => p.phaseNumber === currentPhase);

  // ─── Playback Logic ─────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const advancePhase = useCallback(() => {
    // Find current index in sorted phase list
    const idx = phaseNumbers.indexOf(currentPhase);
    if (idx === -1) return;

    if (idx < phaseNumbers.length - 1) {
      // Advance to next phase
      onPhaseChange(phaseNumbers[idx + 1]);
    } else if (loop) {
      // Loop back to start
      onPhaseChange(phaseNumbers[0]);
    } else {
      // Reached end, stop
      stopPlayback();
    }
  }, [currentPhase, phaseNumbers, loop, onPhaseChange, stopPlayback]);

  const startPlayback = useCallback(() => {
    if (phaseNumbers.length <= 1) return;

    // If at end and not looping, restart from beginning
    const idx = phaseNumbers.indexOf(currentPhase);
    if (idx === phaseNumbers.length - 1 && !loop) {
      onPhaseChange(phaseNumbers[0]);
    }

    setIsPlaying(true);
  }, [phaseNumbers, currentPhase, loop, onPhaseChange]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      stopPlayback();
    } else {
      startPlayback();
    }
  }, [isPlaying, stopPlayback, startPlayback]);

  // Manage interval when playing
  useEffect(() => {
    if (isPlaying) {
      const intervalMs = BASE_INTERVAL_MS * SPEED_PRESETS[speedIdx].multiplier;
      intervalRef.current = setInterval(advancePhase, intervalMs);
    } else if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, speedIdx, advancePhase]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    onPhaseChange(value);
  };

  const handleMarkerClick = (phaseNumber: number) => {
    onPhaseChange(phaseNumber);
  };

  const handleSegmentClick = (phaseNumber: number) => {
    onPhaseChange(phaseNumber);
  };

  const handleSkipBack = () => {
    const idx = phaseNumbers.indexOf(currentPhase);
    if (idx > 0) {
      onPhaseChange(phaseNumbers[idx - 1]);
    }
  };

  const handleSkipForward = () => {
    const idx = phaseNumbers.indexOf(currentPhase);
    if (idx < phaseNumbers.length - 1) {
      onPhaseChange(phaseNumbers[idx + 1]);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────

  if (phases.length === 0) return null;

  return (
    <div className="cop-phase-slider">
      {/* Phase label */}
      <div className="cop-phase-label-row">
        <span className="cop-phase-current-label">
          Phase {currentPhase}: {currentPhaseSpec?.label ?? 'Unknown'}
        </span>
        {currentPhaseSpec?.description && (
          <span className="cop-phase-description" title={currentPhaseSpec.description}>
            {currentPhaseSpec.description}
          </span>
        )}
      </div>

      {/* Range slider */}
      <div className="cop-phase-slider-track">
        <input
          type="range"
          min={minPhase}
          max={maxPhase}
          step={1}
          value={currentPhase}
          onChange={handleSliderChange}
        />
      </div>

      {/* Phase markers */}
      {sortedPhases.length <= 12 && (
        <div className="cop-phase-markers">
          {sortedPhases.map((p) => (
            <div
              key={p.phaseNumber}
              className={`cop-phase-marker${p.phaseNumber === currentPhase ? ' cop-phase-marker--active' : ''}`}
              onClick={() => handleMarkerClick(p.phaseNumber)}
              title={p.description ?? p.label}
            >
              <div className="cop-phase-marker-tick" />
              <span className="cop-phase-marker-label">{p.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Transport controls */}
      <div className="cop-phase-transport">
        {/* Skip back */}
        <button
          className="cop-phase-transport-btn"
          onClick={handleSkipBack}
          disabled={phaseNumbers.indexOf(currentPhase) <= 0}
          title="Previous phase"
        >
          &#9198;
        </button>

        {/* Play/Pause */}
        <button
          className={`cop-phase-transport-btn${isPlaying ? ' cop-phase-transport-btn--active' : ''}`}
          onClick={togglePlayback}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>

        {/* Skip forward */}
        <button
          className="cop-phase-transport-btn"
          onClick={handleSkipForward}
          disabled={phaseNumbers.indexOf(currentPhase) >= phaseNumbers.length - 1}
          title="Next phase"
        >
          &#9197;
        </button>

        {/* Speed controls */}
        <div className="cop-phase-speed">
          <span className="cop-phase-speed-label">Speed:</span>
          {SPEED_PRESETS.map((preset, idx) => (
            <button
              key={preset.label}
              className={`cop-phase-speed-btn${idx === speedIdx ? ' cop-phase-speed-btn--active' : ''}`}
              onClick={() => setSpeedIdx(idx)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Loop toggle */}
        <div className="cop-phase-loop">
          <label className="cop-phase-loop-label">
            <input
              type="checkbox"
              checked={loop}
              onChange={(e) => setLoop(e.target.checked)}
            />{' '}
            Loop
          </label>
        </div>
      </div>

      {/* Phase indicator bar */}
      <div className="cop-phase-indicator-bar">
        {sortedPhases.map((p) => (
          <div
            key={p.phaseNumber}
            className={`cop-phase-indicator-segment${
              p.phaseNumber === currentPhase
                ? ' cop-phase-indicator-segment--active'
                : ' cop-phase-indicator-segment--inactive'
            }`}
            onClick={() => handleSegmentClick(p.phaseNumber)}
            title={`${p.label}${p.description ? ': ' + p.description : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
