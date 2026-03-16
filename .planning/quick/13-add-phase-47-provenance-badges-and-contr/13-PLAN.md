---
phase: quick-13
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/brain/BrainDetailPanel.tsx
  - frontend/src/components/brain/BrainVisualization.tsx
autonomous: true
requirements: [QUICK-13]

must_haves:
  truths:
    - "BrainDetailPanel shows confidenceTier, assertedVia, and jsonldType badges for a selected node"
    - "Contradiction edges (isContradiction=true or isConflict=true) render distinctly in the 3D visualization"
    - "Node meshes show confidence-tier stroke styling: solid ring for high, dashed for medium, dotted for low"
  artifacts:
    - path: "frontend/src/components/brain/BrainDetailPanel.tsx"
      provides: "Provenance badge section in SingleNodeView"
      contains: "confidenceTierStyle"
    - path: "frontend/src/components/brain/BrainVisualization.tsx"
      provides: "Contradiction edge pulsing + tier-based node stroke ring"
      contains: "isContradiction"
  key_links:
    - from: "BrainDetailPanel.tsx SingleNodeView"
      to: "node.confidenceTier / node.assertedVia / node.jsonldType"
      via: "inline badge render after ConfidenceMeter"
    - from: "BrainVisualization.tsx linkColor"
      to: "fgLink.isContradiction"
      via: "returns animated red glow color string"
---

<objective>
Surface Phase 47 JSON-LD semantic metadata in the Understanding tab's brain visualization.

Purpose: Phase 47 wired JSON-LD fields into BrainNode but the Understanding tab doesn't render them. The COP and Plan tabs already show these badges; this plan brings the Understanding tab to parity.

Output: Provenance badges in BrainDetailPanel, pulsing red contradiction edges in BrainVisualization, confidence-tier stroke rings on nodes.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md

<!-- Key interfaces — executor uses these directly, no exploration needed -->
<interfaces>
<!-- From frontend/src/components/brain/types.ts — relevant provenance fields on BrainNode -->
```typescript
export interface BrainNode {
  confidence: number;
  confidenceTier?: 'high' | 'medium' | 'low';   // computed tier for visual styling
  assertedVia?: string;                           // source method (manual_entry, doc_intelligence, osint…)
  jsonldType?: string;                            // CCO/BFO class URI e.g. 'cco:MilitaryOrganization'
  isContradicted?: boolean;                       // has :CONTRADICTS edges in graph
  // ... other fields exist
}

export interface BrainEdge {
  isConflict?: boolean;
  isContradiction?: boolean;  // active :CONTRADICTS relationship
  // ... other fields exist
}
```

<!-- From frontend/src/components/plan/EntityResolutionPanel.tsx lines 33-45 — badge helpers to copy -->
```typescript
// confidenceTierStyle — maps tier to badge colors
function confidenceTierStyle(tier: 'high' | 'medium' | 'low'): { background: string; color: string } {
  if (tier === 'high') return { background: '#065f46', color: '#a7f3d0' };
  if (tier === 'medium') return { background: '#78350f', color: '#fcd34d' };
  return { background: '#7f1d1d', color: '#fca5a5' };
}

// formatJsonldType — strips CCO namespace prefix
function formatJsonldType(jsonldType: string): string {
  const localName = jsonldType.includes(':') ? jsonldType.split(':')[1]! : jsonldType;
  return localName.replace(/([A-Z])/g, ' $1').trim();
}

// formatSourceMethod — imported from entity-service, but we inline the display transform:
// 'manual_entry' → 'Manual Entry', 'doc_intelligence' → 'Doc Intelligence', etc.
// Replace underscores with spaces and title-case each word.
```

<!-- From frontend/src/components/brain/BrainVisualization.tsx — existing link color/width callbacks -->
```typescript
// linkColor callback (line ~496) — already handles isConflict:
const linkColor = useCallback((link: object) => {
  const fgLink = link as FGLink;
  if ((fgLink as { isGhostLink?: boolean }).isGhostLink) return 'rgba(100, 160, 255, 0.1)';
  if (fgLink.isConflict) return 'rgba(255, 68, 68, 0.6)';
  const strength = fgLink.strength ?? 0.3;
  const alpha = 0.1 + strength * 0.4;
  return `rgba(100, 160, 255, ${alpha})`;
}, []);

// linkWidth callback (line ~509):
const linkWidth = useCallback((link: object) => {
  const fgLink = link as FGLink;
  if ((fgLink as { isGhostLink?: boolean }).isGhostLink) return 0.3;
  return fgLink.isConflict ? 2 : 0.5 + (fgLink.strength ?? 0.3) * 2;
}, []);

// nodeThreeObject callback (line ~430) — builds node mesh + selection ring + gap wireframe.
// isSelected ring uses: new THREE.Mesh(getRingGeometry(scale), getRingMaterial('#38bdf8', 0.8))
// isGap wireframe uses: new THREE.Mesh(getGeometry(brainNode.type), getWireMaterial('#ffaa00', 0.6))
// Scale is: 0.6 + brainNode.confidence * 0.6 + centralityBoost
// cacheKey drives rebuild: `${color}|${opacity}|${isSelected ? 1 : 0}|${brainNode.isGap ? 1 : 0}|${brainNode.confidence}|${brainNode.centrality ?? 0}`
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add provenance badges to BrainDetailPanel</name>
  <files>frontend/src/components/brain/BrainDetailPanel.tsx</files>
  <action>
Add three helper functions at the top of BrainDetailPanel.tsx, in the Helpers section after `getConfidenceColor`:

```typescript
function confidenceTierStyle(tier: 'high' | 'medium' | 'low'): { background: string; color: string } {
  if (tier === 'high') return { background: '#065f46', color: '#a7f3d0' };
  if (tier === 'medium') return { background: '#78350f', color: '#fcd34d' };
  return { background: '#7f1d1d', color: '#fca5a5' };
}

function formatJsonldType(jsonldType: string): string {
  const localName = jsonldType.includes(':') ? jsonldType.split(':')[1]! : jsonldType;
  return localName.replace(/([A-Z])/g, ' $1').trim();
}

function formatSourceMethod(method: string): string {
  return method.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
```

In `SingleNodeView`, after the `<ConfidenceMeter>` block (inside the "Confidence" section div), add a new provenance badges section that renders when any JSON-LD field is present:

```tsx
{/* Provenance — rendered when Phase 47 JSON-LD fields are present */}
{(node.confidenceTier || node.assertedVia || node.jsonldType || node.isContradicted) && (
  <div className="brain-detail-section">
    <div className="brain-detail-section-title">Provenance</div>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', padding: '0.375rem 0.5rem', backgroundColor: '#0b1120', borderRadius: '0.25rem', border: '1px solid #1e293b' }}>
      {node.confidenceTier && (() => {
        const s = confidenceTierStyle(node.confidenceTier!);
        return (
          <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', backgroundColor: s.background, color: s.color }}>
            {node.confidenceTier}
          </span>
        );
      })()}
      {node.assertedVia && (
        <span style={{ color: '#9ca3af', fontSize: '0.625rem' }}>
          {formatSourceMethod(node.assertedVia)}
        </span>
      )}
      {node.jsonldType && (
        <span style={{ fontSize: '0.625rem', color: '#60a5fa', backgroundColor: '#1e3a5f', padding: '0.125rem 0.375rem', borderRadius: '0.25rem' }}>
          {formatJsonldType(node.jsonldType)}
        </span>
      )}
      {node.isContradicted && (
        <span style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', padding: '0.125rem 0.375rem', borderRadius: '0.25rem', backgroundColor: '#450a0a', color: '#fca5a5', border: '1px solid #991b1b' }}>
          CONTRADICTED
        </span>
      )}
    </div>
  </div>
)}
```

Place this new section after the Confidence section and before the Connections section.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>BrainDetailPanel compiles cleanly and the provenance section renders badges for confidenceTier, assertedVia, jsonldType, and isContradicted when present on the selected node.</done>
</task>

<task type="auto">
  <name>Task 2: Contradiction edge highlighting and confidence-tier node stroke rings</name>
  <files>frontend/src/components/brain/BrainVisualization.tsx</files>
  <action>
**Part A — Contradiction edges:**

In the `linkColor` callback, add `isContradiction` handling alongside `isConflict` (both indicate the same visual intent):

```typescript
if (fgLink.isConflict || fgLink.isContradiction) return 'rgba(255, 68, 68, 0.8)';
```

Replace the existing `if (fgLink.isConflict)` line with the combined check above.

In `linkWidth`, do the same:
```typescript
return (fgLink.isConflict || fgLink.isContradiction) ? 2.5 : 0.5 + (fgLink.strength ?? 0.3) * 2;
```

In `linkThreeObject`, the sprite color line reads:
```typescript
sprite.color = fgLink.isConflict ? 'rgba(255,100,100,0.7)' : 'rgba(180,200,255,0.5)';
```
Update to:
```typescript
sprite.color = (fgLink.isConflict || fgLink.isContradiction) ? 'rgba(255,100,100,0.7)' : 'rgba(180,200,255,0.5)';
```

Also add `linkDirectionalParticles` and `linkDirectionalParticleColor` props to the ForceGraph3D component to create the pulsing effect. Check whether these props are already set on the component; if not, add:
- `linkDirectionalParticles={(link: object) => { const l = link as FGLink; return (l.isConflict || l.isContradiction) ? 4 : 0; }}`
- `linkDirectionalParticleColor={(link: object) => { const l = link as FGLink; return (l.isConflict || l.isContradiction) ? '#ff4444' : '#4a9eff'; }}`
- `linkDirectionalParticleSpeed={0.004}`
- `linkDirectionalParticleWidth={1.5}`

**Part B — Confidence-tier stroke rings on nodes:**

In the `nodeThreeObject` callback, extend the cache key to include `confidenceTier`:

```typescript
const cacheKey = `${color}|${opacity}|${isSelected ? 1 : 0}|${brainNode.isGap ? 1 : 0}|${brainNode.confidence}|${brainNode.centrality ?? 0}|${brainNode.confidenceTier ?? ''}`;
```

After the existing selection ring block (`if (isSelected) { ... }`), add confidence-tier stroke ring rendering:

```typescript
// Confidence-tier stroke ring: high=solid cyan, medium=dashed amber, low=dotted red
if (!isSelected && brainNode.confidenceTier) {
  const tierColors: Record<string, string> = { high: '#34d399', medium: '#fbbf24', low: '#f87171' };
  const tierColor = tierColors[brainNode.confidenceTier] ?? '#888888';
  const tierOpacity = brainNode.confidenceTier === 'high' ? 0.5 : brainNode.confidenceTier === 'medium' ? 0.65 : 0.8;
  const tierRing = new THREE.Mesh(getRingGeometry(scale * 1.1), getRingMaterial(tierColor, tierOpacity));
  group.add(tierRing);
}
```

This keeps the visual hierarchy: selected ring (cyan) overrides tier ring to avoid double rings.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr/frontend && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>BrainVisualization compiles cleanly. Contradiction edges (`isContradiction=true` or `isConflict=true`) render in red with directional particles. Nodes show a colored ring matching their confidenceTier (green=high, amber=medium, red=low) when not selected.</done>
</task>

</tasks>

<verification>
After both tasks:
1. `cd frontend && npx tsc --noEmit` produces no errors
2. Open the Understanding tab, select a brain node with JSON-LD metadata — Provenance section appears with tier badge, source method, and ontology type labels
3. Any edge with `isContradiction: true` renders as red with particles in the 3D graph
4. Nodes show colored stroke rings matching their confidence tier
</verification>

<success_criteria>
- BrainDetailPanel shows provenance badges (confidenceTier, assertedVia, jsonldType, isContradicted) matching the COP/Plan tab badge pattern
- Contradiction edges in BrainVisualization render distinctly in red with directional particle flow
- Confidence-tier ring colors applied on nodes (solid green/amber/red ring by tier) without conflicting with the selection ring
- TypeScript compiles without errors
</success_criteria>

<output>
After completion, create `.planning/quick/13-add-phase-47-provenance-badges-and-contr/13-SUMMARY.md`
</output>
