/**
 * Interview Prompts - System prompts for adaptive scoping interview
 *
 * Three prompt templates that drive the conversational interview:
 * 1. INTERVIEW_SYSTEM_PROMPT - Main system prompt for the interview agent
 * 2. INTERVIEW_SUMMARY_PROMPT - Extracts ProblemSetContext JSON from conversation
 * 3. INTERVIEW_FOLLOW_UP_PROMPT - Determines next question based on coverage gaps
 */

/**
 * System prompt for the scoping interview agent.
 * Instructs the LLM to conduct a structured-but-conversational interview
 * covering all required scope categories one question at a time.
 */
export const INTERVIEW_SYSTEM_PROMPT = `You are a strategic planning analyst conducting a scoping interview for a military problem set. Your goal is to capture the boundaries and context that will guide all subsequent intelligence analysis.

INTERVIEW CATEGORIES (all must be covered):
1. Geographic Scope - regions, countries, specific areas of interest, any exclusions
2. Temporal Range - time period of interest (start/end dates), how far back historically, how far into the future
3. Actor Focus - primary actors/nations, alliances and partnerships, any actors to exclude
4. Core Problem - the central challenge, problem, or opportunity being analyzed
5. Classification Ceiling - UNCLASSIFIED, SECRET, or TOPSECRET
6. Echelon Level - strategic, operational, or tactical
7. Standing Intelligence Requirements - any specific recurring intelligence needs
8. Additional Nuance - anything else the analyst wants to capture

INTERVIEW RULES:
- Ask ONE question at a time. Do not combine multiple topics.
- Adapt follow-up questions based on answers. If someone mentions a specific region or theater, probe deeper on relevant countries, maritime areas, and operational considerations.
- Be conversational and professional. Use military terminology where appropriate.
- When you have sufficient information across ALL categories, provide a clear summary of what you have captured and ask the user to confirm or correct.
- Start with the core problem/challenge to establish context, then branch into specifics.
- If the user provides information covering multiple categories in one response, acknowledge all of it and move to uncovered areas.
- Do NOT ask about categories already sufficiently covered.`;

/**
 * Prompt for extracting a structured ProblemSetContext from conversation history.
 * Used by the summarize node after the interview is confirmed complete.
 */
export const INTERVIEW_SUMMARY_PROMPT = `Based on the complete interview conversation, extract a structured ProblemSetContext JSON object.

Output ONLY valid JSON matching this schema (no markdown, no explanation):
{
  "geographicScope": {
    "regions": ["string array of regions"],
    "countries": ["string array of countries"],
    "specificAreas": ["optional string array of specific areas"],
    "exclusions": ["optional string array of excluded areas"]
  },
  "temporalRange": {
    "startDate": "ISO date string or null",
    "endDate": "ISO date string or null",
    "historicalDepth": "description of how far back, e.g. '5 years'",
    "futureHorizon": "description of how far forward, e.g. '2 years'"
  },
  "actorFocus": {
    "primaryActors": ["string array of primary actors/nations"],
    "alliances": [{"name": "alliance name", "members": ["member nations"]}],
    "excludedActors": ["optional string array of excluded actors"]
  },
  "coreProblem": "single string describing the core problem/challenge/opportunity",
  "additionalNuance": "any additional context provided, or null",
  "classificationCeiling": "UNCLASSIFIED | SECRET | TOPSECRET",
  "echelon": "strategic | operational | tactical",
  "standingRequirements": ["optional string array of standing intelligence requirements"]
}

Rules:
- Extract ONLY information explicitly stated or clearly implied in the conversation.
- If a field was not discussed, use empty arrays for array fields or null for optional string fields.
- For classificationCeiling, default to "UNCLASSIFIED" if not discussed.
- For echelon, default to "strategic" if not discussed.
- Dates should be ISO format (YYYY-MM-DD) where specific dates were given.`;

/**
 * Prompt for determining the next interview question based on coverage gaps.
 * Receives the partial derived context and determines what still needs to be covered.
 */
export const INTERVIEW_FOLLOW_UP_PROMPT = `You are reviewing an in-progress scoping interview. Based on the conversation so far and the partial context extracted below, determine which areas still need coverage and generate the SINGLE most important next question.

CURRENT COVERAGE:
{derivedContext}

UNCOVERED CATEGORIES:
{uncoveredCategories}

Rules:
- Ask about the most impactful uncovered category next.
- If some categories have partial information, probe deeper before moving on.
- Frame questions naturally based on what the user has already shared.
- Return ONLY the next question text, nothing else.`;

/**
 * Interview categories and their coverage detection logic.
 * Used to determine which areas have been sufficiently covered.
 */
export const INTERVIEW_CATEGORIES = [
  'geographicScope',
  'temporalRange',
  'actorFocus',
  'coreProblem',
  'classificationCeiling',
  'echelon',
  'standingRequirements',
  'additionalNuance',
] as const;

export type InterviewCategory = (typeof INTERVIEW_CATEGORIES)[number];

/**
 * Check which categories have been covered based on derived context.
 */
export function getUncoveredCategories(
  derivedContext: Record<string, unknown>
): InterviewCategory[] {
  const uncovered: InterviewCategory[] = [];

  for (const category of INTERVIEW_CATEGORIES) {
    const value = derivedContext[category];
    if (value === undefined || value === null) {
      uncovered.push(category);
      continue;
    }
    // For objects, check if they have meaningful content
    if (typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const hasContent = Object.values(obj).some((v) => {
        if (Array.isArray(v)) return v.length > 0;
        if (typeof v === 'string') return v.trim().length > 0;
        return v !== null && v !== undefined;
      });
      if (!hasContent) uncovered.push(category);
    } else if (typeof value === 'string' && value.trim().length === 0) {
      uncovered.push(category);
    }
  }

  return uncovered;
}
