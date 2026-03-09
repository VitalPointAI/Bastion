/**
 * Format Converter Specialist
 *
 * Handles OCR for scanned PDFs, language detection, table/chart detection,
 * and encoding normalization. Extends SpecialistBase for LangGraph node
 * registration and progress reporting.
 *
 * Capabilities:
 * 1. OCR via tesseract.js for scanned/empty text documents
 * 2. Language detection via LLM on first ~500 chars
 * 3. Table/chart detection via LLM analysis
 */

import { z } from 'zod';
import { ChatAnthropic } from '@langchain/anthropic';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

import { SpecialistBase, type SpecialistConfig } from '../specialist-base.js';
import { SpecialistId } from '../types.js';
import type { ProblemSetContext } from '../schemas.js';
import type { SpecialistResult } from '../types.js';

// ============================================================================
// Output Schema
// ============================================================================

export const FormatConverterOutputSchema = z.object({
  convertedText: z.string(),
  language: z.string(),
  hasOCR: z.boolean(),
  tables: z.array(z.string()),
  charts: z.array(z.string()),
});

export type FormatConverterOutput = z.infer<typeof FormatConverterOutputSchema>;

// ============================================================================
// System Prompt
// ============================================================================

const FORMAT_CONVERTER_SYSTEM_PROMPT = `You are a document format specialist. Analyze the provided document content for language, embedded data structures, and readability.

Your tasks:
1. Detect the primary language of the text
2. Identify any embedded tables - describe each table's structure and key data
3. Identify any embedded charts or figures - describe what each depicts
4. Assess overall text quality and readability

Return your analysis as JSON with the following structure:
{
  "language": "en",
  "languageConfidence": 0.95,
  "tables": ["Table 1: Force deployment numbers by theater...", ...],
  "charts": ["Figure 1: Timeline of escalation phases...", ...],
  "qualityNotes": "Text is clear and well-structured"
}`;

// ============================================================================
// Format Converter Specialist
// ============================================================================

/**
 * Format Converter specialist agent.
 *
 * Processes documents for OCR (scanned PDFs), detects language,
 * identifies tables and charts, and normalizes text encoding.
 */
export class FormatConverter extends SpecialistBase {
  private model: BaseChatModel;

  constructor(config?: { model?: BaseChatModel }) {
    const specialistConfig: SpecialistConfig = {
      specialistId: SpecialistId.FORMAT_CONVERTER,
      name: 'Format Converter',
      description: 'Handles OCR for scanned PDFs, language detection, and encoding normalization',
      systemPrompt: FORMAT_CONVERTER_SYSTEM_PROMPT,
      tools: [],
      clearance: 'SECRET',
    };

    super(specialistConfig);

    this.model = config?.model ?? new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0,
      maxTokens: 2048,
    });
  }

  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------

  /**
   * Process a document through format conversion.
   *
   * @param documentText - Extracted text (may be empty for scanned docs)
   * @param metadata - Document metadata including filename, path, buffer info
   * @param onProgress - Optional progress callback for SSE streaming
   * @returns FormatConverterOutput with converted text and analysis
   */
  async process(
    documentText: string,
    metadata: Record<string, unknown>,
    onProgress?: (event: { type: string; data: Record<string, unknown> }) => void,
  ): Promise<SpecialistResult> {
    const startTime = Date.now();

    try {
      this.reportProgress('starting', 'Beginning format conversion', onProgress);

      let processedText = documentText;
      let hasOCR = false;

      // Step 1: Check if OCR is needed (empty or minimal text)
      if (this.needsOCR(documentText)) {
        this.reportProgress('ocr', 'Document appears scanned, attempting OCR', onProgress);
        processedText = await this.performOCR(metadata);
        hasOCR = processedText.length > 0;

        if (!hasOCR) {
          // OCR failed or no text found; use whatever we have
          processedText = documentText;
        }
      }

      // Step 2: Language detection and table/chart analysis via LLM
      this.reportProgress('analyzing', 'Detecting language and embedded structures', onProgress);
      const analysis = await this.analyzeContent(processedText);

      const output: FormatConverterOutput = {
        convertedText: processedText,
        language: analysis.language,
        hasOCR,
        tables: analysis.tables,
        charts: analysis.charts,
      };

      // Validate output
      const validation = this.validateOutput(output, FormatConverterOutputSchema);
      if (!validation.success) {
        throw new Error(`Format converter output validation failed: ${JSON.stringify(validation.error)}`);
      }

      this.reportProgress('complete', `Conversion complete. Language: ${analysis.language}, Tables: ${analysis.tables.length}, Charts: ${analysis.charts.length}`, onProgress);

      return {
        specialistId: SpecialistId.FORMAT_CONVERTER,
        status: 'success',
        output: validation.data,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      this.reportProgress('error', `Format conversion failed: ${error instanceof Error ? error.message : 'unknown'}`, onProgress);

      return {
        specialistId: SpecialistId.FORMAT_CONVERTER,
        status: 'error',
        output: null,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Specialist Base Implementation
  // --------------------------------------------------------------------------

  getSystemPrompt(context: ProblemSetContext): string {
    return `${FORMAT_CONVERTER_SYSTEM_PROMPT}

Problem Set Context:
- Geographic scope: ${context.geographicScope.regions.join(', ')}
- Core problem: ${context.coreProblem}
- Classification ceiling: ${context.classificationCeiling}`;
  }

  // --------------------------------------------------------------------------
  // Internal Methods
  // --------------------------------------------------------------------------

  /**
   * Determine if a document needs OCR processing.
   * A document needs OCR if its text is empty or very short relative
   * to what would be expected from a real document.
   */
  private needsOCR(text: string): boolean {
    // Empty or near-empty text suggests a scanned document
    const trimmed = text.trim();
    if (trimmed.length === 0) return true;

    // Very short text with high non-printable ratio suggests scan artifacts
    if (trimmed.length < 50) {
      const printableRatio = trimmed.replace(/[^\x20-\x7E]/g, '').length / trimmed.length;
      return printableRatio < 0.5;
    }

    return false;
  }

  /**
   * Perform OCR on a document.
   *
   * Uses tesseract.js for scanned PDF text extraction. Falls back gracefully
   * if tesseract.js is not available (dependency may not be installed yet).
   */
  private async performOCR(metadata: Record<string, unknown>): Promise<string> {
    try {
      // Dynamic import to handle cases where tesseract.js may not be installed
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng');

      // Use document buffer or path if available
      const source = (metadata.buffer ?? metadata.filePath ?? metadata.path) as string | Buffer;
      if (!source) {
        console.warn('[FormatConverter] No document source available for OCR');
        return '';
      }

      const result = await worker.recognize(source);
      await worker.terminate();

      return result.data.text;
    } catch (error) {
      // tesseract.js may not be installed; log and return empty
      console.warn(`[FormatConverter] OCR unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      return '';
    }
  }

  /**
   * Analyze document content for language, tables, and charts using LLM.
   */
  private async analyzeContent(text: string): Promise<{
    language: string;
    tables: string[];
    charts: string[];
  }> {
    // Use first ~500 chars for language detection, more for structure detection
    const preview = text.slice(0, 3000);

    if (preview.trim().length === 0) {
      return { language: 'unknown', tables: [], charts: [] };
    }

    try {
      const messages = [
        new SystemMessage(FORMAT_CONVERTER_SYSTEM_PROMPT),
        new HumanMessage(
          `Analyze this document content:\n\n${preview}\n\nReturn JSON with: language, languageConfidence, tables, charts, qualityNotes`
        ),
      ];

      const response = await this.model.invoke(messages);
      const content = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { language: 'en', tables: [], charts: [] };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        language: parsed.language ?? 'en',
        tables: Array.isArray(parsed.tables) ? parsed.tables : [],
        charts: Array.isArray(parsed.charts) ? parsed.charts : [],
      };
    } catch (error) {
      console.warn(`[FormatConverter] Content analysis failed: ${error instanceof Error ? error.message : 'unknown'}`);
      return { language: 'en', tables: [], charts: [] };
    }
  }
}
