/**
 * MGRS Coordinate System
 *
 * Unified coordinate conversion between three domains:
 *   1. MGRS (Military Grid Reference System) — human-readable military coordinates
 *   2. Lat/Lng (WGS84) — geographic coordinates for map rendering
 *   3. Room coordinates — 5m×5m physical room for robot control
 *
 * The operational area (Taipei Zhongzheng District) is calibrated as:
 *   Room (0,0) → (25.0420°N, 121.5120°E)
 *   Room (5,5) → (25.0480°N, 121.5180°E)
 *   Room unit ≈ 130m on the ground
 *
 * MGRS zone: 51R (Taiwan)
 *
 * Usage:
 *   const coord = Coordinator.fromRoom(2.5, 3.3);
 *   console.log(coord.toMGRS());     // "51RQN1234567890"
 *   console.log(coord.toLatLng());   // { lat: 25.0456, lng: 121.5150 }
 *   console.log(coord.toRoom());     // { x: 2.5, y: 3.3 }
 *
 *   const coord2 = Coordinator.fromMGRS("51RQN1234567890");
 *   const coord3 = Coordinator.fromLatLng(25.045, 121.515);
 */

import mgrs from 'mgrs';
const { forward, toPoint } = mgrs;

// ---------------------------------------------------------------------------
// Calibration constants
// ---------------------------------------------------------------------------

/** Room coordinate system: 5m × 5m physical room */
const ROOM_W = 5;
const ROOM_H = 5;

/** Geographic bounds of the operational area */
const CAL_SOUTH = 25.0420;
const CAL_NORTH = 25.0480;
const CAL_WEST = 121.5120;
const CAL_EAST = 121.5180;

/** Derived scale factors */
const LAT_RANGE = CAL_NORTH - CAL_SOUTH; // 0.006°
const LNG_RANGE = CAL_EAST - CAL_WEST;   // 0.006°

// ---------------------------------------------------------------------------
// Coordinator class
// ---------------------------------------------------------------------------

export interface LatLng {
  lat: number;
  lng: number;
}

export interface RoomCoord {
  x: number;
  y: number;
}

export class Coordinator {
  private lat: number;
  private lng: number;

  private constructor(lat: number, lng: number) {
    this.lat = lat;
    this.lng = lng;
  }

  // ── Factory methods ──────────────────────────────────────────────────

  /** Create from room coordinates (0-5 range) */
  static fromRoom(x: number, y: number): Coordinator {
    const lat = CAL_SOUTH + (y / ROOM_H) * LAT_RANGE;
    const lng = CAL_WEST + (x / ROOM_W) * LNG_RANGE;
    return new Coordinator(lat, lng);
  }

  /** Create from geographic coordinates */
  static fromLatLng(lat: number, lng: number): Coordinator {
    return new Coordinator(lat, lng);
  }

  /** Create from MGRS string (any precision) */
  static fromMGRS(mgrsString: string): Coordinator {
    const [lng, lat] = toPoint(mgrsString);
    return new Coordinator(lat, lng);
  }

  // ── Conversion methods ───────────────────────────────────────────────

  /** Convert to room coordinates */
  toRoom(): RoomCoord {
    return {
      x: ((this.lng - CAL_WEST) / LNG_RANGE) * ROOM_W,
      y: ((this.lat - CAL_SOUTH) / LAT_RANGE) * ROOM_H,
    };
  }

  /** Convert to geographic coordinates */
  toLatLng(): LatLng {
    return { lat: this.lat, lng: this.lng };
  }

  /**
   * Convert to MGRS string.
   * @param precision — number of digits per easting/northing:
   *   1 = 10km, 2 = 1km, 3 = 100m, 4 = 10m, 5 = 1m
   *   Default 4 (10m precision — appropriate for urban tactical)
   */
  toMGRS(precision: 1 | 2 | 3 | 4 | 5 = 4): string {
    return forward([this.lng, this.lat], precision);
  }

  /**
   * Convert to a short MGRS grid reference (easting/northing digits only).
   * E.g., "1234 5678" from full MGRS "51RQN12345678"
   */
  toGridRef(precision: 1 | 2 | 3 | 4 | 5 = 4): string {
    const full = this.toMGRS(precision);
    // MGRS format: Zone(2) + Band(1) + Square(2) + Easting + Northing
    // For 4-digit precision: "51RQN12345678" → easting "1234", northing "5678"
    const numericPart = full.slice(5); // Skip zone + band + square
    const half = numericPart.length / 2;
    const easting = numericPart.slice(0, half);
    const northing = numericPart.slice(half);
    return `${easting} ${northing}`;
  }

  // ── Distance calculation ─────────────────────────────────────────────

  /** Distance to another coordinate in meters (Haversine) */
  distanceTo(other: Coordinator): number {
    const R = 6371000; // Earth radius in meters
    const dLat = (other.lat - this.lat) * Math.PI / 180;
    const dLng = (other.lng - this.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(this.lat * Math.PI / 180) * Math.cos(other.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /** Bearing to another coordinate in degrees (0 = north, clockwise) */
  bearingTo(other: Coordinator): number {
    const dLng = (other.lng - this.lng) * Math.PI / 180;
    const lat1 = this.lat * Math.PI / 180;
    const lat2 = other.lat * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // ── Formatting ───────────────────────────────────────────────────────

  /** Format as a tactical order string: "MGRS 51RQN12345678" */
  toOrderString(precision: 1 | 2 | 3 | 4 | 5 = 4): string {
    return `MGRS ${this.toMGRS(precision)}`;
  }

  /** Format as a short grid reference for radio comms: "grid 1234 5678" */
  toRadioFormat(precision: 1 | 2 | 3 | 4 | 5 = 4): string {
    return `grid ${this.toGridRef(precision)}`;
  }

  toString(): string {
    return this.toMGRS(4);
  }
}

// ---------------------------------------------------------------------------
// Convenience functions for non-OO usage
// ---------------------------------------------------------------------------

/** Convert room coordinates to MGRS */
export function roomToMGRS(x: number, y: number, precision: 1 | 2 | 3 | 4 | 5 = 4): string {
  return Coordinator.fromRoom(x, y).toMGRS(precision);
}

/** Convert MGRS to room coordinates */
export function mgrsToRoom(mgrsString: string): RoomCoord {
  return Coordinator.fromMGRS(mgrsString).toRoom();
}

/** Convert room coordinates to lat/lng */
export function roomToLatLng(x: number, y: number): LatLng {
  return Coordinator.fromRoom(x, y).toLatLng();
}

/** Convert lat/lng to room coordinates */
export function latLngToRoom(lat: number, lng: number): RoomCoord {
  return Coordinator.fromLatLng(lat, lng).toRoom();
}

/** Convert lat/lng to MGRS */
export function latLngToMGRS(lat: number, lng: number, precision: 1 | 2 | 3 | 4 | 5 = 4): string {
  return Coordinator.fromLatLng(lat, lng).toMGRS(precision);
}

/** Convert MGRS to lat/lng */
export function mgrsToLatLng(mgrsString: string): LatLng {
  return Coordinator.fromMGRS(mgrsString).toLatLng();
}

/** Format a room coordinate as an MGRS grid reference for tactical orders */
export function roomToGridRef(x: number, y: number, precision: 1 | 2 | 3 | 4 | 5 = 4): string {
  return Coordinator.fromRoom(x, y).toGridRef(precision);
}

/** Calculate distance between two room coordinates in meters */
export function roomDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Coordinator.fromRoom(x1, y1).distanceTo(Coordinator.fromRoom(x2, y2));
}
