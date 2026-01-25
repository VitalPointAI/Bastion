import { JP50Step, StepStatus, OperationalPlan } from '../types';

export interface JP50Context {
  planId: string;
  missionId: string;
  currentStep: JP50Step;
  steps: Record<JP50Step, StepStatus>;
  coaCount: number;
  selectedCoaId: string | null;
  commanderApproval: {
    coaApproved: boolean;
    coaApprovedAt: Date | null;
    coaApprovedBy: string | null;
    planApproved: boolean;
    planApprovedAt: Date | null;
    planApprovedBy: string | null;
  };
  lastUpdated: Date;
  lastUpdatedBy: string;
}

export type JP50Event =
  | { type: 'NAVIGATE_TO_STEP'; step: JP50Step }
  | { type: 'START_STEP'; step: JP50Step; actorDID: string }
  | { type: 'MARK_STEP_READY'; step: JP50Step; actorDID: string }
  | { type: 'UPDATE_COA_COUNT'; count: number }
  | { type: 'SELECT_COA'; coaId: string; actorDID: string }
  | { type: 'REQUEST_COA_APPROVAL'; actorDID: string }
  | { type: 'COMMANDER_APPROVE_COA'; commanderDID: string }
  | { type: 'COMMANDER_REJECT_COA'; commanderDID: string; reason: string }
  | { type: 'REQUEST_PLAN_APPROVAL'; actorDID: string }
  | { type: 'COMMANDER_APPROVE_PLAN'; commanderDID: string }
  | { type: 'COMMANDER_REJECT_PLAN'; commanderDID: string; reason: string };
