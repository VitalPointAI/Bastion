/**
 * Agent Routing Configuration
 *
 * Static doctrinal defaults for agent-to-tab mapping.
 * Each tab starts with doctrinally aligned default agents.
 * Users can augment with additional agents via TabAgentConfig.
 */

import type { ProblemSetTab, TabAgentConfig } from '../../types/ai-staff.ts';

// ============================================================================
// Tab Classification
// ============================================================================

/** Process tabs: AI guides the user through the workflow (docked sidebar) */
export const PROCESS_TABS = ['understand', 'design', 'plan'] as const;

/** Watch tabs: AI watches and signals actionable items (floating overlay) */
export const WATCH_TABS = ['cop', 'assess', 'direct'] as const;

// ============================================================================
// Tab Type Guards
// ============================================================================

export function isProcessTab(tab: string): tab is (typeof PROCESS_TABS)[number] {
  return (PROCESS_TABS as readonly string[]).includes(tab);
}

export function isWatchTab(tab: string): tab is (typeof WATCH_TABS)[number] {
  return (WATCH_TABS as readonly string[]).includes(tab);
}

// ============================================================================
// Default Agent-to-Tab Mapping
// ============================================================================

/**
 * Doctrinally aligned default agents per tab.
 * Agent IDs correspond to existing agent registry manifests.
 *
 * Understand: Intelligence preparation -- fusion, OSINT, entity resolution, bias detection, extraction
 * Design: Operational design -- problem framing, COG analysis, LOE gap analysis, assumptions, narrative
 * Plan: Course of action development -- COA gen, red team, adversary modeling, effects, escalation, ROE
 * Direct: Orders and execution -- orders validation, conflict detection, deception detection
 * COP: Common operating picture -- fusion, OSINT monitoring, coalition health
 * Assess: Assessment and adaptation -- assumption auditing, effect cascading, escalation modeling
 */
export const DEFAULT_TAB_AGENTS: Record<ProblemSetTab, string[]> = {
  understand: [
    'strategic_fusion',
    'osint_monitor',
    'entity_resolution',
    'data_bias_detector',
    'raft_extraction',
  ],
  design: [
    'problem_framing',
    'cog_analysis',
    'loe_gap_analysis',
    'assumption_auditor',
    'narrative_synthesis',
  ],
  plan: [
    'coa_generator',
    'red_team_simulator',
    'adversary_modeler',
    'effect_cascader',
    'escalation_modeler',
    'roe_compliance',
  ],
  direct: [
    'orders_validator',
    'conflict_detection',
    'deception_detector',
  ],
  cop: [
    'strategic_fusion',
    'osint_monitor',
    'coalition_health',
  ],
  assess: [
    'assumption_auditor',
    'effect_cascader',
    'escalation_modeler',
  ],
};

// ============================================================================
// Helper: Build initial TabAgentConfig
// ============================================================================

/**
 * Create a default TabAgentConfig for a given tab.
 * User-added agents start empty.
 */
export function getDefaultTabConfig(tabId: ProblemSetTab): TabAgentConfig {
  return {
    tabId,
    defaultAgents: DEFAULT_TAB_AGENTS[tabId] ?? [],
    userAddedAgents: [],
  };
}
