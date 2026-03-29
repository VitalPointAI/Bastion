/**
 * Seed Strategic COP Layers
 *
 * Creates force disposition layers for the active exercise scenario:
 * - Friendly (Blue): NATO coalition forces (Baltic Shield defaults)
 * - Adversary (Red): Opposing force elements
 *
 * Positions are calibration-derived — they track the active operational
 * theater configured in calibration-profiles.json (defaults to Sector
 * Latgale, Latvia for Baltic Shield demo).
 *
 * Usage: npx tsx scripts/seed-strategic-cop.ts <problemSetId>
 *
 * MIL-STD-2525D SIDC structure (20 chars):
 *   Pos 0: Version (1=2525D)
 *   Pos 1: Standard Identity (3=Friendly, 6=Hostile)
 *   Pos 2: Symbol Set (10=Land Unit, 30=Sea Surface, 05=Air)
 *   Pos 4-9: Entity/Type codes
 *   Pos 10-11: Sector 1 modifier
 *   Pos 12-13: Sector 2 modifier
 *   Pos 14: Status (0=Present)
 *   Pos 15: HQ/TF/Dummy (0=Not applicable)
 *   Pos 16-17: Echelon (12=Division, 14=Corps, 16=Army, 18=Theater)
 *   Pos 18-19: Unused (00)
 */

const API_BASE = process.env.API_URL || 'http://localhost:3001';

interface SymbolSpec {
  entityId: string;
  designation: string;
  affiliation: 'friendly' | 'enemy';
  sidc: string;
  position: { lat: number; lng: number };
  confidence: number;
  confidenceTier: 'high' | 'medium' | 'low';
}

// ── Friendly Forces (Baltic Shield / NATO Coalition defaults) ─────────────────
// Positions use Sector Latgale, Latvia coordinates (Baltic Shield demo theater).
// When calibration profiles are updated to a different theater, re-seed with
// the new problem set ID.

const friendlySymbols: SymbolSpec[] = [
  {
    entityId: 'nato-mnb-lva-hq',
    designation: 'NATO MNB-LVA HQ (Camp Adazi)',
    affiliation: 'friendly',
    sidc: '10031000001211001800', // Land unit, infantry, theater HQ
    position: { lat: 56.849, lng: 27.698 },  // Camp Adazi, Latvia (AO center)
    confidence: 0.95,
    confidenceTier: 'high',
  },
  {
    entityId: 'lva-1st-mech-coy',
    designation: '1st Mechanized Company (LVA)',
    affiliation: 'friendly',
    sidc: '10031000001211000400', // Land unit, infantry, company
    position: { lat: 56.852, lng: 27.703 },  // Eastern defensive line
    confidence: 0.95,
    confidenceTier: 'high',
  },
  {
    entityId: 'can-recon-pl',
    designation: 'Reconnaissance Platoon (CAN)',
    affiliation: 'friendly',
    sidc: '10031000001209000200', // Land unit, recon, platoon
    position: { lat: 56.856, lng: 27.695 },  // Forward observation post
    confidence: 0.90,
    confidenceTier: 'high',
  },
  {
    entityId: 'us-arty-bty',
    designation: 'Artillery Battery (US)',
    affiliation: 'friendly',
    sidc: '10031000001203000400', // Land unit, artillery, battery
    position: { lat: 56.845, lng: 27.706 },  // Fire support base
    confidence: 0.90,
    confidenceTier: 'high',
  },
  {
    entityId: 'uk-inf-pl',
    designation: 'Infantry Platoon (UK)',
    affiliation: 'friendly',
    sidc: '10031000001211000200', // Land unit, infantry, platoon
    position: { lat: 56.854, lng: 27.701 },  // Flank security position
    confidence: 0.90,
    confidenceTier: 'high',
  },
  {
    entityId: 'lva-air-def-sec',
    designation: 'Air Defense Section (LVA)',
    affiliation: 'friendly',
    sidc: '10031000001407000200', // Land unit, air defense, section
    position: { lat: 56.847, lng: 27.693 },  // ADA coverage position
    confidence: 0.85,
    confidenceTier: 'high',
  },
  {
    entityId: 'can-eng-sec',
    designation: 'Engineer Section (CAN)',
    affiliation: 'friendly',
    sidc: '10031000001205000200', // Land unit, engineer, section
    position: { lat: 56.851, lng: 27.708 },  // Obstacle emplacement
    confidence: 0.85,
    confidenceTier: 'high',
  },
  {
    entityId: 'us-med-team',
    designation: 'Medical Team (US)',
    affiliation: 'friendly',
    sidc: '10031000001215000200', // Land unit, medical, team
    position: { lat: 56.843, lng: 27.700 },  // Aid station
    confidence: 0.90,
    confidenceTier: 'high',
  },
  {
    entityId: 'nato-log-node',
    designation: 'Logistics Support Node (NATO)',
    affiliation: 'friendly',
    sidc: '10031000001211000200', // Land unit, support
    position: { lat: 56.841, lng: 27.691 },  // Rear logistics area
    confidence: 0.90,
    confidenceTier: 'high',
  },
];

// ── Adversary Forces (OPFOR — Baltic theater defaults) ────────────────────────
// Generic opposing force elements positioned east of the AO.

const adversarySymbols: SymbolSpec[] = [
  {
    entityId: 'opfor-btg-hq',
    designation: 'Opposing Force BTG HQ',
    affiliation: 'enemy',
    sidc: '10061000001211001200', // Land unit, infantry, brigade
    position: { lat: 57.10, lng: 28.21 },  // Staging area — east of AO
    confidence: 0.80,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-tank-coy',
    designation: 'Tank Company (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001207000400', // Land unit, armor, company
    position: { lat: 56.98, lng: 27.95 },  // Axis of advance — northwest
    confidence: 0.75,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-mech-coy',
    designation: 'Mechanized Infantry Company (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001211000400', // Land unit, infantry, company
    position: { lat: 57.03, lng: 28.10 },  // Supporting attack element
    confidence: 0.70,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-arty-bty',
    designation: 'Self-Propelled Artillery Battery (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001203000400', // Land unit, artillery, battery
    position: { lat: 57.15, lng: 28.35 },  // Fire support — rear staging
    confidence: 0.70,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-recon-ele',
    designation: 'Reconnaissance Element (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001209000200', // Land unit, recon, platoon
    position: { lat: 56.89, lng: 27.78 },  // Forward screen, approaching AO
    confidence: 0.65,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-air-def',
    designation: 'Short-Range Air Defense (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001407000200', // Land unit, air defense
    position: { lat: 57.08, lng: 28.28 },  // ADA coverage, rear area
    confidence: 0.50,
    confidenceTier: 'low',
  },
  {
    entityId: 'opfor-ew-unit',
    designation: 'Electronic Warfare Unit (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001215001200', // Land unit, EW
    position: { lat: 57.12, lng: 28.40 },  // EW jamming position
    confidence: 0.60,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-eng-ele',
    designation: 'Combat Engineer Element (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001205000200', // Land unit, engineer
    position: { lat: 56.95, lng: 28.00 },  // Obstacle clearance element
    confidence: 0.65,
    confidenceTier: 'medium',
  },
  {
    entityId: 'opfor-log-node',
    designation: 'Forward Logistics Node (OPFOR)',
    affiliation: 'enemy',
    sidc: '10061000001211001200',
    position: { lat: 57.20, lng: 28.50 },  // Logistics staging — far east
    confidence: 0.55,
    confidenceTier: 'low',
  },
];

// ── Seed Function ────────────────────────────────────────────────────────────

async function seedStrategicCOP(problemSetId: string) {
  console.log(`Seeding strategic COP layers for problem set: ${problemSetId}`);

  // Create friendly force disposition layer
  const friendlyLayer = {
    workspaceId: problemSetId,
    sectionId: 'default',
    layerType: 'force_disposition',
    spec: {
      layerId: `strategic-friendly-${Date.now()}`,
      layerType: 'force_disposition',
      workspaceId: problemSetId,
      sectionId: 'default',
      symbols: friendlySymbols.map(s => ({
        ...s,
        linkedEntities: [],
        ccoClass: 'military_unit',
        sourceAuthority: 'Exercise Seed (Baltic Shield defaults)',
        assertedVia: 'exercise_seed',
        provenanceSummary: 'Exercise scenario seed data — Baltic Shield coalition forces',
      })),
      controlMeasures: [],
      customAnnotations: [],
      temporalPhases: [],
      metadata: {
        generatedBy: 'strategic-cop-seed',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: ['exercise-seed'],
        ccoValidated: false,
        layerName: 'Friendly Force Disposition (Strategic)',
      },
    },
  };

  // Create adversary force disposition layer
  const adversaryLayer = {
    workspaceId: problemSetId,
    sectionId: 'default',
    layerType: 'force_disposition',
    spec: {
      layerId: `strategic-adversary-${Date.now()}`,
      layerType: 'force_disposition',
      workspaceId: problemSetId,
      sectionId: 'default',
      symbols: adversarySymbols.map(s => ({
        ...s,
        linkedEntities: [],
        ccoClass: 'military_unit',
        sourceAuthority: 'Exercise Seed (Baltic Shield intelligence assessment)',
        assertedVia: 'exercise_seed',
        provenanceSummary: 'Exercise scenario seed data — opposing force intelligence assessment (assessed)',
      })),
      controlMeasures: [],
      customAnnotations: [],
      temporalPhases: [],
      metadata: {
        generatedBy: 'strategic-cop-seed',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: ['exercise-seed'],
        ccoValidated: false,
        layerName: 'Adversary Force Disposition (Strategic)',
      },
    },
  };

  // POST to create layers
  for (const layer of [friendlyLayer, adversaryLayer]) {
    const res = await fetch(`${API_BASE}/api/cop/layers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layer),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`Failed to create layer: ${err}`);
    } else {
      const created = await res.json();
      const meta = layer.spec.metadata as Record<string, string>;
      console.log(`  ✓ Created ${meta.layerName} (${layer.spec.symbols.length} symbols) — ${created.id}`);
    }
  }

  console.log('Strategic COP seeding complete.');
}

// ── Main ─────────────────────────────────────────────────────────────────────

const problemSetId = process.argv[2];
if (!problemSetId) {
  console.error('Usage: npx tsx scripts/seed-strategic-cop.ts <problemSetId>');
  process.exit(1);
}

seedStrategicCOP(problemSetId).catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
