# UAT Issues: Phase 2 Plan 5

**Tested:** 2026-01-15
**Source:** .planning/phases/02-identity-security-framework/2-05-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None - all issues resolved]

## Resolved Issues

### UAT-001: Import paths missing .js extension - runtime failure

**Discovered:** 2026-01-15
**Phase/Plan:** 2-05
**Severity:** Blocker
**Feature:** All PQ crypto utilities
**Description:** The crypto module files use import paths without `.js` extension (e.g., `@noble/post-quantum/ml-kem` instead of `@noble/post-quantum/ml-kem.js`). This causes `ERR_PACKAGE_PATH_NOT_EXPORTED` errors at runtime.
**Expected:** Crypto utilities can be imported and used at runtime
**Actual:** Runtime error: `Package subpath './ml-kem' is not defined by "exports"`

**Resolved:** 2026-01-15 - Fixed during UAT session
**Commit:** `3f151ed`
**Fix:** Added `.js` extensions to all @noble/* imports in pq-kem.ts and pq-signatures.ts

---

*Phase: 02-identity-security-framework*
*Plan: 05*
*Tested: 2026-01-15*
