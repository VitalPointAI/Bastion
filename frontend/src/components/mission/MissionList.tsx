/**
 * MissionList Component
 *
 * Phase 4.4 Plan 09: Mission list with filtering
 *
 * Displays all accessible missions with filtering by state
 */

import { useEffect, useState } from 'react';
import { missionService, type Mission, type MissionStatus } from '../../lib/mission-service.js';
import { useUser } from '../../context/UserContext.js';
import './MissionList.css';

interface MissionListProps {
  onSelectMission: (missionId: string) => void;
  onCreateMission: () => void;
}

export function MissionList({ onSelectMission, onCreateMission }: MissionListProps) {
  const { userDID } = useUser();
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<MissionStatus | 'all'>('all');

  useEffect(() => {
    if (!userDID) return;

    const loadMissions = async () => {
      try {
        setLoading(true);
        setError(null);
        const filters = filterStatus === 'all'
          ? { includeArchived: true }
          : { status: filterStatus, includeArchived: filterStatus === 'archived' };

        const data = await missionService.listMissions(filters, userDID);
        setMissions(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load missions');
      } finally {
        setLoading(false);
      }
    };

    loadMissions();
  }, [userDID, filterStatus]);

  const getStatusClass = (status: MissionStatus): string => {
    switch (status) {
      case 'planning':
        return 'status-planning';
      case 'active':
        return 'status-active';
      case 'complete':
        return 'status-complete';
      case 'archived':
        return 'status-archived';
      default:
        return '';
    }
  };

  const getClassificationClass = (classification: string): string => {
    switch (classification) {
      case 'UNCLASSIFIED':
        return 'classification-unclass';
      case 'SECRET':
        return 'classification-secret';
      case 'TOPSECRET':
        return 'classification-topsecret';
      default:
        return '';
    }
  };

  if (!userDID) {
    return (
      <div className="mission-list-container">
        <div className="mission-list-error">
          <p>Please log in to view missions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mission-list-container">
      <div className="mission-list-header">
        <h2>Missions</h2>
        <div className="mission-list-controls">
          <select
            className="mission-filter-select"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as MissionStatus | 'all')}
          >
            <option value="all">All Missions</option>
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="complete">Complete</option>
            <option value="archived">Archived</option>
          </select>
          <button className="btn btn-primary" onClick={onCreateMission}>
            New Mission
          </button>
        </div>
      </div>

      {loading && (
        <div className="mission-list-loading">
          <p>Loading missions...</p>
        </div>
      )}

      {error && (
        <div className="mission-list-error">
          <p>Error: {error}</p>
        </div>
      )}

      {!loading && !error && missions.length === 0 && (
        <div className="mission-list-empty">
          <p>No missions found.</p>
          <p>Create your first mission to get started.</p>
          <button className="btn btn-primary" onClick={onCreateMission}>
            Create Mission
          </button>
        </div>
      )}

      {!loading && !error && missions.length > 0 && (
        <div className="mission-list-grid">
          {missions.map((mission) => (
            <div
              key={mission.missionId}
              className="mission-card"
              onClick={() => onSelectMission(mission.missionId)}
            >
              <div className="mission-card-header">
                <h3>{mission.name}</h3>
                <span className={`classification-badge ${getClassificationClass(mission.classification)}`}>
                  {mission.classification}
                </span>
              </div>

              <div className="mission-card-body">
                {mission.description && (
                  <p className="mission-description">{mission.description}</p>
                )}

                <div className="mission-metadata">
                  <div className="metadata-item">
                    <span className="metadata-label">Status:</span>
                    <span className={`status-badge ${getStatusClass(mission.status)}`}>
                      {mission.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="metadata-item">
                    <span className="metadata-label">Created:</span>
                    <span className="metadata-value">
                      {new Date(mission.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {mission.activatedAt && (
                    <div className="metadata-item">
                      <span className="metadata-label">Activated:</span>
                      <span className="metadata-value">
                        {new Date(mission.activatedAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mission-card-footer">
                <span className="mission-id">ID: {mission.missionId.slice(0, 12)}...</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
