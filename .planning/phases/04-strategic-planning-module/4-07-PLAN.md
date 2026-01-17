---
phase: 04-strategic-planning-module
plan: 07
type: execute
domain: admin-config
---

<objective>
Create administrative configuration system for LLM providers, agents, and workflow settings.

Purpose: Enable runtime configuration of AI providers, agent settings, OSINT sources, and approval workflows without code changes.
Output: Config service with PostgreSQL storage, admin API endpoints, and validation.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/04-strategic-planning-module/4-RESEARCH.md

**From research (administrative_configuration_requirements):**
- LLM provider config: provider, models per agent type, API key, rate limits
- Agent config: enable/disable agents, per-agent settings
- OSINT source management: URL, credibility rating, enabled state
- Workflow config: escalation timeouts, approval authority mapping
- Store in PostgreSQL, not env vars
- Audit all config changes
- Role-gated access (SYSTEM_ADMIN permission)

**Constraining decisions:**
- [Phase 2-04]: ABAC for permission checks
- [Phase 3-02]: Role-based permissions
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create configuration storage and service</name>
  <files>backend/src/strategic/config/types.ts, backend/src/strategic/config/store.ts, backend/src/strategic/config/service.ts</files>
  <action>
Create backend/src/strategic/config/ directory.

In types.ts, define configuration interfaces:

```typescript
// LLM Provider Configuration
interface LLMProviderConfig {
  provider: 'anthropic' | 'openai' | 'azure-openai' | 'local';
  models: {
    extraction: string;      // e.g., 'claude-sonnet-4-20250514'
    analysis: string;
    summarization: string;
    redTeam: string;
  };
  apiKey: string;            // Encrypted in database
  baseUrl?: string;          // For Azure/local
  maxRequestsPerMinute: number;
  maxTokensPerDay: number;
  maxCostPerDocument: number;
  alertThreshold: number;
}

// Agent Configuration
interface AgentConfig {
  enabledAgents: {
    osintCollector: boolean;
    documentProcessor: boolean;
    threatMonitor: boolean;
    fusionAgent: boolean;
    extractionAgent: boolean;
    assessmentAgent: boolean;
    redTeamAgent: boolean;
    devilsAdvocate: boolean;
    coaGenerator: boolean;
  };
  defaultConfidenceThreshold: number;
  requireHumanReviewFor: string[];
}

// OSINT Source Configuration
interface OSINTSourceConfig {
  id: string;
  name: string;
  type: 'RSS' | 'API' | 'SCRAPE' | 'MANUAL';
  url: string;
  credibilityRating: number;  // 0-1
  enabled: boolean;
  apiKey?: string;            // Encrypted
  rateLimit?: number;
  categories: string[];
  regions: string[];
}

// Workflow Configuration
interface WorkflowConfig {
  escalationTimeouts: {
    LOW: number;     // hours
    MEDIUM: number;
    HIGH: number;
    EXTREME: number;
  };
  approvalAuthority: Array<{
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
    requiredRole: string;
    canDelegate: boolean;
  }>;
  notifications: {
    emailOnPending: boolean;
    emailOnEscalation: boolean;
    slackWebhook?: string;
  };
}

// Config change audit entry
interface ConfigAuditEntry {
  id: string;
  category: string;
  key: string;
  previousValue: unknown;
  newValue: unknown;
  changedBy: string;
  changedAt: Date;
  reason?: string;
}
```

In store.ts:
Create ConfigStore with PostgreSQL:

```sql
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  value JSONB NOT NULL,
  encrypted BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_system_config_category ON system_config(category);

CREATE TABLE IF NOT EXISTS config_audit (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  key TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB NOT NULL,
  changed_by TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_config_audit_category ON config_audit(category);
CREATE INDEX IF NOT EXISTS idx_config_audit_changed_at ON config_audit(changed_at);
```

Methods:
- getConfig<T>(key: string): Promise<T | null>
- setConfig<T>(key: string, category: string, value: T, changedBy: string, reason?: string): Promise<void>
  - Record audit entry before update
  - Encrypt if key contains 'apiKey' or 'secret'
- getAllConfigs(category?: string): Promise<Record<string, unknown>>
- getAuditHistory(key?: string, limit?: number): Promise<ConfigAuditEntry[]>

In service.ts:
Create ConfigService class:

- Cache with 5-minute TTL (Map<string, { value: T, expiry: number }>)
- getLLMConfig(): Promise<LLMProviderConfig>
- updateLLMConfig(config: Partial<LLMProviderConfig>, updatedBy: string): Promise<void>
- getAgentConfig(): Promise<AgentConfig>
- updateAgentConfig(config: Partial<AgentConfig>, updatedBy: string): Promise<void>
- getWorkflowConfig(): Promise<WorkflowConfig>
- updateWorkflowConfig(config: Partial<WorkflowConfig>, updatedBy: string): Promise<void>
- getOSINTSources(): Promise<OSINTSourceConfig[]>
- addOSINTSource(source: OSINTSourceConfig, addedBy: string): Promise<void>
- updateOSINTSource(id: string, updates: Partial<OSINTSourceConfig>, updatedBy: string): Promise<void>
- deleteOSINTSource(id: string, deletedBy: string): Promise<void>
- invalidateCache(key?: string): void

Default values: Provide sensible defaults when config not set:
- LLM: anthropic, claude-sonnet-4-20250514, 60 req/min, 100k tokens/day
- Agents: all enabled except redTeam/devilsAdvocate
- Workflow: 24h/8h/4h/2h escalation timeouts
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import { ConfigService } from './src/strategic/config/service.js';
const config = new ConfigService();
console.log('ConfigService instantiated');
console.log('Has getLLMConfig:', typeof config.getLLMConfig === 'function');
"
```
  </verify>
  <done>
- Configuration type definitions
- system_config table with encryption support
- config_audit table for change tracking
- ConfigStore with CRUD and encryption
- ConfigService with caching
- Default values for all config types
  </done>
</task>

<task type="auto">
  <name>Task 2: Create admin configuration API endpoints</name>
  <files>backend/src/api/admin.ts, backend/src/index.ts</files>
  <action>
Create backend/src/api/admin.ts for admin-only endpoints:

```typescript
import { Router } from 'express';
import { ConfigService } from '../strategic/config/service.js';
```

Add middleware to check SYSTEM_ADMIN role:
```typescript
async function requireSystemAdmin(req, res, next) {
  const did = req.headers['x-did'] as string;
  if (!did) return res.status(401).json({ error: 'Authentication required' });

  // Check for SYSTEM_ADMIN role via credential service or simple check
  // For now, check against allowed DIDs in env: ADMIN_DIDS
  const adminDids = (process.env.ADMIN_DIDS || '').split(',').map(d => d.trim());
  if (!adminDids.includes(did)) {
    return res.status(403).json({ error: 'System admin access required' });
  }
  next();
}
```

All endpoints require SYSTEM_ADMIN:

GET /api/admin/config/llm
- Get LLM provider configuration
- Mask apiKey in response (show last 4 chars only)

PUT /api/admin/config/llm
- Update LLM configuration
- Body: Partial<LLMProviderConfig>
- Validate model names, rate limits

GET /api/admin/config/agents
- Get agent configuration

PUT /api/admin/config/agents
- Update agent settings
- Body: Partial<AgentConfig>

GET /api/admin/config/workflow
- Get workflow configuration

PUT /api/admin/config/workflow
- Update workflow settings
- Body: Partial<WorkflowConfig>

GET /api/admin/osint-sources
- List all OSINT sources

POST /api/admin/osint-sources
- Add new OSINT source
- Body: OSINTSourceConfig

PUT /api/admin/osint-sources/:id
- Update OSINT source
- Body: Partial<OSINTSourceConfig>

DELETE /api/admin/osint-sources/:id
- Delete OSINT source

GET /api/admin/config/audit
- Get configuration change audit log
- Query params: category?, limit?, since?

POST /api/admin/cache/invalidate
- Force invalidate config cache
- Body: { key?: string } (optional, invalidates specific or all)

Mount in index.ts at /api/admin.

Validation:
- Use Zod schemas for all config inputs
- Return 400 with validation errors
- Never expose full API keys in responses
  </action>
  <verify>
```bash
cd backend && npx tsx -e "
import adminRouter from './src/api/admin.js';
console.log('Admin router loaded');
"
```
  </verify>
  <done>
- SYSTEM_ADMIN role check middleware
- LLM config get/update endpoints
- Agent config get/update endpoints
- Workflow config get/update endpoints
- OSINT source CRUD endpoints
- Audit log endpoint
- Cache invalidation endpoint
- API key masking in responses
  </done>
</task>

</tasks>

<verification>
Before declaring plan complete:
- [ ] `cd backend && pnpm build` succeeds without TypeScript errors
- [ ] Admin endpoints require SYSTEM_ADMIN role
- [ ] Config changes are audited
- [ ] API keys are masked in responses
- [ ] Cache invalidation works
</verification>

<success_criteria>

- Configuration storage in PostgreSQL
- Audit trail for all config changes
- Admin-only API endpoints
- LLM, agent, workflow, and OSINT config management
- API key encryption and masking
- Cache with invalidation support
  </success_criteria>

<output>
After completion, create `.planning/phases/04-strategic-planning-module/4-07-SUMMARY.md`
</output>
