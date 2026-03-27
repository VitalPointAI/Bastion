/**
 * Knowledge Graph Team Setup
 *
 * Registers the knowledge graph agent team with the TeamRegistry.
 * Groups the 7 graph-processing agents (RAFT Extraction, RAFT Reasoning,
 * Strategic Fusion, Entity Resolution, Validity Assessment, OSINT Monitor,
 * Conflict Detection) plus the Strategy Document Reviewer into a managed
 * team with defined workflow stages.
 *
 * Call `registerKnowledgeGraphTeam()` during application startup.
 */

import { getTeamRegistry } from '../agents/team-registry.js';
import type { AgentTeamInput } from '../agents/character-schema.js';

const KNOWLEDGE_GRAPH_TEAM_ID = 'knowledge-graph-team';

/**
 * Knowledge graph agent definitions matching the agents seeded in agent-seeder.ts.
 */
const AGENT_DEFINITIONS: Array<{
  agentId: string;
  role: 'coordinator' | 'specialist' | 'validator' | 'executor';
  responsibilities: string[];
  canInitiate: boolean;
  canEscalate: boolean;
}> = [
  {
    agentId: 'raft-extraction-agent',
    role: 'specialist',
    responsibilities: [
      'Extract actors, relationships, and tensions from documents',
      'Classify actor types and relationship semantics',
      'Assign edge weights based on documentary evidence',
      'Flag uncertain extractions for human review',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'raft-reasoning-agent',
    role: 'specialist',
    responsibilities: [
      'Apply structured reasoning to extracted intelligence data',
      'Generate traceable reasoning chains with supporting evidence',
      'Run network analysis (PageRank, eigenvector centrality, clustering)',
      'Assess alternative hypotheses and assign probability weights',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'strategic-fusion-agent',
    role: 'coordinator',
    responsibilities: [
      'Consolidate objectives from multiple strategic documents',
      'Identify semantic duplicates while preserving unique perspectives',
      'Detect conflicts and contradictions between strategic objectives',
      'Synthesize unified objectives with source traceability',
    ],
    canInitiate: true,
    canEscalate: true,
  },
  {
    agentId: 'entity-resolution-agent',
    role: 'specialist',
    responsibilities: [
      'Identify when different names/aliases refer to the same entity',
      'Maintain confidence scores for entity resolution decisions',
      'Merge duplicate actor nodes while preserving provenance',
      'Flag ambiguous cases for human review',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'validity-assessment-agent',
    role: 'validator',
    responsibilities: [
      'Evaluate logical validity of analytical conclusions',
      'Assess quality and sufficiency of supporting evidence',
      'Calculate and track validity scores over time',
      'Identify alternative explanations not considered',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'osint-monitor-agent',
    role: 'specialist',
    responsibilities: [
      'Monitor open sources for relevant intelligence indicators',
      'Assess credibility and relevance of OSINT findings using NATO scale',
      'Cross-reference OSINT with existing graph entities',
      'Flag high-priority intelligence for immediate human review',
    ],
    canInitiate: true,
    canEscalate: true,
  },
  {
    agentId: 'conflict-detection-agent',
    role: 'validator',
    responsibilities: [
      'Identify contradictory assertions within the knowledge graph',
      'Flag resource allocation conflicts across planning products',
      'Detect timeline incompatibilities in synchronized operations',
      'Propose conflict resolution options for human decision',
    ],
    canInitiate: false,
    canEscalate: true,
  },
  {
    agentId: 'strategy-document-reviewer',
    role: 'specialist',
    responsibilities: [
      'Review strategic documents for doctrinal alignment with JP 5-0',
      'Categorize objectives by MIDLIFE instrument of power',
      'Assess priority levels based on Ends-Ways-Means analysis',
      'Flag inconsistencies, gaps, and assumptions for human review',
    ],
    canInitiate: false,
    canEscalate: true,
  },
];

/**
 * Register the knowledge graph team with the TeamRegistry.
 *
 * Idempotent — skips if team already exists.
 *
 * @returns The registered team ID
 */
export async function registerKnowledgeGraphTeam(): Promise<string> {
  const registry = getTeamRegistry();
  await registry.ensureInitialized();

  const existing = registry.getTeam(KNOWLEDGE_GRAPH_TEAM_ID);
  if (existing) {
    console.log(`[KnowledgeGraph] Team ${KNOWLEDGE_GRAPH_TEAM_ID} already registered`);
    return KNOWLEDGE_GRAPH_TEAM_ID;
  }

  const teamInput: AgentTeamInput = {
    teamId: KNOWLEDGE_GRAPH_TEAM_ID,
    name: 'Knowledge Graph Team',
    description: 'Agent team responsible for building, maintaining, and analyzing the RAFT knowledge graph from ingested intelligence',
    purpose: 'Extract entities and relationships from documents, resolve duplicates, detect contradictions, assess validity, monitor OSINT sources, and maintain the strategic intelligence graph that powers the Understand tab brain visualization',
    members: AGENT_DEFINITIONS.map(spec => ({
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
          stageId: 'extraction',
          name: 'Entity & Relationship Extraction',
          assignedAgents: ['raft-extraction-agent', 'strategy-document-reviewer'],
          nextStages: ['resolution', 'reasoning'],
          timeout: 120,
        },
        {
          stageId: 'resolution',
          name: 'Entity Resolution & Deduplication',
          assignedAgents: ['entity-resolution-agent'],
          nextStages: ['fusion'],
          timeout: 60,
        },
        {
          stageId: 'fusion',
          name: 'Strategic Objective Fusion',
          assignedAgents: ['strategic-fusion-agent'],
          nextStages: ['validation'],
          timeout: 90,
        },
        {
          stageId: 'reasoning',
          name: 'Graph Reasoning & Network Analysis',
          assignedAgents: ['raft-reasoning-agent'],
          nextStages: ['validation'],
          timeout: 120,
        },
        {
          stageId: 'validation',
          name: 'Validity & Conflict Assessment',
          assignedAgents: ['validity-assessment-agent', 'conflict-detection-agent'],
          nextStages: ['monitoring'],
          timeout: 60,
        },
        {
          stageId: 'monitoring',
          name: 'Continuous OSINT Monitoring',
          assignedAgents: ['osint-monitor-agent'],
          nextStages: ['extraction'],
          timeout: 300,
        },
      ],
      humanCheckpoints: [],
    },
    sharedContext: ['workspaceId', 'graphState', 'contradictions', 'validityScores'],
    escalationPolicy: {
      enabled: true,
      timeoutSeconds: 600,
      targets: ['strategic-fusion-agent'],
      notificationChannels: ['webhook'],
    },
    maxConcurrency: 8,
    isEnabled: true,
  };

  try {
    await registry.createTeam(teamInput, 'knowledge-graph-team');
    console.log(`[KnowledgeGraph] Team ${KNOWLEDGE_GRAPH_TEAM_ID} registered with ${AGENT_DEFINITIONS.length} agents`);
  } catch (error) {
    console.warn(`[KnowledgeGraph] Team registration deferred: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  return KNOWLEDGE_GRAPH_TEAM_ID;
}
