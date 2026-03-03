/**
 * Exercise Extraction Service
 *
 * Phase 14 Plan 02: Wraps the existing strategic extraction pipeline with
 * exercise-specific system prompts that enforce team-based information isolation.
 *
 * Each document is processed with a prompt that:
 * 1. Identifies the team context (blue / red / controller)
 * 2. Identifies the document type for targeted extraction
 * 3. Explicitly prohibits the LLM from revealing intelligence the team
 *    would not have access to ("fog of war" enforcement in the prompt)
 *
 * Provider selection mirrors ExtractionService: Anthropic or OpenAI-compatible.
 */

import { DocumentParser } from '../strategic/ingestion/document-parser.js';
import { createProvider, getDefaultConfig } from '../strategic/extraction/providers/index.js';
import type {
  LLMProvider,
  LLMCompletionRequest,
  LLMToolDefinition,
  LLMContentBlock,
  ProviderConfig,
} from '../strategic/extraction/providers/types.js';
import { preparePdfForVision } from '../strategic/ingestion/pdf-renderer.js';
import type { ScenarioDocument } from './types.js';
import type { ExtractedExerciseData } from './types.js';
import type { PackageTags } from './package-parser.js';
import { ScenarioDocumentStore } from './document-store.js';
import { mapFeaturesToIPBLayers } from './map-to-ipb-layers.js';

// ─── System Prompt Template ───────────────────────────────────────────────────

/**
 * Build the exercise-specific system prompt for LLM extraction.
 *
 * Enforces team-specific information isolation ("fog of war") so that the LLM
 * only surfaces intelligence the given team would realistically have access to.
 *
 * @param tags - Inferred document tags (team, phase, documentType)
 * @param isPptx - True if the source document is a slide deck (content may lack slide boundaries)
 */
function buildExerciseSystemPrompt(tags: PackageTags, isPptx: boolean): string {
  const pptxNote = isPptx
    ? '\n\nNOTE: This content may be from a slide deck; slide boundaries may not be preserved in the extracted text. Treat each paragraph as potentially coming from a different slide.\n'
    : '';

  return `You are a military exercise analyst extracting structured data from exercise scenario documents.

This document is from a training/exercise package (designation: training/exercise).
Team context: ${tags.team} | Exercise phase: ${tags.exercisePhase} | Document type: ${tags.documentType}

Extract the following based on document type:
- OOB: Force composition, unit designations (with SIDC codes where identifiable), equipment types, strength estimates, echelon, geographic locations (lat/lng where inferrable, otherwise named location)
- SITREP: Situation updates, force movements, key events, changed objectives, casualty assessments
- CAMPAIGN_PLAN: Strategic objectives, operational phasing, COA descriptions, main/supporting efforts, decision points
- ALERTORD: Mission assignment, task organization, timeline, initial tasks, reporting instructions
- COUNTRY_POLICY: Access/basing/overflight status, conditions, limitations, diplomatic alignment
- FRAGO: Changed paragraphs from base order, effective time, new tasks/modifications
- PLANNING_MAP: Named regions, hex identifiers (for geographic mapping), key terrain features, approximate coordinates
- DIRECTIVE: Exercise structure, learning objectives, timeline, participating organizations
${pptxNote}
CRITICAL: Do NOT include intelligence that ${tags.team} would not have visibility of. Extract only from ${tags.team}'s perspective.

You MUST use the extract_exercise_data tool to provide your structured response.`;
}

// ─── Extraction Tool Schema ───────────────────────────────────────────────────

/**
 * JSON Schema for the exercise extraction tool.
 * Covers all document types with optional fields populated as relevant.
 */
const EXERCISE_EXTRACTION_TOOL: LLMToolDefinition = {
  name: 'extract_exercise_data',
  description:
    'Extract structured data from a military exercise scenario document. Populate fields relevant to the document type.',
  input_schema: {
    type: 'object',
    required: ['summary', 'rawExtraction'],
    properties: {
      summary: {
        type: 'string',
        description: 'One-paragraph summary of the document content',
      },
      forceDispositions: {
        type: 'array',
        description: 'Force units and their dispositions (primarily for OOB documents)',
        items: {
          type: 'object',
          required: ['unitName', 'echelon'],
          properties: {
            unitName: { type: 'string' },
            echelon: {
              type: 'string',
              description: 'e.g., corps, division, brigade, battalion, company',
            },
            sidc: {
              type: 'string',
              description: 'MIL-STD-2525D Symbol Identification Code if identifiable',
            },
            location: {
              description: 'Geographic location — either lat/lng object or named string',
              oneOf: [
                {
                  type: 'object',
                  required: ['lat', 'lng'],
                  properties: {
                    lat: { type: 'number' },
                    lng: { type: 'number' },
                  },
                },
                { type: 'string' },
              ],
            },
            strength: { type: 'string', description: 'Personnel or equipment count estimate' },
            equipment: {
              type: 'array',
              items: { type: 'string' },
              description: 'Major equipment types assigned to this unit',
            },
          },
        },
      },
      objectives: {
        type: 'array',
        description: 'Stated objectives with priority (for CAMPAIGN_PLAN and SITREP)',
        items: {
          type: 'object',
          required: ['id', 'description', 'priority'],
          properties: {
            id: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'string', enum: ['primary', 'secondary', 'tertiary'] },
          },
        },
      },
      timeline: {
        type: 'array',
        description: 'Ordered timeline of events (for SITREP, ALERTORD, FRAGO)',
        items: {
          type: 'object',
          required: ['event', 'time', 'phase'],
          properties: {
            event: { type: 'string' },
            time: { type: 'string', description: 'Date/time or relative time expression' },
            phase: { type: 'string', description: 'Exercise phase this event belongs to' },
          },
        },
      },
      keyEvents: {
        type: 'array',
        description: 'Key events and their operational significance (for SITREP)',
        items: {
          type: 'object',
          required: ['event', 'significance'],
          properties: {
            event: { type: 'string' },
            significance: { type: 'string' },
          },
        },
      },
      accessBasingOverflight: {
        type: 'object',
        description: 'Access, basing, and overflight status (for COUNTRY_POLICY)',
        required: ['access', 'basing', 'overflight', 'conditions'],
        properties: {
          access: { type: 'string' },
          basing: { type: 'string' },
          overflight: { type: 'string' },
          conditions: { type: 'string' },
        },
      },
      tasks: {
        type: 'array',
        description: 'Task assignments (for ALERTORD and FRAGO)',
        items: {
          type: 'object',
          required: ['assignedTo', 'task', 'purpose'],
          properties: {
            assignedTo: { type: 'string' },
            task: { type: 'string' },
            purpose: { type: 'string' },
          },
        },
      },
      changedItems: {
        type: 'array',
        description: 'Changed paragraphs or fields (for FRAGO documents)',
        items: {
          type: 'object',
          required: ['field', 'newValue'],
          properties: {
            field: { type: 'string' },
            oldValue: { type: 'string' },
            newValue: { type: 'string' },
          },
        },
      },
      rawExtraction: {
        type: 'object',
        description: 'Full raw extraction for audit/debugging — copy all fields here',
        additionalProperties: true,
      },
    },
  },
};

// ─── ExerciseExtractionService ────────────────────────────────────────────────

/**
 * ExerciseExtractionService wraps the existing extraction pipeline with
 * exercise-specific system prompts and stores results via ScenarioDocumentStore.
 */
export class ExerciseExtractionService {
  private provider: LLMProvider;
  private documentParser: DocumentParser;
  private documentStore: ScenarioDocumentStore;
  private chunkSize: number;

  /**
   * @param documentStore - Injected store for persisting extraction results
   * @param providerConfig - Optional LLM provider config (defaults to Anthropic Claude)
   * @param chunkSize - Max characters per chunk (default 8000)
   */
  constructor(
    documentStore: ScenarioDocumentStore,
    providerConfig?: ProviderConfig,
    chunkSize = 8000
  ) {
    this.documentStore = documentStore;
    this.documentParser = new DocumentParser();
    this.chunkSize = chunkSize;

    const config = providerConfig ?? getDefaultConfig('anthropic');
    this.provider = createProvider(config);
  }

  // ─── Core Extraction ────────────────────────────────────────────────────────

  /**
   * Extract structured exercise data from a single document.
   *
   * Steps:
   * 1. Chunk the text using DocumentParser.chunkDocument()
   * 2. Build a team-specific system prompt based on tags
   * 3. Call the LLM on each chunk via the exercise extraction tool
   * 4. Merge chunk results into a single ExtractedExerciseData
   * 5. Persist via ScenarioDocumentStore.updateExtraction()
   *
   * @param docId - Scenario document ID for persistence
   * @param textContent - Full extracted text content of the document
   * @param tags - Inferred PackageTags (team, phase, documentType, confidence)
   * @param mimeType - Original MIME type (used to detect PPTX for the prompt note)
   * @returns Merged extraction result
   */
  async extractDocument(
    docId: string,
    textContent: string,
    tags: PackageTags,
    mimeType?: string
  ): Promise<ExtractedExerciseData> {
    const isPptx =
      mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      mimeType === 'application/vnd.ms-powerpoint';

    const systemPrompt = buildExerciseSystemPrompt(tags, isPptx);
    const chunks = this.documentParser.chunkDocument(textContent, this.chunkSize);

    if (chunks.length === 0) {
      const emptyResult: ExtractedExerciseData = {
        summary: 'Document was empty or could not be parsed.',
        rawExtraction: {},
      };
      await this.documentStore.updateExtraction(docId, JSON.parse(JSON.stringify(emptyResult)) as Record<string, unknown>, 0);
      return emptyResult;
    }

    // Extract from each chunk
    const chunkResults: ExtractedExerciseData[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkResult = await this.extractFromChunk(chunks[i], i, systemPrompt);
      chunkResults.push(chunkResult);

      // Small delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await this.delay(500);
      }
    }

    // Merge all chunk results into a single ExtractedExerciseData
    const merged = this.mergeChunkResults(chunkResults);

    // Calculate confidence from tags confidence combined with chunk count
    const confidence = chunks.length > 0 ? Math.min(tags.confidence, 0.95) : 0;

    // Persist to DB — serialize through JSON to produce a proper Record<string, unknown>
    await this.documentStore.updateExtraction(
      docId,
      JSON.parse(JSON.stringify(merged)) as Record<string, unknown>,
      confidence
    );

    return merged;
  }

  // ─── Batch Extraction ───────────────────────────────────────────────────────

  /**
   * Extract all documents in a scenario package sequentially.
   * Logs progress and handles per-document errors without failing the batch.
   *
   * @param scenarioId - Scenario ID (for logging)
   * @param documents - Array of ScenarioDocument records to process
   */
  async extractScenarioPackage(
    scenarioId: string,
    documents: ScenarioDocument[]
  ): Promise<void> {
    const total = documents.length;
    console.log(`[exercise-extraction] Starting batch extraction for scenario ${scenarioId}: ${total} documents`);

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`[exercise-extraction] Extracting document ${i + 1}/${total}: ${doc.filename}`);

      try {
        const tags: PackageTags = {
          team: doc.team,
          exercisePhase: doc.exercisePhase,
          documentType: doc.documentType,
          confidence: doc.extractionConfidence > 0 ? doc.extractionConfidence : 0.5,
        };

        await this.extractDocument(doc.id, doc.textContent, tags, doc.mimeType);

        console.log(`[exercise-extraction] Document ${i + 1}/${total} complete: ${doc.filename}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error(
          `[exercise-extraction] Failed to extract document ${i + 1}/${total}: ${doc.filename} — ${message}`
        );
        // Continue with next document — do not abort the entire batch
      }
    }

    console.log(`[exercise-extraction] Batch complete for scenario ${scenarioId}`);
  }

  // ─── Vision Extraction (Scanned / Image-based PDFs) ─────────────────────────

  /**
   * Extract structured data from a PDF using Claude vision.
   *
   * Used for scanned / image-based PDFs where text extraction returns nothing.
   * Works for both PLANNING_MAP documents (extracts terrain, units, hex grids)
   * and general documents (extracts text-level content via OCR).
   *
   * Oversized PDFs (>32 MB or >100 pages) are automatically truncated to the
   * first N pages via pdf-lib before submission.
   *
   * After extraction:
   * - The LLM-generated summary is persisted as textContent for future standard extraction
   * - For PLANNING_MAP docs, IPBLayer[] are stored in rawExtraction.ipbLayers
   *
   * @param docId     - Scenario document ID for persistence
   * @param pdfBuffer - Raw PDF file buffer (from documentStore.getFileData)
   * @param tags      - PackageTags (team, exercisePhase, documentType, confidence)
   * @returns ExtractedExerciseData with structured fields
   */
  async extractWithVision(
    docId: string,
    pdfBuffer: Buffer,
    tags: PackageTags
  ): Promise<ExtractedExerciseData> {
    const payload = await preparePdfForVision(pdfBuffer);

    const truncationNote = payload.truncated
      ? `\n\nNOTE: This document was truncated from ${payload.originalPages} to ${payload.includedPages} pages due to size limits. Extract as much as possible from the available pages.`
      : '';

    const isMap = tags.documentType === 'PLANNING_MAP';

    const systemPrompt = isMap
      ? 'You are a military map analyst. Extract structured geographic and military data from this planning map.\n\n' +
        'Identify:\n' +
        '- Named regions and hex grid identifiers\n' +
        '- Key terrain features (mountains, rivers, urban areas, chokepoints)\n' +
        '- Unit positions and symbols (identify SIDC codes if possible)\n' +
        '- Boundaries (operational areas, phase lines, boundaries between units)\n' +
        '- Avenues of approach and engagement areas\n' +
        '- Named Areas of Interest (NAIs)\n\n' +
        'For each feature, estimate geographic coordinates or provide hex grid references.\n\n' +
        `Team context: ${tags.team} | Exercise phase: ${tags.exercisePhase}` +
        truncationNote + '\n\n' +
        'You MUST use the extract_exercise_data tool to provide your structured response.'
      : buildExerciseSystemPrompt(tags, false) +
        '\n\nNOTE: This PDF appears to be scanned or image-based. Read the visual content carefully and extract all text and structured data you can identify.' +
        truncationNote;

    const userText = isMap
      ? 'Extract structured military map data from this planning map PDF. Focus on terrain features, unit positions, avenues of approach, NAIs, and engagement areas.'
      : 'Extract structured exercise data from this scanned PDF document. Read all visible text and extract structured data according to the document type.';

    const content: LLMContentBlock[] = [
      {
        type: 'document',
        source: { type: 'base64', media_type: payload.mediaType, data: payload.base64 },
      },
      { type: 'text', text: userText },
    ];

    const request: LLMCompletionRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      tools: [EXERCISE_EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'extract_exercise_data' },
      max_tokens: 8192,
    };

    console.log(
      `[exercise-extraction] Starting vision extraction for doc ${docId} ` +
        `(${(payload.sizeBytes / 1024 / 1024).toFixed(1)} MB, ${payload.includedPages}/${payload.originalPages} pages` +
        `${payload.truncated ? ', truncated' : ''})`
    );

    let extractionInput: Record<string, unknown> | null = null;

    try {
      const response = await this.provider.complete(request);

      if (response.tool_use) {
        extractionInput = response.tool_use.input;
      } else if (response.content) {
        console.log(`[exercise-extraction] Vision: no tool_use, attempting JSON fallback for ${docId}`);
        extractionInput = this.parseJsonFromText(response.content);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[exercise-extraction] Vision extraction LLM call failed for ${docId}: ${message}`);
      throw err;
    }

    if (!extractionInput) {
      console.warn(`[exercise-extraction] Vision extraction produced no structured data for ${docId}`);
      const emptyResult: ExtractedExerciseData = {
        summary: 'Vision extraction produced no structured data from this document.',
        rawExtraction: { visionExtracted: true, truncated: payload.truncated },
      };
      await this.documentStore.updateExtraction(
        docId,
        JSON.parse(JSON.stringify(emptyResult)) as Record<string, unknown>,
        0.1
      );
      return emptyResult;
    }

    // Build the result object from extraction input
    const result: ExtractedExerciseData = {
      summary: (extractionInput.summary as string) || 'Vision-extracted document data.',
      forceDispositions: extractionInput.forceDispositions as ExtractedExerciseData['forceDispositions'],
      objectives: extractionInput.objectives as ExtractedExerciseData['objectives'],
      timeline: extractionInput.timeline as ExtractedExerciseData['timeline'],
      keyEvents: extractionInput.keyEvents as ExtractedExerciseData['keyEvents'],
      accessBasingOverflight: extractionInput.accessBasingOverflight as ExtractedExerciseData['accessBasingOverflight'],
      tasks: extractionInput.tasks as ExtractedExerciseData['tasks'],
      changedItems: extractionInput.changedItems as ExtractedExerciseData['changedItems'],
      rawExtraction: { ...extractionInput, visionExtracted: true, truncated: payload.truncated },
    };

    // Generate IPBLayer[] from extracted data (primarily useful for map docs)
    if (isMap) {
      const team = (tags.team === 'blue' || tags.team === 'red') ? tags.team : 'blue';
      const ipbLayers = mapFeaturesToIPBLayers(result, team);
      result.rawExtraction.ipbLayers = ipbLayers;
      console.log(
        `[exercise-extraction] Vision extraction complete for ${docId}: ` +
          `${ipbLayers.length} IPB layers generated`
      );
    } else {
      console.log(`[exercise-extraction] Vision extraction complete for ${docId}`);
    }

    // Persist extraction data
    const confidence = Math.min(tags.confidence, 0.8); // Cap vision confidence at 0.8
    await this.documentStore.updateExtraction(
      docId,
      JSON.parse(JSON.stringify(result)) as Record<string, unknown>,
      confidence
    );

    // Persist vision-generated summary as textContent so future retries use standard extraction
    if (result.summary && result.summary.length > 0) {
      await this.documentStore.updateTextContent(docId, result.summary);
    }

    return result;
  }

  // ─── Private Helpers ────────────────────────────────────────────────────────

  /**
   * Extract data from a single text chunk using the exercise extraction tool.
   */
  private async extractFromChunk(
    chunkText: string,
    chunkIndex: number,
    systemPrompt: string
  ): Promise<ExtractedExerciseData> {
    try {
      const request: LLMCompletionRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Extract structured data from the following document text (chunk ${chunkIndex + 1}):\n\n${chunkText}`,
          },
        ],
        tools: [EXERCISE_EXTRACTION_TOOL],
        tool_choice: { type: 'tool', name: 'extract_exercise_data' },
        max_tokens: 4096,
      };

      const response = await this.provider.complete(request);

      let extractionInput: Record<string, unknown> | null = null;

      if (response.tool_use) {
        extractionInput = response.tool_use.input;
      } else if (response.content) {
        // Fallback: attempt JSON parse from text content for models without tool_use
        console.log(
          `[exercise-extraction] Chunk ${chunkIndex}: No tool_use, attempting JSON fallback`
        );
        extractionInput = this.parseJsonFromText(response.content);
      }

      if (!extractionInput) {
        console.warn(
          `[exercise-extraction] Chunk ${chunkIndex}: No structured data extracted`
        );
        return { summary: `Chunk ${chunkIndex + 1}: No data extracted`, rawExtraction: {} };
      }

      return {
        summary: (extractionInput.summary as string) || '',
        forceDispositions: extractionInput.forceDispositions as ExtractedExerciseData['forceDispositions'],
        objectives: extractionInput.objectives as ExtractedExerciseData['objectives'],
        timeline: extractionInput.timeline as ExtractedExerciseData['timeline'],
        keyEvents: extractionInput.keyEvents as ExtractedExerciseData['keyEvents'],
        accessBasingOverflight: extractionInput.accessBasingOverflight as ExtractedExerciseData['accessBasingOverflight'],
        tasks: extractionInput.tasks as ExtractedExerciseData['tasks'],
        changedItems: extractionInput.changedItems as ExtractedExerciseData['changedItems'],
        rawExtraction: extractionInput,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `[exercise-extraction] Chunk ${chunkIndex} extraction failed: ${message}`
      );
      return { summary: `Chunk ${chunkIndex + 1}: Extraction failed — ${message}`, rawExtraction: {} };
    }
  }

  /**
   * Merge results from multiple chunks into a single ExtractedExerciseData.
   * Arrays are concatenated; summary uses the first non-empty chunk summary.
   */
  private mergeChunkResults(results: ExtractedExerciseData[]): ExtractedExerciseData {
    const merged: ExtractedExerciseData = {
      summary: results.find((r) => r.summary && !r.summary.startsWith('Chunk'))?.summary ?? '',
      rawExtraction: {},
    };

    for (const result of results) {
      // Concatenate array fields
      if (result.forceDispositions?.length) {
        merged.forceDispositions = [...(merged.forceDispositions ?? []), ...result.forceDispositions];
      }
      if (result.objectives?.length) {
        merged.objectives = [...(merged.objectives ?? []), ...result.objectives];
      }
      if (result.timeline?.length) {
        merged.timeline = [...(merged.timeline ?? []), ...result.timeline];
      }
      if (result.keyEvents?.length) {
        merged.keyEvents = [...(merged.keyEvents ?? []), ...result.keyEvents];
      }
      if (result.tasks?.length) {
        merged.tasks = [...(merged.tasks ?? []), ...result.tasks];
      }
      if (result.changedItems?.length) {
        merged.changedItems = [...(merged.changedItems ?? []), ...result.changedItems];
      }
      // accessBasingOverflight: use the first populated result
      if (!merged.accessBasingOverflight && result.accessBasingOverflight) {
        merged.accessBasingOverflight = result.accessBasingOverflight;
      }
      // Merge raw extraction data by chunk index
      const chunkKey = `chunk_${Object.keys(merged.rawExtraction).length}`;
      merged.rawExtraction[chunkKey] = result.rawExtraction;
    }

    return merged;
  }

  /**
   * Attempt to parse JSON from a text response (fallback for models without tool_use).
   */
  private parseJsonFromText(text: string): Record<string, unknown> | null {
    // Strip thinking tags
    text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    // Try direct parse
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && 'summary' in parsed) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not pure JSON
    }

    // Try markdown code block
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        const parsed = JSON.parse(codeBlockMatch[1].trim());
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Code block not valid JSON
      }
    }

    // Try extracting JSON object from text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // Could not parse
      }
    }

    return null;
  }

  /**
   * Simple delay for rate limit management between chunks.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
