# DAO Governance

BASTION implements multi-DAO governance aligned to military command echelons, with a full proposal lifecycle, coalition support, and AI agent integration under strict safety constraints.

## Three-Tier DAO Structure

| Tier | Scope | Example |
|---|---|---|
| **Strategic** | Theater/national-level policy and guidance | INDOPACOM Strategy DAO |
| **Operational** | Campaign and major operation decisions | JTF Planning DAO |
| **Tactical** | Execution-level task approval | Battalion Ops DAO |

### Hierarchical Relationships

DAOs form parent-child hierarchies. Child DAOs inherit membership and policy from their parent, ensuring strategic guidance flows down while tactical feedback flows up. A Strategic DAO can spawn multiple Operational DAOs, each of which can spawn Tactical DAOs.

## Proposal Lifecycle

1. **Draft** -- Author creates proposal with required metadata
2. **Screen** -- AI proposal-screener checks completeness and policy compliance
3. **Context** -- AI context-analyzer enriches with operational context
4. **Feasibility** -- AI feasibility-assessor evaluates resource and risk factors
5. **Review** -- Human reviewers examine AI-enriched proposal
6. **Vote** -- Members vote under the configured voting scheme
7. **Execute / Reject** -- Approved proposals trigger execution; rejected proposals are archived with rationale

## Proposal Kinds

Beyond standard proposals, BASTION supports domain-specific types:

| Kind | Purpose |
|---|---|
| PhaseTransition | Advance the operation to the next phase |
| AssumptionAcceptance | Formally accept or reject a planning assumption |
| ProductApproval | Approve a planning product (e.g., OPORD annex) |
| RedTeamGate | Require red team review before proceeding |
| CommanderGuidance | Issue or update commander's guidance |
| StrikeAuthorization | Authorize kinetic or cyber strike -- **always human, 100% approval threshold** |

## Voting Engine

Each DAO configures one of three voting schemes:

- **Token-weighted** -- Votes proportional to governance token holdings
- **Role-weighted** -- Votes weighted by the voter's staff role and echelon
- **Equal** -- One member, one vote

The voting scheme is set at DAO creation and can be changed only by a governance proposal within the parent DAO.

## Coalition Proposals

Multi-party operations (Five Eyes, NATO, ad hoc coalitions) use coalition proposals that require approval from each participating DAO. A coalition proposal is not enacted until every designated party reaches its own approval threshold independently.

## Agent Integration

AI agents participate in DAO workflows under safety constraints:

- Agents **draft and enrich** proposals but cannot cast binding votes
- Agent recommendations are clearly labeled as AI-generated
- All agent outputs pass through human-in-the-loop checkpoints before affecting DAO state
- Agent DIDs provide verifiable attribution for every contribution
