/**
 * Status Aggregation Service
 *
 * Phase 38: Inheritance Deepening — mission status aggregation for COP/Assess tabs
 *
 * Collects mission status snapshots from child problem sets and produces:
 * - Summary cards per child mission (for parent COP tab)
 * - Drill-down detailed status (for COP drill-down view)
 * - Campaign-level assessment aggregation (for parent Assess tab)
 */

import { inheritanceStore } from './inheritance-store.js';
import type {
  MissionStatusSnapshot,
  MissionKeyEvent,
  MissionResourceStatus,
  ObjectiveProgress,
} from './inheritance-types.js';

// ============================================================================
// Aggregated Types
// ============================================================================

/** Summary card for a child mission displayed on parent COP */
export interface AggregatedMissionStatus {
  childPsId: string;
  childPsName: string;
  missionState: MissionStatusSnapshot['missionState'];
  mdmpPhase: string;
  percentComplete: number;
  latestKeyEvent: MissionKeyEvent | null;
  overallResourceHealth: 'green' | 'amber' | 'red';
  objectiveCount: number;
  completedCount: number;
  lastUpdated: string;
}

/** Campaign-level assessment aggregation for Assess tab */
export interface CampaignAssessment {
  overallProgress: number;
  objectiveSummaries: Array<{
    name: string;
    childStatuses: Array<{
      childPsId: string;
      childPsName: string;
      status: ObjectiveProgress['status'];
      percentComplete: number;
    }>;
    overallStatus: ObjectiveProgress['status'];
  }>;
  missionCount: number;
  completedMissions: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

export class StatusAggregationService {

  /**
   * Get aggregated status summary cards for all child missions of a parent PS.
   * Used by the COP tab for the mission status overview.
   */
  async getAggregatedStatusForParent(parentPsId: string): Promise<AggregatedMissionStatus[]> {
    const snapshots = await inheritanceStore.getMissionStatusForParent(parentPsId);

    return snapshots.map((snapshot) => ({
      childPsId: snapshot.childProblemSetId,
      childPsName: snapshot.childProblemSetName,
      missionState: snapshot.missionState,
      mdmpPhase: snapshot.mdmpPhase,
      percentComplete: snapshot.percentComplete,
      latestKeyEvent: this.getLatestKeyEvent(snapshot.keyEvents),
      overallResourceHealth: this.computeResourceHealth(snapshot.resourceStatus),
      objectiveCount: snapshot.objectiveProgress.length,
      completedCount: snapshot.objectiveProgress.filter(
        (o) => o.status === 'achieved',
      ).length,
      lastUpdated: snapshot.lastUpdated.toISOString(),
    }));
  }

  /**
   * Get full detailed status snapshot for a specific child mission.
   * Used for drill-down from COP summary card.
   */
  async getDrillDownStatus(childPsId: string): Promise<MissionStatusSnapshot | null> {
    return inheritanceStore.getMissionStatusForChild(childPsId);
  }

  /**
   * Get campaign-level assessment aggregation across all child missions.
   * Groups objectives across children and calculates overall progress.
   * Used by the parent Assess tab.
   */
  async getAssessAggregation(parentPsId: string): Promise<CampaignAssessment> {
    const snapshots = await inheritanceStore.getMissionStatusForParent(parentPsId);

    if (snapshots.length === 0) {
      return {
        overallProgress: 0,
        objectiveSummaries: [],
        missionCount: 0,
        completedMissions: 0,
      };
    }

    // Group objectives by name across all children
    const objectiveMap = new Map<string, CampaignAssessment['objectiveSummaries'][number]>();

    for (const snapshot of snapshots) {
      for (const obj of snapshot.objectiveProgress) {
        if (!objectiveMap.has(obj.objectiveName)) {
          objectiveMap.set(obj.objectiveName, {
            name: obj.objectiveName,
            childStatuses: [],
            overallStatus: 'not_started',
          });
        }

        objectiveMap.get(obj.objectiveName)!.childStatuses.push({
          childPsId: snapshot.childProblemSetId,
          childPsName: snapshot.childProblemSetName,
          status: obj.status,
          percentComplete: obj.percentComplete,
        });
      }
    }

    // Calculate overall status for each objective
    const objectiveSummaries = Array.from(objectiveMap.values()).map((summary) => {
      summary.overallStatus = this.computeOverallObjectiveStatus(
        summary.childStatuses.map((c) => c.status),
      );
      return summary;
    });

    // Calculate overall campaign progress
    const totalProgress = snapshots.reduce((sum, s) => sum + s.percentComplete, 0);
    const overallProgress = Math.round(totalProgress / snapshots.length);

    const completedMissions = snapshots.filter(
      (s) => s.missionState === 'complete',
    ).length;

    return {
      overallProgress,
      objectiveSummaries,
      missionCount: snapshots.length,
      completedMissions,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Get the most recent key event from the events array.
   */
  private getLatestKeyEvent(events: MissionKeyEvent[]): MissionKeyEvent | null {
    if (!events || events.length === 0) return null;

    // Sort by timestamp descending and return the most recent
    const sorted = [...events].sort((a, b) =>
      b.timestamp.localeCompare(a.timestamp),
    );
    return sorted[0];
  }

  /**
   * Compute overall resource health from resource status breakdown.
   * Uses equipment operational rate and personnel availability as indicators.
   */
  private computeResourceHealth(status: MissionResourceStatus): 'green' | 'amber' | 'red' {
    if (!status || !status.personnel || !status.equipment) return 'green';

    const personnelRate = status.personnel.assigned > 0
      ? status.personnel.available / status.personnel.assigned
      : 1;

    const equipmentRate = status.equipment.total > 0
      ? status.equipment.operational / status.equipment.total
      : 1;

    // Red if either rate below 50%
    if (personnelRate < 0.5 || equipmentRate < 0.5) return 'red';

    // Amber if either rate below 75%
    if (personnelRate < 0.75 || equipmentRate < 0.75) return 'amber';

    return 'green';
  }

  /**
   * Compute the overall status for an objective from individual child statuses.
   * Priority: failed > in_progress > not_started > achieved
   */
  private computeOverallObjectiveStatus(
    statuses: ObjectiveProgress['status'][],
  ): ObjectiveProgress['status'] {
    if (statuses.some((s) => s === 'failed')) return 'failed';
    if (statuses.some((s) => s === 'in_progress')) return 'in_progress';
    if (statuses.every((s) => s === 'achieved')) return 'achieved';
    return 'not_started';
  }
}

/** Singleton instance */
export const statusAggregationService = new StatusAggregationService();
