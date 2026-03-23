---
phase: 54-update-research-whitepaper-and-docs-for-demo-briefing
plan: "07"
subsystem: docs
tags: [whitepaper, export, docx, api-reference, stale-references, cleanup]

requires:
  - 54-01
  - 54-02
  - 54-03
  - 54-04
provides:
  - "Updated export.sh with v0.2 file list (15 input files including new background sections)"
  - "All 'Direct tab' stale references eliminated from docs/ (8 occurrences in RED-TEAM-AIDE-MEMOIRE.md)"
  - "API reference endpoint count updated ~417→~572"
  - "Discussion section smart contract count updated 12→14"
  - "DOCX ready to generate locally: bash docs/whitepaper/scripts/export.sh docx"
affects: []

tech-stack:
  added: []
  patterns:
    - "pandoc export with --defaults config for DOCX/PDF generation"
    - "export.sh INPUT_FILES array defines document assembly order"

key-files:
  created:
    - docs/whitepaper/exports/ (directory, gitignored — created by export.sh at runtime)
  modified:
    - docs/whitepaper/scripts/export.sh
    - docs/RED-TEAM-AIDE-MEMOIRE.md
    - docs/site/docs/api/rest-endpoints.md
    - docs/whitepaper/05-discussion.md

key-decisions:
  - "DOCX generation blocked by sandbox (pandoc binary execution denied); export.sh is updated and ready for user to run locally"
  - "131 agent count retained in whitepaper as research-documented figure (detailed breakdown in ai-agents/overview.md validates count)"
  - "RED-TEAM-AIDE-MEMOIRE.md 'Direct tab' references all changed to 'Decide tab' including quick reference table header"
  - "API reference already comprehensive (927 lines, organized by domain); updated endpoint count from ~417 to ~572"

requirements-completed: [DOC-01, DOC-03]

duration: 20min
completed: 2026-03-23
---

# Phase 54 Plan 07: Export Script, DOCX Generation, and Final Reference Sweep

**Export script updated with 15-file v0.2 assembly order; all 8 stale "Direct tab" references eliminated from docs/; API endpoint count updated from ~417 to ~572 across 3 files.**

## Performance

- **Tasks:** 2/2
- **Files modified:** 4
- **Commits:** 2

## Task Commits

1. **Task 1: Update export.sh with v0.2 file list** — `4a718711` — Added 02-background-robotics.md and 02-background-knowledge-graphs.md in correct position between background-ai and methodology; created exports/ directory placeholder
2. **Task 2: Stale reference sweep and API reference update** — `51197fb5` — Fixed all 8 "Direct tab" → "Decide tab" in RED-TEAM-AIDE-MEMOIRE.md including table header; updated endpoint count ~417→~572 in rest-endpoints.md and 05-discussion.md; fixed smart contract count 12→14

## Deviations from Plan

### Auto-fixed Issues

None.

### Blocked Item: DOCX Generation

**Issue:** The sandbox environment blocks pandoc binary execution via Bash, preventing `bash scripts/export.sh docx` from running.

**Status:** The export.sh script is fully updated and correct. To generate the DOCX, run locally:
```bash
cd docs/whitepaper && bash scripts/export.sh docx
```

**Output location:** `docs/whitepaper/exports/BASTION-Whitepaper-v0.2-<date>.docx`

**Note:** The exports/ directory is in .gitignore (generated files). The script creates it automatically via `mkdir -p`.

## Stale Reference Sweep Results

| Check | Files Found | Status |
|-------|-------------|--------|
| `direct-tab\|Direct tab` | 0 | PASS |
| `~417 endpoint` | 0 (updated) | PASS |
| `12 smart contract modules` | 0 (updated to 14) | PASS |
| `131 agents` in API/arch docs | Retained (validated count) | PASS |

## DOC Requirements Final Status

| Req | Description | Status |
|-----|-------------|--------|
| DOC-01 | v0.2 whitepaper with updated abstract | PASS (abstract covers robot/swarm/8 contributions) |
| DOC-02 | SITREP covers Phase 53 | PASS (phase 54-04 confirmed) |
| DOC-03 | No "direct-tab" refs in docs/ | PASS (0 matches) |
| DOC-04 | Slide deck has 20+ slides | PASS (32 slides, phase 54-05) |
| DOC-05 | Demo script has 30-min timing | PASS (28 min content, phase 54-05) |
| DOC-06 | All figure specs exist | PASS (5 spec files, phase 54-04) |
| DOC-07 | New docs site pages exist | PASS (5 capability pages, phase 54-06) |

## Self-Check: PASSED

- [x] docs/whitepaper/scripts/export.sh contains "02-background-robotics.md"
- [x] docs/whitepaper/scripts/export.sh contains "02-background-knowledge-graphs.md"
- [x] `grep -rn "direct-tab|Direct tab" docs/ --include="*.md"` returns 0 matches
- [x] docs/site/docs/api/rest-endpoints.md exists with 927 lines (well above 50 minimum)
- [x] docs/site/docs/api/rest-endpoints.md says "approximately 572 REST endpoints"
- [x] Commits 4a718711 and 51197fb5 exist in git log
- [ ] DOCX file exists in docs/whitepaper/exports/ — BLOCKED (requires local pandoc run)
