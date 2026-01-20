/**
 * Character Builder
 *
 * Utilities for building system prompts and context from Eliza-style character definitions.
 * Enables rich personality configuration for AI agents.
 */

import type { AgentCharacter, CharacterMessage } from './types.js';

/**
 * Build a system prompt from a character definition.
 * Combines bio, lore, style, and adjectives into a comprehensive system prompt.
 */
export function buildSystemPrompt(character: AgentCharacter): string {
  const sections: string[] = [];

  // Name and identity
  sections.push(`You are ${character.name}.`);

  // Bio (combine all entries)
  if (character.bio.length > 0) {
    sections.push('\n## About You\n' + character.bio.join('\n'));
  }

  // Lore/Backstory
  if (character.lore.length > 0) {
    sections.push('\n## Your Background\n' + character.lore.join('\n'));
  }

  // Personality adjectives
  if (character.adjectives.length > 0) {
    sections.push(
      '\n## Your Personality\nYou are: ' + character.adjectives.join(', ') + '.'
    );
  }

  // Topics of interest
  if (character.topics.length > 0) {
    sections.push(
      '\n## Topics of Interest\nYou are knowledgeable about and interested in: ' +
        character.topics.join(', ') +
        '.'
    );
  }

  // Communication style
  if (character.style) {
    const styleInstructions: string[] = [];

    if (character.style.all.length > 0) {
      styleInstructions.push(
        'In all communications: ' + character.style.all.join('; ')
      );
    }

    if (character.style.chat.length > 0) {
      styleInstructions.push(
        'In chat/conversational contexts: ' + character.style.chat.join('; ')
      );
    }

    if (character.style.post.length > 0) {
      styleInstructions.push(
        'In formal or written contexts: ' + character.style.post.join('; ')
      );
    }

    if (styleInstructions.length > 0) {
      sections.push(
        '\n## Your Communication Style\n' + styleInstructions.join('\n')
      );
    }
  }

  return sections.join('\n');
}

/**
 * Build few-shot examples from a character's message examples.
 * Returns formatted conversation examples for inclusion in prompts.
 */
export function buildFewShotExamples(character: AgentCharacter): string {
  if (!character.messageExamples || character.messageExamples.length === 0) {
    return '';
  }

  const examples: string[] = [];
  examples.push('\n## Example Conversations\n');

  character.messageExamples.forEach((conversation, idx) => {
    examples.push(`Example ${idx + 1}:`);
    conversation.forEach((message: CharacterMessage) => {
      const role = message.role === 'user' ? 'User' : character.name;
      examples.push(`${role}: ${message.content}`);
    });
    examples.push('');
  });

  return examples.join('\n');
}

/**
 * Build knowledge context from a character's knowledge base.
 * Optionally filters by relevance to a query using simple keyword matching.
 */
export function buildKnowledgeContext(
  character: AgentCharacter,
  query?: string
): string {
  if (!character.knowledge || character.knowledge.length === 0) {
    return '';
  }

  let relevantKnowledge = character.knowledge;

  // Simple keyword-based relevance filtering
  if (query) {
    const queryTerms = query.toLowerCase().split(/\s+/);
    relevantKnowledge = character.knowledge.filter((entry) => {
      const entryLower = entry.toLowerCase();
      return queryTerms.some((term) => entryLower.includes(term));
    });

    // If no relevant knowledge found, include all
    if (relevantKnowledge.length === 0) {
      relevantKnowledge = character.knowledge;
    }
  }

  if (relevantKnowledge.length === 0) {
    return '';
  }

  return (
    '\n## Relevant Knowledge\n' +
    relevantKnowledge.map((k) => `- ${k}`).join('\n')
  );
}

/**
 * Build post examples from a character's post examples.
 * Useful for social media or formal writing contexts.
 */
export function buildPostExamples(character: AgentCharacter): string {
  if (!character.postExamples || character.postExamples.length === 0) {
    return '';
  }

  return (
    '\n## Example Posts/Writing Style\n' +
    character.postExamples.map((p) => `- "${p}"`).join('\n')
  );
}

/**
 * Merge a character's style with task-specific instructions.
 * Task instructions take precedence but character style is preserved.
 */
export function mergeWithTaskInstructions(
  character: AgentCharacter,
  taskInstructions: string
): string {
  const systemPrompt = buildSystemPrompt(character);
  const examples = buildFewShotExamples(character);

  return `${systemPrompt}

## Current Task
${taskInstructions}
${examples}`;
}

/**
 * Build a complete prompt for an agent with character and context.
 * Combines system prompt, knowledge, examples, and task instructions.
 */
export function buildCompletePrompt(
  character: AgentCharacter,
  taskInstructions: string,
  contextQuery?: string
): string {
  const systemPrompt = buildSystemPrompt(character);
  const knowledge = buildKnowledgeContext(character, contextQuery);
  const examples = buildFewShotExamples(character);

  return `${systemPrompt}
${knowledge}
${examples}

## Current Task
${taskInstructions}`;
}

/**
 * Extract the character's preferred model provider if specified.
 * Returns undefined if not set (use global default).
 */
export function getCharacterModelProvider(
  character: AgentCharacter
): string | undefined {
  return character.modelProvider;
}

/**
 * Extract voice settings from a character (for TTS integrations).
 */
export function getCharacterVoiceSettings(
  character: AgentCharacter
): { model?: string; voice?: string; speed?: number } | undefined {
  return character.settings?.voice;
}

/**
 * Get a character's enabled plugins/tools.
 */
export function getCharacterPlugins(character: AgentCharacter): string[] {
  return character.plugins || [];
}

/**
 * Create a minimal character definition with required fields.
 */
export function createMinimalCharacter(
  name: string,
  description?: string
): AgentCharacter {
  return {
    name,
    bio: description ? [description] : [],
    lore: [],
    knowledge: [],
    messageExamples: [],
    postExamples: [],
    topics: [],
    style: {
      all: [],
      chat: [],
      post: [],
    },
    adjectives: [],
    plugins: [],
  };
}

/**
 * Merge two character definitions, with the second taking precedence.
 * Useful for layering base characters with customizations.
 */
export function mergeCharacters(
  base: AgentCharacter,
  overlay: Partial<AgentCharacter>
): AgentCharacter {
  return {
    name: overlay.name ?? base.name,
    bio: overlay.bio ?? base.bio,
    lore: overlay.lore ?? base.lore,
    knowledge: overlay.knowledge ?? base.knowledge,
    messageExamples: overlay.messageExamples ?? base.messageExamples,
    postExamples: overlay.postExamples ?? base.postExamples,
    topics: overlay.topics ?? base.topics,
    style: overlay.style ?? base.style,
    adjectives: overlay.adjectives ?? base.adjectives,
    modelProvider: overlay.modelProvider ?? base.modelProvider,
    settings: overlay.settings ?? base.settings,
    plugins: overlay.plugins ?? base.plugins,
  };
}

/**
 * Validate a character definition is complete enough for use.
 * Returns an array of validation issues (empty if valid).
 */
export function validateCharacter(character: AgentCharacter): string[] {
  const issues: string[] = [];

  if (!character.name || character.name.trim().length === 0) {
    issues.push('Character must have a name');
  }

  if (character.bio.length === 0 && character.lore.length === 0) {
    issues.push('Character should have at least one bio or lore entry');
  }

  if (character.style.all.length === 0 && character.style.chat.length === 0) {
    issues.push('Character should have at least one style trait');
  }

  return issues;
}
