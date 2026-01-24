/**
 * Sensor Registration Domain Types
 *
 * Phase 4.4 Plan 01: Intelligence sensors and coverage tracking
 */

/**
 * GeoJSON Polygon type definition
 */
export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: number[][][]; // Array of LinearRings (array of positions)
}

/**
 * Sensor platform category types
 */
export type SensorCategory = 'airborne' | 'ground' | 'maritime' | 'space' | 'autonomous';

/**
 * Sensor operational status
 */
export type SensorStatus = 'operational' | 'degraded' | 'offline' | 'maintenance';

/**
 * Sensor capabilities specification
 */
export interface SensorCapabilities {
  range?: number; // Detection range in meters
  resolution?: number; // Resolution in meters
  coverageArea?: number; // Coverage area in square meters
  sensorTypes?: string[]; // e.g., ['EO', 'IR', 'SAR', 'SIGINT']
  updateRate?: number; // Update frequency in seconds
}

/**
 * Sensor registration
 *
 * Tracks intelligence collection sensors with capabilities and status
 */
export interface Sensor {
  id: string; // Format: SEN-{uuid}
  missionId: string;
  name: string;
  category: SensorCategory;
  sidc?: string; // Optional MIL-STD-2525D code for map rendering
  capabilities: SensorCapabilities;
  status: SensorStatus;
  location?: {
    lat: number;
    lng: number;
  };
  dataFeedUrl?: string; // Optional URL for real-time data feed
  createdAt: Date;
}

/**
 * Sensor coverage visualization
 *
 * Defines coverage area for map overlay rendering
 */
export interface SensorCoverage {
  id: string;
  sensorId: string;
  coveragePolygon: GeoJSONPolygon;
  confidenceLevel: number; // 0-100 confidence in coverage accuracy
  createdAt: Date;
}
