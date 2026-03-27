# Slide 13: Decentralized Identity + Coalition Caveats

**Deck:** Decision Overmatch: AI-Augmented Command and Control Through Blockchain Governance
**Slide:** 13 of 25 (Core Deck)
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
Show DIDs as the identity foundation for coalition trust. Every resource, every agent, every person has a DID. Caveats travel with the identity — not with the access control list that can be bypassed. The Five Eyes example grounds this in a real coalition context. This is the slide that makes the DID concept concrete for a defense audience that may never have heard the term.

## Visual Layout
Left side (50%): DID anatomy diagram (see Diagram Spec). Right side (50%): Title "Identity That Travels With the Resource" in blue (#2563EB), 24pt. Below: Five Eyes example callout box (light blue background #EFF6FF):

"Scenario: Australia shares satellite imagery of PLAN naval disposition near the Taiwan Strait. The imagery is assigned DID: did:near:resource-{uuid}. Attached caveats:
- Classification: SECRET
- Releasability: FVEY (Five Eyes partners only — AUS, CAN, NZL, GBR, USA)
- ROE tier: Tier 3 required for employment
- Geographic bounds: Pacific AOR (bounding box: 15°N to 45°N, 115°E to 180°E)
- Time window: Valid 72 hours from 0300Z 12 March 2026

Any system in any partner nation that requests to use this resource will have its authorization automatically checked against these five conditions. No human gatekeeping required. No email to the Australian liaison. No risk that the caveats are lost when the document is forwarded."

Below the callout: three capability points:
- "Caveats travel with the resource identity — not with access control lists that can be modified"
- "Coalition partners verify independently — without trusting BASTION's word — because the enforcement is on the blockchain"
- "5 plugin types: Persons, Materials, Agents, Data, Equipment — every entity in the coalition has a DID"

## Image Prompt
No AI image — DID anatomy diagram carries the argument.

## Diagram Spec
DID anatomy breakdown diagram. White background. Two linked sections.

**Left section — DID Anatomy:**
A large text rendering of: `did:near:resource-{uuid}`

Annotated with brackets and labels:
- `did` → bracket pointing right → label "Decentralized Identifier (W3C Standard)"
- `near` → bracket pointing right → label "Method: NEAR Protocol blockchain"
- `resource` → bracket pointing right → label "Type: resource (also: person, agent, material, equipment)"
- `{uuid}` → bracket pointing right → label "Unique identifier — generated at resource registration"

Below the DID anatomy, a thin line connecting to:

**Right section — ResourceCaveats Struct:**
A structured data block (light gray #F8FAFC background, monospace 10pt):
```
ResourceCaveats {
  classification: ClassificationLevel,
  releasability: Vec<NationCode>,
  roe_tier: AuthorityTier,
  geo_bounds: Option<BoundingBox>,
  time_window: Option<TimeWindow>
}
```

Annotated with labels pointing to each field:
- `classification` → "SECRET / CONFIDENTIAL / UNCLASSIFIED"
- `releasability` → "Nation codes: [AUS, CAN, NZL, GBR, USA] = FVEY"
- `roe_tier` → "Minimum authority tier for employment"
- `geo_bounds` → "Optional geographic restriction"
- `time_window` → "Optional expiration"

The two sections connected by a cyan (#06B6D4) arrow labeled "DID → Caveats enforced on-chain."

---
*Speaking script and demo cues: [speaking-script.md](../speaking-script.md)*
*Full deck index: [slide-specs.md](../slide-specs.md)*
