/**
 * ReviewStep Component
 *
 * Step 4: Review & Create
 * - Display all entered data in read-only format
 * - Show mission name, classification, description
 * - Show area of operations on mini-map (read-only)
 * - List pending invites
 * - "Create Mission" button in parent wizard footer
 */

import { MapContainer, TileLayer, Polygon } from 'react-leaflet';
import L from 'leaflet';
import type { MissionFormData } from '../MissionWizard.js';
import { DARK_TILE_URL, DARK_TILE_ATTRIBUTION, DARK_TILE_SUBDOMAINS } from '../../../../lib/map-tiles';
import './WizardSteps.css';

interface ReviewStepProps {
  formData: MissionFormData;
  onEdit: (step: number) => void;
}

export function ReviewStep({ formData, onEdit }: ReviewStepProps) {
  const getClassificationBadgeClass = (classification: string) => {
    switch (classification) {
      case 'UNCLASSIFIED':
        return 'classification-badge unclassified';
      case 'SECRET':
        return 'classification-badge secret';
      case 'TOPSECRET':
        return 'classification-badge topsecret';
      default:
        return 'classification-badge';
    }
  };

  const getRoleBadgeClass = (role: string) => {
    return `role-badge role-${role}`;
  };

  // Calculate center of AO polygon for map
  const getPolygonCenter = (): L.LatLngExpression => {
    if (!formData.areaOfOperations) {
      return [20, 0];
    }

    const coords = formData.areaOfOperations.coordinates[0];
    const lats = coords.map((c) => c[1]);
    const lngs = coords.map((c) => c[0]);
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    return [avgLat, avgLng];
  };

  const getPolygonPositions = (): L.LatLngExpression[] => {
    if (!formData.areaOfOperations) {
      return [];
    }
    return formData.areaOfOperations.coordinates[0].map((coord) => [
      coord[1],
      coord[0],
    ]);
  };

  return (
    <div className="wizard-step-content review-step">
      <h3>Review Mission Details</h3>
      <p className="step-description">
        Review all information before creating the mission.
      </p>

      <div className="review-summary">
        {/* Basic Information */}
        <div className="review-section">
          <div className="section-header">
            <h4>Basic Information</h4>
            <button
              type="button"
              className="edit-btn"
              onClick={() => onEdit(1)}
            >
              Edit
            </button>
          </div>
          <dl>
            <dt>Mission Name</dt>
            <dd>{formData.name}</dd>

            <dt>Classification</dt>
            <dd>
              <span className={getClassificationBadgeClass(formData.classification)}>
                {formData.classification}
              </span>
            </dd>

            {formData.description && (
              <>
                <dt>Description</dt>
                <dd>{formData.description}</dd>
              </>
            )}

            {formData.problemSetId && (
              <>
                <dt>Workspace</dt>
                <dd>{formData.problemSetId}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Area of Operations */}
        <div className="review-section">
          <div className="section-header">
            <h4>Area of Operations</h4>
            <button
              type="button"
              className="edit-btn"
              onClick={() => onEdit(2)}
            >
              Edit
            </button>
          </div>
          {formData.areaOfOperations ? (
            <div className="mini-map-wrapper">
              <MapContainer
                center={getPolygonCenter()}
                zoom={6}
                scrollWheelZoom={false}
                dragging={false}
                zoomControl={false}
                className="mini-map"
                style={{ height: '250px', width: '100%' }}
              >
                <TileLayer
                  attribution={DARK_TILE_ATTRIBUTION}
                  url={DARK_TILE_URL}
                  subdomains={DARK_TILE_SUBDOMAINS}
                  maxZoom={18}
                  noWrap={true}
                />
                <Polygon
                  positions={getPolygonPositions()}
                  pathOptions={{
                    color: '#4a9eff',
                    weight: 2,
                    fillOpacity: 0.2,
                  }}
                />
              </MapContainer>
              <p className="map-note">Area of operations defined</p>
            </div>
          ) : (
            <p className="no-data">No area of operations defined</p>
          )}
        </div>

        {/* Participants */}
        <div className="review-section">
          <div className="section-header">
            <h4>Pending Invites ({formData.pendingInvites.length})</h4>
            <button
              type="button"
              className="edit-btn"
              onClick={() => onEdit(3)}
            >
              Edit
            </button>
          </div>
          {formData.pendingInvites.length > 0 ? (
            <div className="review-invites">
              {formData.pendingInvites.map((invite, index) => (
                <div key={index} className="review-invite-item">
                  <span className="invite-target">
                    {invite.inviteeDID || invite.email}
                  </span>
                  <span className={getRoleBadgeClass(invite.role)}>
                    {invite.role}
                  </span>
                  <span className="invite-expiry">
                    Expires in {invite.expiresInHours}h
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data">No invites added</p>
          )}
        </div>
      </div>

      <div className="review-note">
        <p>
          After creating the mission, invites will be sent to all pending participants.
          The mission will start in <strong>planning</strong> status.
        </p>
      </div>
    </div>
  );
}
