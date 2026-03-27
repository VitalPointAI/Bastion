/**
 * MGRS Coordinate System (Frontend)
 *
 * Unified coordinate conversion between MGRS, lat/lng, and room coordinates.
 * Mirrors backend/src/coordinates/mgrs-coordinator.ts for frontend use.
 *
 * Supports the full globe via the mgrs library (all UTM zones).
 * The room coordinate calibration is specific to the current operational area
 * but can be reconfigured for any AO.
 */

import { forward, toPoint } from 'mgrs';

// ---------------------------------------------------------------------------
// Calibration — configurable per operational area
// ---------------------------------------------------------------------------

interface AOCalibration {
  /** Room dimensions */
  roomW: number;
  roomH: number;
  /** Geographic bounds */
  south: number;
  north: number;
  west: number;
  east: number;
}

/** Default: Taipei Zhongzheng District (5m wide × 10m deep room) */
const DEFAULT_CALIBRATION: AOCalibration = {
  roomW: 5,
  roomH: 10,
  south: 25.0420,
  north: 25.0540,
  west: 121.5120,
  east: 121.5180,
};

let calibration = DEFAULT_CALIBRATION;

/** Set calibration for a different operational area */
export function setAOCalibration(cal: AOCalibration): void {
  calibration = cal;
}

// ---------------------------------------------------------------------------
// Conversion functions
// ---------------------------------------------------------------------------

export function roomToLatLng(x: number, y: number): [number, number] {
  const lat = calibration.south + (y / calibration.roomH) * (calibration.north - calibration.south);
  const lng = calibration.west + (x / calibration.roomW) * (calibration.east - calibration.west);
  return [lat, lng];
}

export function latLngToRoom(lat: number, lng: number): { x: number; y: number } {
  return {
    x: ((lng - calibration.west) / (calibration.east - calibration.west)) * calibration.roomW,
    y: ((lat - calibration.south) / (calibration.north - calibration.south)) * calibration.roomH,
  };
}

export function latLngToMGRS(lat: number, lng: number, precision: 1 | 2 | 3 | 4 | 5 = 4): string {
  return forward([lng, lat], precision);
}

export function mgrsToLatLng(mgrsString: string): { lat: number; lng: number } {
  const [lng, lat] = toPoint(mgrsString);
  return { lat, lng };
}

export function roomToMGRS(x: number, y: number, precision: 1 | 2 | 3 | 4 | 5 = 4): string {
  const [lat, lng] = roomToLatLng(x, y);
  return forward([lng, lat], precision);
}

export function mgrsToRoom(mgrsString: string): { x: number; y: number } {
  const { lat, lng } = mgrsToLatLng(mgrsString);
  return latLngToRoom(lat, lng);
}

/** Extract the grid reference digits from a full MGRS string */
export function mgrsToGridRef(mgrsString: string): string {
  const numericPart = mgrsString.slice(5);
  const half = numericPart.length / 2;
  return `${numericPart.slice(0, half)} ${numericPart.slice(half)}`;
}

/** Format a position as a short grid reference */
export function positionToGridRef(lat: number, lng: number, precision: 1 | 2 | 3 | 4 | 5 = 4): string {
  return mgrsToGridRef(latLngToMGRS(lat, lng, precision));
}
