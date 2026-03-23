---
phase: 55-ironclaw-guided-design-interview-for-operational-approach-development
plan: "01"
subsystem: design-interview
tags: [langgraph, interview, ironclaw, design, operational-approach, jp5-0, cog-analysis]
dependency_graph:
  requires:
    - backend/src/orchestration/checkpointer.ts (PostgresSaver singleton)
    - backend/src/agents/langgraph/llm-factory.ts (createLLMForAgent)
    - backend/src/design/types.ts (OperationalDesign, CoGAnalysis, etc.)
    - backend/src/doc-intelligence/interview/interview-store.ts (getProblemSetContext prerequisite check)
    - backend/src/doc-intelligence/specialists/researcher.ts (Researcher.triggerGapResearch)
    - backend/src/lib/database.ts (getPool)
  provides:
    - DesignInterviewService (startInterview, continueInterview, confirmSection, getInterviewState, resetInterview)
    - DesignInterviewStore (section confirmation persistence)
    - Design interview prompts with JP 5-0 doctrinal coverage
  affects:
    - future: design-interview API routes (55-02 or later)
    - future: frontend IronclawDrawer integration for design tab
tech_stack:
  added: []
  patterns:
    - LangGraph StateGraph with interrupt-resume (mirrors interview-service.ts)
    - PostgreSQL checkpointing via getCheckpointer()
    - Fire-and-forget background research via pg-boss / Researcher.triggerGapResearch
    - System message filter (.type !== system) for checkpoint-safe deserialization
    - Per-section extraction prompts returning typed OperationalDesign JSON
key_files:
  created:
    - backend/src/design-interview/design-interview-types.ts
    - backend/src/design-interview/design-interview-prompts.ts
    - backend/src/design-interview/design-interview-store.ts
    - backend/src/design-interview/design-interview-service.ts
  modified: []
decisions:
  - "Used dynamic import for Researcher in dispatchBackgroundResearch to avoid circular dependency at module load time"
  - "advanceSection node uses separate graph thread for advance to cleanly separate section transition from main conversation thread"
  - "Section coverage check uses structural inspection of derivedDesign rather than LLM evaluation for determinism and speed"
  - "Red-team probing appended as AI message in processAnswer (single LLM call) rather than separate graph node"
  - "KG gap detection uses regex pattern matching against user answer text — no additional LLM call required"
metrics:
  duration: 25 min
  completed_date: "2026-03-23"
  tasks_completed: 2
  files_created: 4
---

# Phase 55 Plan 01: Design Interview Types, Prompts, Store, and LangGraph Service Summary

LangGraph-powered guided design interview engine with 4 sequential doctrinal sections, JP 5-0 coverage criteria, challenge-then-recommend questioning style, and fire-and-forget KG gap research dispatch.

## What Was Built

### design-interview-types.ts
- `DesignInterviewStateAnnotation`: LangGraph Annotation.Root extending MessagesAnnotation.spec with 11 fields: currentSection, sectionCoverage, derivedDesign, interviewMode, awaitingSectionConfirm, problemSetId, questionsAsked, isComplete, phase, pendingResearch — all with `(_prev, next) => next` reducers
- `SectionCoverage` interface: `{ met: boolean; criteria: string[]; metCriteria: string[] }`
- `SECTION_COVERAGE_CRITERIA`: doctrinal coverage thresholds for all 4 sections — problem-framing (5 criteria), cog-analysis (5 criteria including adversary_ccs >=2), loes (3 criteria), operational-approach (3 criteria)
- `SECTION_ORDER`: `['problem-framing', 'cog-analysis', 'loes', 'operational-approach']`
- `DesignInterviewMeta`: lightweight type for API responses

### design-interview-prompts.ts
- `getDesignInterviewSystemPrompt(section, derivedDesign, kgContext?)`: section-specific system prompts with Ironclaw as demanding chief of staff; cross-references prior section outputs via derivedDesign; incorporates KG context when available
- `getRedTeamPrompt(section, userAnswer, derivedDesign)`: devil's advocate challenge prompt targeting the user's specific answer
- `evaluateSectionCoverage(section, derivedDesign)`: structural inspection of derivedDesign fields for coverage criteria — deterministic, no LLM call
- `getSectionReviewPrompt(section, derivedDesign)`: end-of-section summary + confirmation prompt
- `getSynthesisNarrativePrompt(derivedDesign)`: capstone 3-4 paragraph narrative prompt tying all 4 sections together

### design-interview-store.ts
- `DesignInterviewStore` class with `saveInterviewProgress`, `getInterviewProgress`, `markSectionConfirmed`, `getDesignInterviewState`, `resetProgress`
- Creates `design_interview_progress` table on demand (DDL guard with `tableEnsured` flag)
- Table: (problem_set_id, section) composite PK, confirmed boolean, confirmed_at timestamptz, created_at, updated_at
- `getDesignInterviewStore()` singleton factory

### design-interview-service.ts
- `DesignInterviewService` class with 5 public methods
- LangGraph StateGraph with 6 nodes: ask_question, process_answer, check_section_coverage, section_review_gate, advance_section, synthesize_narrative
- Thread ID: `design-interview-${problemSetId}` — no collision with ScopingInterview's `interview-${problemSetId}`
- `processAnswer` node: extracts structured OperationalDesign JSON per section, merges into derivedDesign, appends red-team challenge, detects KG gaps
- KG gap detection: regex-based pattern matching for actors (PRC, PLA, Taiwan), strategic documents (UNSCR, NDS), force structures (CSG, ESG) — caps at 3 topics per turn
- `dispatchBackgroundResearch`: dynamic import of Researcher, calls `triggerGapResearch` with fire-and-forget promise (never awaited), updates pendingResearch array
- Section review gate: sets awaitingSectionConfirm=true, graph returns to __end__ to wait for user
- `buildExtractionPrompt`: per-section typed JSON extraction schemas aligned to OperationalDesign interfaces

## Graph Topology

```
__start__ → [routeEntry] → ask_question | process_answer
ask_question → __end__
process_answer → check_section_coverage
check_section_coverage → [routeAfterCoverageCheck] → ask_question | section_review_gate
section_review_gate → __end__  (awaits user confirmation)
advance_section → [routeAfterAdvance] → ask_question | synthesize_narrative
synthesize_narrative → __end__
```

## Deviations from Plan

None — plan executed exactly as written.

The `confirmSection` method uses a two-step approach (process the "Confirmed" message then advance) rather than a single-invoke advance node, which was left to Claude's discretion per the plan's Claude's Discretion section.

## Self-Check: PASSED

Files verified:
- `backend/src/design-interview/design-interview-types.ts` — FOUND
- `backend/src/design-interview/design-interview-prompts.ts` — FOUND
- `backend/src/design-interview/design-interview-store.ts` — FOUND
- `backend/src/design-interview/design-interview-service.ts` — FOUND

Commits verified:
- `f1b493dc` feat(55-01): create design interview types and prompts — FOUND
- `96117261` feat(55-01): build LangGraph StateGraph service and interview store — FOUND

TypeScript compilation: `npx tsc --noEmit` passes with 0 errors (no errors in design-interview files; pre-existing errors in other files unchanged).
