# Phase 30: Ironclaw Agent Integration - Research

**Researched:** 2026-03-07
**Domain:** AI agent orchestration, LLM-powered chief-of-staff, action execution with safety gates
**Confidence:** MEDIUM

## Summary

Phase 30 integrates Ironclaw (NEAR AI's Rust-based agent runtime) as BASTION's unified AI surface, replacing the per-tab AI staff system (Phase 29) with a single orchestrated chief-of-staff interface. Ironclaw is an open-source agent runtime that supports multiple LLM providers (including NEAR AI, Anthropic, OpenAI), has built-in tool systems (WASM sandbox + MCP protocol), approval workflows, and communicates via HTTP webhooks, web gateway (SSE/WebSocket), and REPL channels.

The integration architecture positions Ironclaw as a sidecar service alongside the existing Express backend. BASTION's backend acts as the coordination layer: receiving user messages from the frontend drawer panel, forwarding them to Ironclaw's HTTP/gateway endpoint, receiving streamed responses, and routing actions through the existing gate system for confirmation. The existing `ai-staff-store.ts` chat tables provide conversation persistence, and the gate service handles high-impact action confirmation with blockchain audit trails.

**Primary recommendation:** Deploy Ironclaw as a Docker sidecar service communicating with the BASTION backend via HTTP webhook channel. Build a backend orchestration layer (`ironclaw-service.ts`) that bridges frontend WebSocket messages to Ironclaw, registers BASTION-specific tools (problem set CRUD, code change PR creation, resource management) as MCP tools, and routes action confirmations through the existing gate system.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Ironclaw replaces/absorbs the per-tab AI staff system as the single unified AI surface
- Dedicated floating button + slide-out drawer panel, always accessible regardless of tab
- Visible delegation to specialist agents: when Ironclaw routes to a specialist (e.g., J2 Intel), the specialist's response appears attributed in the chat
- Users can @mention specific agents for direct specialist interaction within the same panel -- both user and Ironclaw see/remember these exchanges
- Step-by-step streaming for multi-step action execution (each step appears as it happens)
- Proactive suggestions appear as in-chat suggestion cards with accept/dismiss buttons
- Persistent conversation history per problem set across sessions
- Always confirm by default -- every action requires explicit user confirmation initially
- Users can grant "always allow" for specific action types (yes/no/always pattern)
- "Always allow" trust stored per-user per-problem-set in a user preferences table
- Scope escalation prevention: hard block + escalation option via existing Gate system when user tries to act outside their problem set
- No extra authentication for system admin actions -- role is sufficient, confirmation gates still apply
- Ambiguous scope (current PS vs children): agent always asks to clarify, never assumes
- Hybrid gate approach: lightweight inline confirms in chat for low/medium-risk actions, full Decision Gates (Phase 28) for high-impact and destructive actions
- Full Decision Gates get escalation, timeout, and blockchain audit trail capabilities
- Audit trail: PostgreSQL as primary detailed log for all actions, periodic blockchain hash anchoring for tamper-proof verification
- Full code changes allowed -- agent can propose any code change via PR with mandatory review
- GitHub platform: PRs created via GitHub API, CI/CD via GitHub Actions
- Change preview: high-level summary in Ironclaw panel + link to full diff on GitHub
- Auto-deploy on merge: merged PRs trigger automatic deployment, agent reports deployment status
- Emergency mode: system admin can fast-track changes with extra audit trail logging, auto-reverts if CI fails
- Ironclaw must keep itself up to date with new releases automatically
- Update notifications appear in the Ironclaw panel as system-level messages to the system admin
- Update process should be non-disruptive (graceful restart or hot-reload where possible)

### Claude's Discretion
- Failure handling strategy per action type (rollback vs stop-and-report)
- Rate limiting design (per-action-type limits vs global cooldown)
- Exact floating button placement to avoid conflicts with other UI elements
- Loading/progress visual patterns for streamed actions
- Blockchain anchoring frequency and batch size
- Emergency mode guard rails and justification requirements
- Self-update mechanism details (polling interval, rollback on failed update, changelog parsing)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Ironclaw | latest release | AI agent runtime (sidecar) | NEAR AI's official agent framework, Rust binary with TEE security |
| @octokit/rest | ^21.x | GitHub API client for PR creation | Official GitHub SDK, TypeScript-native |
| eventsource-parser | ^3.x | SSE stream parsing from Ironclaw gateway | Lightweight, handles Ironclaw's SSE format |

### Existing (Reuse)
| Library | Purpose | Integration Point |
|---------|---------|-------------------|
| @langchain/langgraph | Agent graph orchestration | Existing LLM factory + graph infrastructure |
| @langchain/anthropic | LLM provider | Existing agent LLM configuration |
| pg / getPool() | PostgreSQL persistence | Chat history, action audit, trust preferences |
| pg-boss / getSharedBoss() | Job queue | Async action execution, blockchain anchoring batches |
| express + WebSocket | API + real-time | Ironclaw panel endpoints + streaming |
| casbin (ABAC) | Authorization | Zero-trust middleware for permission tiers |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @octokit/webhooks | ^13.x | Validate GitHub webhook payloads | Receiving PR merge/CI status events |
| crypto (Node built-in) | N/A | SHA-256 hash computation for blockchain anchoring | Audit trail batch hashing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Ironclaw sidecar | Direct LangGraph agent | Loses TEE security, WASM sandbox, MCP tool ecosystem; but simpler deployment |
| @octokit/rest | Raw GitHub API via axios | Octokit handles pagination, rate limiting, auth; raw fetch is leaner |
| SSE streaming from Ironclaw | WebSocket to Ironclaw gateway | SSE is simpler for server-push; WS needed only for bidirectional real-time |

**Installation:**
```bash
# Backend additions
cd backend && pnpm add @octokit/rest @octokit/webhooks eventsource-parser

# Ironclaw deployed as Docker sidecar -- no npm package
# See docker-compose.prod.yml additions
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── ironclaw/                    # NEW: Ironclaw integration layer
│   ├── ironclaw-client.ts       # HTTP client to Ironclaw sidecar
│   ├── ironclaw-service.ts      # Orchestration: message routing, action execution
│   ├── ironclaw-router.ts       # Express endpoints for frontend panel
│   ├── ironclaw-store.ts        # PostgreSQL: sessions, trust prefs, audit log
│   ├── ironclaw-types.ts        # Type definitions
│   ├── action-registry.ts       # Action type definitions + risk classification
│   ├── tool-bridge.ts           # Register BASTION tools as MCP for Ironclaw
│   ├── github-service.ts        # PR creation, CI status, deployment tracking
│   ├── self-update-service.ts   # Release detection, update orchestration
│   └── index.ts                 # Barrel exports
├── ai-staff/                    # EXISTING: gradually absorbed, chat tables reused
├── gates/                       # EXISTING: reused for high-impact confirmations
└── security/                    # EXISTING: zero-trust middleware reused

frontend/src/
├── components/ironclaw/         # NEW: Ironclaw UI components
│   ├── IronclawDrawer.tsx       # Slide-out drawer panel
│   ├── IronclawButton.tsx       # Floating trigger button
│   ├── IronclawMessage.tsx      # Chat message (user/agent/specialist)
│   ├── IronclawActionCard.tsx   # Inline confirmation card (yes/no/always)
│   ├── IronclawSuggestion.tsx   # Proactive suggestion card
│   ├── IronclawStepStream.tsx   # Multi-step action progress
│   ├── IronclawCodePreview.tsx  # PR summary + GitHub link
│   └── index.ts
├── context/IronclawContext.tsx  # NEW: replaces AIStaffContext
├── hooks/useIronclaw.ts         # NEW: WebSocket + API hooks
└── services/ironclaw-api.ts     # NEW: REST/WS client
```

### Pattern 1: Sidecar Communication Architecture
**What:** Ironclaw runs as a Docker container alongside the backend. Backend communicates via Ironclaw's HTTP webhook channel.
**When to use:** All Ironclaw interactions -- the backend is the sole bridge between frontend users and Ironclaw.
**Example:**
```typescript
// backend/src/ironclaw/ironclaw-client.ts
export class IronclawClient {
  private baseUrl: string; // e.g., http://ironclaw:3000

  async sendMessage(sessionId: string, content: string): Promise<ReadableStream> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        message: content,
      }),
    });
    // Returns SSE stream for step-by-step streaming
    return response.body!;
  }

  async registerTool(tool: MCPToolDefinition): Promise<void> {
    await fetch(`${this.baseUrl}/api/tools`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tool),
    });
  }
}
```

### Pattern 2: Action Confirmation Pipeline
**What:** Two-tier confirmation system -- inline chat confirms for low/medium risk, Decision Gates for high-impact actions.
**When to use:** Every action Ironclaw wants to execute.
**Example:**
```typescript
// Action risk classification
const ACTION_RISK: Record<string, 'low' | 'medium' | 'high'> = {
  'ps.read': 'low',
  'ps.update_field': 'medium',
  'ps.create_child': 'medium',
  'code.create_pr': 'high',
  'code.emergency_deploy': 'high',
  'system.update_config': 'high',
  'resource.delete': 'high',
};

// Pipeline
async function executeAction(action: IronclawAction, userId: string, psId: string) {
  const risk = ACTION_RISK[action.type] ?? 'high';
  const trust = await ironclawStore.getTrustPreference(userId, psId, action.type);

  if (trust === 'always_allow' && risk !== 'high') {
    // Execute immediately, log to audit
    return await performAction(action);
  }

  if (risk === 'high') {
    // Create Decision Gate (Phase 28)
    const gate = await gateService.createGate({
      problem_set_id: psId,
      gate_type: 'agent_action' as any, // extend GateType
      target_item_id: action.id,
      target_item_type: 'ironclaw_action',
      target_item_title: action.description,
      enforcement: 'hard_block',
    });
    return { pending: true, gateId: gate.id };
  }

  // Low/medium: inline confirm in chat
  return { confirm: true, action, options: ['yes', 'no', 'always'] };
}
```

### Pattern 3: Specialist Agent Delegation
**What:** When Ironclaw routes to a specialist (J2 Intel, J3 Ops, etc.), the response is attributed to that specialist in the chat.
**When to use:** Domain-specific queries within the unified panel.
**Example:**
```typescript
// Chat message with specialist attribution
interface IronclawChatMessage {
  id: string;
  content: string;
  sender: 'user' | 'ironclaw' | 'specialist';
  // For specialist messages:
  specialistId?: string;        // e.g., 'j2-intel'
  specialistDisplayName?: string; // e.g., 'J2 Intelligence'
  delegatedBy?: string;         // always 'ironclaw'
  timestamp: string;
  // For action messages:
  actionCard?: ActionCardData;
  stepProgress?: StepProgressData;
}
```

### Pattern 4: Trust Preference Storage
**What:** Per-user per-problem-set "always allow" preferences stored in PostgreSQL.
**When to use:** After user selects "always" on an action confirmation.
**Example:**
```sql
CREATE TABLE IF NOT EXISTS ironclaw_trust_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_did TEXT NOT NULL,
  problem_set_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_did, problem_set_id, action_type)
);
```

### Anti-Patterns to Avoid
- **Direct frontend-to-Ironclaw communication:** All traffic must route through the backend for auth, audit, and scope validation. Never expose Ironclaw's ports to the frontend.
- **Skipping confirmation for "obvious" actions:** Always confirm by default. The trust system handles automation gradually.
- **Storing chat in Ironclaw only:** Dual-store -- Ironclaw has its own session memory but BASTION must persist chat in PostgreSQL for cross-session continuity and audit.
- **Single-message response pattern:** Use SSE/streaming for all Ironclaw responses. Multi-step actions must show progress per step.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GitHub PR creation | Custom GitHub API calls | @octokit/rest | Handles auth, pagination, rate limits, types |
| SSE stream parsing | Custom text/event-stream parser | eventsource-parser | Edge cases in SSE spec (retry, multiline data) |
| Agent reasoning loop | Custom LLM tool-call loop | Ironclaw's built-in agent loop | 10-iteration limit, parallel tool exec, safety layer |
| WASM tool sandboxing | Custom sandbox for untrusted tools | Ironclaw's WASM sandbox | Capability-based permissions, leak detection |
| Action confirmation UI | Custom modal system | Extend existing gate UI patterns | Consistent with Phase 28 gate UX |
| WebSocket management | Raw ws library | Existing MessageBus pattern | Already handles pub/sub, ABAC filtering |
| LLM provider switching | Custom provider abstraction | Ironclaw's LlmProvider trait + existing llm-factory.ts | Multi-provider failover built in |

**Key insight:** Ironclaw handles the hard AI agent problems (reasoning loop, tool sandboxing, memory management). BASTION's job is bridging Ironclaw to its domain-specific systems (gates, problem sets, NEAR blockchain) and providing the UI.

## Common Pitfalls

### Pitfall 1: State Divergence Between Ironclaw and BASTION
**What goes wrong:** Ironclaw maintains its own conversation state in its database, but BASTION also stores chat in `ai_staff_chat`. They drift out of sync.
**Why it happens:** Two sources of truth for the same data.
**How to avoid:** BASTION's PostgreSQL is the primary chat store. On each message exchange, persist to BASTION first, then forward to Ironclaw with session context. On restart, hydrate Ironclaw sessions from BASTION's store.
**Warning signs:** Users see different history when Ironclaw container restarts.

### Pitfall 2: Blocking on Ironclaw Responses
**What goes wrong:** Backend blocks Express event loop waiting for Ironclaw's multi-step reasoning (can take 30-60 seconds for complex actions).
**Why it happens:** Synchronous request/response pattern instead of streaming.
**How to avoid:** Use SSE streaming from Ironclaw's gateway. Backend receives chunks and forwards via WebSocket to frontend. Never await full completion.
**Warning signs:** Request timeouts, unresponsive backend during agent reasoning.

### Pitfall 3: Scope Leakage Across Problem Sets
**What goes wrong:** Ironclaw executes an action on wrong problem set because user context wasn't scoped properly.
**Why it happens:** Ironclaw sessions aren't inherently problem-set-aware.
**How to avoid:** Every Ironclaw session is bound to exactly one problem set ID. Tool bridge validates scope on every tool invocation. Ambiguous references trigger clarification prompt.
**Warning signs:** Actions affecting sibling or parent problem sets unexpectedly.

### Pitfall 4: GitHub Token Exposure
**What goes wrong:** GitHub PAT for PR creation leaks through Ironclaw's tool responses or logs.
**Why it happens:** Token passed to Ironclaw tool, which may include it in reasoning traces.
**How to avoid:** GitHub operations execute in the BASTION backend, not inside Ironclaw. Ironclaw calls a BASTION-registered MCP tool that internally uses Octokit. Token never leaves backend process.
**Warning signs:** Tokens appearing in chat messages or Ironclaw debug logs.

### Pitfall 5: Docker Networking Between Sidecar and Backend
**What goes wrong:** Backend can't reach Ironclaw container, or ports conflict.
**Why it happens:** Docker compose networking misconfiguration.
**How to avoid:** Use Docker compose service names for inter-container networking (e.g., `http://ironclaw:3000`). Keep Ironclaw on internal network only -- no port mapping to host.
**Warning signs:** Connection refused errors, DNS resolution failures.

### Pitfall 6: Self-Update Breaking Active Sessions
**What goes wrong:** Ironclaw self-update restarts the container mid-conversation, losing in-flight actions.
**Why it happens:** No graceful shutdown coordination.
**How to avoid:** Self-update service checks for active sessions before restart. Drain connections with a timeout. Frontend shows "update pending" status. Queue the update for next idle window.
**Warning signs:** Users lose mid-conversation context after updates.

## Code Examples

### Docker Compose Sidecar Configuration
```yaml
# docker-compose.prod.yml additions
services:
  ironclaw:
    image: ghcr.io/nearai/ironclaw:latest
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ironclaw:${IRONCLAW_DB_PASSWORD}@postgres:5432/ironclaw
      LLM_BACKEND: near-ai
      NEAR_AI_TOKEN: ${NEAR_AI_TOKEN}
    volumes:
      - ironclaw-data:/home/ironclaw/.ironclaw
    networks:
      - internal
    depends_on:
      - postgres
    # No ports exposed to host -- backend accesses via internal network

  backend:
    environment:
      IRONCLAW_URL: http://ironclaw:3000
      GITHUB_TOKEN: ${GITHUB_TOKEN}
    depends_on:
      - ironclaw
```

### Backend Ironclaw Router Pattern
```typescript
// backend/src/ironclaw/ironclaw-router.ts
import { Router } from 'express';

export const ironclawRouter = Router();

// POST /api/ironclaw/:problemSetId/message
// Sends user message, streams response via WebSocket
ironclawRouter.post('/:problemSetId/message', async (req, res) => {
  const { problemSetId } = req.params;
  const { content, mentionedAgent } = req.body;
  const userDid = req.zeroTrust?.did;

  // 1. Validate scope: user has access to this problem set
  // 2. Persist user message to ironclaw_chat
  // 3. Forward to Ironclaw with session context
  // 4. Stream response chunks via WebSocket channel
  // 5. Persist agent response to ironclaw_chat
  // 6. If action required, create confirmation card
});

// POST /api/ironclaw/:problemSetId/confirm
// User confirms/denies/always-allows an action
ironclawRouter.post('/:problemSetId/confirm', async (req, res) => {
  const { actionId, decision } = req.body; // 'yes' | 'no' | 'always'
  // Handle trust preference storage and action execution
});

// GET /api/ironclaw/:problemSetId/history
ironclawRouter.get('/:problemSetId/history', async (req, res) => {
  // Return persisted chat history
});

// GET /api/ironclaw/trust-preferences
ironclawRouter.get('/trust-preferences', async (req, res) => {
  // Return user's always-allow preferences
});
```

### Frontend Drawer Component Pattern
```typescript
// frontend/src/components/ironclaw/IronclawDrawer.tsx
// Slide-out panel with:
// - Chat message list (user, ironclaw, specialist attributed)
// - Message input with @mention autocomplete
// - Inline action cards (yes/no/always buttons)
// - Step-by-step progress for multi-step actions
// - Suggestion cards with accept/dismiss
// Position: fixed right, z-index 950 (above floating AI staff 900, below modals 1000+)
```

### Audit Trail Schema
```sql
CREATE TABLE IF NOT EXISTS ironclaw_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  problem_set_id TEXT NOT NULL,
  user_did TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_payload JSONB NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'medium',
  decision TEXT NOT NULL, -- 'approved' | 'denied' | 'auto_approved' | 'gate_pending'
  gate_id UUID REFERENCES decision_gates(id),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ironclaw_action_log_ps ON ironclaw_action_log (problem_set_id);
CREATE INDEX idx_ironclaw_action_log_user ON ironclaw_action_log (user_did);

-- Blockchain anchoring batch hash table
CREATE TABLE IF NOT EXISTS ironclaw_audit_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_start TIMESTAMPTZ NOT NULL,
  batch_end TIMESTAMPTZ NOT NULL,
  action_count INTEGER NOT NULL,
  merkle_root TEXT NOT NULL, -- SHA-256 of batch
  tx_hash TEXT, -- NEAR blockchain transaction hash (null until anchored)
  anchored_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### MCP Tool Registration for BASTION Domain
```typescript
// backend/src/ironclaw/tool-bridge.ts
// Register BASTION-specific tools with Ironclaw via MCP protocol
const BASTION_TOOLS = [
  {
    name: 'bastion.problem_set.read',
    description: 'Read problem set details and configuration',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    riskLevel: 'low',
  },
  {
    name: 'bastion.problem_set.update',
    description: 'Update problem set fields',
    inputSchema: { /* ... */ },
    riskLevel: 'medium',
  },
  {
    name: 'bastion.code.create_pr',
    description: 'Create a GitHub PR with proposed code changes',
    inputSchema: { /* ... */ },
    riskLevel: 'high',
  },
  {
    name: 'bastion.gate.create',
    description: 'Create a decision gate for approval',
    inputSchema: { /* ... */ },
    riskLevel: 'medium',
  },
  // ... more domain tools
];
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-tab AI staff panels | Unified chief-of-staff drawer | Phase 30 (now) | Single point of AI interaction, specialist delegation |
| Simple chat completion | Agent runtime with tool loop | Ironclaw Feb 2026 | Multi-step reasoning, tool execution, safety layer |
| Manual code changes | Agent-proposed PRs via GitHub API | Phase 30 (now) | AI can modify the system it runs on, with review gates |
| Per-action blockchain logging | Batch hash anchoring | Phase 30 (now) | Cost-effective tamper-proof audit trail |

**Deprecated/outdated:**
- Phase 29 per-tab AI staff panel: absorbed into Ironclaw unified interface. `AIStaffPanel`, `AIStaffDocked`, `AIStaffFloating` components deprecated. `AIStaffContext` replaced by `IronclawContext`. Backend `ai-staff-router.ts` endpoints remain for backward compatibility during transition but new features go through `ironclaw-router.ts`.

## Open Questions

1. **Ironclaw MCP Tool Registration API**
   - What we know: Ironclaw supports MCP tools and auto-discovers MCP servers
   - What's unclear: Exact API for runtime tool registration vs config-file-based registration. Whether BASTION backend can act as an MCP server that Ironclaw connects to.
   - Recommendation: Build BASTION backend as an MCP server that Ironclaw discovers. This is the standard MCP pattern -- the backend exposes tools via MCP protocol, Ironclaw connects as client.

2. **Ironclaw Session Management API**
   - What we know: Ironclaw has session/thread concepts with conversation history
   - What's unclear: Exact API for creating sessions, binding context, hydrating from external state
   - Recommendation: Use Ironclaw's HTTP webhook channel with session IDs mapped to BASTION problem set IDs. Test during implementation.

3. **Self-Update Mechanism**
   - What we know: Ironclaw is distributed as a binary/Docker image with GitHub releases
   - What's unclear: No built-in self-update mechanism documented for containerized deployments
   - Recommendation: Implement via Watchtower or custom update checker that polls GitHub releases API, pulls new Docker image, and performs rolling restart with session draining. Frequency: check every 6 hours.

4. **Ironclaw Database Isolation**
   - What we know: Ironclaw requires PostgreSQL with pgvector for its own state
   - What's unclear: Whether it can share a PostgreSQL instance with BASTION (different database) or needs separate
   - Recommendation: Same PostgreSQL instance, separate database (`ironclaw` vs `bastion`). Simpler ops, resource sharing.

## Discretion Recommendations

### Failure Handling Strategy
**Recommendation:** Stop-and-report for all action types. Rollback is too complex across heterogeneous systems (PostgreSQL + GitHub + NEAR). Report failure clearly in chat with what succeeded and what failed, let user decide next steps. Exception: code PR creation -- if branch creation succeeds but PR creation fails, clean up the branch automatically.

### Rate Limiting Design
**Recommendation:** Per-action-type rate limits rather than global cooldown.
- Low risk actions: 60/minute per user
- Medium risk actions: 10/minute per user
- High risk actions: 3/minute per user (most are gated anyway)
- Code PR creation: 5/hour per user
Implement via pg-boss job throttling (already in stack).

### Floating Button Placement
**Recommendation:** Bottom-right corner, 20px from edges, z-index 950. Same position as current `AIStaffFloating` button but with new Ironclaw branding. Avoid bottom-left (conflicts with Leaflet map controls on COP tab).

### Loading/Progress Visual Patterns
**Recommendation:** Three states:
1. **Thinking:** Pulsing dot animation in chat (like typical chat typing indicator)
2. **Step progress:** Vertical stepper with checkmarks, current step highlighted, time elapsed
3. **Action pending:** Yellow card with action description + yes/no/always buttons

### Blockchain Anchoring
**Recommendation:** Batch every 100 actions or every 1 hour (whichever comes first). Compute Merkle root of action hashes in batch. Submit single NEAR transaction with Merkle root. Cost: ~0.001 NEAR per anchor (~$0.005). Store tx_hash back in `ironclaw_audit_anchors` table.

### Emergency Mode Guard Rails
**Recommendation:** Emergency mode requires:
1. User must have system_admin role
2. Explicit "enter emergency mode" command acknowledged with justification text
3. Emergency actions logged with `emergency: true` flag and justification
4. Auto-revert if CI fails (GitHub Actions check via webhook)
5. Emergency mode auto-expires after 1 hour (re-enter required)
6. All emergency actions anchored to blockchain immediately (not batched)

### Self-Update Mechanism
**Recommendation:**
- Poll GitHub Releases API every 6 hours for `nearai/ironclaw` new releases
- Compare current version tag with latest release tag
- On new release: notify system admin via Ironclaw panel message
- System admin confirms update (or auto-update if configured)
- Pull new Docker image, drain active sessions (30-second grace period)
- Restart Ironclaw container, verify health
- Parse release notes and summarize changes in admin notification
- Rollback: keep previous image tagged, auto-rollback if health check fails within 60 seconds

## Sources

### Primary (HIGH confidence)
- Ironclaw GitHub repository (github.com/nearai/ironclaw) - Architecture, tool system, deployment
- Ironclaw DeepWiki (deepwiki.com/nearai/ironclaw) - Detailed component analysis, API patterns
- Existing codebase analysis: `backend/src/ai-staff/`, `backend/src/gates/`, `backend/src/agents/`, `backend/src/security/`

### Secondary (MEDIUM confidence)
- [NEAR AI IronClaw launch announcement](https://aithority.com/machine-learning/near-ai-launches-ironclaw-a-secure-runtime-for-always-on-ai-agents/) - Feature overview, security architecture
- [IronClaw official site](https://ironclaw.tech/) - Enterprise positioning, feature list
- Existing BASTION CI/CD workflows (`.github/workflows/`) - Deployment pattern confirmation

### Tertiary (LOW confidence)
- Ironclaw HTTP webhook channel API specifics - based on architecture documentation, not tested
- MCP tool registration runtime API - inferred from MCP protocol standard, not verified against Ironclaw implementation
- Self-update mechanism - no built-in feature documented; recommendation is custom implementation

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM - Ironclaw is well-documented architecturally but specific API endpoints for HTTP channel and MCP registration need validation during implementation
- Architecture: HIGH - Sidecar pattern, MCP tool bridge, and gate integration are well-supported by existing codebase patterns
- Pitfalls: HIGH - Based on direct analysis of existing code and common distributed systems issues
- Frontend UI: HIGH - Extends existing floating panel pattern with clear component boundaries
- Self-update: LOW - No built-in mechanism; custom implementation required
- Code change pipeline: MEDIUM - GitHub API via Octokit is standard; integration with Ironclaw tool system needs validation

**Research date:** 2026-03-07
**Valid until:** 2026-03-21 (Ironclaw is fast-moving, new releases may change API surface)
