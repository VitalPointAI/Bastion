import { useState, useEffect, useRef } from 'react';
import './COATimeline.css';

// ==========================================================================
// Frontend Type Definitions
// ==========================================================================

interface SketchPhaseFE {
  number: number;
  name: string;
  description: string;
  estimatedDuration: string;
  keyTasks: string[];
}

// ==========================================================================
// Component Props
// ==========================================================================

interface COATimelineProps {
  phases: SketchPhaseFE[];
  currentPhase: number;
  onPhaseChange: (phase: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

// ==========================================================================
// COATimeline Component
// ==========================================================================

export function COATimeline({
  phases,
  currentPhase,
  onPhaseChange,
  isPlaying,
  onPlayPause,
}: COATimelineProps) {
  const [scrubberValue, setScrubberValue] = useState(currentPhase);
  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Sync scrubber with currentPhase prop
  useEffect(() => {
    setScrubberValue(currentPhase);
  }, [currentPhase]);

  // Handle play/pause animation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setScrubberValue((prev) => {
          const nextPhase = prev + 1;
          if (nextPhase > phases.length) {
            // Reached end, stop playing
            onPlayPause();
            return phases.length;
          }
          onPhaseChange(nextPhase);
          return nextPhase;
        });
      }, 2000); // Advance phase every 2 seconds
    } else {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
        playIntervalRef.current = null;
      }
    }

    return () => {
      if (playIntervalRef.current) {
        clearInterval(playIntervalRef.current);
      }
    };
  }, [isPlaying, phases.length, onPhaseChange, onPlayPause]);

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPhase = parseInt(e.target.value, 10);
    setScrubberValue(newPhase);
    onPhaseChange(newPhase);
  };

  const currentPhaseData = phases.find((p) => p.number === currentPhase);

  return (
    <div className="coa-timeline-container">
      {/* Timeline Header with Play/Pause */}
      <div className="timeline-header">
        <h3>Phased Execution Timeline</h3>
        <button className="play-pause-btn" onClick={onPlayPause}>
          {isPlaying ? (
            <>
              <span className="pause-icon">⏸</span> Pause
            </>
          ) : (
            <>
              <span className="play-icon">▶</span> Play
            </>
          )}
        </button>
      </div>

      {/* Phase Blocks */}
      <div className="phase-blocks">
        {phases.map((phase, index) => (
          <div key={phase.number} className="phase-block-wrapper">
            <div
              className={`phase-block ${phase.number === currentPhase ? 'active' : ''} ${
                phase.number < currentPhase ? 'completed' : ''
              }`}
              onClick={() => onPhaseChange(phase.number)}
            >
              <div className="phase-number">Phase {phase.number}</div>
              <div className="phase-name">{phase.name}</div>
              <div className="phase-duration">{phase.estimatedDuration}</div>
            </div>
            {index < phases.length - 1 && (
              <div className="phase-arrow">→</div>
            )}
          </div>
        ))}
      </div>

      {/* Scrubber/Slider */}
      <div className="timeline-scrubber">
        <label htmlFor="phase-slider">Phase: {scrubberValue}</label>
        <input
          id="phase-slider"
          type="range"
          min="1"
          max={phases.length}
          step="1"
          value={scrubberValue}
          onChange={handleScrubberChange}
          className="phase-slider"
        />
        <div className="scrubber-labels">
          <span>Start</span>
          <span>End</span>
        </div>
      </div>

      {/* Current Phase Details */}
      {currentPhaseData && (
        <div className="current-phase-details">
          <h4>{currentPhaseData.name}</h4>
          <p className="phase-description">{currentPhaseData.description}</p>
          <div className="key-tasks">
            <h5>Key Tasks:</h5>
            <ul>
              {currentPhaseData.keyTasks.map((task, idx) => (
                <li key={idx}>{task}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
