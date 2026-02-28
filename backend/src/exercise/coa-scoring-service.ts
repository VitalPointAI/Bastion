/**
 * COA Scoring Service
 *
 * Phase 14 Plan 03: Doctrinal + wargame combined COA scoring with AI narrative synthesis.
 *
 * Scoring framework (FASDC — equal weights, 20% each):
 *   Feasibility    — can the force accomplish the mission with available resources?
 *   Acceptability  — are the expected outcomes worth the costs and risks?
 *   Suitability    — does the COA accomplish the mission and comply with guidance?
 *   Distinguishability — is this COA significantly different from others?
 *   Completeness   — does it address all aspects of the operational problem?
 *
 * Commander decisions are blockchain-anchored via existing outbox pattern.
 */

import { createHash } from 'crypto';
import type { Pool } from 'pg';
import type { COAStore } from './coa-store.js';
import type { ExerciseCOAScore, COACriterionScore } from './types.js';
import type { LLMProvider, ProviderConfig } from '../strategic/extraction/providers/types.js';
import { OpenAICompatibleProvider } from '../strategic/extraction/providers/openai-provider.js';

// ─── COA Comparison Result ─────────────────────────────────────────────────

export interface COAComparisonResult {
  matrix: Array<{
    criterion: string;
    scores: Array<{ coaId: string; coaName: string; score: number }>;
  }>;
  rankings: Array<{ coaId: string; coaName: string; combinedScore: number; rank: number }>;
  /** Staff-editable LLM-generated narrative */
  narrative: string;
  /** AI staff recommendation for commander */
  recommendation: string;
}

// ─── Raw LLM Scoring Output ────────────────────────────────────────────────

interface LLMScoringOutput {
  feasibility: { score: number; rationale: string };
  acceptability: { score: number; rationale: string };
  suitability: { score: number; rationale: string };
  distinguishability: { score: number; rationale: string };
  completeness: { score: number; rationale: string };
}

// ─── Service ──────────────────────────────────────────────────────────────

export class COAScoringService {
  private llm: LLMProvider;

  constructor(
    private readonly pool: Pool,
    private readonly coaStore: COAStore,
    llmConfig: ProviderConfig
  ) {
    this.llm = new OpenAICompatibleProvider(llmConfig);
  }

  // ─── Core Scoring Method ──────────────────────────────────────────────────

  /**
   * Score a COA against the 5 FASDC doctrinal criteria.
   *
   * If the COA has wargame evidence, that evidence is integrated into each
   * criterion's rationale before storing.
   *
   * Combined score = equal-weight average of all 5 criteria (20% each).
   */
  async scoreCOA(coaId: string, visibleTeams: string[]): Promise<ExerciseCOAScore> {
    // 1. Load the COA
    const coa = await this.coaStore.findById(coaId, visibleTeams);
    if (!coa) {
      throw new Error(`COA ${coaId} not found or not visible to requesting teams`);
    }

    // 2. Build the LLM prompt
    const wargameContext =
      Object.keys(coa.wargameEvidence).length > 0
        ? `\n\nWARGAME EVIDENCE (from simulation sessions):\n${JSON.stringify(coa.wargameEvidence, null, 2)}`
        : '';

    const prompt = `You are a military staff officer conducting a doctrinal COA evaluation (FASDC criteria per FM 6-0).

COURSE OF ACTION:
Name: ${coa.name}
Number: ${coa.number}
Team: ${coa.team.toUpperCase()}
Phase: ${coa.exercisePhase}

Description:
${coa.description}

Scheme of Maneuver:
${coa.scheme}
${wargameContext}

Score this COA on each of the 5 FASDC criteria on a 0-100 scale.

Scoring guidelines:
- 80-100: Excellent — fully meets the criterion with minimal risk
- 60-79:  Good — meets the criterion with manageable risk
- 40-59:  Adequate — marginally meets the criterion; notable risk
- 20-39:  Marginal — partially meets criterion; significant risk
- 0-19:   Unacceptable — fails to meet the criterion

CRITERIA DEFINITIONS:
1. Feasibility (0-100): Can the force accomplish this mission with available resources (personnel, equipment, logistics, time)?
2. Acceptability (0-100): Are the expected costs (casualties, material, political) worth the expected benefits/objectives achieved?
3. Suitability (0-100): Does this COA accomplish the mission AND comply with commander's guidance and higher authority direction?
4. Distinguishability (0-100): Is this COA meaningfully different from other COAs, offering a distinct operational approach?
5. Completeness (0-100): Does this COA address all aspects of the operational problem — tasks, purposes, timing, risk mitigation?

Output JSON exactly matching this schema:
{
  "feasibility": { "score": 75, "rationale": "..." },
  "acceptability": { "score": 60, "rationale": "..." },
  "suitability": { "score": 85, "rationale": "..." },
  "distinguishability": { "score": 70, "rationale": "..." },
  "completeness": { "score": 65, "rationale": "..." }
}

Output only valid JSON, no markdown fences.`;

    // 3. Call LLM for scoring
    let rawScores: LLMScoringOutput;
    try {
      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: 'You are a military staff officer evaluating courses of action. Output only valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      });
      const raw = response.content ?? '{}';
      const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
      rawScores = JSON.parse(cleaned) as LLMScoringOutput;
    } catch (err) {
      console.error('[COAScoringService] LLM scoring failed, using fallback:', err);
      rawScores = this.buildFallbackScores(coa.name);
    }

    // 4. Integrate wargame evidence into criterion rationales if available
    const wargameEvidence = coa.wargameEvidence as Record<string, unknown>;
    const hasWargame = Object.keys(wargameEvidence).length > 0;

    const feasibility: COACriterionScore = {
      score: this.clampScore(rawScores.feasibility?.score ?? 50),
      rationale: rawScores.feasibility?.rationale ?? '',
      wargameEvidence: hasWargame
        ? this.extractWargameNote(wargameEvidence, 'resource_adequacy', 'Wargame resource outcomes available')
        : undefined,
    };

    const acceptability: COACriterionScore = {
      score: this.clampScore(rawScores.acceptability?.score ?? 50),
      rationale: rawScores.acceptability?.rationale ?? '',
      wargameEvidence: hasWargame
        ? this.extractWargameNote(wargameEvidence, 'casualty_projections', 'Wargame casualty/loss projections available')
        : undefined,
    };

    const suitability: COACriterionScore = {
      score: this.clampScore(rawScores.suitability?.score ?? 50),
      rationale: rawScores.suitability?.rationale ?? '',
      wargameEvidence: hasWargame
        ? this.extractWargameNote(wargameEvidence, 'mission_accomplishment_rate', 'Wargame mission accomplishment rate available')
        : undefined,
    };

    const distinguishability: COACriterionScore = {
      score: this.clampScore(rawScores.distinguishability?.score ?? 50),
      rationale: rawScores.distinguishability?.rationale ?? '',
    };

    const completeness: COACriterionScore = {
      score: this.clampScore(rawScores.completeness?.score ?? 50),
      rationale: rawScores.completeness?.rationale ?? '',
    };

    // 5. Calculate combined score — equal weights (20% each)
    const combinedScore =
      (feasibility.score + acceptability.score + suitability.score +
       distinguishability.score + completeness.score) / 5;

    // 6. Generate AI narrative synthesis
    const narrative = await this.generateNarrative(
      coa.name,
      { feasibility, acceptability, suitability, distinguishability, completeness },
      combinedScore,
      hasWargame ? wargameEvidence : null
    );

    const scores: ExerciseCOAScore = {
      feasibility,
      acceptability,
      suitability,
      distinguishability,
      completeness,
      combinedScore: Math.round(combinedScore * 100) / 100,
      narrative,
      wargamingSessionId: (wargameEvidence.sessionId as string | undefined) ?? undefined,
    };

    // 7. Store the scores
    await this.coaStore.updateScores(coaId, scores);

    return scores;
  }

  // ─── Wargame Integration ───────────────────────────────────────────────────

  /**
   * Store wargame outcomes on the COA and re-score with that evidence integrated.
   */
  async integrateWargameResults(
    coaId: string,
    wargameSessionId: string,
    outcomes: Record<string, unknown>,
    visibleTeams: string[]
  ): Promise<void> {
    // Store the wargame evidence
    await this.coaStore.updateWargameEvidence(coaId, {
      sessionId: wargameSessionId,
      ...outcomes,
    });

    // Re-score with wargame evidence now included
    await this.scoreCOA(coaId, visibleTeams);
  }

  // ─── COA Comparison ───────────────────────────────────────────────────────

  /**
   * Compare multiple COAs across all 5 FASDC criteria.
   * Returns a matrix, rankings, LLM narrative, and AI staff recommendation.
   */
  async compareCOAs(coaIds: string[], visibleTeams: string[]): Promise<COAComparisonResult> {
    // Load all COAs
    const coas = await Promise.all(
      coaIds.map(id => this.coaStore.findById(id, visibleTeams))
    );

    // Filter nulls — COAs not visible to requesting teams
    const visibleCOAs = coas.filter(
      (c): c is NonNullable<typeof c> => c !== null
    );

    if (visibleCOAs.length === 0) {
      throw new Error('No COAs found or visible to requesting teams');
    }

    // Ensure all COAs have been scored
    const criteria = ['feasibility', 'acceptability', 'suitability', 'distinguishability', 'completeness'] as const;

    // Build comparison matrix
    const matrix = criteria.map(criterion => ({
      criterion: criterion.charAt(0).toUpperCase() + criterion.slice(1),
      scores: visibleCOAs.map(coa => ({
        coaId: coa.id,
        coaName: coa.name,
        score: coa.doctScores
          ? Math.round((coa.doctScores[criterion]?.score ?? 0) * 10) / 10
          : 0,
      })),
    }));

    // Build rankings by combined score
    const rankable = visibleCOAs.map(coa => ({
      coaId: coa.id,
      coaName: coa.name,
      combinedScore: coa.combinedScore ?? 0,
    }));
    rankable.sort((a, b) => b.combinedScore - a.combinedScore);
    const rankings = rankable.map((r, idx) => ({ ...r, rank: idx + 1 }));

    // Generate comparison narrative via LLM
    const coaSummaries = visibleCOAs.map(coa => ({
      name: coa.name,
      number: coa.number,
      combinedScore: coa.combinedScore ?? 0,
      scores: criteria.reduce(
        (acc, c) => ({
          ...acc,
          [c]: coa.doctScores?.[c]?.score ?? 0,
        }),
        {} as Record<string, number>
      ),
    }));

    let narrative = 'Comparative analysis not available — insufficient scored COAs.';
    let recommendation = 'Unable to generate recommendation — score COAs first.';

    try {
      const narrativePrompt = `You are a senior military staff officer writing a comparative COA analysis for the commander.

COA COMPARISON DATA:
${JSON.stringify(coaSummaries, null, 2)}

Rankings (highest combined score first):
${rankings.map(r => `Rank ${r.rank}: ${r.coaName} (${r.combinedScore.toFixed(1)}/100)`).join('\n')}

Write a concise 2-3 paragraph staff narrative that:
1. Highlights which COA scores highest on which criteria and why
2. Identifies the key trade-offs between COAs
3. Recommends a COA to the commander with clear reasoning

Output JSON:
{
  "narrative": "2-3 paragraph comparative narrative (staff-editable)",
  "recommendation": "1-2 sentence commander's recommendation"
}

Output only valid JSON, no markdown fences.`;

      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: 'You are a senior military staff officer. Output only valid JSON.',
          },
          { role: 'user', content: narrativePrompt },
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      const raw = response.content ?? '{}';
      const cleaned = raw.replace(/^```[a-z]*\n?/m, '').replace(/```$/m, '').trim();
      const parsed = JSON.parse(cleaned) as { narrative?: string; recommendation?: string };
      narrative = parsed.narrative ?? narrative;
      recommendation = parsed.recommendation ?? recommendation;
    } catch (err) {
      console.error('[COAScoringService] Comparison narrative generation failed:', err);
      // Use fallback narrative
      if (rankings.length > 0) {
        const top = rankings[0];
        narrative = `COA ${top.coaName} achieves the highest combined score of ${top.combinedScore.toFixed(1)}/100 across all FASDC criteria. Full narrative generation failed — review individual scores in the matrix for detailed assessment.`;
        recommendation = `Based on combined scoring, ${top.coaName} is recommended for commander consideration pending detailed review.`;
      }
    }

    return { matrix, rankings, narrative, recommendation };
  }

  // ─── Commander Decision ────────────────────────────────────────────────────

  /**
   * Record commander's decision on a COA, compute tamper-evident hash,
   * and write to outbox for NEAR blockchain anchoring.
   *
   * @returns SHA-256 hash of the decision record
   */
  async recordCommanderDecision(
    coaId: string,
    decision: string,
    notes: string
  ): Promise<{ hash: string }> {
    const timestamp = new Date().toISOString();

    // 1. Persist the decision text
    await this.coaStore.recordDecision(coaId, decision, notes);

    // 2. Compute SHA-256 hash of the canonical decision record
    const decisionRecord = JSON.stringify({ coaId, decision, notes, timestamp });
    const hash = createHash('sha256').update(decisionRecord, 'utf8').digest('hex');

    // 3. Store the hash back on the COA
    await this.coaStore.updateDecisionHash(coaId, hash);

    // 4. Write to outbox for NEAR blockchain anchoring (existing outbox pattern)
    await this.pool.query(
      `INSERT INTO outbox (aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        'commander_decision',
        coaId,
        'commander_decision_recorded',
        JSON.stringify({
          type: 'commander_decision',
          hash,
          coaId,
          decision,
          timestamp,
        }),
      ]
    );

    return { hash };
  }

  // ─── Narrative Generation Helper ──────────────────────────────────────────

  private async generateNarrative(
    coaName: string,
    scores: {
      feasibility: COACriterionScore;
      acceptability: COACriterionScore;
      suitability: COACriterionScore;
      distinguishability: COACriterionScore;
      completeness: COACriterionScore;
    },
    combinedScore: number,
    wargameEvidence: Record<string, unknown> | null
  ): Promise<string> {
    const wargameSection = wargameEvidence
      ? `\n\nWargame Evidence: ${JSON.stringify(wargameEvidence, null, 2)}`
      : '';

    const prompt = `Write a 2-3 paragraph military staff narrative for COA: ${coaName}

FASDC Scores (0-100):
- Feasibility: ${scores.feasibility.score} — ${scores.feasibility.rationale}
- Acceptability: ${scores.acceptability.score} — ${scores.acceptability.rationale}
- Suitability: ${scores.suitability.score} — ${scores.suitability.rationale}
- Distinguishability: ${scores.distinguishability.score} — ${scores.distinguishability.rationale}
- Completeness: ${scores.completeness.score} — ${scores.completeness.rationale}
Combined Score: ${combinedScore.toFixed(1)}/100
${wargameSection}

The narrative should:
1. Paragraph 1: Overall assessment (strengths)
2. Paragraph 2: Weaknesses and risks
3. Paragraph 3: Key trade-offs and recommendation to commander

Output ONLY the narrative text (not JSON), suitable for a military briefing document.
This is a staff-editable field — write it as a draft for staff review.`;

    try {
      const response = await this.llm.complete({
        messages: [
          {
            role: 'system',
            content: 'You are a military staff officer writing briefing narratives. Be concise and precise.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: 800,
        temperature: 0.3,
      });
      return response.content?.trim() ?? this.buildFallbackNarrative(coaName, combinedScore);
    } catch (err) {
      console.error('[COAScoringService] Narrative generation failed:', err);
      return this.buildFallbackNarrative(coaName, combinedScore);
    }
  }

  // ─── Utility Helpers ──────────────────────────────────────────────────────

  /** Clamp score to valid 0-100 range */
  private clampScore(score: number): number {
    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /** Extract a wargame note from evidence object, with fallback */
  private extractWargameNote(
    evidence: Record<string, unknown>,
    key: string,
    fallback: string
  ): string {
    const value = evidence[key];
    if (value === undefined || value === null) return fallback;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }

  /** Fallback scores when LLM is unavailable */
  private buildFallbackScores(coaName: string): LLMScoringOutput {
    return {
      feasibility: {
        score: 50,
        rationale: `${coaName}: Feasibility assessment pending — LLM unavailable. Manual review required.`,
      },
      acceptability: {
        score: 50,
        rationale: `${coaName}: Acceptability assessment pending — LLM unavailable. Manual review required.`,
      },
      suitability: {
        score: 50,
        rationale: `${coaName}: Suitability assessment pending — LLM unavailable. Manual review required.`,
      },
      distinguishability: {
        score: 50,
        rationale: `${coaName}: Distinguishability assessment pending — LLM unavailable. Manual review required.`,
      },
      completeness: {
        score: 50,
        rationale: `${coaName}: Completeness assessment pending — LLM unavailable. Manual review required.`,
      },
    };
  }

  /** Fallback narrative when LLM is unavailable */
  private buildFallbackNarrative(coaName: string, combinedScore: number): string {
    return `${coaName} achieved a combined FASDC score of ${combinedScore.toFixed(1)}/100. Detailed AI narrative unavailable — staff should review individual criterion scores and provide manual assessment.

Strengths and weaknesses have been captured in the individual criterion rationales above. Staff should review these scores and edit this narrative before commander briefing.

Recommendation: This COA requires manual staff review before commander presentation. Review individual scores above for detailed analysis.`;
  }
}
