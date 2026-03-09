---
phase: 40-autonomous-document-intelligence-team
plan: 07
subsystem: doc-intelligence
tags: [provenance, revert, osint, researcher, pg-boss, knowledge-graph, trust]

# Dependency graph
requires:
  - phase: 40-01
    provides: "Types, schemas, specialist-base, orchestrator"
  - phase: 40-03
    provides: "DocumentOrchestrator for pipeline re-entry"
provides:
  - "ProvenanceStore for entity-to-source tracking with multi-source attribution"
  - "RevertService for preview-before-execute source revocation with soft-delete"
  - "Researcher specialist for gap-triggered and scheduled OSINT monitoring"
affects: [40-08, 40-09, 40-10]

# Tech tracking
tech-stack:
  added: []
  patterns: [provenance-tracking, soft-delete-revocation, pg-boss-scheduled-research, depth-limited-recursion]

key-files:
  created:
    - backend/src/doc-intelligence/provenance/provenance-store.ts
    - backend/src/doc-intelligence/provenance/revert-service.ts
    - backend/src/doc-intelligence/specialists/researcher.ts
  modified: []

key-decisions:
  - "Soft-delete approach for entity revocation (flagged not deleted) to allow recovery"
  - "Preview-before-execute pattern for source revocation to prevent accidental data loss"
  - "MAX_RESEARCH_DEPTH=2 to prevent infinite research loops (Pitfall 3)"
  - "Research briefs stored as strategic_documents to re-enter the processing pipeline"

patterns-established:
  - "Provenance tracking: every graph entity links to source documents via entity_provenance"
  - "Soft-delete revocation: entities and relationships flagged with is_revoked/revoked_at/revoked_by"
  - "Research pipeline re-entry: research products become strategic_documents processed like uploads"
  - "Gap deduplication: researched gap IDs tracked with cooldown timestamps"

requirements-completed: [DOCTEAM-10, DOCTEAM-11]

# Metrics
duration: 5min
completed: 2026-03-09
---

# Phase 40 Plan 07: Provenance & Researcher Summary

**Entity provenance tracking with multi-source attribution, preview-before-execute source revocation, and autonomous OSINT researcher with pg-boss scheduling**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-09T21:34:20Z
- **Completed:** 2026-03-09T21:39:42Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments
- ProvenanceStore tracks entity-to-source many-to-many relationships with idempotent inserts and sole-source detection
- RevertService provides preview (impact analysis before changes) and execute (transactional soft-delete) for source revocation with full audit trail
- Researcher specialist detects knowledge gaps (low-confidence entities, unaddressed standing requirements, sparse actors) and fills them via LLM-generated research briefs
- pg-boss integration for scheduled OSINT monitoring and gap-triggered immediate research with singleton key deduplication

## Task Commits

Each task was committed atomically:

1. **Task 1: Provenance store and revert service** - `478924f` (feat)
2. **Task 2: Autonomous Researcher specialist** - `a1c68b7` (feat)

## Files Created/Modified
- `backend/src/doc-intelligence/provenance/provenance-store.ts` - Entity-to-source provenance tracking with multi-source attribution queries
- `backend/src/doc-intelligence/provenance/revert-service.ts` - Source revocation with preview, transactional execute, and audit trail
- `backend/src/doc-intelligence/specialists/researcher.ts` - Autonomous OSINT researcher with gap detection, web search, and pg-boss scheduling

## Decisions Made
- Soft-delete approach for entity revocation: entities flagged with is_revoked rather than hard-deleted, allowing recovery if revocation was wrong
- Preview-before-execute pattern: users see full impact (entities removed vs updated, relationships affected) before any changes
- Research products stored as strategic_documents with source_type='research_brief' so they re-enter the full pipeline
- MAX_RESEARCH_DEPTH=2 with 1-hour cooldown and budget limit to prevent infinite research loops (addresses Pitfall 3 from RESEARCH.md)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Provenance store ready for integration with all specialists that create graph entities
- RevertService ready for API endpoint exposure in later plans
- Researcher ready for pg-boss worker registration during server startup
- Web search integration is stubbed; actual search API (Tavily/Serper) wiring needed when environment configured

---
*Phase: 40-autonomous-document-intelligence-team*
*Completed: 2026-03-09*
