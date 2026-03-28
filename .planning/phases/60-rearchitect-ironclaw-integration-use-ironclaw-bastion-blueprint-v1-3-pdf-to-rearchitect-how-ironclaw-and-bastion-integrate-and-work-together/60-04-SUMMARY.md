---
phase: 60-rearchitect-ironclaw-integration
plan: 04
subsystem: agent-config-ui
tags: [ironclaw, agent-config, blueprint-phase-3, identity-tab, personality-tab, preview-chat, per-user]
dependency_graph:
  requires: [60-03]
  provides: [AgentConfigPanel, IdentityTab, PersonalityTab, AgentPreviewChat, useAgentConfig, useAgentPreview, agent-config-types-frontend]
  affects: [ironclaw-drawer, frontend-types]
tech_stack:
  added: []
  patterns: [debounce-save, streaming-preview, persona-summary, toggle-field-pattern, react-context-auth]
key_files:
  created:
    - frontend/src/types/agent-config.ts (AgentConfig and related union types for frontend)
    - frontend/src/components/agent-config/hooks/useAgentConfig.ts
    - frontend/src/components/agent-config/hooks/useAgentPreview.ts
    - frontend/src/components/agent-config/AgentConfigPanel.tsx
    - frontend/src/components/agent-config/tabs/IdentityTab.tsx
    - frontend/src/components/agent-config/tabs/PersonalityTab.tsx
    - frontend/src/components/agent-config/components/AgentPreviewChat.tsx
  modified: []
decisions:
  - "Frontend AgentConfig types are duplicated from backend per project convention — no shared package"
  - "useAgentPreview listens for WebSocket streaming before sending message to avoid missing early chunks"
  - "PersonalityTab uses radio-button-style cards for tone (not a dropdown) to make options scannable"
  - "AgentPreviewChat sends with preview_mode:true context flag — Ironclaw will use persona config before identity files are formally synced"
  - "Preview panel implemented as collapsible sidebar in AgentConfigPanel, not a separate route"
metrics:
  duration: 7 min
  completed_date: 2026-03-28
  tasks: 2
  files: 7
---

# Phase 60 Plan 04: Agent Config UI (Identity, Personality, Preview) Summary

React tab panel for configuring per-user Chief of Staff persona — Identity form, Personality controls, and live preview chat with streaming response.

## What Was Built

### Task 1: useAgentConfig hook, useAgentPreview hook, and AgentConfigPanel shell

**frontend/src/types/agent-config.ts** — Frontend type definitions:
- `StaffSection`, `OutputFormat`, `TonePreference`, `NotificationLevel` union types
- `CustomSkill`, `RoutineSpec` interfaces
- `AgentConfig` interface mirroring backend (with `Date` fields as `string` for JSON transport)
- Duplicated per project convention — backend is authoritative

**useAgentConfig.ts** — Data fetching and save hook:
- `GET /api/agent-config/:userId` on mount, returns `{ config, loading, error }`
- `updateConfig(partial)` merges and debounces save by 500ms (avoids excessive API calls during form editing)
- Save status: `idle → saving → saved → idle` (or `error`)
- `saveNow()` flushes pending debounce immediately
- Uses `credentials: 'include'` HttpOnly cookie auth — same pattern as `ironclawApi`

**useAgentPreview.ts** — Preview message hook:
- `sendPreviewMessage(text)` calls `POST /api/ironclaw/global/message` with `context.preview_mode: true`
- Opens WebSocket on user's global channel to capture streaming response
- Accumulates stream chunks in `responseBufferRef` for smooth display
- 30-second timeout guard; WebSocket cleaned up on unmount

**AgentConfigPanel.tsx** — Tab container component:
- Identity and Personality tabs (more tabs planned: Skills, Channels, Routines, Advanced)
- Save status badge: spinning/Saving, check/Saved, X/Save failed
- Preview toggle button shows/hides AgentPreviewChat as collapsible sidebar (40% width)
- Reads `userId` from prop or falls back to `useUser()` auth context

### Task 2: IdentityTab, PersonalityTab, and AgentPreviewChat

**IdentityTab.tsx** — Military identity form (238 lines):
- Personal group: `displayName` (text), `rank` (text input + `<datalist>` with 30+ common ranks)
- Assignment group: `staffSection` (dropdown with descriptive labels), `position`, `unit`, `higherHQ`
- Relationships group: `reportingToDid` (optional DID text), `areasOfResponsibility` (comma-separated textarea → string[] conversion)
- Identity read-only section: DID and NEAR account shown in monospace boxes
- All fields call `updateConfig()` on `onChange` — debounce in hook, not component

**PersonalityTab.tsx** — Communication style controls (232 lines):
- Tone: radio-card group (FormalMilitary / Professional / Direct / Collaborative) with description per option
- Verbosity: range slider 1–5 with `Terse → Comprehensive` label and live selected label display
- BLUF toggle: custom `ToggleField` sub-component (reusable for all toggles)
- Output format: `<select>` with format + description in each option
- Expand acronyms toggle
- Classification markings toggle
- Custom persona instructions: `<textarea>` with instructive placeholder

**AgentPreviewChat.tsx** — Single-exchange preview (239 lines):
- Persona summary banner: "Your Chief of Staff will: use formal military language, lead with the bottom line, be concise" — derived from current config
- User message bubble (shown after send)
- Ironclaw response bubble with typing dots animation while streaming, streaming cursor while chunks arrive
- Default test message "Brief me on current operations" — user can edit before sending
- Enter to send (Shift+Enter for newlines)
- Clear response button after exchange completes
- Empty state: chat bubble icon with descriptive text

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

All 7 created files verified on disk. Both task commits (843d066a, 0ed84b4e) verified in git log. TypeScript compiles with no errors (`npx tsc --noEmit` clean).
