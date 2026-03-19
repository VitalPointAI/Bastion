/**
 * Tactical AI Service
 *
 * Provides AI-driven tactical assessment for autonomous robot missions.
 * The leader robot's "brain" — takes threat detections + embedded map knowledge
 * and reasons about optimal positions, routes, and engagement plans.
 *
 * Uses Claude API with a structured system prompt embedding the operational
 * area's street grid (from OpenStreetMap data of Taipei Zhongzheng District).
 */

import Anthropic from '@anthropic-ai/sdk';

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
// Embedded map context — Zhongzheng District street grid
// ---------------------------------------------------------------------------

const MAP_CONTEXT = `## Operational Area: Taipei Zhongzheng District
Room coordinate system: 5m x 5m, X=East, Y=North
Geo bounds: 25.0420-25.0480°N, 121.5120-121.5180°E

### Road Network (room coordinates)

**North-South roads (movement corridors):**
- Hengyang Road: x≈0.3 (tertiary, west side)
- Chongqing South Road S1: x≈1.1 (tertiary)
- Xiangyang Road: x≈1.4 (tertiary)
- Guanqian Road: x≈2.5 (tertiary, diagonal sections)
- Chengde Road S1: x≈3.4 (unclassified)
- Gongyuan Road: x≈4.4 (tertiary, east side)

**East-West roads (cross streets):**
- Wuchang Street S1: y≈1.7 (residential)
- Nanyang Street: y≈2.0 (residential)
- Hankou Street S1: y≈2.6 (residential)
- Xuchang Street: y≈2.9 (residential)
- Kaifeng Street S1: y≈3.3 (residential)
- Zhongxiao West Road: y≈4.4 (PRIMARY — major 6-lane arterial, likely enemy advance axis)

### Key Landmarks
- Changyang Parking Tower: (2.1, 2.9) — multi-storey structure on Guanqian Rd, provides ELEVATED overwatch
- 228 Peace Memorial Park: south of map area (y < 0), open terrain
- Taipei Main Station area: (3.1, 5.0) — north edge
- Xinguang Mitsukoshi building: (2.8, 3.3) — large commercial structure

### Tactical Notes
- Zhongxiao West Road (y≈4.4) is the widest road — likely axis of advance for armored vehicles
- Side streets are narrow residential — good for concealment and flanking
- The parking tower at (2.1, 2.9) is the only elevated structure suitable for overwatch
- Movement MUST follow roads — robots cannot drive through buildings
- Intersections provide both cover positions and firing corridors along street axes
- N-S roads provide natural engagement corridors for targets moving E-W on Zhongxiao`;

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
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn('[TacticalAI] ANTHROPIC_API_KEY not set — using fallback plan');
    return generateFallbackPlan(threats, friendlyPositions, homeBase);
  }

  const client = new Anthropic({ apiKey });

  const systemPrompt = `You are a military tactical AI assistant embedded in an autonomous robot team leader.
You have been conducting reconnaissance and have detected enemy threats. You must now assess the situation
and recommend positions for your team.

${MAP_CONTEXT}

## Rules
1. ALL positions MUST be at road intersections or along roads — no off-road movement through buildings
2. Overwatch position should have elevation advantage if possible and clear sight lines to threat area
3. Firing positions must provide flanking angles on the enemy — NOT head-on
4. Firing corridors from each position must NOT pass through the overwatch position
5. Followers need adequate spacing (>1.5m in room coords) for mutual defilade
6. Routes must follow roads (turn at intersections, no diagonal shortcuts through blocks)
7. Consider the enemy's likely axis of advance based on road width and direction
8. Withdrawal routes should use different roads than advance routes where possible

## Output Format
Return ONLY valid JSON matching this structure (no markdown, no explanation outside JSON):
{
  "assessment": "string — brief tactical assessment of the situation",
  "overwatch": {
    "position": {"x": number, "y": number},
    "reasoning": "string — why this position"
  },
  "firingPositions": [
    {"position": {"x": number, "y": number}, "reasoning": "string"},
    {"position": {"x": number, "y": number}, "reasoning": "string"}
  ],
  "routes": {
    "leaderToOverwatch": [{"x": number, "y": number}, ...],
    "followerRoutes": [[{"x": number, "y": number}, ...], [...]],
    "withdrawalRoutes": {
      "leader": [{"x": number, "y": number}, ...],
      "followers": [[{"x": number, "y": number}, ...], [...]]
    }
  },
  "engagementRecommendation": "engage" | "observe" | "withdraw",
  "planConfidence": number between 0 and 1
}`;

  const threatDesc = threats.map((t) =>
    `- ${t.classDesc} detected at (${t.detectedAt.x.toFixed(1)}, ${t.detectedAt.y.toFixed(1)}) confidence=${(t.confidence * 100).toFixed(0)}%${t.estimatedHeading != null ? ` heading=${t.estimatedHeading}°` : ''}`,
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
(${homeBase.x.toFixed(1)}, ${homeBase.y.toFixed(1)}) on Hengyang Road

### Mission
Assess the tactical situation. Recommend an overwatch position for the leader and flanking firing positions for ${friendlyPositions.followers.length} followers to engage the detected threats. Plan road-following routes for advance and withdrawal.`;

  try {
    console.log('[TacticalAI] Requesting tactical assessment from Claude...');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0];
    if (text.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const cleaned = text.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    const plan = JSON.parse(cleaned) as TacticalPlan;

    console.log(`[TacticalAI] Plan generated: recommendation=${plan.engagementRecommendation}, confidence=${plan.planConfidence}`);
    console.log(`[TacticalAI] Assessment: ${plan.assessment}`);

    return plan;
  } catch (err) {
    console.error('[TacticalAI] Claude API call failed, using fallback plan:', err);
    return generateFallbackPlan(threats, friendlyPositions, homeBase);
  }
}

// ---------------------------------------------------------------------------
// Fallback plan (when API unavailable)
// ---------------------------------------------------------------------------

function generateFallbackPlan(
  threats: ThreatInfo[],
  _friendlyPositions: {
    leader: { id: string; position: { x: number; y: number } };
    followers: Array<{ id: string; position: { x: number; y: number } }>;
  },
  _homeBase: { x: number; y: number },
): TacticalPlan {
  // Use the same positions as the scripted Iron Bastion but with reasoning
  return {
    assessment: `${threats.length} hostile armored vehicle(s) detected advancing south on Zhongxiao West Road corridor. Recommend flanking engagement from prepared positions on side streets.`,
    overwatch: {
      position: { x: 2.1, y: 2.9 },
      reasoning: 'Changyang Parking Tower on Guanqian Rd — elevated multi-storey structure with clear sight lines north to Zhongxiao West Rd threat axis.',
    },
    firingPositions: [
      {
        position: { x: 1.4, y: 2.0 },
        reasoning: 'Xiangyang Rd / Nanyang St intersection — flanking position on narrow street with firing corridor north toward Chongqing S Rd / Zhongxiao intersection.',
      },
      {
        position: { x: 3.4, y: 3.3 },
        reasoning: 'Chengde Rd / Kaifeng St intersection — flanking position with direct firing corridor north up Chengde Rd to Zhongxiao West Rd.',
      },
    ],
    routes: {
      leaderToOverwatch: [
        { x: 0.3, y: 2.6 },
        { x: 2.5, y: 2.6 },
        { x: 2.1, y: 2.9 },
      ],
      followerRoutes: [
        [
          { x: 0.3, y: 1.7 },
          { x: 1.4, y: 1.7 },
          { x: 1.4, y: 2.0 },
        ],
        [
          { x: 0.3, y: 1.7 },
          { x: 0.3, y: 2.6 },
          { x: 2.5, y: 2.6 },
          { x: 2.5, y: 3.3 },
          { x: 3.4, y: 3.3 },
        ],
      ],
      withdrawalRoutes: {
        leader: [
          { x: 2.5, y: 2.6 },
          { x: 0.3, y: 2.6 },
          { x: 0.3, y: 0.5 },
        ],
        followers: [
          [
            { x: 1.4, y: 1.7 },
            { x: 0.3, y: 1.7 },
            { x: 0.3, y: 0.5 },
          ],
          [
            { x: 2.5, y: 3.3 },
            { x: 2.5, y: 2.6 },
            { x: 0.3, y: 2.6 },
            { x: 0.3, y: 0.5 },
          ],
        ],
      },
    },
    engagementRecommendation: 'engage',
    planConfidence: 0.85,
  };
}
