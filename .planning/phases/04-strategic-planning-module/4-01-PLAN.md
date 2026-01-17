---
phase: 04-strategic-planning-module
plan: 01
type: execute
domain: document-ingestion
---

<objective>
Set up document ingestion pipeline for strategic planning documents (PDF, DOCX).

Purpose: Enable upload and parsing of national security strategy documents, defense strategy documents, and other strategic directives that will be processed by LLM extraction.
Output: Working document upload endpoint with PDF/DOCX parsing, document storage in PostgreSQL, and encrypted backup to IPFS.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-strategic-planning-module/4-RESEARCH.md

# Prior phase context
@.planning/phases/03-dao-governance/3-08-SUMMARY.md

# Relevant source files
@backend/src/index.ts
@backend/src/lib/database.ts
@backend/src/lib/ipfs.ts

**Tech stack available:**
- Backend: Node.js/Express with TypeScript, ESM modules
- Database: PostgreSQL with hybrid storage pattern
- Storage: IPFS via Pinata for encrypted large files
- Auth: Privy.io with DID-based identity

**Established patterns:**
- ESM module resolution requires explicit `.js` extensions
- Express 5.x route params require explicit `as string` type assertions
- IPFS CIDs stored in PostgreSQL for fast querying

**Constraining decisions:**
- [Phase 1-03]: ChaCha20-Poly1305 AEAD cipher for document encryption
- [Phase 1-03A]: PostgreSQL as primary store, NEAR for verification, IPFS for large files
- [Phase 2-08]: ESM imports require `.js` suffix for dynamic imports

**From research (dont_hand_roll):**
- Use unpdf for PDF extraction (not custom parser)
- Use officeParser for DOCX/Office formats
- Implement upload size limits (50MB max)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install document parsing dependencies and create ingestion service</name>
  <files>backend/package.json, backend/src/strategic/ingestion/document-parser.ts, backend/src/strategic/ingestion/types.ts</files>
  <action>
Install unpdf and officeparser packages:
```
cd backend && pnpm add unpdf officeparser
```

Create the strategic/ingestion directory structure:
```
backend/src/strategic/
├── ingestion/
│   ├── document-parser.ts   # Main parsing service
│   └── types.ts             # Document types and interfaces
```

In types.ts, define:
- DocumentContent interface: { text, metadata, pageCount?, sections? }
- ParsedSection interface: { id, title, content, pageStart?, pageEnd? }
- StrategicDocumentLevel type: 'NSS' | 'NDS' | 'NMS' | 'GEF' | 'JSCP' | 'CAMPAIGN_PLAN' | 'OTHER'
- StrategicDocument interface with: id, title, level, originalFilename, mimeType, pageCount, textContent, sections, classification, ipfsCid, createdBy, createdAt

In document-parser.ts:
- Import extractText, getDocumentProxy from 'unpdf'
- Import parseOffice from 'officeparser'
- Create DocumentParser class with methods:
  - parsePDF(buffer: Buffer): Promise<DocumentContent> - use unpdf with mergePages:true
  - parseOfficeDocument(buffer: Buffer): Promise<DocumentContent> - use officeParser
  - parse(buffer: Buffer, mimeType: string): Promise<DocumentContent> - routes to correct parser
  - chunkDocument(text: string, maxChunkSize?: number): string[] - splits by paragraph, 8000 char default (for LLM context limits)

Handle edge cases:
- Empty documents should return { text: '', metadata: {}, pageCount: 0 }
- Large documents (>50 pages) should log warning but continue
- Throw descriptive errors for unsupported formats

Use ESM-compatible imports (add .js extensions where needed).
  </action>
  <verify>
Create a simple test script that parses a sample PDF:
```bash
cd backend && npx tsx -e "
import { DocumentParser } from './src/strategic/ingestion/document-parser.js';
const parser = new DocumentParser();
console.log('DocumentParser initialized successfully');
"
```
  </verify>
  <done>
- DocumentParser class exists with parsePDF, parseOfficeDocument, parse, chunkDocument methods
- Types defined for DocumentContent, ParsedSection, StrategicDocument
- Dependencies installed (unpdf, officeparser)
- Import statement works without errors
  </done>
</task>

<task type="auto">
  <name>Task 2: Create document upload endpoint with storage</name>
  <files>backend/src/strategic/ingestion/document-store.ts, backend/src/api/strategic.ts, backend/src/index.ts</files>
  <action>
Create document-store.ts:
- DocumentStore class that handles PostgreSQL storage
- storeDocument method: insert into strategic_documents table (id, title, level, original_filename, mime_type, page_count, text_content, classification, ipfs_cid, created_by, created_at)
- getDocument method: retrieve by ID
- listDocuments method: list all documents for user (with pagination)
- Add PostgreSQL table creation query (run if not exists pattern like other modules)

Table schema:
```sql
CREATE TABLE IF NOT EXISTS strategic_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'OTHER',
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  page_count INTEGER,
  text_content TEXT NOT NULL,
  text_length INTEGER NOT NULL,
  classification TEXT NOT NULL DEFAULT 'UNCLASSIFIED',
  ipfs_cid TEXT,
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_strategic_documents_created_by ON strategic_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_strategic_documents_level ON strategic_documents(level);
```

Create api/strategic.ts with multer for file uploads:
- POST /api/strategic/documents - upload document (multipart/form-data)
  - Accept 'document' field with file
  - Accept 'title', 'level', 'classification' in body
  - Parse document using DocumentParser
  - Store in PostgreSQL via DocumentStore
  - Optionally encrypt and upload to IPFS (use existing ipfs.ts pattern)
  - Return { documentId, title, pageCount, textLength }
- GET /api/strategic/documents - list user's documents
- GET /api/strategic/documents/:id - get document by ID
- GET /api/strategic/documents/:id/text - get document text content (for extraction)

Configure multer with:
- 50MB file size limit
- Filter: only PDF, DOCX, DOC mime types
- Memory storage (buffer in memory for parsing)

Mount router in index.ts at /api/strategic.

Use existing patterns from api/documents.ts for authentication (X-DID header or Authorization Bearer).

IMPORTANT: Use Express 5.x patterns - route params need `as string` assertion.
IMPORTANT: Use ESM imports with .js extensions.
  </action>
  <verify>
Start the backend server and test the endpoint:
```bash
# Test that router is mounted (should return 401 without auth)
curl -X POST http://localhost:3001/api/strategic/documents -F "document=@test.pdf"
```

Or verify module loads:
```bash
cd backend && npx tsx -e "
import strategicRouter from './src/api/strategic.js';
console.log('Strategic router loaded, methods:', Object.keys(strategicRouter));
"
```
  </verify>
  <done>
- POST /api/strategic/documents endpoint accepts PDF/DOCX uploads
- GET /api/strategic/documents lists documents
- GET /api/strategic/documents/:id returns document metadata
- GET /api/strategic/documents/:id/text returns document text
- strategic_documents table created in PostgreSQL
- Router mounted in main index.ts
- 50MB upload limit enforced
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] DocumentParser successfully parses PDF and DOCX formats
- [ ] strategic_documents table exists in PostgreSQL
- [ ] POST /api/strategic/documents accepts file upload
- [ ] GET endpoints return stored documents
</verification>

<success_criteria>

- Document ingestion pipeline functional
- PDF and DOCX parsing working via unpdf/officeParser
- Documents stored in PostgreSQL with metadata
- API endpoints for upload, list, and retrieve
- Ready for LLM extraction in Plan 4-03
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-01-SUMMARY.md`
</output>
