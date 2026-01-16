# Phase 3: DAO Governance - Research

**Researched:** 2026-01-16
**Domain:** NEAR Protocol DAO smart contracts with military coalition governance
**Confidence:** HIGH

<research_summary>
## Summary

Researched the NEAR Protocol DAO ecosystem for implementing decentralized decision authority with multi-stakeholder voting, specifically adapted for military coalition governance with security classification integration.

The NEAR DAO ecosystem is mature with two primary frameworks: **SputnikDAO v2** (the production standard powering AstroDAO) and **Catalyst-DAO** (AssemblyScript-based with 11 proposal types from Moloch v2 heritage). SputnikDAO v2 is the recommended foundation due to its Rust implementation, active maintenance, comprehensive role-based permissions, and proven production use.

Key finding: The core SputnikDAO v2 architecture (proposals, voting, roles, policies) should be **extended rather than replaced** to add coalition governance features. Forking and modifying the existing codebase is safer than building from scratch. Critical military-specific additions needed: security clearance enforcement in role permissions, classification-based proposal visibility, coalition membership verification via ABAC integration.

**Primary recommendation:** Fork SputnikDAO v2 contracts as base, extend with BASTION's existing DID/credential infrastructure for coalition identity verification, implement classification-aware proposal routing, and add multi-party approval chains for high-consequence decisions.
</research_summary>

<standard_stack>
## Standard Stack

### Core (NEAR DAO Foundation)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| near-sdk-rs | 5.6+ | NEAR smart contract SDK | Official SDK, required for all NEAR contracts |
| sputnikdao2 | latest | DAO contract framework | Production-tested, powers AstroDAO, 17 proposal types |
| sputnikdao-factory2 | latest | DAO factory | Creates sub-account DAOs with standardized config |
| sputnik-staking | latest | Token delegation | Enables weighted voting with token staking |

### Supporting (Integration with BASTION)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| borsh | 1.5+ | Binary serialization | State storage, cross-contract calls |
| near-sdk collections | built-in | UnorderedMap, Vector, LookupMap | Efficient on-chain storage |
| @near-js/providers | 1.0+ | Frontend RPC | Proposal submission, voting from UI |

### Existing BASTION Components to Integrate
| Component | Location | Purpose |
|-----------|----------|---------|
| DIDRegistry | near-contracts/src/did_registry.rs | Identity verification for voting |
| CredentialRegistry | near-contracts/src/credential_registry.rs | Clearance verification |
| ABAC Core | backend/src/identity/abac-core.ts | Policy evaluation |
| IntentVerifier | near-contracts/src/intents.rs | Mission order authorization |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SputnikDAO v2 (Rust) | Catalyst-DAO (AssemblyScript) | AS has worse tooling, Rust preferred for security |
| Custom DAO | OpenZeppelin Governor | Governor is EVM-only, not NEAR compatible |
| Full fork | Contract extensions | Extensions cleaner but may miss edge cases |

**Installation:**
```bash
# Clone SputnikDAO contracts as starting point
git clone https://github.com/near-daos/sputnik-dao-contract
cd sputnik-dao-contract

# Add to project
cp -r sputnikdao2/src/* near-contracts/src/dao/
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
near-contracts/src/
├── lib.rs                    # Existing contract root
├── dao/                      # NEW: DAO governance module
│   ├── mod.rs               # DAO module exports
│   ├── proposal.rs          # Proposal types and lifecycle
│   ├── policy.rs            # Voting policies and thresholds
│   ├── roles.rs             # Role definitions with clearance integration
│   ├── voting.rs            # Vote counting and weight calculation
│   └── coalition.rs         # Multi-party coalition logic
├── did_registry.rs          # Existing: identity management
├── credential_registry.rs   # Existing: clearance verification
└── intents.rs               # Existing: mission authorization
```

### Pattern 1: SputnikDAO v2 Proposal Lifecycle
**What:** Standard proposal state machine with timeouts and thresholds
**When to use:** All governance decisions
**Example:**
```rust
// Source: sputnikdao2/src/proposals.rs
pub enum ProposalStatus {
    InProgress,    // Actively being voted on
    Approved,      // Quorum voted yes
    Rejected,      // Quorum voted no, bond returned
    Removed,       // Spam removal, bond forfeited
    Expired,       // Voting period elapsed
    Failed,        // Execution error
}

// Proposal creation with bond
pub fn add_proposal(&mut self, proposal: ProposalInput) -> u64 {
    // Validate attached deposit equals policy.proposal_bond
    require!(
        env::attached_deposit() >= self.policy.get().unwrap().proposal_bond,
        "ERR_MIN_BOND"
    );

    // Permission check via policy
    let sender = env::predecessor_account_id();
    require!(
        self.policy.get().unwrap().can_execute_action(
            &sender,
            &proposal.kind.to_policy_label(),
            &Action::AddProposal
        ),
        "ERR_PERMISSION_DENIED"
    );

    // Store proposal
    self.last_proposal_id += 1;
    self.proposals.insert(&self.last_proposal_id, &VersionedProposal::Latest(proposal));
    self.last_proposal_id
}
```

### Pattern 2: Role-Based Permission System
**What:** Hierarchical roles with wildcard permissions and clearance levels
**When to use:** Access control for proposal types and voting actions
**Example:**
```rust
// Source: sputnikdao2/src/policy.rs + BASTION extensions
pub struct Role {
    pub name: String,
    pub kind: RoleKind,                    // Everyone, Member(min_balance), Group(members)
    pub permissions: HashSet<String>,      // "transfer:VoteApprove", "*:*"
    pub vote_policy: HashMap<String, VotePolicy>,
    // BASTION extension: clearance requirement
    pub required_clearance: Option<Classification>,  // SECRET, TOPSECRET
}

// Permission matching with wildcards
fn is_permission_allowed(&self, permission: &str) -> bool {
    // Exact match: "Transfer:VoteApprove"
    // Proposal wildcard: "Transfer:*"
    // Action wildcard: "*:VoteApprove"
    // Universal: "*:*"
    self.permissions.contains(permission)
        || self.permissions.contains(&format!("{}:*", proposal_kind))
        || self.permissions.contains(&format!("*:{}", action))
        || self.permissions.contains("*:*")
}
```

### Pattern 3: Weighted Voting with Token Delegation
**What:** Vote weight proportional to staked tokens or role membership
**When to use:** Token-weighted governance for stakeholder alignment
**Example:**
```rust
// Source: sputnikdao2/src/policy.rs
pub enum WeightKind {
    TokenWeight,  // Votes weighted by delegated token amounts
    RoleWeight,   // Each role member gets one vote
}

pub enum WeightOrRatio {
    Weight(U128),           // Absolute vote count needed
    Ratio(u64, u64),        // Fraction: (1, 2) = 50%
}

// Threshold calculation
fn compute_threshold(&self, total_weight: U128, quorum: U128) -> U128 {
    let calculated = match &self.threshold {
        WeightOrRatio::Weight(w) => *w,
        WeightOrRatio::Ratio(num, denom) => {
            // (numerator * total_weight) / denominator + 1
            (U128::from(*num) * total_weight / U128::from(*denom)) + 1
        }
    };
    // Threshold is max of quorum and calculated
    std::cmp::max(quorum, calculated)
}
```

### Pattern 4: Coalition Multi-Party Approval (BASTION Extension)
**What:** Require approvals from multiple coalition parties for high-consequence decisions
**When to use:** Mission orders, cross-coalition operations, classified actions
**Example:**
```rust
// BASTION extension for coalition governance
pub struct CoalitionProposal {
    pub base: Proposal,
    pub required_parties: Vec<String>,        // ["USA", "GBR", "AUS"]
    pub party_approvals: HashMap<String, bool>,
    pub classification: Classification,
}

impl CoalitionProposal {
    pub fn record_party_approval(&mut self, voter: &AccountId, party: String) {
        // Verify voter has credential for claimed party membership
        let voter_party = self.verify_party_membership(voter);
        require!(voter_party == party, "ERR_PARTY_MISMATCH");

        self.party_approvals.insert(party, true);
    }

    pub fn is_coalition_approved(&self) -> bool {
        self.required_parties.iter()
            .all(|party| self.party_approvals.get(party) == Some(&true))
    }
}
```

### Anti-Patterns to Avoid
- **Token-weighted voting without snapshot:** Vulnerable to flash loan attacks; always snapshot balances before proposal creation
- **Instant proposal execution:** Always use timelocks (48+ hours) for treasury operations
- **Single-signer admin keys:** Use multi-sig (5-of-9) for critical operations
- **Clearance checks only on proposal view:** Enforce clearance on voting, not just viewing
- **Unbounded iteration:** Never iterate all proposals/members; use pagination
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Proposal state machine | Custom status tracking | SputnikDAO v2 ProposalStatus | Edge cases with expiration, finalization, callbacks |
| Vote counting | Manual aggregation | SputnikDAO v2 update_votes() | Role-weighted vs token-weighted complexity |
| Permission system | Simple if/else checks | SputnikDAO v2 Policy + wildcards | Wildcard matching, role inheritance, policy versioning |
| Token staking | Custom lock contracts | sputnik-staking contract | Delegation, unbonding periods, weight snapshots |
| DAO factory | Manual deployment | sputnikdao-factory2 | Sub-account creation, config validation, upgrades |
| Timelock | setTimeout patterns | Built-in proposal_period | Block-based timing, callback handling |
| Flash loan protection | Ad-hoc balance checks | Snapshot-based voting | Needs block-height snapshots, not just current balance |

**Key insight:** SputnikDAO v2 has been battle-tested managing hundreds of millions in DAO treasuries. The proposal lifecycle, vote counting, and policy enforcement have been audited and debugged over years. Custom implementations will inevitably miss edge cases around:
- Proposals that expire during cross-contract calls
- Vote weight recalculation during delegation changes
- Callback failures leaving proposals in limbo
- Gas-intensive operations hitting limits

The correct approach is to **extend SputnikDAO v2's structs and traits** rather than replacing the core mechanisms.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: Flash Loan Governance Attacks
**What goes wrong:** Attacker borrows tokens via flash loan, votes on malicious proposal, repays loan in same transaction, drains treasury
**Why it happens:** Token-weighted voting uses current balance instead of historical snapshot
**How to avoid:**
- Snapshot token balances at proposal creation block
- Implement minimum token holding period (7+ days before voting eligibility)
- Use dynamic quorum that rises with treasury size
- Add timelocks (48+ hours) between approval and execution
**Warning signs:** Proposals passing with sudden large votes from new addresses

### Pitfall 2: Low Voter Turnout Exploitation
**What goes wrong:** Whale accumulates tokens quietly, passes proposal with <5% turnout when others aren't paying attention
**Why it happens:** No minimum quorum or participation thresholds
**How to avoid:**
- Require minimum quorum (e.g., 10% of voting power must participate)
- Implement quadratic voting to reduce whale dominance
- Add proposal notification hooks to alert members
- Consider delegation to active governance participants
**Warning signs:** Treasury-affecting proposals passing with minimal votes

### Pitfall 3: Unbounded Storage Growth
**What goes wrong:** Proposals, votes, and audit logs grow unboundedly, eventually hitting gas limits
**Why it happens:** Storing all historical data on-chain without cleanup
**How to avoid:**
- Archive old proposals to IPFS after finalization
- Limit action log length (SputnikDAO uses max 20 entries)
- Use LookupMap instead of UnorderedMap where iteration isn't needed
- Implement pagination for all list operations
**Warning signs:** Transaction gas costs increasing over time, query timeouts

### Pitfall 4: Cross-Contract Call Failures
**What goes wrong:** Proposal executes external call that fails, but proposal state isn't properly rolled back
**Why it happens:** Not handling Promise failures correctly
**How to avoid:**
- Always implement `#[private]` callback handlers for Promise results
- Use SputnikDAO's `on_proposal_callback` pattern
- Store intermediate state to handle partial failures
- Test with intentionally failing external calls
**Warning signs:** Proposals stuck in "Approved" but never executing

### Pitfall 5: Role Permission Escalation
**What goes wrong:** User exploits permission wildcards or role inheritance to gain unauthorized access
**Why it happens:** Overly permissive wildcard patterns like "*:*"
**How to avoid:**
- Never grant "*:*" except to verified council members
- Use specific permissions: "Transfer:VoteApprove" not "Transfer:*"
- Log all permission checks for audit
- Implement permission change proposals with elevated approval thresholds
**Warning signs:** Users voting on proposal types they shouldn't access

### Pitfall 6: Missing Clearance Integration (BASTION-specific)
**What goes wrong:** Users without proper security clearance view/vote on classified proposals
**Why it happens:** DAO governance built independently of identity/credential system
**How to avoid:**
- Integrate with BASTION's CredentialRegistry for clearance verification
- Check credentials in `can_execute_action()` before permission matching
- Implement classification-based proposal visibility
- Cache credential status with short TTL (ABAC uses 1-minute)
**Warning signs:** Credential revocations not immediately affecting governance access
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from SputnikDAO v2 and BASTION integration:

### Proposal Kind Enumeration
```rust
// Source: sputnikdao2/src/proposals.rs
#[derive(BorshSerialize, BorshDeserialize, Serialize, Deserialize, Clone)]
#[serde(crate = "near_sdk::serde")]
pub enum ProposalKind {
    // Governance changes
    ChangeConfig { config: Config },
    ChangePolicy { policy: VersionedPolicy },
    ChangePolicyAddOrUpdateRole { role: RolePermission },
    ChangePolicyRemoveRole { role: String },
    ChangePolicyUpdateDefaultVotePolicy { vote_policy: VotePolicy },
    ChangePolicyUpdateParameters { parameters: PolicyParameters },

    // Membership
    AddMemberToRole { member_id: AccountId, role: String },
    RemoveMemberFromRole { member_id: AccountId, role: String },

    // Execution
    FunctionCall { receiver_id: AccountId, actions: Vec<ActionCall> },
    Transfer { receiver_id: AccountId, token_id: AccountId, amount: U128, msg: Option<String> },
    UpgradeSelf { hash: Base58CryptoHash },
    UpgradeRemote { receiver_id: AccountId, method_name: String, hash: Base58CryptoHash },

    // Incentives
    AddBounty { bounty: Bounty },
    BountyDone { bounty_id: u64, receiver_id: AccountId },

    // Signaling
    Vote,
    SetStakingContract { staking_id: AccountId },
    FactoryInfoUpdate { factory_info: FactoryInfo },
}
```

### Vote Action Handling
```rust
// Source: sputnikdao2/src/proposals.rs
pub fn act_proposal(&mut self, id: u64, action: Action, memo: Option<String>) {
    let mut proposal = self.proposals.get(&id).expect("ERR_NO_PROPOSAL").into_current();

    // Verify proposal is still voteable
    require!(proposal.status == ProposalStatus::InProgress, "ERR_PROPOSAL_NOT_ACTIVE");

    let policy = self.policy.get().unwrap().to_policy();
    let sender = env::predecessor_account_id();

    // Permission check
    require!(
        policy.can_execute_action(&sender, &proposal.kind.to_policy_label(), &action),
        "ERR_PERMISSION_DENIED"
    );

    match action {
        Action::VoteApprove | Action::VoteReject | Action::VoteRemove => {
            // Prevent duplicate voting
            require!(
                !proposal.votes.contains_key(&sender),
                "ERR_ALREADY_VOTED"
            );
            proposal.update_votes(&sender, &action, &policy);
        }
        Action::Finalize => {
            // Check if expired or approved
        }
        Action::RemoveProposal => {
            // Immediate removal for spam
        }
    }

    // Recompute status after vote
    proposal.status = policy.proposal_status(&proposal);

    // Execute if approved
    if proposal.status == ProposalStatus::Approved {
        self.internal_execute_proposal(&proposal);
    }

    self.proposals.insert(&id, &VersionedProposal::Latest(proposal));
}
```

### Integration with BASTION Credentials
```rust
// BASTION extension: clearance-aware permission check
impl Policy {
    pub fn can_execute_action_with_clearance(
        &self,
        account_id: &AccountId,
        proposal_label: &str,
        action: &Action,
        credential_registry: &CredentialRegistry,
        required_clearance: Option<Classification>,
    ) -> bool {
        // First check standard permissions
        if !self.can_execute_action(account_id, proposal_label, action) {
            return false;
        }

        // If clearance required, verify credential
        if let Some(clearance) = required_clearance {
            // Derive blinded key from account_id for credential lookup
            let blinded_key = derive_credential_key(account_id, "clearance");

            // Check credential is valid and not revoked/suspended
            if !credential_registry.is_valid(blinded_key) {
                return false;
            }

            // Verify clearance level meets requirement
            // (actual decryption happens off-chain, this is commitment verification)
            true
        } else {
            true
        }
    }
}
```

### Coalition Approval Pattern
```rust
// BASTION extension: multi-party coalition voting
pub struct CoalitionVotePolicy {
    pub required_parties: Vec<String>,  // ["USA", "GBR", "CAN"]
    pub per_party_threshold: WeightOrRatio,  // (1, 2) = 50% within each party
    pub all_parties_required: bool,  // true = unanimous, false = majority of parties
}

pub fn check_coalition_approval(
    &self,
    proposal: &CoalitionProposal,
    policy: &CoalitionVotePolicy,
) -> bool {
    let approved_parties: Vec<&String> = policy.required_parties.iter()
        .filter(|party| {
            let party_votes = proposal.votes_by_party.get(*party).unwrap_or(&vec![]);
            let party_members = self.get_party_member_count(party);

            let threshold = policy.per_party_threshold.compute(party_members);
            let approve_count = party_votes.iter()
                .filter(|(_, vote)| *vote == Vote::Approve)
                .count();

            approve_count >= threshold as usize
        })
        .collect();

    if policy.all_parties_required {
        approved_parties.len() == policy.required_parties.len()
    } else {
        approved_parties.len() > policy.required_parties.len() / 2
    }
}
```
</code_examples>

<sota_updates>
## State of the Art (2025-2026)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Simple token voting | Snapshot-based voting | 2022-2023 | Prevents flash loan attacks |
| Immediate execution | Timelocked execution (48h+) | 2023 | Allows community to veto malicious proposals |
| Single quorum | Dynamic quorum scaling with treasury | 2024 | Prevents low-turnout exploitation |
| Manual upgrades | Proxy patterns with UpgradeSelf | 2024 | Safer contract upgrades via governance |
| AssemblyScript | Rust (near-sdk-rs) | 2023-2024 | Better security tooling, type safety |

**New tools/patterns to consider:**
- **AI-assisted governance:** 2025 research explores AI analyzing proposals for security risks before voting
- **Quadratic voting:** Reduces whale dominance by taking square root of token balance for vote weight
- **Conviction voting:** Vote weight increases over time for long-term stakeholders
- **Optimistic governance:** Proposals pass unless vetoed, reducing participation burden

**Deprecated/outdated:**
- **Catalyst-DAO (AssemblyScript):** While functional, Rust is preferred for security-critical contracts
- **Cannon-style flash loan protection:** Simple balance checks insufficient; need block-height snapshots
- **Unbounded proposal arrays:** Must use pagination and archival strategies
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **Clearance Credential Caching Strategy**
   - What we know: ABAC uses 1-minute TTL cache for subject attributes
   - What's unclear: Should DAO voting use same cache or verify credentials on every vote?
   - Recommendation: Verify on every vote for high-security proposals; cache for routine governance

2. **Coalition Party Verification**
   - What we know: BASTION has CoalitionMembership credentials (from 2-06)
   - What's unclear: How to efficiently verify party membership on-chain without revealing identity
   - Recommendation: Use blinded credential lookup; party claims verified off-chain with ZK proofs

3. **Cross-Chain DAO Actions**
   - What we know: BASTION has Chain Signatures for multi-chain transactions
   - What's unclear: How DAO proposals should authorize cross-chain operations (e.g., ETH treasury)
   - Recommendation: DAO approves intent, then chain signature executed by authorized relayer

4. **Proposal Classification Visibility**
   - What we know: Documents have encrypted classifications
   - What's unclear: Should proposals themselves be classified, and how to enforce visibility?
   - Recommendation: Support classified proposal metadata; only clearance-holders can view/vote
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [SputnikDAO v2 Contract](https://github.com/near-daos/sputnik-dao-contract) - lib.rs, proposals.rs, policy.rs (updated Nov 2025)
- [NEAR SDK Best Practices](https://docs.near.org/smart-contracts/anatomy/best-practices) - Official documentation
- [NEAR MultiSig Voting](https://docs.near.org/tutorials/multichain-dao/voting) - Official documentation

### Secondary (MEDIUM confidence)
- [Catalyst-DAO](https://github.com/VitalPointAI/Catalyst-DAO) - AssemblyScript DAO framework, 11 proposal types (Moloch v2 heritage)
- [AstroDAO/SputnikDAO Medium](https://medium.com/nearprotocol/astro-launches-on-near-to-supercharge-dao-communities-c768f79782d1) - SputnikDAO v2 as AstroDAO foundation
- [DAO Security Pitfalls 2025](https://markaicode.com/dao-security-pitfalls-2025/) - Flash loan attacks, access control failures
- [Flash Loan Governance Research](https://arxiv.org/html/2505.00888v1) - Time-weighted snapshot frameworks

### Tertiary (LOW confidence - needs validation during implementation)
- [OWASP Flash Loan Attacks](https://scs.owasp.org/sctop10/SC07-FlashLoanAttacks/) - General flash loan patterns
- [DAO Governance Medium Article](https://medium.com/@garima.miet/dao-governance-mechanisms-architecture-and-implementation-16e46c856c3f) - General DAO architecture
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: NEAR Protocol smart contracts (Rust)
- Ecosystem: SputnikDAO v2, AstroDAO, Catalyst-DAO
- Patterns: Proposal lifecycle, role-based permissions, weighted voting, multi-sig
- Pitfalls: Flash loan attacks, low turnout exploitation, storage growth, callback failures

**Confidence breakdown:**
- Standard stack: HIGH - SputnikDAO v2 is production-tested, powers major NEAR DAOs
- Architecture: HIGH - Patterns from official contracts with active maintenance
- Pitfalls: HIGH - Based on documented 2024-2025 exploits with verified mitigation strategies
- Code examples: HIGH - From actual SputnikDAO v2 source code
- Coalition extensions: MEDIUM - Novel patterns specific to BASTION, need implementation validation

**Research date:** 2026-01-16
**Valid until:** 2026-02-16 (30 days - NEAR DAO ecosystem stable, check for SDK updates)
</metadata>

---

*Phase: 03-dao-governance*
*Research completed: 2026-01-16*
*Ready for planning: yes*
