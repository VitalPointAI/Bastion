/**
 * Exercise Information Barrier
 *
 * Phase 14 Plan 01: Middleware and utilities that enforce team-level
 * information isolation in the exercise environment.
 *
 * - exercise_control can see all teams (blue, red, controller)
 * - blue_staff can see blue and controller data only
 * - red_cell can see red and controller data only
 */

import type { Request, Response, NextFunction } from 'express';
import type { ExerciseRole } from './types.js';

export type { ExerciseRole };

// ─── Visibility Logic ─────────────────────────────────────────────────────────

/**
 * Return the list of team values this role is allowed to see.
 *
 * Used as a SQL parameter: `AND team = ANY($N)`
 */
export function getVisibleTeams(role: ExerciseRole): string[] {
  switch (role) {
    case 'exercise_control':
      return ['blue', 'red', 'controller'];
    case 'blue_staff':
      return ['blue', 'controller'];
    case 'red_cell':
      return ['red', 'controller'];
    default: {
      // Exhaustive check — TypeScript will error if a new role is added without handling it
      const _exhaustive: never = role;
      return _exhaustive;
    }
  }
}

// ─── Express Type Augmentation ────────────────────────────────────────────────

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Teams visible to the authenticated user based on their exercise role */
      visibleTeams: string[];
      /** The exercise role of the authenticated user */
      exerciseRole: ExerciseRole;
    }
  }
}

// ─── Express Middleware ───────────────────────────────────────────────────────

/**
 * Express middleware that reads `req.user.exerciseRole` and sets
 * `req.exerciseRole` and `req.visibleTeams` for downstream handlers.
 *
 * Falls back to 'exercise_control' when no role is present so that
 * non-exercise routes are not broken.
 */
export function withExerciseBarrier(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const user = (req as Request & { user?: { exerciseRole?: ExerciseRole } }).user;
  const role: ExerciseRole = user?.exerciseRole ?? 'exercise_control';
  req.exerciseRole = role;
  req.visibleTeams = getVisibleTeams(role);
  next();
}
