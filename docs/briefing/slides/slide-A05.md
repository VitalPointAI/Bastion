# Slide A5: Smart Contract Architecture Deep-Dive

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** A5 of A17 (Annex)
**Maps to core slides:** 11 (Smart Contracts as Policy), and Phase 58 on-chain caveats
**Date:** 2026-03-26

## Style Reference

| Role | Hex | Tailwind | Usage |
|------|-----|----------|-------|
| Primary Blue | `#2563EB` | blue-600 | Headings, primary UI elements, architecture blocks |
| Sky Blue | `#0EA5E9` | sky-500 | Secondary accents, data flow lines |
| Cyan | `#06B6D4` | cyan-500 | Blockchain/crypto elements, DID references |
| White | `#FFFFFF` | white | All backgrounds |
| Light Gray | `#F8FAFC` | slate-50 | Slide background variant |
| Dark Text | `#0F172A` | slate-900 | Body text |
| Muted Text | `#64748B` | slate-500 | Captions, sub-labels |

**Rule:** Never use dark backgrounds. Never use tactical/military dark aesthetic. BASTION on the second screen provides the tactical visual; the deck is the clean analytical layer.

## Purpose

Full technical depth on the NEAR Rust smart contract, the `ResourceCaveats` struct, and the authorization logic.

## Visual

**Diagram 1: ResourceCaveats Struct (code-style layout)**

```rust
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone)]
pub struct ResourceCaveats {
    // Access control: who can see/use this resource
    pub classification: ClassificationLevel,  // UNCLASSIFIED → TOP SECRET
    pub releasability: Vec<NationCode>,        // ["USA", "GBR", "AUS", "CAN", "NZL"]

    // Employment restrictions
    pub roe_tier: RoETier,                     // 1 (unrestricted) → 5 (strike prohibited)
    pub geo_bounds: Option<GeoPolygon>,        // Operational area restriction
    pub time_windows: Vec<TimeWindow>,         // When employment is authorized

    // Tracking
    pub caveat_version: u32,
    pub last_updated_by: AccountId,
    pub last_updated_at: Timestamp,
}
```

**Diagram 2: Authorization Check Flow**

```
Caller (agent or human) requests action on resource_did
        ↓
DID Registry Contract: check_employment_authorized(
    resource_did,
    caller_did,
    requested_action
)
        ↓
[Check classification] → caller cleared? → DENY if not
        ↓
[Check releasability] → caller nation authorized? → DENY if not
        ↓
[Check roe_tier] → requested action within ROE? → DENY if exceeds
        ↓
[Check geo_bounds] → current location within bounds? → DENY if outside
        ↓
[Check time_windows] → current time authorized? → DENY if outside window
        ↓
AUTHORIZED — return authorization token + audit record
```

All DENY branches write an immutable audit record to the blockchain before returning.

**Diagram 3: Testnet Deployment**

- Contract: `did.bastion.testnet`
- NEAR Testnet Explorer URL annotation
- Annotation: "Every call is visible — no black boxes"

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
