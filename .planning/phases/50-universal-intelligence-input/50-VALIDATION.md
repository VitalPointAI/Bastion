---
phase: 50
slug: universal-intelligence-input
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-18
---

# Phase 50 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (frontend) / manual API testing (backend) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `cd frontend && npx vitest run --reporter=verbose` |
| **Full suite command** | `cd frontend && npx vitest run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run --reporter=verbose`
- **After every plan wave:** Run `cd frontend && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 50-01-01 | 01 | 1 | UNIV-15, UNIV-02 | unit | `vitest run backend/src/ingest/universal-classifier.test.ts` | ❌ W0 | ⬜ pending |
| 50-01-02 | 01 | 1 | UNIV-03 | unit | `vitest run backend/src/ingest/url-unfurler.test.ts` | ❌ W0 | ⬜ pending |
| 50-02-01 | 02 | 1 | UNIV-16, UNIV-04 | integration | `curl -X POST /api/ingest/submit` | N/A | ⬜ pending |
| 50-03-01 | 03 | 2 | UNIV-01, UNIV-14 | unit (DOM) | `vitest run src/components/brain/UniversalInputZone.test.tsx` | ❌ W0 | ⬜ pending |
| 50-03-02 | 03 | 2 | UNIV-09 | unit | `vitest run src/hooks/useUniversalIngest.test.ts` | ❌ W0 | ⬜ pending |
| 50-03-03 | 03 | 2 | UNIV-20 | unit (DOM) | `vitest run src/components/brain/UniversalInputZone.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/src/ingest/universal-classifier.test.ts` — stubs for UNIV-02 content-type detection
- [ ] `backend/src/ingest/url-unfurler.test.ts` — stubs for UNIV-03 RSS vs article disambiguation
- [ ] `frontend/src/hooks/useUniversalIngest.test.ts` — stubs for UNIV-09 SSE state machine
- [ ] `frontend/src/components/brain/UniversalInputZone.test.tsx` — stubs for UNIV-01, UNIV-14, UNIV-20

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Drag-and-drop file into input zone triggers ingestion | UNIV-01 | Browser DnD API requires real browser | Drop a PDF into the input zone, verify status appears |
| Ctrl+V paste triggers ingestion | UNIV-14 | Clipboard API requires real browser | Paste a URL, verify it's detected and classified |
| Mobile touch drag-and-drop | UNIV-19 | Touch events require real device | Test on mobile browser, verify drag-drop works |
| Smart suggestion chips appear for ambiguous input | UNIV-13 | Visual/interaction test | Paste ambiguous URL, verify chip options appear |
| Error retry button works | UNIV-10 | Requires intentional backend failure | Kill backend mid-process, verify retry button appears and works |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
