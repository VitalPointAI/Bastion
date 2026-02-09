/**
 * MissionDetail Component
 *
 * Phase 4.4 Plan 09: Mission detail view with tabbed interface
 *
 * Integrates all mission sub-components:
 * - Overview (mission info, AO mini-map, stats)
 * - Map (MissionMap with fullscreen toggle)
 * - Command (CommandTreeView/CommandMatrixView)
 * - Resources (ResourceCatalog)
 * - Participants (ParticipantList with InviteModal)
 * - Sensors (Sensor registration and list)
 */

import { useEffect, useState } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import 'react-tabs/style/react-tabs.css';
import { missionService, type Mission } from '../../lib/mission-service.js';
import { useUser } from '../../context/UserContext.js';
import { MissionMap } from './map/MissionMap.js';
import { CommandTreeView } from './command/CommandTreeView.js';
import { CommandMatrixView } from './command/CommandMatrixView.js';
import { ResourceCatalog } from './resources/ResourceCatalog.js';
import { ParticipantList } from './ParticipantList.js';
import { InviteModal } from './InviteModal.js';
import { PlanningDashboard } from '../planning/index.js';
import './MissionDetail.css';

interface MissionDetailProps {
  missionId: string;
  onBack: () => void;
}

export function MissionDetail({ missionId, onBack }: MissionDetailProps) {
  const { userDID } = useUser();
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commandView, setCommandView] = useState<'tree' | 'matrix'>('tree');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!userDID) return;

    const loadMission = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await missionService.getMission(missionId, userDID);
        setMission(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load mission');
      } finally {
        setLoading(false);
      }
    };

    loadMission();
  }, [missionId, userDID]);

  const handleActivate = async () => {
    if (!userDID || !mission) return;
    try {
      setActionLoading(true);
      const updated = await missionService.activateMission(missionId, userDID);
      setMission(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate mission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!userDID || !mission) return;
    if (!confirm('Are you sure you want to mark this mission as complete?')) return;
    try {
      setActionLoading(true);
      const updated = await missionService.completeMission(missionId, userDID);
      setMission(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to complete mission');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!userDID || !mission) return;
    if (!confirm('Are you sure you want to archive this mission?')) return;
    try {
      setActionLoading(true);
      const updated = await missionService.archiveMission(missionId, userDID);
      setMission(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to archive mission');
    } finally {
      setActionLoading(false);
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

  const getStatusClass = (status: string): string => {
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

  if (!userDID) {
    return (
      <div className="mission-detail-container">
        <div className="mission-detail-error">
          <p>Please log in to view mission details</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mission-detail-container">
        <div className="mission-detail-loading">
          <p>Loading mission...</p>
        </div>
      </div>
    );
  }

  if (error || !mission) {
    return (
      <div className="mission-detail-container">
        <div className="mission-detail-error">
          <p>Error: {error || 'Mission not found'}</p>
          <button className="btn btn-secondary" onClick={onBack}>
            Back to Missions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`mission-detail-container ${isMapFullscreen ? 'fullscreen-map' : ''}`}>
      {/* Header */}
      <div className="mission-detail-header">
        <div className="header-left">
          <button className="btn btn-icon" onClick={onBack} title="Back to missions">
            ←
          </button>
          <div className="header-info">
            <h2>{mission.name}</h2>
            <span className={`classification-badge ${getClassificationClass(mission.classification)}`}>
              {mission.classification}
            </span>
            <span className={`status-badge ${getStatusClass(mission.status)}`}>
              {mission.status.toUpperCase()}
            </span>
          </div>
        </div>
        <div className="header-actions">
          {mission.status === 'planning' && (
            <button
              className="btn btn-success"
              onClick={handleActivate}
              disabled={actionLoading}
            >
              Activate Mission
            </button>
          )}
          {mission.status === 'active' && (
            <button
              className="btn btn-warning"
              onClick={handleComplete}
              disabled={actionLoading}
            >
              Mark Complete
            </button>
          )}
          {mission.status === 'complete' && (
            <button
              className="btn btn-secondary"
              onClick={handleArchive}
              disabled={actionLoading}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs className="mission-tabs">
        <TabList>
          <Tab>Overview</Tab>
          <Tab>Planning</Tab>
          <Tab>Map</Tab>
          <Tab>Command</Tab>
          <Tab>Resources</Tab>
          <Tab>Participants</Tab>
          <Tab>Sensors</Tab>
        </TabList>

        {/* Overview Tab */}
        <TabPanel>
          <div className="tab-content overview-tab">
            <div className="overview-section">
              <h3>Mission Information</h3>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Mission ID:</span>
                  <span className="info-value">{mission.missionId}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Status:</span>
                  <span className={`status-badge ${getStatusClass(mission.status)}`}>
                    {mission.status.toUpperCase()}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Classification:</span>
                  <span className={`classification-badge ${getClassificationClass(mission.classification)}`}>
                    {mission.classification}
                  </span>
                </div>
                <div className="info-item">
                  <span className="info-label">Created:</span>
                  <span className="info-value">
                    {new Date(mission.createdAt).toLocaleString()}
                  </span>
                </div>
                {mission.activatedAt && (
                  <div className="info-item">
                    <span className="info-label">Activated:</span>
                    <span className="info-value">
                      {new Date(mission.activatedAt).toLocaleString()}
                    </span>
                  </div>
                )}
                {mission.completedAt && (
                  <div className="info-item">
                    <span className="info-label">Completed:</span>
                    <span className="info-value">
                      {new Date(mission.completedAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {mission.description && (
                <div className="mission-description-section">
                  <h4>Description</h4>
                  <p>{mission.description}</p>
                </div>
              )}
            </div>

            {mission.areaOfOperations && (
              <div className="overview-section">
                <h3>Area of Operations</h3>
                <div className="mini-map-container">
                  <MissionMap
                    missionId={missionId}
                    areaOfOps={mission.areaOfOperations}
                  />
                </div>
              </div>
            )}
          </div>
        </TabPanel>

        {/* Planning Tab */}
        <TabPanel>
          <div className="tab-content planning-tab">
            <PlanningDashboard missionId={missionId} userDID={userDID || ''} />
          </div>
        </TabPanel>

        {/* Map Tab */}
        <TabPanel>
          <div className="tab-content map-tab">
            <div className="map-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setIsMapFullscreen(!isMapFullscreen)}
              >
                {isMapFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
              </button>
            </div>
            <div className="map-container">
              <MissionMap
                missionId={missionId}
                areaOfOps={mission.areaOfOperations}
                onMarkerClick={(unitId) => console.log('Unit clicked:', unitId)}
              />
            </div>
          </div>
        </TabPanel>

        {/* Command Tab */}
        <TabPanel>
          <div className="tab-content command-tab">
            <div className="command-view-toggle">
              <button
                className={`btn ${commandView === 'tree' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCommandView('tree')}
              >
                Tree View
              </button>
              <button
                className={`btn ${commandView === 'matrix' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCommandView('matrix')}
              >
                Matrix View
              </button>
            </div>
            {commandView === 'tree' ? (
              <CommandTreeView missionId={missionId} />
            ) : (
              <CommandMatrixView missionId={missionId} />
            )}
          </div>
        </TabPanel>

        {/* Resources Tab */}
        <TabPanel>
          <div className="tab-content resources-tab">
            <ResourceCatalog missionId={missionId} />
          </div>
        </TabPanel>

        {/* Participants Tab */}
        <TabPanel>
          <div className="tab-content participants-tab">
            <div className="participants-header">
              <h3>Mission Participants</h3>
              <button
                className="btn btn-primary"
                onClick={() => setShowInviteModal(true)}
              >
                Invite Participant
              </button>
            </div>
            <ParticipantList missionId={missionId} />
            {showInviteModal && (
              <InviteModal
                missionId={missionId}
                onClose={() => setShowInviteModal(false)}
              />
            )}
          </div>
        </TabPanel>

        {/* Sensors Tab */}
        <TabPanel>
          <div className="tab-content sensors-tab">
            <h3>Sensor Management</h3>
            <p className="placeholder-text">
              Sensor registration interface will be integrated here.
              For now, sensors can be viewed on the Map tab.
            </p>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
