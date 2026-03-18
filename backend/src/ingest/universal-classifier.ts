/**
 * Universal Intelligence Input — Content Classifier
 *
 * Phase 50 Plan 01 Task 1
 * Detects the type of incoming content and routes it to the correct pipeline.
 * Uses fast heuristics first (Buffer, URL pattern, JSON.parse, XML check)
 * before falling back to raw_text.
 */
import type { ClassificationResult, InputType, SuggestedPipeline } from './types.js';
import { unfurlUrl } from './url-unfurler.js';

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Returns true when the trimmed string looks like an HTTP(S) URL */
export function isUrl(s: string): boolean {
  return /^https?:\/\/\S+$/i.test(s.trim());
}

/** MIME types that map to doc-intelligence pipeline */
const DOC_MIME_PREFIXES = [
  'application/pdf',
  'application/vnd.openxmlformats',
  'application/msword',
  'application/vnd.ms-',
  'text/',
  'image/',
];

function mimeToSuggestedPipeline(_mimeType: string): SuggestedPipeline {
  // All known file types route through doc-intelligence
  return 'doc-intelligence';
}

// ─── Main Export ────────────────────────────────────────────────────────────

/**
 * Classify any content into a strongly-typed InputType with routing metadata.
 *
 * @param content  - A string (URL, JSON, XML, plain text) or a Buffer (file upload)
 * @param hint     - Optional MIME type / filename hint to accelerate classification
 */
export async function classifyInput(
  content: string | Buffer,
  hint?: { filename?: string; mimeType?: string },
): Promise<ClassificationResult> {
  // ── 1. Buffer → file ────────────────────────────────────────────────────
  if (Buffer.isBuffer(content)) {
    const mimeType = hint?.mimeType;
    const isKnownDocMime = mimeType
      ? DOC_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))
      : false;

    return {
      inputType: 'file',
      confidence: mimeType ? 0.95 : 0.7,
      suggestedPipeline: 'doc-intelligence',
      metadata: {
        contentType: mimeType,
      },
    };
  }

  const trimmed = content.trim();

  // ── 2. URL → call unfurlUrl, map result ─────────────────────────────────
  if (isUrl(trimmed)) {
    let inputType: InputType = 'api_url';
    let suggestedPipeline: SuggestedPipeline = 'manual';
    const metadata: ClassificationResult['metadata'] = {};

    try {
      const unfurled = await unfurlUrl(trimmed);

      switch (unfurled.type) {
        case 'rss':
          inputType = 'rss_url';
          suggestedPipeline = 'osint-subscribe';
          metadata.isRss = true;
          if (unfurled.title) metadata.title = unfurled.title;
          if (unfurled.url) metadata.feedUrl = unfurled.url;
          break;
        case 'article':
          inputType = 'article_url';
          suggestedPipeline = 'doc-intelligence';
          if (unfurled.title) metadata.title = unfurled.title;
          if (unfurled.description) metadata.description = unfurled.description;
          break;
        case 'pdf_url':
          inputType = 'pdf_url';
          suggestedPipeline = 'doc-intelligence';
          metadata.contentType = 'application/pdf';
          break;
        case 'unknown':
        default:
          inputType = 'api_url';
          suggestedPipeline = 'manual';
          break;
      }
    } catch {
      // unfurlUrl should never throw, but guard defensively
      inputType = 'api_url';
      suggestedPipeline = 'manual';
    }

    return {
      inputType,
      confidence: 0.85,
      suggestedPipeline,
      metadata,
    };
  }

  // ── 3. JSON ─────────────────────────────────────────────────────────────
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return {
        inputType: 'json_data',
        confidence: 0.95,
        suggestedPipeline: 'doc-intelligence',
        metadata: { contentType: 'application/json' },
      };
    } catch {
      // Not valid JSON — fall through
    }
  }

  // ── 4. XML ──────────────────────────────────────────────────────────────
  if (trimmed.startsWith('<?xml') || /^<[a-zA-Z_:]/.test(trimmed)) {
    return {
      inputType: 'xml_data',
      confidence: 0.85,
      suggestedPipeline: 'doc-intelligence',
      metadata: { contentType: 'application/xml' },
    };
  }

  // ── 5. Fallback: raw text ────────────────────────────────────────────────
  return {
    inputType: 'raw_text',
    confidence: 0.7,
    suggestedPipeline: 'text-ingest',
    metadata: {},
  };
}
