# Phase 65: Ironclaw Autonomous Operations

## Goal

Transform Ironclaw from a reactive chat interface into a truly autonomous Chief of Staff that continuously monitors the operational environment, proactively processes intelligence, detects conflicts, surfaces decisions, and self-extends its capabilities — all without waiting for user input. Ironclaw replaces the gap filler service and owns all autonomous intelligence work, leveraging its native OpenClaw heartbeat, routines engine, and self-directed agent loop.

## Why This Matters

The whitepaper claims Ironclaw and its agent teams "run continuously — processing incoming intelligence, extracting entities/relationships, cross-referencing sources, flagging conflicts, drafting assessments, and surfacing decisions that need human attention." Currently this is not true. Ironclaw is wired as a request/response chat interface that only activates when a user sends a message. The OpenClaw framework natively supports autonomous heartbeat-driven operation, but Bastion ignores these capabilities entirely.

## Success Criteria

1. **Ironclaw operates autonomously without user interaction** — heartbeat fires on schedule, Ironclaw evaluates the operational environment and takes action
2. **Ironclaw replaces the gap filler service** — all intelligence gap detection, research, and PIR matching is owned by Ironclaw through its native autonomous capabilities
3. **Conflicts and contradictions are detected and surfaced proactively** — Ironclaw runs conflict detection against the knowledge graph and creates decision gates for commander review
4. **Situation assessments are drafted automatically** — when significant intelligence accumulates, Ironclaw drafts situational updates
5. **Decisions needing human attention are surfaced** — via WebSocket notifications, Telegram alerts, and decision gates
6. **Ironclaw self-extends** — when it identifies a recurring need or efficiency, it autonomously creates new skills/tools to address it (subject to governance gates)
7. **All autonomous actions respect existing governance** — risk classification, decision gates, audit trails, and blockchain anchoring remain enforced
8. **Commander can observe Ironclaw's autonomous activity** — activity log/feed showing what Ironclaw has been doing between user interactions

## Architecture

### Current State (Broken)
```
User types message --> Bastion HTTP POST --> Ironclaw webhook --> Response --> WebSocket
         ^                                                                        |
         +---- (silence — nothing happens until user types again) <---------------+
```

### Target State
```
                    +-- Heartbeat tick (scheduled) ------+
                    |                                     |
                    v                                     v
            Ironclaw evaluates:              Bastion event webhook:
            - HEARTBEAT.md directives        - New OSINT ingested
            - KG state via MCP tools         - Document processed
            - Active PIRs/CCIRs              - Graph changed
            - Pending decisions              - Decision gate created
                    |                                     |
                    v                                     v
            Autonomous actions:              Ironclaw processes event:
            - Conflict detection             - Cross-reference sources
            - Gap research                   - PIR/CCIR matching
            - Situation drafts               - Entity correlation
            - Skill creation                 - Contradiction check
                    |
                    v
            Callback to Bastion:
            POST /api/ironclaw/callback
                    |
                    v
            Bastion routes:
            - WebSocket push to UI
            - Decision gate creation
            - Telegram alert
            - Activity log entry
```

## Key Design Decisions

1. **Ironclaw owns autonomy, not Bastion** — no more server-side cron jobs doing intelligence work. Ironclaw's heartbeat drives all autonomous behavior. Bastion provides tools (MCP) and receives callbacks.

2. **Event-driven + heartbeat hybrid** — Ironclaw gets notified of events (OSINT ingested, doc processed) AND has periodic heartbeat for monitoring tasks that aren't event-triggered (conflict detection sweeps, stale decision checks, situation assessment drafts).

3. **Self-extending via skill creation** — when Ironclaw identifies a pattern (e.g., "I keep manually checking for stale PIRs"), it creates a skill or routine to automate it. Subject to medium-risk governance gate.

4. **Gap filler retirement** — the `IronclawGapFillerService` is removed. Its capabilities (intelligence gap detection, SearXNG search, PIR matching) become MCP tools that Ironclaw calls autonomously during heartbeat evaluation.

5. **Callback webhook** — new Bastion endpoint that Ironclaw calls to push autonomous findings back. This is the missing bidirectional link.

## Scope

### In Scope
- Callback webhook endpoint (Ironclaw --> Bastion)
- Event forwarding (Bastion --> Ironclaw) for OSINT, documents, graph changes
- HEARTBEAT.md population with meaningful monitoring directives
- System prompt / SOUL.md updates for proactive Chief of Staff identity
- Gap filler capabilities migrated to MCP tools
- Gap filler service retirement
- Autonomous activity feed in UI (what Ironclaw has been doing)
- Conflict detection as autonomous heartbeat task
- Situation assessment drafting
- Self-extending skill/routine creation
- Telegram alerting for autonomous findings

### Out of Scope
- Changes to Ironclaw's core OpenClaw/IronClaw runtime (we configure, not modify)
- New agent types beyond Ironclaw
- Changes to existing governance/approval framework (we leverage it)
- Voice interface (separate phase)
- Changes to document intelligence pipeline (Ironclaw calls it, doesn't replace it)

## Dependencies
- Phase 60 (Rearchitect Ironclaw Integration) - COMPLETE
- Phase 57 (Ironclaw Persistent Memory) - COMPLETE
- Phase 63 (Unified OSINT Agent Ingestion) - COMPLETE

## Risk
- **Ironclaw heartbeat configuration** — need to verify OpenClaw heartbeat is fully functional in current deployment; FEATURE_PARITY.md shows some cron features as incomplete
- **LLM cost** — autonomous heartbeat means continuous LLM calls; need sensible intervals and early-exit logic
- **Runaway autonomy** — governance gates prevent dangerous actions, but need circuit breakers for cost/rate limiting on autonomous cycles
- **Callback security** — Ironclaw callback endpoint must validate shared secret to prevent spoofed autonomous actions
