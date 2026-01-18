# UAT Issues: Phase 4 Plan 02

**Tested:** 2026-01-17
**Source:** .planning/phases/04-strategic-planning-module/4-02-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

[None - all issues resolved]

## Resolved Issues

### UAT-001: Deprecated NEAR RPC endpoint causing warning logs

**Discovered:** 2026-01-17
**Phase/Plan:** 04-02 (discovered during, but infrastructure scope)
**Severity:** Minor
**Feature:** NEAR blockchain connectivity (Phase 1 infrastructure)
**Description:** Backend logs show WARNING about deprecated RPC endpoint. The fallback URL `https://rpc.testnet.near.org` is deprecated and should be replaced with `https://rpc.testnet.fastnear.com` or another provider.
**Expected:** No deprecation warnings, using current RPC endpoint
**Actual:** Console logs: `WARNING! THIS ENDPOINT IS DEPRECATED! STOP USING IT NOW! Switch to https://fastnear.com`

**Resolved:** 2026-01-17 - Fixed in 4-02-FIX.md
**Fix:** Updated all 5 fallback RPC URLs from `https://rpc.testnet.near.org` to `https://rpc.testnet.fastnear.com`

**Files modified:**
- `backend/src/api/accounts.ts:192`
- `backend/src/lib/mpc-accounts.ts:154`
- `backend/src/identity/did-service.ts:5`
- `backend/src/lib/near-events.ts:165`
- `backend/src/dao/dao-service.ts:563`

---

*Phase: 04-strategic-planning-module*
*Plan: 02*
*Tested: 2026-01-17*
