# Figure 1: BASTION High-Level Architecture

## Mermaid Source

```mermaid
flowchart TB
    subgraph Strategic["Strategic Level"]
        direction TB
        SDAO["Strategic DAO<br/>━━━━━━━━━━━<br/>Resource Allocation<br/>Coalition Membership<br/>Policy Decisions"]
        SH["Human Authority<br/>(Senior Leaders)"]
        SA["Strategic<br/>AI Agents"]
    end

    subgraph Operational["Operational Level"]
        direction TB
        ODAO["Operational DAO<br/>━━━━━━━━━━━<br/>Campaign Coordination<br/>Resource Mapping<br/>Agent Orchestration"]
        OH["Human Authority<br/>(Commanders)"]
        OA["Operational<br/>AI Agents"]
    end

    subgraph Tactical["Tactical Level"]
        direction TB
        TDAO["Tactical DAO<br/>━━━━━━━━━━━<br/>Mission Execution<br/>Asset Coordination<br/>Target Identification"]
        TH["Human Authority<br/>(Operators)"]
        TA["Tactical<br/>AI Agents"]
    end

    subgraph Blockchain["NEAR Protocol Blockchain"]
        direction LR
        SC["Smart<br/>Contracts"]
        AL["Audit<br/>Log"]
        PS["Policy<br/>Store"]
    end

    %% Human Authority Positions
    SH <-->|"HITL"| SDAO
    OH <-->|"HITL/HOTL"| ODAO
    TH <-->|"HOTL/HOOTL"| TDAO

    %% AI Agent Augmentation
    SA -.->|"Analysis &<br/>Recommendations"| SDAO
    OA -.->|"Fusion &<br/>Orchestration"| ODAO
    TA -.->|"Execution &<br/>Coordination"| TDAO

    %% Inter-DAO Communication (Decision Flow)
    SDAO ==>|"Policy &<br/>Resources"| ODAO
    ODAO ==>|"Guidance &<br/>Tasking"| TDAO

    %% Feedback Loops
    TDAO -.->|"Status &<br/>Results"| ODAO
    ODAO -.->|"Proposals &<br/>Reports"| SDAO

    %% Blockchain Securing All
    SDAO --- SC
    ODAO --- SC
    TDAO --- SC
    SC --- AL
    SC --- PS

    %% Styling
    classDef daoStyle fill:#1a365d,stroke:#3182ce,stroke-width:2px,color:#fff
    classDef humanStyle fill:#2c5282,stroke:#63b3ed,stroke-width:2px,color:#fff
    classDef aiStyle fill:#553c9a,stroke:#9f7aea,stroke-width:2px,color:#fff
    classDef blockchainStyle fill:#234e52,stroke:#38b2ac,stroke-width:2px,color:#fff

    class SDAO,ODAO,TDAO daoStyle
    class SH,OH,TH humanStyle
    class SA,OA,TA aiStyle
    class SC,AL,PS blockchainStyle
```

## Figure Caption

**Figure 1: BASTION High-Level Architecture.** The three-tier DAO structure connects strategic resource allocation to tactical execution through operational AI agent coordination. Solid arrows indicate decision flow direction (strategic guidance flowing downward); dashed lines represent feedback loops (e.g., tactical resource expenditure triggering strategic replenishment requests, mission results informing operational assessment). Human authority positions are indicated at each level: Human-in-the-Loop (HITL) for strategic decisions, HITL or Human-on-the-Loop (HOTL) at operational level based on decision type, and HOTL or Human-out-of-the-Loop (HOOTL) at tactical level for pre-approved mission types. AI agents augment decision-making at all levels without replacing human authority for consequential decisions. The NEAR Protocol blockchain secures all transactions through smart contracts, maintaining immutable audit logs and enforcing encoded policy constraints.

## Architecture Elements

### Three-Tier DAO Structure

1. **Strategic DAO** - Governs coalition-level decisions: resource allocation across theaters, coalition membership and voting weights, and long-term policy decisions. All strategic decisions require Human-in-the-Loop (HITL) approval.

2. **Operational DAO** - Bridges strategic intent and tactical execution: coordinates campaigns, orchestrates AI agent activities, and maps resources to objectives. Authority position varies by decision type (HITL for significant decisions, HOTL for routine coordination).

3. **Tactical DAO** - Manages mission-specific decisions: asset coordination, target identification, and effects delivery within policy constraints. Pre-approved mission types may execute with HOTL or HOOTL authority; high-consequence decisions always require human approval.

### AI Agent Layer

AI agents augment decision-making at each level:
- **Strategic Agents**: Analyze long-term trends, assess resource requirements, recommend policy adjustments
- **Operational Agents**: Fuse intelligence, assess campaign progress, orchestrate multi-agent coordination
- **Tactical Agents**: Execute mission coordination, provide real-time recommendations, handle routine actions within policy bounds

### Blockchain Infrastructure

NEAR Protocol provides the secure foundation:
- **Smart Contracts**: Encode governance rules and policy constraints
- **Audit Log**: Immutable record of all decisions and actions
- **Policy Store**: Machine-readable policy encoding for automatic compliance

### Human Authority Positions

The diagram indicates graduated authority requirements:
- **HITL (Human-in-the-Loop)**: Human must approve each action before execution
- **HOTL (Human-on-the-Loop)**: System acts autonomously while human monitors and can intervene
- **HOOTL (Human-out-of-the-Loop)**: System acts fully autonomously within policy constraints (tactical routine actions only)

## Export Instructions

For final document inclusion, export this Mermaid diagram to PNG format:

1. Use Mermaid CLI: `mmdc -i system-architecture.md -o system-architecture.png -w 1200 -H 900`
2. Or Mermaid Live Editor: https://mermaid.live/
3. Export at 300 DPI for print quality
4. Recommended dimensions: 1200x900 pixels minimum for readability

## Cross-References

- Architecture description: See Section 3.2 (Architecture Overview) in `03-methodology.md`
- Design principles justifying architecture: See Section 3.1 (Design Principles) in `03-methodology.md`
- Background on levels of warfare: See Section 2.5 in `02-background-military.md`
- Human authority positions background: See Section 2.9 in `02-background-ai.md`
