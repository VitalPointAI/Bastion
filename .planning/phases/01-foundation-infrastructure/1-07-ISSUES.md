# UAT Issues: Phase 1 Plan 7

**Tested:** 2026-01-13
**Source:** .planning/phases/01-foundation-infrastructure/1-07-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

None

## Resolved Issues

### UAT-001: Root README.md missing purpose/vision overview

**Discovered:** 2026-01-13
**Resolved:** 2026-01-13 - Fixed in 1-07-FIX.md
**Commit:** 24b75c9
**Severity:** Minor
**Feature:** Documentation - Root README.md
**Description:** README.md lacks a clear explanation of what BASTION is and its purpose/vision
**Fix:** Added Vision section explaining end-to-end military planning automation with blockchain verification

### UAT-002: Component READMEs missing clear purpose statements

**Discovered:** 2026-01-13
**Resolved:** 2026-01-13 - Fixed in 1-07-FIX.md
**Commit:** 2c32504
**Severity:** Minor
**Feature:** Documentation - Component READMEs
**Description:** All three component READMEs (backend, frontend, near-contracts) lack clear purpose statements
**Fix:** Added "Role in the System" paragraph to each component README

### UAT-003: docker-compose DATABASE_URL override issue

**Discovered:** 2026-01-13
**Resolved:** 2026-01-13 - Fixed during UAT
**Severity:** Major (was blocking stack startup)
**Feature:** docker-compose.yml configuration
**Description:** backend/.env DATABASE_URL was overriding docker-compose's correct postgres hostname
**Fix:** Reordered docker-compose.yml to put `env_file:` before `environment:` so explicit env vars take precedence
**Commit:** 28ec1ad

### UAT-004: accounts.ts using duplicate database pool

**Discovered:** 2026-01-14
**Resolved:** 2026-01-14 - Fixed in 1-07-FIX
**Severity:** Major (was blocking /api/accounts/create)
**Feature:** Backend accounts API
**Description:** accounts.ts created its own Pool with `DB_HOST || 'localhost'` fallback instead of using shared getPool() from database.ts
**Fix:** Replace local Pool with getPool() import from database.ts
**Commit:** 6df8c5e

### UAT-005: Wrong MPC contract ID for testnet

**Discovered:** 2026-01-14
**Resolved:** 2026-01-14 - Fixed in 1-07-FIX
**Severity:** Minor
**Feature:** MPC account manager
**Description:** mpc-accounts.ts and accounts.ts used v1.signer-dev.testnet instead of v1.signer-prod.testnet
**Fix:** Changed all occurrences to v1.signer-prod.testnet
**Commit:** 6df8c5e

---

*Phase: 01-foundation-infrastructure*
*Plan: 07*
*Tested: 2026-01-14*
