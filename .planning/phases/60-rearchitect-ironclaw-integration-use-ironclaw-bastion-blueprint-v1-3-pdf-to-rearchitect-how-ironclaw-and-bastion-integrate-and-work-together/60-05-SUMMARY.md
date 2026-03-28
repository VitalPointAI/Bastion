---
phase: 60-rearchitect-ironclaw-integration
plan: 05
subsystem: ironclaw-agent-config
tags: [skill-packs, telegram, channels, agent-config, blueprint-phase-4]
completed: "2026-03-28"

dependency_graph:
  requires: [60-04]
  provides: [IC-04-SKILLS, IC-04-SKILLPACKS, IC-04-TELEGRAM, IC-04-CHANNELS]
  affects: [frontend/agent-config, backend/ironclaw, backend/api]

tech_stack:
  added: []
  patterns:
    - "Dynamic catalog fetch pattern: frontend loads skill catalog from API, never hardcodes"
    - "3-step wizard pattern with expiry timer and back/cancel navigation"
    - "Thin relay endpoints: frontend calls backend, backend sends command to Ironclaw webhook"
    - "Chat ID parsing from Ironclaw response (PAIRED:chatId format)"

key_files:
  created:
    - backend/src/ironclaw/skill-packs.ts
    - backend/src/api/skill-packs.ts
    - frontend/src/components/agent-config/tabs/SkillsTab.tsx
    - frontend/src/components/agent-config/tabs/ChannelsTab.tsx
    - frontend/src/components/agent-config/components/TelegramPairWizard.tsx
  modified:
    - backend/src/index.ts
    - backend/src/api/agent-config.ts
    - frontend/src/components/agent-config/AgentConfigPanel.tsx

decisions:
  - "Skill catalog served from backend API (not hardcoded in frontend) — allows server-side pack updates without frontend deploy"
  - "GET /api/skill-packs has no auth — catalog is not sensitive, avoids redirect loop before user authenticates"
  - "telegram-confirm parses PAIRED:chatId from Ironclaw response message; returns 400 if pattern not found so frontend can display raw error"
  - "Telegram chat ID persisted to AgentConfig in telegram-confirm endpoint, not requiring a separate PUT from frontend"

metrics:
  duration: "18 min"
  tasks_completed: 2
  files_created: 5
  files_modified: 3
---

# Phase 60 Plan 05: Skills Tab, Channels Tab, and Telegram Pairing Summary

**One-liner:** 7 role-specific skill packs with dynamic API catalog, SkillsTab with staff-section recommendations, ChannelsTab with Telegram pairing via 3-step wizard and backend relay endpoints.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Skill pack definitions, GET /api/skill-packs, SkillsTab UI | 2e3d88b9 |
| 2 | ChannelsTab, TelegramPairWizard, telegram-pair/confirm endpoints | 9e0b0e3c |

## What Was Built

### Skill Packs (backend/src/ironclaw/skill-packs.ts)

7 role-specific skill packs covering the full staff section spectrum:

| Pack ID | Name | Staff Sections | Trust |
|---------|------|----------------|-------|
| intel-analysis | Intelligence Analysis (S2) | S2 | medium |
| ops-planning | Operations Planning (S3) | S3 | medium |
| logistics-support | Logistics Support (S4) | S4 | low |
| personnel-admin | Personnel Administration (S1) | S1 | low |
| comms-cyber | Communications & Cyber (S6) | S6 | medium |
| civil-affairs | Civil Affairs (S9) | S9 | low |
| command-decision | Command Decision Support | Commander, XO | high |

Each pack defines triggers (natural-language phrases), required Bastion tools, and a trust level. `renderSkillPackMd()` generates a SKILL.md with YAML frontmatter for injection into Ironclaw's workspace.

### Skill Packs API (backend/src/api/skill-packs.ts)

`GET /api/skill-packs` — no auth required — returns the full `SKILL_PACKS` array as JSON. Mounted at `/api/skill-packs` in index.ts.

### SkillsTab (frontend)

- Fetches catalog dynamically from `GET /api/skill-packs` on mount (no hardcoded list)
- Splits packs into "Recommended" (matches user's `staffSection`) and "Other Packs"
- Each card shows: name, trust badge, description, expandable trigger phrases and required tools
- Toggle adds/removes pack ID from `config.enabledSkillPacks`
- Custom skills editor at bottom: add/edit/remove with name, description, and comma-separated triggers

### ChannelsTab (frontend)

- Bastion In-App section (always-on, notification level configurable)
- Telegram section with three states: disabled / enabled-not-paired / paired
- Notification level dropdown (Critical/Urgent/Routine/Informational) per channel
- Blueprint priority routing reference table as a read-only reference card

### TelegramPairWizard (frontend)

3-step wizard with step indicator:
1. **Initiate** — explain process, call `POST /api/agent-config/:userId/telegram-pair`
2. **Enter Code** — 6-digit input with 5-minute countdown timer, resend link
3. **Complete** — success confirmation

Error handling: timeout, invalid code, network errors. Each step has back/cancel navigation.

### Backend Telegram Endpoints (backend/src/api/agent-config.ts)

`POST /:userId/telegram-pair` — sends `/telegram pair` to Ironclaw via `ironclawClient.sendMessage()` scoped to the user's DID.

`POST /:userId/telegram-confirm` — sends `/telegram confirm {code}`, parses `PAIRED:chatId` from Ironclaw's response, persists chat ID to AgentConfig, returns `{ ok: true, chatId }`.

Both endpoints enforce the same auth pattern as GET/PUT: requesting DID must match target user.

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

Files verified:
- `backend/src/ironclaw/skill-packs.ts` — FOUND (7 packs, SKILL_PACKS, renderSkillPackMd)
- `backend/src/api/skill-packs.ts` — FOUND (skillPacksRouter, GET /)
- `frontend/src/components/agent-config/tabs/SkillsTab.tsx` — FOUND (fetches /api/skill-packs)
- `frontend/src/components/agent-config/tabs/ChannelsTab.tsx` — FOUND
- `frontend/src/components/agent-config/components/TelegramPairWizard.tsx` — FOUND
- `backend/src/api/agent-config.ts` — telegram-pair and telegram-confirm endpoints FOUND
- `frontend/src/components/agent-config/AgentConfigPanel.tsx` — Skills and Channels tabs FOUND

Commits verified:
- `2e3d88b9` — feat(60-05): add skill pack definitions, API endpoint, and SkillsTab UI
- `9e0b0e3c` — feat(60-05): add ChannelsTab, TelegramPairWizard, and telegram-pair endpoints

TypeScript compile: no errors (`npx tsc --noEmit` clean)
