# UAT Issues: Phase 4 Plan 7

**Tested:** 2026-01-19
**Source:** .planning/phases/04-strategic-planning-module/4-07-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: DELETE OSINT source fails when request has no body

**Discovered:** 2026-01-19
**Phase/Plan:** 04-07
**Severity:** Minor
**Feature:** OSINT Source DELETE endpoint
**Description:** The DELETE /api/admin/osint-sources/:id endpoint crashes with "Cannot destructure property 'reason' of 'req.body' as it is undefined" when the request has no body.
**Expected:** DELETE requests typically don't have a body. The endpoint should handle missing body gracefully and make `reason` optional.
**Actual:** Server crashes trying to destructure `reason` from undefined `req.body`.
**Repro:**
1. Create an OSINT source via POST
2. Try to delete it with: `curl -X DELETE http://localhost:3001/api/admin/osint-sources/ID -H "X-DID: admin-did"`
3. Server returns 500 error

**Fix:** In `backend/src/api/admin.ts` line ~399, change:
```typescript
const { reason } = req.body;
```
to:
```typescript
const reason = req.body?.reason;
```

## Resolved Issues

[None yet]

---

*Phase: 04-strategic-planning-module*
*Plan: 07*
*Tested: 2026-01-19*
