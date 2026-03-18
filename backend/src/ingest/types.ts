/**
 * Universal Intelligence Input — Shared Types
 *
 * Phase 50 Plan 01 Task 1
 * Provides shared type contracts for all ingest pipelines.
 */

/** Discriminated union of all content types the classifier can detect */
export type InputType =
  | 'file'
  | 'rss_url'
  | 'article_url'
  | 'pdf_url'
  | 'api_url'
  | 'raw_text'
  | 'json_data'
  | 'xml_data'
  | 'unknown';

/** Which processing pipeline should handle this content */
export type SuggestedPipeline =
  | 'doc-intelligence'
  | 'osint-subscribe'
  | 'text-ingest'
  | 'manual';

/** Result returned by classifyInput() */
export interface ClassificationResult {
  inputType: InputType;
  /** Confidence in the classification, 0–1 */
  confidence: number;
  /** Downstream pipeline to route this content to */
  suggestedPipeline: SuggestedPipeline;
  /** Optional metadata extracted during classification */
  metadata: {
    contentType?: string;
    title?: string;
    description?: string;
    feedUrl?: string;
    isRss?: boolean;
  };
}

/** Result returned by unfurlUrl() */
export interface UnfurlResult {
  type: 'rss' | 'article' | 'pdf_url' | 'unknown';
  /** Final (possibly redirected) URL */
  url: string;
  title?: string;
  description?: string;
  /** Raw HTML body, only set when type is 'article' */
  htmlBody?: string;
  /** When type is 'rss' and the feed URL was discovered via autodiscovery */
  discoveredFrom?: string;
}

/** Payload accepted by the ingest submission endpoint (Plan 02) */
export interface IngestSubmitRequest {
  /** Textual content, or null if a file buffer is provided */
  content: string | null;
  /** Raw file data — mutually exclusive with content */
  fileBuffer?: Buffer;
  /** Original filename, used as classification hint */
  filename?: string;
  /** MIME type hint for file buffers */
  mimeType?: string;
  /** Problem set this intelligence should be associated with */
  problemSetId: string;
  /** Override auto-classification with a specific InputType */
  forceClassification?: InputType;
}

/** Response from the ingest submission endpoint */
export interface IngestSubmitResponse {
  processId: string;
  classification: ClassificationResult;
  status: 'accepted' | 'interview_required' | 'duplicate';
}
