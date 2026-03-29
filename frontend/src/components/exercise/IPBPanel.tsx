/**
 * IPBPanel
 *
 * Phase 14 Plan 07: IPB view with perspective selection, layer controls,
 * SITREP delta preview with staff confirmation, and map integration.
 *
 * Supports:
 * - Blue perspective: Blue's own view (includes assessment of Red)
 * - Red perspective, "assessment" mode: Blue's view of Red (enemy_assessment)
 * - Red perspective, "self" mode: Red's own view (own perspective)
 * - SITREP update flow: preview delta -> staff confirms -> commit
 * - GIS-style layer toggles via IPBLayerControls
 */

import { useState, useEffect, useCallback } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type {
  IPBAssessment,
  ScenarioDocument,
  SITREPDeltaPreview,
  NamedAreaOfInterest,
} from '../../types/exercise';
import { ValidityMap } from '../validity/ValidityMap';
import { IPBLayerControls } from './IPBLayerControls';
import { useTeamConfig } from '../../context/TeamConfigProvider';
import './IPBPanel.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

interface IPBPanelProps {
  scenarioId: string;
  perspective: 'blue' | 'red';
  exercisePhase: string;
}

// ─── Red Mode Type ─────────────────────────────────────────────────────────────

type RedMode = 'assessment' | 'self';

// ─── SITREP Delta Preview Modal ────────────────────────────────────────────────

interface SITREPDeltaModalProps {
  preview: SITREPDeltaPreview;
  onConfirm: () => void;
  onCancel: () => void;
  confirming: boolean;
}

function SITREPDeltaModal({ preview, onConfirm, onCancel, confirming }: SITREPDeltaModalProps) {
  const changeTypeColor = (type: 'added' | 'modified' | 'removed') => {
    if (type === 'added') return '#50c878';
    if (type === 'modified') return '#ffa500';
    return '#ff6b6b';
  };

  const changeTypeBg = (type: 'added' | 'modified' | 'removed') => {
    if (type === 'added') return 'rgba(80, 200, 120, 0.1)';
    if (type === 'modified') return 'rgba(255, 165, 0, 0.1)';
    return 'rgba(255, 107, 107, 0.1)';
  };

  // Group changes by section
  const sectionMap: Record<string, typeof preview.changedFields> = {};
  for (const field of preview.changedFields) {
    if (!sectionMap[field.section]) sectionMap[field.section] = [];
    sectionMap[field.section].push(field);
  }

  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined) return '—';
    if (typeof v === 'object') return JSON.stringify(v).slice(0, 80);
    return String(v);
  };

  return (
    <div className="sitrep-modal-overlay" onClick={onCancel}>
      <div className="sitrep-modal" onClick={(e) => e.stopPropagation()}>
        <div className="sitrep-modal-header">
          <h3>SITREP Delta Preview</h3>
          <p className="sitrep-modal-subtitle">
            Review changes before committing the IPB update
          </p>
        </div>

        <div className="sitrep-modal-body">
          {/* SITREP Summary */}
          <div className="sitrep-summary-block">
            <div className="sitrep-summary-label">SITREP Summary</div>
            <p className="sitrep-summary-text">{preview.sitrepSummary}</p>
          </div>

          {/* Changed Fields */}
          {preview.changedFields.length > 0 ? (
            <div className="sitrep-changes-block">
              <div className="sitrep-section-label">
                Changed Fields ({preview.changedFields.length})
              </div>
              {Object.entries(sectionMap).map(([section, fields]) => (
                <div key={section} className="sitrep-change-section">
                  <div className="sitrep-change-section-header">{section}</div>
                  <table className="sitrep-change-table">
                    <thead>
                      <tr>
                        <th>Field</th>
                        <th>Type</th>
                        <th>Old Value</th>
                        <th>New Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fields.map((f, i) => (
                        <tr
                          key={i}
                          style={{ backgroundColor: changeTypeBg(f.changeType) }}
                        >
                          <td className="sitrep-field-path">{f.fieldPath}</td>
                          <td>
                            <span
                              className="sitrep-change-badge"
                              style={{ color: changeTypeColor(f.changeType), borderColor: changeTypeColor(f.changeType) }}
                            >
                              {f.changeType}
                            </span>
                          </td>
                          <td className="sitrep-old-value">{formatValue(f.oldValue)}</td>
                          <td className="sitrep-new-value">{formatValue(f.newValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          ) : (
            <div className="sitrep-no-changes">No field changes detected in this SITREP.</div>
          )}

          {/* Affected COAs */}
          {preview.affectedCOAs.length > 0 && (
            <div className="sitrep-coas-block">
              <div className="sitrep-section-label">
                Affected COAs ({preview.affectedCOAs.length})
              </div>
              <table className="sitrep-coa-table">
                <thead>
                  <tr>
                    <th>COA Name</th>
                    <th>Impact Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.affectedCOAs.map((coa) => (
                    <tr key={coa.coaId}>
                      <td className="sitrep-coa-name">{coa.coaName}</td>
                      <td className="sitrep-coa-impact">{coa.impactReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="sitrep-modal-actions">
          <button
            className="sitrep-btn-cancel"
            onClick={onCancel}
            disabled={confirming}
          >
            Cancel
          </button>
          <button
            className="sitrep-btn-confirm"
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? 'Updating...' : 'Confirm Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OAKOC Section ─────────────────────────────────────────────────────────────

function OAKOCSection({ terrainAnalysis }: { terrainAnalysis: IPBAssessment['terrainAnalysis'] }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ipb-detail-section">
      <button
        className="ipb-detail-collapsible"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Terrain Analysis (OAKOC)</span>
        <span className="ipb-detail-chevron">{expanded ? 'v' : '>'}</span>
      </button>
      {expanded && (
        <div className="ipb-detail-content">
          <div className="oakoc-item">
            <div className="oakoc-label">Observation & Fields of Fire</div>
            <p>{terrainAnalysis.observation || 'No data'}</p>
          </div>
          <div className="oakoc-item">
            <div className="oakoc-label">Avenues of Approach</div>
            <p>{terrainAnalysis.avenues || 'No data'}</p>
          </div>
          <div className="oakoc-item">
            <div className="oakoc-label">Key Terrain</div>
            <p>{terrainAnalysis.keyTerrain || 'No data'}</p>
          </div>
          <div className="oakoc-item">
            <div className="oakoc-label">Obstacles</div>
            <p>{terrainAnalysis.obstacles || 'No data'}</p>
          </div>
          <div className="oakoc-item">
            <div className="oakoc-label">Cover and Concealment</div>
            <p>{terrainAnalysis.coverAndConcealment || 'No data'}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── NAI List ──────────────────────────────────────────────────────────────────

interface NAIListProps {
  nais: NamedAreaOfInterest[];
  onZoomTo?: (nai: NamedAreaOfInterest) => void;
}

function NAIList({ nais, onZoomTo }: NAIListProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="ipb-detail-section">
      <button
        className="ipb-detail-collapsible"
        onClick={() => setExpanded((v) => !v)}
      >
        <span>Named Areas of Interest ({nais.length})</span>
        <span className="ipb-detail-chevron">{expanded ? 'v' : '>'}</span>
      </button>
      {expanded && (
        <div className="ipb-detail-content">
          {nais.length === 0 ? (
            <p className="ipb-detail-empty">No NAIs defined.</p>
          ) : (
            <ul className="nai-list">
              {nais.map((nai) => (
                <li key={nai.id} className="nai-item">
                  <div className="nai-header">
                    <span className="nai-name">{nai.name}</span>
                    {onZoomTo && (
                      <button
                        className="nai-zoom-btn"
                        onClick={() => onZoomTo(nai)}
                        title="Zoom to NAI on map"
                      >
                        Zoom
                      </button>
                    )}
                  </div>
                  {nai.significance && (
                    <p className="nai-significance">{nai.significance}</p>
                  )}
                  {nai.expectedActivity && (
                    <p className="nai-activity">
                      <span className="nai-activity-label">Expected:</span>{' '}
                      {nai.expectedActivity}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ─── IPBPanel ──────────────────────────────────────────────────────────────────

export function IPBPanel({ scenarioId, perspective, exercisePhase }: IPBPanelProps) {
  const { blueTeamLabel, redTeamLabel } = useTeamConfig();

  // ── State ──────────────────────────────────────────────────────────────────
  const [assessment, setAssessment] = useState<IPBAssessment | null>(null);
  const [redMode, setRedMode] = useState<RedMode>('assessment');
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // SITREP update flow state
  const [sitrepDocs, setSitrepDocs] = useState<ScenarioDocument[]>([]);
  const [selectedSitrepId, setSelectedSitrepId] = useState<string | null>(null);
  const [sitrepDeltaPreview, setSitrepDeltaPreview] = useState<SITREPDeltaPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [confirmingUpdate, setConfirmingUpdate] = useState(false);

  // ── Fetch Assessment ───────────────────────────────────────────────────────

  const fetchAssessment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let team: string;
      let perspectiveParam: string;

      if (perspective === 'blue') {
        team = 'blue';
        perspectiveParam = 'own';
      } else if (redMode === 'assessment') {
        // Blue's view of Red (enemy_assessment)
        team = 'blue';
        perspectiveParam = 'enemy_assessment';
      } else {
        // Red's own view
        team = 'red';
        perspectiveParam = 'own';
      }

      const assessments = await exerciseService.getIPBAssessments(scenarioId, {
        team,
        perspective: perspectiveParam,
        phase: exercisePhase,
      });

      // Take the most recent assessment (first in list, or null if none)
      const current = assessments.length > 0 ? assessments[0] : null;
      setAssessment(current);

      // Initialize layer visibility — all layers visible by default
      if (current?.overlayLayers) {
        const visibility: Record<string, boolean> = {};
        for (const layer of current.overlayLayers) {
          visibility[layer.id] = true;
        }
        setLayerVisibility(visibility);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load IPB assessment');
    } finally {
      setLoading(false);
    }
  }, [scenarioId, perspective, redMode, exercisePhase]);

  // Fetch SITREP documents for update dropdown
  const fetchSitrepDocs = useCallback(async () => {
    try {
      const docs = await exerciseService.getDocuments(scenarioId, {
        type: 'SITREP',
        phase: exercisePhase,
      });
      setSitrepDocs(docs);
    } catch {
      // Non-fatal — SITREP dropdown just stays empty
    }
  }, [scenarioId, exercisePhase]);

  useEffect(() => {
    fetchAssessment();
    fetchSitrepDocs();
  }, [fetchAssessment, fetchSitrepDocs]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLayerVisibilityChange = (layerId: string, visible: boolean) => {
    setLayerVisibility((prev) => ({ ...prev, [layerId]: visible }));
  };

  const handleAssembleIPB = async () => {
    setAssembling(true);
    setError(null);
    try {
      let team: string;
      let perspectiveParam: string;

      if (perspective === 'blue') {
        team = 'blue';
        perspectiveParam = 'own';
      } else if (redMode === 'assessment') {
        team = 'blue';
        perspectiveParam = 'enemy_assessment';
      } else {
        team = 'red';
        perspectiveParam = 'own';
      }

      const result = await exerciseService.assembleIPB(scenarioId, {
        team,
        perspective: perspectiveParam,
        exercisePhase,
      });
      setAssessment(result);

      // Re-initialize layer visibility for new assessment
      const visibility: Record<string, boolean> = {};
      for (const layer of result.overlayLayers) {
        visibility[layer.id] = true;
      }
      setLayerVisibility(visibility);
      setSuccessMsg('IPB assembled successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assemble IPB');
    } finally {
      setAssembling(false);
    }
  };

  const handleSitrepSelect = async (sitrepDocId: string) => {
    if (!assessment) return;
    setSelectedSitrepId(sitrepDocId);
    setPreviewLoading(true);
    setError(null);
    try {
      const preview = await exerciseService.previewIPBFromSITREP(assessment.id, sitrepDocId);
      setSitrepDeltaPreview(preview);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview SITREP delta');
      setSelectedSitrepId(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleConfirmSitrepUpdate = async () => {
    if (!assessment || !selectedSitrepId) return;
    setConfirmingUpdate(true);
    setError(null);
    try {
      const updated = await exerciseService.updateIPBFromSITREP(assessment.id, selectedSitrepId);
      setAssessment(updated);

      // Re-initialize layer visibility
      const visibility: Record<string, boolean> = {};
      for (const layer of updated.overlayLayers) {
        visibility[layer.id] = true;
      }
      setLayerVisibility(visibility);

      setSitrepDeltaPreview(null);
      setSelectedSitrepId(null);
      setSuccessMsg('IPB updated from SITREP successfully. New version created.');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update IPB from SITREP');
    } finally {
      setConfirmingUpdate(false);
    }
  };

  const handleCancelSitrepPreview = () => {
    setSitrepDeltaPreview(null);
    setSelectedSitrepId(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const perspectiveLabel = perspective === 'blue' ? `Blue Force (${blueTeamLabel})` : `Red Force (${redTeamLabel})`;

  return (
    <div className="ipb-panel">

      {/* Header */}
      <div className="ipb-panel-header">
        <div className="ipb-panel-title">
          <span className={`ipb-perspective-badge ipb-perspective-badge--${perspective}`}>
            {perspectiveLabel}
          </span>
          {assessment && (
            <span className="ipb-version-badge">v{assessment.version}</span>
          )}
        </div>

        <div className="ipb-panel-controls">
          {/* Red mode toggle — only for Red perspective */}
          {perspective === 'red' && (
            <div className="ipb-red-mode-toggle">
              <button
                className={`ipb-red-mode-btn ${redMode === 'assessment' ? 'active' : ''}`}
                onClick={() => setRedMode('assessment')}
                title="Blue's assessment of Red forces"
              >
                Red as Blue sees them
              </button>
              <button
                className={`ipb-red-mode-btn ${redMode === 'self' ? 'active' : ''}`}
                onClick={() => setRedMode('self')}
                title="Red's own self-assessment"
              >
                Red as Red sees themselves
              </button>
            </div>
          )}

          {/* Assemble IPB button */}
          <button
            className="ipb-btn-assemble"
            onClick={handleAssembleIPB}
            disabled={assembling || loading}
          >
            {assembling ? (
              <span className="ipb-spinner" />
            ) : null}
            {assembling ? 'Assembling...' : 'Assemble IPB'}
          </button>

          {/* Update from SITREP dropdown */}
          {assessment && (
            <div className="ipb-sitrep-update">
              <select
                className="ipb-sitrep-select"
                value=""
                onChange={(e) => {
                  if (e.target.value) handleSitrepSelect(e.target.value);
                }}
                disabled={previewLoading}
                title="Select a SITREP to preview changes"
              >
                <option value="">
                  {previewLoading ? 'Loading preview...' : 'Update from SITREP...'}
                </option>
                {sitrepDocs.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.filename} ({doc.exercisePhase})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && <div className="ipb-error-banner">{error}</div>}
      {successMsg && <div className="ipb-success-banner">{successMsg}</div>}

      {/* Loading state */}
      {loading ? (
        <div className="ipb-loading">
          <div className="ipb-loading-spinner" />
          <p>Loading IPB assessment...</p>
        </div>
      ) : !assessment ? (
        <div className="ipb-empty-state">
          <h3>No IPB Assessment Available</h3>
          <p>
            No IPB assessment found for{' '}
            <strong>{perspectiveLabel}</strong> in phase{' '}
            <strong>{exercisePhase}</strong>.
          </p>
          <p>
            Upload scenario documents and click{' '}
            <strong>Assemble IPB</strong> to generate the intelligence
            picture.
          </p>
          <button
            className="ipb-btn-assemble ipb-btn-assemble--large"
            onClick={handleAssembleIPB}
            disabled={assembling}
          >
            {assembling ? 'Assembling...' : 'Assemble IPB Now'}
          </button>
        </div>
      ) : (
        <div className="ipb-content">
          {/* Two-column layout */}
          <div className="ipb-main-layout">

            {/* Left column (70%): Map */}
            <div className="ipb-map-column">
              <ValidityMap
                ipbLayers={assessment.overlayLayers}
                layerVisibility={layerVisibility}
                perspective={perspective}
                center={[20, 125]}
                zoom={4}
              />
            </div>

            {/* Right column (30%): Layer controls + details */}
            <div className="ipb-sidebar-column">

              {/* Layer Controls */}
              <IPBLayerControls
                layers={assessment.overlayLayers}
                layerVisibility={layerVisibility}
                onVisibilityChange={handleLayerVisibilityChange}
              />

              {/* Assessment Details */}
              <div className="ipb-assessment-details">

                <OAKOCSection terrainAnalysis={assessment.terrainAnalysis} />

                {/* Threat Assessment */}
                <div className="ipb-detail-section">
                  <button
                    className="ipb-detail-collapsible"
                    onClick={(e) => {
                      const target = e.currentTarget.nextElementSibling as HTMLElement;
                      if (target) target.style.display = target.style.display === 'none' ? '' : 'none';
                    }}
                  >
                    <span>Threat Assessment</span>
                    <span className="ipb-detail-chevron">v</span>
                  </button>
                  <div className="ipb-detail-content">
                    <p className="ipb-detail-text">
                      {assessment.threatAssessment || 'No threat assessment data.'}
                    </p>
                  </div>
                </div>

                {/* Civil Considerations */}
                <div className="ipb-detail-section">
                  <button
                    className="ipb-detail-collapsible"
                    onClick={(e) => {
                      const target = e.currentTarget.nextElementSibling as HTMLElement;
                      if (target) target.style.display = target.style.display === 'none' ? '' : 'none';
                    }}
                  >
                    <span>Civil Considerations (ASCOPE)</span>
                    <span className="ipb-detail-chevron">v</span>
                  </button>
                  <div className="ipb-detail-content">
                    <p className="ipb-detail-text">
                      {assessment.civilConsiderations || 'No civil considerations data.'}
                    </p>
                  </div>
                </div>

                {/* Named Areas of Interest */}
                <NAIList nais={assessment.namedAreasOfInterest} />

              </div>
            </div>
          </div>
        </div>
      )}

      {/* SITREP Delta Preview Modal */}
      {sitrepDeltaPreview && (
        <SITREPDeltaModal
          preview={sitrepDeltaPreview}
          onConfirm={handleConfirmSitrepUpdate}
          onCancel={handleCancelSitrepPreview}
          confirming={confirmingUpdate}
        />
      )}
    </div>
  );
}
