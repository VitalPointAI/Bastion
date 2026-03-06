/**
 * Exercise Watermark Utility
 *
 * Phase 22 Plan 06: Stamps training-mode documents with EXERCISE markings.
 *
 * - Detects training mode from request context (set by modeMiddleware)
 * - Adds diagonal "EXERCISE" watermark to PDF pages
 * - Adds "EXERCISE - EXERCISE - EXERCISE" header line
 * - Provides filename prefix for exercise documents
 */

import type { Request } from 'express';

/**
 * Check if the current request is in training mode.
 * Relies on modeMiddleware having set req.userMode.
 */
export function isTrainingMode(req: Request): boolean {
  return (req as unknown as Record<string, unknown>).userMode === 'training';
}

/**
 * Add diagonal "EXERCISE" watermark text across a PDF page.
 *
 * Uses PDFKit save/restore pattern with low opacity red text
 * rotated 45 degrees. Should be called before doc.end().
 */
export function addPdfExerciseWatermark(doc: any): void {
  // Save current graphics state
  doc.save();

  // Set watermark styling
  doc.opacity(0.15);
  doc.fontSize(60);
  doc.fillColor('#CC0000');
  doc.font('Helvetica-Bold');

  // Draw diagonal watermark text across the page
  // Position at center of letter-size page (612 x 792 points)
  doc.rotate(45, { origin: [306, 396] });
  doc.text('EXERCISE', 100, 350, {
    align: 'center',
    width: 500,
  });

  // Restore graphics state
  doc.restore();
}

/**
 * Add a bold red "EXERCISE - EXERCISE - EXERCISE" header line at the
 * current cursor position. Mimics military exercise message header convention.
 */
export function addExerciseHeader(doc: any): void {
  doc.save();
  doc.fontSize(10);
  doc.fillColor('#CC0000');
  doc.font('Helvetica-Bold');
  doc.text('EXERCISE - EXERCISE - EXERCISE', {
    align: 'center',
  });
  doc.moveDown(0.3);
  doc.restore();
}

/**
 * Returns the filename prefix for exercise documents.
 */
export function getExerciseFilenamePrefix(): string {
  return 'EXERCISE_';
}
