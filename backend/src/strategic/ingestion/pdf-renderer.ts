/**
 * PDF Vision Renderer
 *
 * Prepares PDF buffers for Anthropic's native PDF vision support.
 * Sends the raw PDF buffer as a base64-encoded document block.
 *
 * For oversized PDFs (>32 MB or >100 pages), truncates to the first N pages
 * using pdf-lib before encoding.
 */

import { getDocumentProxy } from 'unpdf';
import { PDFDocument } from 'pdf-lib';

/** Anthropic PDF document block size limit in bytes (32 MB) */
const ANTHROPIC_PDF_SIZE_LIMIT_BYTES = 32 * 1024 * 1024;

/** Maximum pages per vision API call (Anthropic limit) */
const ANTHROPIC_MAX_PAGES = 100;

/**
 * Target page count for truncated PDFs. We aim for fewer pages than the
 * hard limit to keep the resulting buffer safely under 32 MB even for
 * image-heavy scanned documents (~600 KB per page at typical scan DPI).
 */
const TRUNCATION_TARGET_PAGES = 45;

/**
 * Result of preparing a PDF buffer for vision submission.
 */
export interface PdfVisionPayload {
  /** Base64-encoded PDF content */
  base64: string;
  /** Always 'application/pdf' */
  mediaType: 'application/pdf';
  /** True if the original file was truncated */
  truncated: boolean;
  /** File size in bytes (after any truncation) */
  sizeBytes: number;
  /** Original page count (before truncation) */
  originalPages: number;
  /** Pages included in the payload */
  includedPages: number;
}

/**
 * Truncate a PDF to the first N pages using pdf-lib.
 * Returns a new Buffer containing only those pages.
 */
async function truncatePdf(buffer: Buffer, maxPages: number): Promise<Buffer> {
  const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  if (totalPages <= maxPages) {
    return buffer; // no truncation needed
  }

  const destDoc = await PDFDocument.create();
  const pageIndices = Array.from({ length: maxPages }, (_, i) => i);
  const copiedPages = await destDoc.copyPages(srcDoc, pageIndices);
  for (const page of copiedPages) {
    destDoc.addPage(page);
  }

  const truncatedBytes = await destDoc.save();
  console.log(
    `[pdf-renderer] Truncated PDF from ${totalPages} to ${maxPages} pages ` +
      `(${(buffer.length / 1024 / 1024).toFixed(1)} MB → ${(truncatedBytes.length / 1024 / 1024).toFixed(1)} MB)`
  );
  return Buffer.from(truncatedBytes);
}

/**
 * Prepare a PDF buffer for submission to Claude's vision API.
 *
 * Oversized PDFs are automatically truncated to fit within Anthropic's
 * 32 MB / 100-page limits. The truncation takes the first N pages,
 * which preserves the document's introduction, TOC, and early content.
 *
 * @param buffer - Raw PDF file buffer
 * @returns PdfVisionPayload with base64 data and size metadata
 */
export async function preparePdfForVision(buffer: Buffer): Promise<PdfVisionPayload> {
  let originalPages = 0;

  try {
    const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    originalPages = srcDoc.getPageCount();
  } catch {
    // Fall back to unpdf for page count
    try {
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      originalPages = pdf.numPages;
    } catch {
      originalPages = 0;
    }
  }

  const needsTruncation =
    buffer.length > ANTHROPIC_PDF_SIZE_LIMIT_BYTES || originalPages > ANTHROPIC_MAX_PAGES;

  let finalBuffer = buffer;
  let truncated = false;

  if (needsTruncation && originalPages > 0) {
    // Calculate target pages: either fit under size limit or page limit
    const pagesPerByte = originalPages / buffer.length;
    const pagesForSizeLimit = Math.floor(ANTHROPIC_PDF_SIZE_LIMIT_BYTES * pagesPerByte * 0.9); // 10% safety margin
    const targetPages = Math.min(TRUNCATION_TARGET_PAGES, pagesForSizeLimit, ANTHROPIC_MAX_PAGES);
    const pagesToKeep = Math.max(targetPages, 10); // at least 10 pages

    try {
      finalBuffer = await truncatePdf(buffer, pagesToKeep);
      truncated = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.warn(`[pdf-renderer] PDF truncation failed, sending full buffer: ${message}`);
    }
  }

  const sizeBytes = finalBuffer.length;
  const includedPages = truncated
    ? Math.min(TRUNCATION_TARGET_PAGES, originalPages)
    : originalPages;

  if (sizeBytes > ANTHROPIC_PDF_SIZE_LIMIT_BYTES) {
    console.warn(
      `[pdf-renderer] PDF ${(sizeBytes / 1024 / 1024).toFixed(1)} MB still exceeds ` +
        `Anthropic's ${ANTHROPIC_PDF_SIZE_LIMIT_BYTES / 1024 / 1024} MB limit after truncation.`
    );
  }

  return {
    base64: finalBuffer.toString('base64'),
    mediaType: 'application/pdf',
    truncated,
    sizeBytes,
    originalPages,
    includedPages,
  };
}

/**
 * Estimate the number of pages in a PDF using pdfjs-dist via unpdf.
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
