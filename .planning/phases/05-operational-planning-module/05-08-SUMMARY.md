---
phase: 05-operational-planning-module
plan: 08
subsystem: document-generation
tags: [docx, pdfkit, opord, oplan, document-export, 5-paragraph-order]

dependency-graph:
  requires: ["05-01", "05-03"]
  provides: [generateOPORDDocx, generateOPORDPdf, OPORDStructure, buildOPORDStructure]
  affects: ["05-09", "05-10", "05-11"]

tech-stack:
  added: [docx, pdfkit, "@types/pdfkit"]
  patterns: [document-generation, template-builder]

key-files:
  created:
    - backend/src/planning/documents/types.ts
    - backend/src/planning/documents/templates/opord-template.ts
    - backend/src/planning/documents/generators/docx-generator.ts
    - backend/src/planning/documents/generators/pdf-generator.ts
  modified:
    - backend/package.json
    - backend/src/planning/documents/generators/opord.ts
    - backend/src/planning/documents/index.ts

decisions:
  - title: "docx library for Word generation"
    rationale: "Produces valid OOXML documents that open correctly in Microsoft Word"
  - title: "pdfkit for PDF generation"
    rationale: "Native Node.js PDF generation without external dependencies"
  - title: "OPORDStructure interface for template separation"
    rationale: "Separates data transformation from document rendering for reusability"

metrics:
  duration: "4 min"
  completed: "2026-01-25"
---

# Phase 05 Plan 08: OPLAN/OPORD Document Generators Summary

**One-liner:** DOCX and PDF document generators for doctrinally-correct 5-paragraph operation orders with classification markings.

## What Was Built

### 1. Document Types (`types.ts`)
- `DocumentMetadata`: Classification, unit, order number, DTG, references, timezone
- `OPORDGeneratorOptions`: Options for classification banners, annexes, graphics
- `GeneratedDocument`: Buffer, filename, mimeType, size, generatedAt

### 2. OPORD Template (`templates/opord-template.ts`)
- `OPORDStructure` interface following JP 5-0 5-paragraph format
- `buildOPORDStructure()` transforms OperationalPlan + COA into OPORD structure
- Handles all five paragraphs:
  - **Paragraph 1: Situation** - Area of operations, enemy forces, friendly forces, civil considerations
  - **Paragraph 2: Mission** - Who, What, When, Where, Why statement
  - **Paragraph 3: Execution** - Commander's intent, concept of operations, tasks to subordinate units
  - **Paragraph 4: Sustainment** - Logistics classes I-IX, transportation, personnel, health service
  - **Paragraph 5: Command and Signal** - Command post, succession, frequencies, codewords

### 3. DOCX Generator (`generators/docx-generator.ts`)
- `generateOPORDDocx(planId, metadata, options)` -> GeneratedDocument
- Uses `docx` library for valid Word document generation
- Includes:
  - Classification banners (header and footer)
  - Proper heading levels and formatting
  - Task organization section
  - All 5 paragraphs with bold labels
  - Authentication block (commander signature)

### 4. PDF Generator (`generators/pdf-generator.ts`)
- `generateOPORDPdf(planId, metadata, options)` -> GeneratedDocument
- Uses `pdfkit` for native PDF generation
- Letter size with proper margins
- Same structure and content as DOCX output
- Classification banners centered top and bottom

## Key Implementation Details

### Template Builder Pattern
```typescript
const opord = buildOPORDStructure(plan, selectedCOA, metadata);
// opord can be rendered to any format (DOCX, PDF, HTML, etc.)
```

### Classification Handling
- Classification passed via metadata.classification
- Rendered at document header and footer
- Optional via `classificationBanner: false` option

### Safe Data Access
- Uses optional chaining (`?.`) throughout for defensive access
- Falls back to "TBD" or "IAW SOP" for missing fields
- Plan and COA data merged into single OPORD structure

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- [x] TypeScript compilation passes (no document module errors)
- [x] docx ^9.5.1 installed in package.json
- [x] pdfkit ^0.17.2 installed in package.json
- [x] generateOPORDDocx exported from module
- [x] generateOPORDPdf exported from module
- [x] Both include classification markings

## Usage Example

```typescript
import { generateOPORDDocx, generateOPORDPdf } from './planning/documents';

const metadata: DocumentMetadata = {
  classification: 'SECRET//REL TO USA, FVEY',
  unit: '1st Battalion, 75th Ranger Regiment',
  orderNumber: '001-26',
  dtg: '251400ZJAN26',
  references: ['CJCSM 3130.03', 'JP 5-0'],
  timeZone: 'ZULU'
};

// Generate Word document
const docxDoc = await generateOPORDDocx(planId, metadata);
// docxDoc.buffer contains valid .docx file

// Generate PDF document
const pdfDoc = await generateOPORDPdf(planId, metadata);
// pdfDoc.buffer contains valid .pdf file
```

## Next Phase Readiness

Ready for Phase 05 Plan 09 (Briefing Generator) - document generation infrastructure in place.
