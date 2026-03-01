/**
 * PDF Vision Renderer
 *
 * Quick Task 5: Prepares PDF buffers for Anthropic's native PDF vision support.
 * Instead of rendering pages to images (which requires canvas/native deps), we
 * send the raw PDF buffer as a base64-encoded document block. The Anthropic API
 * natively supports PDF content via `type: "document"` blocks with base64 data.
 *
 * Size limit: Anthropic enforces a ~32 MB limit on document content blocks.
 * Files approaching this limit are flagged but still sent — the API will reject
 * oversized files with an appropriate error message.
 */

import { getDocumentProxy } from 'unpdf';

/** Anthropic PDF document block size limit in bytes (32 MB) */
const ANTHROPIC_PDF_SIZE_LIMIT_BYTES = 32 * 1024 * 1024;

/** Warning threshold — flag before the hard limit */
const ANTHROPIC_PDF_SIZE_WARNING_BYTES = 28 * 1024 * 1024;

/**
 * Result of preparing a PDF buffer for vision submission.
 */
export interface PdfVisionPayload {
  /** Base64-encoded PDF content */
  base64: string;
  /** Always 'application/pdf' */
  mediaType: 'application/pdf';
  /** True if the file is near or over Anthropic's size limit */
  oversized: boolean;
  /** File size in bytes */
  sizeBytes: number;
}

/**
 * Prepare a PDF buffer for submission to Claude's vision API.
 *
 * Converts the raw PDF Buffer to a base64 string and validates it against
 * Anthropic's document size constraints. No image rendering is required —
 * Anthropic processes PDF documents natively.
 *
 * @param buffer - Raw PDF file buffer
 * @returns PdfVisionPayload with base64 data and size metadata
 */
export function preparePdfForVision(buffer: Buffer): PdfVisionPayload {
  const sizeBytes = buffer.length;

  if (sizeBytes > ANTHROPIC_PDF_SIZE_LIMIT_BYTES) {
    console.warn(
      `[pdf-renderer] PDF size ${(sizeBytes / 1024 / 1024).toFixed(1)} MB exceeds ` +
        `Anthropic's ${ANTHROPIC_PDF_SIZE_LIMIT_BYTES / 1024 / 1024} MB limit. ` +
        'The API will likely reject this document.'
    );
  } else if (sizeBytes > ANTHROPIC_PDF_SIZE_WARNING_BYTES) {
    console.warn(
      `[pdf-renderer] PDF size ${(sizeBytes / 1024 / 1024).toFixed(1)} MB is near ` +
        `Anthropic's size limit (${ANTHROPIC_PDF_SIZE_LIMIT_BYTES / 1024 / 1024} MB).`
    );
  }

  return {
    base64: buffer.toString('base64'),
    mediaType: 'application/pdf',
    oversized: sizeBytes > ANTHROPIC_PDF_SIZE_LIMIT_BYTES,
    sizeBytes,
  };
}

/**
 * Estimate the number of pages in a PDF using pdfjs-dist via unpdf.
 *
 * Useful for logging and for deciding whether a document is too large
 * to process in a single vision call.
 *
 * @param buffer - Raw PDF file buffer
 * @returns Page count, or 0 if the page count cannot be determined
 */
export async function estimatePdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    return pdf.numPages;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[pdf-renderer] Could not estimate page count: ${message}`);
    return 0;
  }
}
