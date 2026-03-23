---
phase: 54
slug: update-research-whitepaper-and-docs-for-demo-briefing
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 54 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual review + shell scripts (documentation phase) |
| **Config file** | none — docs validation via grep/diff/word-count |
| **Quick run command** | `ls docs/whitepaper/*.md | wc -l && wc -w docs/whitepaper/*.md` |
| **Full suite command** | `bash -lc 'grep -r "CITATION NEEDED" docs/whitepaper/ && grep -r "TODO" docs/whitepaper/ docs/site/ docs/briefing/'` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command (file count + word count)
- **After every plan wave:** Run full suite command (check for unresolved markers)
- **Before `/gsd:verify-work`:** Full suite must show only intentional [CITATION NEEDED] markers
- **Max feedback latency:** 2 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 54-01-01 | 01 | 1 | Whitepaper v0.2 sections | content review | `diff docs/whitepaper/ (git show HEAD~1)` | N/A | pending |
| 54-02-01 | 02 | 1 | Demo briefing materials | content review | `ls docs/briefing/` | N/A | pending |
| 54-03-01 | 03 | 2 | Docs site refresh | link/ref check | `grep -r "Direct tab" docs/site/` | N/A | pending |
| 54-04-01 | 04 | 3 | Docx export | file exists | `ls docs/whitepaper/*.docx` | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] Verify current agent count via codebase grep
- [ ] Verify current REST endpoint count
- [ ] Verify docs site navigation structure

*These fact-checks must complete before writing begins.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Whitepaper technical accuracy | All capability claims | Content requires domain review | Read each new subsection, verify claims match implemented code |
| Demo script timing | 30-min target | Requires read-through estimation | Time each act section, verify total ~30 min |
| Briefing standalone readability | Executive summary quality | Subjective assessment | Read briefing without demo context, assess comprehension |
| Docx formatting fidelity | Editable output | Visual inspection | Open docx, verify headings/tables/formatting preserved |

---

## Validation Sign-Off

- [ ] All tasks have verify criteria or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without verification
- [ ] Wave 0 covers all fact-check requirements
- [ ] No unresolved TODOs except intentional [CITATION NEEDED] markers
- [ ] Feedback latency < 2s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
