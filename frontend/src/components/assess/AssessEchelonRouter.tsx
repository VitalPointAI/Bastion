/**
 * AssessEchelonRouter
 *
 * Phase 37 Plan 05: Top-level router for the Assess tab.
 * Reads mode from ModeContext and echelon from ProblemSetContext,
 * then renders the appropriate assessment view.
 *
 * - Operational mode: OperationalAssess (MOE/MOP tracking + reframing)
 * - Training mode: echelon-specific views (strategic, exercise, tactical)
 *
 * All placeholder components have been replaced with real implementations.
 */

import { useProblemSet } from '../../context/ProblemSetContext.tsx';
import { useMode } from '../../context/ModeContext.tsx';
import { OperationalAssess } from './OperationalAssess.tsx';
import { TrainingTacticalAssess } from './TrainingTacticalAssess.tsx';
import { TrainingStrategicAssess } from './TrainingStrategicAssess.tsx';
import { TrainingExerciseAssess } from './TrainingExerciseAssess.tsx';
import './AssessEchelonRouter.css';

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
