# Coding Conventions

**Analysis Date:** 2026-03-18

## Naming Patterns

**Files:**
- React components: PascalCase matching the exported component name (`COPMapView.tsx`, `IngestionDrawer.tsx`, `TabLayout.tsx`)
- React hook files: camelCase with `use` prefix (`useAIStaffFeed.ts`, `useUniversalIngest.ts`)
- Backend service files: kebab-case (`layer-store.ts`, `event-bus.ts`, `coalition-caveat-service.ts`)
- Backend API route files: kebab-case matching the domain (`brain.ts`, `problem-sets.ts`, `doc-intelligence.ts`)
- Test files: co-located with source, same name with `.test.ts` or `.test.tsx` suffix
- CSS files: PascalCase matching component name for component CSS (`COPMapView.css`, `IngestionDrawer.css`)
- Type-only files in frontend: kebab-case in `types/` directory (`ai-staff.ts`, `cop.ts`, `exercise.ts`)

**Functions:**
- React components: PascalCase named exports (`export function IngestionDrawer(...)`, `export function TabLayout(...)`)
- React hooks: camelCase with `use` prefix (`export function useAIStaffFeed(...)`)
- Backend functions/services: camelCase (`getQueryString`, `computeDecayedConfidence`, `fuseConfidence`)
- Classes: PascalCase (`LayerStoreMemory`, `COPEventBus`, `ABACEnforcer`, `SafetyMatrixEnforcer`)

**Variables and Constants:**
- Local variables: camelCase
- Module-level constants: SCREAMING_SNAKE_CASE for configuration (`WS_BASE_URL`, `RECONNECT_BASE_MS`, `BATCH_SIZE`, `LAYER_TYPE_LABELS`, `SOURCE_WEIGHTS`, `HALF_LIFE_DEFAULTS`)
- TypeScript `const` enums/union types: mixed — sometimes string literals, sometimes TypeScript enums

**Types and Interfaces:**
- Interfaces: PascalCase with descriptive names (`IngestionDrawerProps`, `AuthContextValue`, `COPLayer`, `AuditEntry`)
- Props interfaces: `{ComponentName}Props` pattern consistently (`IngestionDrawerProps`, `TabLayoutProps`, `COPMapViewProps`)
- Types: PascalCase (`ItemStatus`, `InputType`, `SourceFilter`, `LayerState`)
- Generic type names: use single uppercase letters only in simple cases; prefer descriptive names otherwise

## Code Style

**Formatting:**
- No `.prettierrc` detected — no enforced formatter
- Indentation: 2 spaces (consistent across all files reviewed)
- Single quotes for string literals in TypeScript (inconsistent — some files use double quotes in JSX/HTML attribute values)
- Trailing semicolons: present in newer files; older files in `App.tsx` imports omit semicolons

**Linting:**
- Frontend: ESLint with `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`
- Backend: ESLint with `typescript-eslint`
- `@typescript-eslint/no-unused-vars`: error in frontend, warn in backend; both ignore `^_` prefix pattern
- `@typescript-eslint/no-explicit-any`: warn in backend (not configured in frontend)
- No Prettier enforced — style is applied manually/by convention

## Import Organization

**Frontend pattern (newer components like IngestionDrawer):**
1. React built-ins (`import { useState, useCallback } from 'react'`)
2. Third-party packages
3. Internal absolute imports (`../../lib/...`, `../../context/...`)
4. Relative imports with `.js` extensions

**Frontend pattern (older components like App.tsx):**
1. React router and third-party packages
2. Internal components without file extension
3. CSS imports

**INCONSISTENCY — Import Extensions:**
- Newer frontend files (Phase 50+) use explicit `.js` extensions on local imports: `import { useUniversalIngest } from './hooks/useUniversalIngest.js'`
- Some hooks use `.ts` extensions: `import { aiStaffService } from '../lib/ai-staff-service.ts'`
- Older files in `App.tsx` and some components use no extension: `import { AuthWrapper } from './components/AuthWrapper'`
- Backend always uses `.js` extensions on local imports (required for ESM): `import { COPEventBus } from './event-bus.js'`

**Path Aliases:**
- None configured in `tsconfig.json` or `vite.config.ts` — all imports use relative paths

## Section Comment Style

Two distinct styles used in the codebase:

**Newer style (Phase 20+, most backend files and newer frontend files):**
```typescript
// ─── Section Name ─────────────────────────────────────────────────────────────
```
Uses em-dashes with box-drawing characters to create visual separation.

**Older style (backend API files, `api/brain.ts`):**
```typescript
// =====================
// SECTION NAME
// =====================
```
All-caps with equals signs.

Use the em-dash style for new code.

## Error Handling

**Backend API routes:**
- All route handlers wrapped in `try/catch`
- Errors returned as `res.status(500).json({ error: String(error) })`
- 400 validation: `res.status(400).json({ error: 'field required message' })`
- No centralized error handling middleware — each handler does its own catch

**Frontend hooks:**
- Errors caught in hook internals, stored in hook state where needed
- Console logging with prefixed module tags: `console.error('[useAIStaffFeed] initial fetch failed:', err)`
- Pattern: `[moduleName]` prefix in brackets for all console messages

**Backend services:**
- Mix of throwing errors and returning result objects with `{ success: boolean, error?: string }`
- MDMP invariant violations return structured error objects: `{ success: false, error: 'INVARIANT 2 VIOLATION...', unsatisfiedGates: [...] }`

## Logging

**Frontend:** `console.error` / `console.warn` with `[hookName]` prefix tag. No structured logging framework.
- Examples: `'[useIronclaw]'`, `'[useAIStaffFeed]'`, `'[useDiscovery]'`

**Backend:** `console.log`, `console.error`, `console.warn` with `[ServiceName→Operation]` prefix tags.
- Examples: `'[DocIntel→COP]'`, `'[web-search]'`, `'[PredictiveService]'`
- No structured logging (no Winston, Pino, etc.)

## Comments

**File-level JSDoc:**
- All files (both frontend and backend) begin with a `/** ... */` block docstring describing purpose, phase reference, and key behaviors
- Example: `/** IngestionDrawer — slide-out overlay drawer... Phase 50 Plan 07. */`
- Phase references are always included: `Phase 50 Plan 07`

**Inline comments:**
- Used liberally to explain non-obvious logic
- Section dividers used consistently in longer files

## Function Design

**React components:**
- Props always typed with explicit interface (`interface {ComponentName}Props { ... }`)
- Destructured in function signature: `function TabLayout({ items, selectedItem, onSelectItem, children }: TabLayoutProps)`
- Optional props annotated with `?` and `/** JSDoc comment */` for clarity

**Hooks:**
- Return type explicitly typed with `interface Use{Name}Result { ... }` in newer hooks
- `useCallback` used extensively for stable function references in hooks that set up subscriptions
- `useRef` used for values that should not trigger re-renders (WebSocket, timers, queues)

**Backend service classes:**
- Constructor injection for dependencies where testable: `new TriggerHandler(bus)`, `new ActivityBridge(bus)`
- Singleton exports for production services: `export const copEventBus = new COPEventBus()`
- In-memory variants (`LayerStoreMemory`) alongside DB variants (`LayerStore`) for testability

## Module Design

**Frontend exports:**
- Primarily named exports for components (`export function ComponentName`)
- `export interface ComponentNameProps` always exported alongside component
- Default exports exist in older components (`App.tsx`, some `problem-set/` components)
- **INCONSISTENCY:** Newer components use named exports; older components (`BrainTimeline.tsx`, `OrgTree.tsx`, `ProblemSetTabContainer.tsx`) use default exports. Prefer named exports for new code.

**Backend exports:**
- Services exported as singletons: `export const layerStore = new LayerStore()`
- In-memory variants exported as classes for test instantiation: `export class LayerStoreMemory`
- Express routers: `const router = Router(); ...; export default router` (still uses default export for routers)

## TypeScript Specifics

**`any` usage:**
- Backend: `@typescript-eslint/no-explicit-any` set to `warn` — `any` used in some agent/LLM integration code
- Frontend: no rule configured — `any` used occasionally in dynamic data paths
- Neither codebase enforces `strict: true` in tsconfig to maximum strictness

**Type imports:**
- `import type { ... }` used consistently for type-only imports: `import type { COPLayer } from '../../types/cop.js'`
- Mixed: some files import types and values in the same statement

**`void` operator:**
- Used in newer code to explicitly discard floating promises: `void result.current.submitText('https://example.com')`

---

*Convention analysis: 2026-03-18*
