/**
 * AssessEchelonRouter
 *
 * Phase 37 Plan 03: Top-level router for the Assess tab.
 * Reads mode from ModeContext and echelon from ProblemSetContext,
 * then renders the appropriate assessment view.
 *
 * - Operational mode: OperationalAssess (MOE/MOP tracking + reframing)
 * - Training mode: echelon-specific placeholders (filled by Plans 04-05)
 *
 * Mirrors the PlanEchelonRouter pattern exactly.
 */

import { useProblemSet } from '../../context/ProblemSetContext.tsx';
import { useMode } from '../../context/ModeContext.tsx';
import { OperationalAssess } from './OperationalAssess.tsx';
import './AssessEchelonRouter.css';

// ============================================================================
// Training Mode Placeholders (replaced by Plans 04-05)
// ============================================================================

function TrainingStrategicAssess({ problemSetId: _problemSetId }: { problemSetId: string }) {
  return (
    <div className="assess-placeholder">
      <h2>Training Strategy Assessment</h2>
      <p>METL Dashboard, Readiness Overview, and Trends. Coming in Plan 05.</p>
    </div>
  );
}

function TrainingExerciseAssess({ problemSetId: _problemSetId }: { problemSetId: string }) {
  return (
    <div className="assess-placeholder">
      <h2>Training Exercise Assessment</h2>
      <p>Event Timeline, Exercise METL Aggregate. Coming in Plan 04.</p>
    </div>
  );
}

function TrainingTacticalAssess({ problemSetId: _problemSetId }: { problemSetId: string }) {
  return (
    <div className="assess-placeholder">
      <h2>Training Event Assessment</h2>
      <p>After-Action Review, Task Assessment. Coming in Plan 04.</p>
    </div>
  );
}

// ============================================================================
// Router Component
// ============================================================================

interface AssessEchelonRouterProps {
  problemSetId: string;
}

export function AssessEchelonRouter({ problemSetId }: AssessEchelonRouterProps) {
  const { isTraining } = useMode();
  const { activeProblemSet } = useProblemSet();
  const echelon = activeProblemSet?.echelon ?? 'operational';

  if (isTraining) {
    switch (echelon) {
      case 'strategic':
        return <TrainingStrategicAssess problemSetId={problemSetId} />;
      case 'operational':
        return <TrainingExerciseAssess problemSetId={problemSetId} />;
      case 'tactical':
        return <TrainingTacticalAssess problemSetId={problemSetId} />;
    }
  }

  return <OperationalAssess problemSetId={problemSetId} />;
}
