/**
 * Operational Design REST API
 *
 * Phase 25 Plan 01: Express routes for /api/design/*
 * CRUD operations for operational design data per problem set.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { designStore } from '../design/design-store.js';
import type { CoGAnalysis, LineOfEffort, OperationalDesign, MapSymbol, ControlMeasure } from '../design/types.js';
import { getAgentRegistry } from '../agents/registry.js';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import { listDocuments } from '../strategic/ingestion/document-store.js';
import { ObjectiveStore } from '../strategic/objectives/store.js';
import { problemSetStore } from '../problem-set/problem-set-store.js';
import { notifyCOPChange } from '../cop/index.js';
import { router as revisionRouter } from './design-revisions.js';

const router = Router();

// Mount revision sub-router before the /:problemSetId catch-all routes to avoid conflicts
router.use('/:problemSetId/revisions', revisionRouter);

const VALID_SECTIONS = ['problem-framing', 'cog-analysis', 'lines-of-effort', 'operational-approach'];

const objectiveStore = new ObjectiveStore();

/**
 * Fetch strategic context (documents + objectives) for a problem set.
 * Returns a text summary suitable for inclusion in agent prompts.
 */
async function getStrategicContext(problemSetId: string): Promise<string> {
  try {
    // Fetch documents for this problem set (workspaceId = problemSetId)
    const docs = await listDocuments('', 50, 0, problemSetId);
    if (docs.length === 0) return '';

    const parts: string[] = ['## Strategic Context from Uploaded Documents\n'];

    for (const doc of docs) {
      parts.push(`### ${doc.title} (${doc.level}, ${doc.classification})`);

      // Fetch objectives for this document
      try {
        const objectives = await objectiveStore.getObjectivesForDocument(doc.id);
        if (objectives.length > 0) {
          parts.push(`Extracted Objectives (${objectives.length}):`);
          for (const obj of objectives.slice(0, 20)) {
            const instrument = obj.primaryInstrument || 'unknown';
            const priority = obj.priority || 'MEDIUM';
            parts.push(`- [${instrument}/${priority}] ${obj.description}`);
            if (obj.assumptions?.length) {
              parts.push(`  Assumptions: ${obj.assumptions.join('; ')}`);
            }
            if (obj.risks?.length) {
              parts.push(`  Risks: ${obj.risks.join('; ')}`);
            }
            if (obj.constraints?.length) {
              parts.push(`  Constraints: ${obj.constraints.join('; ')}`);
            }
          }
          if (objectives.length > 20) {
            parts.push(`  ... and ${objectives.length - 20} more objectives`);
          }
        } else {
          parts.push('(No objectives extracted yet)');
        }
      } catch {
        // Objectives table may not exist yet
      }

      parts.push('');
    }

    const result = parts.join('\n');
    // Cap at ~6000 chars to leave room in context window
    return result.length > 6000 ? result.substring(0, 6000) + '\n...(truncated)' : result;
  } catch (err) {
    console.warn('[design] Failed to fetch strategic context:', err);
    return '';
  }
}

/**
 * Build progressive design context from prior sections.
 * Each section benefits from completed prior sections:
 * - cog-analysis receives problem framing
 * - lines-of-effort receives problem framing + CoG analysis
 * - operational-approach receives all prior sections
 */
function buildPriorDesignContext(section: string, design: OperationalDesign): string {
  const parts: string[] = [];

  const pf = design.problemFraming;
  const hasProblemFraming = pf && (pf.currentState || pf.problemStatement || pf.desiredEndState);

  // CoG, LOE, and Operational Approach all benefit from problem framing
  if (section !== 'problem-framing' && hasProblemFraming) {
    parts.push('## Prior Design Context: Problem Framing');
    if (pf.currentState) parts.push(`Current State: ${pf.currentState}`);
    if (pf.problemStatement) parts.push(`Problem Statement: ${pf.problemStatement}`);
    if (pf.desiredEndState) parts.push(`Desired End State: ${pf.desiredEndState}`);
    if (pf.keyTensions?.length) parts.push(`Key Tensions: ${pf.keyTensions.join('; ')}`);
    if (pf.obstacles?.length) parts.push(`Obstacles: ${pf.obstacles.join('; ')}`);
    if (pf.opportunities?.length) parts.push(`Opportunities: ${pf.opportunities.join('; ')}`);
    if (pf.assumptions?.length) parts.push(`Assumptions: ${pf.assumptions.join('; ')}`);
    if (pf.constraints?.length) parts.push(`Constraints: ${pf.constraints.join('; ')}`);
    parts.push('');
  }

  const cog = design.cogAnalysis;
  const hasCog = cog && (cog.friendly?.root || cog.adversary?.root);

  // LOE and Operational Approach benefit from CoG analysis
  if ((section === 'lines-of-effort' || section === 'operational-approach') && hasCog) {
    parts.push('## Prior Design Context: Center of Gravity Analysis');
    if (cog.friendly?.root) {
      parts.push(`Friendly CoG: ${cog.friendly.root.label}${cog.friendly.root.description ? ` — ${cog.friendly.root.description}` : ''}`);
      const fCCs = cog.friendly.root.children?.filter(c => c.type === 'critical-capability') || [];
      if (fCCs.length) parts.push(`  Critical Capabilities: ${fCCs.map(c => c.label).join(', ')}`);
    }
    if (cog.adversary?.root) {
      parts.push(`Adversary CoG: ${cog.adversary.root.label}${cog.adversary.root.description ? ` — ${cog.adversary.root.description}` : ''}`);
      const aCCs = cog.adversary.root.children?.filter(c => c.type === 'critical-capability') || [];
      if (aCCs.length) parts.push(`  Critical Capabilities: ${aCCs.map(c => c.label).join(', ')}`);
    }
    parts.push('');
  }

  const loes = design.linesOfEffort;
  const hasLOEs = loes && loes.length > 0;

  // Operational Approach benefits from LOE data
  if (section === 'operational-approach' && hasLOEs) {
    parts.push('## Prior Design Context: Lines of Effort');
    for (const loe of loes) {
      parts.push(`- LOE: ${loe.name}${loe.description ? ` — ${loe.description}` : ''}`);
    }
    parts.push('');
  }

  return parts.join('\n');
}

/**
 * GET /api/design/:problemSetId
 * Returns full OperationalDesign (auto-creates if none exists).
 */
router.get('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const design = await designStore.getByProblemSetId(problemSetId);
    res.json(design);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/status
 * Returns just section statuses.
 */
router.get('/:problemSetId/status', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const status = await designStore.getStatus(problemSetId);
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/status failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/design/:problemSetId/:section
 * Updates one section. Body = section data.
 * Section must be: problem-framing, cog-analysis, lines-of-effort, operational-approach.
 */
router.patch('/:problemSetId/:section', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const section = req.params.section as string;

    if (!VALID_SECTIONS.includes(section)) {
      res.status(400).json({
        error: `Invalid section: ${section}. Must be one of: ${VALID_SECTIONS.join(', ')}`,
      });
      return;
    }

    const updated = await designStore.updateSection(problemSetId, section, req.body);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] PATCH /${req.params.problemSetId}/${req.params.section} failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/design/:problemSetId/handoff
 * Returns DesignHandoffPayload for Plan tab consumption.
 */
router.get('/:problemSetId/handoff', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const payload = await designStore.getHandoffPayload(problemSetId);
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/handoff failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/design/:problemSetId/push-handoff
 * Packages handoff payload and persists it in the database.
 * @deprecated Phase 49 — Plan tab fetches directly via GET /api/design/:problemSetId. Kept for backward compatibility.
 */
router.post('/:problemSetId/push-handoff', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const result = await designStore.pushHandoff(problemSetId);
    notifyCOPChange(problemSetId, 'design-handoff');
    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] POST /${req.params.problemSetId}/push-handoff failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/design/:problemSetId/analyze
 * AI analysis for a design section.
 * Body = { section: string, context: object, additionalAgents?: string[] }.
 *
 * When additionalAgents are provided, each agent runs a supplementary analysis
 * in parallel with the primary section agent. Results are merged into the response
 * as an `agentContributions` array alongside the primary output.
 */
router.post('/:problemSetId/analyze', async (req: Request, res: Response) => {
  try {
    const section = req.body.section as string;
    const context = req.body.context as Record<string, unknown>;
    const additionalAgents = (req.body.additionalAgents as string[]) || [];

    if (!section) {
      res.status(400).json({ error: 'Missing required field: section' });
      return;
    }

    // ── Fetch strategic context from Understand tab documents ─────────────
    const problemSetId = req.params.problemSetId as string;
    const strategicContext = await getStrategicContext(problemSetId);
    if (strategicContext) {
      console.log(`[design] Injecting strategic context (${strategicContext.length} chars) into ${section} analysis`);
    }

    // ── Fetch current design state for progressive context enrichment ────
    // Each section benefits from prior sections: problem-framing → cog → LOE → narrative
    const design = await designStore.getByProblemSetId(problemSetId);
    const priorContext = buildPriorDesignContext(section, design);
    const fullContext = [strategicContext, priorContext].filter(Boolean).join('\n\n');

    // ── Primary section analysis ──────────────────────────────────────────
    let primaryOutput: Record<string, unknown>;

    if (section === 'problem-framing') {
      const { generateFramings } = await import('../agents/problem-framing.js');
      // Prepend strategic context to situation description
      const situationWithContext = fullContext
        ? `${fullContext}\n\n## Current Situation Assessment\n${(context?.currentState as string) || ''}`
        : (context?.currentState as string) || '';
      const output = await generateFramings(
        situationWithContext,
        (context?.problemStatement as string) || '',
        (context?.desiredEndState as string) || '',
        (context?.assumptions as string[]) || []
      );
      const framings = [output.defaultFraming, ...output.alternativeFramings];
      primaryOutput = { framings };
    } else if (section === 'cog-analysis') {
      const { analyzeCenterOfGravity } = await import('../agents/cog-analysis.js');
      const cogData = context as unknown as CoGAnalysis;
      primaryOutput = await analyzeCenterOfGravity(cogData, fullContext) as unknown as Record<string, unknown>;
    } else if (section === 'lines-of-effort') {
      const { analyzeLOEGaps } = await import('../agents/loe-gap-analysis.js');
      const loeData = ((context as Record<string, unknown>)?.loes as LineOfEffort[]) || [];
      const cogData = ((context as Record<string, unknown>)?.cogAnalysis as CoGAnalysis) || { friendly: { root: null }, adversary: { root: null } };
      primaryOutput = await analyzeLOEGaps(loeData, cogData, fullContext) as unknown as Record<string, unknown>;
    } else if (section === 'operational-approach') {
      const { synthesizeNarrative } = await import('../agents/narrative-synthesis.js');
      primaryOutput = await synthesizeNarrative({
        problemFraming: design.problemFraming,
        cogAnalysis: design.cogAnalysis,
        linesOfEffort: design.linesOfEffort,
        operationalApproach: design.operationalApproach,
      }, fullContext) as unknown as Record<string, unknown>;
    } else {
      res.status(400).json({ error: `Unsupported analysis section: ${section}` });
      return;
    }

    // ── Additional agent contributions (parallel) ─────────────────────────
    if (additionalAgents.length > 0) {
      const contributions = await getAgentContributions(
        additionalAgents,
        section,
        context,
        problemSetId,
        strategicContext,
      );
      primaryOutput.agentContributions = contributions;
    }

    res.json(primaryOutput);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] POST /${req.params.problemSetId}/analyze failed:`, message);
    res.status(500).json({ error: message });
  }
});

// ─── Current State Synthesis from Knowledge Graph ─────────────────────────

/**
 * POST /:problemSetId/synthesize-current-state
 *
 * Queries the knowledge graph for actors, relationships, and tensions
 * scoped to this problem set's workspace, then uses LLM to synthesize
 * a narrative "current state" assessment for Problem Framing.
 */
router.post('/:problemSetId/synthesize-current-state', async (req, res) => {
  const problemSetId = req.params.problemSetId as string;

  try {
    const { executeReadQuery } = await import('../graph/neo4j-client.js');

    const now = new Date().toISOString();

    // ── Build scoped actor ID set using the same signals as the brain endpoint ─
    // This ensures STRATENV synthesis uses the same focused slice as the
    // brain visualization, not the entire global graph.
    const { getProblemSetContext } = await import('../doc-intelligence/interview/interview-store.js');
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();
    const allActorResult = await executeReadQuery(`
      MATCH (a:Actor)
      WHERE (a.validTo IS NULL OR a.validTo > $now)
      RETURN a.id AS id, a.name AS name, a.aliases AS aliases,
             a.workspaceId AS workspaceId, a.containerIds AS containerIds,
             a.sourceDocumentIds AS sourceDocumentIds
    `, { now });

    const scopedIds = new Set<string>();
    const allActorRows = allActorResult.records;

    // Signal 1: container/workspace tag
    for (const r of allActorRows) {
      const cids = r.get('containerIds') as string[] | null;
      if (Array.isArray(cids) && cids.includes(problemSetId)) scopedIds.add(r.get('id') as string);
      if (r.get('workspaceId') === problemSetId) scopedIds.add(r.get('id') as string);
    }

    // Signal 2: document provenance
    const docResult = await pool.query(`SELECT id FROM strategic_documents WHERE workspace_id = $1`, [problemSetId]);
    const psDocIds = new Set(docResult.rows.map((r: { id: string }) => r.id));
    if (psDocIds.size > 0) {
      for (const r of allActorRows) {
        if (scopedIds.has(r.get('id') as string)) continue;
        const srcDocs = r.get('sourceDocumentIds') as string[] | null;
        if (srcDocs?.some(d => psDocIds.has(d))) scopedIds.add(r.get('id') as string);
      }
    }

    // Signal 3: scoping interview terms
    const ctx = await getProblemSetContext(problemSetId).catch(() => null);
    if (ctx) {
      const scopeTerms = new Set<string>();
      for (const t of ctx.actorFocus.primaryActors) scopeTerms.add(t.toLowerCase());
      for (const c of ctx.geographicScope.countries) scopeTerms.add(c.toLowerCase());
      for (const r of ctx.geographicScope.regions) scopeTerms.add(r.toLowerCase());
      if (ctx.geographicScope.specificAreas) for (const a of ctx.geographicScope.specificAreas) scopeTerms.add(a.toLowerCase());
      if (ctx.actorFocus.alliances) for (const al of ctx.actorFocus.alliances) { scopeTerms.add(al.name.toLowerCase()); for (const m of al.members) scopeTerms.add(m.toLowerCase()); }
      const filteredTerms = [...scopeTerms].filter(t => t.length >= 4);
      if (filteredTerms.length > 0) {
        for (const r of allActorRows) {
          if (scopedIds.has(r.get('id') as string)) continue;
          const nameLC = (r.get('name') as string).toLowerCase();
          const aliases = (r.get('aliases') as string[] | null) ?? [];
          const allNames = [nameLC, ...aliases.map(a => a.toLowerCase())];
          if (allNames.some(name => filteredTerms.some(st => name.includes(st)))) {
            scopedIds.add(r.get('id') as string);
          }
        }
      }
    }

    const scopedIdList = [...scopedIds];

    // 1. Fetch scoped actors with relationship counts
    const actorResult = await executeReadQuery(`
      MATCH (a:Actor)
      WHERE a.id IN $scopedIds
        AND (a.validTo IS NULL OR a.validTo > $now)
      OPTIONAL MATCH (a)-[r]-()
      WHERE (r.validTo IS NULL OR r.validTo > $now)
      WITH a, count(r) AS rels
      ORDER BY rels DESC
      LIMIT 40
      RETURN a.name AS name, a.type AS type, a.attributes AS attributes,
             a.confidence AS confidence, rels,
             a.updatedAt AS updatedAt, a.validFrom AS validFrom,
             a.halfLifeDays AS halfLifeDays
    `, { scopedIds: scopedIdList, now });

    // 2. Fetch relationships between scoped actors
    const relResult = await executeReadQuery(`
      MATCH (a:Actor)-[r:RELATES_TO]->(b:Actor)
      WHERE a.id IN $scopedIds AND b.id IN $scopedIds
        AND (a.validTo IS NULL OR a.validTo > $now)
        AND (b.validTo IS NULL OR b.validTo > $now)
        AND (r.validTo IS NULL OR r.validTo > $now)
      RETURN a.name AS source, b.name AS target, r.type AS relType,
             r.description AS desc, r.strength AS strength,
             r.updatedAt AS updatedAt
      LIMIT 50
    `, { scopedIds: scopedIdList, now });

    // 3. Fetch tensions between scoped actors
    const tensionResult = await executeReadQuery(`
      MATCH (a:Actor)-[t:TENSION]->(b:Actor)
      WHERE a.id IN $scopedIds AND b.id IN $scopedIds
        AND (a.validTo IS NULL OR a.validTo > $now)
        AND (b.validTo IS NULL OR b.validTo > $now)
        AND (t.validTo IS NULL OR t.validTo > $now)
      RETURN a.name AS actor1, b.name AS actor2, t.description AS desc,
             t.intensity AS intensity, t.domain AS domain,
             t.updatedAt AS updatedAt
      LIMIT 30
    `, { scopedIds: scopedIdList, now });

    // 4. Build context string from graph data — include freshness metadata
    const { computeDecayedConfidence } = await import('../graph/confidence-calculator.js');
    const nowDate = new Date();

    // Neo4j integers come back as BigInt — convert to plain number for JSON safety
    const toNum = (v: unknown): number | null => {
      if (v == null) return null;
      if (typeof v === 'bigint') return Number(v);
      if (typeof v === 'object' && v !== null && 'toInt' in v) return (v as { toInt: () => number }).toInt();
      if (typeof v === 'number') return v;
      return null;
    };

    const actors = actorResult.records.map((r) => {
      const baseConf = toNum(r.get('confidence')) ?? 0.65;
      const validFrom = r.get('validFrom');
      const halfLife = toNum(r.get('halfLifeDays')) ?? 90;
      const lastAsserted = validFrom ? new Date(validFrom) : nowDate;
      const decayedConf = computeDecayedConfidence(baseConf, lastAsserted, halfLife, nowDate);
      return {
        name: r.get('name'),
        type: r.get('type'),
        confidence: decayedConf,
        relationships: toNum(r.get('rels')) ?? 0,
        updatedAt: r.get('updatedAt'),
      };
    });

    const relationships = relResult.records.map((r) => ({
      source: r.get('source'),
      target: r.get('target'),
      type: r.get('relType'),
      description: r.get('desc'),
      strength: toNum(r.get('strength')),
      updatedAt: r.get('updatedAt'),
    }));

    const tensions = tensionResult.records.map((r) => ({
      actor1: r.get('actor1'),
      actor2: r.get('actor2'),
      description: r.get('desc'),
      intensity: toNum(r.get('intensity')),
      domain: r.get('domain'),
      updatedAt: r.get('updatedAt'),
    }));

    if (actors.length === 0) {
      res.json({
        currentState: '',
        hint: 'No actors found in knowledge graph. Ingest OSINT feeds or upload documents first.',
      });
      return;
    }

    // 5. Get strategic context from documents
    const strategicContext = await getStrategicContext(problemSetId);

    // 5b. Get scoping interview context (what was discussed during problem scoping)
    let scopingContext = '';
    try {
      const { getProblemSetContext } = await import('../doc-intelligence/interview/interview-store.js');
      const scopingData = await getProblemSetContext(problemSetId);
      if (scopingData) {
        scopingContext = `## Problem Scoping Interview Summary\n${scopingData}`;
      }
    } catch { /* scoping interview may not exist yet */ }

    // 6. Get problem set scope info
    const ps = await problemSetStore.getProblemSet(problemSetId);
    const scopeContext = ps
      ? `Problem Set: ${ps.name}\nMission: ${(ps as unknown as Record<string, unknown>).missionStatement ?? 'Not defined'}\nEchelon: ${(ps as unknown as Record<string, unknown>).echelon ?? 'Not specified'}`
      : '';

    // 7. Synthesize via LLM
    const { createLLMForAgent } = await import('../agents/langgraph/llm-factory.js');
    const llm = await createLLMForAgent({ agentId: 'design-synthesis' });

    // Helper: format relative age from updatedAt for LLM context
    const formatAge = (updatedAt: string | null | undefined): string => {
      if (!updatedAt) return 'unknown age';
      const days = Math.floor((nowDate.getTime() - new Date(updatedAt).getTime()) / 86_400_000);
      if (days <= 1) return 'updated today';
      if (days <= 7) return `updated ${days}d ago`;
      if (days <= 30) return `updated ${Math.floor(days / 7)}w ago`;
      return `updated ${Math.floor(days / 30)}mo ago`;
    };

    const kgSummary = [
      `## Key Actors (${actors.length})`,
      ...actors.slice(0, 25).map((a) =>
        `- ${a.name} (${a.type}, ${a.relationships} connections, confidence: ${a.confidence.toFixed(2)}, ${formatAge(a.updatedAt)})`),
      '',
      `## Key Relationships (${relationships.length})`,
      ...relationships.slice(0, 25).map((r) =>
        `- ${r.source} → ${r.target}: ${r.type}${r.description ? ` — ${r.description}` : ''} [${formatAge(r.updatedAt)}]`),
      '',
      `## Active Tensions (${tensions.length})`,
      ...tensions.slice(0, 15).map((t) =>
        `- ${t.actor1} vs ${t.actor2}: ${t.description ?? 'unspecified'}${t.domain ? ` (${t.domain})` : ''}${t.intensity ? ` [intensity: ${t.intensity}]` : ''} [${formatAge(t.updatedAt)}]`),
    ].join('\n');

    const result = await llm.invoke([
      {
        role: 'system',
        content: `You are a senior military strategic analyst writing a "Current State" assessment for an operational design problem framing exercise (per JP 5-0).

Write a concise, professional narrative (3-5 paragraphs) that synthesizes the provided knowledge graph data and strategic documents into a coherent assessment of the current operational environment. Cover:
1. Key actors and their roles/capabilities
2. Relationships and alliances that shape the environment
3. Active tensions and potential flashpoints
4. How these factors create the conditions requiring military planning

Each knowledge graph entry includes a confidence score (0-1, where decay means older unconfirmed data loses confidence) and a freshness indicator (e.g., "updated 3mo ago"). Apply these rules:
- Confidence >= 0.50: state as current fact
- Confidence 0.20-0.49: caveat with "assessed as" or "previously reported" language
- Do NOT include entries with confidence below 0.20
- If an entry was last updated more than 90 days ago with low confidence, do not present it as current fact — note that it may be outdated

Write in third person, present tense. Be specific — name actors and cite relationships. Do not use bullet points — write flowing prose suitable for a military planning document.`,
      },
      {
        role: 'user',
        content: `${scopeContext}\n\n${scopingContext}\n\n${strategicContext}\n\n## Knowledge Graph Intelligence\n${kgSummary}`,
      },
    ]);

    const synthesized = typeof result.content === 'string'
      ? result.content.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
      : JSON.stringify(result.content);

    res.json({
      currentState: synthesized,
      actorCount: actors.length,
      relationshipCount: relationships.length,
      tensionCount: tensions.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] synthesize-current-state failed:`, message);
    res.status(500).json({ error: message });
  }
});

// ─── Supplementary Agent Contributions ─────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  'problem-framing': 'Problem Framing',
  'cog-analysis': 'Center of Gravity Analysis',
  'lines-of-effort': 'Lines of Effort / Gap Analysis',
  'operational-approach': 'Operational Approach / Narrative Synthesis',
};

interface AgentContribution {
  agentId: string;
  agentName: string;
  analysis: string;
  confidence: number;
  keyPoints: string[];
}

/**
 * Run supplementary analysis with additional agents in parallel.
 * Each agent uses its own character/persona to provide a unique perspective
 * on the given design section data.
 */
async function getAgentContributions(
  agentIds: string[],
  section: string,
  context: Record<string, unknown>,
  problemSetId: string,
  strategicContext?: string,
): Promise<AgentContribution[]> {
  const registry = getAgentRegistry();
  await registry.ensureInitialized();

  const sectionLabel = SECTION_LABELS[section] || section;

  // Build a concise summary of the section data for the supplementary prompt
  const contextSummary = JSON.stringify(context, null, 2).substring(0, 3000);

  const promises = agentIds.map(async (agentId): Promise<AgentContribution | null> => {
    try {
      const agent = registry.getAgent(agentId);
      if (!agent) {
        console.warn(`[design] Additional agent ${agentId} not found in registry`);
        return null;
      }

      // Build system prompt from agent character
      const character = agent.character;
      const bioText = character?.bio?.map((b) => `- ${b}`).join('\n') || '';
      const knowledgeText = character?.knowledge?.map((k) => `- ${k}`).join('\n') || '';
      const styleText = character?.style?.all?.map((s) => `- ${s}`).join('\n') || '';

      const systemPrompt = `You are ${agent.name} — ${agent.description}.

${bioText ? `Your background:\n${bioText}\n` : ''}
${knowledgeText ? `Your knowledge:\n${knowledgeText}\n` : ''}
${styleText ? `Your style:\n${styleText}\n` : ''}
You have been asked to contribute a supplementary analysis to the "${sectionLabel}" section of an operational design. Provide your unique perspective based on your expertise.

CRITICAL: Respond ONLY with a JSON object: { "analysis": "your analysis paragraph", "confidence": 0.0-1.0, "keyPoints": ["point1", "point2", ...] }`;

      const strategicCtxBlock = strategicContext
        ? `\n\nStrategic Context (from uploaded documents):\n${strategicContext.substring(0, 2000)}\n`
        : '';

      const userPrompt = `Provide your supplementary analysis for this ${sectionLabel} section.

Problem Set ID: ${problemSetId}
${strategicCtxBlock}
Section Data:
${contextSummary}

Based on your expertise, what insights, risks, blind spots, or alternative considerations should the planning team be aware of? Focus on what the primary analyst might miss given your specialized perspective.`;

      const llm = await createLLMForAgent({
        agentId,
        overrides: { temperature: 0.4, maxTokens: 1500 },
      });

      const response = await llm.invoke([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const text = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      // Parse JSON response
      let cleaned = text.trim();
      const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (codeBlockMatch) {
        cleaned = codeBlockMatch[1].trim();
      }

      try {
        const parsed = JSON.parse(cleaned) as {
          analysis?: string;
          confidence?: number;
          keyPoints?: string[];
        };
        return {
          agentId,
          agentName: agent.name,
          analysis: parsed.analysis || text,
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
          keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
        };
      } catch {
        // If JSON parse fails, use raw text
        return {
          agentId,
          agentName: agent.name,
          analysis: text,
          confidence: 0.5,
          keyPoints: [],
        };
      }
    } catch (err) {
      console.error(`[design] Additional agent ${agentId} analysis failed:`, err);
      return null;
    }
  });

  const results = await Promise.all(promises);
  return results.filter((r): r is AgentContribution => r !== null);
}

// ─── Map Overlay Endpoints (Phase 56) ──────────────────────────────────────

/**
 * GET /api/design/:problemSetId/map-overlay
 * Returns the current MapOverlay JSON.
 */
router.get('/:problemSetId/map-overlay', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const overlay = await designStore.getMapOverlay(problemSetId);
    res.json(overlay);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] GET /${req.params.problemSetId}/map-overlay failed:`, message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/design/:problemSetId/map-overlay
 * Performs an action on the map overlay.
 * Body: { action: 'add_symbol' | 'move_symbol' | 'remove_symbol' | 'update_symbol' | 'add_control_measure' | 'remove_control_measure' | 'set_overlay', data: object }
 * Returns the updated MapOverlay.
 */
router.patch('/:problemSetId/map-overlay', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { action, data } = req.body as { action: string; data: Record<string, unknown> };

    if (!action) {
      res.status(400).json({ error: 'Missing required field: action' });
      return;
    }

    switch (action) {
      case 'add_symbol': {
        await designStore.addMapSymbol(problemSetId, data as unknown as MapSymbol);
        break;
      }
      case 'move_symbol': {
        const { symbolId, lat, lng } = data as { symbolId: string; lat: number; lng: number };
        await designStore.moveMapSymbol(problemSetId, symbolId, lat, lng);
        break;
      }
      case 'remove_symbol': {
        const { symbolId } = data as { symbolId: string };
        await designStore.removeMapSymbol(problemSetId, symbolId);
        break;
      }
      case 'update_symbol': {
        const { symbolId, ...updates } = data as { symbolId: string } & Partial<MapSymbol>;
        await designStore.updateMapSymbol(problemSetId, symbolId, updates);
        break;
      }
      case 'add_control_measure': {
        await designStore.addControlMeasure(problemSetId, data as unknown as ControlMeasure);
        break;
      }
      case 'remove_control_measure': {
        const { measureId } = data as { measureId: string };
        await designStore.removeControlMeasure(problemSetId, measureId);
        break;
      }
      case 'set_overlay': {
        await designStore.setMapOverlay(problemSetId, data as unknown as Parameters<typeof designStore.setMapOverlay>[1]);
        break;
      }
      default:
        res.status(400).json({ error: `Unknown map overlay action: ${action}` });
        return;
    }

    const updated = await designStore.getMapOverlay(problemSetId);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[design] PATCH /${req.params.problemSetId}/map-overlay failed:`, message);
    res.status(500).json({ error: message });
  }
});

export default router;
