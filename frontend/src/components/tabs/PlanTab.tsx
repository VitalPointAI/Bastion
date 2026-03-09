/**
 * PlanTab
 *
 * Thin wrapper that delegates to PlanEchelonRouter for echelon-based
 * routing of planning workflows (JPP, MDMP, Strategic Guidance).
 *
 * Phase 34 Plan 01: Refactored from hardcoded JPP view to echelon-aware router.
 */

import { PlanEchelonRouter } from '../plan/PlanEchelonRouter.tsx';

interface PlanTabProps {
  problemSetId: string;
  daoId?: string;
}

export function PlanTab({ problemSetId, daoId }: PlanTabProps) {
  return <PlanEchelonRouter problemSetId={problemSetId} daoId={daoId} />;
}
