/**
 * Shared types for the BASTION log monitor agent.
 *
 * Quick task 260406-lkq: Build Log Monitor Agent
 */

// ---------------------------------------------------------------------------
// Container names
// ---------------------------------------------------------------------------

export const MonitoredContainer = {
  FRONTEND: 'bastion-frontend',
  BACKEND: 'bastion-backend',
  IRONCLAW: 'bastion-ironclaw',
  MCP: 'bastion-mcp',
} as const;

export type MonitoredContainerName =
  (typeof MonitoredContainer)[keyof typeof MonitoredContainer];

export const ALL_CONTAINERS: MonitoredContainerName[] = [
  MonitoredContainer.FRONTEND,
  MonitoredContainer.BACKEND,
  MonitoredContainer.IRONCLAW,
  MonitoredContainer.MCP,
];

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export interface LogEntry {
  container: string;
  timestamp: Date;
  level: 'error' | 'warn' | 'info';
  message: string;
  raw: string;
}

export interface ErrorSignature {
  container: string;
  pattern: string;
  fingerprint: string;
  firstSeen: Date;
  count: number;
  sampleLines: string[];
}

export interface InvestigationResult {
  error: ErrorSignature;
  rootCause: string;
  suggestedFix: string;
  files: Array<{ path: string; content: string }>;
  confidence: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface MonitorConfig {
  containers: string[];
  errorCooldownMs: number;
  maxPRsPerHour: number;
  dryRun: boolean;
}

export const DEFAULT_MONITOR_CONFIG: MonitorConfig = {
  containers: [...ALL_CONTAINERS],
  errorCooldownMs: 30 * 60 * 1000, // 30 minutes
  maxPRsPerHour: 3,
  dryRun: false,
};

// ---------------------------------------------------------------------------
// Container -> source directory mapping
// ---------------------------------------------------------------------------

export const CONTAINER_SOURCE_MAP: Record<string, string> = {
  'bastion-frontend': 'frontend/src/',
  'bastion-backend': 'backend/src/',
  'bastion-ironclaw': 'ironclaw/',
  'bastion-mcp': 'backend/src/mcp/',
};
