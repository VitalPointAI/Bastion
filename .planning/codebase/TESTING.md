# Testing Patterns

**Analysis Date:** 2026-03-18

## Test Framework

**Runner:**
- Vitest 4.x (both frontend and backend)
- Frontend config: `frontend/vite.config.ts` (vitest embedded in vite config)
- Backend config: none (uses vitest defaults, `"test": "vitest run"` in `package.json`)

**Assertion Library:**
- Vitest's built-in `expect` (Jest-compatible API)
- Frontend: `@testing-library/jest-dom` (DOM matchers) via `frontend/src/test-setup.ts`
- Frontend: `@testing-library/react` for component and hook rendering

**Mocking Framework:**
- `vi.fn()`, `vi.mock()`, `vi.mocked()` from Vitest

**Run Commands:**
```bash
# Frontend (from frontend/)
pnpm test:security          # Security tests only (frontend/tests/security/)

# Backend (from backend/)
pnpm test                   # All backend tests (vitest run)

# No full frontend test suite command configured in package.json
# Run with: pnpm exec vitest run (from frontend/)
```

## Test File Organization

**Location — Backend:**
- Most test files co-located with source: `src/cop/messaging/event-bus.test.ts`
- Some tests in dedicated `tests/` directory: `backend/tests/mdmp/e2e-workflow.test.ts`
- Security tests: `backend/src/security/__tests__/abac-enforcer.test.ts` (uses `__tests__` subdirectory)
- **INCONSISTENCY:** Three different patterns used (co-located, `tests/`, `__tests__/`). Prefer co-location with source.

**Location — Frontend:**
- Some tests co-located with component: `frontend/src/components/brain/IngestionDrawer.test.tsx`
- Hook tests co-located with hook: `frontend/src/components/brain/hooks/useUniversalIngest.test.ts`
- Security tests in dedicated `tests/` directory: `frontend/tests/security/frontend-no-secrets.test.ts`

**Naming:**
- Backend: `{module-name}.test.ts`
- Frontend components: `{ComponentName}.test.tsx`
- Frontend hooks: `use{Name}.test.ts`

**Directory structure:**
```
frontend/
├── src/
│   └── components/brain/
│       ├── IngestionDrawer.tsx
│       ├── IngestionDrawer.test.tsx         ← co-located
│       ├── UniversalInputZone.test.tsx      ← co-located
│       └── hooks/
│           ├── useUniversalIngest.ts
│           ├── useUniversalIngest.test.ts   ← co-located
│           └── useBrainTimeline.test.ts     ← co-located (TDD scaffold)
└── tests/
    └── security/
        └── frontend-no-secrets.test.ts     ← separate test directory

backend/
├── src/
│   ├── cop/
│   │   ├── messaging/event-bus.test.ts      ← co-located
│   │   ├── layers/layer-store.test.ts       ← co-located
│   │   └── ...
│   ├── graph/
│   │   ├── confidence-calculator.test.ts    ← co-located
│   │   └── ...
│   └── security/
│       └── __tests__/abac-enforcer.test.ts  ← __tests__ subdirectory
└── tests/
    └── mdmp/
        └── e2e-workflow.test.ts             ← separate (integration)
```

## Test Structure

**Suite Organization:**
```typescript
/**
 * Phase X Plan Y - description of what tests cover
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ModuleName', () => {
  let instance: Type;

  beforeEach(() => {
    instance = new Type();
  });

  describe('methodName', () => {
    it('describes behavior in plain English', () => {
      // arrange
      // act
      // assert
    });
  });
});
```

**File-level docblock pattern (all test files have this):**
```typescript
/**
 * Tests for module-name.ts
 *
 * Phase X Plan Y — TDD scaffold / behavioral tests
 * Covers: function1, function2, edge cases
 */
```

**Patterns:**
- `beforeEach` used for fresh instance creation (not shared state across tests)
- `afterEach` used to restore timers: `vi.useRealTimers()` and stop subscriptions
- `beforeAll` used for expensive setup (e.g., `ABACEnforcer.initialize()`, `loadCCOSchema()`)
- `afterAll` used for teardown: `enforcer.close()`
- Nested `describe` blocks for logical grouping (method-level or invariant-level)
- `it()` descriptions are behavior-first: `'returns ~0.475 for base=0.95 at 180 days...'`

## Mocking

**Framework:** `vi.fn()` and `vi.mock()` from Vitest

**Module-level mock pattern (backend, before import):**
```typescript
// Mock before importing the module under test
vi.mock('./neo4j-client.js', () => ({
  executeWriteQuery: vi.fn().mockResolvedValue({ records: [] }),
  executeReadQuery: vi.fn().mockResolvedValue({ records: [] }),
}));

// Then import subject
import { detectContradiction } from './contradiction-detector.js';
```

**Named mock reference pattern:**
```typescript
const mockCreateLayer = vi.fn().mockResolvedValue({ id: 'LYR-test123' });

vi.mock('../cop/layers/layer-store.js', () => ({
  layerStore: {
    createLayer: (...args: unknown[]) => mockCreateLayer(...args),
  },
}));
```

**Frontend component mock pattern:**
```typescript
vi.mock('./hooks/useUniversalIngest.js', () => ({
  useUniversalIngest: () => ({
    items: [],
    submitText: vi.fn(),
    // ... all hook return fields
  }),
}));
```

**Frontend hook mock with per-test control:**
```typescript
vi.mock('./hooks/useUniversalIngest.js', () => ({
  useUniversalIngest: vi.fn(),
}));

import { useUniversalIngest } from './hooks/useUniversalIngest.js';
const mockUseUniversalIngest = vi.mocked(useUniversalIngest);

beforeEach(() => {
  mockUseUniversalIngest.mockReturnValue(makeDefaultHookReturn());
});
```

**Fetch mock pattern (frontend hook tests):**
```typescript
function setupFetchMock(overrides?) {
  return vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('classify')) {
      return Promise.resolve({ ok: true, json: async () => mockClassifyResponse });
    }
    return Promise.resolve({ ok: true, json: async () => mockSubmitResponse });
  });
}

globalThis.fetch = setupFetchMock();
```

**Timer mock pattern:**
```typescript
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  handler.stopAllPolling();
  vi.useRealTimers();
});

vi.advanceTimersByTime(1000);
```

**What to Mock:**
- Neo4j client (`executeWriteQuery`, `executeReadQuery`) — always mocked in unit tests
- External API clients (LLM, OpenAI embeddings)
- Express message bus (`getMessageBus`)
- Layer store, version store when testing services that depend on them
- Child components in component tests (lightweight stubs)
- Fetch for API calls in frontend hook tests

**What NOT to Mock:**
- Pure functions and calculators (`confidence-calculator.ts`, `sidc-builder.ts`) — test directly
- In-memory store implementations (`LayerStoreMemory`, `VersionStoreMemory`) — test the real implementation
- Event bus (`COPEventBus`) — test the real class behavior

## Fixtures and Factories

**Factory function pattern (used consistently):**
```typescript
function makeSpec(overrides: Partial<COPLayerSpec> = {}): COPLayerSpec {
  return {
    layerId: 'spec-1',
    layerType: 'force_disposition',
    workspaceId: 'ws-1',
    sectionId: 'sec-1',
    symbols: [],
    // ... all required fields with sensible defaults
    ...overrides,
  };
}
```

**Frontend item factory pattern:**
```typescript
function makeItem(overrides?: Partial<IngestItem>): IngestItem {
  return {
    id: 'item-1',
    label: 'https://example.com',
    status: 'processing' as ItemStatus,
    progress: 0.5,
    retryCount: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
```

**Render helper pattern (component tests):**
```typescript
const defaultProps = { problemSetId: 'ps-001', isOpen: false, onOpen: vi.fn(), onClose: vi.fn() };

function renderDrawer(props: Partial<typeof defaultProps> = {}) {
  return render(<IngestionDrawer {...defaultProps} {...props} />);
}
```

**Location:**
- Fixtures defined inline at top of test file (no separate fixtures directory)
- No shared fixture files found — each test file is self-contained

## Coverage

**Requirements:** None enforced — no coverage thresholds configured.

**View Coverage:**
```bash
# From backend/ or frontend/
pnpm exec vitest run --coverage
```

## Test Types

**Unit Tests:**
- Predominant test type
- Test pure functions directly: `confidence-calculator.ts`, `sidc-builder.ts`, `coalition-caveat-service.ts`
- Test service classes with mocked dependencies: `COPEventBus`, `LayerStoreMemory`, `ABACEnforcer`
- Test React hooks with `renderHook` + `act`
- Test React components with `render` + `fireEvent` / `screen` queries

**Integration Tests:**
- `backend/tests/mdmp/e2e-workflow.test.ts` — full MDMP workflow lifecycle
- **NOTE:** This test file is known to be broken — `workflow-service.ts` has a race condition where `registerPhaseGates` is called before the workflow is stored. Tests are skipped pending fix (documented at top of file).

**E2E Tests:** Not present for frontend (no Playwright/Cypress configured).

**Python Tests (robot/):**
- `robot/tests/` — 17 pytest files covering swarm logic, vision, intent, BLE, mission execution
- Framework: pytest (inferred from `.pytest_cache` presence)
- Tests are isolated from the TypeScript test suite

## Common Patterns

**Async Testing:**
```typescript
it('completes sequence correctly', async () => {
  const { result } = renderHook(() => useUniversalIngest('ps-1'));

  await act(async () => {
    await result.current.submitText('https://example.com');
  });

  expect(result.current.items[0].status).toBe('processing');
});
```

**Intermediate state testing (promise held open):**
```typescript
let resolveClassify!: (v: unknown) => void;
const classifyPromise = new Promise((res) => { resolveClassify = res; });

globalThis.fetch = vi.fn().mockImplementation((url: string) => {
  if (String(url).includes('classify')) return classifyPromise.then(...);
  return Promise.resolve(...);
});

// Observe state before promise resolves
await act(async () => {
  void result.current.submitText('https://example.com');  // don't await
});

expect(result.current.items[0].status).toBe('classifying');

await act(async () => {
  resolveClassify(undefined);
  await new Promise((r) => setTimeout(r, 0));
});
```

**Error Testing:**
```typescript
it('rejects on invalid input', async () => {
  await expect(
    workflowService.registerAssumption({ missionId, description: '', source: 'AI' })
  ).rejects.toThrow();
});
```

**Floating-point assertion:**
```typescript
expect(result).toBeCloseTo(0.475, 2);  // 2 decimal places precision
```

**Conditional assertion pattern (for optional fields):**
```typescript
if (!result.success) {
  expect(result).toHaveProperty('unaddressedChallenges');
}
```

## What IS Tested

- COP layer lifecycle state machine (`layer-store.test.ts`, `version-store.test.ts`)
- COP event bus and trigger/polling handlers (`event-bus.test.ts`)
- COP coordinator routing logic (`cop-coordinator.test.ts`)
- COP entity linker (`entity-linker.test.ts`)
- COP CCO ontology schema loading (`cco-schema-loader.test.ts`)
- MIL-STD-2525D SIDC code building (`sidc-builder.test.ts`)
- SVG sanitizer (`svg-sanitizer.test.ts`)
- Graph confidence calculation and decay (`confidence-calculator.test.ts`)
- Graph contradiction detection (`contradiction-detector.test.ts`)
- Graph entity resolution scoring (`resolution-service.test.ts`)
- Graph actor store (JSON-LD properties) (`actor-store.test.ts`)
- ABAC security enforcement (`abac-enforcer.test.ts`)
- MDMP workflow governance invariants (`e2e-workflow.test.ts` — currently broken)
- Universal content classifier (`universal-classifier.test.ts`)
- URL unfurler (`url-unfurler.test.ts`)
- Document → COP pipeline (`doc-cop-pipeline.test.ts`)
- Coalition caveat service (`coalition-caveat-service.test.ts`)
- Frontend: IngestionDrawer component (`IngestionDrawer.test.tsx`)
- Frontend: UniversalInputZone component (`UniversalInputZone.test.tsx`)
- Frontend: useUniversalIngest hook full state machine (`useUniversalIngest.test.ts`)
- Frontend: useBrainTimeline temporal filtering (`useBrainTimeline.test.ts`)
- Frontend security: no secrets in env (`frontend-no-secrets.test.ts`)

## What IS NOT Tested (Coverage Gaps)

**High-risk untested areas:**

- `backend/src/api/*.ts` — All HTTP route handlers are untested (13+ route files, no tests)
  - `strategic.ts` (2,713 lines), `problem-sets.ts` (2,514 lines), `admin.ts` (2,311 lines)
  - No request/response cycle testing for any API endpoint
- `backend/src/agents/` — All 19+ AI agent stubs have `TODO: Implement via agent executor framework` — untested and unimplemented
- `frontend/src/context/*.tsx` — All React contexts untested (`ProblemSetContext`, `AIStaffContext`, `ModeContext`, `UserContext`)
- `frontend/src/hooks/` — Most hooks untested: `useAIStaffFeed.ts`, `useAuth.tsx`, `useDiscovery.ts`, `useIronclaw.ts`, `useStaffNotifications.ts`
- `frontend/src/components/` — Vast majority of ~80+ components have no tests
  - Entire `cop/`, `design/`, `governance/`, `plan/`, `direct/`, `strategic/`, `exercise/` subdirectories
  - Large complex files: `OrderEditor.tsx` (1,302 lines), `PlanOrderDevelopment.tsx` (1,061 lines)
- `backend/src/inheritance/` — Inheritance store (1,319 lines) untested
- `backend/src/orchestration/` — LangGraph orchestration untested
- `backend/src/collaboration/` — Yjs collaboration untested
- `backend/src/mdmp/workflow-service.ts` — E2E test exists but is broken (race condition bug)
- `backend/src/planning/roe/audit.ts` — NEAR contract calls are stubbed with TODO comments
- No integration tests for database layer (all DB-dependent code relies on mocking)
- No WebSocket connection testing
- No authentication middleware testing

**Known broken tests:**
- `backend/tests/mdmp/e2e-workflow.test.ts` — Broken due to race condition in `workflow-service.ts`. Documented at top of file as known tech debt.

---

*Testing analysis: 2026-03-18*
