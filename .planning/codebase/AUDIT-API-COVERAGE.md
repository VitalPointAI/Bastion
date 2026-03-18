# API Route Coverage Audit

**Date:** 2026-03-18

---

## Section 1: Broken Frontend → Backend References

### 1. Contradiction endpoint does not exist
- **Frontend:** `frontend/src/components/assess/OperationalAssess.tsx:154` calls `GET /api/graph/contradictions?workspaceId=...`
- **Backend:** Route does not exist. Contradiction detector is backend-only code with no REST endpoint.
- **Fix:** Create `GET /api/graph/contradictions` route or remove the frontend call.

### 2. OSINT relevant events endpoint mismatch
- **Frontend:** `frontend/src/lib/osint-service.ts:144` calls `GET /api/osint/events/relevant`
- **Backend:** Route does not exist. Nearest equivalent is `GET /api/graph/osint/events` (different prefix, no `/relevant` filter).
- **Fix:** Align frontend call to actual backend route or create the missing endpoint.

### 3. Admin agent model config path mismatch
- **Frontend:** `frontend/src/lib/admin-service.ts:317,334,345` calls `GET/PUT/DELETE /api/admin/config/agents/:id/model`
- **Backend:** Actual route is `GET/PUT/DELETE /api/admin/agents/:id/model-config` (different path: missing `config/` prefix, different suffix).
- **Fix:** Update frontend service to match actual backend route paths.

---

## Section 2: Backend Routes With No Frontend Callers (Dead API Surface)

~460 of ~620 routes have no frontend callers. Major groups:

| Router | Total Routes | Frontend Callers | Status |
|--------|-------------|-----------------|--------|
| `/api/dao` | 16 | 0 | Entirely uncalled |
| `/api/planning` | 29 | 0 | Entirely uncalled |
| `/api/mdmp` | 13 | 0 | Entirely uncalled |
| `/api/credentials` | 9 | 0 | Entirely uncalled |
| `/api/messages` | ~8 | 0 | Backend-internal only |
| `/api/orchestration` | ~12 | 0 | Backend-internal only |
| `/api/strategic` | ~55 | ~5 | 90% uncalled |
| `/api/graph` | ~32 | ~5 | 85% uncalled |
| `/api/exercise` | ~40 | ~15 | 60% uncalled |
| `/api/admin` | ~35 | ~10 | 70% uncalled |
| `/api/resources` | ~20 | ~3 | 85% uncalled |
| `/api/robot-routes` | ~15 | ~5 | 65% uncalled (some Ironclaw-internal) |

### Notes
- Some "uncalled" routes may be used by:
  - Ironclaw agent system (backend-to-backend calls)
  - Robot bridge (Docker container calls)
  - Seed scripts or migration tools
  - External webhook sources (OSINT feeds)
- Routes should be verified against these callers before deletion

---

## Section 3: Summary Stats

| Metric | Count |
|--------|-------|
| Total backend routes (approx) | ~620 |
| Routes with frontend callers | ~160 |
| Routes with no frontend callers | ~460 |
| Broken frontend references | 3 |
| Coverage rate | ~26% |

---

## Recommendations

1. **Fix 3 broken references immediately** — these cause runtime errors
2. **Audit "uncalled" routes against non-frontend callers** (Ironclaw, robot bridge, seeds) before removing
3. **Tag routes by consumer** (`@frontend`, `@ironclaw`, `@robot`, `@webhook`, `@internal`) to make future audits easier
4. **Consider removing entire routers** that have zero callers from any source (dao, credentials, planning if truly unused)

*Audit: 2026-03-18*
