/**
 * VehicleDatabase — Consolidated vehicle identification service
 *
 * Phase 64 Plan 01: Replaces three separate hardcoded vehicle tables:
 *   - KNOWN_VEHICLES in symbology-skill.ts
 *   - THREAT_CLASS_MAP in vision-cop-pipeline.ts
 *   - inline threat db in tactical-skills.ts assess_threat_capability tool
 *
 * All consumers should import vehicleDatabase rather than maintain local
 * vehicle classification tables.
 *
 * Later phases will wire loadVehicles() to read from problem set ORBAT data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VehicleEntry {
  /** Classification key (lowercase, normalized — e.g. 't-90', 'zbd-04') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Tactical vehicle type */
  type: 'mbt' | 'ifv' | 'apc' | 'truck' | 'artillery' | 'air' | 'naval' | 'personnel' | 'generic';
  /** Force affiliation */
  threat_class: 'hostile' | 'unknown' | 'neutral' | 'friendly';
  /** MIL-STD-2525D 20-char SIDC prefix — symbol set code */
  mil2525_symbol_set?: string;
  /** MIL-STD-2525D entity code */
  mil2525_entity?: string;
  /** Category for vision-cop-pipeline (maps to ground_vehicle/aircraft/naval/personnel) */
  category?: 'ground_vehicle' | 'aircraft' | 'naval' | 'personnel' | 'installation';
  /** Optional echelon designation */
  echelon?: string;
  /** Human-readable description / tactical notes */
  description?: string;
}

// ---------------------------------------------------------------------------
// Static vehicle data
// ---------------------------------------------------------------------------

const VEHICLE_DATA: VehicleEntry[] = [
  // ── MBTs (hostile) ──────────────────────────────────────────────────────
  {
    id: 't-90', name: 'T-90 Main Battle Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'Russian MBT, composite + Kontakt-5 ERA',
  },
  {
    id: 't90', name: 'T-90 Main Battle Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'Russian MBT',
  },
  {
    id: 'chn-99g', name: 'Type 99G Main Battle Tank (ZTZ-99G)', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA advanced MBT, FY-4 ERA + APS',
  },
  {
    id: 'chn99g', name: 'Type 99G Main Battle Tank (ZTZ-99G)', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA advanced MBT',
  },
  {
    id: 't72', name: 'T-72 Main Battle Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'Russian MBT, widely exported',
  },
  {
    id: 'ztz99', name: 'ZTZ-99 Main Battle Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA MBT',
  },
  {
    id: 'type99', name: 'Type 99 Main Battle Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA MBT',
  },
  {
    id: 't-99', name: 'Type 99 Main Battle Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA MBT',
  },

  // ── IFVs / APCs (hostile) ───────────────────────────────────────────────
  {
    id: 'zbd-04', name: 'ZBD-04 Infantry Fighting Vehicle', type: 'ifv', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA IFV, 100mm + 30mm',
  },
  {
    id: 'zbd04', name: 'ZBD-04 Infantry Fighting Vehicle', type: 'ifv', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'PLA IFV',
  },
  {
    id: 'btr-82', name: 'BTR-82 Armored Personnel Carrier', type: 'apc', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'Russian APC, 30mm autocannon',
  },
  {
    id: 'btr82', name: 'BTR-82 Armored Personnel Carrier', type: 'apc', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'Russian APC',
  },
  {
    id: 'bmp-3', name: 'BMP-3 Infantry Fighting Vehicle', type: 'ifv', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'Russian IFV, 100mm + 30mm',
  },

  // ── Friendly ────────────────────────────────────────────────────────────
  {
    id: 'm1', name: 'M1 Abrams Main Battle Tank', type: 'mbt', threat_class: 'friendly',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'US MBT',
  },
  {
    id: 'lav-25', name: 'LAV-25 Light Armored Vehicle', type: 'apc', threat_class: 'friendly',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'USMC LAV',
  },

  // ── Generic / unknown classification ────────────────────────────────────
  {
    id: 'tank', name: 'Unknown Tank', type: 'mbt', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120104', category: 'ground_vehicle', echelon: 'unit',
    description: 'Generic tank detection',
  },
  {
    id: 'armored vehicle', name: 'Armored Vehicle', type: 'generic', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '120200', category: 'ground_vehicle', echelon: 'unit',
    description: 'Generic armored vehicle',
  },
  {
    id: 'military vehicle', name: 'Military Vehicle', type: 'truck', threat_class: 'hostile',
    mil2525_symbol_set: '15', mil2525_entity: '140000', category: 'ground_vehicle', echelon: 'unit',
    description: 'Generic military vehicle',
  },
  {
    id: 'truck', name: 'Truck', type: 'truck', threat_class: 'unknown',
    mil2525_symbol_set: '10', mil2525_entity: '140000', category: 'ground_vehicle', echelon: 'unit',
    description: 'Transport vehicle',
  },
  {
    id: 'airplane', name: 'Fixed Wing Aircraft', type: 'air', threat_class: 'unknown',
    mil2525_symbol_set: '01', mil2525_entity: '110000', category: 'aircraft', echelon: 'unit',
    description: 'Airborne platform',
  },
  {
    id: 'helicopter', name: 'Rotary Wing Aircraft', type: 'air', threat_class: 'unknown',
    mil2525_symbol_set: '01', mil2525_entity: '110100', category: 'aircraft', echelon: 'unit',
    description: 'Rotary-wing platform',
  },
  {
    id: 'boat', name: 'Surface Vessel', type: 'naval', threat_class: 'unknown',
    mil2525_symbol_set: '30', mil2525_entity: '120000', category: 'naval', echelon: 'unit',
    description: 'Surface vessel',
  },
  {
    id: 'person', name: 'Personnel', type: 'personnel', threat_class: 'unknown',
    mil2525_symbol_set: '10', mil2525_entity: '110000', category: 'personnel', echelon: 'individual',
    description: 'Dismounted personnel',
  },
];

// ---------------------------------------------------------------------------
// Service class
// ---------------------------------------------------------------------------

class VehicleDatabase {
  private _index: Map<string, VehicleEntry> | null = null;

  private getIndex(): Map<string, VehicleEntry> {
    if (this._index !== null) return this._index;
    this._index = new Map(VEHICLE_DATA.map((v) => [v.id, v]));
    return this._index;
  }

  /**
   * Look up a vehicle by its classification key.
   * Key is normalized: lowercase, stripped of non-alphanumeric chars except spaces and hyphens.
   */
  getByClassification(classification: string): VehicleEntry | undefined {
    const key = classification.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim();
    return this.getIndex().get(key);
  }

  /** Return all known vehicles. */
  getAllVehicles(): VehicleEntry[] {
    return VEHICLE_DATA;
  }

  /**
   * Return the list of threat class IDs (hostile/unknown vehicles).
   * Used by tactical tools to enumerate known threats.
   */
  getThreatClasses(): string[] {
    return VEHICLE_DATA
      .filter((v) => v.threat_class === 'hostile' || v.threat_class === 'unknown')
      .map((v) => v.id);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const vehicleDatabase = new VehicleDatabase();
