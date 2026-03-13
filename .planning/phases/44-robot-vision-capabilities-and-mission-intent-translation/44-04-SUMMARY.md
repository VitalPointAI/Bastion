---
phase: 44-robot-vision-capabilities-and-mission-intent-translation
plan: "04"
subsystem: robot
tags: [intent-translation, instructor, pydantic, regex, fallback, tdd]

# Dependency graph
requires:
  - phase: 44-01
    provides: MissionJSON/MissionParams models, intent package stub, config vars (INTENT_LLM_ENABLED, OPENAI_API_KEY, ANTHROPIC_API_KEY)

provides:
  - template_translate: regex-based offline intent translation covering 6 mission command types
  - IntentTranslator: cloud LLM translation via instructor with transparent template fallback
  - translate_intent: module-level convenience wrapper using config settings
  - decompose_objective: compound objective splitting using conjunction heuristic or LLM

affects:
  - 44-05 (vision pipeline — may call translate_intent for VLM-derived commands)
  - 44-06 (mission profiles — intent params feed profile selection)
  - 44-08 (integration — intent pipeline wired into mission_client)

# Tech tracking
tech-stack:
  added:
    - instructor (optional — graceful ImportError fallback)
    - openai (optional — used when instructor + OPENAI_API_KEY available)
    - anthropic (optional — used when instructor + ANTHROPIC_API_KEY available)
  patterns:
    - TDD red-green for fallback path with 15 unit tests
    - Priority-ordered regex template list (more specific patterns before general)
    - asyncio.to_thread for blocking LLM call inside async translate()
    - Graceful ImportError fallback: log warning, set self._available = False

key-files:
  created:
    - robot/intent/fallback.py
    - robot/intent/translator.py
    - robot/intent/decomposer.py
    - robot/tests/test_intent.py
  modified: []

key-decisions:
  - "Priority-ordered regex templates with word-boundary anchors prevent false matches (e.g. resupply before survey)"
  - "Cloud translator uses asyncio.to_thread so it does not block the robot event loop"
  - "Decomposer delegates to LLM when available (LLM handles decomposition natively); offline heuristic only splits on conjunction keywords"
  - "instructor library is optional — missing import sets is_available=False, not an error"

patterns-established:
  - "Intent translation pattern: try cloud (instructor) → fall back to regex templates → return None if no match"
  - "All LLM calls run in asyncio.to_thread for non-blocking async operation"

requirements-completed: [INT-01, INT-02]

# Metrics
duration: 3min
completed: 2026-03-13
---

# Phase 44 Plan 04: Intent Translation System Summary

**Regex template fallback + instructor-wrapped cloud LLM intent translator that maps natural language commands to MissionJSON, with compound objective decomposer and 15 TDD unit tests**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-03-13T21:42:57Z
- **Completed:** 2026-03-13T21:45:23Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Template fallback (`fallback.py`) maps operator text to all 6 mission command types (recon_area, visual_search, overwatch, resupply_route, patrol_route, find_engage) using priority-ordered regex with word-boundary anchors; returns None for unrecognized input
- Cloud translator (`translator.py`) wraps instructor library for structured Pydantic output; falls back silently to template_translate when instructor is not installed or no API key is configured; LLM call runs in asyncio.to_thread
- Strategic decomposer (`decomposer.py`) splits compound objectives containing "and/then/followed by" into per-clause missions; delegates to LLM when cloud translator is available
- 15 TDD unit tests covering all command types, None returns, UUID validation, case-insensitivity, and edge cases — all pass

## Task Commits

1. **Task 1 RED — Failing test suite** - `a042363` (test)
2. **Task 1 GREEN — template_translate implementation** - `79c059d` (feat)
3. **Task 2 — Cloud translator and decomposer** - `4b3216d` (feat)

## Files Created/Modified

- `robot/intent/fallback.py` — Priority-ordered regex templates for offline intent translation; exports template_translate
- `robot/intent/translator.py` — IntentTranslator class wrapping instructor with graceful fallback; exports translate_intent
- `robot/intent/decomposer.py` — decompose_objective for compound multi-mission objectives
- `robot/tests/test_intent.py` — 15 unit tests for template fallback (TDD red-green)

## Decisions Made

- Priority-ordered regex templates with `\b` word-boundary anchors prevent false positives (e.g., "resupply" checked before broader patterns; "survey" maps to recon_area correctly)
- Cloud translator uses `asyncio.to_thread` to avoid blocking the robot event loop during LLM calls
- Decomposer delegates entirely to LLM when available (LLM natively returns multiple missions); offline heuristic splits only on conjunction keywords
- instructor is treated as fully optional — ImportError just sets `is_available = False` and logs a warning

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — pre-existing test failure (`test_vision_engine_simulate.py` missing `vision.vision_engine` module) is from a future plan's stub, not this plan. Pre-existing `test_config_registration_token_optional` failure is unrelated environment condition.

## User Setup Required

To use the cloud LLM path:
1. `pip install instructor openai` (or `pip install instructor anthropic`)
2. Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` env var
3. Set `INTENT_LLM_ENABLED=true` in `robot/.env`

No cloud keys required for offline template fallback.

## Next Phase Readiness

- Intent translation pipeline complete and tested — ready for 44-05 (vision) and 44-08 (integration)
- `translate_intent()` convenience function ready for wiring into mission_client
- Decomposer ready for multi-objective operator commands

---
*Phase: 44-robot-vision-capabilities-and-mission-intent-translation*
*Completed: 2026-03-13*
