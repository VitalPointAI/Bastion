# Five-Tier Authority Model

BASTION enforces a five-tier authority model that governs the degree of AI autonomy for every action in the system. The model is enforced at the smart contract level -- it cannot be bypassed by application code.

## Authority Tiers

| Tier | AI Role | Human Role |
|---|---|---|
| **AI_AUTONOMOUS** | AI executes independently | Human monitors via audit log |
| **AI_PRIMARY** | AI executes with human notification | Human can intervene post-execution |
| **HYBRID_AI_LED** | AI recommends, human approves | Human reviews before execution |
| **HYBRID_HUMAN_LED** | Human decides, AI advises | AI provides analysis on request |
| **HUMAN_ONLY** | AI excluded from execution | Human performs all actions |

## Permanently Human-Only Categories

Three activity categories are **permanently locked to HUMAN_ONLY** and cannot be elevated to any AI tier:

1. **AUTHORITY_DECISION** -- Command authority decisions (e.g., mission approval, strike authorization)
2. **ETHICAL_LEGAL** -- Legal and ethical judgments (e.g., ROE determinations, law of armed conflict compliance)
3. **RISK_JUDGMENT** -- Risk acceptance decisions (e.g., acceptable collateral damage thresholds, force protection trade-offs)

## Safety Matrix

The safety matrix maps 65 MDMP activities across 22 categories to their permitted authority levels. This matrix is enforced at the smart contract level:

- Each activity has a **maximum** authority tier it can reach
- Tier escalation requires a governance proposal and vote
- Tier de-escalation (toward more human control) can be done unilaterally by the commander
- The three permanently human-only categories are immutable in the contract

## Governance Gates

**18 governance gates** span the 9 MDMP phases, creating mandatory checkpoints:

| MDMP Phase | Gates |
|---|---|
| Receipt of Mission | Mission analysis initiation |
| Mission Analysis | IPB approval, specified/implied tasks, assumptions |
| COA Development | COA criteria, COA statements |
| COA Analysis (Wargaming) | Wargame design, wargame results |
| COA Comparison | Comparison criteria, ranking |
| COA Approval | Commander's COA selection |
| Orders Production | OPORD draft, annex review |
| Rehearsal | Rehearsal plan, rehearsal results |
| Execution & Assessment | Execution authorization, assessment criteria |

Each gate requires the appropriate authority tier -- gates in AUTHORITY_DECISION categories always require HUMAN_ONLY approval.

## Nine Governance Invariants

These invariants hold at all times and are enforced programmatically:

1. **Human supremacy** -- A human can always override or halt any AI action
2. **Minimum human control** -- AUTHORITY_DECISION, ETHICAL_LEGAL, and RISK_JUDGMENT categories never delegate below HUMAN_ONLY
3. **Audit completeness** -- Every action, AI or human, produces an immutable audit record
4. **Authority monotonicity** -- An agent cannot grant itself higher authority than it currently holds
5. **Tier ceiling enforcement** -- No activity can exceed its maximum permitted authority tier
6. **Transparent attribution** -- Every output is attributed to its source (human or agent DID)
7. **Checkpoint integrity** -- Human-in-the-loop checkpoints cannot be skipped or auto-approved
8. **Graceful degradation** -- If AI systems fail, all activities revert to HUMAN_ONLY
9. **Coalition consistency** -- Authority tiers in coalition operations default to the most restrictive participant's policy

## FullyDelegated Variant

The **FullyDelegated** authority variant (equivalent to AI_AUTONOMOUS) is restricted to exactly four deterministic activity categories:

1. **Data formatting** -- Transforming data between structured formats
2. **Template population** -- Filling doctrinal templates with validated data
3. **Status aggregation** -- Compiling status reports from existing data sources
4. **Log maintenance** -- Maintaining and archiving operational logs

These categories involve no judgment, interpretation, or decision-making -- they are purely mechanical transformations where AI autonomy introduces no risk.
