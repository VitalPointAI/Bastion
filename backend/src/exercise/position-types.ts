/**
 * Exercise Position Types
 *
 * Quick Task 9: Custom exercise positions with phase-transition mapping.
 * Positions belong to a problem set, have a side, and can map to different
 * titles/duties per exercise phase.
 */

export type PositionSide = 'blue' | 'red' | 'neutral' | 'green';

export interface ExercisePosition {
  id: string;
  problemSetId: string;
  side: PositionSide;
  title: string;
  duties: string | null;
  sortOrder: number;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  phaseMappings?: PositionPhaseMapping[];
}

export interface PositionPhaseMapping {
  id: string;
  positionId: string;
  exercisePhase: string;
  title: string;
  duties: string | null;
}

export interface CreatePositionInput {
  side: PositionSide;
  title: string;
  duties?: string;
  sortOrder?: number;
  assignedTo?: string;
  phaseMappings?: Array<{ exercisePhase: string; title: string; duties?: string }>;
}

export interface UpdatePositionInput {
  side?: PositionSide;
  title?: string;
  duties?: string;
  sortOrder?: number;
  assignedTo?: string | null;
}
