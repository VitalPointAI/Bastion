/**
 * Log Monitor Service
 *
 * Quick task 260406-lkq: Build Log Monitor Agent
 *
 * Tails Docker container logs via the Docker Engine API unix socket,
 * detects errors, investigates them with Claude, and submits fix PRs
 * via the existing GitHubService.
 *
 * Security:
 *   T-lm-02: Docker socket is inherently privileged — accepted risk.
 *   T-lm-03: PR rate-limited (default 3/hr) + error deduplication (30 min cooldown)
 *             + investigation queue capped at 20 items.
 */

import http from 'http';
import { access } from 'fs/promises';
import { LogParser } from './log-parser.js';
import { ErrorInvestigator } from './error-investigator.js';
import type { MonitorConfig, ErrorSignature } from './types.js';
import { DEFAULT_MONITOR_CONFIG } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RECONNECT_DELAY_MS = 5_000;
const QUEUE_PROCESS_INTERVAL_MS = 10_000;
const MAX_QUEUE_SIZE = 20; // T-lm-03: prevent unbounded queue growth
const PR_WINDOW_MS = 60 * 60 * 1000; // 1 hour sliding window for rate limiting

// ---------------------------------------------------------------------------
// LogMonitorService
// ---------------------------------------------------------------------------

export class LogMonitorService {
  private config: MonitorConfig;
  private logParser: LogParser;
  private errorInvestigator: ErrorInvestigator | null = null;

  /** FIFO queue of detected errors awaiting investigation. */
  private errorQueue: ErrorSignature[] = [];

  /** Sliding window of PR creation timestamps for rate limiting. */
  private prTimestamps: Date[] = [];

  /** AbortControllers for active tail connections (one per container). */
  private tailAbortControllers = new Map<string, AbortController>();

  /** Queue processor interval handle. */
  private queueInterval: ReturnType<typeof setInterval> | null = null;

  /** Unix timestamp when the service started (for `since` parameter). */
  private startTimestamp: number = 0;

  constructor(config?: Partial<MonitorConfig>) {
    this.config = { ...DEFAULT_MONITOR_CONFIG, ...config };
    this.logParser = new LogParser(this.config.errorCooldownMs);
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  async start(): Promise<void> {
    this.startTimestamp = Math.floor(Date.now() / 1000);

    // 1. Validate Docker socket
    try {
      await access('/var/run/docker.sock');
    } catch {
      console.error(
        '[LogMonitor] ERROR: /var/run/docker.sock is not accessible. ' +
          'Mount the Docker socket to use the log monitor: -v /var/run/docker.sock:/var/run/docker.sock',
      );
      process.exit(1);
    }

    // 2. Validate Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!anthropicKey) {
      console.error(
        '[LogMonitor] ERROR: ANTHROPIC_API_KEY is not set. ' +
          'The log monitor requires Claude to investigate errors.',
      );
      process.exit(1);
    }
    this.errorInvestigator = new ErrorInvestigator(anthropicKey);

    // 3. Check GitHub token — degrade to dry-run if missing
    const { githubService } = await import('../ironclaw/github-service.js');
    if (!githubService.isConfigured()) {
      console.warn(
        '[LogMonitor] WARNING: GITHUB_TOKEN not set — running in dry-run mode (no PRs will be created)',
      );
      this.config.dryRun = true;
    }

    // 4. Start tailing all configured containers
    for (const container of this.config.containers) {
      this.tailContainer(container);
    }

    // 5. Start queue processor
    this.queueInterval = setInterval(() => {
      void this.processErrorQueue();
    }, QUEUE_PROCESS_INTERVAL_MS);

    console.log(
      `[LogMonitor] Started. Monitoring containers: ${this.config.containers.join(', ')}. ` +
        `Dry-run: ${this.config.dryRun}. Max PRs/hour: ${this.config.maxPRsPerHour}.`,
    );
  }

  async stop(): Promise<void> {
    // Abort all tail streams
    for (const [container, controller] of this.tailAbortControllers.entries()) {
      controller.abort();
      console.log(`[LogMonitor] Stopped tailing ${container}`);
    }
    this.tailAbortControllers.clear();

    // Stop queue processor
    if (this.queueInterval) {
      clearInterval(this.queueInterval);
      this.queueInterval = null;
    }

    console.log('[LogMonitor] Shutdown complete.');
  }

  // ---------------------------------------------------------------------------
  // Docker log tail
  // ---------------------------------------------------------------------------

  /**
   * Begin tailing a container's logs via the Docker Engine unix socket API.
   * The Docker log stream uses a multiplexed format: each frame has an 8-byte
   * header where byte 0 is the stream type (1=stdout, 2=stderr) and bytes 4-7
   * are the frame payload size as a uint32 big-endian integer.
   *
   * On error or stream close, reconnects after RECONNECT_DELAY_MS.
   */
  private tailContainer(containerName: string): void {
    const controller = new AbortController();
    this.tailAbortControllers.set(containerName, controller);

    const doTail = (): void => {
      if (controller.signal.aborted) return;

      const path = `/containers/${encodeURIComponent(containerName)}/logs` +
        `?follow=true&stdout=true&stderr=true&since=${this.startTimestamp}&tail=100`;

      const options: http.RequestOptions = {
        socketPath: '/var/run/docker.sock',
        path,
        method: 'GET',
        headers: { Accept: 'application/json' },
      };

      const req = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          console.warn(
            `[LogMonitor] Docker API returned ${res.statusCode} for ${containerName}. ` +
              'Container may not be running. Will retry.',
          );
          res.resume(); // Drain the response
          scheduleReconnect();
          return;
        }

        // Ring buffer for partial frame data
        let pending = Buffer.alloc(0);

        res.on('data', (chunk: Buffer) => {
          pending = Buffer.concat([pending, chunk]);

          // Process complete Docker log frames
          while (pending.length >= 8) {
            // Read the 8-byte frame header
            const frameSize = pending.readUInt32BE(4);
            const totalFrameSize = 8 + frameSize;

            if (pending.length < totalFrameSize) break; // Incomplete frame

            // Extract frame payload (skip the 8-byte header)
            const payload = pending.subarray(8, totalFrameSize);
            pending = pending.subarray(totalFrameSize);

            // Decode payload and split into lines
            const text = payload.toString('utf-8');
            const lines = text.split('\n');

            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (!line.trim()) continue;

              const entry = this.logParser.parseLogLine(containerName, line);
              if (!entry) continue;
              if (entry.level !== 'error') continue;
              if (!this.logParser.isErrorLine(entry.message)) continue;

              // Fingerprint and check cooldown
              const fingerprint = this.logParser.computeFingerprint(entry);
              if (!this.logParser.isNewError(fingerprint)) {
                // Duplicate within cooldown window — skip
                continue;
              }

              // Collect stack trace from remaining lines in this chunk
              const stackLines = this.logParser.collectStackTrace(containerName, lines, i);
              const sampleLines = [line, ...stackLines].slice(0, 20);

              const signature: ErrorSignature = {
                container: containerName,
                pattern: entry.message.slice(0, 200),
                fingerprint,
                firstSeen: entry.timestamp,
                count: 1,
                sampleLines,
              };

              // Cap queue size (T-lm-03: DoS protection)
              if (this.errorQueue.length >= MAX_QUEUE_SIZE) {
                console.warn(
                  `[LogMonitor] Error queue full (${MAX_QUEUE_SIZE} items). Dropping oldest entry.`,
                );
                this.errorQueue.shift();
              }

              this.errorQueue.push(signature);
              console.log(
                `[LogMonitor] Error detected in ${containerName}: ${entry.message.slice(0, 100)}`,
              );
            }
          }
        });

        res.on('error', (err) => {
          if (controller.signal.aborted) return;
          console.warn(`[LogMonitor] Stream error for ${containerName}:`, err.message);
          scheduleReconnect();
        });

        res.on('end', () => {
          if (controller.signal.aborted) return;
          console.warn(`[LogMonitor] Log stream ended for ${containerName}. Reconnecting...`);
          scheduleReconnect();
        });
      });

      req.on('error', (err) => {
        if (controller.signal.aborted) return;
        console.warn(`[LogMonitor] Request error for ${containerName}:`, err.message);
        scheduleReconnect();
      });

      // Listen for abort signal to destroy the request
      controller.signal.addEventListener('abort', () => {
        req.destroy();
      });

      req.end();
    };

    const scheduleReconnect = (): void => {
      if (controller.signal.aborted) return;
      setTimeout(() => doTail(), RECONNECT_DELAY_MS);
    };

    doTail();
  }

  // ---------------------------------------------------------------------------
  // Error queue processor
  // ---------------------------------------------------------------------------

  /**
   * Process one error at a time from the queue.
   * Dequeues, investigates with Claude, and creates a PR if confidence is
   * sufficient. Rate-limits PR creation to config.maxPRsPerHour.
   */
  private async processErrorQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;
    if (!this.errorInvestigator) return;

    const error = this.errorQueue.shift()!;

    try {
      // Check PR rate limit
      if (!this.checkPRRateLimit()) {
        console.warn(
          `[LogMonitor] PR rate limit reached (${this.config.maxPRsPerHour}/hr). ` +
            'Skipping investigation until next window.',
        );
        return;
      }

      console.log(
        `[LogMonitor] Investigating error in ${error.container}: ${error.pattern.slice(0, 80)}...`,
      );
      const result = await this.errorInvestigator.investigate(error);

      if (result.confidence === 'low' || result.files.length === 0) {
        console.log(
          `[LogMonitor] Low confidence (${result.confidence}) or no fix files — skipping PR. ` +
            `Root cause: ${result.rootCause}`,
        );
        return;
      }

      if (this.config.dryRun) {
        console.log(
          `[LogMonitor] [DRY-RUN] Would create PR for ${error.container} error.\n` +
            `  Root cause: ${result.rootCause}\n` +
            `  Confidence: ${result.confidence}\n` +
            `  Files: ${result.files.map((f) => f.path).join(', ')}`,
        );
        return;
      }

      // Create the PR via GitHubService
      const { githubService } = await import('../ironclaw/github-service.js');

      const truncatedPattern = error.pattern.slice(0, 60);
      const branchName = `${error.fingerprint.slice(0, 8)}-${Date.now()}`;
      const description = this.buildPRDescription(error, result);

      const prResult = await githubService.createPR({
        title: `fix(log-monitor): ${error.container} — ${truncatedPattern}`,
        description,
        branchName,
        files: result.files,
      });

      // Record PR timestamp for rate limiting
      this.prTimestamps.push(new Date());

      console.log(
        `[LogMonitor] PR created: ${prResult.prUrl} (confidence: ${result.confidence})`,
      );
    } catch (err) {
      console.error(
        '[LogMonitor] Error during investigation/PR creation:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Rate limiting
  // ---------------------------------------------------------------------------

  /**
   * Check whether a new PR can be created given the hourly rate limit.
   * Prunes timestamps outside the 1-hour sliding window.
   */
  private checkPRRateLimit(): boolean {
    const cutoff = Date.now() - PR_WINDOW_MS;
    this.prTimestamps = this.prTimestamps.filter((t) => t.getTime() > cutoff);
    return this.prTimestamps.length < this.config.maxPRsPerHour;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private buildPRDescription(
    error: ErrorSignature,
    result: { rootCause: string; confidence: string; files: Array<{ path: string }> },
  ): string {
    return [
      '## Automated Fix from Log Monitor',
      '',
      '### Error Details',
      `- **Container:** ${error.container}`,
      `- **First seen:** ${error.firstSeen.toISOString()}`,
      `- **Occurrences:** ${error.count}`,
      `- **Fingerprint:** \`${error.fingerprint}\``,
      '',
      '### Error Sample',
      '```',
      error.sampleLines.join('\n'),
      '```',
      '',
      '### Root Cause Analysis',
      result.rootCause,
      '',
      `**Confidence:** ${result.confidence}`,
      '',
      '### Files Changed',
      result.files.map((f) => `- \`${f.path}\``).join('\n'),
      '',
      '---',
      '_This PR was automatically generated by the BASTION Log Monitor Agent._',
      '_Review and test carefully before merging. All fixes require human approval._',
    ].join('\n');
  }
}
