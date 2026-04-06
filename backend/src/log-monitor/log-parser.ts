/**
 * Docker log stream parser and error pattern detector.
 *
 * Quick task 260406-lkq: Build Log Monitor Agent
 */

import { createHash } from 'crypto';
import type { LogEntry } from './types.js';

// ---------------------------------------------------------------------------
// Error detection patterns
// ---------------------------------------------------------------------------

/** Patterns that indicate an error-level log line. */
const ERROR_PATTERNS: RegExp[] = [
  /Error:/,
  /TypeError:/,
  /ReferenceError:/,
  /SyntaxError:/,
  /RangeError:/,
  /FATAL/,
  /ECONNREFUSED/,
  /ENOENT/,
  /EACCES/,
  /UnhandledPromiseRejection/,
  /\bERR!/,
  /\bpanic\b/,
  /SIGTERM/,
  /OOM/,
  /segfault/,
  /\[ERROR\]/i,
  /\berror:/i,
  /Unhandled exception/i,
  /uncaughtException/,
  /Process exit/,
  /Cannot find module/,
  /Module not found/,
  /EADDRINUSE/,
];

/** Patterns that indicate a stack trace continuation line. */
const STACK_TRACE_PATTERNS: RegExp[] = [
  /^\s{4}at /,
  /^\s+at\s/,
  /\(.*:\d+:\d+\)$/,
];

/** Known noise patterns — these are not real errors during startup/operation. */
const NOISE_PATTERNS: RegExp[] = [
  // Health check probe failures during boot
  /health.?check.*fail/i,
  /healthcheck.*fail/i,
  // Normal connection retry during container boot
  /ECONNREFUSED.*retry/i,
  /Retrying connection/i,
  /Waiting for.*to be ready/i,
  /Waiting for database/i,
  // Docker/compose startup noise
  /Container .* Starting/i,
  /Container .* Started/i,
  // Normal PostgreSQL startup messages
  /database system is ready/i,
  /database system was shut down/i,
  /autovacuum launcher started/i,
];

// ---------------------------------------------------------------------------
// LogParser
// ---------------------------------------------------------------------------

export class LogParser {
  /** Map of fingerprint -> time last seen (for deduplication). */
  private seenFingerprints = new Map<string, Date>();

  private errorCooldownMs: number;

  constructor(errorCooldownMs: number = 30 * 60 * 1000) {
    this.errorCooldownMs = errorCooldownMs;
  }

  /**
   * Parse a single Docker log line into a LogEntry.
   * Returns null if the line should be ignored.
   */
  parseLogLine(container: string, line: string): LogEntry | null {
    if (!line || !line.trim()) return null;

    // Docker log format: "2024-01-01T12:00:00.000000000Z <message>"
    // or just plain text
    let timestamp = new Date();
    let message = line;

    const isoMatch = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)/.exec(
      line,
    );
    if (isoMatch) {
      const parsed = new Date(isoMatch[1]);
      if (!isNaN(parsed.getTime())) {
        timestamp = parsed;
      }
      message = isoMatch[2];
    }

    // Classify level
    const level = this.detectLevel(message);

    return {
      container,
      timestamp,
      level,
      message,
      raw: line,
    };
  }

  /**
   * Produce a stable fingerprint from an error message.
   * Normalizes out variable parts: timestamps, UUIDs, port numbers, file paths,
   * memory addresses, and stack offsets — so the same underlying error always
   * hashes identically.
   */
  computeFingerprint(entry: LogEntry): string {
    let normalized = entry.message;

    // Strip ISO timestamps
    normalized = normalized.replace(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,
      '<ts>',
    );
    // Strip unix timestamps (10+ digits)
    normalized = normalized.replace(/\b\d{10,13}\b/g, '<epoch>');
    // Strip UUIDs
    normalized = normalized.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '<uuid>',
    );
    // Strip memory addresses (0x...)
    normalized = normalized.replace(/0x[0-9a-f]+/gi, '<addr>');
    // Strip port numbers in connection strings
    normalized = normalized.replace(/:\d{4,5}\b/g, ':<port>');
    // Strip line:col offsets from stack traces (but keep the filename)
    normalized = normalized.replace(/:\d+:\d+\)?$/gm, ':<loc>');
    // Normalize repeated digits to reduce variation in numbers
    normalized = normalized.replace(/\b\d+\b/g, '<n>');

    // Include container in the fingerprint so the same error in different
    // containers is treated as separate signatures.
    const input = `${entry.container}:${normalized}`;
    return createHash('sha256').update(input).digest('hex');
  }

  /**
   * Return true only if this fingerprint has NOT been seen within the
   * cooldown window. Prunes stale entries older than 1 hour.
   */
  isNewError(fingerprint: string): boolean {
    this.pruneOldFingerprints();

    const lastSeen = this.seenFingerprints.get(fingerprint);
    if (!lastSeen) {
      this.seenFingerprints.set(fingerprint, new Date());
      return true;
    }

    const elapsed = Date.now() - lastSeen.getTime();
    if (elapsed > this.errorCooldownMs) {
      // Reset the cooldown — it's effectively a new occurrence
      this.seenFingerprints.set(fingerprint, new Date());
      return true;
    }

    return false;
  }

  /**
   * Starting at `startIndex`, collect subsequent stack trace lines from
   * the provided line buffer. Stops at the first non-stack-trace line or
   * end of buffer.
   */
  collectStackTrace(
    _container: string,
    lines: string[],
    startIndex: number,
  ): string[] {
    const result: string[] = [];

    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) break;

      const isStackLine = STACK_TRACE_PATTERNS.some((p) => p.test(line));
      if (!isStackLine) break;

      result.push(line);
    }

    return result;
  }

  /**
   * Determine if a log line is a known noise pattern that should be ignored.
   */
  isNoiseLine(message: string): boolean {
    return NOISE_PATTERNS.some((p) => p.test(message));
  }

  /**
   * Determine if a log line matches any error pattern.
   */
  isErrorLine(message: string): boolean {
    if (this.isNoiseLine(message)) return false;
    if (STACK_TRACE_PATTERNS.some((p) => p.test(message))) return false;
    return ERROR_PATTERNS.some((p) => p.test(message));
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private detectLevel(message: string): 'error' | 'warn' | 'info' {
    if (this.isNoiseLine(message)) return 'info';

    if (ERROR_PATTERNS.some((p) => p.test(message))) return 'error';

    if (
      /\[WARN\]/i.test(message) ||
      /\bwarn:/i.test(message) ||
      /WARNING/i.test(message) ||
      /\bwarn\b/i.test(message)
    ) {
      return 'warn';
    }

    return 'info';
  }

  private pruneOldFingerprints(): void {
    const ONE_HOUR = 60 * 60 * 1000;
    const cutoff = Date.now() - ONE_HOUR;

    for (const [fingerprint, date] of this.seenFingerprints.entries()) {
      if (date.getTime() < cutoff) {
        this.seenFingerprints.delete(fingerprint);
      }
    }
  }
}
