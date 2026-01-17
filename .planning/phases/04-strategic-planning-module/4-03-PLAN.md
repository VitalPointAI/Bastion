---
phase: 04-strategic-planning-module
plan: 03
type: execute
domain: llm-extraction
---

<objective>
Implement LLM-powered extraction of strategic objectives using Instructor-JS and Zod schemas.

Purpose: Automatically extract structured strategic objectives (DIME, Ends-Ways-Means) from ingested documents using Claude, with confidence scoring and source references.
Output: ExtractionService that takes document text and returns validated strategic objectives ready for human review.
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
@.planning/phases/04-strategic-planning-module/4-01-PLAN.md
@.planning/phases/04-strategic-planning-module/4-02-PLAN.md

# Relevant source files (after 4-01 and 4-02 complete)
@backend/src/strategic/schemas/index.ts
@backend/src/strategic/ingestion/document-parser.ts

**Tech stack available:**
- Zod schemas with .describe() hints (from 4-02)
- Document chunking (from 4-01)

**From research (architecture_patterns):**
- Instructor-JS with Zod for type-safe LLM extraction
- Use Claude claude-sonnet-4-20250514 for extraction
- Chunk long documents to avoid context overflow
- Track extraction confidence per objective
- Map-reduce pattern for multi-chunk documents

**Constraining decisions:**
- [4-RESEARCH]: Instructor-JS supports Anthropic via @anthropic-ai/sdk
- [4-RESEARCH]: 8K character chunks with consolidation
- [4-RESEARCH]: Always include sourceReference for traceability

**From research (dont_hand_roll):**
- Don't build custom NLP extraction - use LLM with structured output
- Don't skip validation - Instructor-JS handles retries
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install Instructor-JS and create extraction schemas</name>
  <files>backend/package.json, backend/src/strategic/extraction/schemas.ts, backend/src/strategic/extraction/types.ts</files>
  <action>
Install dependencies:
```bash
cd backend && pnpm add @instructor-ai/instructor @anthropic-ai/sdk
```

Create backend/src/strategic/extraction/ directory.

In types.ts:
- ExtractionResult interface: { objectives: StrategicObjective[], documentSummary: string, extractionConfidence: number, chunkCount: number, auditLog: ExtractionAuditEntry[] }
- ExtractionAuditEntry: { chunkIndex: number, timestamp: Date, model: string, tokensUsed: number, objectives Found: number }
- ExtractionConfig: { model?: string, maxRetries?: number, chunkSize?: number }

In schemas.ts - create Instructor-JS compatible extraction schemas:
- ExtractedObjectiveSchema: Simplified schema for LLM output (before full StrategicObjective):
  - id: z.string().describe('Unique identifier, format: OBJ-{sequential}')
  - description: z.string().describe('Full text of the strategic objective as stated in the document')
  - ends: z.object with description, conditions array, timeframe
  - ways: z.object with strategies array, concepts array, keyTasks array
  - means: z.object with forces array, capabilities array, resources array
  - dimeCategory: DIMEInstrumentSchema.describe('Primary DIME category based on objective focus')
  - supportingDIME: z.array(DIMEInstrumentSchema).default([])
  - priority: PrioritySchema.describe('Assessed priority based on language and positioning')
  - constraints: z.array(z.string()).describe('Stated limitations or restrictions')
  - assumptions: z.array(z.string()).describe('Stated or implied assumptions')
  - sourceReference: z.string().describe('Exact location in document: page number, section title, or paragraph')

- ChunkExtractionResultSchema: z.object with:
  - objectives: z.array(ExtractedObjectiveSchema)
  - chunkSummary: z.string()
  - extractionConfidence: z.number().min(0).max(1)

- DocumentExtractionResultSchema: z.object with:
  - objectives: z.array(ExtractedObjectiveSchema)
  - documentSummary: z.string().describe('2-3 sentence executive summary')
  - documentLevel: z.enum(['NSS', 'NDS', 'NMS', 'GEF', 'JSCP', 'CAMPAIGN_PLAN', 'OTHER'])
  - overallConfidence: z.number().min(0).max(1)

All descriptions are critical - they become LLM prompt guidance.
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { ChunkExtractionResultSchema, DocumentExtractionResultSchema } from './src/strategic/extraction/schemas.js';
console.log('Chunk schema keys:', Object.keys(ChunkExtractionResultSchema.shape));
console.log('Doc schema keys:', Object.keys(DocumentExtractionResultSchema.shape));
"
```
  </verify>
  <done>
- @instructor-ai/instructor and @anthropic-ai/sdk installed
- ExtractedObjectiveSchema defined with DIME and EWM fields
- ChunkExtractionResultSchema for per-chunk extraction
- DocumentExtractionResultSchema for final consolidated output
- Types defined for extraction results and audit
  </done>
</task>

<task type="auto">
  <name>Task 2: Create ExtractionService with chunking and consolidation</name>
  <files>backend/src/strategic/extraction/extractor.ts, backend/src/strategic/extraction/index.ts</files>
  <action>
In extractor.ts, create ExtractionService class:

```typescript
import Instructor from '@instructor-ai/instructor';
import Anthropic from '@anthropic-ai/sdk';
// Import schemas and types
```

Constructor:
- Initialize Anthropic client with API key from process.env.ANTHROPIC_API_KEY
- Initialize Instructor with Anthropic client, mode: 'TOOLS'
- Default config: model='claude-sonnet-4-20250514', maxRetries=3, chunkSize=8000

Methods:

extractFromChunk(chunkText: string, chunkIndex: number): Promise<ChunkExtractionResult>
- Use Instructor client.chat.completions.create()
- System prompt: Strategic planning analyst, DIME framework, EWM doctrine
- User prompt: Extract objectives from chunk, note this is chunk {index}
- response_model: { schema: ChunkExtractionResultSchema, name: 'ChunkExtraction' }
- Track tokens used in audit

consolidateChunks(chunkResults: ChunkExtractionResult[]): DocumentExtractionResult
- Deduplicate objectives by description similarity (>80% match = duplicate)
- Merge supportingDIME arrays for duplicates
- Calculate overall confidence as weighted average
- Generate document summary from chunk summaries

extractFromDocument(documentText: string): Promise<ExtractionResult>
- Chunk document using DocumentParser.chunkDocument()
- Extract from each chunk in sequence (not parallel - rate limits)
- Consolidate results
- Build audit log
- Return full ExtractionResult

System prompt template (use template literal):
```
You are a strategic planning analyst extracting objectives from national security documents.

Apply the DIME framework to categorize each objective:
- DIPLOMATIC: Foreign policy, alliances, negotiations
- INFORMATIONAL: Communications, influence, information warfare
- MILITARY: Armed forces, defense operations
- ECONOMIC: Trade, sanctions, financial instruments

Apply Ends-Ways-Means doctrine:
- Ends: The desired outcome or end state
- Ways: Strategies, concepts, methods to achieve the ends
- Means: Resources (forces, materiel, funding) required

Rules:
1. Only extract explicitly stated objectives, not inferred ones
2. Provide exact source reference (page, section, paragraph)
3. Assess priority based on document language and positioning
4. Note constraints and assumptions as stated
5. If uncertain about DIME category, choose most applicable and note in description
```

In index.ts:
- Export ExtractionService
- Export all types and schemas

Error handling:
- Wrap Anthropic calls in try/catch
- Log errors with chunk context
- Return partial results if some chunks fail (with confidence penalty)

IMPORTANT: API key should come from env, NOT be hardcoded.
  </action>
  <verify>
Verify the service can be instantiated (will fail extraction without API key, but should load):
```bash
cd backend && npx tsx -e "
import { ExtractionService } from './src/strategic/extraction/index.js';
const service = new ExtractionService();
console.log('ExtractionService instantiated');
console.log('Has extractFromDocument:', typeof service.extractFromDocument === 'function');
"
```
  </verify>
  <done>
- ExtractionService class with Instructor-JS integration
- extractFromChunk method for single chunk extraction
- consolidateChunks method for deduplication and merging
- extractFromDocument method for full document processing
- System prompt with DIME and EWM guidance
- Audit logging for token usage tracking
- Error handling with partial results support
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] ExtractionService instantiates without runtime errors
- [ ] Schemas properly validate extraction results
- [ ] Chunking preserves paragraph boundaries
- [ ] Consolidation handles duplicate objectives
</verification>

<success_criteria>

- Instructor-JS integrated with Claude claude-sonnet-4-20250514
- Extraction schemas with .describe() hints for LLM
- Document chunking with 8K character limit
- Chunk consolidation with deduplication
- Audit logging for token tracking
- Ready for API integration in Plan 4-06
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-03-SUMMARY.md`
</output>
