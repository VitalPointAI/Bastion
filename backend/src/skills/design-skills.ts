/**
 * Design Skills
 *
 * LangChain tools for operational design visualization and analysis:
 * - overlay_producer: SVG map overlays for operational approach phases and LOEs
 * - resource_allocator: Force availability query against operational phases
 * - campaign_visualizer: One-page campaign placemat for senior leader briefs
 * - risk_visualizer: Risk matrix, timeline, and heatmap visualizations
 *
 * These skills are invoked by Ironclaw during the Operational Design phase to
 * produce briefing-ready visuals and resource feasibility assessments.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const phaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  order: z.number(),
});

const decisionPointSchema = z.object({
  id: z.string(),
  label: z.string(),
  phaseId: z.string().optional(),
  criteria: z.array(z.string()).optional(),
});

const operationalApproachSchema = z.object({
  phases: z.array(phaseSchema).default([]),
  transitions: z.array(z.object({
    fromPhaseId: z.string(),
    toPhaseId: z.string(),
    conditions: z.array(z.string()).optional(),
  })).optional().default([]),
  decisionPoints: z.array(decisionPointSchema).optional().default([]),
  narrative: z.string().optional().default(''),
  risks: z.array(z.object({
    id: z.string().optional(),
    label: z.string(),
    description: z.string().optional(),
    phaseId: z.string().optional(),
    loeId: z.string().optional(),
    probability: z.number().min(1).max(5).optional(),
    impact: z.number().min(1).max(5).optional(),
    mitigation: z.string().optional(),
    residualLevel: z.string().optional(),
  })).optional().default([]),
});

const loeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  order: z.number().optional(),
  decisivePoints: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    phase: z.string().optional(),
    position: z.number().optional(),
  })).optional().default([]),
});

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

const PHASE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];
const RISK_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#f97316',
  extreme: '#dc2626',
};

function getRiskLevel(probability: number, impact: number): string {
  const score = probability * impact;
  if (score <= 4) return 'low';
  if (score <= 9) return 'medium';
  if (score <= 19) return 'high';
  return 'extreme';
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ---------------------------------------------------------------------------
// overlay_producer
// ---------------------------------------------------------------------------

function buildOverlaySVG(
  phases: Array<{ id: string; name: string; description: string; order: number }>,
  loes: Array<z.infer<typeof loeSchema>>,
  decisionPoints: Array<z.infer<typeof decisionPointSchema>>,
): string {
  const W = 800;
  const H = 600;
  const PAD = 40;
  const phaseCount = phases.length || 1;
  const phaseW = (W - PAD * 2) / phaseCount;
  const loeCount = loes.length || 1;
  const loeH = (H - PAD * 2 - 80) / loeCount;

  const phaseBands = phases.map((ph, i) => {
    const x = PAD + i * phaseW;
    const color = PHASE_COLORS[i % PHASE_COLORS.length];
    return `<rect x="${x}" y="${PAD}" width="${phaseW}" height="${H - PAD * 2}" fill="${color}" fill-opacity="0.12" stroke="${color}" stroke-width="1" stroke-dasharray="6,3"/>
<text x="${x + phaseW / 2}" y="${PAD + 18}" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">${xmlEscape(ph.name)}</text>`;
  }).join('\n');

  const loeArrows = loes.map((loe, i) => {
    const y = PAD + 40 + i * loeH + loeH / 2;
    const color = PHASE_COLORS[(i + 2) % PHASE_COLORS.length];
    const dpCount = loe.decisivePoints?.length ?? 0;
    const markers = (loe.decisivePoints ?? []).map((dp, di) => {
      const dpX = PAD + ((di + 1) / (dpCount + 1)) * (W - PAD * 2);
      return `<polygon points="${dpX},${y - 8} ${dpX + 7},${y} ${dpX},${y + 8} ${dpX - 7},${y}" fill="${color}" stroke="white" stroke-width="1"/>
<text x="${dpX}" y="${y + 22}" text-anchor="middle" font-size="9" fill="${color}">${xmlEscape(dp.label.substring(0, 18))}</text>`;
    }).join('\n');

    return `<!-- LOE: ${xmlEscape(loe.name)} -->
<line x1="${PAD}" y1="${y}" x2="${W - PAD - 10}" y2="${y}" stroke="${color}" stroke-width="3"/>
<polygon points="${W - PAD},${y} ${W - PAD - 10},${y - 5} ${W - PAD - 10},${y + 5}" fill="${color}"/>
<text x="${PAD + 5}" y="${y - 10}" font-size="11" font-weight="bold" fill="${color}">${xmlEscape(loe.name)}</text>
${markers}`;
  }).join('\n');

  const dpAnnotations = decisionPoints.map((dp, i) => {
    const phaseIdx = phases.findIndex((ph) => ph.id === dp.phaseId);
    const x = phaseIdx >= 0 ? PAD + phaseIdx * phaseW + phaseW * 0.75 : PAD + i * 80 + 60;
    return `<text x="${x}" y="${H - PAD - 5}" font-size="9" fill="#6b21a8" text-anchor="middle">▼ ${xmlEscape(dp.label.substring(0, 15))}</text>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="none"/>
  <!-- Phase Bands -->
  ${phaseBands}
  <!-- LOE Arrows -->
  ${loeArrows}
  <!-- Decision Point Annotations -->
  ${dpAnnotations}
  <!-- Title -->
  <text x="${W / 2}" y="16" text-anchor="middle" font-size="13" font-weight="bold" fill="#1e293b">Operational Approach Overlay</text>
</svg>`;
}

// ---------------------------------------------------------------------------
// campaign_visualizer
// ---------------------------------------------------------------------------

function buildCampaignSVG(design: Record<string, unknown>): string {
  const W = 1200;
  const H = 850;

  const pf = (design.problemFraming ?? {}) as Record<string, unknown>;
  const cogAnalysis = (design.cogAnalysis ?? { adversary: {}, friendly: {} }) as Record<string, unknown>;
  const loes = (design.linesOfEffort ?? []) as Array<Record<string, unknown>>;
  const oa = (design.operationalApproach ?? { phases: [], decisionPoints: [] }) as Record<string, unknown>;
  const phases = (oa.phases ?? []) as Array<{ id: string; name: string; description: string; order: number }>;

  const adversaryRoot = ((cogAnalysis.adversary as Record<string, unknown>)?.root ?? null) as Record<string, unknown> | null;
  const friendlyRoot = ((cogAnalysis.friendly as Record<string, unknown>)?.root ?? null) as Record<string, unknown> | null;

  // CoG Tree (top-left, 360x220)
  const adversaryLabel = adversaryRoot ? xmlEscape(String(adversaryRoot.label ?? 'Adversary CoG').substring(0, 30)) : 'Adversary CoG';
  const cogSection = `<rect x="10" y="30" width="360" height="220" fill="#fef2f2" rx="4"/>
<text x="190" y="52" text-anchor="middle" font-size="12" font-weight="bold" fill="#991b1b">Adversary CoG Analysis</text>
<rect x="130" y="62" width="120" height="32" fill="#dc2626" rx="3"/>
<text x="190" y="83" text-anchor="middle" font-size="11" fill="white" font-weight="bold">${adversaryLabel.substring(0, 20)}</text>`;

  // Problem framing (top-right, 400x220)
  const problemStatement = xmlEscape(String(pf.problemStatement ?? '').substring(0, 120));
  const endState = xmlEscape(String(pf.desiredEndState ?? '').substring(0, 80));
  const pfSection = `<rect x="780" y="30" width="410" height="220" fill="#f0f9ff" rx="4"/>
<text x="985" y="52" text-anchor="middle" font-size="12" font-weight="bold" fill="#0c4a6e">Problem Framing</text>
<text x="800" y="72" font-size="10" fill="#0c4a6e" font-weight="bold">Problem Statement:</text>
<foreignObject x="800" y="80" width="370" height="80">
  <div xmlns="http://www.w3.org/1999/xhtml" style="font-size:10px;color:#1e293b;word-wrap:break-word">${problemStatement}</div>
</foreignObject>
<text x="800" y="172" font-size="10" fill="#0c4a6e" font-weight="bold">Desired End State:</text>
<text x="800" y="186" font-size="10" fill="#1e293b">${endState.substring(0, 80)}</text>`;

  // LOE swimlanes (center, full width, 300px height)
  const loeCount = loes.length || 1;
  const loeH = 260 / loeCount;
  const loeSection = loes.map((loe, i) => {
    const y = 270 + i * loeH;
    const color = PHASE_COLORS[i % PHASE_COLORS.length];
    const loeName = xmlEscape(String(loe.name ?? `LOE ${i + 1}`).substring(0, 30));
    return `<rect x="10" y="${y}" width="1180" height="${loeH - 4}" fill="${color}" fill-opacity="0.08" rx="2"/>
<line x1="10" y1="${y + loeH / 2}" x2="1180" y2="${y + loeH / 2}" stroke="${color}" stroke-width="2"/>
<text x="16" y="${y + loeH / 2 + 4}" font-size="11" fill="${color}" font-weight="bold">${loeName}</text>`;
  }).join('\n');

  // Phase timeline (bottom, full width)
  const phaseCount = phases.length || 1;
  const phaseW = 1180 / phaseCount;
  const phaseSection = phases.map((ph, i) => {
    const x = 10 + i * phaseW;
    const color = PHASE_COLORS[i % PHASE_COLORS.length];
    const phName = xmlEscape(ph.name.substring(0, 20));
    return `<rect x="${x + 2}" y="540" width="${phaseW - 4}" height="60" fill="${color}" fill-opacity="0.15" rx="3" stroke="${color}" stroke-width="1"/>
<text x="${x + phaseW / 2}" y="574" text-anchor="middle" font-size="11" fill="${color}" font-weight="bold">${phName}</text>`;
  }).join('\n');

  // Friendly CoG sidebar
  const friendlyLabel = friendlyRoot ? xmlEscape(String(friendlyRoot.label ?? 'Friendly CoG').substring(0, 25)) : 'Friendly CoG';
  const friendlySection = `<rect x="10" y="615" width="360" height="220" fill="#f0fdf4" rx="4"/>
<text x="190" y="637" text-anchor="middle" font-size="12" font-weight="bold" fill="#166534">Friendly CoG</text>
<rect x="130" y="647" width="120" height="32" fill="#16a34a" rx="3"/>
<text x="190" y="668" text-anchor="middle" font-size="11" fill="white" font-weight="bold">${friendlyLabel.substring(0, 20)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <!-- Title Bar -->
  <rect width="${W}" height="28" fill="#1e293b"/>
  <text x="${W / 2}" y="19" text-anchor="middle" font-size="14" font-weight="bold" fill="white">CAMPAIGN OVERVIEW — OPERATIONAL DESIGN PLACEMAT</text>
  <!-- CoG Analysis -->
  ${cogSection}
  <!-- Problem Framing -->
  ${pfSection}
  <!-- LOE Swimlanes Label -->
  <text x="${W / 2}" y="264" text-anchor="middle" font-size="12" font-weight="bold" fill="#475569">Lines of Effort</text>
  <!-- LOE Swimlanes -->
  ${loeSection}
  <!-- Phase Timeline Label -->
  <text x="${W / 2}" y="534" text-anchor="middle" font-size="12" font-weight="bold" fill="#475569">Phase Timeline</text>
  <!-- Phase Timeline -->
  ${phaseSection}
  <!-- Friendly CoG -->
  ${friendlySection}
  <!-- UNCLASSIFIED Banner -->
  <rect x="0" y="${H - 20}" width="${W}" height="20" fill="#16a34a"/>
  <text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="white" font-weight="bold">UNCLASSIFIED // FOR EXERCISE USE ONLY</text>
</svg>`;
}

function buildCampaignMarkdownSpec(design: Record<string, unknown>): string {
  const pf = (design.problemFraming ?? {}) as Record<string, unknown>;
  const loes = (design.linesOfEffort ?? []) as Array<Record<string, unknown>>;
  const oa = (design.operationalApproach ?? { phases: [], narrative: '' }) as Record<string, unknown>;
  const phases = (oa.phases ?? []) as Array<{ id: string; name: string }>;

  const loeNames = loes.map((l) => String(l.name ?? 'LOE')).join(', ');
  const phaseNames = phases.map((p) => String(p.name ?? 'Phase')).join(' → ');

  return `# Campaign Placemat Specification

## Canvas
- Dimensions: 1200x850px
- Background: White (#ffffff)
- Font: Arial or Helvetica
- Title bar: Dark navy (#1e293b), white text, full width, 28px height

## Region A — Adversary CoG Tree (top-left, x:10 y:30, 360x220)
- Background: Light red (#fef2f2)
- Title: "Adversary CoG Analysis" in bold dark red
- CoG node: Red rectangle with white text showing adversary center of gravity
- Below CoG: Critical Capabilities → Critical Requirements → Critical Vulnerabilities as indented tree
- Draw lines connecting CoG to its children, children to grandchildren

## Region B — Problem Framing (top-right, x:780 y:30, 410x220)
- Background: Light blue (#f0f9ff)
- Title: "Problem Framing" in bold dark blue
- Problem Statement: "${String(pf.problemStatement ?? '').substring(0, 100)}..."
- Desired End State: "${String(pf.desiredEndState ?? '').substring(0, 80)}..."
- Use 10pt text, dark slate color

## Region C — Lines of Effort (center, full width, y:270, height:260)
- Background: Alternating light shading per LOE row
- LOEs: ${loeNames}
- Each LOE as a horizontal swimlane with bold colored label on left
- Decisive points as diamond markers along each lane at approximate phase positions
- LOE colors: blue, green, amber, red, purple, cyan

## Region D — Phase Timeline (bottom, full width, y:540, height:60)
- Phases: ${phaseNames}
- Each phase as colored rectangle, evenly spaced
- Phase name in bold colored text, centered in each box
- Transitions as vertical dashed lines between boxes

## Region E — Friendly CoG (bottom-left, x:10 y:615, 360x220)
- Background: Light green (#f0fdf4)
- Title: "Friendly CoG" in bold dark green
- CoG node: Green rectangle with white text

## Color Palette
- Phase 1: #2563eb (blue)
- Phase 2: #16a34a (green)
- Phase 3: #d97706 (amber)
- Phase 4: #dc2626 (red)
- Phase 5: #7c3aed (purple)
- Adversary elements: reds/crimsons
- Friendly elements: greens/teals

## Footer
- "UNCLASSIFIED // FOR EXERCISE USE ONLY" banner, green background, white text
`;
}

// ---------------------------------------------------------------------------
// risk_visualizer
// ---------------------------------------------------------------------------

interface RiskItem {
  id?: string;
  label: string;
  description?: string;
  phaseId?: string;
  loeId?: string;
  probability?: number;
  impact?: number;
  mitigation?: string;
  residualLevel?: string;
}

function buildRiskMatrixSVG(risks: RiskItem[]): string {
  const W = 600;
  const H = 600;
  const CELL = 80;
  const OFFSET_X = 120;
  const OFFSET_Y = 80;

  const cells: string[] = [];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      const prob = row + 1;
      const impact = col + 1;
      const score = prob * impact;
      let fill = '#dcfce7';
      if (score > 4 && score <= 9) fill = '#fef9c3';
      if (score > 9 && score <= 19) fill = '#ffedd5';
      if (score > 19) fill = '#fee2e2';
      cells.push(`<rect x="${OFFSET_X + col * CELL}" y="${OFFSET_Y + (4 - row) * CELL}" width="${CELL}" height="${CELL}" fill="${fill}" stroke="#94a3b8" stroke-width="0.5"/>`);
    }
  }

  // Axis labels
  const colLabels = [1, 2, 3, 4, 5].map((v, i) =>
    `<text x="${OFFSET_X + i * CELL + CELL / 2}" y="${OFFSET_Y + 5 * CELL + 18}" text-anchor="middle" font-size="10" fill="#475569">${v}</text>`).join('\n');
  const rowLabels = [1, 2, 3, 4, 5].map((v, i) =>
    `<text x="${OFFSET_X - 8}" y="${OFFSET_Y + (4 - i) * CELL + CELL / 2 + 4}" text-anchor="end" font-size="10" fill="#475569">${v}</text>`).join('\n');

  // Risk dots
  const dots = risks.map((risk, idx) => {
    const prob = risk.probability ?? 3;
    const impact = risk.impact ?? 3;
    const col = impact - 1;
    const row = prob - 1;
    const cx = OFFSET_X + col * CELL + CELL / 2;
    const cy = OFFSET_Y + (4 - row) * CELL + CELL / 2;
    const level = getRiskLevel(prob, impact);
    const dotColor = RISK_COLORS[level as keyof typeof RISK_COLORS];
    const label = risk.label.substring(0, 12);
    const jitterX = (idx % 3 - 1) * 10;
    const jitterY = (Math.floor(idx / 3) % 3 - 1) * 10;
    return `<circle cx="${cx + jitterX}" cy="${cy + jitterY}" r="12" fill="${dotColor}" opacity="0.85"/>
<text x="${cx + jitterX}" y="${cy + jitterY + 4}" text-anchor="middle" font-size="8" fill="white">${xmlEscape(label)}</text>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#1e293b">Risk Matrix — Probability vs. Impact</text>
  <!-- Grid -->
  ${cells.join('\n  ')}
  <!-- Axis Labels -->
  ${colLabels}
  ${rowLabels}
  <text x="${OFFSET_X + 5 * CELL / 2}" y="${OFFSET_Y + 5 * CELL + 34}" text-anchor="middle" font-size="11" fill="#475569">Impact →</text>
  <text x="20" y="${OFFSET_Y + 2.5 * CELL}" text-anchor="middle" font-size="11" fill="#475569" transform="rotate(-90 20 ${OFFSET_Y + 2.5 * CELL})">Probability →</text>
  <!-- Risk Dots -->
  ${dots}
  <!-- Legend -->
  <rect x="430" y="40" width="14" height="14" fill="#22c55e" rx="2"/>
  <text x="450" y="52" font-size="10" fill="#475569">Low (1-4)</text>
  <rect x="430" y="60" width="14" height="14" fill="#f59e0b" rx="2"/>
  <text x="450" y="72" font-size="10" fill="#475569">Medium (5-9)</text>
  <rect x="430" y="80" width="14" height="14" fill="#f97316" rx="2"/>
  <text x="450" y="92" font-size="10" fill="#475569">High (10-19)</text>
  <rect x="430" y="100" width="14" height="14" fill="#dc2626" rx="2"/>
  <text x="450" y="112" font-size="10" fill="#475569">Extreme (20-25)</text>
</svg>`;
}

function buildRiskTimelineSVG(
  risks: RiskItem[],
  phases: Array<{ id: string; name: string; order: number }>,
): string {
  const W = 900;
  const H = 400;
  const PAD_X = 60;
  const PAD_Y = 60;
  const phaseCount = phases.length || 1;
  const phaseW = (W - PAD_X * 2) / phaseCount;

  const phaseBars = phases.map((ph, i) => {
    const x = PAD_X + i * phaseW;
    const color = PHASE_COLORS[i % PHASE_COLORS.length];
    return `<rect x="${x + 1}" y="${H - 55}" width="${phaseW - 2}" height="30" fill="${color}" fill-opacity="0.2" rx="2" stroke="${color}" stroke-width="1"/>
<text x="${x + phaseW / 2}" y="${H - 34}" text-anchor="middle" font-size="10" fill="${color}" font-weight="bold">${xmlEscape(ph.name.substring(0, 16))}</text>`;
  }).join('\n');

  const riskDots = risks.map((risk, idx) => {
    const phaseIdx = phases.findIndex((ph) => ph.id === risk.phaseId);
    const x = phaseIdx >= 0
      ? PAD_X + phaseIdx * phaseW + phaseW / 2
      : PAD_X + (idx / (risks.length || 1)) * (W - PAD_X * 2);
    const prob = risk.probability ?? 3;
    const impact = risk.impact ?? 3;
    const level = getRiskLevel(prob, impact);
    const dotColor = RISK_COLORS[level as keyof typeof RISK_COLORS];
    const y = PAD_Y + 20 + (idx % 4) * 55;
    const label = xmlEscape(risk.label.substring(0, 20));
    return `<circle cx="${x}" cy="${y}" r="14" fill="${dotColor}" opacity="0.85"/>
<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="8" fill="white">${label.substring(0, 10)}</text>
<line x1="${x}" y1="${y + 14}" x2="${x}" y2="${H - 55}" stroke="${dotColor}" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>`;
  }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#1e293b">Risk Timeline — Risks by Phase</text>
  <!-- Phase Bars -->
  ${phaseBars}
  <!-- Risk Dots -->
  ${riskDots}
  <!-- Baseline -->
  <line x1="${PAD_X}" y1="${H - 55}" x2="${W - PAD_X}" y2="${H - 55}" stroke="#94a3b8" stroke-width="1"/>
</svg>`;
}

function buildRiskHeatmapSVG(
  risks: RiskItem[],
  phases: Array<{ id: string; name: string; order: number }>,
  loes: string[],
): string {
  const W = 900;
  const H = 400;
  const loeCount = Math.max(loes.length, 1);
  const phaseCount = Math.max(phases.length, 1);
  const CELL_W = Math.min(140, (W - 180) / phaseCount);
  const CELL_H = Math.min(70, (H - 100) / loeCount);
  const OFFSET_X = 180;
  const OFFSET_Y = 60;

  // Count risks per loe+phase cell
  const grid: Record<string, number> = {};
  for (const risk of risks) {
    const phaseKey = risk.phaseId ?? '';
    const loeKey = risk.loeId ?? '';
    const key = `${loeKey}::${phaseKey}`;
    grid[key] = (grid[key] ?? 0) + 1;
  }

  const maxCount = Math.max(...Object.values(grid), 1);

  const cells = loes.flatMap((loe, li) =>
    phases.map((ph, pi) => {
      const count = grid[`${loe}::${ph.id}`] ?? 0;
      const intensity = count / maxCount;
      const r = Math.round(220 + intensity * 35);
      const g = Math.round(220 - intensity * 180);
      const b = Math.round(220 - intensity * 180);
      const fill = `rgb(${r},${g},${b})`;
      const x = OFFSET_X + pi * CELL_W;
      const y = OFFSET_Y + li * CELL_H;
      const countLabel = count > 0 ? `<text x="${x + CELL_W / 2}" y="${y + CELL_H / 2 + 4}" text-anchor="middle" font-size="13" font-weight="bold" fill="${count > 2 ? 'white' : '#475569'}">${count}</text>` : '';
      return `<rect x="${x}" y="${y}" width="${CELL_W}" height="${CELL_H}" fill="${fill}" stroke="#94a3b8" stroke-width="0.5"/>
${countLabel}`;
    })
  ).join('\n');

  const loeLabels = loes.map((loe, li) =>
    `<text x="${OFFSET_X - 8}" y="${OFFSET_Y + li * CELL_H + CELL_H / 2 + 4}" text-anchor="end" font-size="10" fill="#475569">${xmlEscape(loe.substring(0, 20))}</text>`
  ).join('\n');

  const phaseLabels = phases.map((ph, pi) =>
    `<text x="${OFFSET_X + pi * CELL_W + CELL_W / 2}" y="${OFFSET_Y - 8}" text-anchor="middle" font-size="10" fill="#475569">${xmlEscape(ph.name.substring(0, 12))}</text>`
  ).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  <text x="${W / 2}" y="22" text-anchor="middle" font-size="14" font-weight="bold" fill="#1e293b">Risk Heatmap — LOE × Phase Concentration</text>
  <!-- Grid Cells -->
  ${cells}
  <!-- LOE Labels -->
  ${loeLabels}
  <!-- Phase Labels -->
  ${phaseLabels}
</svg>`;
}

// ---------------------------------------------------------------------------
// createDesignTools — exported factory
// ---------------------------------------------------------------------------

export function createDesignTools(): DynamicStructuredTool[] {

  // ── overlay_producer ───────────────────────────────────────────────────────
  const overlayProducerTool = new DynamicStructuredTool({
    name: 'overlay_producer',
    description: 'Generate SVG map overlays for an operational approach — phases as colored regions, LOEs as directional arrows, decisive points as markers, boundaries as dashed lines. Returns SVG for Leaflet rendering and named layers for individual toggling.',
    schema: z.object({
      problem_set_id: z.string().describe('Problem set ID this overlay belongs to'),
      operational_approach: operationalApproachSchema.describe('OperationalApproach data — phases, transitions, decisionPoints'),
      loes: z.array(loeSchema).optional().default([]).describe('Lines of Effort with decisive points'),
      ao_bounds: z.object({
        southwest: z.object({ lat: z.number(), lng: z.number() }).optional(),
        northeast: z.object({ lat: z.number(), lng: z.number() }).optional(),
      }).optional().describe('Optional AO bounding box for geographic scaling'),
    }),
    func: async ({ operational_approach, loes }) => {
      const phases = operational_approach.phases;
      const decisionPoints = operational_approach.decisionPoints ?? [];
      const loesArr = loes ?? [];

      const mainSVG = buildOverlaySVG(phases, loesArr, decisionPoints);

      // Build per-layer SVGs
      const layers = [
        { name: 'Phases', svg: buildOverlaySVG(phases, [], []) },
        ...loesArr.map((loe) => ({
          name: loe.name,
          svg: buildOverlaySVG(phases, [loe], []),
        })),
        ...(decisionPoints.length > 0
          ? [{ name: 'Decision Points', svg: buildOverlaySVG(phases, [], decisionPoints) }]
          : []),
      ];

      return JSON.stringify({ svg: mainSVG, layers });
    },
  });

  // ── resource_allocator ─────────────────────────────────────────────────────
  const resourceAllocatorTool = new DynamicStructuredTool({
    name: 'resource_allocator',
    description: 'Query the Resource Registry for available forces, map them to operational phases, and surface allocation shortfalls. Returns per-phase breakdown and plain-language summary.',
    schema: z.object({
      problem_set_id: z.string().describe('Problem set ID to scope resource queries'),
      operational_approach: operationalApproachSchema.describe('OperationalApproach data — must include phases array'),
      resource_types: z.array(z.string()).optional().default([]).describe('Optional category filter (e.g., [vehicles, sensors])'),
    }),
    func: async ({ operational_approach, resource_types }) => {
      const phases = operational_approach.phases;

      // Query Resource Registry
      const { getResourceRegistry } = await import('../resources/resource-registry.js');
      const registry = getResourceRegistry();
      await registry.ensureInitialized();
      const allResources = registry.getAllResources();

      // Filter by resource_types if provided
      const filtered = resource_types && resource_types.length > 0
        ? allResources.filter((r) => resource_types.includes(r.category))
        : allResources;

      // Group resources by category for phase mapping
      const byCategory: Record<string, typeof filtered> = {};
      for (const res of filtered) {
        if (!byCategory[res.category]) byCategory[res.category] = [];
        byCategory[res.category].push(res);
      }

      // Build per-phase allocation
      const phaseResults = phases.map((ph) => {
        const available_forces: Array<{ category: string; count: number; fmc: number; names: string[] }> = [];
        const shortfalls: string[] = [];

        for (const [cat, resources] of Object.entries(byCategory)) {
          const fmcCount = resources.filter((r) => r.status === 'FMC').length;
          const total = resources.length;
          available_forces.push({
            category: cat,
            count: total,
            fmc: fmcCount,
            names: resources.slice(0, 3).map((r) => r.name),
          });
        }

        // Heuristic required force estimate based on phase order (later phases need more)
        const phaseMultiplier = 1 + ph.order * 0.15;
        const required_forces = Math.ceil(filtered.length * phaseMultiplier * 0.6);
        const actual_fmc = filtered.filter((r) => r.status === 'FMC').length;

        if (actual_fmc < required_forces) {
          shortfalls.push(
            `Estimated ${required_forces} FMC resources required for Phase ${ph.order} (${ph.name}), only ${actual_fmc} available FMC — shortfall of ${required_forces - actual_fmc}`,
          );
        }

        // Check for NMC resources that would degrade capability
        const nmcResources = filtered.filter((r) => r.status === 'NMC');
        if (nmcResources.length > 0) {
          shortfalls.push(
            `${nmcResources.length} resource(s) NMC and unavailable: ${nmcResources.slice(0, 3).map((r) => r.name).join(', ')}`,
          );
        }

        return {
          phase_name: ph.name,
          phase_order: ph.order,
          available_forces,
          required_forces,
          actual_fmc,
          shortfalls,
        };
      });

      // Summary
      const totalResources = filtered.length;
      const fmcTotal = filtered.filter((r) => r.status === 'FMC').length;
      const nmcTotal = filtered.filter((r) => r.status === 'NMC').length;
      const pmcTotal = filtered.filter((r) => r.status === 'PMC').length;
      const totalShortfalls = phaseResults.reduce((n, ph) => n + ph.shortfalls.length, 0);

      const summary = totalResources === 0
        ? 'No resources are currently registered in the Resource Registry. Force allocation cannot be assessed until resources are onboarded.'
        : `Force posture: ${totalResources} total resources — ${fmcTotal} FMC (${Math.round(fmcTotal / totalResources * 100)}%), ${pmcTotal} PMC, ${nmcTotal} NMC. ` +
          `The operational approach has ${phases.length} phases. ` +
          (totalShortfalls > 0
            ? `${totalShortfalls} shortfall(s) identified across phases — review phase allocations and consider requesting additional resources or adjusting the approach.`
            : 'No critical shortfalls identified — the operation appears resourced for the current approach.');

      return JSON.stringify({ phases: phaseResults, summary });
    },
  });

  // ── campaign_visualizer ────────────────────────────────────────────────────
  const campaignVisualizerTool = new DynamicStructuredTool({
    name: 'campaign_visualizer',
    description: 'Generate a one-page campaign placemat for briefing. Shows CoG trees, Lines of Effort, objectives, problem framing, phase timeline, and decision points. Returns SVG and/or a markdown layout specification for image-AI generation.',
    schema: z.object({
      problem_set_id: z.string().describe('Problem set ID this placemat belongs to'),
      design: z.record(z.string(), z.unknown()).describe('Complete OperationalDesign object'),
      output_format: z.enum(['svg', 'markdown_spec', 'both']).optional().default('both').describe('Output format'),
    }),
    func: async ({ design, output_format }) => {
      const fmt = output_format ?? 'both';
      const result: { svg?: string; markdown_spec?: string } = {};

      if (fmt === 'svg' || fmt === 'both') {
        result.svg = buildCampaignSVG(design);
      }
      if (fmt === 'markdown_spec' || fmt === 'both') {
        result.markdown_spec = buildCampaignMarkdownSpec(design);
      }

      return JSON.stringify(result);
    },
  });

  // ── risk_visualizer ────────────────────────────────────────────────────────
  const riskVisualizerTool = new DynamicStructuredTool({
    name: 'risk_visualizer',
    description: 'Visualize operational risks as a 5x5 risk matrix, phase timeline, or LOE-phase heatmap. Returns SVG and a structured risks summary for risk annexes.',
    schema: z.object({
      problem_set_id: z.string().describe('Problem set ID this risk visualization belongs to'),
      operational_approach: operationalApproachSchema.describe('OperationalApproach data — phases, and optional risks array'),
      display_format: z.enum(['matrix', 'timeline', 'heatmap']).optional().default('matrix').describe('Visualization type'),
    }),
    func: async ({ operational_approach, display_format }) => {
      const fmt = display_format ?? 'matrix';
      const phases = operational_approach.phases;

      // Extract or infer risks
      let risks: RiskItem[] = operational_approach.risks ?? [];

      // Infer risks from transitions and decision point criteria if none provided
      if (risks.length === 0) {
        for (const dp of (operational_approach.decisionPoints ?? [])) {
          risks.push({
            label: `Decision Risk: ${dp.label}`,
            description: `Risk associated with decision point: ${dp.label}`,
            phaseId: dp.phaseId,
            probability: 3,
            impact: 3,
            mitigation: `Establish clear criteria for ${dp.label}`,
            residualLevel: 'medium',
          });
        }
        // Transition risks
        for (const t of (operational_approach.transitions ?? [])) {
          const fromPhase = phases.find((p) => p.id === t.fromPhaseId);
          if (fromPhase) {
            risks.push({
              label: `Transition: ${fromPhase.name}`,
              description: 'Risk at phase transition — conditions may not be met',
              phaseId: t.fromPhaseId,
              probability: 2,
              impact: 4,
              mitigation: 'Define and verify transition criteria before proceeding',
              residualLevel: 'medium',
            });
          }
        }
      }

      // Build risks summary
      const risks_summary = risks.map((r) => {
        const prob = r.probability ?? 3;
        const impact = r.impact ?? 3;
        const level = getRiskLevel(prob, impact);
        return {
          risk: r.label,
          description: r.description ?? '',
          phase: phases.find((p) => p.id === r.phaseId)?.name ?? r.phaseId ?? 'Unassigned',
          loe: r.loeId ?? 'N/A',
          mitigation: r.mitigation ?? 'No mitigation defined',
          probability: prob,
          impact: impact,
          risk_score: prob * impact,
          risk_level: level,
          residual_level: r.residualLevel ?? (level === 'extreme' ? 'high' : level === 'high' ? 'medium' : 'low'),
        };
      });

      // Build SVG
      let svg: string;
      const loeIds = [...new Set(risks.map((r) => r.loeId ?? 'General').filter(Boolean))];

      if (fmt === 'matrix') {
        svg = buildRiskMatrixSVG(risks);
      } else if (fmt === 'timeline') {
        svg = buildRiskTimelineSVG(risks, phases);
      } else {
        svg = buildRiskHeatmapSVG(risks, phases, loeIds.length > 0 ? loeIds : ['General']);
      }

      return JSON.stringify({ svg, risks_summary });
    },
  });

  return [overlayProducerTool, resourceAllocatorTool, campaignVisualizerTool, riskVisualizerTool];
}
