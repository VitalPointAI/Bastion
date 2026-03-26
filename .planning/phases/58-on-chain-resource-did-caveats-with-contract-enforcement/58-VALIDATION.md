---
phase: 58
slug: on-chain-resource-did-caveats-with-contract-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 58 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Rust built-in tests (`#[cfg(test)]` + `near-sdk::test_utils`) |
| **Config file** | No separate config — `cargo test` within `contracts/did-registry/` |
| **Quick run command** | `cd contracts/did-registry && cargo test 2>&1` |
| **Full suite command** | `cd contracts/did-registry && cargo test -- --nocapture 2>&1` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd contracts/did-registry && cargo test 2>&1`
- **After every plan wave:** Run `cd contracts/did-registry && cargo test -- --nocapture 2>&1`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 58-01-01 | 01 | 1 | REQ-58-01 | unit | `cd contracts/did-registry && cargo test test_check_employment_no_caveats` | ❌ W0 | ⬜ pending |
| 58-01-02 | 01 | 1 | REQ-58-01 | unit | `cd contracts/did-registry && cargo test test_check_employment_roe_tier_exceeded` | ❌ W0 | ⬜ pending |
| 58-01-03 | 01 | 1 | REQ-58-01 | unit | `cd contracts/did-registry && cargo test test_check_employment_time_window` | ❌ W0 | ⬜ pending |
| 58-01-04 | 01 | 1 | REQ-58-01 | unit | `cd contracts/did-registry && cargo test test_check_employment_releasability` | ❌ W0 | ⬜ pending |
| 58-02-01 | 02 | 1 | REQ-58-02 | unit | `cd contracts/did-registry && cargo test test_update_caveats_unauthorized` | ❌ W0 | ⬜ pending |
| 58-02-02 | 02 | 1 | REQ-58-02 | unit | `cd contracts/did-registry && cargo test test_update_caveats_admin` | ❌ W0 | ⬜ pending |
| 58-03-01 | 03 | 1 | REQ-58-03 | unit | `cd contracts/did-registry && cargo test test_store_and_retrieve_caveats` | ❌ W0 | ⬜ pending |
| 58-03-02 | 03 | 1 | REQ-58-03 | unit | `cd contracts/did-registry && cargo test test_existing_did_unaffected` | ❌ W0 | ⬜ pending |
| 58-04-01 | 04 | 2 | REQ-58-04 | manual | Visual inspection in browser | N/A | ⬜ pending |
| 58-05-01 | 05 | 3 | REQ-58-05 | smoke | `near contract call-function as-read-only did-registry.testnet get_caveats ...` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `contracts/did-registry/src/lib.rs` tests — add `test_check_employment_*`, `test_update_caveats_*`, `test_store_and_retrieve_caveats`, `test_existing_did_unaffected` to the existing `#[cfg(test)]` block
- [ ] Smoke test script: `scripts/test-caveat-enforcement.sh` — calls `check_employment_authorized` via RPC against testnet

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ResourceDetailPanel renders Security & Caveats section | REQ-58-04 | UI visual component, no headless test infra | Open ResourceDetailPanel for a resource with caveats, verify section renders with correct fields and permission gating |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
