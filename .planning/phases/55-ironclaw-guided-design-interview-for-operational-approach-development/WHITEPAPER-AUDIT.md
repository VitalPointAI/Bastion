# BASTION Whitepaper & Documentation Audit Report

**Audit Date:** 2026-03-24
**Codebase State:** Phase 55 in progress (6 plans complete), 52 completed phases, 71 total phases
**Documentation Scope:** All files in `docs/whitepaper/`, `docs/site/`, `docs/briefing/`, and `docs/deployment/`

---

## Executive Summary

The whitepaper and documentation are substantially accurate in their description of BASTION's architecture and capabilities. However, there are significant internal inconsistencies in metrics (agent counts, phase counts, plan counts), terminology drift (the five-tier authority model is described differently across documents), several features described as implemented that remain partially complete, and the "workspace" to "problem set" rename is incomplete in documentation and code alike. The most critical issue is that the Abstract, Results, and Conclusion all claim "131 AI agents" with "31 specialized + 102 JPP staff," while the SITREP (Appendix A) -- which should be the most accurate -- says "19 specialized, 31 JPP staff roles, 50+ total registered." These cannot both be correct.

---

## Critical Issues (Priority Order)

### 1. Agent Count Inconsistency (HIGH)

| Document | Specialized | JPP Staff | Total |
|----------|------------|-----------|-------|
| Abstract / Results / Conclusion | 31 | 102 | 131 |
| Site docs index.md | 19 | 31 | 50 |
| SITREP (Appendix A) | 19 | 31 | 50+ |
| Agent catalog header | -- | -- | 131 |

The SITREP and site docs index appear most accurate (19+31=50). The whitepaper body likely counts role definitions (102 JPP billets listed in the agent catalog) rather than active running agents. Standardize on one counting methodology.

### 2. Swarm Formation Names Inconsistent (MEDIUM)

| Source | Sixth Formation |
|--------|----------------|
| Introduction (1.7) | staggered column |
| Methodology (3.16) | staggered column (lists 7, says 6) |
| Results (4.4) | diamond |
| Code (`backend/src/robot/robot-types.ts` L395-402) | vee |

The code defines: line, wedge, column, echelon_left, echelon_right, vee. No staggered column or diamond exists.

### 3. Five-Tier Authority Model Naming Conflict (MEDIUM)

Three different naming schemes appear across documents:
- **Methodology 3.5 / authority-model.md / Code**: AI_AUTONOMOUS, AI_PRIMARY, HYBRID_AI_LED, HYBRID_HUMAN_LED, HUMAN_ONLY
- **Discussion 5.4.7**: AI_AUTONOMOUS, AI_PRIMARY, HUMAN_PRIMARY, HUMAN_ONLY, COALITION_UNANIMOUS
- **Site docs index.md**: Commander, Deputy, Staff section, Coalition partner, Full coalition vote

The last is a completely different concept (command echelon authority) conflated with the AI autonomy tiers.

### 4. Metrics Drift (MEDIUM)

| Metric | Whitepaper Body | SITREP | STATE.md |
|--------|----------------|--------|----------|
| Total phases | 70 | 70 | 71 |
| Completed phases | 53 | 50 | 52 |
| Total plans | -- | 441+ | 455 |
| Smart contracts | 12 | 14 | -- |
| REST endpoints | ~500 | ~572 | -- |

### 5. JSON-LD Maturity Overstated (MEDIUM)

Methodology (3.15) describes JSON-LD as the brain's storage format, but Phase 47 ("JSON-LD Semantic Brain") is "Not Started." A migration script exists (`backend/src/graph/migration/migrate-to-jsonld.ts`) and JSON-LD `@context` is used in graph code, but full integration is incomplete.

### 6. "Workspace" vs "Problem Set" Terminology (LOW-MEDIUM)

Phase 23 is "Not Started" but codebase has largely migrated: 2342 frontend + 2667 backend "problem set" refs vs 106 + 694 "workspace" refs. Whitepaper methodology (3.2) still uses "Workspace Creation."

### 7. IPFS Discrepancy (LOW)

Site architecture docs list IPFS as a storage tier. Code confirms it exists (`backend/src/lib/ipfs.ts`). Whitepaper methodology and discussion omit it entirely.

### 8. Privy Legacy (LOW)

REST API docs still reference Privy endpoints (`POST /create -- Privy + NEAR`, `GET /:privyUserId`). Code retains Privy files in `backend/src/auth/mpc-account.ts` and `backend/src/lib/mpc-accounts.ts`. Privy was replaced by `@vitalpoint/near-phantom-auth` in Phase 18.

### 9. Missing Recent Capabilities (LOW)

Phases 54-55 features not documented anywhere:
- Ironclaw guided design interview for operational approach development
- Proactive intelligence gap filling via web search
- AI context snapshot from current view + dynamic actor filter
- STRATENV synthesis button
- Strategic end-state synthesis + KG context in design interview
- Design skills (overlay-producer, resource-allocator, campaign-visualizer, risk-visualizer)
- Yjs multi-user collaborative interview with role-directed question indicators

### 10. Jetson TOPS Inconsistency (LOW)

Background (2.4.1) says 40 TOPS (Orin Nano). Results (4.4) says 67 TOPS (Orin Nano Super). Different hardware variants.

### 11. Robot Vision Code Not in Repository (LOW)

Methodology (3.14) describes CSI camera + detectNet pipeline. The `edge-device/src/lib/` directory contains only `local-db.ts`. Jetson-side vision code is presumably deployed separately but whitepaper implies it is part of the BASTION codebase.

### 12. Data Model Doc Says "Planned" for Implemented Features (LOW)

`docs/site/docs/architecture/data-model.md` says echelon-aware inheritance is "planned" but Phases 34-38 implemented echelon routing, inheritance deepening, and FRAGO propagation.

---

## Accurate Items (Confirmed Against Code)

- Six doctrinal tabs: Understand, Design, Plan, Decide, COP, Assess (all present in `frontend/src/components/tabs/`)
- Three-tier DAO structure (Strategic/Operational/Tactical)
- NEAR Protocol blockchain integration
- PostgreSQL + Neo4j + NEAR hybrid storage
- WebAuthn passkeys with PRF extension (`@vitalpoint/near-phantom-auth`)
- Five-tier AI authority model in code (`backend/src/mdmp/types.ts` AuthorityDesignation enum)
- Three permanently locked HUMAN_ONLY categories (RiskJudgment, AuthorityDecision, EthicalLegal)
- 18 governance gates across 9 MDMP phases
- Docker bridge robot architecture with mDNS discovery
- Resource DID format `did:near:resource-{id}`
- Training/operational mode toggle with EXERCISE banner
- Pacific Strategy AY26 scenario with 6 phases
- Fork-and-merge design revision system
- LangGraph + LangChain orchestration
- Ironclaw AI chief-of-staff with 60s polling
- Hierarchical problem set inheritance
- Document intelligence pipeline with specialists
- RACI-filtered decision dashboard in Decide tab
