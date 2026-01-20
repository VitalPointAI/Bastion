# UAT Issues: Phase 4 Plan 6

**Tested:** 2026-01-19
**Source:** .planning/phases/04-strategic-planning-module/4-06-SUMMARY.md
**Tester:** User via /gsd:verify-work

## Open Issues

### UAT-001: risk_assessments table not auto-created

**Discovered:** 2026-01-19
**Phase/Plan:** 04-06
**Severity:** Blocker
**Feature:** Risk Assessment API
**Description:** GET /api/strategic/risk/high-risk returns database error: "relation \"risk_assessments\" does not exist"
**Expected:** Table should be lazily initialized on first request (like other strategic tables)
**Actual:** Table does not exist, causing 500 error
**Repro:**
1. Start backend server
2. Run: `curl -X GET "http://localhost:3001/api/strategic/risk/high-risk" -H "X-DID: did:near:testuser.testnet"`
3. Returns: `{"error":"relation \"risk_assessments\" does not exist"}`

### UAT-002: workflow_states table not auto-created

**Discovered:** 2026-01-19
**Phase/Plan:** 04-06
**Severity:** Blocker
**Feature:** Workflow Status API
**Description:** GET /api/strategic/objectives/:id/workflow returns database error: "relation \"workflow_states\" does not exist"
**Expected:** Table should be lazily initialized on first request
**Actual:** Table does not exist, causing 500 error
**Repro:**
1. Start backend server
2. Run: `curl -X GET "http://localhost:3001/api/strategic/objectives/test-id/workflow" -H "X-DID: did:near:testuser.testnet"`
3. Returns: `{"error":"relation \"workflow_states\" does not exist"}`

## Resolved Issues

[None yet]

---

*Phase: 04-strategic-planning-module*
*Plan: 06*
*Tested: 2026-01-19*
