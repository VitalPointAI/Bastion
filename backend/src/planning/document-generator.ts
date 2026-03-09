/**
 * Document Generator Engine
 *
 * Phase 33 Plan 10: Server-side rendering engine for plan document export.
 * Supports PDF and DOCX output for all plan types using doctrinal templates.
 */

import * as PDFKit from 'pdfkit';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PDFDocument = (PDFKit as any).default || PDFKit;
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageBreak,
} from 'docx';
import type { PlanType, AnnexLetter } from './types.js';
import { planStore } from './stores/plan-store.js';
import { getTemplate, type DocumentSection } from './document-templates.js';

// ─── Types ──────────────────────────────────────────────────────────────────

export type DocumentFormat = 'pdf' | 'docx';

export interface GenerateOptions {
  planId: string;
  planType: PlanType | 'CAMPAIGN_PLAN';
  format: DocumentFormat;
  classification?: string;
  includeAnnexes?: AnnexLetter[];
}

export interface GeneratedPlanDocument {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  size: number;
  generatedAt: Date;
}

// ─── PDF Rendering ──────────────────────────────────────────────────────────

function renderSectionsToPdf(
  doc: InstanceType<typeof PDFDocument>,
  sections: DocumentSection[],
  classification: string,
): void {
  for (const section of sections) {
    if (section.id === 'toc') {
      // Table of contents placeholder
      doc.fontSize(14).font('Helvetica-Bold').text('TABLE OF CONTENTS');
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text('(Auto-generated on print)');
      doc.moveDown(1);
      continue;
    }

    if (section.id === 'cover') {
      // Classification banner
      doc.fontSize(14).font('Helvetica-Bold')
        .text(classification, { align: 'center' });
      doc.moveDown(2);

      // Title
      doc.fontSize(18).font('Helvetica-Bold')
        .text(section.title, { align: 'center' });
      doc.moveDown(1);

      // Cover content
      doc.fontSize(10).font('Helvetica');
      section.content.split('\n').forEach((line) => {
        doc.text(line, { align: 'center' });
      });
      doc.moveDown(2);

      // Classification footer on cover
      doc.fontSize(14).font('Helvetica-Bold')
        .text(classification, { align: 'center' });
      doc.addPage();
      continue;
    }

    // Section heading
    const fontSize = section.level === 1 ? 14 : section.level === 2 ? 12 : 10;
    doc.fontSize(fontSize).font('Helvetica-Bold').text(section.title);
    doc.moveDown(0.3);

    // Section content
    if (section.content) {
      doc.fontSize(10).font('Helvetica');
      section.content.split('\n').forEach((line) => {
        doc.text(line);
      });
    }

    doc.moveDown(0.8);

    // Render children if present
    if (section.children?.length) {
      renderSectionsToPdf(doc, section.children, classification);
    }
  }
}

async function generatePdf(
  sections: DocumentSection[],
  classification: string,
  planName: string,
  planType: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: planName,
          Subject: `${planType} Document`,
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderSectionsToPdf(doc, sections, classification);

      // Final classification footer
      doc.moveDown(2);
      doc.fontSize(14).font('Helvetica-Bold')
        .text(classification, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

// ─── DOCX Rendering ─────────────────────────────────────────────────────────

function sectionToDocxParagraphs(section: DocumentSection, classification: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  if (section.id === 'cover') {
    // Classification banner
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: classification, bold: true, size: 28 })],
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 },
      }),
    );

    // Title
    paragraphs.push(
      new Paragraph({
        text: section.title,
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 200 },
      }),
    );

    // Cover content
    section.content.split('\n').forEach((line) => {
      paragraphs.push(
        new Paragraph({
          text: line,
          alignment: AlignmentType.CENTER,
        }),
      );
    });

    // Page break after cover
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ break: 1 } as unknown as ConstructorParameters<typeof TextRun>[0])],
        pageBreakBefore: true,
      }),
    );

    return paragraphs;
  }

  if (section.id === 'toc') {
    paragraphs.push(
      new Paragraph({
        text: 'TABLE OF CONTENTS',
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 200 },
      }),
    );
    paragraphs.push(
      new Paragraph({
        text: '(Auto-generated on print)',
        spacing: { after: 400 },
      }),
    );
    return paragraphs;
  }

  // Section heading
  const headingLevel =
    section.level === 1
      ? HeadingLevel.HEADING_1
      : section.level === 2
        ? HeadingLevel.HEADING_2
        : HeadingLevel.HEADING_3;

  paragraphs.push(
    new Paragraph({
      text: section.title,
      heading: headingLevel,
      spacing: { before: 300, after: 100 },
    }),
  );

  // Section content
  if (section.content) {
    section.content.split('\n').forEach((line) => {
      paragraphs.push(
        new Paragraph({
          text: line,
          spacing: { after: 80 },
        }),
      );
    });
  }

  // Render children
  if (section.children?.length) {
    for (const child of section.children) {
      paragraphs.push(...sectionToDocxParagraphs(child, classification));
    }
  }

  return paragraphs;
}

async function generateDocx(
  sections: DocumentSection[],
  classification: string,
  planName: string,
): Promise<Buffer> {
  const allParagraphs: Paragraph[] = [];

  for (const section of sections) {
    allParagraphs.push(...sectionToDocxParagraphs(section, classification));
  }

  // Classification footer
  allParagraphs.push(
    new Paragraph({
      children: [new TextRun({ text: classification, bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600 },
    }),
  );

  const doc = new Document({
    title: planName,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: allParagraphs,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ─── Main Generator ─────────────────────────────────────────────────────────

/**
 * Generate a formatted plan document (PDF or DOCX) for the specified plan.
 *
 * Fetches plan from database, selects doctrinal template based on plan type,
 * renders sections, and returns the document as a buffer.
 */
export async function generatePlanDocument(options: GenerateOptions): Promise<GeneratedPlanDocument> {
  const { planId, planType, format, classification = 'UNCLASSIFIED', includeAnnexes } = options;

  // Fetch plan from database
  const plan = await planStore.findById(planId);
  if (!plan) {
    throw new Error(`Plan ${planId} not found`);
  }

  // Select template based on plan type
  const template = getTemplate(planType);

  // Render sections
  let sections = template.renderSections(plan);

  // Filter annexes if subset specified
  if (includeAnnexes && includeAnnexes.length > 0) {
    const annexLetterSet = new Set(includeAnnexes);
    sections = sections.filter((s) => {
      if (s.id.startsWith('annex-')) {
        const letter = s.id.replace('annex-', '').toUpperCase();
        return annexLetterSet.has(letter as AnnexLetter);
      }
      return true;
    });
  }

  const planName = plan.name || `${planType} Document`;

  let buffer: Buffer;
  let mimeType: string;
  let extension: string;

  if (format === 'pdf') {
    buffer = await generatePdf(sections, classification, planName, planType);
    mimeType = 'application/pdf';
    extension = 'pdf';
  } else {
    buffer = await generateDocx(sections, classification, planName);
    mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    extension = 'docx';
  }

  const safeName = planName.replace(/[^a-zA-Z0-9-_]/g, '_');
  const filename = `${safeName}_${planType}.${extension}`;

  return {
    buffer,
    filename,
    mimeType,
    size: buffer.byteLength,
    generatedAt: new Date(),
  };
}
