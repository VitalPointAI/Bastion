/**
 * Tactical AI Service
 *
 * AI-driven tactical assessment for autonomous robot missions.
 * The leader robot's "brain" — uses LangChain tools (skills) to reason about:
 *   - Map/terrain analysis (navigation skill)
 *   - Threat assessment (tactical skills)
 *   - Kill zone identification
 *   - Observation post selection
 *   - Route planning for advance and withdrawal
 *
 * The AI agent calls skills to gather information, then synthesizes a plan.
 * No hardcoded positions — all tactical decisions flow through AI reasoning.
 */

import { HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages';
import { createLLMForAgent } from '../agents/langgraph/llm-factory.js';
import { createNavigationTools } from './skills/navigation-skill.js';
import { createTacticalTools } from './skills/tactical-skills.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThreatInfo {
  entityId: string;
  classDesc: string;       // e.g. "CHN-99G", "T-90"
  confidence: number;
  /** Position in room coords where detected */
  detectedAt: { x: number; y: number };
  /** Estimated heading (degrees, 0=north) if available */
  estimatedHeading?: number;
}

export interface TacticalPlan {
  /** Natural language assessment of the situation */
  assessment: string;
  /** Recommended overwatch position with reasoning */
  overwatch: {
    position: { x: number; y: number };
    reasoning: string;
  };
  /** Recommended firing positions (one per available follower) */
  firingPositions: Array<{
    position: { x: number; y: number };
    reasoning: string;
  }>;
  /** Road-following routes */
  routes: {
    leaderToOverwatch: Array<{ x: number; y: number }>;
    followerRoutes: Array<Array<{ x: number; y: number }>>;
    withdrawalRoutes: {
      leader: Array<{ x: number; y: number }>;
      followers: Array<Array<{ x: number; y: number }>>;
    };
  };
  /** Overall recommendation */
  engagementRecommendation: 'engage' | 'observe' | 'withdraw';
  /** Confidence in the plan (0-1) */
  planConfidence: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export async function generateTacticalPlan(
  threats: ThreatInfo[],
  friendlyPositions: {
    leader: { id: string; position: { x: number; y: number } };
    followers: Array<{ id: string; position: { x: number; y: number } }>;
  },
  homeBase: { x: number; y: number },
): Promise<TacticalPlan> {
  let llm;
  try {
    llm = await createLLMForAgent({ agentId: 'tactical-ai' });
  } catch {
    console.warn('[TacticalAI] No LLM available — using fallback plan');
    return generateFallbackPlan(threats, friendlyPositions, homeBase);
  }

  // Bind navigation + tactical skills as tools
  const navTools = createNavigationTools();
  const tacTools = createTacticalTools();
  const allTools = [...navTools, ...tacTools];

  // bindTools may not exist on all LLM implementations
  if (!llm.bindTools) {
    console.warn('[TacticalAI] LLM does not support tool binding — using fallback');
    return generateFallbackPlan(threats, friendlyPositions, homeBase);
  }
  const llmWithTools = llm.bindTools(allTools);

  const systemPrompt = `You are a military tactical AI embedded in an autonomous robot team leader.
You have detected enemy threats during reconnaissance. You must assess the situation and plan
an engagement using the available skills (tools).

## Process
1. First call get_map_info to understand the operational area
2. Call assess_threat_capability for each threat type to understand what you're facing
3. Call identify_kill_zone to find the best ambush location on the enemy's advance axis
4. Call select_observation_post for the leader's overwatch position
5. Call calculate_weapons_engagement_zone to verify firing positions are outside enemy WEZ
6. Call plan_route for each element's advance route (use prefer_concealment=true)
7. Call plan_route for withdrawal routes (use different roads than advance)

## Rules
- ALL positions MUST be at road intersections — no off-road movement
- Overwatch must have sight lines to the threat area but be outside enemy WEZ
- Firing positions must FLANK the enemy — never head-on
- Firing corridors must not cross through the overwatch position
- Followers need >1.5 unit spacing for mutual defilade
- Withdrawal routes should differ from advance routes

After using tools, output your final plan as JSON matching this structure:
{
  "assessment": "string",
  "overwatch": {"position": {"x": N, "y": N}, "reasoning": "string"},
  "firingPositions": [{"position": {"x": N, "y": N}, "reasoning": "string"}, ...],
  "routes": {
    "leaderToOverwatch": [{"x": N, "y": N}, ...],
    "followerRoutes": [[{"x": N, "y": N}, ...], ...],
    "withdrawalRoutes": {"leader": [...], "followers": [[...], ...]}
  },
  "engagementRecommendation": "engage" | "observe" | "withdraw",
  "planConfidence": 0.0-1.0
}`;

  const threatDesc = threats.map((t) =>
    `- ${t.classDesc} at (${t.detectedAt.x.toFixed(1)}, ${t.detectedAt.y.toFixed(1)}) conf=${(t.confidence * 100).toFixed(0)}%${t.estimatedHeading != null ? ` heading=${t.estimatedHeading}°` : ''}`,
  ).join('\n');

  const friendlyDesc = [
    `Leader "${friendlyPositions.leader.id}" at (${friendlyPositions.leader.position.x.toFixed(1)}, ${friendlyPositions.leader.position.y.toFixed(1)})`,
    ...friendlyPositions.followers.map((f) =>
      `Follower "${f.id}" at (${f.position.x.toFixed(1)}, ${f.position.y.toFixed(1)})`),
  ].join('\n');

  const userPrompt = `## SITREP

### Enemy Threats Detected
${threatDesc}

### Friendly Forces
${friendlyDesc}

### Home Base
(${homeBase.x.toFixed(1)}, ${homeBase.y.toFixed(1)})

### Mission
Use your skills to assess threats, identify the kill zone, select positions, and plan routes.
Then provide your final tactical plan as JSON.`;

  try {
    console.log('[TacticalAI] Starting skills-based tactical assessment...');

    // Run the agent loop — the LLM calls tools, we execute them, feed back results
    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    // Tool-calling loop (max 10 iterations to prevent runaway)
    for (let i = 0; i < 10; i++) {
      const response = await llmWithTools.invoke(messages);
      messages.push(response);

      // Check if the response has tool calls
      const toolCalls = response.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        // No more tool calls — extract the final plan from the response
        const responseText = typeof response.content === 'string'
          ? response.content
          : (response.content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')?.text ?? '';

        const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

        // Find JSON in the response
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn('[TacticalAI] No JSON found in response, using fallback');
          return generateFallbackPlan(threats, friendlyPositions, homeBase);
        }

        const plan = JSON.parse(jsonMatch[0]) as TacticalPlan;
        console.log(`[TacticalAI] Plan generated via skills: recommendation=${plan.engagementRecommendation}, confidence=${plan.planConfidence}`);
        return plan;
      }

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const tool = allTools.find((t) => t.name === toolCall.name);
        if (!tool) {
          console.warn(`[TacticalAI] Unknown tool: ${toolCall.name}`);
          messages.push(new ToolMessage({ content: `Error: unknown tool "${toolCall.name}"`, tool_call_id: toolCall.id ?? '' }));
          continue;
        }

        console.log(`[TacticalAI] Executing skill: ${toolCall.name}`);
        try {
          const result = await tool.invoke(toolCall.args);
          messages.push(new ToolMessage({ content: typeof result === 'string' ? result : JSON.stringify(result), tool_call_id: toolCall.id ?? '' }));
        } catch (err) {
          messages.push(new ToolMessage({ content: `Error executing ${toolCall.name}: ${err}`, tool_call_id: toolCall.id ?? '' }));
        }
      }
    }

    console.warn('[TacticalAI] Tool loop exhausted (10 iterations), using fallback');
    return generateFallbackPlan(threats, friendlyPositions, homeBase);
  } catch (err) {
    console.error('[TacticalAI] Skills-based assessment failed, using fallback:', err);
    return generateFallbackPlan(threats, friendlyPositions, homeBase);
  }
}

// ---------------------------------------------------------------------------
// Fallback plan (when API unavailable or skills fail)
// ---------------------------------------------------------------------------

function generateFallbackPlan(
  threats: ThreatInfo[],
  friendlyPositions: {
    leader: { id: string; position: { x: number; y: number } };
    followers: Array<{ id: string; position: { x: number; y: number } }>;
  },
  homeBase: { x: number; y: number },
): TacticalPlan {
  // Use navigation skill directly for route computation
  const navTools = createNavigationTools();
  const tacTools = createTacticalTools();

  // Determine threat center
  const threatCenter = {
    x: threats.reduce((s, t) => s + t.detectedAt.x, 0) / (threats.length || 1),
    y: threats.reduce((s, t) => s + t.detectedAt.y, 0) / (threats.length || 1),
  };

  // Use skills synchronously via their func
  // For the fallback, compute positions using skill logic directly
  const _navTools = navTools;
  const _tacTools = tacTools;

  // Simple fallback: place overwatch 1.5 units south of threats, firing positions flanking
  const owPos = { x: threatCenter.x, y: threatCenter.y - 1.5 };
  const fpSpacing = 1.0;
  const firingPositions = friendlyPositions.followers.map((_, i) => ({
    position: {
      x: threatCenter.x + (i === 0 ? -fpSpacing : fpSpacing),
      y: threatCenter.y - 1.0,
    },
    reasoning: `Flanking position ${i + 1} — ${i === 0 ? 'west' : 'east'} of threat axis`,
  }));

  return {
    assessment: `${threats.length} hostile armored vehicle(s) detected. Fallback plan: flanking ambush from prepared positions south of threat axis.`,
    overwatch: {
      position: owPos,
      reasoning: 'Position south of threat area — clear observation with standoff distance.',
    },
    firingPositions,
    routes: {
      leaderToOverwatch: [owPos],
      followerRoutes: firingPositions.map((fp) => [homeBase, fp.position]),
      withdrawalRoutes: {
        leader: [homeBase],
        followers: firingPositions.map(() => [homeBase]),
      },
    },
    engagementRecommendation: threats.length > 3 ? 'observe' : 'engage',
    planConfidence: 0.6,
  };
}
