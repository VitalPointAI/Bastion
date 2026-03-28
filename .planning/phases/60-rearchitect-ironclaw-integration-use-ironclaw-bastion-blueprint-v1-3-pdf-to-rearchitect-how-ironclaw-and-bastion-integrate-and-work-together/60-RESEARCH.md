# Phase 60: Rearchitect Ironclaw Integration - Research

**Researched:** 2026-03-28
**Domain:** Ironclaw x Bastion integration architecture — per-user Chief-of-Staff AI agent
**Confidence:** HIGH — primary source is the authoritative blueprint PDF (ironclaw_bastion_blueprint_v1.3.pdf) plus direct codebase inspection

---

## Summary

The blueprint PDF (`ironclaw_bastion_blueprint_v1.3.pdf`, v1.3 / March 2026) is the canonical spec for this phase. It defines a complete rearchitecture of how Ironclaw and Bastion integrate, moving from the current "single shared thread" model to a true **per-user Chief-of-Staff agent** where each Bastion user has their own identity context, role-specific persona, and standing orders baked into every Ironclaw interaction.

The current Bastion codebase has partial implementation of this vision — it has the core `IronclawService`, `IronclawClient`, `ironclawStore`, the Bastion MCP server scaffolding, and docker-compose topology. What is largely missing is: the per-user identity file system (USER.md / SOUL.md / HEARTBEAT.md / AGENTS.md written per-DID), the `AgentConfig` data model and UI, the MCP server tool expansion to cover the full blueprint tool catalog, PostgreSQL Row-Level Security on Ironclaw's workspace table, the Telegram pairing system, and the routines/heartbeat configuration layer.

The blueprint divides implementation into 6 sequential phases (Phase 0 through Phase 6). The first step — Phase 0 — is a mandatory security prerequisite: applying the PostgreSQL RLS migration to Ironclaw's database before any per-user data is written. Everything else builds on that foundation.

**Primary recommendation:** Follow the blueprint's implementation phase sequence exactly. Phase 0 (RLS + docker-compose consolidation) → Phase 1 (MCP server expansion) → Phase 2 (identity system + AgentConfig) → Phase 3 (Agent Config UI) → Phase 4 (Skills + Telegram) → Phase 5 (Routines + Heartbeat) → Phase 6 (Self-expansion + container updates).

---

## Standard Stack

### Core
| Library / Component | Version | Purpose | Why Standard |
|---------------------|---------|---------|--------------|
| Ironclaw | nearai/ironclaw:latest | Chief-of-Staff agent runtime | Defined by blueprint |
| pgvector/pgvector | pg16 | Ironclaw's PostgreSQL with vector search | Already in docker-compose |
| @modelcontextprotocol/sdk | current | MCP server for Bastion tool exposure | Already used in mcp-server.ts |
| claude-haiku-4-5-20251001 | — | LLM model (OAuth constraint) | Only model accessible via OAuth path |
| React (Vite) | current | Agent Config UI | Project standard |

### Supporting
| Library / Component | Version | Purpose | When to Use |
|---------------------|---------|---------|-------------|
| pgvector RLS policies | PostgreSQL 16 | Workspace path isolation per-user DID | Phase 0 — mandatory first |
| Anthropic OAuth credentials file | — | Extracted from `/shared/tokens` volume | Already wired in docker-compose |
| @modelcontextprotocol/sdk SSE transport | current | MCP over HTTP (Streamable HTTP) | MCP server expansion |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Haiku 4.5 (OAuth) | Sonnet via Bedrock | Bedrock path bypasses OAuth constraint but requires AWS GovCloud for SECRET data |
| PostgreSQL RLS | Application-level path check | RLS is the hard boundary; app-level is defence-in-depth only |
| Streamable HTTP MCP | stdio MCP | HTTP required since Ironclaw and Bastion run in separate containers |

**Installation:** No new npm packages required. The blueprint uses libraries already present in the codebase. The MCP server migration is a PostgreSQL DDL migration, not a code dependency.

---

## Architecture Patterns

### Recommended Project Structure (new files per blueprint Section 11)

```
backend/src/
├── ironclaw/
│   ├── ironclaw-service.ts          [MODIFY] add syncUserIdentity, per-DID dispatch
│   ├── ironclaw-client.ts           [MODIFY] add SET LOCAL app.current_did_slug
│   ├── identity-renderer.ts         [NEW] AgentConfig → USER.md / SOUL.md / HEARTBEAT.md / AGENTS.md
│   └── ironclaw-memory-service.ts   [existing — no change needed]
├── mcp/
│   ├── mcp-server.ts                [MODIFY] expand tool groups per blueprint
│   ├── tools/
│   │   ├── knowledge.ts             [NEW] knowledge_graph tool group
│   │   ├── operations.ts            [NEW] operations tool group
│   │   ├── calendar.ts              [NEW] calendar tool group
│   │   ├── resources.ts             [NEW] resources tool group
│   │   └── personnel.ts             [NEW] personnel tool group (clearance-gated)
│   └── middleware/
│       └── did-auth.ts              [NEW] DID VC claim middleware for MCP tool calls
├── api/
│   └── routes/
│       ├── agent-config.ts          [NEW] /api/agent-config/:userId handlers
│       ├── mcp.ts                   [MODIFY or NEW] mount MCP at bastion:4000
│       └── ironclaw-admin.ts        [NEW] GitHub release webhook + admin update route
└── models/
    └── AgentConfig.ts               [NEW] DB model + migration

frontend/src/
└── components/
    └── ironclaw/                    [existing]
    └── agent-config/                [NEW per blueprint Section 5]
        ├── AgentConfigPanel.tsx
        ├── tabs/
        │   ├── IdentityTab.tsx
        │   ├── PersonalityTab.tsx
        │   ├── SkillsTab.tsx
        │   ├── ChannelsTab.tsx
        │   ├── RoutinesTab.tsx
        │   └── AdvancedTab.tsx
        ├── components/
        │   ├── AgentPreviewChat.tsx
        │   ├── TelegramPairWizard.tsx
        │   └── RoutineEditor.tsx
        └── hooks/
            ├── useAgentConfig.ts
            └── useAgentPreview.ts

backend/database/migrations/
└── ironclaw_workspace_rls.sql       [NEW] Phase 0 mandatory RLS migration
```

### Pattern 1: Per-User Identity File Injection
**What:** Before every Ironclaw webhook call, Bastion writes four Markdown identity files to the Ironclaw workspace under `users/{didSlug}/identity/`. These files are loaded into the system prompt by Ironclaw for every job, making the agent behave as the user's personal Chief of Staff.
**When to use:** Every `handleMessage` call — the identity must be current before dispatch.

```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 3
// identity-renderer.ts (new file)
export function renderUserMd(config: AgentConfig): string {
  return `# USER.md — ${config.displayName}, ${config.position}
## Identity
- **DID:** ${config.did}
- **Name:** ${config.displayName}
- **Rank:** ${config.rank}
- **Position:** ${config.position}
- **Unit:** ${config.unit}
...
`;
}

// ironclaw-service.ts (modified)
async syncUserIdentity(did: string, config: AgentConfig): Promise<void> {
  const slug = didToSlug(did); // 'did:near:alice.near' → 'alice-near'
  await ironclawClient.sendMessage('system', `/file write users/${slug}/identity/USER.md\n${renderUserMd(config)}`);
  await ironclawClient.sendMessage('system', `/file write users/${slug}/identity/SOUL.md\n${renderSoulMd(config)}`);
  await ironclawClient.sendMessage('system', `/file write users/${slug}/identity/HEARTBEAT.md\n${renderHeartbeatMd(config)}`);
  await ironclawClient.sendMessage('system', `/file write users/${slug}/identity/AGENTS.md\n${renderAgentsMd(config)}`);
}
```

### Pattern 2: PostgreSQL RLS for Workspace Isolation
**What:** Ironclaw's workspace table gets `owner_did` column and RLS policies. `IronclawClient` sets `app.current_did_slug` via `SET LOCAL` before every webhook dispatch.
**When to use:** Phase 0 — must be applied before any per-user writes.

```sql
-- Source: ironclaw_bastion_blueprint_v1.3.pdf Section 11
-- migrations/ironclaw_workspace_rls.sql
ALTER TABLE workspace ADD COLUMN IF NOT EXISTS owner_did TEXT;
ALTER TABLE workspace ENABLE ROW LEVEL SECURITY;
CREATE POLICY workspace_write_own ON workspace
  FOR INSERT WITH CHECK (
    owner_did = current_setting('app.current_did_slug', true)
    OR owner_did = 'shared'
    OR current_setting('app.current_did_slug', true) IS NULL
  );
```

### Pattern 3: DID-Authenticated MCP Tool Calls
**What:** Every MCP tool call from Ironclaw carries the user's NEAR DID. The MCP middleware resolves it to VC claims (StaffRole, ClearanceLevel, UnitMembership) and gates tool access. No RBAC table lookup.
**When to use:** All MCP tool implementations — particularly the clearance-gated `personnel` group.

```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 4.1
// mcp/middleware/did-auth.ts (new file)
export async function resolveDIDClaims(did: string): Promise<VCClaim[]> {
  // Resolve DID document from NEAR blockchain → extract VC claims
  // Cache with 1-hour TTL per blueprint Section 6.1
}
```

### Pattern 4: Collaborative Architecture (One Agent, Many Lenses)
**What:** One Ironclaw process, one PostgreSQL database, one bot token. Users are differentiated by `users/{didSlug}/identity/` files loaded per job — not by separate processes.
**Workspace paths:**
- `users/{didSlug}/identity/` — per-user (USER.md, SOUL.md, HEARTBEAT.md, AGENTS.md)
- `users/{didSlug}/skills/` — per-user skill packs
- `users/{didSlug}/knowledge/` — per-user private context
- `shared/knowledge/` — readable by all users
- `shared/ops/`, `shared/intel/`, `shared/logistics/` — cross-staff output namespaces

### Anti-Patterns to Avoid
- **Separate Ironclaw processes per user:** One process handles all users via identity file injection — never spin up multiple instances.
- **Setting `ANTHROPIC_API_KEY` alongside `ANTHROPIC_OAUTH_TOKEN`:** The blueprint explicitly warns: "Setting both causes Ironclaw to prefer API key path." Only set the OAuth token.
- **Storing clearance level in `AgentConfig` table:** "Storing it here would create an RBAC bypass vector." Always read from ClearanceLevel VC claim at runtime.
- **Skipping Phase 0 RLS migration:** "This is the most important architectural constraint in the entire blueprint." Write without RLS and cross-user contamination is possible even in normal operation.
- **Routing SECRET-level data through commercial api.anthropic.com:** For SECRET workloads, use Bedrock (GovCloud) or self-hosted endpoint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-channel notification routing | Custom Telegram bot client | Ironclaw WASM Telegram channel (`/extension activate telegram`) | Already handles polling, auth, DM routing |
| Vector similarity search for workspace | pg embedding queries directly | Ironclaw's built-in `memory_search` tool with pgvector hybrid RRF | Ironclaw already owns this layer |
| Agent self-updating (binary) | cargo-dist / auto-updater | GitHub Release webhook → admin-triggered docker pull | Binary auto-updater doesn't apply to Docker deployments |
| WASM tool compilation | Custom build pipeline | Ironclaw's dynamic tool builder via natural language description | The blueprint's "self-expansion" capability handles this |
| Per-session isolation | Shared connection with user filtering | PostgreSQL RLS with `SET LOCAL app.current_did_slug` | Application-level filtering is not a hard boundary |

---

## Common Pitfalls

### Pitfall 1: RLS Migration Applied to Wrong Database
**What goes wrong:** The RLS migration targets Ironclaw's PostgreSQL (port 5433 / `ironclaw-postgres` container), NOT Bastion's main PostgreSQL (port 5432). Running it on the wrong database does nothing while leaving the actual gap open.
**Why it happens:** There are two PostgreSQL instances in docker-compose.yml.
**How to avoid:** Confirm migration applies to `DATABASE_URL=postgresql://ironclaw:ironclaw@ironclaw-postgres:5432/ironclaw`.
**Warning signs:** RLS policies show up in `bastion-postgres` but not `ironclaw-postgres`.

### Pitfall 2: `SET LOCAL app.current_did_slug` Requires Per-Connection Scoping
**What goes wrong:** `SET LOCAL` is scoped to the current transaction. If `IronclawService` sets the parameter on a pooled connection that is then reused by another user's request, the wrong DID enforces the wrong write boundary.
**Why it happens:** Connection pools reuse connections across requests.
**How to avoid:** Use a dedicated connection (or explicit transaction) per user webhook dispatch. The blueprint states: "Bastion service layer must set this parameter before any workspace write is executed by Ironclaw — using a connection-level parameter on the pooled connection assigned to that user's session."
**Warning signs:** Cross-user write attempts succeed instead of being rejected by RLS.

### Pitfall 3: OAuth Token Field Name in Credentials File
**What goes wrong:** The entrypoint script uses `jq -r '.oauth_token // .claudeAiOauthToken // .token'`. If the actual credentials file uses a different key (e.g., `.accessToken`), the token extraction silently returns `null` and Ironclaw starts without LLM access.
**Why it happens:** The blueprint documents multiple possible field names and calls this out explicitly.
**How to avoid:** Inspect the actual `/shared/tokens/` file before implementation and hardcode the correct `jq` field path.
**Warning signs:** Ironclaw health check passes but LLM calls return 401.

### Pitfall 4: MCP Server Port Conflict
**What goes wrong:** The blueprint specifies `bastion-mcp` on port 4000 internally (`http://bastion:4000/mcp`). Current docker-compose has `bastion-mcp` on port 3334. Ironclaw's MCP registration command will target 4000 and get connection refused.
**Why it happens:** Existing implementation predates the blueprint's port spec.
**How to avoid:** Reconcile the MCP server port — either update `MCP_PORT` env to 4000 or update the Ironclaw registration command to use 3334.
**Warning signs:** `/mcp add bastion-core` registration completes but tool discovery returns empty.

### Pitfall 5: Identity Files Not Injected Before First Message
**What goes wrong:** If `syncUserIdentity` is called lazily (only on AgentConfig save) rather than on every session start, a user whose config hasn't changed since last login will get the agent responding without their USER.md loaded.
**Why it happens:** `syncUserIdentity` is an expensive write operation developers want to minimize.
**How to avoid:** Call `syncUserIdentity` at session start (first message of a new session), not only on config changes. The blueprint specifies "written by Bastion" before each job.
**Warning signs:** Agent responds generically without role-aware framing on first message of a new session.

### Pitfall 6: Telegram Pairing Bot Token Exposure
**What goes wrong:** If `TELEGRAM_BOT_TOKEN` is set as a plain env var in docker-compose, it is visible in `docker inspect` and container logs.
**Why it happens:** Convenience over security.
**How to avoid:** Store token in Ironclaw's AES-256-GCM Secrets Store via `POST /webhook { message: '/secret set TELEGRAM_BOT_TOKEN <token>' }` at startup. Never put it in docker-compose env.
**Warning signs:** `docker inspect bastion-ironclaw` shows plaintext token.

---

## Code Examples

### AgentConfig Database Model (new table)
```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 6.1
interface AgentConfig {
  did: string;               // Primary key: 'did:near:alice.near'
  nearAccount: string;       // 'alice.near'
  verifiedClaims: VCClaim[]; // Cached from NEAR chain, 1-hour TTL
  lastVCResolution: Date;
  displayName: string;
  rank: string;
  staffSection: StaffSection; // 'Commander' | 'S1' | 'S2' | 'S3' | 'S4' | 'S6' | 'S9' | 'XO' | 'CSM' | 'Other'
  position: string;
  unit: string;
  higherHQ: string;
  reportingToDid: string | null;
  activeOperationIds: string[];
  areasOfResponsibility: string[];
  // NOTE: clearanceLevel NOT stored — always read from ClearanceLevel VC claim
  blufEnforced: boolean;
  outputFormat: 'MDMP' | 'StaffSummary' | 'FreeForm' | 'Auto';
  verbosityLevel: number;   // 1-5
  tone: 'FormalMilitary' | 'Professional' | 'Direct' | 'Collaborative';
  expandAcronyms: boolean;
  classificationMarkings: boolean;
  customPersonaInstructions: string;
  telegramEnabled: boolean;
  telegramChatId: string | null;
  telegramNotificationLevel: 'Critical' | 'Urgent' | 'Routine' | 'Informational';
  enabledSkillPacks: string[];
  customSkills: CustomSkill[];
  heartbeatDirectives: string;
  customRoutines: RoutineSpec[];
  identityLastSyncedAt: Date;
}
```

### DID Slug Conversion
```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 3.1 (convention)
// did:near:alice.near → 'alice-near' (workspace path safe)
function didToSlug(did: string): string {
  return did.replace('did:near:', '').replace(/\./g, '-');
}
// Workspace path: users/alice-near/identity/USER.md
```

### Bastion MCP Server Registration with Ironclaw
```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 4.2
// Called once at Bastion container startup (after Ironclaw health check passes)
async function registerBastionMcpWithIronclaw(): Promise<void> {
  await ironclawClient.sendMessage('init', '/mcp add bastion-core http://bastion:4000/mcp');
}
```

### SOUL.md Template by Staff Section
```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 3.3
const SOUL_TEMPLATES: Record<StaffSection, string> = {
  Commander: `Strategic framing, course-of-action analysis, decision brief format...`,
  S2: `Analytical rigor, probabilistic language ('likely', 'confirm/deny'), threat-centric framing...`,
  S3: `MDMP-structured outputs, BLUF discipline, synchronization matrix thinking, OPORD/FRAGO formatting...`,
  S4: `LOGSTAT awareness, class-of-supply categorization, maintenance readiness framing...`,
  // ... etc
};
```

### Telegram Pairing Flow
```typescript
// Source: ironclaw_bastion_blueprint_v1.3.pdf Section 5.5
// Step 1: Initiate
await ironclawClient.sendMessage(userDid, '/telegram pair');
// Step 2: User receives 6-digit code in Telegram
// Step 3: Confirm
await ironclawClient.sendMessage(userDid, `/telegram confirm ${code}`);
```

---

## Gap Analysis: What Exists vs What Blueprint Requires

### Already Implemented (Confirmed by Codebase Inspection)

| Blueprint Component | Status | Location |
|---------------------|--------|----------|
| Ironclaw container + pgvector DB | Done | `docker-compose.yml` lines 60-115 |
| `bastion-network` / `ironclaw-network` topology | Done | `docker-compose.yml` |
| `IronclawClient` (webhook HTTP client) | Done | `ironclaw-client.ts` |
| `IronclawService` (orchestration) | Done (partial) | `ironclaw-service.ts` — 928 lines |
| `ironclawStore` (message persistence) | Done | `ironclaw-store.ts` |
| Bastion MCP Server (scaffold) | Done (partial) | `mcp/mcp-server.ts` |
| `BASTION_TOOLS` (tool bridge) | Done (partial) | `ironclaw/tool-bridge.ts` |
| `IronclawDrawer` UI component | Done | `frontend/src/components/ironclaw/` |
| `IronclawMemoryPanel` + REST API | Done (Phase 57) | `ironclaw-memory-*.ts` |
| `selfUpdateService` (GitHub release polling) | Done | `self-update-service.ts` |
| Tab-specific guidance in messages | Done | `getTabGuidance()` in ironclaw-service.ts |
| KG context injection into messages | Done | `kg-context-service.ts` |
| Memory block injection into messages | Done | `ironclaw-memory-service.ts` |

### Missing (New Work for Phase 60)

| Blueprint Component | Gap | Section |
|---------------------|-----|---------|
| PostgreSQL RLS on Ironclaw workspace table | Not implemented | Sec 1.8, Sec 11 |
| `ironclaw_users` lookup table (did_slug → did) | Not implemented | Sec 11 |
| `identity-renderer.ts` | Not implemented | Sec 3, Sec 11 |
| `syncUserIdentity()` method on IronclawService | Not implemented | Sec 3.1 |
| `AgentConfig` database table + migration | Not implemented | Sec 6.1 |
| `/api/agent-config/:userId` REST endpoints | Not implemented | Sec 6 |
| `AgentConfigPanel` + 7 tab components | Not implemented | Sec 5 |
| `AgentPreviewChat` component | Not implemented | Sec 5.7 |
| `TelegramPairWizard` component | Not implemented | Sec 5.5 |
| `RoutineEditor` component | Not implemented | Sec 5.6 |
| Telegram WASM channel activation | Not implemented | Sec 8.1 |
| Role-specific SOUL.md templates (7 roles) | Not implemented | Sec 3.3 |
| Role skill packs (SKILL.md files x7) | Not implemented | Sec 5.4 |
| `shared/knowledge/BASTION_CONTEXT.md` seeding | Not implemented | Sec 4.3 |
| Knowledge sync routine (`bastion_knowledge_sync`) | Not implemented | Sec 4.3 |
| MCP middleware: DID VC claim resolution per tool | Not implemented | Sec 4.1 |
| MCP tool groups: knowledge, operations, calendar, resources, personnel | Partial (tool-bridge has some, needs expansion) | Sec 4.1 |
| GitHub release webhook endpoint | Partial (self-update polls, but no webhook receiver) | Sec 7.5 |
| Admin-triggered `/api/admin/ironclaw-update` | Not implemented | Sec 7.5 |
| HEARTBEAT.md per-user monitoring directives | Not implemented | Sec 3.4 |
| `bastion_user_knowledge_sync` routine (on login) | Not implemented | Sec 4.3 |
| `weekly_capability_update` Ironclaw routine | Not implemented | Sec 7.4 |

---

## Implementation Phase Sequence (from Blueprint Section 9)

The blueprint prescribes a strict sequence. The planner MUST follow this order:

| Blueprint Phase | Description | Blocking Prerequisite |
|----------------|-------------|----------------------|
| **Phase 0** | Infrastructure: RLS migration, docker-compose consolidation, MCP registration at startup, smoke test | Nothing — FIRST step |
| **Phase 1** | Bastion MCP Server expansion: full tool groups, DID auth middleware | Phase 0 |
| **Phase 2** | Identity system: identity-renderer.ts, syncUserIdentity, AgentConfig DB model + migration, GET/PUT endpoints | Phase 0 |
| **Phase 3** | Agent Config UI: AgentConfigPanel, IdentityTab, PersonalityTab, AgentPreviewChat | Phase 2 |
| **Phase 4** | Skills + Telegram: SkillsTab, skill packs, ChannelsTab, TelegramPairWizard | Phase 3 |
| **Phase 5** | Routines + Heartbeat: RoutinesTab, RoutineEditor, knowledge sync, heartbeat directives | Phase 4 |
| **Phase 6** | Self-expansion + container updates: AdvancedTab, WASM tools, GitHub release webhook, admin update route | Phase 5 |

---

## Architecture Patterns

### Collaborative Knowledge Model
The shared workspace is the integration bus. All users read/write to `shared/knowledge/`. Role-specific sections (`shared/ops/`, `shared/intel/`, `shared/logistics/`) enable cross-staff coordination without explicit file sharing. This replicates the military staff model in software.

### Notification Priority Routing
| Priority Level | Channel |
|----------------|---------|
| CRITICAL | Telegram DM + Bastion in-app notification |
| URGENT | Telegram during duty hours; Bastion-only outside |
| ROUTINE | Bastion in-app only; daily digest |
| INFORMATIONAL | Workspace memory write only |

### Workspace Path Convention
```
users/{didSlug}/identity/     — USER.md, SOUL.md, HEARTBEAT.md, AGENTS.md
users/{didSlug}/skills/       — installed skill packs
users/{didSlug}/knowledge/    — private context
shared/knowledge/             — doctrine, SOPs, policy
shared/ops/ | shared/intel/ | shared/logistics/ — cross-staff output
```
DID slug conversion: `did:near:alice.near` → `alice-near`

---

## State of the Art

| Old Approach | Current Approach (Blueprint) | Impact |
|--------------|------------------------------|--------|
| Single global thread_id per problem set | Per-user thread_id keyed by DID | Agent maintains individual conversation history per user |
| Generic system prompt for all users | USER.md + SOUL.md per DID loaded per job | Agent behaves as role-specific Chief of Staff |
| Manual memory injection via `memoryRetrievalService` | Identity files + memory + KG context all injected | Richer, structured per-user context |
| HTTP webhook only (no MCP from Ironclaw) | Ironclaw as MCP client to Bastion (bidirectional) | Agent can take actions inside Bastion natively |
| No workspace path enforcement | PostgreSQL RLS on workspace table | Hard security boundary for multi-user deployment |
| Self-update via polling only | GitHub Release webhook + admin-confirmed update | Deliberate admin control over container upgrades |

**Deprecated/outdated in current codebase:**
- `IronclawClient.sendMessage(session.id, messageForAi)` without `SET LOCAL app.current_did_slug` first — creates cross-user write vulnerability once per-user identities are active
- MCP server DID auth via `MCP_ALLOWED_DIDS` env var allowlist — blueprint replaces this with dynamic VC claim resolution per tool call

---

## Open Questions

1. **MCP port reconciliation**
   - What we know: Current docker-compose has `bastion-mcp` on port 3334, blueprint specifies `http://bastion:4000/mcp` for Ironclaw connection
   - What's unclear: Is port 4000 a new port to expose on the `backend` container (not the separate `bastion-mcp` container)?
   - Recommendation: The blueprint's architecture uses `backend:4000` as the MCP endpoint served inline from the backend process (not the standalone `bastion-mcp` container). Reconcile by either routing through `bastion-mcp:3334` or adding port 4000 to the backend service.

2. **Ironclaw workspace write mechanism**
   - What we know: The blueprint describes writing identity files "to Ironclaw workspace via webhook." The `/file write` command format is inferred from Ironclaw's CLI docs.
   - What's unclear: The exact webhook command format for workspace file writes (could be `/file write`, `/memory write`, or a direct filesystem write via a dedicated endpoint).
   - Recommendation: Test with the actual Ironclaw container: `POST /webhook { message: '/file write users/test/identity/USER.md\n...', secret: ... }` and verify the file appears in the workspace volume.

3. **VC Claim resolution from NEAR**
   - What we know: Blueprint says DID documents are encrypted on-chain and require holder's key material, which Ironclaw stores in its Secrets Store.
   - What's unclear: Bastion's existing `@vitalpoint/near-phantom-auth` already handles NEAR auth. Whether it exposes VC claim resolution or whether new code is needed.
   - Recommendation: Check `backend/src/auth/` and `backend/src/near/` for existing VC resolution before building `did-auth.ts` middleware.

4. **Skill pack format for Ironclaw**
   - What we know: Skills are SKILL.md files with YAML frontmatter (triggers, required_tools, trust). Written to `users/{slug}/skills/`.
   - What's unclear: The exact YAML frontmatter schema Ironclaw expects for SKILL.md files.
   - Recommendation: Check Ironclaw documentation or container to find the SKILL.md schema before building the 7 role skill packs.

---

## Validation Architecture

No `nyquist_validation` key found in `.planning/config.json` — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compilation + Jest (backend), Vitest (frontend) |
| Config file | `backend/package.json` test script |
| Quick run command | `cd backend && npm test -- --testPathPattern=ironclaw` |
| Full suite command | `cd backend && npm test` |

### Phase Requirements to Test Map
| Behavior | Test Type | Notes |
|----------|-----------|-------|
| RLS blocks cross-user workspace writes | Integration | Run against Ironclaw PostgreSQL with two test DID slugs |
| `syncUserIdentity` writes correct USER.md format | Unit | Test identity-renderer.ts renderers |
| AgentConfig CRUD endpoints (GET/PUT) | Integration | Use supertest against express routes |
| MCP tool DID auth middleware gates clearance-gated tools | Unit | Mock VC claim resolution |
| Telegram pairing flow completes | Integration | Requires Telegram bot token in test env |
| AgentPreviewChat streams response | E2E | Requires live Ironclaw container |

### Wave 0 Gaps
- [ ] `backend/src/ironclaw/identity-renderer.test.ts` — unit tests for renderer functions
- [ ] `backend/database/migrations/ironclaw_workspace_rls.sql` — RLS migration file
- [ ] `backend/src/models/AgentConfig.ts` — database model
- [ ] `backend/src/mcp/middleware/did-auth.test.ts` — VC claim middleware tests

---

## Sources

### Primary (HIGH confidence)
- `ironclaw_bastion_blueprint_v1.3.pdf` (March 2026) — complete integration spec, all sections read
- `docker-compose.yml` — actual container topology confirmed
- `backend/src/ironclaw/*.ts` — all existing Ironclaw files inspected (ironclaw-service.ts 928 lines, ironclaw-client.ts 122 lines, ironclaw-router.ts inspected, tool-bridge.ts inspected, self-update-service.ts inspected)
- `backend/src/mcp/mcp-server.ts` — existing MCP server inspected
- `frontend/src/components/ironclaw/` — all UI components confirmed present

### Secondary (MEDIUM confidence)
- MEMORY.md project memory — confirms Ironclaw is Chief of Staff, Phase 57 completed memory management
- `.planning/STATE.md` — confirms Phase 57 as last completed phase

---

## Metadata

**Confidence breakdown:**
- Blueprint content: HIGH — full PDF extracted and read
- Current codebase state: HIGH — direct file inspection
- Gap analysis (what's missing): HIGH — cross-referenced blueprint against codebase
- Implementation sequence: HIGH — from blueprint Section 9 directly
- Open questions (NEAR VC, workspace write API): LOW-MEDIUM — requires runtime verification

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (blueprint is pinned v1.3 — stable; Ironclaw container API may evolve)
