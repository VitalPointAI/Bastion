import { useState, useEffect, useCallback } from 'react';
import { ValidityMap } from './ValidityMap.js';
import { GraphExplorer, type GraphData } from '../graph/GraphExplorer.js';
import { NodeDetailPanel } from '../graph/NodeDetailPanel.js';
import './StrategicValidityDashboard.css';

interface Workspace {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface OsintEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  sourceUrl?: string;
  relevance?: 'supporting' | 'contradicting' | 'neutral';
  location?: { lat: number; lng: number };
}

interface ObjectiveValidity {
  id: string;
  objectiveTitle: string;
  validityScore: number;
  trend: 'up' | 'down' | 'stable';
  lastUpdated: string;
  classification: string;
}

interface Alert {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message: string;
  objectiveId?: string;
  timestamp: string;
  acknowledged: boolean;
}

type ViewMode = 'map' | 'graph' | 'split';

export function StrategicValidityDashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('map');
  const [events, setEvents] = useState<OsintEvent[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveValidity[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    fetch('/api/graph/workspaces')
      .then(res => res.json())
      .then(data => {
        setWorkspaces(data.workspaces || []);
        // Auto-select master view or first workspace
        const masterView = data.workspaces.find((w: Workspace) => w.type === 'master');
        if (masterView) {
          setSelectedWorkspaceId(masterView.id);
        } else if (data.workspaces.length > 0) {
          setSelectedWorkspaceId(data.workspaces[0].id);
        }
      })
      .catch(console.error);
  }, []);

  // Load workspace data when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;

    setLoading(true);

    // Load events
    fetch(`/api/graph/osint/events?workspaceId=${selectedWorkspaceId}&limit=50`)
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
      .catch(console.error);

    // Load objectives with validity scores
    fetch(`/api/graph/validity/objectives?workspaceId=${selectedWorkspaceId}`)
      .then(res => res.json())
      .then(data => setObjectives(data.objectives || []))
      .catch(console.error);

    // Load active alerts
    fetch(`/api/graph/validity/alerts?workspaceId=${selectedWorkspaceId}&acknowledged=false`)
      .then(res => res.json())
      .then(data => setAlerts(data.alerts || []))
      .catch(console.error);

    // Load graph data
    fetch(`/api/graph/workspaces/${selectedWorkspaceId}/graph`)
      .then(res => res.json())
      .then(data => {
        setGraphData({
          nodes: data.actors || [],
          edges: data.relationships || [],
        });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedWorkspaceId]);

  // Acknowledge alert
  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    fetch(`/api/graph/validity/alerts/${alertId}/acknowledge`, {
      method: 'POST',
    })
      .then(() => {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
      })
      .catch(console.error);
  }, []);

  // Event click handler
  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  // Close event modal
  const handleCloseEventModal = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  // Actor click handler
  const handleActorClick = useCallback((actorId: string) => {
    setSelectedActorId(actorId);
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');

  // Transform events for map
  const mapEvents = events
    .filter(e => e.location)
    .map(e => ({
      id: e.id,
      lat: e.location!.lat,
      lng: e.location!.lng,
      title: e.title,
      description: e.description,
      relevance: e.relevance || 'neutral',
      timestamp: e.timestamp,
      sourceUrl: e.sourceUrl,
    }));

  return (
    <div className="strategic-validity-dashboard">
      {/* Critical Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="alert-banner critical">
          <div className="alert-banner-icon">⚠</div>
          <div className="alert-banner-content">
            <strong>{criticalAlerts.length} Critical Alert{criticalAlerts.length > 1 ? 's' : ''}</strong>
            <span>{criticalAlerts[0].title}</span>
          </div>
          <button
            className="alert-banner-dismiss"
            onClick={() => handleAcknowledgeAlert(criticalAlerts[0].id)}
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Header */}
      <div className="dashboard-header">
        <div className="header-left">
          <h1>Strategic Validity Dashboard</h1>
          <select
            value={selectedWorkspaceId}
            onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="workspace-selector"
            disabled={loading}
          >
            {workspaces.length === 0 && (
              <option value="">Loading workspaces...</option>
            )}
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>
                {ws.name} ({ws.type})
              </option>
            ))}
          </select>
        </div>

        <div className="header-right">
          <div className="view-mode-toggle">
            <button
              className={viewMode === 'map' ? 'active' : ''}
              onClick={() => setViewMode('map')}
              title="Map View"
            >
              Map
            </button>
            <button
              className={viewMode === 'graph' ? 'active' : ''}
              onClick={() => setViewMode('graph')}
              title="Graph View"
            >
              Graph
            </button>
            <button
              className={viewMode === 'split' ? 'active' : ''}
              onClick={() => setViewMode('split')}
              title="Split View"
            >
              Split
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Main View Area */}
        <div className="main-view-area">
          {loading && (
            <div className="loading-overlay">
              <div className="loading-spinner">Loading...</div>
            </div>
          )}

          {viewMode === 'map' && (
            <div className="view-container">
              <ValidityMap
                workspaceId={selectedWorkspaceId}
                events={mapEvents}
                actors={[]}
                tensions={[]}
                onEventClick={(event) => handleEventClick(event.id)}
                onActorClick={(actor) => handleActorClick(actor.id)}
              />
            </div>
          )}

          {viewMode === 'graph' && (
            <div className="view-container">
              <GraphExplorer
                data={graphData}
                workspaceId={selectedWorkspaceId}
                onNodeClick={(node) => handleActorClick(node.id)}
                selectedNodeId={selectedActorId || undefined}
                height={700}
              />
            </div>
          )}

          {viewMode === 'split' && (
            <div className="split-view">
              <div className="split-view-panel">
                <ValidityMap
                  workspaceId={selectedWorkspaceId}
                  events={mapEvents}
                  actors={[]}
                  tensions={[]}
                  onEventClick={(event) => handleEventClick(event.id)}
                  onActorClick={(actor) => handleActorClick(actor.id)}
                />
              </div>
              <div className="split-view-panel">
                <GraphExplorer
                  data={graphData}
                  workspaceId={selectedWorkspaceId}
                  onNodeClick={(node) => handleActorClick(node.id)}
                  selectedNodeId={selectedActorId || undefined}
                  height={600}
                />
              </div>
            </div>
          )}

          {/* Actor Detail Panel */}
          {selectedActorId && (
            <NodeDetailPanel
              actorId={selectedActorId}
              onClose={() => setSelectedActorId(null)}
              onNavigateToActor={handleActorClick}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="dashboard-sidebar">
          {/* Recent Events */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Recent Events</h3>
            <div className="event-timeline">
              {events.length === 0 && (
                <p className="empty-message">No recent events</p>
              )}
              {events.slice(0, 10).map(event => (
                <div
                  key={event.id}
                  className={`event-item ${event.relevance || 'neutral'}`}
                  onClick={() => handleEventClick(event.id)}
                >
                  <div className="event-timestamp">
                    {new Date(event.timestamp).toLocaleDateString()}
                  </div>
                  <div className="event-title">{event.title}</div>
                  {event.relevance && (
                    <div className={`event-relevance-badge ${event.relevance}`}>
                      {event.relevance}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Objective Validity */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Objective Validity</h3>
            <div className="objective-list">
              {objectives.length === 0 && (
                <p className="empty-message">No objectives tracked</p>
              )}
              {objectives.slice(0, 5).map(obj => (
                <div key={obj.id} className="objective-card">
                  <div className="objective-header">
                    <span className="objective-title">{obj.objectiveTitle}</span>
                    <span className={`trend-indicator ${obj.trend}`}>
                      {obj.trend === 'up' ? '↑' : obj.trend === 'down' ? '↓' : '→'}
                    </span>
                  </div>
                  <div className="validity-score-container">
                    <div className="validity-score-bar">
                      <div
                        className={`validity-score-fill ${
                          obj.validityScore >= 70 ? 'high' :
                          obj.validityScore >= 50 ? 'medium' :
                          'low'
                        }`}
                        style={{ width: `${obj.validityScore}%` }}
                      />
                    </div>
                    <span className="validity-score-value">{obj.validityScore}</span>
                  </div>
                  <div className="objective-meta">
                    <span className="classification-badge">{obj.classification}</span>
                    <span className="last-updated">
                      {new Date(obj.lastUpdated).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Alerts */}
          <div className="sidebar-section">
            <h3 className="sidebar-title">Active Alerts ({alerts.length})</h3>
            <div className="alerts-list">
              {alerts.length === 0 && (
                <p className="empty-message">No active alerts</p>
              )}
              {alerts.map(alert => (
                <div key={alert.id} className={`alert-item ${alert.severity}`}>
                  <div className="alert-header">
                    <span className={`severity-badge ${alert.severity}`}>
                      {alert.severity}
                    </span>
                    <span className="alert-timestamp">
                      {new Date(alert.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="alert-title">{alert.title}</div>
                  <div className="alert-message">{alert.message}</div>
                  <button
                    className="acknowledge-btn"
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                  >
                    Acknowledge
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={handleCloseEventModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedEvent.title}</h2>
              <button className="modal-close" onClick={handleCloseEventModal}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              {selectedEvent.relevance && (
                <div className={`event-relevance-badge large ${selectedEvent.relevance}`}>
                  {selectedEvent.relevance}
                </div>
              )}
              <p className="event-description">{selectedEvent.description}</p>
              <div className="event-meta">
                <div className="meta-item">
                  <strong>Timestamp:</strong>
                  <span>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
                </div>
                {selectedEvent.sourceUrl && (
                  <div className="meta-item">
                    <strong>Source:</strong>
                    <a href={selectedEvent.sourceUrl} target="_blank" rel="noopener noreferrer">
                      View Original
                    </a>
                  </div>
                )}
                {selectedEvent.location && (
                  <div className="meta-item">
                    <strong>Location:</strong>
                    <span>
                      {selectedEvent.location.lat.toFixed(4)}, {selectedEvent.location.lng.toFixed(4)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
