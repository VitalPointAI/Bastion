---
phase: 59
slug: briefing-deck-slide-and-image-specs
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-26
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual review (content/documentation phase — no automated test framework) |
| **Config file** | none |
| **Quick run command** | `ls .planning/phases/59-briefing-deck-slide-and-image-specs/` |
| **Full suite command** | `wc -l docs/briefing/slide-specs.md docs/whitepaper/*.md 2>/dev/null` |
| **Estimated runtime** | ~1 second |

---

## Sampling Rate

- **After every task commit:** Verify file exists and has expected sections
- **After every plan wave:** Review deliverable completeness checklist
- **Before `/gsd:verify-work`:** All manual checks in table below must pass
- **Max feedback latency:** Immediate (file existence checks)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 59-01-01 | 01 | 1 | Slide specs | manual | `test -f docs/briefing/slide-specs.md` | ⬜ | ⬜ pending |
| 59-01-02 | 01 | 1 | Image prompts | manual | `grep -c "## Image Prompt" docs/briefing/slide-specs.md` | ⬜ | ⬜ pending |
| 59-01-03 | 01 | 1 | Demo cues | manual | `grep -c "DEMO CUE" docs/briefing/slide-specs.md` | ⬜ | ⬜ pending |
| 59-01-04 | 01 | 1 | Speaking scripts | manual | `grep -c "## Speaking Script" docs/briefing/slide-specs.md` | ⬜ | ⬜ pending |
| 59-02-01 | 02 | 2 | Whitepaper update | manual | `test -f docs/whitepaper/ASSEMBLY.md` | ⬜ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements. This is a content generation phase — no test framework installation needed.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Slide count 20-25 core | Content completeness | Creative content review | Count slides in spec, verify 20-25 range |
| Annex count 15-20 | Content completeness | Creative content review | Count annex slides, verify 15-20 range |
| Visual glossary in annex | CONTEXT.md decision | Content presence check | Verify glossary slide exists in annex section |
| 9 required topics covered | CONTEXT.md decision | Semantic content review | Cross-reference each topic against slide specs |
| Image prompts complete | CONTEXT.md decision | Quality review | Verify prompts include composition, palette, style, aspect ratio, mood |
| Demo cue on every slide | CONTEXT.md decision | Completeness check | Verify each slide has DEMO CUE or "no cue" |
| Word-for-word speaking script | CONTEXT.md decision | Content quality | Verify each slide has full scripted narrative |
| Phase 55-58 content present | Research finding | Content coverage | Verify Ironclaw, visual editor, memory, DID caveats represented |
| Chicago 18th footnotes | CONTEXT.md decision | Format review | Verify whitepaper uses footnote citation style |
| Whitepaper docx/pdf | CONTEXT.md decision | Build verification | Run pandoc, verify outputs |

---

## Validation Sign-Off

- [x] All tasks have manual verify or Wave 0 dependencies
- [x] Sampling continuity: file existence checks after each commit
- [x] Wave 0 covers all MISSING references (none needed)
- [x] No watch-mode flags
- [x] Feedback latency < 2s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
