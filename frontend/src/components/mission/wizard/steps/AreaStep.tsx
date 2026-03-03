/**
 * AreaStep Component
 *
 * Step 2: Area of Operations
 * - Integrate react-leaflet map with Stadia dark tiles
 * - Use react-leaflet-draw for polygon drawing
 * - Allow edit/delete of polygon
 * - Store as GeoJSON
 */

import { useRef } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import type { MissionFormData } from '../MissionWizard.js';
import type { GeoJSONPolygon } from '../../../../lib/mission-service.js';
import './WizardSteps.css';

// Fix for default marker icons in react-leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

interface AreaStepProps {
  formData: MissionFormData;
  updateFormData: <K extends keyof MissionFormData>(
    field: K,
    value: MissionFormData[K]
  ) => void;
}

export function AreaStep({ formData, updateFormData }: AreaStepProps) {
  const featureGroupRef = useRef<L.FeatureGroup | null>(null);

  const handleCreated = (e: L.DrawEvents.Created) => {
    const layer = e.layer as L.Polygon;
    const geoJSON = layer.toGeoJSON();

    if (geoJSON.geometry.type === 'Polygon') {
      const polygon: GeoJSONPolygon = {
        type: 'Polygon',
        coordinates: geoJSON.geometry.coordinates as number[][][],
      };
      updateFormData('areaOfOperations', polygon);
    }

    // Clear any existing polygons (only allow one AO)
    if (featureGroupRef.current) {
      featureGroupRef.current.eachLayer((existingLayer) => {
        if (existingLayer !== layer) {
          featureGroupRef.current?.removeLayer(existingLayer);
        }
      });
    }
  };

  const handleEdited = (e: L.DrawEvents.Edited) => {
    const layers = e.layers;
    layers.eachLayer((layer) => {
      const geoJSON = (layer as L.Polygon).toGeoJSON();
      if (geoJSON.geometry.type === 'Polygon') {
        const polygon: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: geoJSON.geometry.coordinates as number[][][],
        };
        updateFormData('areaOfOperations', polygon);
      }
    });
  };

  const handleDeleted = () => {
    updateFormData('areaOfOperations', null);
  };

  const defaultCenter: L.LatLngExpression = [20, 0];
  const defaultZoom = 2;

  const worldBounds: L.LatLngBoundsExpression = [
    [-85, -180],
    [85, 180],
  ];

  return (
    <div className="wizard-step-content area-step">
      <h3>Area of Operations</h3>
      <p className="step-description">
        Draw a polygon on the map to define the operational area (optional).
      </p>

      <div className="map-container-wrapper">
        <MapContainer
          center={defaultCenter}
          zoom={defaultZoom}
          minZoom={2}
          maxZoom={18}
          scrollWheelZoom={true}
          maxBounds={worldBounds}
          maxBoundsViscosity={1.0}
          className="mission-map"
          style={{ height: '500px', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            maxZoom={18}
            noWrap={true}
          />

          <FeatureGroup ref={featureGroupRef}>
            <EditControl
              position="topright"
              onCreated={handleCreated}
              onEdited={handleEdited}
              onDeleted={handleDeleted}
              draw={{
                rectangle: false,
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
                polygon: {
                  allowIntersection: false,
                  showArea: false, // Disabled due to bug in react-leaflet-draw
                  shapeOptions: {
                    color: '#4a9eff',
                    weight: 2,
                    fillOpacity: 0.2,
                  },
                },
              }}
            />
          </FeatureGroup>
        </MapContainer>
      </div>

      {formData.areaOfOperations && (
        <div className="ao-status">
          <span className="status-icon">✓</span>
          <span className="status-text">Area of operations defined</span>
        </div>
      )}

      {!formData.areaOfOperations && (
        <div className="ao-help">
          <p>Use the polygon tool (pentagon icon) in the top-right to draw an area.</p>
          <p>You can skip this step if no specific area is required.</p>
        </div>
      )}
    </div>
  );
}
