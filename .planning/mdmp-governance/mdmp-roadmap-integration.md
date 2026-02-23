# MDMP Governance - Bastion Roadmap Integration

## Overview

This document specifies how the MDMP governance data model integrates into
Bastion's existing roadmap. It covers:

1. New agents required (12)
2. New smart contract modules (3)
3. New roadmap phases (3)
4. Existing phase enhancements (6)
5. Dependency-ordered implementation sequence

---

## 1. New AI Agents (12)

Each agent maps to an `AgentRole` in `mdmp-types.ts` and is registered
via `AgentManifest` in `backend/src/agents/types.ts`.

### Priority 1 — Core MDMP Enablers (Build First)

| Agent | Role | Phase | Purpose | Dependencies |
|-------|------|-------|---------|-------------|
| Assumption Auditor | `ASSUMPTION_AUDITOR` | Support | Surface hidden assumptions; track validity; sensitivity analysis | RAFT Extraction, Assumption Registry contract |
| Orders Validator | `ORDERS_VALIDATOR` | Support | Validate order format, consistency, traceability to intent; degraded execution sim | RAFT Extraction |
| Uncertainty Quantifier | `UNCERTAINTY_QUANTIFIER` | Support | Calibrated confidence intervals; false precision detection | COA Comparator |

### Priority 2 — Adversary & Effects Modeling

| Agent | Role | Phase | Purpose | Dependencies |
|-------|------|-------|---------|-------------|
| Adversary Modeler | `ADVERSARY_MODELER` | Support | Synthesize adversary capability models; generate adversary COAs | Strategic Fusion, OSINT Monitor |
| Effect Cascader | `EFFECT_CASCADER` | Support | Map second/third-order effects across domains | COA Generator |
| Escalation Modeler | `ESCALATION_MODELER` | Support | Model escalation dynamics using multiple theoretical frameworks | Red Team Simulator, Adversary Modeler |
| Deception Detector | `DECEPTION_DETECTOR` | Support | Identify inconsistencies between adversary intent and behavior | Adversary Modeler |

### Priority 3 — Problem Framing & Compliance

| Agent | Role | Phase | Purpose | Dependencies |
|-------|------|-------|---------|-------------|
| Problem Framing | `PROBLEM_FRAMING` | Support | Generate alternative problem framings from multiple perspectives | RAFT Reasoning |
| ROE Compliance | `ROE_COMPLIANCE` | Support | Parse ROE; map authorities to tasks; validate compliance | RAFT Extraction |
| Data Bias Detector | `DATA_BIAS_DETECTOR` | Support | Statistical bias detection, coverage gaps, staleness tracking | Strategic Fusion |

### Priority 4 — Coalition & Narrative

| Agent | Role | Phase | Purpose | Dependencies |
|-------|------|-------|---------|-------------|
| Coalition Health | `COALITION_HEALTH` | Support | Monitor coalition cohesion; track partner posture changes | OSINT Monitor, Linkages contract |
| Narrative Impact | `NARRATIVE_IMPACT` | Support | Model information operation impact across audience segments | Strategic Fusion |

---

## 2. New Smart Contract Modules (3)

All additive to existing `near-contracts/src/dao/`. Specified in `mdmp-contracts.rs`.

### 2.1 `near-contracts/src/mdmp/types.rs`

- `MDMPPhase` enum (9 phases)
- `ActivityCategory` enum (22 categories) with safety methods
- New `AutonomyLevel::FullyDelegated` variant (extends existing)
- 5 new `ProposalKind` variants (extends existing)

### 2.2 `near-contracts/src/mdmp/assumptions.rs`

- `AssumptionRegistry` contract
- `AssumptionRecord` with full lifecycle (Pending -> Accepted -> Invalidated/Expired)
- `SensitivityLevel` (Low/Medium/High/Critical)
- INVARIANT 3: Assumption accountability enforcement
- INVARIANT 6: Critical assumption invalidation triggers replanning

### 2.3 `near-contracts/src/mdmp/workflow.rs`

- `MDMPWorkflow` contract
- Phase progression enforcement (INVARIANT 2)
- Gate registration and satisfaction tracking
- Phase transition audit trail
- Red team completeness enforcement (INVARIANT 4)
- Safety matrix validation (INVARIANTS 8, 9)

### 2.4 Extensions to Existing Contracts

| File | Change | Backward Compatible |
|------|--------|-------------------|
| `dao/types.rs` | Add `FullyDelegated` to `AutonomyLevel`; add 5 `ProposalKind` variants | Yes - additive only |
| `dao/execution.rs` | Add `FullyDelegated` execution flow | Yes - new match arm |
| `dao/voting.rs` | Add vote policies for 5 new `ProposalKind` variants | Yes - new match arms |
| `dao/roles.rs` | No changes needed | N/A |
| `dao/linkages.rs` | Add coalition gate mechanism | Yes - additive |

---

## 3. New Roadmap Phases (3)

### Phase 5.1: MDMP Governance Integration

**Goal**: Core MDMP workflow engine with phase progression, assumption tracking,
and safety matrix enforcement.

**Deliverables**:
- `near-contracts/src/mdmp/` module (types, assumptions, workflow, safety)
- 3 Priority 1 agents (Assumption Auditor, Orders Validator, Uncertainty Quantifier)
- Governance gate UI components
- Assumption tracking panel
- Phase transition workflow in frontend

**Dependencies**: Phase 3 (Intelligence), Phase 4.2 (RAFT), Phase 5 (DAO Governance)

**Estimated Activities Enabled**: 40+ across all MDMP phases

### Phase 5.2: Escalation & Competition Modeling

**Goal**: Adversary modeling, escalation dynamics, and effect cascading capabilities.

**Deliverables**:
- 4 Priority 2 agents (Adversary Modeler, Effect Cascader, Escalation Modeler, Deception Detector)
- Escalation ladder visualization
- Effect chain visualization
- Integration with wargaming framework

**Dependencies**: Phase 4.3 (COA Analysis), Phase 5.1 (MDMP Governance)

**Estimated Activities Enabled**: 15+ (primarily Phases 2-4)

### Phase 12.1: Coalition Health Monitoring

**Goal**: Real-time coalition partner health monitoring, national caveat tracking,
and coalition gate enforcement.

**Deliverables**:
- 2 Priority 4 agents (Coalition Health, Narrative Impact)
- Coalition health dashboard
- National caveat tracking in linkages contract
- Coalition gate mechanism

**Dependencies**: Phase 9 (Coalition Linkages), Phase 5.1 (MDMP Governance)

**Estimated Activities Enabled**: 8+ (primarily Phase 0, 2, 5)

---

## 4. Existing Phase Enhancements (6)

### Phase 3: Intelligence Framework

**Enhancements**:
- Add MASINT/GEOINT connector pipelines (MDMP-0-01)
- Add IPB analysis templates to fusion agent (MDMP-2-03)
- Add force ratio analysis module (MDMP-2-06)
- Add assessment tracking module (MDMP-8-01)
- Add assessment-to-monitoring feedback loop (MDMP-8-03)
- Add COP schema normalization (MDMP-0-03)

### Phase 4.2: RAFT Pipeline

**Enhancements**:
- Add task/constraint extraction templates (MDMP-1-02)
- Add METL derivation (MDMP-2-04)
- Add CCIR generation templates (MDMP-2-07)
- Add intent analysis templates (MDMP-2-01)
- Add mission statement generation (MDMP-2-10)
- Add OPORD generation templates (MDMP-7-01)
- Add wargame output extraction (MDMP-4-04)

### Phase 4.3: COA Analysis

**Enhancements**:
- Add multi-domain COA templates (MDMP-3-01)
- Add COA sketch generation (MDMP-3-03)
- Add branch/sequel planning (MDMP-3-06)
- Expand red team simulator to full wargaming (MDMP-4-01)
- Add sensitivity analysis to COA comparator (MDMP-5-02)
- Add uncertainty quantification to recommendations (MDMP-5-04)
- Add decision brief generation (MDMP-6-01)
- Add deviation detection (MDMP-8-02)
- Add sustainment modeling/comparison (MDMP-3-07, 5-03)

### Phase 5: DAO Governance

**Enhancements**:
- Add `FullyDelegated` autonomy level
- Add 5 new `ProposalKind` variants
- Add Commander Guidance UI component (MDMP-1-05)
- Integrate MDMP workflow gates with proposal system

### Phase 9: Coalition Linkages

**Enhancements**:
- Add national caveat tracking (MDMP-2-14)
- Add coalition gate mechanism (MDMP-5-06)

---

## 5. Implementation Sequence

Dependency-ordered, grouped into waves.

### Wave 1: Foundation (can start immediately)

1. **Extend `dao/types.rs`** — Add `FullyDelegated` to `AutonomyLevel`, add 5 `ProposalKind` variants
2. **Create `mdmp/types.rs`** — `MDMPPhase`, `ActivityCategory` enums
3. **Create `mdmp/assumptions.rs`** — Assumption Registry contract
4. **Create `mdmp/workflow.rs`** — MDMP Workflow Engine
5. **Create `mdmp/safety.rs`** — Safety matrix validation

### Wave 2: Priority 1 Agents (after Wave 1)

6. **Assumption Auditor agent** — Depends on Assumption Registry contract
7. **Orders Validator agent** — Independent of contracts
8. **Uncertainty Quantifier agent** — Independent of contracts
9. **Data Bias Detector agent** — Independent of contracts

### Wave 3: Adversary & Effects (after Wave 2)

10. **Adversary Modeler agent** — Depends on Strategic Fusion
11. **Effect Cascader agent** — Depends on COA Generator
12. **Escalation Modeler agent** — Depends on Red Team Simulator + Adversary Modeler
13. **Deception Detector agent** — Depends on Adversary Modeler

### Wave 4: Problem Framing & Compliance (parallel with Wave 3)

14. **Problem Framing agent** — Depends on RAFT Reasoning
15. **ROE Compliance agent** — Depends on RAFT Extraction

### Wave 5: Coalition & Narrative (after Wave 3)

16. **Coalition Health agent** — Depends on OSINT Monitor + Linkages contract
17. **Narrative Impact agent** — Depends on Strategic Fusion
18. **Coalition gate mechanism** — Extend `dao/linkages.rs`

### Wave 6: Frontend Integration (parallel with Waves 3-5)

19. **Commander Guidance UI** — ProposalKind form
20. **Assumption tracking panel** — CRUD + approval workflow
21. **Governance gate dashboard** — Phase progression visualization
22. **Escalation ladder visualization** — Effect/escalation models
23. **Coalition health dashboard** — Partner status monitoring

### Wave 7: RAFT Pipeline Enhancement (after Wave 2)

24. **MDMP-specific RAFT templates** — Task extraction, CCIR, mission statement, OPORD
25. **IPB analysis templates** — Weather, terrain, civil considerations
26. **Wargame output extraction** — Decision points, HPTs, IRs

---

## 6. Human Control Preservation Matrix

Critical invariants that MUST be preserved through all implementation:

| Invariant | What It Protects | How It Is Enforced |
|-----------|-----------------|-------------------|
| STRIKE_AUTHORIZATION | Lethal force decisions always human | `ProposalKind::requires_human_in_loop()` always true |
| AUTHORITY_DECISION category | Command authority never delegated to AI | Safety matrix: max = HUMAN_ONLY, min = HUMAN_ONLY |
| ETHICAL_LEGAL category | Moral/legal judgment always human | Safety matrix: max = HUMAN_ONLY, min = HUMAN_ONLY |
| RISK_JUDGMENT category | Risk acceptance always human | Safety matrix: max = HUMAN_ONLY, min = HUMAN_ONLY |
| INTENT_ASSESSMENT category | Adversary intent judgment human-led minimum | Safety matrix: min = HYBRID_HUMAN_LED |
| Phase transitions | Always require DAO vote with human approval | `PhaseTransition::requires_human_in_loop()` = true |
| Assumption acceptance | Always require explicit human acceptance | `AssumptionAcceptance::requires_human_in_loop()` = true |
| Commander guidance | Always recorded by human only | `CommanderGuidance::requires_human_in_loop()` = true |
| FullyDelegated scope | Limited to 4 deterministic categories | `ActivityCategory::permits_fully_delegated()` enforcement |

---

## 7. Testing Strategy

### Smart Contract Tests

- Safety matrix boundary tests (already specified in `mdmp-contracts.rs`)
- Phase progression invariant tests
- Assumption lifecycle tests
- FullyDelegated scope restriction tests
- Backward compatibility tests (all existing tests must pass)

### Agent Integration Tests

- Each new agent: input/output schema validation
- Confidence interval presence enforcement (INVARIANT 5)
- Human checkpoint triggering at correct thresholds
- Cross-agent workflow tests (e.g., Assumption Auditor -> Assumption Registry)

### End-to-End Tests

- Full MDMP workflow: Phase 1 through Phase 8
- Phase transition gate enforcement
- Red team challenge completeness enforcement
- Assumption invalidation -> replanning trigger
- Coalition gate multi-party approval
- DDIL bypass condition handling

---

## 8. Migration Notes

### For Existing Deployments

- `AutonomyLevel::FullyDelegated` is added as a new variant. Existing contracts
  using `Autonomous`, `SemiAutonomous`, `NotAutonomous` are unaffected.
- New `ProposalKind` variants are additive. Existing proposals are unchanged.
- MDMP module (`mdmp/`) is entirely new. No existing data structures are modified.
- Default role permissions in `dao/roles.rs` remain unchanged. New MDMP-specific
  roles can be added via `ConfigChange` proposals.

### Data Migration

- None required. MDMP workflow state is new and created per-mission.
- Assumption Registry is new and populated during planning.
- No existing blockchain data is modified.
