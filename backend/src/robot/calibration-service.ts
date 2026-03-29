/**
 * CalibrationService — Singleton coordinate calibration provider
 *
 * Phase 64 Plan 01: Centralizes all room-to-geo coordinate conversion.
 * Replaces duplicate loadDefaultCalibration() implementations in
 * robot-mission-service.ts, swarm-cop-bridge.ts, and robot-routes.ts,
 * and the hardcoded CAL_* constants in mgrs-coordinator.ts.
 *
 * Usage:
 *   import { calibrationService } from './calibration-service.js';
 *   const geo = calibrationService.roomToGeo(x, y);
 *   const profile = calibrationService.getProfile('default');
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __cal_filename = fileURLToPath(import.meta.url);
const __cal_dirname = dirname(__cal_filename);
const CALIBRATION_FILE = join(__cal_dirname, '../../data/calibration-profiles.json');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalibrationProfile {
  room_width: number;
  room_height: number;
  map_bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  label?: string;
}

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

class CalibrationService {
  private _profiles: Record<string, CalibrationProfile> | null = null;

  /**
   * Load all calibration profiles from disk (lazy, synchronous).
   * Falls back to Latvia EFDL coordinates if file is missing.
   */
  loadProfiles(): Record<string, CalibrationProfile> {
    if (this._profiles !== null) return this._profiles;

    try {
      if (existsSync(CALIBRATION_FILE)) {
        this._profiles = JSON.parse(readFileSync(CALIBRATION_FILE, 'utf-8')) as Record<string, CalibrationProfile>;
        return this._profiles;
      }
    } catch { /* fallback below */ }

    this._profiles = {
      default: {
        room_width: 5,
        room_height: 15,
        map_bounds: { north: 56.858, south: 56.840, east: 27.708, west: 27.688 },
        label: 'Sector Latgale, Latvia — EFDL Unmanned Engagement Area (fallback)',
      },
    };
    return this._profiles;
  }

  /**
   * Save updated profiles to disk and clear cache so next call re-reads.
   */
  saveProfiles(profiles: Record<string, CalibrationProfile>): void {
    const dir = join(__cal_dirname, '../../data');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(CALIBRATION_FILE, JSON.stringify(profiles, null, 2));
    this._profiles = profiles;
  }

  /**
   * Retrieve a single calibration profile by name.
   * Returns the 'default' profile if name is not found.
   */
  getProfile(name = 'default'): CalibrationProfile {
    const profiles = this.loadProfiles();
    return profiles[name] ?? profiles.default ?? {
      room_width: 5,
      room_height: 15,
      map_bounds: { north: 56.858, south: 56.840, east: 27.708, west: 27.688 },
    };
  }

  /**
   * Convert room-space (x, y) meters to geographic (lat, lng).
   *
   * Formula:
   *   lat = south + (y / room_height) * (north - south)
   *   lng = west  + (x / room_width)  * (east  - west)
   */
  roomToGeo(x: number, y: number, profileName = 'default'): { lat: number; lng: number } {
    const { room_width, room_height, map_bounds } = this.getProfile(profileName);
    const { north, south, east, west } = map_bounds;
    return {
      lat: south + (y / room_height) * (north - south),
      lng: west  + (x / room_width)  * (east  - west),
    };
  }

  /**
   * Invalidate the in-memory cache (useful after external writes to the file).
   */
  invalidateCache(): void {
    this._profiles = null;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const calibrationService = new CalibrationService();
