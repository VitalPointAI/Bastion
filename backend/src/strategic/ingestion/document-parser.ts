/**
 * Document Parser Service
 * Handles PDF and Office document parsing using unpdf and officeParser
 */

import { extractText, getDocumentProxy } from 'unpdf';
import { OfficeParser } from 'officeparser';
import type { DocumentContent, ParsedSection } from './types.js';

// Supported MIME types for document parsing
const SUPPORTED_MIME_TYPES = new Map<string, 'pdf' | 'office'>([
  ['application/pdf', 'pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'office'], // .docx
  ['application/msword', 'office'], // .doc
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'office'], // .pptx
  ['application/vnd.ms-powerpoint', 'office'], // .ppt
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'office'], // .xlsx
  ['application/vnd.ms-excel', 'office'], // .xls
]);

/**
 * Large document warning threshold
 */
const LARGE_DOCUMENT_PAGE_THRESHOLD = 50;

/**
 * Default chunk size for LLM context (8000 characters)
 */
const DEFAULT_CHUNK_SIZE = 8000;

/**
 * DocumentParser handles extraction of text content from PDF and Office documents
 */
export class DocumentParser {
  /**
   * Parse a PDF document and extract text content
   * @param buffer - PDF file buffer
   * @returns Parsed document content
   */
  async parsePDF(buffer: Buffer): Promise<DocumentContent> {
    try {
      // Get document proxy to access page count
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const pageCount = pdf.numPages;

      // Log warning for large documents
      if (pageCount > LARGE_DOCUMENT_PAGE_THRESHOLD) {
        console.warn(`Large document detected: ${pageCount} pages. Processing may take longer.`);
      }

      // Extract text with pages merged
      const { text } = await extractText(new Uint8Array(buffer), { mergePages: true });

      // Handle empty documents
      if (!text || text.trim().length === 0) {
        return {
          text: '',
          metadata: { source: 'pdf' },
          pageCount: 0,
        };
      }

      // Try to detect sections by common heading patterns
      const sections = this.detectSections(text);

      return {
        text: text.trim(),
        metadata: {
          source: 'pdf',
          extractedAt: new Date().toISOString(),
        },
        pageCount,
        sections: sections.length > 0 ? sections : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse PDF: ${message}`);
    }
  }

  /**
   * Parse an Office document (DOCX, DOC, PPTX, PPT)
   * @param buffer - Office document buffer
   * @returns Parsed document content
   */
  async parseOfficeDocument(buffer: Buffer): Promise<DocumentContent> {
    try {
      // OfficeParser.parseOffice returns AST with toText() method
      const ast = await OfficeParser.parseOffice(buffer);
      const text = ast.toText();

      // Handle empty documents
      if (!text || text.trim().length === 0) {
        return {
          text: '',
          metadata: { source: 'office' },
          pageCount: 0,
        };
      }

      // Try to detect sections by common heading patterns
      const sections = this.detectSections(text);

      return {
        text: text.trim(),
        metadata: {
          source: 'office',
          extractedAt: new Date().toISOString(),
          ...(ast.metadata ? { docMetadata: ast.metadata } : {}),
        },
        // Office documents don't have reliable page count from parser
        sections: sections.length > 0 ? sections : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to parse Office document: ${message}`);
    }
  }

  /**
   * Parse any supported document by routing to the correct parser
   * @param buffer - Document file buffer
   * @param mimeType - MIME type of the document
   * @returns Parsed document content
   */
  async parse(buffer: Buffer, mimeType: string): Promise<DocumentContent> {
    const parserType = SUPPORTED_MIME_TYPES.get(mimeType);

    if (!parserType) {
      throw new Error(
        `Unsupported document type: ${mimeType}. Supported types: PDF, DOCX, DOC, PPTX, PPT`
      );
    }

    if (parserType === 'pdf') {
      return this.parsePDF(buffer);
    } else {
      return this.parseOfficeDocument(buffer);
    }
  }

  /**
   * Split document text into chunks suitable for LLM processing
   * Splits by paragraph boundaries, respecting max chunk size
   * @param text - Full document text
   * @param maxChunkSize - Maximum characters per chunk (default 8000)
   * @returns Array of text chunks
   */
  chunkDocument(text: string, maxChunkSize: number = DEFAULT_CHUNK_SIZE): string[] {
    if (!text || text.trim().length === 0) {
      return [];
    }

    const chunks: string[] = [];

    // Split by double newlines (paragraph breaks)
    const paragraphs = text.split(/\n\s*\n/);

    let currentChunk = '';

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();
      if (!trimmedParagraph) continue;

      // If adding this paragraph would exceed max size
      if (currentChunk.length + trimmedParagraph.length + 2 > maxChunkSize) {
        // Save current chunk if it has content
        if (currentChunk.trim()) {
          chunks.push(currentChunk.trim());
        }

        // If single paragraph is too large, split it by sentences
        if (trimmedParagraph.length > maxChunkSize) {
          const sentences = trimmedParagraph.match(/[^.!?]+[.!?]+/g) || [trimmedParagraph];
          let sentenceChunk = '';

          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length > maxChunkSize) {
              if (sentenceChunk.trim()) {
                chunks.push(sentenceChunk.trim());
              }
              // If single sentence is too long, just add it
              sentenceChunk = sentence.length > maxChunkSize ? '' : sentence;
              if (sentence.length > maxChunkSize) {
                chunks.push(sentence.trim());
              }
            } else {
              sentenceChunk += sentence;
            }
          }

          currentChunk = sentenceChunk;
        } else {
          currentChunk = trimmedParagraph;
        }
      } else {
        // Add paragraph to current chunk
        currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
      }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Detect sections in document text by looking for common heading patterns
   * @param text - Document text
   * @returns Array of detected sections
   */
  private detectSections(text: string): ParsedSection[] {
    const sections: ParsedSection[] = [];

    // Pattern for numbered sections (e.g., "1. Introduction", "2.1 Background")
    // or uppercase headings on their own line
    const headingPattern = /^(?:(?:\d+\.)+\s*|[IVX]+\.\s*)?([A-Z][A-Z\s&-]+[A-Z])$/gm;

    const lines = text.split('\n');
    let currentSection: ParsedSection | null = null;
    let sectionId = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check if this line looks like a heading
      if (line.length > 3 && line.length < 100 && headingPattern.test(line)) {
        // Save previous section
        if (currentSection && currentSection.content.trim()) {
          sections.push(currentSection);
        }

        sectionId++;
        currentSection = {
          id: `section-${sectionId}`,
          title: line,
          content: '',
        };

        // Reset regex lastIndex
        headingPattern.lastIndex = 0;
      } else if (currentSection) {
        // Add content to current section
        currentSection.content += (currentSection.content ? '\n' : '') + line;
      }
    }

    // Don't forget the last section
    if (currentSection && currentSection.content.trim()) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Check if a MIME type is supported
   * @param mimeType - MIME type to check
   * @returns true if supported
   */
  static isSupported(mimeType: string): boolean {
    return SUPPORTED_MIME_TYPES.has(mimeType);
  }

  /**
   * Get list of supported MIME types
   */
  static getSupportedMimeTypes(): string[] {
    return Array.from(SUPPORTED_MIME_TYPES.keys());
  }
}
