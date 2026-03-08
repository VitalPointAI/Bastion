# Exercise Scenario Setup

BASTION supports structured training exercises built around scenario packages. This guide covers scenario creation, data seeding, and exercise management.

## Example: Pacific Strategy AY26

The included example scenario covers an Indo-Pacific contingency with six phases:

| Phase | Description |
|-------|-------------|
| **Competition** | Gray-zone activities, diplomatic signaling, force posture adjustments |
| **Crisis** | Escalation triggers, decision points, coalition coordination |
| **Conflict Day 4** | Initial combat operations, strike planning, defensive posture |
| **Conflict Day 10** | Sustained operations, logistics strain, adaptive planning |
| **Conflict Day 22** | Culmination assessment, transition planning |
| **Negotiation** | Ceasefire terms, force disposition, post-conflict stability |

Scenario files live in the `/scenario/` directory.

## Seed Scripts

Two scripts populate the database with scenario data:

```bash
# Seed the scenario (phases, documents, events, conditions)
bash scripts/seed-scenario.sh

# Seed the graph database (RAFT entities, relationships)
bash scripts/seed-graph-data.sh
```

Both scripts are idempotent and can be re-run safely.

## Scenario Package Upload

Scenarios can also be uploaded through the UI:

1. Navigate to the **Understand** tab in a problem set.
2. Use the scenario upload area to submit a scenario package (ZIP containing documents, orders, intelligence products).
3. BASTION processes the package, extracts text, and indexes documents.

## AI Tag Inference

When documents are ingested, AI agents automatically categorize them:

- Documents are analyzed for content type (OPORD, INTSUM, logistics estimate, etc.).
- Tags are inferred based on doctrinal document types and content analysis.
- Tags feed into the graph database for cross-referencing and staff agent context.

## Team Assignment

Exercises support role-based team assignment:

| Team | Role |
|------|------|
| **Blue** | Friendly force planning and execution |
| **Red** | Adversary/OPFOR role-play and response |
| **White** | Exercise control, adjudication, assessment |

Teams are assigned at the problem set level and control visibility and permissions.

## Phase Gate Management

Exercise phases are managed through a **Kanban board** interface:

- Each phase is a column with associated tasks, decision points, and deliverables.
- Phase transitions require completion criteria (configurable per exercise).
- White team controls phase advancement.
- Phase changes trigger AI agent context updates so staff recommendations reflect the current phase.

## Creating an Exercise

Use the **Create from Scenario** wizard (`CreateProblemSetWizard`):

1. Select a scenario package or upload a new one.
2. Configure exercise parameters (teams, timeline, phase gates).
3. Assign participants to teams and staff roles.
4. The wizard creates the problem set, seeds initial data, and activates AI agents.
