# Frontend Dead Code Audit

**Date:** 2026-03-18

---

## Orphaned Component Trees (~50 files)

### `frontend/src/components/mission/` — 24 files, entire tree orphaned
- Only referenced by a TODO comment in `MDMPPlanView.tsx`
- Contains: `MissionDetail.tsx`, `MissionTimeline.tsx`, `MissionMap.tsx`, command tree views, etc.
- **Recommendation:** DELETE entire directory. If mission views needed later, rebuild on current architecture.

### `frontend/src/components/planning/` — 17 files, entire tree orphaned
- Only reachable through orphaned `mission/MissionDetail.tsx` (itself dead)
- Contains: `PlanningDashboard.tsx`, `COAEditor.tsx`, `COAComparison.tsx`, `WargamingPanel.tsx`, etc.
- **Recommendation:** DELETE entire directory. Planning tab was restructured in Phase 24.

---

## Orphaned Single Components

| File | Why Dead | Recommendation |
|------|----------|---------------|
| `components/tabs/DoctrinalPlaceholder.tsx` | Replaced, zero imports | DELETE |
| `components/tabs/TrainingPackagesView.tsx` | Zero imports from outside | DELETE |
| `components/tabs/CreateScenarioPanel.tsx` | Zero imports from outside | DELETE |
| `components/tabs/TrainingDocPreview.tsx` | Zero imports from outside | DELETE |
| `components/cop/COPPerspectiveToggle.tsx` | Moved into `COPLayerControls`, zero imports | DELETE |
| `components/cop/LegalConsentDialog.tsx` | Zero imports | DELETE |
| `components/cop/EMSpectrumPanel.tsx` | Stale duplicate of `resources/network/EMSpectrumPanel.tsx` | DELETE |
| `components/cop/NetworkTopologyView.tsx` | Stale duplicate of `resources/network/NetworkTopologyView.tsx` | DELETE |
| `components/cop/NetworkTargetsPage.tsx` | Zero imports | DELETE |
| `components/inheritance/FRAGOReviewPanel.tsx` | Zero imports | DELETE |
| `components/problem-set/ObserverPanel.tsx` | Zero imports (has `_problemSetId` naming) | DELETE |
| `components/problem-set/SubscriptionManager.tsx` | Zero imports | DELETE |
| `components/problem-set/CompartmentManager.tsx` | Zero imports | DELETE |

---

## Replaced But Not Deleted

| File | Replaced By | Recommendation |
|------|------------|---------------|
| `components/brain/IngestionSidebar.tsx` | `IngestionDrawer.tsx` (Phase 50) | DELETE — remove from `brain/index.ts` barrel |

---

## Dead AI Staff Barrel Exports

| File | Why Dead | Recommendation |
|------|----------|---------------|
| `ai-staff/AIShowContributions.tsx` | No external consumers | DELETE |
| `ai-staff/InlineAnnotation.tsx` | Depends on dead `useInlineAnnotations.ts` | DELETE |
| `ai-staff/AgentRoutingConfig.ts` | Depends on dead `useAgentRouting.ts` | DELETE |

---

## Orphaned Lib Files

| File | Only Imported By | Recommendation |
|------|-----------------|---------------|
| `lib/yjs-hooks.ts` | `planning/COAEditor.tsx` (itself orphaned) | DELETE |
| `lib/types/command.ts` | `mission/` files (all orphaned) | DELETE |

---

## Summary

| Category | File Count | Lines (est.) |
|----------|-----------|-------------|
| Orphaned mission/ tree | 24 | ~3,000+ |
| Orphaned planning/ tree | 17 | ~2,500+ |
| Orphaned single components | 13 | ~1,500+ |
| Replaced not deleted | 1 | ~200 |
| Dead AI staff exports | 3 | ~300 |
| Orphaned lib files | 2 | ~150 |
| **Total** | **~60 files** | **~7,500+ lines** |

All files marked DELETE have zero live import references. Safe to remove without breaking any active functionality.

*Audit: 2026-03-18*
