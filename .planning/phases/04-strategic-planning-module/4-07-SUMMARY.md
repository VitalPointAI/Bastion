---
phase: 04-strategic-planning-module
plan: 07
subsystem: admin-config
tags: [postgresql, zod, encryption, admin-api, config-management]

# Dependency graph
requires:
  - phase: 02-identity-security-framework
    provides: ABAC and role-based permissions
  - phase: 01-foundation-infrastructure
    provides: PostgreSQL, encryption utilities
provides:
  - LLM provider runtime configuration
  - Agent enable/disable management
  - OSINT source CRUD operations
  - Workflow escalation settings
  - Configuration audit trail
affects: [strategic-planning, osint, agents, workflows]

# Tech tracking
tech-stack:
  added: []
  patterns: [admin-middleware, config-cache, audit-trail]

key-files:
  created:
    - backend/src/strategic/config/types.ts
    - backend/src/strategic/config/store.ts
    - backend/src/strategic/config/service.ts
    - backend/src/strategic/config/index.ts
    - backend/src/api/admin.ts
  modified:
    - backend/src/index.ts

key-decisions:
  - "ADMIN_DIDS env var for system admin access (simple DID whitelist)"
  - "5-minute cache TTL for config reads"
  - "Automatic encryption for fields containing apiKey/secret/password/token/webhook"
  - "API key masking shows last 4 chars only"

patterns-established:
  - "Admin middleware pattern: requireSystemAdmin for protected routes"
  - "Config audit pattern: log previous/new values with reason"

issues-created: []

# Metrics
duration: 9min
completed: 2026-01-19
---

# Phase 4 Plan 7: Admin Configuration System Summary

**Runtime configuration system for LLM providers, agents, workflows, and OSINT sources with PostgreSQL storage, encryption, and audit trail**

## Performance

- **Duration:** 9 min
- **Started:** 2026-01-19T18:17:14Z
- **Completed:** 2026-01-19T18:26:13Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Configuration storage in PostgreSQL with automatic encryption for sensitive fields
- Admin-only API with 14 endpoints for config management
- Audit trail capturing all configuration changes with previous/new values
- 5-minute cache with selective invalidation support

## Task Commits

Each task was committed atomically:

1. **Task 1: Configuration storage and service** - `1fb5bff` (feat)
2. **Task 2: Admin configuration API endpoints** - `4ad3c47` (feat)

**Plan metadata:** `383d124` (docs: complete plan)

## Completed Tasks

### Task 1: Configuration Storage and Service
**Files Created:**
- `backend/src/strategic/config/types.ts` - Configuration type definitions with Zod schemas
- `backend/src/strategic/config/store.ts` - PostgreSQL persistence with encryption and audit trail
- `backend/src/strategic/config/service.ts` - High-level service with 5-minute cache TTL
- `backend/src/strategic/config/index.ts` - Module exports

**Key Implementation Details:**

1. **Type Definitions (types.ts)**
   - `LLMProviderConfig`: Provider selection (anthropic/openai/azure-openai/local), model mapping per agent type, API key, rate limits
   - `AgentConfig`: Enable/disable flags for 9 agent types, confidence threshold, human review requirements
   - `OSINTSourceConfig`: OSINT source management with type, URL, credibility rating, categories, regions
   - `WorkflowConfig`: Escalation timeouts per risk level, approval authority mapping, notification settings
   - `ConfigAuditEntry`: Audit trail for configuration changes

2. **Database Tables (store.ts)**
   ```sql
   CREATE TABLE system_config (
     key TEXT PRIMARY KEY,
     category TEXT NOT NULL,
     value JSONB NOT NULL,
     encrypted BOOLEAN NOT NULL DEFAULT FALSE,
     encryption_nonce TEXT,
     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     updated_by TEXT NOT NULL
   );

   CREATE TABLE config_audit (
     id TEXT PRIMARY KEY,
     category TEXT NOT NULL,
     key TEXT NOT NULL,
     previous_value JSONB,
     new_value JSONB NOT NULL,
     changed_by TEXT NOT NULL,
     changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
     reason TEXT
   );
   ```

3. **ConfigStore Methods:**
   - `getConfig<T>(key)` - Retrieve config with automatic decryption
   - `setConfig<T>(key, category, value, changedBy, reason)` - Set config with audit trail
   - `getAllConfigs(category?)` - List all configs, optionally filtered
   - `getAuditHistory(options)` - Query audit log with filters
   - Automatic encryption for fields containing 'apiKey', 'secret', 'password', 'token', 'webhook'

4. **ConfigService Features:**
   - 5-minute cache TTL using Map with expiry timestamps
   - Domain-specific methods: `getLLMConfig()`, `getAgentConfig()`, `getWorkflowConfig()`
   - OSINT source CRUD: `getOSINTSources()`, `addOSINTSource()`, `updateOSINTSource()`, `deleteOSINTSource()`
   - `invalidateCache(key?)` - Selective or full cache invalidation
   - Default values when config not set

5. **Default Values:**
   - LLM: anthropic provider, claude-sonnet-4-20250514 for all models, 60 req/min, 100k tokens/day
   - Agents: All enabled except redTeamAgent and devilsAdvocate
   - Workflow: 24h/8h/4h/2h escalation timeouts for LOW/MEDIUM/HIGH/EXTREME risk levels

### Task 2: Admin Configuration API Endpoints
**Files Created/Modified:**
- `backend/src/api/admin.ts` - Admin-only API endpoints
- `backend/src/index.ts` - Mount admin router at `/api/admin`

**Endpoints Implemented:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/config/llm` | Get LLM provider configuration |
| PUT | `/api/admin/config/llm` | Update LLM configuration |
| GET | `/api/admin/config/agents` | Get agent configuration |
| PUT | `/api/admin/config/agents` | Update agent settings |
| GET | `/api/admin/config/workflow` | Get workflow configuration |
| PUT | `/api/admin/config/workflow` | Update workflow settings |
| GET | `/api/admin/osint-sources` | List all OSINT sources |
| POST | `/api/admin/osint-sources` | Add new OSINT source |
| GET | `/api/admin/osint-sources/:id` | Get single OSINT source |
| PUT | `/api/admin/osint-sources/:id` | Update OSINT source |
| DELETE | `/api/admin/osint-sources/:id` | Delete OSINT source |
| GET | `/api/admin/config/audit` | Get configuration change audit log |
| POST | `/api/admin/cache/invalidate` | Force invalidate config cache |

**Security Features:**
- `requireSystemAdmin` middleware checks `ADMIN_DIDS` environment variable
- API keys masked in responses (show last 4 characters only)
- Zod validation on all configuration inputs with detailed error responses
- Audit log captures all changes with previous/new values and reason

## Verification Results
- `pnpm build` succeeds without TypeScript errors
- Admin endpoints require SYSTEM_ADMIN role (env: ADMIN_DIDS)
- Config changes are audited in `config_audit` table
- API keys are masked in all responses
- Cache invalidation works for specific keys or all keys

## Dependencies
- Zod v4.3.5 for schema validation
- PostgreSQL for storage (via existing `getPool()`)
- XChaCha20-Poly1305 encryption (via existing `lib/encryption.ts`)

## Environment Variables
| Variable | Description |
|----------|-------------|
| `ADMIN_DIDS` | Comma-separated list of DIDs with system admin access |
| `CONFIG_ENCRYPTION_KEY` | Hex-encoded 256-bit key for encrypting sensitive config values |

## Usage Example
```typescript
import { configService } from './strategic/config/index.js';

// Get LLM configuration (uses cache)
const llmConfig = await configService.getLLMConfig();

// Update agent configuration
await configService.updateAgentConfig(
  { enabledAgents: { redTeamAgent: true } },
  'did:example:admin',
  'Enable red team agent for security testing'
);

// Invalidate cache after external changes
configService.invalidateCache();
```

## Commits
1. `feat(4-07): add configuration storage and service` - Task 1
2. `feat(4-07): add admin configuration API endpoints` - Task 2
