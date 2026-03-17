/**
 * Seed Strategic COP Layers
 *
 * Creates force disposition layers for the Pacific Strategy AY26 exercise:
 * - Friendly (Blue): Taiwan/US joint defense forces across Taiwan
 * - Adversary (Red): PLA invasion staging, naval, and air assets
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

// ── Friendly Forces (Taiwan/US Joint Defense) ────────────────────────────────

const friendlySymbols: SymbolSpec[] = [
  // Taiwan Army — ground defense
  {
    entityId: 'tw-6th-army',
    designation: '6th Army Command (ROC)',
    affiliation: 'friendly',
    sidc: '10031000001211004600', // Land unit, infantry, corps
    position: { lat: 25.034, lng: 121.564 },  // Taipei, Ministry of National Defense
    confidence: 0.95,
    confidenceTier: 'high',
  },
  {
    entityId: 'tw-10th-army-corps',
    designation: '10th Army Corps (ROC)',
    affiliation: 'friendly',
    sidc: '10031000001211001400', // Land unit, infantry, division
    position: { lat: 24.80, lng: 120.97 },  // Hsinchu area
    confidence: 0.95,
    confidenceTier: 'high',
  },
  {
    entityId: 'tw-8th-army-corps',
    designation: '8th Army Corps (ROC)',
    affiliation: 'friendly',
    sidc: '10031000001211001400',
    position: { lat: 22.63, lng: 120.30 },  // Kaohsiung area
    confidence: 0.95,
    confidenceTier: 'high',
  },
  {
    entityId: 'tw-269-mech-bde',
    designation: '269th Mechanized Inf Bde (ROC)',
    affiliation: 'friendly',
    sidc: '10031000001211001200', // Brigade
    position: { lat: 24.15, lng: 120.68 },  // Taichung area
    confidence: 0.90,
    confidenceTier: 'high',
  },
  // Taiwan coastal defense
  {
    entityId: 'tw-coast-def-north',
    designation: 'Northern Coastal Defense Group',
    affiliation: 'friendly',
    sidc: '10031000001211001200',
    position: { lat: 25.15, lng: 121.74 },  // Keelung coast
    confidence: 0.90,
    confidenceTier: 'high',
  },
  // Taiwan air defense
  {
    entityId: 'tw-air-def-cmd',
    designation: 'Air Defense Missile Command (ROC)',
    affiliation: 'friendly',
    sidc: '10031000001407001400', // Air defense, corps
    position: { lat: 24.99, lng: 121.23 },  // Taoyuan area
    confidence: 0.90,
    confidenceTier: 'high',
  },
  // US Forces
  {
    entityId: 'us-7th-fleet-csg',
    designation: 'CSG-5 (USS Ronald Reagan)',
    affiliation: 'friendly',
    sidc: '10033000001301000000', // Sea surface, carrier
    position: { lat: 24.50, lng: 123.80 },  // East of Taiwan, Philippine Sea
    confidence: 0.85,
    confidenceTier: 'high',
  },
  {
    entityId: 'us-iii-mef',
    designation: 'III MEF (Okinawa)',
    affiliation: 'friendly',
    sidc: '10031000001211001600', // Land unit, army echelon
    position: { lat: 26.33, lng: 127.77 },  // Okinawa
    confidence: 0.90,
    confidenceTier: 'high',
  },
  {
    entityId: 'us-18th-wing',
    designation: '18th Wing (Kadena AB)',
    affiliation: 'friendly',
    sidc: '10030500001101001400', // Air, fixed wing
    position: { lat: 26.35, lng: 127.76 },  // Kadena
    confidence: 0.90,
    confidenceTier: 'high',
  },
];

// ── Adversary Forces (PLA Invasion) ──────────────────────────────────────────

const adversarySymbols: SymbolSpec[] = [
  // PLA Eastern Theater Command
  {
    entityId: 'pla-etc-hq',
    designation: 'Eastern Theater Command HQ',
    affiliation: 'enemy',
    sidc: '10061000001211001800', // Land unit, theater echelon
    position: { lat: 28.23, lng: 120.63 },  // Nanjing area
    confidence: 0.80,
    confidenceTier: 'medium',
  },
  // PLA amphibious staging
  {
    entityId: 'pla-73rd-group-army',
    designation: '73rd Group Army (Amphibious)',
    affiliation: 'enemy',
    sidc: '10061000001211001600', // Land unit, army echelon
    position: { lat: 26.05, lng: 119.31 },  // Fuzhou staging area
    confidence: 0.75,
    confidenceTier: 'medium',
  },
  {
    entityId: 'pla-71st-group-army',
    designation: '71st Group Army',
    affiliation: 'enemy',
    sidc: '10061000001211001600',
    position: { lat: 27.90, lng: 120.50 },  // Wenzhou area
    confidence: 0.70,
    confidenceTier: 'medium',
  },
  // PLA Navy — invasion fleet
  {
    entityId: 'pla-esf-amphib',
    designation: 'East Sea Fleet Amphibious Group',
    affiliation: 'enemy',
    sidc: '10063000001302000000', // Sea surface, amphibious
    position: { lat: 25.80, lng: 120.10 },  // Taiwan Strait, approaching
    confidence: 0.70,
    confidenceTier: 'medium',
  },
  {
    entityId: 'pla-ssf-destroyer-grp',
    designation: 'South Sea Fleet Surface Action Group',
    affiliation: 'enemy',
    sidc: '10063000001301000000', // Sea surface, combatant
    position: { lat: 23.50, lng: 119.50 },  // South of strait
    confidence: 0.65,
    confidenceTier: 'medium',
  },
  {
    entityId: 'pla-sub-wolfpack',
    designation: 'Submarine Patrol Group',
    affiliation: 'enemy',
    sidc: '10063500001301000000', // Subsurface
    position: { lat: 24.20, lng: 122.50 },  // East of Taiwan, interdiction
    confidence: 0.50,
    confidenceTier: 'low',
  },
  // PLA Air Force
  {
    entityId: 'pla-air-east',
    designation: 'PLAAF Eastern Theater Air Force',
    affiliation: 'enemy',
    sidc: '10060500001101001600', // Air, fixed wing, army
    position: { lat: 26.90, lng: 119.95 },  // Fujian airfields
    confidence: 0.75,
    confidenceTier: 'medium',
  },
  // PLA Rocket Force
  {
    entityId: 'pla-rocket-force-base',
    designation: 'PLARF Base 61 (DF-15/DF-16)',
    affiliation: 'enemy',
    sidc: '10061000001409001400', // Land unit, missile
    position: { lat: 27.50, lng: 118.80 },  // Jiangxi/Fujian border
    confidence: 0.65,
    confidenceTier: 'medium',
  },
  // Taipei landing force (tactical level — visible on zoom)
  {
    entityId: 'pla-marine-bde-taipei',
    designation: 'PLA Marine Brigade (Taipei Assault)',
    affiliation: 'enemy',
    sidc: '10061000001211001200', // Land unit, brigade
    position: { lat: 25.13, lng: 121.46 },  // Approaching Taipei coast
    confidence: 0.60,
    confidenceTier: 'medium',
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
        sourceAuthority: 'Pacific Strategy AY26 Exercise',
        assertedVia: 'exercise_seed',
        provenanceSummary: 'Pacific Strategy AY26 exercise scenario data',
      })),
      controlMeasures: [],
      customAnnotations: [],
      temporalPhases: [],
      metadata: {
        generatedBy: 'strategic-cop-seed',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: ['pacific-strategy-ay26'],
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
        sourceAuthority: 'Pacific Strategy AY26 Intelligence Assessment',
        assertedVia: 'exercise_seed',
        provenanceSummary: 'Pacific Strategy AY26 intelligence assessment (assessed)',
      })),
      controlMeasures: [],
      customAnnotations: [],
      temporalPhases: [],
      metadata: {
        generatedBy: 'strategic-cop-seed',
        generatedAt: new Date().toISOString(),
        sourceDocumentIds: ['pacific-strategy-ay26-intel'],
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
