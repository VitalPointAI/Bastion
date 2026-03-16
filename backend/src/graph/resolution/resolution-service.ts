/**
 * Entity Resolution Service
 *
 * Finds and resolves duplicate actors across documents using string similarity,
 * blocking algorithms, and LLM-assisted semantic verification.
 *
 * Phase 47 extension: hybrid three-signal scoring (string + embedding + type).
 * Weights: 0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim
 * Thresholds: auto_merge >= 0.85 | human_review 0.5-0.85 | distinct < 0.5
 */

import { createLLMForAgent } from '../../agents/langgraph/llm-factory.js';
import { actorStore } from '../raft/actor-store.js';
import { findCandidateMatches } from './blocking.js';
import type { MatchCandidate } from './string-matcher.js';

// ─── Re-exports for test compatibility ───────────────────────────────────────

/** Compute embedding cosine similarity between two text strings (0–1). */
export { computeEmbeddingSimilarity } from './embedding-matcher.js';

/** Compute ontology type similarity based on jsonldType (1.0 same, 0.0 different). */
export { computeOntologyTypeScore } from './ontology-matcher.js';

// ─── Hybrid Three-Signal Scoring ─────────────────────────────────────────────

/**
 * Fuse three resolution signals into a single hybrid score.
 *
 * @param stringSim    - String similarity score (0–1), weight: 0.4
 * @param embeddingSim - Embedding cosine similarity (0–1), weight: 0.4
 * @param typeSim      - Ontology type similarity (0–1), weight: 0.2
 */
export function computeHybridScore(
  stringSim: number,
  embeddingSim: number,
  typeSim: number,
): number {
  return 0.4 * stringSim + 0.4 * embeddingSim + 0.2 * typeSim;
}

/**
 * Classify a hybrid score into a resolution action.
 *
 * - >= 0.85 → 'auto_merge'  (high confidence — merge without human review)
 * - >= 0.50 → 'human_review' (ambiguous — queue for review)
 * -  < 0.50 → 'distinct'    (low similarity — treat as different entities)
 */
export function classifyHybridScore(
  score: number,
): 'auto_merge' | 'human_review' | 'distinct' {
  if (score >= 0.85) return 'auto_merge';
  if (score >= 0.5) return 'human_review';
  return 'distinct';
}

export interface ResolutionResult {
  candidates: MatchCandidate[];
  autoMerge: MatchCandidate[];      // Score >= 0.95, auto-merge
  needsReview: MatchCandidate[];    // 0.85 <= score < 0.95, needs human/LLM review
  verified: MatchCandidate[];       // LLM verified as same entity
  rejected: MatchCandidate[];       // LLM verified as different entities
}

export interface MergeResult {
  canonicalActorId: string;
  mergedActorIds: string[];
  aliasesAdded: string[];
}

/**
 * Entity Resolution Service
 * Finds and resolves duplicate actors across documents
 */
export class EntityResolutionService {
  private autoMergeThreshold = 0.95;
  private reviewThreshold = 0.85;

  /**
   * Find duplicate candidates in a workspace
   */
  async findDuplicates(workspaceId?: string): Promise<ResolutionResult> {
    const actors = await actorStore.listActors(workspaceId);
    const candidates = findCandidateMatches(actors, this.reviewThreshold);

    const autoMerge: MatchCandidate[] = [];
    const needsReview: MatchCandidate[] = [];

    for (const candidate of candidates) {
      if (candidate.score.score >= this.autoMergeThreshold) {
        autoMerge.push(candidate);
      } else {
        needsReview.push(candidate);
      }
    }

    return {
      candidates,
      autoMerge,
      needsReview,
      verified: [],
      rejected: [],
    };
  }

  /**
   * Use LLM to verify if two actors are the same entity
   */
  async verifyWithLLM(candidate: MatchCandidate): Promise<boolean> {
    try {
      // Use a lightweight model for verification
      const llm = await createLLMForAgent({ agentId: 'entity-resolver' });

      const prompt = `You are an entity resolution expert. Determine if these two entities refer to the same real-world actor.

Entity 1: "${candidate.actor1Name}"
Entity 2: "${candidate.actor2Name}"

String similarity score: ${candidate.score.score.toFixed(3)} (algorithm: ${candidate.score.algorithm})

Consider:
- Are these the same country, organization, or person?
- Could one be an abbreviation, alias, or alternate name of the other?
- Context: These are actors extracted from strategic/military documents.

Respond with ONLY "SAME" or "DIFFERENT" followed by a brief reason.`;

      const response = await llm.invoke(prompt);
      const text = typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);

      return text.toUpperCase().startsWith('SAME');
    } catch (error) {
      console.error('LLM verification failed:', error);
      // On error, fall back to threshold-based decision
      return candidate.score.score >= 0.90;
    }
  }

  /**
   * Verify all candidates that need review
   */
  async verifyAllCandidates(result: ResolutionResult): Promise<ResolutionResult> {
    const verified: MatchCandidate[] = [];
    const rejected: MatchCandidate[] = [];

    for (const candidate of result.needsReview) {
      const isSame = await this.verifyWithLLM(candidate);
      if (isSame) {
        verified.push(candidate);
      } else {
        rejected.push(candidate);
      }
    }

    return {
      ...result,
      verified,
      rejected,
    };
  }

  /**
   * Merge actors - keeps the one with more references as canonical
   */
  async mergeActors(actor1Id: string, actor2Id: string): Promise<MergeResult> {
    const actor1 = await actorStore.getActor(actor1Id);
    const actor2 = await actorStore.getActor(actor2Id);

    if (!actor1 || !actor2) {
      throw new Error('One or both actors not found');
    }

    // Keep the one with more source documents as canonical
    const [canonical, toMerge] = actor1.sourceDocumentIds.length >= actor2.sourceDocumentIds.length
      ? [actor1, actor2]
      : [actor2, actor1];

    // Merge the actors in Neo4j
    const mergedActor = await actorStore.mergeActors(toMerge.id, canonical.id);

    if (!mergedActor) {
      throw new Error('Failed to merge actors');
    }

    // Collect new aliases added
    const newAliases = [toMerge.name, ...toMerge.aliases].filter(
      alias => !canonical.aliases.includes(alias) && alias !== canonical.name
    );

    return {
      canonicalActorId: mergedActor.id,
      mergedActorIds: [toMerge.id],
      aliasesAdded: newAliases,
    };
  }

  /**
   * Auto-merge high-confidence duplicates
   */
  async autoMergeDuplicates(result: ResolutionResult): Promise<MergeResult[]> {
    const mergeResults: MergeResult[] = [];

    // Merge auto-merge candidates
    for (const candidate of result.autoMerge) {
      try {
        const mergeResult = await this.mergeActors(candidate.actor1Id, candidate.actor2Id);
        mergeResults.push(mergeResult);
      } catch (error) {
        console.error(`Failed to merge ${candidate.actor1Id} and ${candidate.actor2Id}:`, error);
      }
    }

    // Merge verified candidates
    for (const candidate of result.verified) {
      try {
        const mergeResult = await this.mergeActors(candidate.actor1Id, candidate.actor2Id);
        mergeResults.push(mergeResult);
      } catch (error) {
        console.error(`Failed to merge ${candidate.actor1Id} and ${candidate.actor2Id}:`, error);
      }
    }

    return mergeResults;
  }
}

export const entityResolutionService = new EntityResolutionService();
