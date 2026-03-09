/**
 * Document Intelligence Team Setup
 *
 * Registers the document intelligence team and all 11 specialist agents
 * (including the orchestrator) via the TeamRegistry singleton. Call
 * `registerDocIntelligenceTeam()` during application startup to ensure
 * all specialist agents are available for the orchestrator.
 */

import { getTeamRegistry } from '../agents/team-registry.js';
import type { AgentTeamInput } from '../agents/character-schema.js';

// ============================================================================
// Team Configuration
// ============================================================================

const DOC_INTELLIGENCE_TEAM_ID = 'doc-intelligence-team';

/**
 * Specialist agent definitions for the document intelligence team.
 * Each specialist maps to a LangGraph node in the orchestrator StateGraph.
 */
const SPECIALIST_DEFINITIONS: Array<{
  agentId: string;
  role: 'coordinator' | 'specialist' | 'validator' | 'executor';
  name: string;
  description: string;
  responsibilities: string[];
  canInitiate: boolean;
  canEscalate: boolean;
}> = [
  {
    agentId: 'doc-orchestrator',
    role: 'coordinator',
    name: 'Document Orchestrator',
    description: 'Central coordinator that triages documents and dispatches to specialist agents',
    responsibilities: [
      'Triage incoming documents via LLM',
      'Select appropriate specialists based on document type',
      'Coordinate parallel specialist execution',
      'Assemble unified intelligence report',
    ],
    canInitiate: true,
    canEscalate: true,
  },
  {
    agentId: 'doc-format-converter',
    role: 'specialist',
    name: 'Format Converter',
    description: 'Handles OCR for scanned PDFs, language detection, and encoding normalization',
    responsibilities: [
      'OCR for scanned documents',
      'Language detection and flagging',
      'Table and chart detection',
      'Encoding normalization',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-document-classifier',
    role: 'specialist',
    name: 'Document Classifier',
    description: 'LLM-driven classification of document type, relevance, and container placement',
    responsibilities: [
      'Classify document type from taxonomy',
      'Score relevance against problem set scope',
      'Suggest container placement',
      'Identify key topics',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-fact-extractor',
    role: 'specialist',
    name: 'Fact Extractor',
    description: 'Extracts named entities, dates, locations, claims with source attribution',
    responsibilities: [
      'Extract named entities',
      'Identify dates and temporal references',
      'Extract locations and geospatial context',
      'Identify claims and assertions with evidence',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-objective-extractor',
    role: 'specialist',
    name: 'Objective Extractor',
    description: 'Extracts strategic objectives from military and policy documents',
    responsibilities: [
      'Identify stated objectives',
      'Extract implied goals',
      'Map objective hierarchies',
      'Link objectives to actors',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-perspective-analyst',
    role: 'specialist',
    name: 'Perspective Analyst',
    description: 'Analyzes documents from specific perspectives (friendly/adversary/neutral/partner)',
    responsibilities: [
      'Analyze implications per perspective',
      'Identify opportunities and threats',
      'Highlight unknowns requiring collection',
      'Assess perspective-specific impacts',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-cross-doc-linker',
    role: 'specialist',
    name: 'Cross-Document Linker',
    description: 'Detects corroboration, contradiction, and references between documents',
    responsibilities: [
      'Identify cross-document entity matches',
      'Detect corroborating evidence',
      'Flag contradictions between sources',
      'Build inter-document reference graph',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-bias-identifier',
    role: 'specialist',
    name: 'Bias Identifier',
    description: 'Detects framing bias, propaganda indicators, and information operations markers',
    responsibilities: [
      'Identify source framing and bias',
      'Detect propaganda indicators',
      'Flag information operations markers',
      'Assess narrative manipulation',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-quality-assessor',
    role: 'validator',
    name: 'Quality Assessor',
    description: 'Applies NATO Admiralty System ratings for source reliability and information credibility',
    responsibilities: [
      'Apply NATO A-F source reliability rating',
      'Apply NATO 1-6 information credibility rating',
      'Check internal consistency',
      'Flag items requiring human review',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-trust-agent',
    role: 'validator',
    name: 'Trust Agent',
    description: 'Evaluates source reliability, maintains source registry, and flags questionable sources',
    responsibilities: [
      'Evaluate source trustworthiness',
      'Maintain source trust registry',
      'Consult known trusted/untrusted lists',
      'Flag below-threshold sources for human review',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'doc-researcher',
    role: 'specialist',
    name: 'Problem Set Researcher',
    description: 'Fills knowledge gaps via OSINT monitoring and targeted research',
    responsibilities: [
      'Detect knowledge gaps during extraction',
      'Execute targeted OSINT research',
      'Schedule periodic monitoring',
      'Feed research products back into pipeline',
    ],
    canInitiate: true,
    canEscalate: true,
  },
];

// ============================================================================
// Registration Function
// ============================================================================

/**
 * Register the document intelligence team with the TeamRegistry.
 *
 * Call this during application startup. The function is idempotent --
 * if the team is already registered, it will skip registration.
 *
 * @returns The registered team ID
 */
export async function registerDocIntelligenceTeam(): Promise<string> {
  const registry = getTeamRegistry();
  await registry.ensureInitialized();

  // Skip if already registered
  const existing = registry.getTeam(DOC_INTELLIGENCE_TEAM_ID);
  if (existing) {
    console.log(`[DocIntelligence] Team ${DOC_INTELLIGENCE_TEAM_ID} already registered`);
    return DOC_INTELLIGENCE_TEAM_ID;
  }

  const teamInput: AgentTeamInput = {
    teamId: DOC_INTELLIGENCE_TEAM_ID,
    name: 'Document Intelligence Team',
    description: 'Autonomous multi-agent team for document processing, classification, and intelligence extraction',
    purpose: 'Process uploaded documents through specialist agents to extract structured intelligence, assess quality via NATO standards, build knowledge graph entities, and produce unified intelligence reports',
    members: SPECIALIST_DEFINITIONS.map(spec => ({
      agentId: spec.agentId,
      role: spec.role,
      responsibilities: spec.responsibilities,
      canInitiate: spec.canInitiate,
      canEscalate: spec.canEscalate,
    })),
    workflow: {
      type: 'hierarchical' as const,
      stages: [
        {
          stageId: 'triage',
          name: 'Document Triage',
          assignedAgents: ['doc-orchestrator'],
          nextStages: ['conversion', 'classification'],
          timeout: 60,
        },
        {
          stageId: 'conversion',
          name: 'Format Conversion',
          assignedAgents: ['doc-format-converter'],
          nextStages: ['classification'],
          timeout: 120,
        },
        {
          stageId: 'classification',
          name: 'Document Classification',
          assignedAgents: ['doc-document-classifier'],
          nextStages: ['extraction'],
          timeout: 60,
        },
        {
          stageId: 'extraction',
          name: 'Parallel Extraction',
          assignedAgents: [
            'doc-fact-extractor',
            'doc-objective-extractor',
            'doc-perspective-analyst',
            'doc-bias-identifier',
          ],
          nextStages: ['linking'],
          timeout: 120,
        },
        {
          stageId: 'linking',
          name: 'Cross-Document Linking',
          assignedAgents: ['doc-cross-doc-linker'],
          nextStages: ['assessment'],
          timeout: 60,
        },
        {
          stageId: 'assessment',
          name: 'Quality Assessment',
          assignedAgents: ['doc-quality-assessor', 'doc-trust-agent'],
          nextStages: [],
          timeout: 60,
        },
      ],
      humanCheckpoints: [],
    },
    sharedContext: ['problemSetContext', 'triageDecision', 'documentMetadata'],
    escalationPolicy: {
      enabled: true,
      timeoutSeconds: 600,
      targets: ['doc-orchestrator'],
      notificationChannels: ['webhook'],
    },
    maxConcurrency: 10,
    isEnabled: true,
  };

  try {
    await registry.createTeam(teamInput, 'doc-intelligence-team');
    console.log(`[DocIntelligence] Team ${DOC_INTELLIGENCE_TEAM_ID} registered with ${SPECIALIST_DEFINITIONS.length} specialists`);
  } catch (error) {
    // If agents aren't registered yet, log and continue - they'll be registered later
    console.warn(`[DocIntelligence] Team registration deferred: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  return DOC_INTELLIGENCE_TEAM_ID;
}
