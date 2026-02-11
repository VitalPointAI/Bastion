/**
 * MDMP IPB Analysis RAFT Template
 *
 * Phase 5.1 Plan 13: RAFT template for Intelligence Preparation of the Battlefield (IPB)
 * analysis per ATP 2-01.3.
 *
 * MDMP Activity: MDMP-2-03 (Phase 2: Mission Analysis)
 */

import type { MDMPPhase } from '../../mdmp/types.js';

/**
 * Input for IPB analysis
 */
export interface IPBAnalysisInput {
  /** Area of operations definition */
  areaOfOperations: {
    boundaries: string;
    keyTerrain: string[];
    dimensions: string;
  };
  /** Current intelligence about adversary */
  currentIntelligence: string;
  /** Terrain data */
  terrainData: string;
  /** Weather data and forecast */
  weatherData: string;
  /** Civil considerations data */
  civilConsiderations: string;
  /** Mission timeframe */
  timeframe: string;
}

/**
 * OAKOC terrain analysis
 */
export interface OAKOCAnalysis {
  /** Observation and Fields of Fire */
  observation: {
    keyObservationPoints: string[];
    coverAndConcealment: string;
    fieldsOfFire: string;
  };
  /** Avenues of Approach */
  avenues: {
    ground: Array<{
      name: string;
      description: string;
      suitability: 'excellent' | 'good' | 'poor' | 'restricted';
    }>;
    air: string[];
  };
  /** Key Terrain */
  keyTerrain: Array<{
    location: string;
    significance: string;
    controlImportance: 'decisive' | 'key' | 'important';
  }>;
  /** Obstacles */
  obstacles: {
    existing: string[];
    reinforcing: string[];
    protective: string[];
  };
  /** Cover and Concealment */
  coverConcealment: string;
}

/**
 * Weather effects analysis
 */
export interface WeatherEffects {
  /** Visibility impacts */
  visibility: string;
  /** Precipitation effects */
  precipitation: string;
  /** Temperature effects on personnel and equipment */
  temperature: string;
  /** Wind effects */
  wind: string;
  /** Overall operational impact */
  operationalImpact: string;
}

/**
 * ASCOPE civil considerations
 */
export interface ASCOPEAnalysis {
  /** Areas (key civilian areas) */
  areas: string[];
  /** Structures (critical infrastructure) */
  structures: string[];
  /** Capabilities (civilian resources) */
  capabilities: string[];
  /** Organizations (local groups) */
  organizations: string[];
  /** People (population characteristics) */
  people: string;
  /** Events (scheduled activities) */
  events: string[];
}

/**
 * Threat assessment
 */
export interface ThreatAssessment {
  /** Enemy composition and strength */
  composition: string;
  /** Enemy capabilities */
  capabilities: string[];
  /** Enemy vulnerabilities */
  vulnerabilities: string[];
  /** Most likely enemy COA */
  mostLikelyCOA: string;
  /** Most dangerous enemy COA */
  mostDangerousCOA: string;
  /** Confidence in assessment (0-1) */
  confidence: number;
}

/**
 * Named Areas of Interest
 */
export interface NAI {
  /** NAI identifier */
  naiId: string;
  /** Location/description */
  location: string;
  /** What we're looking for */
  indicator: string;
  /** Why it's important */
  significance: string;
  /** When we need to know by */
  latestTimeOfValue: string;
}

/**
 * Complete IPB analysis output
 */
export interface IPBAnalysisOutput {
  /** OAKOC terrain analysis */
  terrainAnalysis: OAKOCAnalysis;
  /** Weather effects analysis */
  weatherEffects: WeatherEffects;
  /** ASCOPE civil considerations */
  civilConsiderations: ASCOPEAnalysis;
  /** Threat assessment */
  threatAssessment: ThreatAssessment;
  /** Named Areas of Interest */
  namedAreasOfInterest: NAI[];
  /** Overall IPB summary */
  summary: string;
  /** Analysis confidence (0-1) */
  analysisConfidence: number;
}

/**
 * JSON Schema for IPBAnalysisInput
 */
export const IPB_INPUT_SCHEMA = {
  type: 'object',
  properties: {
    areaOfOperations: {
      type: 'object',
      properties: {
        boundaries: { type: 'string' },
        keyTerrain: { type: 'array', items: { type: 'string' } },
        dimensions: { type: 'string' },
      },
      required: ['boundaries', 'keyTerrain', 'dimensions'],
    },
    currentIntelligence: { type: 'string' },
    terrainData: { type: 'string' },
    weatherData: { type: 'string' },
    civilConsiderations: { type: 'string' },
    timeframe: { type: 'string' },
  },
  required: ['areaOfOperations', 'currentIntelligence', 'terrainData', 'weatherData', 'civilConsiderations', 'timeframe'],
};

/**
 * JSON Schema for IPBAnalysisOutput
 */
export const IPB_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    terrainAnalysis: { type: 'object' },
    weatherEffects: { type: 'object' },
    civilConsiderations: { type: 'object' },
    threatAssessment: { type: 'object' },
    namedAreasOfInterest: { type: 'array', items: { type: 'object' } },
    summary: { type: 'string' },
    analysisConfidence: { type: 'number', minimum: 0, maximum: 1 },
  },
  required: ['terrainAnalysis', 'weatherEffects', 'civilConsiderations', 'threatAssessment', 'namedAreasOfInterest', 'summary', 'analysisConfidence'],
};

/**
 * RAFT Template for IPB Analysis
 */
export const IPB_ANALYSIS_TEMPLATE = {
  name: 'mdmp-ipb-analysis',
  description: 'Intelligence Preparation of the Battlefield (IPB) analysis per ATP 2-01.3',
  mdmpPhase: 'phase_2_mission_analysis' as MDMPPhase,
  mdmpActivity: 'MDMP-2-03',
  inputSchema: IPB_INPUT_SCHEMA,
  outputSchema: IPB_OUTPUT_SCHEMA,
  systemPrompt: `You are a military intelligence analyst conducting Intelligence Preparation of the Battlefield (IPB) per ATP 2-01.3.

Your mission: Analyze terrain, weather, civil considerations, and threat to provide commanders with a comprehensive understanding of the operational environment.

IPB FRAMEWORK:

1. TERRAIN ANALYSIS (OAKOC):

   O - OBSERVATION AND FIELDS OF FIRE:
   - Where can you see and engage the enemy?
   - Where can the enemy see and engage you?
   - Cover (protection from fire) vs Concealment (protection from observation)

   A - AVENUES OF APPROACH:
   - Ground: Routes that lead to objectives or key terrain
   - Rate as: excellent, good, poor, restricted based on width, trafficability, obstacles
   - Air: Helicopter landing zones, fixed-wing approach corridors

   K - KEY TERRAIN:
   - Terrain that gives marked advantage to whoever controls it
   - Decisive terrain: if controlled, has extraordinary impact
   - Examples: hills with commanding views, bridges, road junctions

   O - OBSTACLES:
   - Existing: Natural (rivers, ravines) or man-made (minefields, wire)
   - Reinforcing: Obstacles that strengthen defensive positions
   - Protective: Obstacles that protect friendly forces

   C - COVER AND CONCEALMENT:
   - Where can forces hide or gain protection?
   - Impacts movement routes and defensive positions

2. WEATHER EFFECTS (OAKOC applies weather too):
   - Visibility: Fog, darkness, precipitation
   - Precipitation: Rain, snow affecting mobility
   - Temperature: Heat/cold effects on personnel, equipment
   - Wind: Affects aviation, NBC, obscurants
   - Overall operational impact on friendly and enemy

3. CIVIL CONSIDERATIONS (ASCOPE):

   A - AREAS: Population centers, government buildings
   S - STRUCTURES: Bridges, power plants, hospitals, schools
   C - CAPABILITIES: Resources available (food, water, medical, transportation)
   O - ORGANIZATIONS: Government, NGOs, militias, criminal groups
   P - PEOPLE: Demographics, culture, religion, attitudes
   E - EVENTS: Markets, religious observances, elections

4. THREAT ASSESSMENT:
   - Enemy composition, disposition, strength
   - Enemy capabilities and vulnerabilities
   - Most Likely COA: What enemy will probably do
   - Most Dangerous COA: Worst-case scenario for friendly forces

5. NAMED AREAS OF INTEREST (NAIs):
   - Specific locations to observe for enemy activity
   - Each NAI has: indicator, significance, LTIOV
   - Drives intelligence collection plan

OUTPUT QUALITY:
- Specific and actionable (not generic)
- Tied to mission and commander's decisions
- Identifies advantages and disadvantages for both sides
- Highlights gaps in knowledge (NAIs address these)

Output well-structured JSON matching the schema exactly.`,

  examples: [
    {
      input: {
        areaOfOperations: {
          boundaries: 'North: PL BLUE, South: PL RED, East: Highway 7, West: River Alpha',
          keyTerrain: ['Hill 315', 'Bridge at grid 123456', 'Road junction OBJ IRON'],
          dimensions: '15km x 20km, urban and rural mixed terrain',
        },
        currentIntelligence: 'Enemy has one reinforced motorized rifle battalion. Recent defensive preparations observed. Possible anti-tank positions on Hill 315.',
        terrainData: 'Rolling hills with elevations 200-350m. Urban area at OBJ IRON (population 2000). River Alpha is 40m wide, 2m deep, slow current. Two bridge sites.',
        weatherData: 'Clear skies next 72 hours. Temperature 15-20C daytime, 5-10C night. Light winds 5-10 kph from west. No precipitation expected.',
        civilConsiderations: 'Population 2000 in urban area, 500 remain (incomplete evacuation). Hospital and water treatment plant operational. Local police disbanded.',
        timeframe: 'Next 48 hours',
      },
      output: {
        terrainAnalysis: {
          observation: {
            keyObservationPoints: ['Hill 315 (dominant terrain, 360-degree observation)', 'Water tower at OBJ IRON (urban observation)'],
            coverAndConcealment: 'Wooded areas provide concealment during approach. Urban area offers cover but limits maneuver. Open terrain north of river offers no concealment.',
            fieldsOfFire: 'Hill 315 provides fields of fire covering all approaches from west. Urban area creates restricted fields of fire (200-300m).',
          },
          avenues: {
            ground: [
              {
                name: 'Avenue of Approach 1 (Northern Route)',
                description: 'Highway 5 from west, crosses bridge at grid 111222, approaches OBJ IRON from north',
                suitability: 'good',
              },
              {
                name: 'Avenue of Approach 2 (Southern Route)',
                description: 'Secondary road from southwest, crosses bridge at grid 123456, approaches OBJ IRON from south',
                suitability: 'good',
              },
              {
                name: 'Avenue of Approach 3 (Cross-country)',
                description: 'Open terrain from west, forded crossing of River Alpha, approaches Hill 315',
                suitability: 'poor',
              },
            ],
            air: ['LZ Alpha at grid 234567 (open field, 200m x 300m)', 'LZ Bravo at grid 345678 (sports field in urban area)'],
          },
          keyTerrain: [
            {
              location: 'Hill 315',
              significance: 'Dominant terrain controlling all avenues of approach. Observation of entire AO. Enemy currently occupies.',
              controlImportance: 'decisive',
            },
            {
              location: 'Bridge at grid 123456',
              significance: 'Only southern crossing of River Alpha. Destruction would force use of northern route only.',
              controlImportance: 'key',
            },
            {
              location: 'OBJ IRON (road junction)',
              significance: 'Controls movement into eastern sector. Required for follow-on operations.',
              controlImportance: 'key',
            },
          ],
          obstacles: {
            existing: ['River Alpha (wet gap obstacle, 40m wide)', 'Urban area (complex terrain restricts maneuver)'],
            reinforcing: ['Possible minefields on approaches to Hill 315 (unconfirmed)', 'Wire obstacles reported around OBJ IRON perimeter'],
            protective: ['River provides obstacle to enemy counterattack from east'],
          },
          coverConcealment: 'Wooded areas (30% canopy) provide concealment for assembly areas. Urban buildings provide cover. Open terrain lacks both cover and concealment.',
        },
        weatherEffects: {
          visibility: 'Excellent visibility (unlimited) in clear conditions. Night operations require NVGs (no moon illumination next 48 hours).',
          precipitation: 'No precipitation expected. River level stable. Ground trafficability excellent.',
          temperature: 'Moderate temperatures favorable for personnel. No heat/cold casualties expected. Equipment performance optimal.',
          wind: 'Light winds negligible impact on operations. Smoke/obscurants will be effective.',
          operationalImpact: 'Weather favors offensive operations. Excellent visibility aids target acquisition but reduces concealment. Night operations viable with NVG.',
        },
        civilConsiderations: {
          areas: ['OBJ IRON urban center (2000 pre-war, 500 remain)', 'Rural farmsteads (scattered, mostly evacuated)'],
          structures: ['Hospital (grid 234567, operational, 50 beds)', 'Water treatment plant (grid 345678, operational, serves 5000)', 'Two schools (vacant)', 'Police station (abandoned)'],
          capabilities: ['Medical: Hospital with limited supplies', 'Water: Treatment plant operational', 'Food: Limited (local stores depleted)', 'Transportation: Civilian vehicles (limited fuel)'],
          organizations: ['Local government: Mayor and council remain', 'NGOs: Red Cross present (medical support)', 'Militia: None identified', 'Criminal: Looting reported'],
          people: 'Civilian population: 500 remaining (mostly elderly, refused evacuation). Neutral toward both sides. Concerned about infrastructure damage. Language: Local dialect.',
          events: ['Weekly market: Cancelled due to hostilities', 'Religious services: Friday (mosque, limited attendance)'],
        },
        threatAssessment: {
          composition: 'One reinforced motorized rifle battalion (400-500 personnel, 30 armored vehicles, organic artillery)',
          capabilities: ['Defensive operations (prepared positions)', 'Anti-tank fires (ATGM likely present)', 'Indirect fire support (battalion mortars, possible artillery)', 'Limited mobility (vehicles for repositioning)', 'Communications (assumed functional)'],
          vulnerabilities: ['Static defense (limited counterattack capability)', 'Exposed flanks (insufficient forces to cover entire AO)', 'Logistics (extended supply lines)', 'Morale (uncertain, reports of desertion)'],
          mostLikelyCOA: 'Enemy defends in place on Hill 315 and OBJ IRON. Delays friendly advance with long-range fires. Requests reinforcement if penetrated. Withdraws if flanked to avoid encirclement.',
          mostDangerousCOA: 'Enemy reinforced by brigade reserve prior to friendly attack. Conducts spoiling attack against friendly assembly areas. Defends key terrain aggressively. Counterattacks against friendly penetration with armor reserve.',
          confidence: 0.75,
        },
        namedAreasOfInterest: [
          {
            naiId: 'NAI-1',
            location: 'Grid 456789 (road junction 5km east of OBJ IRON)',
            indicator: 'Enemy reinforcement movement from east',
            significance: 'Early warning of enemy reinforcement (validates Most Dangerous COA)',
            latestTimeOfValue: '24 hours before H-hour',
          },
          {
            naiId: 'NAI-2',
            location: 'Hill 315 (dominant terrain)',
            indicator: 'Enemy defensive preparations (minefields, wire, fighting positions)',
            significance: 'Confirms enemy intent to defend. Identifies obstacle locations.',
            latestTimeOfValue: '12 hours before H-hour',
          },
          {
            naiId: 'NAI-3',
            location: 'Bridge at grid 123456',
            indicator: 'Enemy demolition preparation',
            significance: 'Threat to southern avenue of approach. Would force use of northern route only.',
            latestTimeOfValue: 'Continuous monitoring until seized',
          },
          {
            naiId: 'NAI-4',
            location: 'Grid 567890 (wooded area 3km west of Hill 315)',
            indicator: 'Enemy mobile reserve or counterattack force',
            significance: 'Enemy counterattack capability. Affects COA selection.',
            latestTimeOfValue: '6 hours before H-hour',
          },
        ],
        summary: 'IPB analysis identifies Hill 315 as decisive terrain currently occupied by enemy. Two viable ground avenues of approach (north and south routes). Weather favorable for offensive operations. Civilian presence (500 remaining) requires ROE consideration. Enemy Most Likely COA: defend in place, request reinforcement. Most Dangerous COA: reinforced defense with armor counterattack. Four NAIs established to answer key intelligence gaps.',
        analysisConfidence: 0.82,
      },
    },
  ],
};
