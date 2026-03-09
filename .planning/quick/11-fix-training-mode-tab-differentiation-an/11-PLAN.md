---
phase: quick-11
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/validation/scoring/score-reliability.ts
  - backend/src/validation/scoring/score-authority.ts
  - frontend/src/components/problem-set/ProblemSetTabContainer.tsx
autonomous: true
requirements: [QUICK-11]
must_haves:
  truths:
    - "Orphaned stub scorer files are removed so there is no confusion about which scorers are active"
    - "Tab bar visually differentiates training mode from operational mode with amber/yellow indicators"
    - "Tab labels in training mode show training-specific suffixes or badges on tabs that behave differently"
  artifacts:
    - path: "frontend/src/components/problem-set/ProblemSetTabContainer.tsx"
      provides: "Training mode visual differentiation on tab bar"
      contains: "useMode"
  key_links:
    - from: "frontend/src/components/problem-set/ProblemSetTabContainer.tsx"
      to: "frontend/src/context/ModeContext.tsx"
      via: "useMode hook import"
      pattern: "useMode"
---

<objective>
Clean up orphaned validation scorer stubs and add training mode visual differentiation to the problem set tab bar.

Purpose: The validation system already uses the real LLM-as-judge scorers (reliability-scorer.ts, authority-scorer.ts) -- the stub files (score-reliability.ts, score-authority.ts) are orphaned and cause confusion. The tab container needs visual cues when in training mode so users know content will differ.

Output: Cleaned up scorer directory, visually differentiated training mode tabs.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/problem-set/ProblemSetTabContainer.tsx
@frontend/src/context/ModeContext.tsx
@backend/src/validation/scoring/index.ts
@backend/src/validation/scoring/score-reliability.ts
@backend/src/validation/scoring/score-authority.ts
@backend/src/validation/validation-runner.ts

<interfaces>
<!-- validation-runner.ts already imports from the REAL scorers, not the stubs -->
From backend/src/validation/validation-runner.ts (lines 22-24):
```typescript
import { scoreDeterminism } from './scoring/determinism-scorer.js';
import { scoreReliability } from './scoring/reliability-scorer.js';
import { scoreAuthority } from './scoring/authority-scorer.js';
```

From backend/src/validation/scoring/index.ts:
```typescript
export { scoreDeterminism } from './determinism-scorer.js';
export { scoreReliability } from './reliability-scorer.js';
export { scoreAuthority } from './authority-scorer.js';
export { cosineSimilarity } from './cosine-similarity.js';
```

From frontend/src/context/ModeContext.tsx:
```typescript
export type AppMode = 'training' | 'operational';
export interface ModeContextType {
  mode: AppMode;
  isTraining: boolean;
  // ...
}
export const useMode = () => useContext(ModeContext);
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete orphaned stub scorer files</name>
  <files>backend/src/validation/scoring/score-reliability.ts, backend/src/validation/scoring/score-authority.ts</files>
  <action>
    Delete the two orphaned stub files:
    - `backend/src/validation/scoring/score-reliability.ts` (Phase 31 Plan 02 stub -- superseded by reliability-scorer.ts)
    - `backend/src/validation/scoring/score-authority.ts` (Phase 31 Plan 02 stub -- superseded by authority-scorer.ts)

    These files are NOT imported anywhere. The validation-runner.ts already imports from the real LLM-as-judge implementations (`reliability-scorer.ts` and `authority-scorer.ts`). The barrel export `scoring/index.ts` also exports from the real implementations. The stubs only cause confusion.

    After deletion, verify no import references break by running `grep -r "score-reliability\|score-authority" backend/src/` -- should return zero matches (already confirmed during research).
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && ! test -f backend/src/validation/scoring/score-reliability.ts && ! test -f backend/src/validation/scoring/score-authority.ts && ! grep -r "score-reliability\|score-authority" backend/src/ && echo "PASS"</automated>
  </verify>
  <done>Orphaned stub files deleted, no broken imports</done>
</task>

<task type="auto">
  <name>Task 2: Add training mode visual differentiation to tab bar</name>
  <files>frontend/src/components/problem-set/ProblemSetTabContainer.tsx</files>
  <action>
    Import `useMode` from `../../context/ModeContext` in ProblemSetTabContainer.tsx.

    Add visual differentiation when `isTraining` is true:

    1. **Tab bar background**: Change the nav bar background from `bg-gray-800` to `bg-amber-900/30 border-amber-700/50` when in training mode, providing an immediate visual cue.

    2. **Training mode indicator**: Add a small "TRAINING" label badge in the tab bar (before the tabs) when `isTraining` is true. Style: `bg-amber-500/20 text-amber-400 text-[10px] font-bold uppercase px-2 py-1 rounded self-center ml-2 tracking-wider`.

    3. **Tab-specific badges**: For tabs whose content differs in training mode, add a small amber dot or "TRN" micro-badge next to the tab label. The tabs that differ are:
       - `understand` -- shows Training Packages in training mode
       - `assess` -- routes to echelon-specific training assessment views

       Add after the tab label text (before existing badges): when `isTraining` and the tab is `understand` or `assess`, render a small amber indicator: `<span className="ml-1 w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" title="Content differs in training mode" />`.

    4. **Outer container**: When `isTraining`, add a subtle top border to the main container div: add `border-t-2 border-amber-500/40` class.

    Implementation notes:
    - Destructure `const { isTraining } = useMode();` early in the component, near other hook calls.
    - Use template literals or array join pattern already used in the file for conditional classes.
    - Do NOT change any tab content routing or functionality -- this is purely visual.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && grep -q "useMode" frontend/src/components/problem-set/ProblemSetTabContainer.tsx && grep -q "isTraining" frontend/src/components/problem-set/ProblemSetTabContainer.tsx && grep -q "TRAINING" frontend/src/components/problem-set/ProblemSetTabContainer.tsx && grep -q "amber" frontend/src/components/problem-set/ProblemSetTabContainer.tsx && echo "PASS"</automated>
  </verify>
  <done>Tab bar shows amber training mode indicator badge, amber-tinted background, and amber dots on understand/assess tabs when in training mode. No visual changes in operational mode.</done>
</task>

</tasks>

<verification>
- Stub files removed: `ls backend/src/validation/scoring/score-*.ts` returns only `score-determinism.ts`
- No broken imports: `grep -r "score-reliability\|score-authority" backend/src/` returns nothing
- Training mode visual: ProblemSetTabContainer imports useMode and conditionally renders amber indicators
- Build check: `cd frontend && npx tsc --noEmit` completes without errors related to changed files
</verification>

<success_criteria>
- Orphaned stub scorer files deleted with zero import breakage
- Training mode tab bar shows: amber-tinted nav background, "TRAINING" badge, amber dots on understand/assess tabs
- Operational mode tab bar unchanged from current appearance
- TypeScript compilation passes
</success_criteria>

<output>
After completion, create `.planning/quick/11-fix-training-mode-tab-differentiation-an/11-SUMMARY.md`
</output>
