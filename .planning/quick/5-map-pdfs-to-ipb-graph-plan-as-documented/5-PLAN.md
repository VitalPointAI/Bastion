---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/strategic/ingestion/pdf-renderer.ts
  - backend/src/strategic/extraction/providers/types.ts
  - backend/src/strategic/extraction/providers/anthropic-provider.ts
  - backend/src/exercise/extraction-service.ts
  - backend/src/exercise/map-to-ipb-layers.ts
  - backend/src/api/exercise.ts
  - backend/package.json
autonomous: true
requirements: []

must_haves:
  truths:
    - "PLANNING_MAP PDFs with empty textContent can be retried and produce vision-extracted structured data"
    - "Vision-extracted map data is converted into IPBLayer[] objects compatible with ValidityMap rendering"
    - "Retry-extraction endpoint detects PLANNING_MAP documents and routes to vision extraction automatically"
  artifacts:
    - path: "backend/src/strategic/ingestion/pdf-renderer.ts"
      provides: "PDF page rendering to base64 PNG images"
      exports: ["renderPagesToImages"]
    - path: "backend/src/exercise/map-to-ipb-layers.ts"
      provides: "Conversion of extracted map features to IPBLayer[]"
      exports: ["mapFeaturesToIPBLayers"]
    - path: "backend/src/exercise/extraction-service.ts"
      provides: "Vision-based map extraction method"
      exports: ["ExerciseExtractionService"]
  key_links:
    - from: "backend/src/api/exercise.ts"
      to: "backend/src/exercise/extraction-service.ts"
      via: "retry-extraction endpoint calls extractMapWithVision for PLANNING_MAP docs"
      pattern: "extractMapWithVision"
    - from: "backend/src/exercise/extraction-service.ts"
      to: "backend/src/strategic/ingestion/pdf-renderer.ts"
      via: "renderPagesToImages called to convert PDF buffer to base64 images"
      pattern: "renderPagesToImages"
    - from: "backend/src/exercise/extraction-service.ts"
      to: "backend/src/exercise/map-to-ipb-layers.ts"
      via: "vision extraction result fed into mapFeaturesToIPBLayers"
      pattern: "mapFeaturesToIPBLayers"
---

<objective>
Implement vision-based extraction for planning map PDFs that currently fail text extraction,
converting them into structured IPB overlay layers.

Purpose: Planning map PDFs contain visual/spatial content (terrain features, hex grids, unit positions)
that `unpdf` cannot extract as text. These show as "Parse failed" with empty textContent. This plan
adds a vision pipeline: render PDF pages to images, send to Claude vision API for structured extraction,
then convert results into IPBLayer[] for ValidityMap rendering.

Output: Working vision extraction pipeline for PLANNING_MAP documents, producing IPBLayer[] overlays.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/src/exercise/extraction-service.ts (current extraction service - add extractMapWithVision method)
@backend/src/exercise/types.ts (IPBLayer, ExtractedExerciseData, ScenarioDocument types)
@backend/src/strategic/ingestion/document-parser.ts (existing parser - sibling for pdf-renderer)
@backend/src/strategic/extraction/providers/types.ts (LLMMessage needs multimodal content support)
@backend/src/strategic/extraction/providers/anthropic-provider.ts (needs vision content handling)
@backend/src/api/exercise.ts (retry-extraction endpoint - add vision routing)
@backend/src/exercise/document-store.ts (getFileData method for retrieving PDF buffer)
@.planning/phases/14-friendly-adversary-ipb-complete-cycle/14-12-map-pdf-to-ipb-plan.md (reference plan)
</context>

<tasks>

<task type="auto">
  <name>Task 1: PDF-to-Image Renderer and Provider Vision Support</name>
  <files>
    backend/src/strategic/ingestion/pdf-renderer.ts
    backend/src/strategic/extraction/providers/types.ts
    backend/src/strategic/extraction/providers/anthropic-provider.ts
    backend/package.json
  </files>
  <action>
1. Install `pdfjs-dist` as a direct dependency (already transitive via unpdf, but need direct access):
   `cd backend && pnpm add pdfjs-dist`

   NOTE: Do NOT install `@napi-rs/canvas` or `pdf2pic`. The pdfjs-dist library can render pages
   to raw pixel data without a canvas. We will convert raw RGBA pixel data to PNG using `sharp`
   (which is a common dependency) or use pdfjs-dist's built-in SVG/text output.

   ACTUALLY: The simplest approach is to NOT render to images at all. Instead, use pdfjs-dist
   to get the raw page content, and if text is empty, pass the original PDF buffer directly to
   the Anthropic API as a base64 document. The Anthropic SDK supports PDF files natively via
   `type: "document"` content blocks with `source.type: "base64"` and `media_type: "application/pdf"`.
   This avoids ALL canvas/image rendering complexity.

   REVISED APPROACH - Use Anthropic's native PDF support:
   - No pdf-renderer.ts needed
   - No image rendering dependencies needed
   - Send the PDF buffer directly as a base64 document block to Claude

2. Create `backend/src/strategic/ingestion/pdf-renderer.ts` as a thin utility that:
   - Exports `preparePdfForVision(buffer: Buffer): { base64: string, mediaType: string }`
   - Converts the raw PDF Buffer to a base64 string
   - If the buffer exceeds 30MB, returns a truncation warning (Anthropic has size limits)
   - Also exports `estimatePdfPageCount(buffer: Buffer): Promise<number>` using pdfjs-dist's
     `getDocumentProxy` (already available via unpdf) to get page count for logging

3. Update `backend/src/strategic/extraction/providers/types.ts`:
   - Extend `LLMMessage.content` from `string` to `string | LLMContentBlock[]`
   - Add `LLMContentBlock` type:
     ```typescript
     export type LLMContentBlock =
       | { type: 'text'; text: string }
       | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
       | { type: 'document'; source: { type: 'base64'; media_type: string; data: string } };
     ```
   - This is backward-compatible: existing callers pass `string`, new vision callers pass arrays

4. Update `backend/src/strategic/extraction/providers/anthropic-provider.ts`:
   - In the `complete()` method, update the message mapping to handle both string and array content:
     ```typescript
     messages: nonSystemMessages.map(m => ({
       role: m.role as 'user' | 'assistant',
       content: typeof m.content === 'string'
         ? m.content
         : m.content.map(block => {
             if (block.type === 'text') return { type: 'text' as const, text: block.text };
             if (block.type === 'document') return {
               type: 'document' as const,
               source: { type: 'base64' as const, media_type: block.source.media_type, data: block.source.data }
             };
             // image block
             return {
               type: 'image' as const,
               source: { type: 'base64' as const, media_type: block.source.media_type, data: block.source.data }
             };
           }),
     })),
     ```
   - This is backward-compatible: all existing text-only calls still work unchanged
  </action>
  <verify>
    `cd backend && npx tsc --noEmit` passes with no type errors.
    Existing extraction tests still pass: `cd backend && pnpm test -- --run`
  </verify>
  <done>
    - pdf-renderer.ts exports preparePdfForVision and estimatePdfPageCount
    - LLMMessage.content accepts string | LLMContentBlock[]
    - AnthropicProvider.complete() handles both string and multimodal content blocks
    - All existing code continues to work (backward compatible)
  </done>
</task>

<task type="auto">
  <name>Task 2: Vision Extraction Method and Map-to-IPB Layer Converter</name>
  <files>
    backend/src/exercise/extraction-service.ts
    backend/src/exercise/map-to-ipb-layers.ts
  </files>
  <action>
1. Create `backend/src/exercise/map-to-ipb-layers.ts`:
   - Export `mapFeaturesToIPBLayers(data: ExtractedExerciseData, team: 'blue' | 'red'): IPBLayer[]`
   - Mapping rules (from the 14-12 plan):
     | Extracted Feature        | IPB type | layerType            |
     |--------------------------|----------|----------------------|
     | forceDispositions        | 'unit'   | 'forces'             |
     | terrain features (from rawExtraction.terrainFeatures or keyTerrain) | 'area'/'line' | 'key_terrain' / 'obstacle' |
     | avenues of approach (from rawExtraction.avenuesOfApproach) | 'line' | 'avenue_of_approach' |
     | NAIs (from rawExtraction.namedAreasOfInterest) | 'area' | 'nai' |
     | engagement areas (from rawExtraction.engagementAreas) | 'area' | 'engagement_area' |
   - For forceDispositions with lat/lng location: create GeoJSON Point geometry
   - For forceDispositions with string location: store location name in properties, use empty geometry placeholder `{ type: 'Point', coordinates: [0, 0] }` with a `geocodeRequired: true` flag in properties
   - Generate unique IDs using `randomUUID()`
   - Import IPBLayer from `../exercise/types.js`

2. Add `extractMapWithVision()` method to `ExerciseExtractionService`:
   ```typescript
   async extractMapWithVision(
     docId: string,
     pdfBuffer: Buffer,
     tags: PackageTags
   ): Promise<ExtractedExerciseData>
   ```
   - Import `preparePdfForVision` from `../strategic/ingestion/pdf-renderer.js`
   - Import `LLMContentBlock` from provider types
   - Build a specialized vision system prompt (from the 14-12 plan):
     ```
     You are a military map analyst. Extract structured geographic and military data from this planning map.
     Identify:
     - Named regions and hex grid identifiers
     - Key terrain features (mountains, rivers, urban areas, chokepoints)
     - Unit positions and symbols (identify SIDC codes if possible)
     - Boundaries (operational areas, phase lines, boundaries between units)
     - Avenues of approach and engagement areas
     - Named Areas of Interest (NAIs)
     For each feature, estimate geographic coordinates or provide hex grid references.
     ```
   - Create the LLM request with multimodal content:
     ```typescript
     const { base64, mediaType } = preparePdfForVision(pdfBuffer);
     const content: LLMContentBlock[] = [
       { type: 'document', source: { type: 'base64', media_type: mediaType, data: base64 } },
       { type: 'text', text: 'Extract structured military map data from this planning map PDF.' }
     ];
     ```
   - Send via `this.provider.complete()` with the EXERCISE_EXTRACTION_TOOL and tool_choice forced
   - Parse the tool_use response the same way `extractFromChunk` does
   - Use existing `updateExtraction` to persist results
   - Also store the vision-generated summary as textContent via `this.documentStore.updateTextContent()`
     so subsequent retries can use standard text extraction
   - Use max_tokens of 8192 (vision extraction typically produces more output than text extraction)

3. Add the `mapFeaturesToIPBLayers` import and enhance the extraction result:
   - After extractMapWithVision completes, call `mapFeaturesToIPBLayers(result, tags.team)`
   - Store the generated IPBLayer[] in the rawExtraction under key `ipbLayers`
   - This makes layers available for downstream consumption without a separate API call
  </action>
  <verify>
    `cd backend && npx tsc --noEmit` passes.
    The new method exists and is callable: grep for `extractMapWithVision` in extraction-service.ts
  </verify>
  <done>
    - extractMapWithVision method sends PDF to Claude vision API and returns ExtractedExerciseData
    - mapFeaturesToIPBLayers converts forceDispositions and raw map features to IPBLayer[]
    - Vision-extracted text is persisted as textContent for future standard extraction fallback
    - Generated IPBLayer[] stored in rawExtraction.ipbLayers for downstream use
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire Vision Extraction into Retry Flow</name>
  <files>
    backend/src/api/exercise.ts
  </files>
  <action>
1. Update the `POST /api/exercise/documents/:docId/retry-extraction` endpoint in
   `backend/src/api/exercise.ts`:

   - After the existing check for empty textContent and file_data retrieval (lines ~412-433),
     add a vision detection branch BEFORE the standard text extraction:

     ```typescript
     // If this is a PLANNING_MAP with empty text, use vision extraction
     if (doc.documentType === 'PLANNING_MAP' && (!textContent || textContent.trim().length === 0)) {
       const fileData = await documentStore.getFileData(doc.id);
       if (!fileData) {
         res.status(422).json({
           error: 'No stored file data - delete and re-upload to retry',
         });
         return;
       }

       // Trigger vision extraction in background
       setImmediate(async () => {
         try {
           const { ExerciseExtractionService } = await import('../exercise/extraction-service.js');
           const extractionService = new ExerciseExtractionService(documentStore);
           await extractionService.extractMapWithVision(doc.id, fileData, tags);
           console.log(`[exercise] Vision extraction complete for ${doc.id}`);
         } catch (err) {
           console.error(`[exercise] Vision extraction failed for ${doc.id}:`, err);
         }
       });

       res.json({ message: 'Vision extraction triggered for map document', docId: doc.id });
       return;
     }
     ```

   - This branch must come BEFORE the existing text re-parse attempt so that PLANNING_MAP
     documents with empty text are routed to vision extraction instead of being re-parsed
     (re-parsing would just produce empty text again since unpdf cannot extract from map PDFs)

   - The existing flow for non-PLANNING_MAP documents remains unchanged

2. Ensure the import for ExerciseExtractionService is dynamic (already is in existing code)
   so the vision path only loads the extraction service when needed.

3. The tags variable is already constructed at line ~436 in the existing retry handler.
   Move or duplicate the tags construction before the vision branch so it's available for
   `extractMapWithVision`. The tags need: `team`, `exercisePhase`, `documentType`, `confidence`.
  </action>
  <verify>
    `cd backend && npx tsc --noEmit` passes.
    Manual test: Upload a planning map PDF to a scenario, observe it shows as "Parse failed" with empty
    textContent, then hit `POST /api/exercise/documents/:docId/retry-extraction` and verify the response
    says "Vision extraction triggered for map document". Check server logs for vision extraction output.
  </verify>
  <done>
    - PLANNING_MAP documents with empty textContent are automatically routed to vision extraction on retry
    - Non-PLANNING_MAP documents continue to use standard text re-parse and extraction
    - Vision extraction runs asynchronously (non-blocking response to client)
    - Server logs show vision extraction progress and completion
  </done>
</task>

</tasks>

<verification>
1. `cd backend && npx tsc --noEmit` - full type check passes
2. `cd backend && pnpm test -- --run` - existing tests pass (no regressions)
3. Grep confirms new exports exist:
   - `grep -r "preparePdfForVision" backend/src/strategic/ingestion/pdf-renderer.ts`
   - `grep -r "extractMapWithVision" backend/src/exercise/extraction-service.ts`
   - `grep -r "mapFeaturesToIPBLayers" backend/src/exercise/map-to-ipb-layers.ts`
4. Grep confirms retry endpoint has vision branch:
   - `grep -r "Vision extraction triggered" backend/src/api/exercise.ts`
</verification>

<success_criteria>
- PLANNING_MAP PDFs with empty textContent are routed to vision extraction on retry
- Vision extraction sends PDF directly to Claude API via base64 document block
- Extracted map data is converted to IPBLayer[] and stored in rawExtraction.ipbLayers
- Vision-generated summary text is persisted as textContent for future use
- LLM provider abstraction supports multimodal content (backward compatible)
- All existing extraction flows remain unchanged
</success_criteria>

<output>
After completion, create `.planning/quick/5-map-pdfs-to-ipb-graph-plan-as-documented/5-SUMMARY.md`
</output>
