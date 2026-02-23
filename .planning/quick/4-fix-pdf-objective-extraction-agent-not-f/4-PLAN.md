---
phase: quick-4
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/strategic/extraction/extractor.ts
autonomous: true
requirements: [quick-4]

must_haves:
  truths:
    - "Uploading a research proposal or project proposal PDF produces extracted objectives (not 0)"
    - "Standard national security strategy documents still extract correctly with DIME/MIDLIFE"
    - "Non-standard document types get best-effort objective extraction with appropriate categorization"
    - "Chunk summaries explain what was found even when 0 objectives are extracted"
  artifacts:
    - path: "backend/src/strategic/extraction/extractor.ts"
      provides: "Adaptive extraction system prompt that handles diverse document types"
      contains: "document type"
  key_links:
    - from: "backend/src/strategic/extraction/extractor.ts"
      to: "LLM API"
      via: "EXTRACTION_SYSTEM_PROMPT constant"
      pattern: "EXTRACTION_SYSTEM_PROMPT"
---

<objective>
Fix PDF objective extraction returning 0 objectives for non-standard strategic documents (research proposals, project proposals, policy papers, etc.).

Purpose: The current extraction system prompt is narrowly tuned for national security strategy documents (NSS, NDS, NMS). When documents with different language patterns are uploaded (research proposals, project proposals, etc.), the LLM correctly determines there are no "strategic objectives" in the traditional military sense and returns 0 results. The prompt needs to be broadened to extract goals, aims, research outcomes, deliverables, and other objective-like content from diverse document types, mapping them to the DIME/MIDLIFE framework where applicable.

Output: Updated ExtractionService with adaptive system prompt that handles diverse document types while maintaining DIME/MIDLIFE categorization.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/src/strategic/extraction/extractor.ts
@backend/src/strategic/extraction/schemas.ts
@backend/src/strategic/extraction/providers/types.ts
@backend/src/api/strategic.ts (lines 480-593 — POST extract endpoint)
</context>

<tasks>

<task type="auto">
  <name>Task 1: Broaden extraction system prompt for diverse document types</name>
  <files>backend/src/strategic/extraction/extractor.ts</files>
  <action>
Update the EXTRACTION_SYSTEM_PROMPT constant in extractor.ts to be adaptive across document types. The current prompt says "You are a strategic planning analyst extracting objectives from national security documents" and has Rule #1 "Only extract explicitly stated objectives, not inferred or implied ones." This is too narrow.

Changes to the system prompt:

1. **Broaden the role description**: Change from "extracting objectives from national security documents" to "extracting strategic objectives, goals, and aims from strategic and planning documents of all types (national security strategies, research proposals, project proposals, policy papers, operational plans, etc.)."

2. **Expand what counts as an "objective"**: Add guidance that objectives can take many forms depending on document type:
   - National security documents: Strategic objectives, national interests, defense priorities
   - Research proposals: Research goals, research objectives, expected outcomes, deliverables
   - Project proposals: Project goals, milestones, deliverables, success criteria
   - Policy papers: Policy goals, recommended actions, desired outcomes
   - General: Any stated goal, aim, objective, outcome, or deliverable

3. **Soften Rule #1**: Change from "Only extract explicitly stated objectives, not inferred or implied ones" to "Extract objectives that are clearly stated or strongly implied by the document's structure and language. Include goals, aims, research questions (reframed as objectives), deliverables, and desired outcomes. Do NOT fabricate objectives that have no textual basis."

4. **Add document type detection guidance**: Add a new instruction: "First, identify the document type (national security strategy, research proposal, project proposal, policy paper, operational plan, or other). Adapt your extraction approach accordingly. For non-military documents, map content to DIME/MIDLIFE categories on a best-effort basis using the closest applicable category."

5. **Add a fallback instruction**: "If the document does not contain traditional strategic objectives, extract the document's stated goals, aims, outcomes, or deliverables as objectives. Use the DIME category that best fits each item, defaulting to INFORMATIONAL for academic/research goals that don't clearly map to another category."

6. **Keep all DIME/MIDLIFE definitions and EWM doctrine** unchanged — these are the output format and should work for any document type.

7. **Update the user message template** in extractFromChunk: After the "TEXT:" section, add a hint line:
   "If this text is from a research proposal, project proposal, or non-military document, extract its goals, aims, deliverables, and desired outcomes as objectives."

Do NOT change:
- The extraction tool schema (input_schema) — it should remain the same
- The Zod validation schemas in schemas.ts
- The consolidateChunks logic
- The provider abstraction layer
- Any API endpoint logic
  </action>
  <verify>
Run `cd /home/vitalpointai/projects/ssr/backend && npx tsc --noEmit` to verify TypeScript compilation succeeds. The only change is to string constants so there should be no type errors.
  </verify>
  <done>
The EXTRACTION_SYSTEM_PROMPT is broadened to handle diverse document types. The prompt explicitly mentions research proposals, project proposals, and policy papers. Rule #1 is softened to include "strongly implied" objectives. A fallback instruction ensures non-military documents still produce results by extracting goals/aims/outcomes as objectives.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add diagnostic logging for zero-objective extraction results</name>
  <files>backend/src/strategic/extraction/extractor.ts</files>
  <action>
Add diagnostic logging to help debug future extraction issues. In the extractFromChunk method:

1. After successful parsing (line ~282, after `parsed.data`), add a log:
   ```
   console.log(`[extraction] Chunk ${chunkIndex}: ${parsed.data.objectives.length} objectives found, confidence: ${parsed.data.extractionConfidence}, summary: "${parsed.data.chunkSummary.substring(0, 100)}"`);
   ```

2. In the catch block (around line 297), add more detail:
   ```
   console.warn(`[extraction] Chunk ${chunkIndex} extraction failed or returned no tool_use. Error: ${message}. This may indicate the LLM provider does not support tool_use/function_calling, or the document content doesn't match the extraction prompt.`);
   ```

3. In extractFromDocument, after consolidation (around line 495), add a diagnostic log when 0 objectives are found:
   ```
   if (consolidated.objectives.length === 0) {
     console.warn(`[extraction] WARNING: 0 objectives extracted from ${chunks.length} chunks. Document may not contain extractable objectives, or the LLM may not be responding with tool_use. Chunk summaries: ${chunkResults.map(r => r.chunkSummary).join(' | ')}`);
   }
   ```

These logs provide visibility into WHY extraction returns 0 results, which is critical for debugging LLM provider issues vs content mismatch issues.
  </action>
  <verify>
Run `cd /home/vitalpointai/projects/ssr/backend && npx tsc --noEmit` to verify no type errors introduced.
  </verify>
  <done>
Diagnostic logging added at chunk level (objectives found per chunk with confidence) and document level (warning when 0 total objectives extracted, including chunk summaries for debugging).
  </done>
</task>

</tasks>

<verification>
1. `cd /home/vitalpointai/projects/ssr/backend && npx tsc --noEmit` passes
2. The EXTRACTION_SYSTEM_PROMPT string contains "research proposal" and "project proposal"
3. The EXTRACTION_SYSTEM_PROMPT no longer says "Only extract explicitly stated objectives"
4. Diagnostic console.warn exists for 0-objective results
5. No changes to extraction tool schema, Zod schemas, or API endpoints
</verification>

<success_criteria>
- The extraction system prompt is broadened to handle research proposals, project proposals, policy papers, and other non-standard strategic documents
- DIME/MIDLIFE framework maintained as output format with best-effort categorization for non-military documents
- Diagnostic logging provides visibility into extraction results per chunk and warns on 0 total objectives
- No breaking changes to the extraction tool schema, validation, or API contract
- TypeScript compiles cleanly
</success_criteria>

<output>
After completion, create `.planning/quick/4-fix-pdf-objective-extraction-agent-not-f/4-SUMMARY.md`
</output>
