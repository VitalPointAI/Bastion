/**
 * Claude-powered error investigator.
 *
 * Reads relevant source files from the host filesystem, sends them to Claude
 * along with the error context, and returns root cause + proposed fix.
 *
 * Quick task 260406-lkq: Build Log Monitor Agent
 *
 * Security (T-lm-01): Only reads files within the project root.
 *   Never sends .env files, secrets, or credentials to Claude.
 * Security (T-lm-05): Claude JSON response is strictly validated before use.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { resolve, normalize, relative } from 'path';
import type { ErrorSignature, InvestigationResult } from './types.js';
import { CONTAINER_SOURCE_MAP } from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 8192;

/** Project root — all source file reads are validated to stay within this. */
const PROJECT_ROOT = resolve(process.cwd());

/** File paths that must never be sent to Claude (security). */
const BLOCKED_FILE_PATTERNS: RegExp[] = [
  /\.env$/,
  /\.env\./,
  /secrets?\./,
  /credentials?\./,
  /private\.key$/,
  /\.pem$/,
  /\.p12$/,
  /\.pfx$/,
  /id_rsa/,
  /id_ed25519/,
  /\.token$/,
];

/** Max source file size to send (avoid context overflow). */
const MAX_FILE_SIZE_BYTES = 50_000;

/** Max total source content sent in one investigation. */
const MAX_TOTAL_SOURCE_BYTES = 150_000;

// ---------------------------------------------------------------------------
// Claude response schema
// ---------------------------------------------------------------------------

interface ClaudeFixResponse {
  rootCause: string;
  confidence: 'high' | 'medium' | 'low';
  files: Array<{ path: string; content: string }>;
}

function isValidClaudeResponse(obj: unknown): obj is ClaudeFixResponse {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  if (typeof o.rootCause !== 'string') return false;
  if (!['high', 'medium', 'low'].includes(o.confidence as string)) return false;
  if (!Array.isArray(o.files)) return false;
  for (const f of o.files) {
    if (!f || typeof f !== 'object') return false;
    const fo = f as Record<string, unknown>;
    if (typeof fo.path !== 'string' || typeof fo.content !== 'string') return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

/**
 * Validate that a file path is safe to read and send to Claude.
 * Returns null if safe, or an error string if blocked.
 */
function validateFilePath(filePath: string): string | null {
  // Resolve to absolute path
  const abs = resolve(PROJECT_ROOT, filePath);
  // Must remain within project root
  const rel = relative(PROJECT_ROOT, abs);
  if (rel.startsWith('..') || normalize(rel) !== rel.replace(/\.\./g, '')) {
    if (abs.startsWith(PROJECT_ROOT)) {
      // OK — still inside project
    } else {
      return `Path escapes project root: ${filePath}`;
    }
  }

  // Block sensitive file patterns
  for (const pattern of BLOCKED_FILE_PATTERNS) {
    if (pattern.test(filePath)) {
      return `Blocked sensitive file pattern: ${filePath}`;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Stack trace file extraction
// ---------------------------------------------------------------------------

/**
 * Extract file paths mentioned in stack trace lines.
 * Handles patterns like:
 *   at Object.<anonymous> (/app/backend/src/foo.ts:42:10)
 *   at processTicksAndRejections (internal/process/task_queues.js:95:5)
 */
function extractFilesFromStackTrace(stackLines: string[]): string[] {
  const paths = new Set<string>();

  for (const line of stackLines) {
    // Match paths in parentheses at end of stack lines
    const match = /\(([^)]+):\d+:\d+\)/.exec(line);
    if (match) {
      const rawPath = match[1];
      // Skip Node.js internals
      if (rawPath.startsWith('internal/') || rawPath.startsWith('node:')) continue;
      // Strip leading /app/ prefix (Docker container path)
      const normalized = rawPath.replace(/^\/app\//, '');
      paths.add(normalized);
    }
  }

  return [...paths];
}

// ---------------------------------------------------------------------------
// ErrorInvestigator
// ---------------------------------------------------------------------------

export class ErrorInvestigator {
  private client: Anthropic;

  constructor(anthropicApiKey: string) {
    this.client = new Anthropic({ apiKey: anthropicApiKey });
  }

  /**
   * Investigate an error signature using Claude.
   * Reads relevant source files from disk, sends them to Claude with the
   * error context, and returns the investigation result.
   *
   * Never throws — all errors are caught and result in low-confidence result.
   */
  async investigate(error: ErrorSignature): Promise<InvestigationResult> {
    try {
      return await this.doInvestigate(error);
    } catch (err) {
      console.error(
        '[ErrorInvestigator] Investigation failed:',
        err instanceof Error ? err.message : err,
      );
      return {
        error,
        rootCause: 'Investigation failed due to internal error',
        suggestedFix: 'Manual investigation required',
        files: [],
        confidence: 'low',
      };
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private async doInvestigate(error: ErrorSignature): Promise<InvestigationResult> {
    // 1. Determine which source files to load
    const sourceDir = CONTAINER_SOURCE_MAP[error.container] ?? '';
    const stackFilePaths = extractFilesFromStackTrace(error.sampleLines);

    // Build list of candidate files to read
    const candidatePaths = [...new Set(stackFilePaths)].filter(Boolean);

    // 2. Read source files (security-validated)
    const sourceBlocks: string[] = [];
    let totalBytes = 0;

    for (const filePath of candidatePaths) {
      if (totalBytes >= MAX_TOTAL_SOURCE_BYTES) break;

      const blocked = validateFilePath(filePath);
      if (blocked) {
        console.warn(`[ErrorInvestigator] ${blocked}`);
        continue;
      }

      try {
        const absPath = resolve(PROJECT_ROOT, filePath);
        const content = await readFile(absPath, 'utf-8');

        if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_SIZE_BYTES) {
          console.warn(`[ErrorInvestigator] Skipping large file: ${filePath}`);
          continue;
        }

        sourceBlocks.push(`\`\`\`typescript\n// File: ${filePath}\n${content}\n\`\`\``);
        totalBytes += Buffer.byteLength(content, 'utf-8');
      } catch (err) {
        // File may not be readable — skip silently
        console.debug(`[ErrorInvestigator] Could not read ${filePath}: ${err instanceof Error ? err.message : err}`);
      }
    }

    // 3. Build prompt
    const errorLines = error.sampleLines.join('\n');
    const sourceContext =
      sourceBlocks.length > 0
        ? `\n\n## Relevant Source Files\n\n${sourceBlocks.join('\n\n')}`
        : '';

    const userPrompt = `## Error Report

**Container:** ${error.container}
**Source directory:** ${sourceDir}
**First seen:** ${error.firstSeen.toISOString()}
**Occurrence count:** ${error.count}

## Error Log Lines

\`\`\`
${errorLines}
\`\`\`
${sourceContext}

Analyze this error and propose a fix. Return ONLY a JSON object (no markdown fences, no explanation outside the JSON) with these exact fields:
- \`rootCause\`: string — what caused this error
- \`confidence\`: "high" | "medium" | "low" — how confident you are in the fix
- \`files\`: array of \`{ path: string, content: string }\` with COMPLETE corrected file contents

Only include files you are actually changing. If you cannot determine a fix with reasonable confidence, set confidence to "low" and files to [].`;

    const systemPrompt =
      'You are a senior developer debugging a production error in the BASTION platform. ' +
      'Analyze the error, the relevant source code, and produce a fix. ' +
      'Return JSON with fields: rootCause (string), confidence (high/medium/low), ' +
      'files (array of {path, content} with the COMPLETE corrected file contents). ' +
      'Only include files you are actually changing. ' +
      'If you cannot determine a fix with reasonable confidence, set confidence to "low" and files to empty array.';

    // 4. Call Claude
    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    // 5. Parse response
    const rawText =
      response.content[0]?.type === 'text' ? response.content[0].text : '';

    let parsed: unknown;
    try {
      // Strip any accidental markdown fences
      const cleaned = rawText
        .replace(/^```(?:json)?\s*/m, '')
        .replace(/\s*```\s*$/m, '')
        .trim();
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn('[ErrorInvestigator] Failed to parse Claude JSON response:', rawText.slice(0, 200));
      return {
        error,
        rootCause: 'Claude returned unparseable response',
        suggestedFix: 'Manual investigation required',
        files: [],
        confidence: 'low',
      };
    }

    // 6. Validate schema (T-lm-05: strict validation, discard malformed responses)
    if (!isValidClaudeResponse(parsed)) {
      console.warn('[ErrorInvestigator] Claude response failed schema validation');
      return {
        error,
        rootCause: 'Claude response failed schema validation',
        suggestedFix: 'Manual investigation required',
        files: [],
        confidence: 'low',
      };
    }

    // 7. Validate file paths in the response (security: T-lm-01)
    const safeFiles: Array<{ path: string; content: string }> = [];
    for (const f of parsed.files) {
      const blocked = validateFilePath(f.path);
      if (blocked) {
        console.warn(`[ErrorInvestigator] Dropping blocked file in Claude response: ${blocked}`);
        continue;
      }
      safeFiles.push(f);
    }

    return {
      error,
      rootCause: parsed.rootCause,
      suggestedFix: safeFiles.length > 0 ? `Fixed in ${safeFiles.map((f) => f.path).join(', ')}` : 'No actionable fix determined',
      files: safeFiles,
      confidence: parsed.confidence,
    };
  }
}
