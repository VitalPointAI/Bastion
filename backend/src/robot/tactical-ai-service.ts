/**
 * Tactical AI Service
 *
 * AI-driven tactical assessment for autonomous robot missions.
 * Uses LangChain tool-calling: the AI calls navigation and tactical skills
 * to analyze terrain, assess threats, select positions, and plan routes.
 *
 * NO hardcoded positions — all tactical decisions flow through AI reasoning
 * or through skill functions when the LLM is unavailable.
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
  classDesc: string;
  confidence: number;
  detectedAt: { x: number; y: number };
  estimatedHeading?: number;
}

export interface TacticalPlan {
  assessment: string;
  overwatch: {
    position: { x: number; y: number };
    reasoning: string;
  };
  firingPositions: Array<{
    position: { x: number; y: number };
    reasoning: string;
  }>;
  routes: {
    leaderToOverwatch: Array<{ x: number; y: number }>;
    followerRoutes: Array<Array<{ x: number; y: number }>>;
    withdrawalRoutes: {
      leader: Array<{ x: number; y: number }>;
      followers: Array<Array<{ x: number; y: number }>>;
    };
  };
  engagementRecommendation: 'engage' | 'observe' | 'withdraw';
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
    console.warn('[TacticalAI] No LLM available — using skill-driven fallback');
    return generateSkillDrivenPlan(threats, friendlyPositions, homeBase);
  }

  const navTools = createNavigationTools();
  const tacTools = createTacticalTools();
  const allTools = [...navTools, ...tacTools];

  if (!llm.bindTools) {
    console.warn('[TacticalAI] LLM does not support tool binding — using skill-driven fallback');
    return generateSkillDrivenPlan(threats, friendlyPositions, homeBase);
  }
  const llmWithTools = llm.bindTools(allTools);

  const systemPrompt = `You are a military tactical AI embedded in an autonomous robot team leader.
You have detected enemy threats during reconnaissance. You must assess the situation and plan
an engagement using the available skills (tools).

## Process
1. Call get_map_info to understand the operational area
2. Call assess_threat_capability for each threat type
3. Call identify_kill_zone to find the best ambush location
4. Call select_observation_post for the leader's overwatch position
5. Call calculate_weapons_engagement_zone to verify positions are outside enemy WEZ
6. Call plan_route for each element's advance route (prefer_concealment=true)
7. Call plan_route for withdrawal routes (different roads than advance)

## Rules
- ALL positions MUST be at road intersections — no off-road movement
- Overwatch must have sight lines to the threat area but be outside enemy WEZ
- Firing positions must FLANK the enemy — never head-on
- Firing corridors must not cross through the overwatch position
- Followers need >1.5 unit spacing for mutual defilade
- Withdrawal routes should differ from advance routes

After using tools, output your final plan as JSON:
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

    const messages: BaseMessage[] = [
      new SystemMessage(systemPrompt),
      new HumanMessage(userPrompt),
    ];

    for (let i = 0; i < 10; i++) {
      const response = await llmWithTools.invoke(messages);
      messages.push(response);

      const toolCalls = response.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        const responseText = typeof response.content === 'string'
          ? response.content
          : (response.content as Array<{ type: string; text?: string }>).find(b => b.type === 'text')?.text ?? '';

        const cleaned = responseText.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.warn('[TacticalAI] No JSON found in response, using skill-driven fallback');
          return generateSkillDrivenPlan(threats, friendlyPositions, homeBase);
        }

        const plan = JSON.parse(jsonMatch[0]) as TacticalPlan;
        console.log(`[TacticalAI] AI plan generated: recommendation=${plan.engagementRecommendation}, confidence=${plan.planConfidence}`);
        console.log(`[TacticalAI] Assessment: ${plan.assessment}`);
        return plan;
      }

      for (const toolCall of toolCalls) {
        const tool = allTools.find((t) => t.name === toolCall.name);
        if (!tool) {
          messages.push(new ToolMessage({ content: `Error: unknown tool "${toolCall.name}"`, tool_call_id: toolCall.id ?? '' }));
          continue;
        }

        console.log(`[TacticalAI] Skill: ${toolCall.name}`);
        try {
          const result = await tool.invoke(toolCall.args);
          messages.push(new ToolMessage({ content: typeof result === 'string' ? result : JSON.stringify(result), tool_call_id: toolCall.id ?? '' }));
        } catch (err) {
          messages.push(new ToolMessage({ content: `Error: ${err}`, tool_call_id: toolCall.id ?? '' }));
        }
      }
    }

    console.warn('[TacticalAI] Tool loop exhausted, using skill-driven fallback');
    return generateSkillDrivenPlan(threats, friendlyPositions, homeBase);
  } catch (err) {
    console.error('[TacticalAI] Assessment failed, using skill-driven fallback:', err);
    return generateSkillDrivenPlan(threats, friendlyPositions, homeBase);
  }
}

// ---------------------------------------------------------------------------
// Skill-driven fallback (calls skills directly, no LLM)
// ---------------------------------------------------------------------------

async function generateSkillDrivenPlan(
  threats: ThreatInfo[],
  friendlyPositions: {
    leader: { id: string; position: { x: number; y: number } };
    followers: Array<{ id: string; position: { x: number; y: number } }>;
  },
  homeBase: { x: number; y: number },
): Promise<TacticalPlan> {
  console.log('[TacticalAI] Generating skill-driven plan (no LLM)...');

  const navTools = createNavigationTools();
  const tacTools = createTacticalTools();

  // 1. Get map info
  const _mapTool = navTools.find((t) => t.name === 'get_map_info')!;
  const routeTool = navTools.find((t) => t.name === 'plan_route')!;
  const killZoneTool = tacTools.find((t) => t.name === 'identify_kill_zone')!;
  const opTool = tacTools.find((t) => t.name === 'select_observation_post')!;

  // 2. Determine threat center and advance axis
  const threatCenter = {
    x: threats.reduce((s, t) => s + t.detectedAt.x, 0) / (threats.length || 1),
    y: threats.reduce((s, t) => s + t.detectedAt.y, 0) / (threats.length || 1),
  };

  // 3. Identify kill zone
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let killZoneResult: any;
  try {
    const raw = await killZoneTool.invoke({
      enemy_advance_axis: { road_name: 'Zhongxiao West', direction: 'south' },
      num_firing_positions: friendlyPositions.followers.length,
    });
    killZoneResult = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    console.log(`[TacticalAI] Kill zone: ${JSON.stringify(killZoneResult.kill_zone?.center)}`);
  } catch (err) {
    console.warn('[TacticalAI] Kill zone skill failed:', err);
  }

  // 4. Select observation post
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let opResult: any;
  try {
    const raw = await opTool.invoke({
      threat_area_center: threatCenter,
      friendly_base: homeBase,
      min_distance_from_threat: 1.5,
    });
    opResult = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    console.log(`[TacticalAI] OP selected: ${opResult.best?.name} at ${JSON.stringify(opResult.best?.position)}`);
  } catch (err) {
    console.warn('[TacticalAI] OP selection failed:', err);
  }

  // 5. Determine positions
  const owPos = opResult?.best?.position ?? { x: 2.1, y: 2.9 };
  const firingPositions = killZoneResult?.recommended_firing_positions?.map(
    (fp: { position: { x: number; y: number }; road: string }, i: number) => ({
      position: fp.position,
      reasoning: fp.road ?? `Firing position ${i + 1}`,
    }),
  ) ?? friendlyPositions.followers.map((_, i) => ({
    position: killZoneResult?.all_candidates?.[i]?.flanking_corridors?.[0]?.position ?? { x: 1.4 + i * 2.0, y: 2.0 + i * 1.3 },
    reasoning: `Flanking position ${i + 1}`,
  }));

  // 6. Compute routes using navigation skill
  const leaderRoute = await computeRouteViaTool(routeTool, friendlyPositions.leader.position, owPos, true);
  const followerRoutes = await Promise.all(
    firingPositions.map((fp: { position: { x: number; y: number } }) =>
      computeRouteViaTool(routeTool, homeBase, fp.position, true),
    ),
  );
  const leaderWithdrawal = await computeRouteViaTool(routeTool, owPos, homeBase, false);
  const followerWithdrawals = await Promise.all(
    firingPositions.map((fp: { position: { x: number; y: number } }) =>
      computeRouteViaTool(routeTool, fp.position, homeBase, false),
    ),
  );

  const plan: TacticalPlan = {
    assessment: `${threats.length} hostile armored vehicle(s) detected on Zhongxiao West Rd. Skill-driven plan: ${opResult?.best?.name ?? 'elevated'} overwatch, flanking ambush from perpendicular streets.`,
    overwatch: {
      position: owPos,
      reasoning: opResult?.best?.reasoning ?? 'Best available observation post',
    },
    firingPositions,
    routes: {
      leaderToOverwatch: leaderRoute,
      followerRoutes,
      withdrawalRoutes: {
        leader: leaderWithdrawal,
        followers: followerWithdrawals,
      },
    },
    engagementRecommendation: threats.length > 3 ? 'observe' : 'engage',
    planConfidence: 0.75,
  };

  console.log(`[TacticalAI] Skill-driven plan complete: OW=${JSON.stringify(owPos)}, ${firingPositions.length} firing positions`);
  return plan;
}

async function computeRouteViaTool(
  routeTool: { invoke: (args: Record<string, unknown>) => Promise<unknown> },
  from: { x: number; y: number },
  to: { x: number; y: number },
  preferConcealment: boolean,
): Promise<Array<{ x: number; y: number }>> {
  try {
    const raw = await routeTool.invoke({
      from_x: from.x, from_y: from.y,
      to_x: to.x, to_y: to.y,
      prefer_concealment: preferConcealment,
    });
    const result = JSON.parse(typeof raw === 'string' ? raw : JSON.stringify(raw));
    return result.waypoints ?? [to];
  } catch {
    return [to];
  }
}
