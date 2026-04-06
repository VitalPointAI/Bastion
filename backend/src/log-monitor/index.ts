/**
 * Log Monitor Agent — Standalone entry point
 *
 * Quick task 260406-lkq: Build Log Monitor Agent
 *
 * Run with: node dist/log-monitor/index.js
 * Or via:   scripts/log-monitor.sh
 *
 * Environment variables:
 *   ANTHROPIC_API_KEY — required for error investigation
 *   GITHUB_TOKEN      — optional; if absent, runs in dry-run mode
 *   LOG_MONITOR_DRY_RUN=true — force dry-run mode
 *   LOG_MONITOR_MAX_PRS_PER_HOUR=3 — override PR rate limit
 *   LOG_MONITOR_COOLDOWN_MS=1800000 — override error cooldown (ms)
 */

import { LogMonitorService } from './log-monitor-service.js';

const service = new LogMonitorService({
  dryRun: process.env.LOG_MONITOR_DRY_RUN === 'true',
  maxPRsPerHour: process.env.LOG_MONITOR_MAX_PRS_PER_HOUR
    ? parseInt(process.env.LOG_MONITOR_MAX_PRS_PER_HOUR, 10)
    : undefined,
  errorCooldownMs: process.env.LOG_MONITOR_COOLDOWN_MS
    ? parseInt(process.env.LOG_MONITOR_COOLDOWN_MS, 10)
    : undefined,
});

process.on('SIGINT', () => {
  void service.stop().then(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void service.stop().then(() => process.exit(0));
});

void service.start();
