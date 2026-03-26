/**
 * Design Interview Service - LangGraph StateGraph for guided operational design
 *
 * Phase 55 Plan 01: Ironclaw-powered guided design interview. Walks users
 * through developing an operational approach via 4 sequential doctrinal
 * sections: Problem Framing → CoG Analysis → LOEs → Operational Approach.
 *
 * Architecture mirrors interview-service.ts (ScopingInterview) but extends it with:
 * - 4 sequential sections with doctrinal coverage criteria
 * - Red-team / devil's advocate probing
 * - Section review gates with user confirmation
 * - Cross-section referencing (later sections reference earlier derivedDesign)
 * - KG gap detection with fire-and-forget background research dispatch
 * - Final synthesis narrative generation
 *
 * Thread ID: `design-interview-${problemSetId}` (NOT `interview-` to avoid collision)
 * System message filter: .type !== 'system' per interview-service.ts Pitfall 2
 * Background research: fire-and-forget with try/catch, never awaited (Pitfall 5)
 */

import { StateGraph } from '@langchain/langgraph';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import { getCheckpointer } from '../orchestration/checkpointer.js';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import {
  DesignInterviewStateAnnotation,
  SECTION_ORDER,
} from './design-interview-types.js';
import type {
  DesignInterviewSection,
  DesignInterviewMeta,
} from './design-interview-types.js';
import {
  getDesignInterviewSystemPrompt,
  getRedTeamPrompt,
  evaluateSectionCoverage,
  getSectionReviewPrompt,
  getSynthesisNarrativePrompt,
} from './design-interview-prompts.js';
import { getDesignInterviewStore } from './design-interview-store.js';
import type { OperationalDesign } from '../design/types.js';
import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';

// ============================================================================
// Types
// ============================================================================

type DesignInterviewState = typeof DesignInterviewStateAnnotation.State;

// ============================================================================
// Utility
// ============================================================================

/**
 * Safely extract text content from an LLM response content field.
 * Handles plain strings, Anthropic content block arrays, and fallback.
 */
function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return (content as Array<{ type: string; text?: string }>)
      .filter(block => block.type === 'text')
      .map(block => block.text ?? '')
      .join('');
  }
  return String(content);
}

/**
 * Deep merge two plain objects (source overlays target).
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];
    if (
      targetVal &&
      sourceVal &&
      typeof targetVal === 'object' &&
      typeof sourceVal === 'object' &&
      !Array.isArray(targetVal) &&
      !Array.isArray(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

// ============================================================================
// Graph Node: LLM setup
// ============================================================================

async function getInterviewLLM() {
  return createLLMForAgent({
    agentId: 'ironclaw',
    overrides: { temperature: 0.4, maxTokens: 2048 },
  });
}

// ============================================================================
// Shared: KG Context Fetch (delegates to unified KGContextService)
// ============================================================================

/**
 * Fetch knowledge graph context for grounding interview questions and drafts.
 * Delegates to the unified KGContextService which uses GraphSummaryService
 * (centrality analysis, community detection, caching) under the hood.
 */
async function fetchKGContext(problemSetId: string): Promise<string | null> {
  const { kgContextService } = await import('../ironclaw/kg-context-service.js');
  return kgContextService.getFullContext(problemSetId);
}

// ============================================================================
// Graph Node: routeEntry
// ============================================================================

/**
 * Routes the graph to the appropriate starting node based on phase.
 * phase='start' → ask_question (generate next/first question)
 * phase='continue' → process_answer (extract from user's answer)
 */
function routeEntry(state: DesignInterviewState): string {
  if (state.phase === 'start') {
    return 'ask_question';
  }
  if (state.phase === 'confirm') {
    return 'advance_section';
  }
  return 'process_answer';
}

// ============================================================================
// Graph Node: askQuestion
// ============================================================================

/**
 * Generates the next interview question for the current section.
 * If awaitingSectionConfirm=true, generates the section review summary instead.
 * Uses section-specific system prompts with cross-section referencing.
 */
async function askQuestion(
  state: DesignInterviewState,
): Promise<Partial<DesignInterviewState>> {
  const llm = await getInterviewLLM();
  const { currentSection, derivedDesign, awaitingSectionConfirm, questionsAsked } = state;

  // Filter system messages before LLM invocation — CRITICAL (Pitfall 2)
  // Use .type property, not instanceof — checkpoint deserialization may not preserve class identity
  const conversationMessages: BaseMessage[] = state.messages.filter(
    (m) => m.type !== 'system' && !(m instanceof SystemMessage),
  );

  if (awaitingSectionConfirm) {
    // Section review gate: summarize and request confirmation
    const systemPrompt = getSectionReviewPrompt(currentSection, derivedDesign as Partial<OperationalDesign>);
    const response = await llm.invoke([
      new SystemMessage(systemPrompt),
      ...conversationMessages,
      new HumanMessage('Please provide the section review summary now.'),
    ]);

    return {
      messages: [response],
      questionsAsked: questionsAsked + 1,
    };
  }

  // Fetch KG context for grounding questions in real intelligence
  let kgContext: string | undefined;
  try {
    kgContext = await fetchKGContext(state.problemSetId) ?? undefined;
  } catch (err) {
    console.warn('[DesignInterview] KG context fetch failed (non-fatal):', err);
  }

  // Normal question: generate next probe for current section
  const systemPrompt = getDesignInterviewSystemPrompt(
    currentSection,
    derivedDesign as Partial<OperationalDesign>,
    kgContext,
  );

  let invocationMessages: BaseMessage[];

  if (questionsAsked === 0 || conversationMessages.length === 0) {
    // First question: introduce and start Problem Framing
    invocationMessages = [
      new SystemMessage(systemPrompt),
      new HumanMessage(
        'Begin the design interview. Introduce yourself briefly (one sentence) and ask your first question about the operational problem we need to frame.',
      ),
    ];
  } else {
    // Resume or continuation: include conversation history with a continuation cue
    // so the LLM picks up exactly where the interview left off.
    const coverage = evaluateSectionCoverage(currentSection, derivedDesign as Partial<OperationalDesign>);
    const metCount = coverage.metCriteria.length;
    const totalCount = coverage.criteria.length;
    const unmet = coverage.criteria.filter(c => !coverage.metCriteria.includes(c));

    invocationMessages = [
      new SystemMessage(systemPrompt),
      ...conversationMessages,
      new HumanMessage(
        `Continue the interview from where we left off. We are in the ${currentSection.replace(/-/g, ' ')} section. ` +
        `${metCount}/${totalCount} criteria captured so far.` +
        (unmet.length > 0 ? ` Still needed: ${unmet.join(', ')}.` : ' All criteria met — proceed to section review.') +
        ` Ask the next question that advances the section. Do NOT re-introduce yourself or repeat prior questions.`,
      ),
    ];
  }

  const response = await llm.invoke(invocationMessages);

  return {
    messages: [response],
    questionsAsked: questionsAsked + 1,
  };
}

// ============================================================================
// Graph Node: processAnswer
// ============================================================================

/**
 * Extracts structured design data from the user's answer.
 * Merges extracted data into derivedDesign.
 * Performs red-team probing by appending a follow-up challenge.
 * Detects KG gaps and dispatches fire-and-forget background research.
 */
async function processAnswer(
  state: DesignInterviewState,
): Promise<Partial<DesignInterviewState>> {
  const llm = await getInterviewLLM();
  const { currentSection, derivedDesign, pendingResearch, problemSetId } = state;

  // Filter system messages — CRITICAL (Pitfall 2)
  const conversationMessages: BaseMessage[] = state.messages.filter(
    (m) => m.type !== 'system' && !(m instanceof SystemMessage),
  );

  // Get the last user message (the answer to extract from)
  const lastUserMessage = [...conversationMessages]
    .reverse()
    .find((m) => m.type === 'human');
  const userAnswerText = lastUserMessage
    ? extractTextContent(lastUserMessage.content)
    : '';

  // ── Step 1: Extract structured data for current section ──────────────────

  const extractionPrompt = buildExtractionPrompt(currentSection, derivedDesign as Partial<OperationalDesign>);

  const extractionResponse = await llm.invoke([
    new SystemMessage(extractionPrompt),
    ...conversationMessages,
    new HumanMessage(
      'Extract structured data from the conversation above. Return ONLY valid JSON, no markdown code fences, no explanation.',
    ),
  ]);

  let updatedDesign = { ...(derivedDesign as Record<string, unknown>) };
  try {
    const content = extractTextContent(extractionResponse.content);
    let extracted: Record<string, unknown> | null = null;
    try {
      extracted = JSON.parse(content.trim()) as Record<string, unknown>;
    } catch {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        extracted = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      }
    }
    if (extracted) {
      updatedDesign = deepMerge(updatedDesign, extracted);
    }
  } catch {
    console.warn('[DesignInterviewService] Failed to extract structured data from answer');
  }

  // ── Step 1b: Detect "draft for me" meta-instructions ──────────────────────
  // When the user asks Ironclaw to draft/generate/fill in content rather than
  // providing substantive answers, extraction finds nothing. Detect this pattern
  // and generate content for the requested field(s) using available context.
  const draftRequestFields = detectDraftRequest(userAnswerText, currentSection);
  if (draftRequestFields.length > 0) {
    console.log(`[DesignInterviewService] Draft request detected for fields: ${draftRequestFields.join(', ')} (section: ${currentSection})`);
    try {
      const generated = await generateDraftContent(
        llm,
        currentSection,
        draftRequestFields,
        updatedDesign as Partial<OperationalDesign>,
        conversationMessages,
        problemSetId,
      );
      if (generated) {
        updatedDesign = deepMerge(updatedDesign, generated);
        console.log('[DesignInterviewService] Draft merged. updatedDesign keys:', Object.keys(updatedDesign));
        const pfAfter = updatedDesign.problemFraming as Record<string, unknown> | undefined;
        if (pfAfter) {
          console.log('[DesignInterviewService] problemFraming keys after merge:', Object.keys(pfAfter));
        }
      } else {
        console.warn('[DesignInterviewService] Draft generation returned null');
      }
    } catch (err) {
      console.warn('[DesignInterviewService] Draft generation failed (non-blocking):', err);
    }
  }

  // ── Step 2: KG gap detection and background research dispatch ─────────────
  // CRITICAL: Fire-and-forget, never awaited (Pitfall 5)
  // The interview MUST continue regardless of research dispatch success/failure

  const updatedPendingResearch = [...pendingResearch];

  try {
    const gaps = detectKGGaps(currentSection, userAnswerText, updatedDesign);
    if (gaps.length > 0) {
      // Fire-and-forget: dispatch background research for each detected gap
      void dispatchBackgroundResearch(problemSetId, gaps, updatedPendingResearch);
    }
  } catch (err) {
    // Never block interview on research errors
    console.warn('[DesignInterviewService] KG gap detection error (non-blocking):', err);
  }

  // ── Step 3: Check for current state divergence ────────────────────────────
  // If the current state was significantly updated, review downstream sections
  // for potential divergence with the new context

  const prevPf = (derivedDesign as Record<string, unknown>)?.problemFraming as Record<string, unknown> | undefined;
  const newPf = updatedDesign.problemFraming as Record<string, unknown> | undefined;
  const currentStateChanged = newPf?.currentState && prevPf?.currentState
    && newPf.currentState !== prevPf.currentState;

  let divergenceNote = '';
  if (currentStateChanged && currentSection === 'problem-framing') {
    // Check if downstream sections have content that might conflict
    const hasDownstream = (updatedDesign as Record<string, unknown>).cogAnalysis
      || (updatedDesign as Record<string, unknown>).linesOfEffort
      || (updatedDesign as Record<string, unknown>).operationalApproach;

    if (hasDownstream) {
      divergenceNote = '\n\n**Note:** The current state assessment has been updated. I will review the downstream sections (CoG Analysis, LOEs, Operational Approach) for potential divergence with this new context and flag any inconsistencies when we reach those sections.';
    }
  }

  // ── Step 4: Generate response ──────────────────────────────────────────────
  // When a draft was generated, acknowledge it instead of red-teaming a meta-instruction.
  // Otherwise, generate the standard red-team challenge.

  let responseMessage: AIMessage;

  if (draftRequestFields.length > 0) {
    // Draft was requested — generate an acknowledgment + review prompt
    const draftAckPrompt = `You are Ironclaw, an AI chief of staff guiding a design interview.

The commander just asked you to draft content for: ${draftRequestFields.join(', ')}.
You have generated a draft and placed it in the form fields on the left panel.

Current design state:
${JSON.stringify(updatedDesign, null, 2).substring(0, 4000)}

Respond with a BRIEF (2-3 sentences) message that:
1. Confirms you've drafted the content and placed it in the form
2. Summarizes what you wrote in one sentence
3. Asks the commander to review, edit, and refine it

Be concise, professional, and conversational. Do NOT repeat the full drafted text — just reference it.`;

    responseMessage = await llm.invoke([
      new SystemMessage(draftAckPrompt),
      ...conversationMessages,
    ]) as AIMessage;
  } else {
    // Standard flow: red-team challenge
    const redTeamPromptText = getRedTeamPrompt(
      currentSection,
      userAnswerText,
      updatedDesign as Partial<OperationalDesign>,
    );

    responseMessage = await llm.invoke([
      new SystemMessage(redTeamPromptText),
      ...conversationMessages,
    ]) as AIMessage;
  }

  // Append divergence note to response if applicable
  if (divergenceNote && typeof responseMessage.content === 'string') {
    responseMessage.content += divergenceNote;
  }

  return {
    derivedDesign: updatedDesign as Partial<OperationalDesign>,
    pendingResearch: updatedPendingResearch,
    messages: [responseMessage],
  };
}

// ============================================================================
// KG Gap Detection
// ============================================================================

/**
 * Detect potential knowledge graph gaps in the user's answer.
 * Looks for named entities (actors, places, documents, force structures) that
 * appear in the user's answer but lack grounding in KG context.
 *
 * Returns descriptive gap strings for research dispatch.
 */
function detectKGGaps(
  section: DesignInterviewSection,
  userAnswer: string,
  derivedDesign: Record<string, unknown>,
): string[] {
  const gaps: string[] = [];

  // Heuristic patterns for entities that often lack KG grounding
  const actorPatterns = [
    /\bPRC\b/i, /\bPLA\b/i, /\bPLAN\b/i, /\bPLAAF\b/i,
    /\bROC\b/i, /\bTaiwan\b/i, /\bUSINDOPACOM\b/i,
    /\bUN Security Council\b/i, /\bSCSO\b/i,
  ];

  const docPatterns = [
    /UN Security Council Resolution/i,
    /UNSCR \d+/i,
    /Executive Order/i,
    /National Defense Strategy/i,
    /NDS/i,
  ];

  const forcePatterns = [
    /carrier strike group/i,
    /CSG/i,
    /expeditionary strike group/i,
    /ESG/i,
    /ISR/i,
    /strike package/i,
  ];

  // Check each pattern category
  const actorMatches = actorPatterns
    .filter(p => p.test(userAnswer))
    .map(p => p.source.replace(/\\b/g, '').replace(/\\i/g, ''));

  if (actorMatches.length > 0) {
    gaps.push(
      `Actor/organization intelligence for entities referenced in ${section}: ${actorMatches.slice(0, 3).join(', ')}`,
    );
  }

  const docMatches = docPatterns.filter(p => p.test(userAnswer));
  if (docMatches.length > 0) {
    gaps.push(
      `Strategic documents or resolutions referenced in ${section} design interview`,
    );
  }

  const forceMatches = forcePatterns.filter(p => p.test(userAnswer));
  if (forceMatches.length > 0) {
    gaps.push(
      `Force structure and disposition data for military assets referenced in ${section}`,
    );
  }

  // Section-specific gap detection
  if (section === 'cog-analysis') {
    const pfDesign = derivedDesign.problemFraming as Record<string, unknown> | undefined;
    if (!pfDesign?.currentState) {
      // CoG analysis without problem framing context — gap in foundational intel
      gaps.push('Problem framing context needed for CoG analysis — adversary intent and capabilities');
    }
  }

  return gaps.slice(0, 3); // Cap at 3 research topics per turn
}

// ============================================================================
// Draft Request Detection & Generation
// ============================================================================

/** Field names that can be mapped from user intent to structured data keys */
const DRAFT_FIELD_PATTERNS: Array<{ pattern: RegExp; fields: string[] }> = [
  { pattern: /\b(?:end\s*state|desired\s*(?:end\s*)?state|desired\s*conditions?)\b/i, fields: ['desiredEndState'] },
  { pattern: /\b(?:current\s*state|current\s*conditions?|situation|environment)\b/i, fields: ['currentState'] },
  { pattern: /\b(?:problem\s*statement)\b/i, fields: ['problemStatement'] },
  { pattern: /\b(?:tensions?|key\s*tensions?)\b/i, fields: ['keyTensions'] },
  { pattern: /\b(?:obstacles?|barriers?)\b/i, fields: ['obstacles'] },
  // Catch-all for section-level drafts
  { pattern: /\b(?:all|everything|whole\s*section|entire\s*section)\b/i, fields: ['desiredEndState', 'problemStatement', 'keyTensions', 'obstacles'] },
];

/** Action verbs that indicate the user wants Ironclaw to generate content */
const DRAFT_ACTION_PATTERN = /\b(?:draft|generate|write|create|fill\s*(?:in|out)|suggest|propose|come\s*up\s*with|provide|give\s*me|enter|put\s*in|start\s*with|update|refresh|populate|set|build|develop)\b/i;
// NOTE: Expanded verb list (update, refresh, populate, set, build, develop) ensures
// commands like "update the current state" are recognized as draft requests.

/**
 * Detect whether the user's message is a meta-instruction asking Ironclaw
 * to draft/generate content rather than providing domain answers.
 * Returns the list of field keys the user wants drafted.
 */
function detectDraftRequest(
  userMessage: string,
  _section: DesignInterviewSection,
): string[] {
  // Must contain a draft-action verb
  if (!DRAFT_ACTION_PATTERN.test(userMessage)) return [];

  const requestedFields: string[] = [];
  for (const { pattern, fields } of DRAFT_FIELD_PATTERNS) {
    if (pattern.test(userMessage)) {
      for (const f of fields) {
        if (!requestedFields.includes(f)) requestedFields.push(f);
      }
    }
  }

  return requestedFields;
}

/**
 * Generate draft content for requested fields using available context.
 * Returns a partial design object suitable for deep-merging into derivedDesign.
 */
async function generateDraftContent(
  llm: Awaited<ReturnType<typeof getInterviewLLM>>,
  section: DesignInterviewSection,
  fields: string[],
  derivedDesign: Partial<OperationalDesign>,
  conversationMessages: BaseMessage[],
  problemSetId?: string,
): Promise<Record<string, unknown> | null> {
  const fieldList = fields.join(', ');
  const existingDesign = JSON.stringify(derivedDesign, null, 2).substring(0, 4000);

  // Fetch KG context to ground drafts in real intelligence
  let kgSection = '';
  if (problemSetId) {
    try {
      const kgContext = await fetchKGContext(problemSetId);
      if (kgContext) {
        kgSection = `\n\nKnowledge Graph Intelligence:\n${kgContext}\n`;
      }
    } catch {
      // Non-fatal — draft can still use conversation context
    }
  }

  const prompt = `You are Ironclaw, an AI chief of staff. The commander has asked you to draft content for the following field(s): ${fieldList}.

Use ALL available context — the conversation history, the current design data, knowledge graph intelligence, and your doctrinal knowledge — to produce the best possible draft.

Current design state:
${existingDesign}
${kgSection}
Generate substantive, doctrinally sound content for each requested field. Return ONLY valid JSON matching the extraction schema for ${section}. No markdown code fences, no explanation.

${buildExtractionPrompt(section, derivedDesign).split('\n\n').slice(1).join('\n\n')}`;

  const response = await llm.invoke([
    new SystemMessage(prompt),
    ...conversationMessages,
    new HumanMessage(`Draft the following fields now: ${fieldList}. Use the conversation context and available intelligence to produce the best starting point.`),
  ]);

  const content = extractTextContent(response.content);
  try {
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(content.trim()) as Record<string, unknown>;
    } catch {
      const jsonMatch =
        content.match(/```(?:json)?\s*([\s\S]*?)```/) ||
        content.match(/(\{[\s\S]*\})/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1]) as Record<string, unknown>;
      }
    }

    if (!parsed) {
      console.warn('[DesignInterviewService] Draft generation returned no parseable JSON. Raw:', content.substring(0, 500));
      return null;
    }

    // Normalize: if LLM returned flat field names without the section wrapper,
    // wrap them so deepMerge places content at the correct level.
    // e.g. { "desiredEndState": "..." } → { "problemFraming": { "desiredEndState": "..." } }
    const SECTION_WRAPPER_KEY: Record<string, string> = {
      'problem-framing': 'problemFraming',
      'cog-analysis': 'cogAnalysis',
      'loes': 'linesOfEffort',
      'operational-approach': 'operationalApproach',
    };
    const wrapperKey = SECTION_WRAPPER_KEY[section];
    if (wrapperKey && !parsed[wrapperKey]) {
      // Check if any of the requested fields exist at top level (flat response)
      const hasTopLevelField = fields.some((f) => f in parsed!);
      if (hasTopLevelField) {
        console.log(`[DesignInterviewService] Draft response missing '${wrapperKey}' wrapper — normalizing flat fields`);
        parsed = { [wrapperKey]: parsed };
      }
    }

    console.log('[DesignInterviewService] Draft generated for fields:', fields, 'keys:', Object.keys(parsed));
    return parsed;
  } catch {
    console.warn('[DesignInterviewService] Failed to parse draft generation response');
    return null;
  }
}

/**
 * Dispatch background research via the Researcher agent (fire-and-forget).
 * CRITICAL: This function must never be awaited (Pitfall 5).
 * Updates pendingResearch array in-place.
 */
async function dispatchBackgroundResearch(
  problemSetId: string,
  gaps: string[],
  pendingResearch: string[],
): Promise<void> {
  try {
    // Dynamic import to avoid circular dependencies at module load time
    const { Researcher } = await import('../doc-intelligence/specialists/researcher.js');
    const researcher = new Researcher();
    await researcher.triggerGapResearch(problemSetId, gaps, 0, 'design-interview');

    // Track dispatched topics
    for (const gap of gaps) {
      if (!pendingResearch.includes(gap)) {
        pendingResearch.push(gap);
      }
    }

    console.log(
      `[DesignInterviewService] Background research dispatched for ${problemSetId}: ${gaps.join(', ')}`,
    );
  } catch (err) {
    // Never surface research dispatch failures to the interview flow
    console.warn('[DesignInterviewService] Background research dispatch failed (non-blocking):', err);
  }
}

// ============================================================================
// Graph Node: checkSectionCoverage
// ============================================================================

/**
 * Evaluates whether the current section meets doctrinal coverage criteria.
 * Routes to:
 * - 'ask_question': keep probing (coverage not met)
 * - 'section_review_gate': coverage met — show summary for confirmation
 */
async function checkSectionCoverage(
  state: DesignInterviewState,
): Promise<Partial<DesignInterviewState>> {
  const { currentSection, derivedDesign, sectionCoverage } = state;

  const coverage = evaluateSectionCoverage(
    currentSection,
    derivedDesign as Partial<OperationalDesign>,
  );

  const updatedCoverage = {
    ...sectionCoverage,
    [currentSection]: coverage,
  };

  return {
    sectionCoverage: updatedCoverage,
    awaitingSectionConfirm: coverage.met,
  };
}

function routeAfterCoverageCheck(state: DesignInterviewState): string {
  if (state.awaitingSectionConfirm) {
    return 'section_review_gate';
  }
  return 'ask_question';
}

// ============================================================================
// Graph Node: sectionReviewGate
// ============================================================================

/**
 * Triggers the section review: sets awaitingSectionConfirm=true and
 * returns the review summary. Graph ends here to wait for user confirmation.
 */
async function sectionReviewGate(
  state: DesignInterviewState,
): Promise<Partial<DesignInterviewState>> {
  const llm = await getInterviewLLM();
  const { currentSection, derivedDesign } = state;

  const conversationMessages: BaseMessage[] = state.messages.filter(
    (m) => m.type !== 'system' && !(m instanceof SystemMessage),
  );

  const systemPrompt = getSectionReviewPrompt(
    currentSection,
    derivedDesign as Partial<OperationalDesign>,
  );

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    ...conversationMessages,
    new HumanMessage('Provide the section review summary now.'),
  ]);

  return {
    messages: [response],
    awaitingSectionConfirm: true,
  };
}

// ============================================================================
// Graph Node: advanceSection
// ============================================================================

/**
 * Advances to the next section after user confirms review.
 * Marks the current section confirmed in the store.
 * Resets awaitingSectionConfirm for the next section.
 */
async function advanceSection(
  state: DesignInterviewState,
): Promise<Partial<DesignInterviewState>> {
  const { currentSection, problemSetId } = state;

  // Persist section confirmation
  try {
    const store = getDesignInterviewStore();
    await store.markSectionConfirmed(problemSetId, currentSection);
  } catch (err) {
    console.warn('[DesignInterviewService] Failed to persist section confirmation:', err);
  }

  const currentIndex = SECTION_ORDER.indexOf(currentSection);
  const nextSection = SECTION_ORDER[currentIndex + 1] as DesignInterviewSection | undefined;

  if (!nextSection) {
    // All sections complete — trigger synthesis
    return {
      awaitingSectionConfirm: false,
      isComplete: false, // synthesizeNarrative will set this
    };
  }

  return {
    currentSection: nextSection,
    awaitingSectionConfirm: false,
  };
}

function routeAfterAdvance(state: DesignInterviewState): string {
  const currentIndex = SECTION_ORDER.indexOf(state.currentSection);
  const isLastSection = currentIndex === SECTION_ORDER.length - 1;

  if (isLastSection && !state.awaitingSectionConfirm) {
    // Check if we just advanced past the last section (operational-approach)
    // by seeing if all sections are covered
    const allSectionsCovered = SECTION_ORDER.every(
      (s) => state.sectionCoverage[s]?.met,
    );
    if (allSectionsCovered) {
      return 'synthesize_narrative';
    }
  }

  return 'ask_question';
}

// ============================================================================
// Graph Node: synthesizeNarrative
// ============================================================================

/**
 * Generates the final operational approach narrative tying all 4 sections together.
 * This is the capstone output of the design interview.
 */
async function synthesizeNarrative(
  state: DesignInterviewState,
): Promise<Partial<DesignInterviewState>> {
  const llm = await getInterviewLLM();
  const { derivedDesign } = state;

  const conversationMessages: BaseMessage[] = state.messages.filter(
    (m) => m.type !== 'system' && !(m instanceof SystemMessage),
  );

  const systemPrompt = getSynthesisNarrativePrompt(
    derivedDesign as Partial<OperationalDesign>,
  );

  const response = await llm.invoke([
    new SystemMessage(systemPrompt),
    ...conversationMessages,
    new HumanMessage('Generate the final operational approach narrative now.'),
  ]);

  return {
    messages: [response],
    isComplete: true,
  };
}

// ============================================================================
// Extraction Prompts (per section)
// ============================================================================

/**
 * Build the extraction system prompt for the current section.
 * Tells the LLM what structured data to extract from the conversation.
 */
function buildExtractionPrompt(
  section: DesignInterviewSection,
  derivedDesign: Partial<OperationalDesign>,
): string {
  const base = `You are extracting structured operational design data from a conversation.
Return ONLY valid JSON that can be deep-merged into an OperationalDesign object.
Current partial design: ${JSON.stringify(derivedDesign, null, 2).substring(0, 4000)}`;

  switch (section) {
    case 'problem-framing':
      return `${base}

Extract problem framing data. Return JSON with this structure (only include keys where information is available):
{
  "problemFraming": {
    "currentState": "string — current conditions constituting the problem",
    "desiredEndState": "string — specific measurable desired conditions",
    "problemStatement": "string — concise statement linking current to desired state",
    "keyTensions": ["tension 1", "tension 2"],
    "obstacles": ["obstacle 1", "obstacle 2"],
    "opportunities": ["opportunity 1"],
    "assumptions": ["assumption 1"],
    "constraints": ["constraint 1"]
  }
}`;

    case 'cog-analysis':
      return `${base}

Extract CoG analysis data using Strange's CG-CC-CR-CV framework. Return JSON with this structure:
{
  "cogAnalysis": {
    "adversary": {
      "root": {
        "id": "adv-cog-1",
        "type": "cog",
        "label": "adversary CoG name",
        "description": "description",
        "children": [
          {
            "id": "cc-1",
            "type": "critical-capability",
            "label": "CC name",
            "description": "description",
            "children": [
              {
                "id": "cr-1-1",
                "type": "critical-requirement",
                "label": "CR name",
                "description": "description",
                "children": []
              },
              {
                "id": "cv-1-1",
                "type": "critical-vulnerability",
                "label": "CV name",
                "description": "description",
                "children": []
              }
            ]
          }
        ]
      }
    },
    "friendly": {
      "root": {
        "id": "frd-cog-1",
        "type": "cog",
        "label": "friendly CoG name",
        "description": "description",
        "children": []
      }
    }
  }
}`;

    case 'loes':
      return `${base}

Extract lines of effort data. Return JSON with this structure:
{
  "linesOfEffort": [
    {
      "id": "loe-1",
      "name": "LOE name",
      "description": "description",
      "order": 1,
      "decisivePoints": [
        {
          "id": "dp-1-1",
          "label": "decisive point label",
          "description": "condition description",
          "phase": "phase name",
          "position": 1,
          "cogLinks": [
            {
              "loeId": "loe-1",
              "decisivePointId": "dp-1-1",
              "cogNodeId": "cv-1-1",
              "cogNodeType": "critical-vulnerability"
            }
          ]
        }
      ]
    }
  ]
}`;

    case 'operational-approach':
      return `${base}

Extract operational approach data. Return JSON with this structure:
{
  "operationalApproach": {
    "phases": [
      {
        "id": "phase-1",
        "name": "phase name",
        "description": "description",
        "order": 1
      }
    ],
    "transitions": [
      {
        "fromPhaseId": "phase-1",
        "toPhaseId": "phase-2",
        "conditions": ["condition 1 that triggers transition"]
      }
    ],
    "decisionPoints": [
      {
        "id": "dp-1",
        "label": "decision point label",
        "phaseId": "phase-1",
        "criteria": ["if/then condition requiring command decision"]
      }
    ],
    "narrative": ""
  }
}`;
  }
}

// ============================================================================
// Graph Builder
// ============================================================================

/**
 * Build and compile the design interview StateGraph.
 *
 * Topology:
 * __start__ → [routeEntry] → ask_question | process_answer
 * ask_question → __end__
 * process_answer → check_section_coverage
 * check_section_coverage → [routeAfterCoverageCheck] → ask_question | section_review_gate
 * section_review_gate → __end__  (waits for user confirmation)
 * [after user confirms: advanceSection called externally, graph re-invoked]
 * advance_section → [routeAfterAdvance] → ask_question | synthesize_narrative
 * synthesize_narrative → __end__
 */
async function buildDesignInterviewGraph() {
  const checkpointer = await getCheckpointer();

  const graph = new StateGraph(DesignInterviewStateAnnotation)
    .addNode('ask_question', askQuestion)
    .addNode('process_answer', processAnswer)
    .addNode('check_section_coverage', checkSectionCoverage)
    .addNode('section_review_gate', sectionReviewGate)
    .addNode('advance_section', advanceSection)
    .addNode('synthesize_narrative', synthesizeNarrative)
    // Entry routing
    .addConditionalEdges('__start__', routeEntry, {
      ask_question: 'ask_question',
      process_answer: 'process_answer',
      advance_section: 'advance_section',
    })
    // ask_question always ends (interrupt-resume)
    .addEdge('ask_question', '__end__')
    // process_answer → check coverage
    .addEdge('process_answer', 'check_section_coverage')
    // coverage check → either keep probing or trigger review gate
    .addConditionalEdges('check_section_coverage', routeAfterCoverageCheck, {
      ask_question: 'ask_question',
      section_review_gate: 'section_review_gate',
    })
    // section review gate always ends (waits for user confirmation)
    .addEdge('section_review_gate', '__end__')
    // After advance_section: next section or synthesis
    .addConditionalEdges('advance_section', routeAfterAdvance, {
      ask_question: 'ask_question',
      synthesize_narrative: 'synthesize_narrative',
    })
    .addEdge('synthesize_narrative', '__end__');

  return graph.compile({ checkpointer });
}

// Cached compiled graph (singleton)
let compiledGraph: Awaited<ReturnType<typeof buildDesignInterviewGraph>> | null = null;

async function getGraph() {
  if (!compiledGraph) {
    compiledGraph = await buildDesignInterviewGraph();
  }
  return compiledGraph;
}

// ============================================================================
// DesignInterviewService — Public API
// ============================================================================

/**
 * DesignInterviewService provides the public API for the guided design interview.
 *
 * - startInterview: Begins a new interview (checks ScopingInterview prerequisite)
 * - continueInterview: Processes user message, returns next question or red-team challenge
 * - confirmSection: Called when user confirms section review — advances to next section
 * - getInterviewState: Returns current meta for resume after page refresh
 * - resetInterview: Clears state for a fresh start
 */
export class DesignInterviewService {
  /**
   * Start a new design interview for a problem set.
   * Checks that a ScopingInterview has been completed (prerequisite).
   * Returns the first AI message (introduction and opening question).
   */
  async startInterview(
    problemSetId: string,
    mode: 'new' | 'revision' = 'new',
  ): Promise<{ message: AIMessage; meta: DesignInterviewMeta }> {
    const graph = await getGraph();

    // Soft prerequisite check — warn but don't hard-block
    const scopingContext = await getProblemSetContext(problemSetId).catch(() => null);
    if (!scopingContext) {
      console.warn(
        `[DesignInterviewService] No ScopingInterview found for ${problemSetId} — proceeding without context`,
      );
    }

    const config = {
      configurable: { thread_id: `design-interview-${problemSetId}` },
    };

    const result = await graph.invoke(
      {
        messages: [],
        currentSection: 'problem-framing' as DesignInterviewSection,
        sectionCoverage: {},
        derivedDesign: {},
        interviewMode: mode,
        awaitingSectionConfirm: false,
        problemSetId,
        questionsAsked: 0,
        isComplete: false,
        phase: 'start' as const,
        pendingResearch: [],
      },
      config,
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return {
      message: lastMessage as AIMessage,
      meta: extractMeta(result as DesignInterviewState),
    };
  }

  /**
   * Continue an existing interview with the user's answer.
   * Adds the human message to state, processes through process_answer,
   * check_section_coverage, and then ask_question (or section_review_gate).
   */
  async continueInterview(
    problemSetId: string,
    userMessage: string,
  ): Promise<{ message: AIMessage; meta: DesignInterviewMeta }> {
    const graph = await getGraph();

    const config = {
      configurable: { thread_id: `design-interview-${problemSetId}` },
    };

    // Snapshot derivedDesign before invocation to diff field changes
    const snapshot = await graph.getState(config);
    const prevDerivedDesign = (snapshot?.values as DesignInterviewState | undefined)?.derivedDesign;

    const result = await graph.invoke(
      {
        messages: [new HumanMessage(userMessage)],
        phase: 'continue' as const,
      },
      config,
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return {
      message: lastMessage as AIMessage,
      meta: extractMeta(result as DesignInterviewState, prevDerivedDesign as Partial<OperationalDesign> | undefined),
    };
  }

  /**
   * Called when user confirms the section review summary.
   * Sets awaitingSectionConfirm=false and advances to next section (or synthesis).
   * Returns the first question of the next section, or the synthesis narrative.
   */
  async confirmSection(
    problemSetId: string,
  ): Promise<{ message: AIMessage; meta: DesignInterviewMeta }> {
    const graph = await getGraph();

    const config = {
      configurable: { thread_id: `design-interview-${problemSetId}` },
    };

    // Route through advance_section via the 'confirm' phase entry
    const result = await graph.invoke(
      {
        phase: 'confirm' as const,
        awaitingSectionConfirm: false,
      },
      config,
    );

    const lastMessage = result.messages[result.messages.length - 1];

    return {
      message: lastMessage as AIMessage,
      meta: extractMeta(result as DesignInterviewState),
    };
  }

  /**
   * Get current interview state for page refresh resume.
   * Returns null if no interview has been started.
   */
  async getInterviewState(
    problemSetId: string,
  ): Promise<{ messages: BaseMessage[]; meta: DesignInterviewMeta } | null> {
    const graph = await getGraph();

    const config = {
      configurable: { thread_id: `design-interview-${problemSetId}` },
    };

    try {
      const state = await graph.getState(config);
      if (
        !state ||
        !state.values ||
        (state.values as DesignInterviewState).messages.length === 0
      ) {
        return null;
      }

      const values = state.values as DesignInterviewState;
      return {
        messages: values.messages,
        meta: extractMeta(values),
      };
    } catch {
      return null;
    }
  }

  /**
   * Reset the interview for a problem set — clears checkpointer state and store.
   * Use when starting fresh or on user request.
   */
  async resetInterview(problemSetId: string): Promise<void> {
    // Clear store progress
    try {
      const store = getDesignInterviewStore();
      await store.resetProgress(problemSetId);
    } catch (err) {
      console.warn('[DesignInterviewService] Failed to reset store progress:', err);
    }

    // Note: LangGraph checkpointer state cannot be fully cleared without direct DB access.
    // The interview start will override state via a fresh invoke with empty messages.
    console.log(`[DesignInterviewService] Interview reset for ${problemSetId}`);
  }
}

// ============================================================================
// Utility: Extract meta from state
// ============================================================================

function extractMeta(state: DesignInterviewState, prevDerivedDesign?: Partial<OperationalDesign>): DesignInterviewMeta {
  // Generate field writes from derivedDesign changes
  const fieldWrites: Array<{ targetField: string; value: string | string[] }> = [];
  const d = state.derivedDesign as Record<string, unknown> | undefined;

  if (d) {
    const prev = (prevDerivedDesign ?? {}) as Record<string, unknown>;

    // Problem Framing fields — only write substantive values (skip placeholders/empty)
    const pf = d.problemFraming as Record<string, unknown> | undefined;
    const prevPf = prev.problemFraming as Record<string, unknown> | undefined;

    const isSubstantive = (v: unknown): boolean => {
      if (!v || typeof v !== 'string') return false;
      const lower = v.toLowerCase().trim();
      // Filter out placeholder/status text that shouldn't overwrite real content
      return lower.length > 10
        && !lower.startsWith('not yet')
        && !lower.startsWith('not articulated')
        && !lower.includes('requires specification')
        && !lower.includes('requires definition')
        && !lower.includes('to be determined');
    };

    if (pf) {
      if (isSubstantive(pf.currentState) && pf.currentState !== prevPf?.currentState) {
        fieldWrites.push({ targetField: 'currentState', value: pf.currentState as string });
      }
      if (isSubstantive(pf.desiredEndState) && pf.desiredEndState !== prevPf?.desiredEndState) {
        fieldWrites.push({ targetField: 'desiredEndState', value: pf.desiredEndState as string });
      }
      if (isSubstantive(pf.problemStatement) && pf.problemStatement !== prevPf?.problemStatement) {
        fieldWrites.push({ targetField: 'problemStatement', value: pf.problemStatement as string });
      }
      if (Array.isArray(pf.keyTensions) && pf.keyTensions.length > 0 && JSON.stringify(pf.keyTensions) !== JSON.stringify(prevPf?.keyTensions)) {
        fieldWrites.push({ targetField: 'keyTensions', value: pf.keyTensions as string[] });
      }
      if (Array.isArray(pf.obstacles) && pf.obstacles.length > 0 && JSON.stringify(pf.obstacles) !== JSON.stringify(prevPf?.obstacles)) {
        fieldWrites.push({ targetField: 'obstacles', value: pf.obstacles as string[] });
      }
    }
  }

  if (fieldWrites.length > 0) {
    console.log('[DesignInterviewService] Field writes generated:', fieldWrites.map(fw => fw.targetField));
  } else if (prevDerivedDesign) {
    // Log when we expected field writes but got none (draft was requested)
    const pf = d?.problemFraming as Record<string, unknown> | undefined;
    const prevPf = (prevDerivedDesign as Record<string, unknown>)?.problemFraming as Record<string, unknown> | undefined;
    if (pf?.desiredEndState) {
      console.log('[DesignInterviewService] desiredEndState exists but no fieldWrite. Current:', String(pf.desiredEndState).substring(0, 80), '| Prev:', String(prevPf?.desiredEndState ?? '(none)').substring(0, 80));
    }
  }

  return {
    currentSection: state.currentSection,
    sectionCoverage: state.sectionCoverage,
    questionsAsked: state.questionsAsked,
    isComplete: state.isComplete,
    interviewMode: state.interviewMode,
    awaitingSectionConfirm: state.awaitingSectionConfirm,
    fieldWrites: fieldWrites.length > 0 ? fieldWrites : undefined,
  };
}

/** Singleton service instance */
let serviceInstance: DesignInterviewService | null = null;

export function getDesignInterviewService(): DesignInterviewService {
  if (!serviceInstance) {
    serviceInstance = new DesignInterviewService();
  }
  return serviceInstance;
}
