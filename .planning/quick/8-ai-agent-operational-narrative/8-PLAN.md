---
phase: quick-8
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/agents/narrative-synthesis.ts
  - backend/src/api/design.ts
  - frontend/src/components/design/OperationalApproachSection.tsx
  - frontend/src/components/design/DesignAIPanel.tsx
autonomous: true
requirements: [QUICK-8]

must_haves:
  truths:
    - "User can click Analyze in the AI panel on the Operational Approach section"
    - "AI generates a draft operational narrative synthesizing all design data"
    - "User can apply the generated narrative into the narrative textarea"
    - "Generated narrative references problem framing, CoG analysis, LOEs, phases, and decision points"
  artifacts:
    - path: "backend/src/agents/narrative-synthesis.ts"
      provides: "Narrative synthesis agent function"
      exports: ["synthesizeNarrative", "NarrativeSynthesisOutput"]
    - path: "backend/src/api/design.ts"
      provides: "operational-approach case in analyze endpoint"
      contains: "synthesizeNarrative"
    - path: "frontend/src/components/design/OperationalApproachSection.tsx"
      provides: "AI panel integration in Operational Approach section"
      contains: "DesignAIPanel"
    - path: "frontend/src/components/design/DesignAIPanel.tsx"
      provides: "operational-approach results rendering"
      contains: "operational-approach"
  key_links:
    - from: "frontend/src/components/design/OperationalApproachSection.tsx"
      to: "frontend/src/components/design/DesignAIPanel.tsx"
      via: "DesignAIPanel component with activeSection='operational-approach'"
      pattern: "activeSection.*operational-approach"
    - from: "frontend/src/components/design/DesignAIPanel.tsx"
      to: "/api/design/:id/analyze"
      via: "designService.analyzeSection"
      pattern: "analyzeSection.*operational-approach"
    - from: "backend/src/api/design.ts"
      to: "backend/src/agents/narrative-synthesis.ts"
      via: "dynamic import in analyze endpoint"
      pattern: "import.*narrative-synthesis"
---

<objective>
Add AI agent support to the Operational Narrative section of the Design tab's Operational Approach.

Purpose: Enable the AI to draft a coherent operational narrative by synthesizing all operational design data (problem framing, CoG analysis, LOEs, phases, transitions, decision points) into a unified narrative text that the user can adopt or use as a starting point.

Output: Backend narrative synthesis agent, wired analyze endpoint, frontend AI panel in OperationalApproachSection with Apply/Adopt functionality.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/src/agents/cog-analysis.ts (pattern reference for agent structure)
@backend/src/agents/loe-gap-analysis.ts (pattern reference for agent structure)
@backend/src/api/design.ts (analyze endpoint to extend)
@backend/src/design/types.ts (all design domain types)
@frontend/src/components/design/OperationalApproachSection.tsx (section to add AI panel to)
@frontend/src/components/design/DesignAIPanel.tsx (AI panel component to extend)
@frontend/src/components/design/CoGAnalysisSection.tsx (pattern for AI panel integration in section)

<interfaces>
<!-- Key types the executor needs -->

From backend/src/design/types.ts:
```typescript
export interface OperationalApproach {
  phases: Array<{ id: string; name: string; description: string; order: number }>;
  transitions: Array<{ fromPhaseId: string; toPhaseId: string; conditions: string[] }>;
  decisionPoints: Array<{ id: string; label: string; phaseId: string; criteria: string[] }>;
  narrative: string;
}

export interface OperationalDesign {
  id: string;
  problemSetId: string;
  problemFraming: ProblemFramingData;
  cogAnalysis: CoGAnalysis;
  linesOfEffort: LineOfEffort[];
  operationalApproach: OperationalApproach;
  status: DesignStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}
```

From frontend DesignAIPanel props:
```typescript
interface DesignAIPanelProps {
  problemSetId: string;
  activeSection: string;
  sectionData: Record<string, any>;
  isOpen: boolean;
  onToggle: () => void;
  onAdopt?: (framing: AlternativeFraming) => void;
  onMerge?: (framing: AlternativeFraming) => void;
  onApplyCogSuggestion?: (suggestion: any) => void;
}
```

Backend analyze endpoint dispatches by section name, currently handles: problem-framing, cog-analysis, lines-of-effort. The operational-approach case falls through to 400 error.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create narrative synthesis backend agent and wire analyze endpoint</name>
  <files>backend/src/agents/narrative-synthesis.ts, backend/src/api/design.ts</files>
  <action>
Create `backend/src/agents/narrative-synthesis.ts` following the exact pattern of `cog-analysis.ts` and `loe-gap-analysis.ts`:

1. Define output interfaces:
   - `NarrativeDraft`: Contains `narrative` (string, the full draft narrative text), `sections` (array of `{ heading: string; content: string }` for structured breakdown), `confidence` (number 0-1), `confidenceBounds` ({ lower, upper }), `synthesisNotes` (string[] -- what data was used/missing).
   - `NarrativeSynthesisOutput`: Contains `drafts` (NarrativeDraft[] -- 1-2 alternative narrative drafts), `completenessScore` (number 0-1 based on how much design data exists to synthesize).

2. Define the agent manifest following the exact pattern (AgentPhase.Support, AutonomyLevel.HumanLed, AgentCapability.ContextAnalysis).

3. Implement `synthesizeNarrative(context: NarrativeSynthesisContext): NarrativeSynthesisOutput` where `NarrativeSynthesisContext` includes:
   - `problemFraming`: ProblemFramingData
   - `cogAnalysis`: CoGAnalysis
   - `linesOfEffort`: LineOfEffort[]
   - `operationalApproach`: OperationalApproach

   v1 is rule-based (no LLM call), matching the pattern of the other agents:
   - Build a narrative string by concatenating structured prose from the available data:
     a. Opening paragraph: reference the problem statement and desired end state from problemFraming
     b. CoG paragraph: describe friendly and adversary centers of gravity and key critical vulnerabilities
     c. LOE paragraph: describe each line of effort, its decisive points, and how they target adversary CVs
     d. Phasing paragraph: describe operational phases and transition conditions
     e. Decision points paragraph: list key decision points and their criteria
   - Calculate completenessScore based on how many sections have substantive data (problemStatement not empty, CoG roots exist, LOEs exist, phases defined)
   - Generate 1 primary draft and 1 alternative with different emphasis (e.g., first emphasizes objectives, second emphasizes phasing)
   - Use conservative confidence: 0.5 base with bounds {lower: 0.3, upper: 0.7} per INVARIANT 5

4. In `backend/src/api/design.ts`, add the `operational-approach` case to the analyze endpoint (line ~143, the else block):
   ```
   } else if (section === 'operational-approach') {
     const { synthesizeNarrative } = await import('../agents/narrative-synthesis.js');
     // Need full design data for synthesis -- fetch from store
     const design = await designStore.getByProblemSetId(req.params.problemSetId);
     const output = synthesizeNarrative({
       problemFraming: design.problemFraming,
       cogAnalysis: design.cogAnalysis,
       linesOfEffort: design.linesOfEffort,
       operationalApproach: design.operationalApproach,
     });
     res.json(output);
   } else {
   ```
   Also import `OperationalApproach` from design types at the top import line.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && npx tsc --noEmit backend/src/agents/narrative-synthesis.ts backend/src/api/design.ts 2>&1 | head -30</automated>
  </verify>
  <done>narrative-synthesis.ts exports synthesizeNarrative and NarrativeSynthesisOutput. design.ts analyze endpoint handles operational-approach section by fetching full design data and calling synthesizeNarrative. TypeScript compiles without errors.</done>
</task>

<task type="auto">
  <name>Task 2: Add AI panel to OperationalApproachSection and render narrative results in DesignAIPanel</name>
  <files>frontend/src/components/design/OperationalApproachSection.tsx, frontend/src/components/design/DesignAIPanel.tsx</files>
  <action>
**DesignAIPanel.tsx changes:**

1. Add a new prop `onApplyNarrative?: (narrative: string) => void` to `DesignAIPanelProps`.

2. Add types for narrative synthesis results (mirror backend output):
   ```typescript
   interface NarrativeDraft {
     narrative: string;
     sections: Array<{ heading: string; content: string }>;
     confidence: number;
     confidenceBounds: { lower: number; upper: number };
     synthesisNotes: string[];
   }
   ```

3. Add `renderOperationalApproachResults()` function (following the pattern of `renderCogAnalysisResults` and `renderLoeGapResults`):
   - Show a ScoreBar for "Design Completeness" using `cachedResults.completenessScore`
   - Show `synthesisNotes` as info items (what data was used/missing)
   - For each draft in `cachedResults.drafts` (not dismissed), render a card showing:
     - Confidence badge with confidenceLabel()
     - The `sections` array as collapsible headings with content preview (first 100 chars)
     - An "Apply" button that calls `onApplyNarrative?.(draft.narrative)` -- this replaces the textarea content
     - A "Dismiss" button using existing handleDismiss pattern
   - Style cards with the same `bg-gray-800 border border-gray-700 rounded-lg p-3 mb-3` pattern

4. In the results area JSX (around line 507-520), add the operational-approach section renderer:
   ```jsx
   {activeSection === 'operational-approach' && renderOperationalApproachResults()}
   ```

**OperationalApproachSection.tsx changes:**

1. Import `DesignAIPanel` from `./DesignAIPanel.tsx`

2. Add state: `const [aiPanelOpen, setAiPanelOpen] = useState(false);`

3. Add handler `handleApplyNarrative` that sets the narrative text:
   ```typescript
   const handleApplyNarrative = useCallback((narrative: string) => {
     updateApproach((prev) => ({ ...prev, narrative }));
   }, [updateApproach]);
   ```

4. Wrap the existing return JSX in a flex container (matching CoGAnalysisSection pattern):
   - Outer: `<div className="flex gap-0">`
   - Left side (existing content): `<div className="flex-1 min-w-0 space-y-6">` (move all existing content here)
   - Right side: `<DesignAIPanel>` component

5. Pass to DesignAIPanel:
   - `problemSetId={problemSetId}`
   - `activeSection="operational-approach"`
   - `sectionData={{ ...approach, designData }}` -- include full designData so backend can access all sections
   - `isOpen={aiPanelOpen}`
   - `onToggle={() => setAiPanelOpen(!aiPanelOpen)}`
   - `onApplyNarrative={handleApplyNarrative}`

6. In the section header area (line ~280), add an "AI Assistant" toggle button matching the CoGAnalysisSection pattern -- a small button that toggles aiPanelOpen.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && npx tsc --noEmit frontend/src/components/design/OperationalApproachSection.tsx frontend/src/components/design/DesignAIPanel.tsx 2>&1 | head -30</automated>
  </verify>
  <done>OperationalApproachSection renders DesignAIPanel in a flex layout matching CoGAnalysisSection. DesignAIPanel renders narrative drafts with Apply/Dismiss for the operational-approach section. Apply button inserts the narrative text into the textarea via onApplyNarrative callback. TypeScript compiles without errors.</done>
</task>

</tasks>

<verification>
1. TypeScript compilation: `cd /home/vitalpointai/projects/ssr && npx tsc --noEmit` (full project)
2. Backend: The analyze endpoint now handles all 4 sections without falling through to 400
3. Frontend: OperationalApproachSection shows AI panel toggle, panel opens/closes, Analyze button triggers backend call
4. Apply flow: clicking Apply on a narrative draft populates the textarea and triggers auto-save
</verification>

<success_criteria>
- narrative-synthesis.ts agent generates structured narrative drafts from all design data
- design.ts analyze endpoint handles operational-approach section
- OperationalApproachSection shows collapsible AI panel (matching CoG/LOE pattern)
- DesignAIPanel renders narrative drafts with completeness score, sections preview, and Apply/Dismiss
- Applying a draft inserts text into the narrative textarea and triggers auto-save
- Full TypeScript compilation passes
</success_criteria>

<output>
After completion, create `.planning/quick/8-ai-agent-operational-narrative/8-SUMMARY.md`
</output>
