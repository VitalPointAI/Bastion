# Figure: DAO Governance Flow

## Diagram Type

Top-to-bottom flowchart showing the complete DAO governance decision pipeline from trigger event through execution and audit trail.

## Layout

**Orientation:** Portrait / top-to-bottom
**Target Dimensions:** 1200×800 pixels
**Export:** 300 DPI PNG for print

## Components (Top to Bottom)

### 1. Decision Gate Trigger (Top)
- **Shape:** Rounded rectangle, dark blue (#1a365d)
- **Label:** "Decision Gate Triggered"
- **Subtypes shown:** COA Approval Gate | OPORD Release Gate | Strike Authorization | Resource Allocation | Coalition Membership
- Arrow flows downward

### 2. Authority Tier Classification
- **Shape:** Diamond (decision node), gold (#d69e2e)
- **Label:** "Authority Tier Check"
- **Five branches** radiating right, labeled:
  - Tier 1: AUTONOMOUS (green)  --  AI executes, logged
  - Tier 2: AI_RECOMMENDED (light blue)  --  AI proposes, human confirms
  - Tier 3: HUMAN_SUPERVISED (blue)  --  Human decides with AI analysis
  - Tier 4: HUMAN_ONLY (orange)  --  Human decides, no AI recommendation
  - Tier 5: COALITION_UNANIMOUS (red)  --  All coalition members must approve
- Each tier branch converges back to the main flow

### 3. Proposal Creation
- **Shape:** Rectangle, blue (#3182ce)
- **Label:** "DAO Proposal Created"
- **Details inside:** Proposal ID, authority tier badge, RACI assignment, deadline
- Arrow flows down

### 4. Voting Period
- **Shape:** Large rectangle with internal elements, blue (#2c5282)
- **Label:** "Coalition Voting"
- **Internal elements:**
  - Voter cards: USA (weight: 40%), GBR (weight: 30%), CAN (weight: 30%)
  - Progress bar showing votes toward quorum threshold
  - Timer showing remaining voting period
- Arrow flows down

### 5. Quorum Check
- **Shape:** Diamond (decision node), gold (#d69e2e)
- **Label:** "Quorum Met?"
- **Two branches:**
  - YES (green arrow) → Execution
  - NO (red arrow) → "Proposal Expired / Rejected" terminal (red rounded rectangle)

### 6. Execution
- **Shape:** Rectangle, green (#38a169)
- **Label:** "Decision Executed"
- **Details:** Smart contract enforces decision, on-chain transaction recorded
- Arrow flows down

### 7. Audit Trail (Bottom)
- **Shape:** Rectangle with document icon, teal (#234e52)
- **Label:** "Immutable Audit Log"
- **Details:** NEAR blockchain transaction hash, timestamp, all voter signatures, decision rationale

## Connection Types

- **Solid arrows:** Decision flow direction (blue #3182ce)
- **Dashed arrows:** Feedback/notification paths (gray #a0aec0)
- **Gold highlights:** Human decision points requiring attention

## Color Legend

| Color | Meaning |
|-------|---------|
| Dark Blue (#1a365d) | Trigger events |
| Blue (#3182ce) | Automated/system steps |
| Gold (#d69e2e) | Human decision points |
| Green (#38a169) | Approved / executed |
| Red (#e53e3e) | Rejected / expired |
| Teal (#234e52) | Blockchain / audit |

## Key Labels (Use BASTION Terminology)

- "COA Approval Gate" not "approval request"
- "OPORD Release Gate" not "order release"
- "Strike Authorization" not "lethal action approval"
- "Coalition Unanimous" not "all vote yes"
- Voter names: USA, GBR, CAN (from Pacific Strategy AY26)
- Authority tiers by number (Tier 1-5) with descriptive names

## Cross-References

- Authority tier model: See Section 3.7 (Decide Tab) in `03-methodology.md`
- DAO architecture: See Section 3.3 (DAO Governance) in `03-methodology.md`
- Smart contract enforcement: See Section 3.5 (Blockchain Layer) in `03-methodology.md`

---

*Figure specification for AI image generation. Use with Mermaid, Figma, or diagram tool.*
*Document version: 1.0  --  2026-03-23*
