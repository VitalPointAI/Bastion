/**
 * Exercise Order Generator
 *
 * Phase 14 Plan 04: WARNORD, OPORD, and FRAGO generation with team-specific content.
 * Each order type uses LLM to synthesize team-visible documents and IPB assessments
 * into doctrinal order structures while enforcing information barriers.
 *
 * NOTE: Document export (DOCX/PDF) is out of scope — orders are stored as JSONB
 * per RESEARCH.md Pitfall 6 (decouple from plan-coupled docx-generator.ts).
 */

import type { Pool } from 'pg';
import type { LLMProvider, LLMCompletionRequest, ProviderConfig } from '../strategic/extraction/providers/types.js';
import { OpenAICompatibleProvider } from '../strategic/extraction/providers/openai-provider.js';
import type { OrderStore } from './order-store.js';
import type { ScenarioDocumentStore } from './document-store.js';
import type { IPBStore } from './ipb-store.js';
import type { COAStore } from './coa-store.js';
import type { ScenarioStore } from './scenario-store.js';
import type {
  ExerciseOrder,
  WARNORDContent,
  OPORDContent,
  FRAGOContent,
  ScenarioDocument,
  IPBAssessment,
} from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * LLM provider configuration for the order generator.
 * Accepts a pre-constructed LLMProvider or a ProviderConfig to build one.
 */
export type OrderGeneratorLLMConfig =
  | { provider: LLMProvider }
  | { config: ProviderConfig };

// ─── ExerciseOrderGenerator ───────────────────────────────────────────────────

/**
 * Generates WARNORD, OPORD, and FRAGO content using LLM synthesis of
 * team-visible documents, IPB assessments, and COA selections.
 *
 * All generation methods enforce the information barrier through the
 * `visibleTeams` parameter — only documents assigned to visible teams
 * are loaded before prompting the LLM.
 */
export class ExerciseOrderGenerator {
  private pool: Pool;
  private orderStore: OrderStore;
  private documentStore: ScenarioDocumentStore;
  private ipbStore: IPBStore;
  private coaStore: COAStore;
  private scenarioStore: ScenarioStore;
  private llm: LLMProvider;

  constructor(
    pool: Pool,
    orderStore: OrderStore,
    documentStore: ScenarioDocumentStore,
    ipbStore: IPBStore,
    coaStore: COAStore,
    scenarioStore: ScenarioStore,
    llmConfig: OrderGeneratorLLMConfig
  ) {
    this.pool = pool;
    this.orderStore = orderStore;
    this.documentStore = documentStore;
    this.ipbStore = ipbStore;
    this.coaStore = coaStore;
    this.scenarioStore = scenarioStore;

    if ('provider' in llmConfig) {
      this.llm = llmConfig.provider;
    } else {
      this.llm = new OpenAICompatibleProvider(llmConfig.config);
    }
  }

  // ─── WARNORD Generation ─────────────────────────────────────────────────────

  /**
   * Generate a Warning Order for a team at the start of an exercise phase.
   *
   * Blue WARNORD references CJTF WestPAC mission and INDOPACOM guidance.
   * Red WARNORD references PRC/TCC campaign objectives and PLA force structure.
   * The LLM prompt specifies which team's perspective to use so intelligence
   * from the opposing team's documents never bleeds across the barrier.
   */
  async generateWARNORD(
    scenarioId: string,
    team: 'blue' | 'red',
    exercisePhase: string,
    visibleTeams: string[]
  ): Promise<ExerciseOrder> {
    // Load scenario metadata and team-visible documents for the phase
    const scenario = await this.scenarioStore.findById(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const documents = await this.documentStore.findByScenarioAndPhase(
      scenarioId,
      exercisePhase,
      visibleTeams
    );

    // Build team-specific prompt context
    const teamLabel = team === 'blue' ? 'Blue Force (CJTF WestPAC / INDOPACOM)' : 'Red Force (PRC/TCC)';
    const teamGuidance =
      team === 'blue'
        ? 'Reference CJTF WestPAC mission, INDOPACOM campaign guidance, and Coalition ALERTORDs. Blue staff plans from the Joint Force Commander perspective.'
        : 'Reference PRC/TCC campaign objectives, PLA operational concepts, and TCC strategic directives. Red cell plans from the theater campaign perspective.';

    const docSummary = this.summarizeDocuments(documents);

    const prompt = `You are a military exercise controller generating a Warning Order (WARNORD) for the ${teamLabel} planning staff.

Exercise: ${scenario.name}
Phase: ${exercisePhase}
Team Perspective: ${team.toUpperCase()}
Team Guidance: ${teamGuidance}

Available Documents (team-visible only):
${docSummary}

Generate a WARNORD JSON object with exactly these fields:
{
  "situation": "Brief operational situation from this team's intelligence picture (SITREPs, OOBs visible to this team)",
  "missionStatement": "Derived from this team's ALERTORDs and campaign plan",
  "commandersIntent": "Extracted from senior leadership guidance documents",
  "initialTasks": [
    {
      "assignedTo": "role name (e.g., J2 Intelligence, J3 Operations, J5 Plans)",
      "task": "specific action to perform",
      "purpose": "why this task supports the mission",
      "deadline": "optional deadline string"
    }
  ],
  "timelineSummary": "Key dates and milestones from the exercise timeline",
  "serviceAndSupport": "Logistics summary from available documents",
  "commandAndSignal": "Command relationships and communication procedures"
}

Requirements:
- Include 3-5 initial tasks appropriate for ${team === 'blue' ? 'Blue force planning staff (mission analysis, COA development, intelligence estimate)' : 'Red cell (analyze TCC campaign objectives, develop PRC/TCC COAs, assess Blue force dispositions)'}
- Only reference information visible to the ${team.toUpperCase()} team — do not reference opposing force internal plans
- Output ONLY the JSON object, no other text`;

    const content = await this.callLLM(prompt);
    const warnordContent = this.parseJSON<WARNORDContent>(content, 'WARNORD');

    // Store as draft order
    const order = await this.orderStore.create({
      scenarioId,
      team,
      orderType: 'WARNORD',
      exercisePhase,
      version: 1,
      content: warnordContent,
      status: 'draft',
      publishedAt: null,
      createdBy: 'system:order-generator',
    });

    return order;
  }

  // ─── OPORD Generation ───────────────────────────────────────────────────────

  /**
   * Generate a full 5-paragraph Operations Order from a selected COA.
   *
   * Synthesizes IPB enemy assessment, force dispositions, and selected COA
   * task assignments. Enemy situation comes from the team's enemy_assessment
   * IPB perspective (never the opposing team's own-force picture).
   */
  async generateOPORD(
    scenarioId: string,
    team: 'blue' | 'red',
    exercisePhase: string,
    selectedCOAId: string,
    visibleTeams: string[]
  ): Promise<ExerciseOrder> {
    // Load selected COA
    const coa = await this.coaStore.findById(selectedCOAId, visibleTeams);
    if (!coa) {
      throw new Error(`COA ${selectedCOAId} not found or not visible`);
    }

    // Load IPB — enemy assessment perspective for the OPORD situation paragraph
    const ipbEnemyAssessment = await this.ipbStore.findByScenarioAndPerspective(
      scenarioId,
      team,
      'enemy_assessment',
      visibleTeams
    );

    // Load scenario documents and force dispositions
    const documents = await this.documentStore.findByScenarioAndPhase(
      scenarioId,
      exercisePhase,
      visibleTeams
    );

    const scenario = await this.scenarioStore.findById(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const teamLabel = team === 'blue' ? 'Blue Force (CJTF WestPAC)' : 'Red Force (PRC/TCC)';
    const docSummary = this.summarizeDocuments(documents);
    const ipbSummary = ipbEnemyAssessment
      ? this.summarizeIPB(ipbEnemyAssessment)
      : 'No IPB assessment available.';

    const coaSummary = `
COA Name: ${coa.name}
COA Number: ${coa.number}
Description: ${coa.description}
Scheme: ${coa.scheme}
Narrative: ${coa.narrative}`;

    const prompt = `You are a military exercise controller generating a full 5-paragraph Operations Order (OPORD) for the ${teamLabel} planning staff.

Exercise: ${scenario.name}
Phase: ${exercisePhase}
Team: ${team.toUpperCase()}
Selected COA:
${coaSummary}

IPB Enemy Assessment:
${ipbSummary}

Available Documents (team-visible only):
${docSummary}

Generate an OPORD JSON object matching this TypeScript structure:
{
  "situation": {
    "areaOfInterest": "string",
    "areaOfOperations": "string",
    "enemyForces": {
      "composition": "string",
      "disposition": "string",
      "strength": "string",
      "recentActivity": "string",
      "capabilities": ["string"],
      "vulnerabilities": ["string"]
    },
    "friendlyForces": {
      "higherHQ": "string",
      "adjacentUnits": ["string"],
      "supportingUnits": ["string"]
    },
    "civilConsiderations": {
      "population": "string",
      "infrastructure": "string",
      "governance": "string"
    },
    "attachmentsDetachments": ["string"]
  },
  "mission": {
    "who": "string",
    "what": "string",
    "when": "string",
    "where": "string",
    "why": "string"
  },
  "execution": {
    "commandersIntent": {
      "purpose": "string",
      "keyTasks": ["string"],
      "endState": "string",
      "context": "string",
      "constraints": ["string"],
      "criticalFactors": ["string"],
      "antigoals": ["string"]
    },
    "conceptOfOperations": {
      "scheme": "string",
      "phases": [{"name": "string", "purpose": "string", "tasks": ["string"]}]
    },
    "tasks": [{"id": "string", "unitId": "string", "task": "string", "purpose": "string"}],
    "coordinatingInstructions": ["string"],
    "fires": {"supportingUnits": ["string"], "priorityTargets": ["string"], "restrictions": ["string"]},
    "riskMitigation": {"criticalRisks": [], "mitigationMeasures": ["string"]}
  },
  "serviceAndSupport": {
    "logistics": {"supplyPlan": "string", "transportationPlan": "string", "maintenancePlan": "string"},
    "personnel": {"replacementPlan": "string", "medicalEvacuation": "string"},
    "publicAffairs": "string",
    "civilAffairs": "string",
    "healthServiceSupport": "string"
  },
  "commandAndSignal": {
    "commandPost": {"location": "string", "alternateLocation": "string"},
    "succession": ["string"],
    "signal": {"frequencies": ["string"], "callSigns": {}, "pyrotechnics": ["string"]},
    "codewords": {}
  }
}

Requirements:
- Situation enemy forces must come from the IPB enemy_assessment perspective
- Mission must derive from the selected COA's mission statement and commander's intent
- Execution tasks must derive from the COA scheme and task assignments
- Only reference information visible to the ${team.toUpperCase()} team
- Output ONLY the JSON object, no other text`;

    const content = await this.callLLM(prompt);
    const opordContent = this.parseJSON<OPORDContent>(content, 'OPORD');

    const order = await this.orderStore.create({
      scenarioId,
      team,
      orderType: 'OPORD',
      exercisePhase,
      version: 1,
      content: opordContent,
      status: 'draft',
      publishedAt: null,
      createdBy: 'system:order-generator',
    });

    return order;
  }

  // ─── FRAGO Generation ───────────────────────────────────────────────────────

  /**
   * Generate a Fragmentary Order modifying a base OPORD or previous FRAGO.
   *
   * Only changed paragraphs are generated — the FRAGO references the base order
   * and includes only the content that changed due to new intelligence or
   * changed circumstances described in `changedContext`.
   */
  async generateFRAGO(
    scenarioId: string,
    baseOrderId: string,
    changedContext: string,
    visibleTeams: string[]
  ): Promise<ExerciseOrder> {
    // Load the base order
    const baseOrder = await this.orderStore.findById(baseOrderId, visibleTeams);
    if (!baseOrder) {
      throw new Error(`Base order ${baseOrderId} not found or not visible`);
    }

    if (baseOrder.orderType !== 'OPORD' && baseOrder.orderType !== 'FRAGO') {
      throw new Error(`Base order must be OPORD or FRAGO, got ${baseOrder.orderType}`);
    }

    const scenario = await this.scenarioStore.findById(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario ${scenarioId} not found`);
    }

    const baseContent = JSON.stringify(baseOrder.content, null, 2);
    const teamLabel = baseOrder.team === 'blue' ? 'Blue Force (CJTF WestPAC)' : 'Red Force (PRC/TCC)';

    const prompt = `You are a military exercise controller generating a Fragmentary Order (FRAGO) for the ${teamLabel} planning staff.

Exercise: ${scenario.name}
Phase: ${baseOrder.exercisePhase}
Base Order ID: ${baseOrderId}
Base Order Type: ${baseOrder.orderType}

Changed Circumstances:
${changedContext}

Base Order Content:
${baseContent}

A FRAGO only contains the paragraphs that changed. Generate a FRAGO JSON object with this structure:
{
  "changedParagraphs": {
    // Include ONLY the paragraphs that need updating due to the changed circumstances
    // Valid keys: "situation", "mission", "execution", "serviceAndSupport", "commandAndSignal"
    // Each key maps to a partial update of the corresponding OPORD paragraph
  },
  "effectiveTime": "ISO datetime string or descriptive time reference when FRAGO takes effect",
  "references": ["${baseOrderId}"]
}

Requirements:
- Only include paragraphs that actually changed — omit unchanged paragraphs
- The changed circumstances determine which paragraphs are affected
- Maintain doctrinal formatting for each changed paragraph
- effectiveTime should be derived from the changed circumstances if a time is specified
- Output ONLY the JSON object, no other text`;

    const content = await this.callLLM(prompt);
    const fragoContent = this.parseJSON<FRAGOContent>(content, 'FRAGO');

    // Ensure references array includes base order ID
    if (!fragoContent.references) {
      fragoContent.references = [baseOrderId];
    } else if (!fragoContent.references.includes(baseOrderId)) {
      fragoContent.references.unshift(baseOrderId);
    }

    const order = await this.orderStore.create({
      scenarioId,
      team: baseOrder.team,
      orderType: 'FRAGO',
      exercisePhase: baseOrder.exercisePhase,
      version: 1,
      content: fragoContent,
      status: 'draft',
      publishedAt: null,
      createdBy: 'system:order-generator',
    });

    return order;
  }

  // ─── Manual Authoring Support ───────────────────────────────────────────────

  /**
   * Create a blank draft order with pre-populated template fields for manual
   * staff authoring. The order structure varies by type — WARNORD gets initial
   * task placeholders, OPORD gets the full 5-paragraph skeleton, FRAGO gets
   * a minimal changed-paragraphs structure.
   */
  async createDraftOrder(
    scenarioId: string,
    team: 'blue' | 'red',
    orderType: string,
    exercisePhase: string
  ): Promise<ExerciseOrder> {
    let content: WARNORDContent | OPORDContent | FRAGOContent;

    if (orderType === 'WARNORD') {
      content = this.blankWARNORDContent(team);
    } else if (orderType === 'OPORD') {
      content = this.blankOPORDContent();
    } else if (orderType === 'FRAGO') {
      content = this.blankFRAGOContent();
    } else {
      throw new Error(`Unknown order type: ${orderType}. Must be WARNORD, OPORD, or FRAGO`);
    }

    const order = await this.orderStore.create({
      scenarioId,
      team,
      orderType: orderType as ExerciseOrder['orderType'],
      exercisePhase,
      version: 1,
      content,
      status: 'draft',
      publishedAt: null,
      createdBy: 'system:manual-draft',
    });

    return order;
  }

  // ─── Content Update ─────────────────────────────────────────────────────────

  /**
   * Update order content before publication — allows staff edits to
   * AI-generated content. Does not change order status.
   */
  async updateOrderContent(
    orderId: string,
    content: WARNORDContent | OPORDContent | FRAGOContent,
    visibleTeams: string[]
  ): Promise<void> {
    // Verify the order exists and is visible to the requester
    const order = await this.orderStore.findById(orderId, visibleTeams);
    if (!order) {
      throw new Error(`Order ${orderId} not found or not visible`);
    }
    if (order.status === 'published') {
      throw new Error(`Cannot update content of published order ${orderId}`);
    }

    await this.orderStore.updateContent(orderId, content as object);
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Call the LLM and return the text content, throwing on empty response.
   */
  private async callLLM(prompt: string): Promise<string> {
    const request: LLMCompletionRequest = {
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      max_tokens: 8192,
      temperature: 0.3,
    };

    const response = await this.llm.complete(request);
    if (!response.content) {
      throw new Error('LLM returned empty response for order generation');
    }
    return response.content;
  }

  /**
   * Parse LLM JSON output, extracting the JSON block if the model wrapped it
   * in markdown code fences or surrounding prose.
   */
  private parseJSON<T>(text: string, orderType: string): T {
    // Strip markdown code fences if present
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const raw = fenced ? fenced[1].trim() : text.trim();

    // Find the outermost JSON object
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end === -1) {
      throw new Error(`LLM did not return valid JSON for ${orderType} generation`);
    }

    try {
      return JSON.parse(raw.slice(start, end + 1)) as T;
    } catch (err) {
      throw new Error(
        `Failed to parse ${orderType} JSON from LLM response: ${err instanceof Error ? err.message : String(err)}`,
        { cause: err }
      );
    }
  }

  /**
   * Produce a concise text summary of documents for LLM context.
   * Keeps tokens manageable by truncating long text content.
   */
  private summarizeDocuments(documents: ScenarioDocument[]): string {
    if (documents.length === 0) {
      return 'No documents available for this phase.';
    }

    return documents
      .map((doc) => {
        const preview = doc.textContent.length > 500
          ? doc.textContent.slice(0, 500) + '...'
          : doc.textContent;
        return `[${doc.documentType}] ${doc.filename} (team: ${doc.team})\n${preview}`;
      })
      .join('\n\n---\n\n');
  }

  /**
   * Produce a concise text summary of an IPB assessment for LLM context.
   */
  private summarizeIPB(ipb: IPBAssessment): string {
    return `
Threat Assessment: ${ipb.threatAssessment}
Civil Considerations: ${ipb.civilConsiderations}
Terrain (OAKOC):
  - Observation: ${ipb.terrainAnalysis.observation}
  - Avenues: ${ipb.terrainAnalysis.avenues}
  - Key Terrain: ${ipb.terrainAnalysis.keyTerrain}
  - Obstacles: ${ipb.terrainAnalysis.obstacles}
  - Cover/Concealment: ${ipb.terrainAnalysis.coverAndConcealment}
Force Dispositions: ${ipb.forceDispositions.length} units tracked
Named Areas of Interest: ${ipb.namedAreasOfInterest.map((n) => n.name).join(', ')}`.trim();
  }

  /**
   * Blank WARNORD template with role-appropriate task stubs.
   */
  private blankWARNORDContent(team: 'blue' | 'red'): WARNORDContent {
    const isBlue = team === 'blue';
    return {
      situation: '[Situation to be completed]',
      missionStatement: '[Mission statement to be completed]',
      commandersIntent: "[Commander's intent to be completed]",
      initialTasks: isBlue
        ? [
            {
              assignedTo: 'J2 Intelligence',
              task: 'Conduct mission analysis of CJTF WestPAC AO',
              purpose: 'Provide intelligence preparation for COA development',
            },
            {
              assignedTo: 'J5 Plans',
              task: '[Develop COAs for assigned phase]',
              purpose: 'Support commander decision-making',
            },
            {
              assignedTo: 'J2 Intelligence',
              task: 'Prepare intelligence estimate',
              purpose: 'Characterize threat and inform COA analysis',
            },
          ]
        : [
            {
              assignedTo: 'Operations Cell',
              task: 'Analyze TCC campaign objectives',
              purpose: 'Frame the operational environment for Red force planning',
            },
            {
              assignedTo: 'Plans Cell',
              task: '[Develop COAs for PRC/TCC operations]',
              purpose: 'Generate courses of action for theater campaign',
            },
            {
              assignedTo: 'Intelligence Cell',
              task: 'Assess Blue force dispositions',
              purpose: 'Support threat assessment and COA comparison',
            },
          ],
      timelineSummary: '[Timeline to be completed]',
      serviceAndSupport: '[Service and support to be completed]',
      commandAndSignal: '[Command and signal to be completed]',
    };
  }

  /**
   * Blank OPORD template skeleton for manual authoring.
   */
  private blankOPORDContent(): OPORDContent {
    return {
      situation: {
        areaOfInterest: '[Area of interest]',
        areaOfOperations: '[Area of operations]',
        enemyForces: {
          composition: '[Enemy composition]',
          disposition: '[Enemy disposition]',
          strength: '[Enemy strength]',
          recentActivity: '[Recent enemy activity]',
          capabilities: [],
          vulnerabilities: [],
        },
        friendlyForces: {
          higherHQ: '[Higher headquarters]',
          adjacentUnits: [],
          supportingUnits: [],
        },
        civilConsiderations: {
          population: '[Population]',
          infrastructure: '[Infrastructure]',
          governance: '[Governance]',
        },
        attachmentsDetachments: [],
      },
      mission: {
        who: '[Who]',
        what: '[What task]',
        when: '[When]',
        where: '[Where]',
        why: '[Purpose]',
      },
      execution: {
        commandersIntent: {
          purpose: "[Commander's purpose]",
          keyTasks: [],
          endState: '[Desired end state]',
          context: '[Context]',
          constraints: [],
          criticalFactors: [],
          antigoals: [],
        },
        conceptOfOperations: {
          scheme: '[Scheme of maneuver]',
          phases: [],
        },
        tasks: [],
        coordinatingInstructions: [],
        fires: {
          supportingUnits: [],
          priorityTargets: [],
          restrictions: [],
        },
        riskMitigation: {
          criticalRisks: [],
          mitigationMeasures: [],
        },
      },
      serviceAndSupport: {
        logistics: {
          supplyPlan: '[Supply plan]',
          transportationPlan: '[Transportation plan]',
          maintenancePlan: '[Maintenance plan]',
        },
        personnel: {
          replacementPlan: '[Replacement plan]',
          medicalEvacuation: '[Medical evacuation]',
        },
        publicAffairs: '[Public affairs]',
        civilAffairs: '[Civil affairs]',
        healthServiceSupport: '[Health service support]',
      },
      commandAndSignal: {
        commandPost: {
          location: '[Command post location]',
          alternateLocation: '[Alternate location]',
        },
        succession: [],
        signal: {
          frequencies: [],
          callSigns: {},
          pyrotechnics: [],
        },
        codewords: {},
      },
    };
  }

  /**
   * Blank FRAGO template for manual authoring.
   */
  private blankFRAGOContent(): FRAGOContent {
    return {
      changedParagraphs: {},
      effectiveTime: '[Effective time to be specified]',
      references: [],
    };
  }
}
