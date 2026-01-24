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

// Helper to safely fetch JSON
async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.startsWith('<!')) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}

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
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load workspaces on mount
  useEffect(() => {
    fetchJSON<{ workspaces: Workspace[] }>('/api/graph/workspaces')
      .then(data => {
        if (!data) return;
        setWorkspaces(data.workspaces || []);
        if (data.workspaces.length > 0) {
          setSelectedWorkspaceId(data.workspaces[0].id);
        }
      });
  }, []);

  // Load workspace data when workspace changes
  useEffect(() => {
    if (!selectedWorkspaceId) return;
    setLoading(true);

    Promise.all([
      fetchJSON<{ events: OsintEvent[] }>(`/api/graph/osint/events?workspaceId=${selectedWorkspaceId}&limit=50`),
      fetchJSON<{ objectives: ObjectiveValidity[] }>(`/api/graph/validity/objectives?workspaceId=${selectedWorkspaceId}`),
      fetchJSON<{ alerts: Alert[] }>(`/api/graph/validity/alerts?workspaceId=${selectedWorkspaceId}&acknowledged=false`),
      fetchJSON<{ nodes: any[]; edges: any[] }>(`/api/graph/workspaces/${selectedWorkspaceId}/graph`),
    ]).then(([eventsData, objectivesData, alertsData, graphResponse]) => {
      setEvents(eventsData?.events || []);
      setObjectives(objectivesData?.objectives || []);
      setAlerts(alertsData?.alerts || []);
      if (graphResponse) {
        setGraphData({
          nodes: graphResponse.nodes || [],
          edges: graphResponse.edges || [],
        });
      }
    }).finally(() => setLoading(false));
  }, [selectedWorkspaceId]);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    fetch(`/api/graph/validity/alerts/${alertId}/acknowledge`, { method: 'POST' })
      .then(() => setAlerts(prev => prev.filter(a => a.id !== alertId)))
      .catch(console.error);
  }, []);

  const handleEventClick = useCallback((eventId: string) => {
    setSelectedEventId(eventId);
  }, []);

  const handleActorClick = useCallback((actorId: string) => {
    setSelectedActorId(actorId);
  }, []);

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const criticalAlerts = alerts.filter(a => a.severity === 'critical' || a.severity === 'high');

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
    <div className="validity-dashboard-fullscreen">
      {/* Floating Header */}
      <div className="floating-header">
        <div className="header-brand">
          <h1>Strategic Intelligence</h1>
        </div>

        <div className="header-controls">
          <select
            value={selectedWorkspaceId}
            onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="workspace-select"
            disabled={loading}
          >
            {workspaces.length === 0 && <option value="">No workspaces</option>}
            {workspaces.map(ws => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>

          <div className="view-toggle">
            <button className={viewMode === 'map' ? 'active' : ''} onClick={() => setViewMode('map')}>Map</button>
            <button className={viewMode === 'graph' ? 'active' : ''} onClick={() => setViewMode('graph')}>Graph</button>
            <button className={viewMode === 'split' ? 'active' : ''} onClick={() => setViewMode('split')}>Split</button>
          </div>

          <button
            className={`info-toggle ${showInfoPanel ? 'active' : ''}`}
            onClick={() => setShowInfoPanel(!showInfoPanel)}
          >
            ☰ Info
          </button>
        </div>
      </div>

      {/* Alert Banner */}
      {criticalAlerts.length > 0 && (
        <div className="floating-alert">
          <span className="alert-icon">⚠</span>
          <span className="alert-text">{criticalAlerts.length} Critical: {criticalAlerts[0].title}</span>
          <button onClick={() => handleAcknowledgeAlert(criticalAlerts[0].id)}>Dismiss</button>
        </div>
      )}

      {/* Main Fullscreen View */}
      <div className="fullscreen-view">
        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner" />
          </div>
        )}

        {viewMode === 'map' && (
          <ValidityMap
            workspaceId={selectedWorkspaceId}
            events={mapEvents}
            actors={[]}
            tensions={[]}
            onEventClick={(event) => handleEventClick(event.id)}
            onActorClick={(actor) => handleActorClick(actor.id)}
          />
        )}

        {viewMode === 'graph' && (
          <GraphExplorer
            data={graphData}
            workspaceId={selectedWorkspaceId}
            onNodeClick={(node) => handleActorClick(node.id)}
            selectedNodeId={selectedActorId || undefined}
            height={window.innerHeight - 60}
          />
        )}

        {viewMode === 'split' && (
          <div className="split-container">
            <div className="split-pane">
              <ValidityMap
                workspaceId={selectedWorkspaceId}
                events={mapEvents}
                actors={[]}
                tensions={[]}
                onEventClick={(event) => handleEventClick(event.id)}
                onActorClick={(actor) => handleActorClick(actor.id)}
              />
            </div>
            <div className="split-pane">
              <GraphExplorer
                data={graphData}
                workspaceId={selectedWorkspaceId}
                onNodeClick={(node) => handleActorClick(node.id)}
                selectedNodeId={selectedActorId || undefined}
                height={(window.innerHeight - 60) / 2}
              />
            </div>
          </div>
        )}
      </div>

      {/* Floating Info Panel (Overlay) */}
      {showInfoPanel && (
        <div className="floating-info-panel">
          <div className="panel-header">
            <h3>Intelligence Feed</h3>
            <button className="close-btn" onClick={() => setShowInfoPanel(false)}>×</button>
          </div>

          <div className="panel-section">
            <h4>Recent Events ({events.length})</h4>
            <div className="event-list">
              {events.slice(0, 8).map(event => (
                <div
                  key={event.id}
                  className={`event-item ${event.relevance || ''}`}
                  onClick={() => handleEventClick(event.id)}
                >
                  <span className="event-title">{event.title}</span>
                  <span className="event-time">{new Date(event.timestamp).toLocaleDateString()}</span>
                </div>
              ))}
              {events.length === 0 && <p className="empty">No events</p>}
            </div>
          </div>

          <div className="panel-section">
            <h4>Objective Validity ({objectives.length})</h4>
            <div className="objective-list">
              {objectives.slice(0, 5).map(obj => (
                <div key={obj.id} className="objective-item">
                  <div className="obj-title">{obj.objectiveTitle}</div>
                  <div className="obj-score">
                    <div className={`score-bar ${obj.validityScore >= 70 ? 'high' : obj.validityScore >= 50 ? 'med' : 'low'}`}>
                      <div className="score-fill" style={{ width: `${obj.validityScore}%` }} />
                    </div>
                    <span>{obj.validityScore}%</span>
                    <span className={`trend ${obj.trend}`}>
                      {obj.trend === 'up' ? '↑' : obj.trend === 'down' ? '↓' : '→'}
                    </span>
                  </div>
                </div>
              ))}
              {objectives.length === 0 && <p className="empty">No objectives</p>}
            </div>
          </div>

          <div className="panel-section">
            <h4>Alerts ({alerts.length})</h4>
            <div className="alert-list">
              {alerts.map(alert => (
                <div key={alert.id} className={`alert-item ${alert.severity}`}>
                  <span className={`severity ${alert.severity}`}>{alert.severity}</span>
                  <span className="alert-title">{alert.title}</span>
                  <button onClick={() => handleAcknowledgeAlert(alert.id)}>✓</button>
                </div>
              ))}
              {alerts.length === 0 && <p className="empty">No alerts</p>}
            </div>
          </div>
        </div>
      )}

      {/* Actor Detail Panel (Overlay) */}
      {selectedActorId && (
        <NodeDetailPanel
          actorId={selectedActorId}
          onClose={() => setSelectedActorId(null)}
          onNavigateToActor={handleActorClick}
        />
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onClick={() => setSelectedEventId(null)}>
          <div className="event-modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setSelectedEventId(null)}>×</button>
            <h2>{selectedEvent.title}</h2>
            {selectedEvent.relevance && (
              <span className={`relevance-badge ${selectedEvent.relevance}`}>{selectedEvent.relevance}</span>
            )}
            <p>{selectedEvent.description}</p>
            <div className="event-meta">
              <span>📅 {new Date(selectedEvent.timestamp).toLocaleString()}</span>
              {selectedEvent.location && (
                <span>📍 {selectedEvent.location.lat.toFixed(2)}, {selectedEvent.location.lng.toFixed(2)}</span>
              )}
              {selectedEvent.sourceUrl && (
                <a href={selectedEvent.sourceUrl} target="_blank" rel="noopener noreferrer">🔗 Source</a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
