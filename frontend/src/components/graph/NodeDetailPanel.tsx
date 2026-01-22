import { useState, useEffect } from 'react';
import './NodeDetailPanel.css';

interface ActorDetail {
  id: string;
  name: string;
  type: string;
  aliases: string[];
  attributes: Record<string, unknown>;
  sourceDocumentIds: string[];
}

interface RelationshipDetail {
  id: string;
  type: string;
  strength: number;
  description?: string;
  targetActor: { id: string; name: string };
  direction: 'outgoing' | 'incoming';
}

interface TensionDetail {
  id: string;
  description: string;
  intensity: string;
  domain: string;
  actors: Array<{ id: string; name: string }>;
}

interface NodeDetailPanelProps {
  actorId: string | null;
  onClose: () => void;
  onNavigateToActor: (actorId: string) => void;
}

export function NodeDetailPanel({ actorId, onClose, onNavigateToActor }: NodeDetailPanelProps) {
  const [actor, setActor] = useState<ActorDetail | null>(null);
  const [relationships, setRelationships] = useState<RelationshipDetail[]>([]);
  const [tensions, setTensions] = useState<TensionDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'relationships' | 'tensions'>('overview');

  useEffect(() => {
    if (!actorId) {
      setActor(null);
      return;
    }

    setLoading(true);
    fetch(`/api/graph/actors/${actorId}`)
      .then(res => res.json())
      .then(data => {
        setActor(data.actor);
        setRelationships(data.relationships || []);
        setTensions(data.tensions || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [actorId]);

  if (!actorId) return null;

  return (
    <div className="node-detail-panel">
      <div className="panel-header">
        <h3>{loading ? 'Loading...' : actor?.name || 'Unknown'}</h3>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      {actor && (
        <>
          <div className="panel-tabs">
            <button
              className={activeTab === 'overview' ? 'active' : ''}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button
              className={activeTab === 'relationships' ? 'active' : ''}
              onClick={() => setActiveTab('relationships')}
            >
              Relations ({relationships.length})
            </button>
            <button
              className={activeTab === 'tensions' ? 'active' : ''}
              onClick={() => setActiveTab('tensions')}
            >
              Tensions ({tensions.length})
            </button>
          </div>

          <div className="panel-content">
            {activeTab === 'overview' && (
              <div className="overview-tab">
                <div className="detail-row">
                  <label>Type</label>
                  <span className={`actor-type-badge ${actor.type}`}>
                    {actor.type.replace('_', ' ')}
                  </span>
                </div>

                {actor.aliases.length > 0 && (
                  <div className="detail-row">
                    <label>Aliases</label>
                    <div className="aliases-list">
                      {actor.aliases.map((alias, i) => (
                        <span key={i} className="alias-tag">{alias}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="detail-row">
                  <label>Sources</label>
                  <span className="source-count">
                    {actor.sourceDocumentIds.length} document(s)
                  </span>
                </div>

                {Object.keys(actor.attributes).length > 0 && (
                  <div className="detail-row">
                    <label>Attributes</label>
                    <div className="attributes-list">
                      {Object.entries(actor.attributes).map(([key, value]) => (
                        <div key={key} className="attribute-item">
                          <span className="attr-key">{key}:</span>
                          <span className="attr-value">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'relationships' && (
              <div className="relationships-tab">
                {relationships.length === 0 ? (
                  <p className="empty-message">No relationships found</p>
                ) : (
                  <div className="relationship-list">
                    {relationships.map(rel => (
                      <div key={rel.id} className="relationship-item">
                        <div className="rel-header">
                          <span className={`rel-type ${rel.type}`}>{rel.type}</span>
                          <span className="rel-direction">
                            {rel.direction === 'outgoing' ? '→' : '←'}
                          </span>
                          <button
                            className="rel-actor-link"
                            onClick={() => onNavigateToActor(rel.targetActor.id)}
                          >
                            {rel.targetActor.name}
                          </button>
                        </div>
                        <div className="rel-strength">
                          <span className="strength-label">Strength:</span>
                          <div className="strength-bar">
                            <div
                              className={`strength-fill ${rel.strength >= 0 ? 'positive' : 'negative'}`}
                              style={{ width: `${Math.abs(rel.strength) * 100}%` }}
                            />
                          </div>
                          <span className="strength-value">{rel.strength.toFixed(2)}</span>
                        </div>
                        {rel.description && (
                          <p className="rel-description">{rel.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'tensions' && (
              <div className="tensions-tab">
                {tensions.length === 0 ? (
                  <p className="empty-message">No tensions found</p>
                ) : (
                  <div className="tension-list">
                    {tensions.map(tension => (
                      <div key={tension.id} className="tension-item">
                        <div className="tension-header">
                          <span className={`intensity-badge ${tension.intensity}`}>
                            {tension.intensity}
                          </span>
                          <span className="domain-badge">{tension.domain}</span>
                        </div>
                        <p className="tension-description">{tension.description}</p>
                        <div className="tension-actors">
                          {tension.actors.map(a => (
                            <button
                              key={a.id}
                              className="actor-chip"
                              onClick={() => onNavigateToActor(a.id)}
                            >
                              {a.name}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
