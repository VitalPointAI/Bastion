/**
 * IPB Assembly Service
 *
 * Phase 14 Plan 03: Assembles Intelligence Preparation of the Battlefield (IPB)
 * assessments from extracted scenario documents.
 *
 * Supports 4 dual-perspective views:
 *   blue-own:             Blue forces' picture of their own capabilities
 *   blue-enemy_assessment: Blue forces' picture of Red (based on Blue intel)
 *   red-own:              Red forces' picture of their own capabilities
 *   red-enemy_assessment: Red forces' picture of Blue (based on Red intel)
 *
 * Overlay layers are GeoJSON-compatible for ValidityMap rendering with
 * MIL-STD-2525D SIDC codes.
 */

import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { IPBStore } from './ipb-store.js';
import type { ScenarioDocumentStore } from './document-store.js';
import type {
  IPBAssessment,
  IPBLayer,
  OAKOCAnalysis,
  NamedAreaOfInterest,
  ForceDisposition,
} from './types.js';
import type { LLMProvider, ProviderConfig } from '../strategic/extraction/providers/types.js';
import { OpenAICompatibleProvider } from '../strategic/extraction/providers/openai-provider.js';

// ─── Delta Summary ────────────────────────────────────────────────────────────

export interface DeltaSummary {
  changedFields: string[];
  addedUnits: string[];
  removedUnits: string[];
  significanceLevel: 'minor' | 'major' | 'critical';
}

// ─── SITREP Delta Preview ─────────────────────────────────────────────────────

/**
 * Preview of IPB changes that would result from incorporating a SITREP document.
 * Returned by previewIPBFromSITREP — does NOT commit any changes.
 * Matches the frontend SITREPDeltaPreview interface in frontend/src/types/exercise.ts.
 */
export interface SITREPDeltaPreview {
  changedFields: Array<{
    section: string;
    fieldPath: string;
    oldValue: unknown;
    newValue: unknown;
    changeType: 'added' | 'modified' | 'removed';
  }>;
  affectedCOAs: Array<{
    coaId: string;
    coaName: string;
    impactReason: string;
  }>;
  sitrepSummary: string;
}

// ─── LLM Extraction Shapes ────────────────────────────────────────────────────

interface ExtractedForceUnit {
  unitName: string;
  echelon: string;
  sidc: string;
  location: { lat: number; lng: number };
  strength: string;
  equipment: string;
}

interface ExtractedNAI {
  name: string;
  purpose: string;
  geometry: Record<string, unknown>;
  triggers: string;
}

interface ExtractedKeyTerrain {
  name: string;
  significance: string;
  geometry: Record<string, unknown>;
}

interface ExtractedAvenue {
  name: string;
  description: string;
  geometry: Record<string, unknown>;
}

interface IPBExtractionResult {
  areaOfOperations: Record<string, unknown>;
  terrainAnalysis: {
    observation: string;
    avenues: string;
    keyTerrain: string;
    obstacles: string;
    coverAndConcealment: string;
  };
  threatAssessment: string;
  civilConsiderations: string;
  namedAreasOfInterest: ExtractedNAI[];
  forceDispositions: ExtractedForceUnit[];
  keyTerrainFeatures: ExtractedKeyTerrain[];
  avenuesOfApproach: ExtractedAvenue[];
}

// ─── Default Theater Coordinates (Western Pacific) ───────────────────────────

const THEATER_DEFAULTS = {
  center: { lat: 20, lng: 125 },
  taiwanStrait: { lat: 24.5, lng: 120 },
  southChinaSea: { lat: 15, lng: 115 },
};

// Build a default area-of-operations GeoJSON Polygon for Indo-Pacific theater
function buildDefaultAOO(): Record<string, unknown> {
  // Western Pacific theater bounding box roughly covering Taiwan Strait + SCS
  return {
    type: 'Polygon',
    coordinates: [[
      [110, 5],    // SW
      [145, 5],    // SE
      [145, 35],   // NE
      [110, 35],   // NW
      [110, 5],    // close
    ]],
  };
}

// ─── SIDC Helpers ─────────────────────────────────────────────────────────────

/**
 * Build a MIL-STD-2525D SIDC with correct affiliation character
 * Position 2 (index 1): F=Friendly, H=Hostile, N=Neutral, U=Unknown
 */
function buildSIDC(
  requestingTeam: 'blue' | 'red',
  perspective: 'own' | 'enemy_assessment',
  echelon: string
): string {
  // Affiliation from the requestingTeam's point of view:
  //   own view → friendly affiliation
  //   enemy_assessment → hostile affiliation
  const affiliation = perspective === 'own' ? 'F' : 'H';

  // Echelon modifier (position 12): map free-text echelon to 2525D code
  const echelonMap: Record<string, string> = {
    team: 'A', squad: 'B', section: 'C', platoon: 'D', company: 'E',
    battalion: 'F', regiment: 'G', brigade: 'H', division: 'I',
    corps: 'J', army: 'K', 'army group': 'L', region: 'M',
    command: 'N', carrier: 'E', group: 'E',
  };
  const echelonCode = echelonMap[echelon.toLowerCase()] ?? 'E';

  // Standard unit symbol: S + affiliation + G (ground) + P (present) + U (unit)
  // Remaining positions padded: function id UCFB (ground unit), echelon, country, order
  return `S${affiliation}GPU------${echelonCode}-----`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class IPBService {
  private llm: LLMProvider;

  constructor(
    private readonly pool: Pool,
    private readonly ipbStore: IPBStore,
    private readonly documentStore: ScenarioDocumentStore,
    llmConfig: ProviderConfig
  ) {
    this.llm = new OpenAICompatibleProvider(llmConfig);
  }

  // ─── Core Assembly Method ──────────────────────────────────────────────────

  /**
   * Assemble an IPB assessment from extracted scenario documents.
   *
   * Perspective semantics:
   *   own           — uses documents belonging to `team` to describe own forces
   *   enemy_assessment — uses documents belonging to `team` (own intelligence) to
   *                      describe what the team believes about the opposing side
   *
   * Both perspectives read only the requesting team's documents.  The key
   * distinction is in the LLM prompt: "own" asks for a self-portrait;
   * "enemy_assessment" asks for an intelligence estimate of the adversary.
   */
  async assembleIPB(
    scenarioId: string,
    team: 'blue' | 'red',
    perspective: 'own' | 'enemy_assessment',
    exercisePhase: string,
    visibleTeams: string[]
  ): Promise<IPBAssessment> {
    // 1. Gather all documents visible to this team for this phase
    const allDocs = await this.documentStore.findByScenarioAndPhase(
      scenarioId,
      exercisePhase,
      visibleTeams
    );

    // 2. Filter: both 'own' and 'enemy_assessment' use the requesting team's own documents
    //    (enemy_assessment synthesizes what the team knows about the other side from
    //     their own intelligence reports — not the enemy's actual documents)
    const sourceDocs = allDocs.filter(doc => doc.team === team);

    // 3. Serialize extracted data for the LLM
    const docSummaries = sourceDocs.map(doc => ({
      type: doc.documentType,
      phase: doc.exercisePhase,
      content: doc.textContent.slice(0, 2000), // keep prompt tractable
      extracted: doc.extractedData,
      confidence: doc.extractionConfidence,
    }));

    const opposingTeam = team === 'blue' ? 'red' : 'blue';
    const perspectiveInstruction =
      perspective === 'own'
        ? `You are assembling a self-assessment of ${team.toUpperCase()} FORCES' own capabilities, positions, and plans based on their own documents.`
        : `You are assembling ${team.toUpperCase()} FORCES' intelligence estimate of ${opposingTeam.toUpperCase()} — what ${team.toUpperCase()} BELIEVES about the opposing side based on ${team.toUpperCase()}'s own intelligence reports. You do NOT have access to the actual opposing side's plans; you only know what ${team.toUpperCase()}'s intel has gathered.`;

    // 4. Call LLM to extract IPB components
    const prompt = `${perspectiveInstruction}

SCENARIO DOCUMENTS (${sourceDocs.length} documents):
${JSON.stringify(docSummaries, null, 2)}

THEATER DEFAULTS (Indo-Pacific / Western Pacific):
- Theater center: lat=20, lng=125
- Taiwan Strait focus: lat=24.5, lng=120
- South China Sea: lat=15, lng=115

Extract an IPB assessment in valid JSON matching this exact schema:
{
  "areaOfOperations": { GeoJSON Polygon covering the operational area },
  "terrainAnalysis": {
    "observation": "Observation and fields of fire analysis",
    "avenues": "Avenues of approach (ground and maritime)",
    "keyTerrain": "Key terrain description",
    "obstacles": "Obstacles (natural and man-made)",
    "coverAndConcealment": "Cover and concealment"
  },
  "threatAssessment": "Force composition, capabilities, likely COAs, vulnerabilities (2-4 paragraphs)",
  "civilConsiderations": "ASCOPE factors: Areas, Structures, Capabilities, Organizations, People, Events",
  "namedAreasOfInterest": [
    { "name": "NAI-1", "purpose": "Why we watch here", "geometry": { GeoJSON Point or Polygon }, "triggers": "What activity triggers action" }
  ],
  "forceDispositions": [
    { "unitName": "1st Marines", "echelon": "Division", "sidc": "", "location": {"lat": 24.5, "lng": 120}, "strength": "~15,000", "equipment": "M1A1, LAV-25" }
  ],
  "keyTerrainFeatures": [
    { "name": "Taiwan Strait", "significance": "Key maritime chokepoint", "geometry": { GeoJSON Polygon } }
  ],
  "avenuesOfApproach": [
    { "name": "Maritime Avenue Alpha", "description": "Northern strait approach", "geometry": { GeoJSON LineString } }
  ]
}

Use realistic Indo-Pacific geography. If the documents do not specify exact coordinates, use plausible Western Pacific coordinates consistent with the theater defaults above. Output ONLY valid JSON.`;

    let extraction: IPBExtractionResult;
    try {
      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: 'You are a military intelligence analyst. Output only valid JSON, no markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 4000,
        temperature: 0.2,
      });

      const raw = response.content ?? '{}';
      // Strip any markdown fences if the model added them
      const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
      extraction = JSON.parse(cleaned) as IPBExtractionResult;
    } catch (err) {
      // Fallback to minimal valid structure so downstream code can proceed
      console.error('[IPBService] LLM extraction failed, using fallback structure:', err);
      extraction = this.buildFallbackExtraction(team, perspective);
    }

    // 5. Build OAKOC terrain analysis
    const terrainAnalysis: OAKOCAnalysis = {
      observation: extraction.terrainAnalysis?.observation ?? '',
      avenues: extraction.terrainAnalysis?.avenues ?? '',
      keyTerrain: extraction.terrainAnalysis?.keyTerrain ?? '',
      obstacles: extraction.terrainAnalysis?.obstacles ?? '',
      coverAndConcealment: extraction.terrainAnalysis?.coverAndConcealment ?? '',
    };

    // 6. Build force dispositions
    const forceDispositions: ForceDisposition[] = (extraction.forceDispositions ?? []).map(unit => ({
      unitName: unit.unitName,
      unitType: unit.echelon,
      strength: unit.strength,
      position: {
        type: 'Point',
        coordinates: [unit.location?.lng ?? THEATER_DEFAULTS.center.lng, unit.location?.lat ?? THEATER_DEFAULTS.center.lat],
      },
      readiness: 'ready' as const,
      notes: unit.equipment,
    }));

    // 7. Build Named Areas of Interest
    const namedAreasOfInterest: NamedAreaOfInterest[] = (extraction.namedAreasOfInterest ?? []).map((nai, idx) => ({
      id: `nai-${idx + 1}`,
      name: nai.name,
      geometry: nai.geometry ?? { type: 'Point', coordinates: [THEATER_DEFAULTS.center.lng, THEATER_DEFAULTS.center.lat] },
      significance: nai.purpose ?? '',
      expectedActivity: nai.triggers ?? '',
    }));

    // 8. Generate overlay layers for ValidityMap rendering
    const overlayLayers = this.generateOverlayLayers(
      team,
      perspective,
      extraction,
      forceDispositions
    );

    // 9. Store and return
    const assessment = await this.ipbStore.create({
      scenarioId,
      team,
      perspective,
      exercisePhase,
      areaOfOperations: extraction.areaOfOperations ?? buildDefaultAOO(),
      terrainAnalysis,
      threatAssessment: extraction.threatAssessment ?? '',
      civilConsiderations: extraction.civilConsiderations ?? '',
      namedAreasOfInterest,
      forceDispositions,
      overlayLayers,
      version: 1,
      parentVersionId: null,
      createdBy: 'system',
    });

    return assessment;
  }

  // ─── Update from SITREP ────────────────────────────────────────────────────

  /**
   * Update an existing IPB assessment when a new SITREP arrives.
   * Compares SITREP content against current assessment and produces a new version.
   */
  async updateIPBFromSITREP(
    assessmentId: string,
    sitrepDocId: string,
    visibleTeams: string[]
  ): Promise<IPBAssessment> {
    // Load existing assessment
    const existing = await this.ipbStore.findById(assessmentId, visibleTeams);
    if (!existing) {
      throw new Error(`IPB assessment ${assessmentId} not found or not visible`);
    }

    // Load the SITREP document
    const sitrep = await this.documentStore.findById(sitrepDocId, visibleTeams);
    if (!sitrep) {
      throw new Error(`SITREP document ${sitrepDocId} not found or not visible`);
    }

    // Use LLM to identify deltas between existing assessment and SITREP
    const deltaPrompt = `You are a military intelligence analyst reviewing a new SITREP.

EXISTING IPB ASSESSMENT:
Threat Assessment: ${existing.threatAssessment}
Force Dispositions: ${JSON.stringify(existing.forceDispositions, null, 2)}
Named Areas of Interest: ${JSON.stringify(existing.namedAreasOfInterest, null, 2)}

NEW SITREP DOCUMENT:
Type: ${sitrep.documentType}
Content: ${sitrep.textContent.slice(0, 3000)}
Extracted Data: ${JSON.stringify(sitrep.extractedData, null, 2)}

Identify what has changed. Output JSON:
{
  "updatedThreatAssessment": "...",
  "updatedForceDispositions": [...],
  "updatedNAIs": [...]
}

Only include fields that have actually changed based on the SITREP. Preserve existing data where the SITREP provides no update. Output only valid JSON.`;

    let updates: Partial<{
      updatedThreatAssessment: string;
      updatedForceDispositions: ExtractedForceUnit[];
      updatedNAIs: ExtractedNAI[];
    }> = {};

    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: 'You are a military intelligence analyst. Output only valid JSON.' },
          { role: 'user', content: deltaPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });
      const raw = response.content ?? '{}';
      const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
      updates = JSON.parse(cleaned);
    } catch (err) {
      console.error('[IPBService] SITREP delta extraction failed:', err);
      // No updates — create new version with same data
    }

    // Build updated force dispositions if present
    const updatedForceDispositions: ForceDisposition[] = updates.updatedForceDispositions
      ? updates.updatedForceDispositions.map(unit => ({
          unitName: unit.unitName,
          unitType: unit.echelon,
          strength: unit.strength,
          position: {
            type: 'Point',
            coordinates: [
              unit.location?.lng ?? THEATER_DEFAULTS.center.lng,
              unit.location?.lat ?? THEATER_DEFAULTS.center.lat,
            ],
          },
          readiness: 'ready' as const,
          notes: unit.equipment,
        }))
      : existing.forceDispositions;

    const updatedNAIs: NamedAreaOfInterest[] = updates.updatedNAIs
      ? updates.updatedNAIs.map((nai, idx) => ({
          id: `nai-${idx + 1}`,
          name: nai.name,
          geometry: nai.geometry ?? { type: 'Point', coordinates: [THEATER_DEFAULTS.center.lng, THEATER_DEFAULTS.center.lat] },
          significance: nai.purpose ?? '',
          expectedActivity: nai.triggers ?? '',
        }))
      : existing.namedAreasOfInterest;

    // Create a new version
    const newVersion = await this.ipbStore.createNewVersion(assessmentId, {
      threatAssessment: updates.updatedThreatAssessment ?? existing.threatAssessment,
      forceDispositions: updatedForceDispositions,
      namedAreasOfInterest: updatedNAIs,
      createdBy: 'system',
    });

    return newVersion;
  }

  // ─── Preview SITREP Delta (no persist) ─────────────────────────────────────

  /**
   * Preview the IPB delta that would result from incorporating a SITREP document
   * WITHOUT creating a new version. Staff reviews the SITREPDeltaPreview before
   * deciding to confirm (via updateIPBFromSITREP) or cancel.
   *
   * Reuses the same LLM delta extraction logic as updateIPBFromSITREP but
   * stops before calling ipbStore.createNewVersion().
   */
  async previewIPBFromSITREP(
    assessmentId: string,
    sitrepDocId: string,
    visibleTeams: string[]
  ): Promise<SITREPDeltaPreview> {
    // 1. Load existing assessment
    const existing = await this.ipbStore.findById(assessmentId, visibleTeams);
    if (!existing) {
      throw new Error(`IPB assessment ${assessmentId} not found or not visible`);
    }

    // 2. Load the SITREP document
    const sitrep = await this.documentStore.findById(sitrepDocId, visibleTeams);
    if (!sitrep) {
      throw new Error(`SITREP document ${sitrepDocId} not found or not visible`);
    }

    // 3. Use LLM to identify deltas between existing assessment and SITREP
    const deltaPrompt = `You are a military intelligence analyst reviewing a new SITREP.

EXISTING IPB ASSESSMENT:
Threat Assessment: ${existing.threatAssessment}
Force Dispositions: ${JSON.stringify(existing.forceDispositions, null, 2)}
Named Areas of Interest: ${JSON.stringify(existing.namedAreasOfInterest, null, 2)}

NEW SITREP DOCUMENT:
Type: ${sitrep.documentType}
Content: ${sitrep.textContent.slice(0, 3000)}
Extracted Data: ${JSON.stringify(sitrep.extractedData, null, 2)}

Identify what has changed. Output JSON:
{
  "updatedThreatAssessment": "...",
  "updatedForceDispositions": [...],
  "updatedNAIs": [...]
}

Only include fields that have actually changed based on the SITREP. Preserve existing data where the SITREP provides no update. Output only valid JSON.`;

    let updates: Partial<{
      updatedThreatAssessment: string;
      updatedForceDispositions: ExtractedForceUnit[];
      updatedNAIs: ExtractedNAI[];
    }> = {};

    try {
      const response = await this.llm.complete({
        messages: [
          { role: 'system', content: 'You are a military intelligence analyst. Output only valid JSON.' },
          { role: 'user', content: deltaPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.1,
      });
      const raw = response.content ?? '{}';
      const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
      updates = JSON.parse(cleaned);
    } catch (err) {
      console.error('[IPBService] SITREP delta extraction failed (preview):', err);
      // Proceed with empty updates — preview will show no changes
    }

    // 4. Build updated force dispositions and NAIs from LLM response (same as updateIPBFromSITREP)
    const updatedForceDispositions: ForceDisposition[] = updates.updatedForceDispositions
      ? updates.updatedForceDispositions.map(unit => ({
          unitName: unit.unitName,
          unitType: unit.echelon,
          strength: unit.strength,
          position: {
            type: 'Point',
            coordinates: [
              unit.location?.lng ?? THEATER_DEFAULTS.center.lng,
              unit.location?.lat ?? THEATER_DEFAULTS.center.lat,
            ],
          },
          readiness: 'ready' as const,
          notes: unit.equipment,
        }))
      : existing.forceDispositions;

    const updatedNAIs: NamedAreaOfInterest[] = updates.updatedNAIs
      ? updates.updatedNAIs.map((nai, idx) => ({
          id: `nai-${idx + 1}`,
          name: nai.name,
          geometry: nai.geometry ?? { type: 'Point', coordinates: [THEATER_DEFAULTS.center.lng, THEATER_DEFAULTS.center.lat] },
          significance: nai.purpose ?? '',
          expectedActivity: nai.triggers ?? '',
        }))
      : existing.namedAreasOfInterest;

    // 5. Build a synthetic assessment-shaped object to pass to generateDeltaSummary
    //    (Only the fields that generateDeltaSummary inspects are required)
    const syntheticNew: IPBAssessment = {
      ...existing,
      threatAssessment: updates.updatedThreatAssessment ?? existing.threatAssessment,
      forceDispositions: updatedForceDispositions,
      namedAreasOfInterest: updatedNAIs,
      civilConsiderations: existing.civilConsiderations,
    };

    const delta = this.generateDeltaSummary(existing, syntheticNew);

    // 6. Convert DeltaSummary into the SITREPDeltaPreview.changedFields array
    const changedFields: SITREPDeltaPreview['changedFields'] = [];

    for (const field of delta.changedFields) {
      const section = field.split(':')[0];
      if (field === 'threatAssessment') {
        changedFields.push({
          section: 'threatAssessment',
          fieldPath: 'threatAssessment',
          oldValue: existing.threatAssessment,
          newValue: syntheticNew.threatAssessment,
          changeType: 'modified',
        });
      } else if (field === 'civilConsiderations') {
        changedFields.push({
          section: 'civilConsiderations',
          fieldPath: 'civilConsiderations',
          oldValue: existing.civilConsiderations,
          newValue: syntheticNew.civilConsiderations,
          changeType: 'modified',
        });
      } else if (field === 'namedAreasOfInterest') {
        changedFields.push({
          section: 'namedAreasOfInterest',
          fieldPath: 'namedAreasOfInterest',
          oldValue: existing.namedAreasOfInterest,
          newValue: syntheticNew.namedAreasOfInterest,
          changeType: 'modified',
        });
      } else {
        // forceDisposition:unitName:position or forceDisposition:unitName:strength
        const parts = field.split(':');
        changedFields.push({
          section,
          fieldPath: field,
          oldValue: existing.forceDispositions.find(u => u.unitName === parts[1]) ?? null,
          newValue: syntheticNew.forceDispositions.find(u => u.unitName === parts[1]) ?? null,
          changeType: 'modified',
        });
      }
    }

    for (const unitName of delta.addedUnits) {
      changedFields.push({
        section: 'forceDispositions',
        fieldPath: `forceDispositions:${unitName}`,
        oldValue: null,
        newValue: syntheticNew.forceDispositions.find(u => u.unitName === unitName) ?? null,
        changeType: 'added',
      });
    }

    for (const unitName of delta.removedUnits) {
      changedFields.push({
        section: 'forceDispositions',
        fieldPath: `forceDispositions:${unitName}`,
        oldValue: existing.forceDispositions.find(u => u.unitName === unitName) ?? null,
        newValue: null,
        changeType: 'removed',
      });
    }

    // 7. Query affected COAs for the same scenario+team
    const impactReason = delta.significanceLevel === 'critical'
      ? 'IPB changes are critical — new or removed units detected'
      : delta.significanceLevel === 'major'
        ? 'IPB threat assessment or force positions changed (major)'
        : 'IPB minor updates — unit strength or equipment changed';

    let affectedCOAs: SITREPDeltaPreview['affectedCOAs'] = [];
    try {
      const coaResult = await this.pool.query<{ id: string; name: string }>(
        `SELECT id, name FROM scenario_coas
         WHERE scenario_id = $1 AND team = $2 AND team = ANY($3::text[])`,
        [existing.scenarioId, existing.team, visibleTeams]
      );
      affectedCOAs = coaResult.rows.map(row => ({
        coaId: row.id,
        coaName: row.name,
        impactReason,
      }));
    } catch (err) {
      console.error('[IPBService] Failed to query affected COAs:', err);
      // Non-fatal — return empty affected COAs list
    }

    // 8. Build sitrepSummary from SITREP text content
    const sitrepSummary = sitrep.textContent.slice(0, 500);

    // 9. Return the SITREPDeltaPreview — do NOT call ipbStore.createNewVersion()
    return {
      changedFields,
      affectedCOAs,
      sitrepSummary,
    };
  }

  // ─── Delta Summary ─────────────────────────────────────────────────────────

  /**
   * Compare two IPB assessment versions and classify the significance of changes.
   *
   * Significance rules:
   *   critical — new hostile unit detected OR friendly unit removed from force disposition
   *   major    — changes to force disposition positions OR threat COA description
   *   minor    — changes to unit strength or equipment only
   */
  generateDeltaSummary(oldAssessment: IPBAssessment, newAssessment: IPBAssessment): DeltaSummary {
    const changedFields: string[] = [];
    const addedUnits: string[] = [];
    const removedUnits: string[] = [];

    // Compare threat assessment text (simple hash comparison)
    if (
      createHash('sha256').update(oldAssessment.threatAssessment).digest('hex') !==
      createHash('sha256').update(newAssessment.threatAssessment).digest('hex')
    ) {
      changedFields.push('threatAssessment');
    }

    // Compare civil considerations
    if (oldAssessment.civilConsiderations !== newAssessment.civilConsiderations) {
      changedFields.push('civilConsiderations');
    }

    // Compare force dispositions
    const oldUnits = new Map(oldAssessment.forceDispositions.map(u => [u.unitName, u]));
    const newUnits = new Map(newAssessment.forceDispositions.map(u => [u.unitName, u]));

    for (const [name] of newUnits) {
      if (!oldUnits.has(name)) addedUnits.push(name);
    }
    for (const [name] of oldUnits) {
      if (!newUnits.has(name)) removedUnits.push(name);
    }

    // Check for position changes among shared units
    let positionChanged = false;
    for (const [name, newUnit] of newUnits) {
      const oldUnit = oldUnits.get(name);
      if (!oldUnit) continue;
      const oldPos = JSON.stringify(oldUnit.position);
      const newPos = JSON.stringify(newUnit.position);
      if (oldPos !== newPos) {
        positionChanged = true;
        changedFields.push(`forceDisposition:${name}:position`);
      } else if (oldUnit.strength !== newUnit.strength || oldUnit.notes !== newUnit.notes) {
        changedFields.push(`forceDisposition:${name}:strength`);
      }
    }

    // Compare NAIs
    const oldNAIIds = new Set(oldAssessment.namedAreasOfInterest.map(n => n.id));
    const newNAIIds = new Set(newAssessment.namedAreasOfInterest.map(n => n.id));
    if (
      oldNAIIds.size !== newNAIIds.size ||
      [...oldNAIIds].some(id => !newNAIIds.has(id))
    ) {
      changedFields.push('namedAreasOfInterest');
    }

    // Determine significance
    let significanceLevel: DeltaSummary['significanceLevel'] = 'minor';

    if (removedUnits.length > 0 || addedUnits.length > 0) {
      significanceLevel = 'critical';
    } else if (changedFields.includes('threatAssessment') || positionChanged) {
      significanceLevel = 'major';
    }

    return { changedFields, addedUnits, removedUnits, significanceLevel };
  }

  // ─── Overlay Layer Generation ──────────────────────────────────────────────

  /**
   * Convert IPB extraction results into IPBLayer[] for ValidityMap rendering.
   *
   * Layer mapping:
   *   force units      → type='unit', layerType='forces', GeoJSON Point
   *   key terrain      → type='area', layerType='key_terrain', GeoJSON Polygon
   *   avenues          → type='line', layerType='avenue_of_approach', GeoJSON LineString
   *   NAIs             → type='point'|'area', layerType='nai', GeoJSON from NAI
   */
  private generateOverlayLayers(
    team: 'blue' | 'red',
    perspective: 'own' | 'enemy_assessment',
    extraction: IPBExtractionResult,
    forceDispositions: ForceDisposition[]
  ): IPBLayer[] {
    const layers: IPBLayer[] = [];

    // Force disposition units
    forceDispositions.forEach((unit, idx) => {
      const rawUnit = extraction.forceDispositions?.[idx];
      const echelon = rawUnit?.echelon ?? 'Company';
      const sidc = rawUnit?.sidc || buildSIDC(team, perspective, echelon);

      layers.push({
        id: `layer-unit-${idx}`,
        name: unit.unitName,
        type: 'unit',
        team,
        layerType: 'forces',
        geometry: unit.position,
        properties: {
          strength: unit.strength,
          equipment: unit.notes ?? '',
          readiness: unit.readiness,
          echelon,
        },
        sidc,
      });
    });

    // Key terrain features → polygon areas
    (extraction.keyTerrainFeatures ?? []).forEach((terrain, idx) => {
      layers.push({
        id: `layer-kt-${idx}`,
        name: terrain.name,
        type: 'area',
        team,
        layerType: 'key_terrain',
        geometry: terrain.geometry ?? buildDefaultAOO(),
        properties: {
          significance: terrain.significance,
        },
      });
    });

    // Avenues of approach → lines
    (extraction.avenuesOfApproach ?? []).forEach((avenue, idx) => {
      layers.push({
        id: `layer-aa-${idx}`,
        name: avenue.name,
        type: 'line',
        team,
        layerType: 'avenue_of_approach',
        geometry: avenue.geometry ?? {
          type: 'LineString',
          coordinates: [
            [THEATER_DEFAULTS.taiwanStrait.lng, THEATER_DEFAULTS.taiwanStrait.lat],
            [THEATER_DEFAULTS.center.lng, THEATER_DEFAULTS.center.lat],
          ],
        },
        properties: {
          description: avenue.description,
        },
      });
    });

    // Named Areas of Interest
    (extraction.namedAreasOfInterest ?? []).forEach((nai, idx) => {
      const geomType = (nai.geometry?.type as string | undefined) ?? 'Point';
      const layerType: IPBLayer['type'] = geomType === 'Point' ? 'point' : 'area';

      layers.push({
        id: `layer-nai-${idx}`,
        name: nai.name,
        type: layerType,
        team,
        layerType: 'nai',
        geometry: nai.geometry ?? {
          type: 'Point',
          coordinates: [THEATER_DEFAULTS.center.lng, THEATER_DEFAULTS.center.lat],
        },
        properties: {
          purpose: nai.purpose,
          triggers: nai.triggers,
        },
      });
    });

    return layers;
  }

  // ─── Fallback Extraction ───────────────────────────────────────────────────

  private buildFallbackExtraction(
    team: 'blue' | 'red',
    perspective: 'own' | 'enemy_assessment'
  ): IPBExtractionResult {
    return {
      areaOfOperations: buildDefaultAOO(),
      terrainAnalysis: {
        observation: 'Indo-Pacific theater — maritime and island-chain terrain limits ground observation; air and naval sensors primary.',
        avenues: 'Key maritime avenues: Taiwan Strait (narrow, monitored), Philippine Sea (broad, open), South China Sea (semi-enclosed).',
        keyTerrain: 'Taiwan island, Luzon Strait, first island chain chokepoints.',
        obstacles: 'Natural: shallow reefs (SCS), typhoon weather, island-chain separation. Man-made: naval minefields possible.',
        coverAndConcealment: 'Limited for surface forces in open ocean; island chains provide radar shadow corridors.',
      },
      threatAssessment:
        perspective === 'own'
          ? `${team.toUpperCase()} forces maintain readiness posture in the Western Pacific. Detailed assessment pending document extraction.`
          : `Assessment of opposing forces based on available ${team.toUpperCase()} intelligence. Detailed assessment pending document extraction.`,
      civilConsiderations: 'Dense civilian populations on Taiwan, Philippines, Japan. Critical infrastructure: ports, airfields, undersea cables.',
      namedAreasOfInterest: [
        {
          name: 'NAI-1',
          purpose: 'Monitor Taiwan Strait crossing indicators',
          geometry: { type: 'Point', coordinates: [120.0, 24.5] },
          triggers: 'Amphibious assault preparation, naval massing',
        },
      ],
      forceDispositions: [],
      keyTerrainFeatures: [
        {
          name: 'Taiwan Strait',
          significance: 'Critical maritime chokepoint — control determines sea lines of communication',
          geometry: {
            type: 'Polygon',
            coordinates: [[[118, 22], [122, 22], [122, 27], [118, 27], [118, 22]]],
          },
        },
      ],
      avenuesOfApproach: [
        {
          name: 'Maritime AA-1 (Northern Strait)',
          description: 'Northern entrance to Taiwan Strait from East China Sea',
          geometry: {
            type: 'LineString',
            coordinates: [[121, 28], [121, 25], [120, 23]],
          },
        },
      ],
    };
  }
}
