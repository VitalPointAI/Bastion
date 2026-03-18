# Phase 50: Universal Intelligence Input & Auto-Classification — Research

**Researched:** 2026-03-18
**Domain:** Unified input UX + content auto-classification + multi-pipeline backend routing
**Confidence:** HIGH (all key code is available and readable; no external library research needed — existing stack is sufficient)

---

## Summary

Phase 50 replaces the fragmented ingestion sidebar with a single universal input zone that accepts any content (files, URLs, pasted text, raw JSON/XML) and automatically routes to the correct processing pipeline. The current sidebar has three disconnected entry points: an "Ingest" button that opens `DocIntelligencePanel` in a collapsible section, an "Add Source" button that opens `AddOSINTSourceModal` (manual type + URL + interval form), and a static filter-tag bar. Users must know which path their content belongs to before interacting.

The replacement is a single `<UniversalInputZone>` at the top of `IngestionSidebar` that acts as the primary interaction surface. A new backend auto-classification endpoint (`POST /api/ingest/classify`) and unified submit endpoint (`POST /api/ingest/submit`) sit above the existing doc-intelligence and OSINT pipelines without replacing them. The existing `ProgressCallback` / SSE machinery in `doc-intelligence.ts` is extended to carry classification and routing events. The existing `AddOSINTSourceModal` and `DocIntelligencePanel` are preserved as "Advanced" fallback links (UNIV-18).

The main complexity is content-type detection: distinguishing a pasted RSS URL from a plain web article URL, a JSON blob from free text, and a clipboard image from a PDF binary. The project already has `jsdom` (HTML parsing), `rss-parser` (RSS detection), Node.js built-in `fetch` (URL fetching), `multer` (binary uploads), and the LangGraph orchestrator for downstream routing — all needed tools exist.

**Primary recommendation:** Build a thin classification/routing layer on top of the existing pipelines. Do not re-implement document processing or OSINT polling; route into them. The new backend endpoints are dispatchers, not new processing systems.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| UNIV-01 | Single universal input zone — drag-drop files, paste text/URLs/clipboard images | Native HTML5 drag-drop + clipboard API; existing `dropZoneRef` pattern in DocIntelligencePanel |
| UNIV-02 | Auto-detect input type: file (MIME/extension), URL (pattern match), raw text (fallback), structured data (JSON/XML detection) | Pattern: Content-Type sniffing in multer; URL regex; JSON.parse probe; XML detection heuristic |
| UNIV-03 | URL unfurling: fetch URL, detect RSS/API/article/PDF/page; extract OG metadata | jsdom already in backend; rss-parser already installed; HEAD request + Content-Type header check |
| UNIV-04 | RSS/Atom auto-subscribe with sensible defaults (no modal) | Route to osintService.createFeed() with defaults; rss-parser validates feed |
| UNIV-05 | Web article/page → doc-intelligence pipeline | Fetch HTML, extract text via jsdom, submit to `/api/doc-intelligence/process/:problemSetId` |
| UNIV-06 | Pasted text classification — intel report, strategic guidance, OSINT item, freeform note | LLM triage call (same pattern as TRIAGE_SYSTEM_PROMPT); short-circuit on obvious patterns |
| UNIV-07 | File drops → existing doc-intelligence pipeline (PDF, DOCX, TXT, MD, HTML, CSV, JSON, XML) | multer already handles these types; route to `/api/doc-intelligence/process/:problemSetId` |
| UNIV-08 | Lead agent orchestrator: triage all inputs, select specialists, manage parallel processing, handle failures | New `UniversalIngestOrchestrator` service; delegates to existing pipelines |
| UNIV-09 | Real-time inline status per item: queued → classifying → processing → extracting → complete/error | Extend `useBrainIngestion` hook; add `classify:start`, `classify:complete`, `route:selected` SSE events |
| UNIV-10 | Error recovery UI — retry button; orchestrator auto-retries with backoff | Existing `processing:error` SSE event + retry pattern already in DocIntelligencePanel |
| UNIV-11 | Batch input — multiple items simultaneously; individual status per item | Track items by UUID in frontend Map; submit each independently to backend |
| UNIV-12 | Unified chronological feed replaces separate Documents/OSINT/Events sections | Merge all events from SSE stream into one feed; tag with source type for filtering |
| UNIV-13 | Smart suggestions for ambiguous input — chips ("Looks like RSS — Subscribe?") | Frontend-only: show chips based on classification response from UNIV-15 |
| UNIV-14 | Keyboard shortcuts: Ctrl+V triggers ingestion, Enter submits, Escape cancels | React `onKeyDown` + `document.addEventListener('paste', ...)` |
| UNIV-15 | Backend `POST /api/ingest/classify` — detect type + confidence + suggested pipeline | New Express route; uses HEAD request + content sniffing + optional LLM call |
| UNIV-16 | Backend `POST /api/ingest/submit` — route to correct pipeline; return processId | New Express route; delegates to existing doc-intelligence or OSINT endpoints |
| UNIV-17 | Preserve existing SSE stream; extend with classification/routing events | Add `classify:start`, `classify:result`, `route:selected` to existing SSE broadcaster |
| UNIV-18 | Deprecate (don't remove) AddOSINTSourceModal and doc upload zone — keep as "Advanced" link | Hide behind link; no code deletion required |
| UNIV-19 | Mobile-responsive — touch drag-drop, mobile paste | CSS touch-action; HTML5 drag-drop works on iOS/Android Chrome |
| UNIV-20 | Accessibility — ARIA labels, keyboard navigation, screen reader announcements | aria-live regions for status; role="status" on inline status chips |
</phase_requirements>

---

## Standard Stack

### Core (all already installed — no new dependencies required)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | ^19.2.0 | Frontend component | Already in use throughout |
| multer | ^2.0.2 | Multipart file upload to backend | Already handles all doc types |
| rss-parser | ^3.13.0 | RSS/Atom feed detection and parsing | Already used in feed-poller.ts |
| jsdom | ^28.1.0 | HTML parsing for web article extraction | Already installed; used in svg-sanitizer.ts |
| Node.js built-in fetch | Node 18+ | URL HEAD requests and content fetching | No dependency needed |
| EventSource (SSE) | Browser built-in | Real-time status streaming | Already used in useBrainIngestion.ts |
| LangGraph StateGraph | ^1.1.0 | Orchestration of classification pipeline | Already used in doc-intelligence orchestrator |

### Supporting (may be needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| axios | ^1.13.2 | URL fetching with timeout + redirect handling | If native fetch proves insufficient for URL unfurling; already installed |
| @dnd-kit/core | ^6.3.1 | Enhanced drag-drop if HTML5 events are insufficient | Only if native drag-drop touch events prove problematic |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsdom for HTML extraction | Playwright/Puppeteer | Playwright executes JS but isn't installed and would add 200MB+ to bundle; jsdom is sufficient for article metadata extraction |
| LLM classification for text | rule-based heuristics only | LLM is more accurate for ambiguous cases; the existing triage pattern is already fast (same model, same latency) |
| New SSE endpoint | WebSocket | SSE is already established; changing protocol for one feature adds complexity with no benefit |

**Installation:** No new packages required. All needed libraries are already in `backend/package.json` and `frontend/package.json`.

---

## Architecture Patterns

### Recommended Project Structure

New files for this phase:

```
backend/src/
├── ingest/
│   ├── universal-classifier.ts      # Content-type detection logic
│   ├── url-unfurler.ts              # URL fetch + metadata extraction
│   └── universal-ingest-router.ts  # Routes classified content to correct pipeline
backend/src/api/
└── ingest.ts                        # POST /api/ingest/classify + /api/ingest/submit

frontend/src/components/brain/
├── UniversalInputZone.tsx           # The new input widget
├── UniversalInputZone.css           # Styles
├── IngestItemStatus.tsx             # Per-item inline status chip
└── hooks/
    └── useUniversalIngest.ts        # State machine for item tracking + SSE events
```

**Modified files:**
- `IngestionSidebar.tsx` — replace doc upload section and OSINT modal with `<UniversalInputZone>`; keep "Advanced" link to original panels
- `useBrainIngestion.ts` — add handlers for new SSE event types
- `BrainController.tsx` — no changes needed (receives IngestionSidebar as prop already)
- `doc-intelligence.ts` (backend) — extend `createSSEProgressCallback` to accept and forward classification events

### Pattern 1: Content Classification Pipeline

**What:** Detect input type before routing. Classification is fast (heuristic-first, LLM only when ambiguous).
**When to use:** Every input enters through classify first; submit second.

```typescript
// Source: backend/src/ingest/universal-classifier.ts (new)

export type InputType =
  | 'file'
  | 'rss_url'
  | 'article_url'
  | 'pdf_url'
  | 'api_url'
  | 'raw_text'
  | 'json_data'
  | 'xml_data'
  | 'unknown';

export interface ClassificationResult {
  inputType: InputType;
  confidence: number;         // 0-1
  suggestedPipeline: 'doc-intelligence' | 'osint-subscribe' | 'text-ingest' | 'manual';
  metadata: {
    contentType?: string;     // from HEAD request
    title?: string;           // OG title or filename
    description?: string;     // OG description or first 200 chars
    feedUrl?: string;         // validated RSS endpoint
    isRss?: boolean;
  };
}

export async function classifyInput(
  content: string | Buffer,
  hint?: { filename?: string; mimeType?: string }
): Promise<ClassificationResult> {
  // 1. Buffer (file upload) → check hint.mimeType or magic bytes
  if (Buffer.isBuffer(content)) {
    return classifyFile(content, hint);
  }

  // 2. URL pattern → HEAD request → check Content-Type
  if (isUrl(content)) {
    return classifyUrl(content);
  }

  // 3. JSON probe
  try { JSON.parse(content); return { inputType: 'json_data', confidence: 0.95, ... }; }
  catch {}

  // 4. XML heuristic
  if (content.trimStart().startsWith('<')) {
    return { inputType: 'xml_data', confidence: 0.85, ... };
  }

  // 5. Fallback: raw text — optionally call LLM for subtype classification
  return classifyText(content);
}
```

### Pattern 2: URL Unfurling

**What:** Fetch URL, detect content type, extract metadata. Handles redirects and timeouts.
**When to use:** For every URL-type input.

```typescript
// Source: backend/src/ingest/url-unfurler.ts (new)

export async function unfurlUrl(url: string): Promise<UnfurlResult> {
  // Step 1: HEAD request to check Content-Type without downloading body
  const headRes = await fetch(url, {
    method: 'HEAD',
    signal: AbortSignal.timeout(5000),
    redirect: 'follow',
  });

  const contentType = headRes.headers.get('content-type') ?? '';

  // Step 2: Content-Type routing
  if (contentType.includes('application/rss+xml') || contentType.includes('application/atom+xml')) {
    return { type: 'rss', url: headRes.url }; // headRes.url = final URL after redirects
  }
  if (contentType.includes('application/pdf')) {
    return { type: 'pdf_url', url: headRes.url };
  }

  // Step 3: For HTML, do a GET and parse OG tags + check for RSS link rel
  if (contentType.includes('text/html')) {
    const body = await fetch(url, { signal: AbortSignal.timeout(10000) }).then(r => r.text());
    const dom = new JSDOM(body);
    const doc = dom.window.document;

    // Check for RSS autodiscovery link
    const rssLink = doc.querySelector('link[type="application/rss+xml"]');
    if (rssLink) {
      const feedUrl = rssLink.getAttribute('href');
      return { type: 'rss', url: feedUrl ?? url, discoveredFrom: url };
    }

    // Try rss-parser directly — some URLs ARE feeds but return text/html
    try {
      const parser = new RSSParser();
      await parser.parseURL(url);
      return { type: 'rss', url };
    } catch {}

    // Extract OG metadata for article treatment
    const title = doc.querySelector('meta[property="og:title"]')?.getAttribute('content')
      ?? doc.querySelector('title')?.textContent ?? '';
    const description = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? '';

    return { type: 'article', url, title, description, htmlBody: body };
  }

  return { type: 'unknown', url };
}
```

### Pattern 3: Frontend Input Zone State Machine

**What:** Track each input item through `queued → classifying → routing → processing → complete/error`.
**When to use:** One state machine entry per submitted item.

```typescript
// Source: frontend/src/components/brain/hooks/useUniversalIngest.ts (new)

type ItemStatus = 'queued' | 'classifying' | 'routing' | 'processing' | 'complete' | 'error';

interface IngestItem {
  id: string;              // client-generated UUID
  label: string;           // filename, URL, or first 60 chars of text
  status: ItemStatus;
  progress: number;        // 0-1
  processId?: string;      // backend processId for SSE tracking
  classification?: ClassificationResult;
  error?: string;
  retryCount: number;
}
```

### Pattern 4: RSS Auto-Subscribe (no modal)

**What:** When classification returns `rss_url`, call `osintService.createFeed()` with sensible defaults.
**When to use:** High confidence RSS detection.

```typescript
// Sensible defaults for auto-created RSS subscriptions
const DEFAULT_RSS_CONFIG: Partial<CreateFeedInput> = {
  sourceType: 'rss',
  pollingIntervalMs: 15 * 60 * 1000,  // 15 min default
  relevanceMode: 'entity_objective',
  // sourceName derived from feed title extracted during unfurling
};
```

When confidence is < 0.85, show smart suggestion chip instead of auto-subscribing (UNIV-13).

### Pattern 5: Batch Processing

**What:** Accept multiple items at once; process each independently with its own status.
**When to use:** When user drops multiple files or pastes a URL list.

The frontend generates a UUID per item and submits them in parallel via `Promise.all`. The backend returns a `processId` per item. The frontend tracks each `processId` in the `IngestItem` map.

### Anti-Patterns to Avoid

- **Rebuilding the doc-intelligence pipeline:** Route into `POST /api/doc-intelligence/process/:problemSetId` — don't duplicate the LangGraph graph.
- **Blocking the UI on classification:** Call `/api/ingest/classify` async; show "classifying..." immediately; render chips when result arrives.
- **Using `window.alert` for duplicate detection:** The existing 409 duplicate-detection response should surface as an inline error on the item chip, not a modal.
- **Removing AddOSINTSourceModal:** UNIV-18 explicitly says deprecate, don't remove. Keep it behind "Advanced" link.
- **One giant `IngestionSidebar` component:** Extract `UniversalInputZone` as an independent component. The sidebar becomes a thin wrapper.
- **State in the SSE hook for classification events:** Extend `useBrainIngestion` minimally; most classification state lives in `useUniversalIngest`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| RSS feed validation | Custom XML parser | `rss-parser` (already installed) | Handles edge cases in Atom, RSS 1.0/2.0, malformed feeds |
| HTML metadata extraction | Custom regex | `jsdom` (already installed) | Correct DOM API; handles encoding, malformed HTML |
| Binary content-type detection | Magic byte inspection | `multer` MIME sniffing + `file.mimetype` | multer already does this on upload |
| URL redirect following | Manual redirect chain | `fetch` with `redirect: 'follow'` | Built-in, handles 301/302/307/308 chains |
| Exponential backoff retry | Custom setTimeout chain | Pattern already in `useBrainIngestion.ts` (lines 286-292) | Copy the existing `3000 * Math.pow(2, attempts)` pattern |
| Document text extraction from web page | Readability-style parser | jsdom + extract `document.body.innerText` | Sufficient for intelligence ingestion; full Readability adds a dependency |

**Key insight:** Every piece of infrastructure this phase needs already exists in the codebase. The phase builds a routing and UX layer, not new processing systems.

---

## Common Pitfalls

### Pitfall 1: ProblemSetContext Gate on Document Processing
**What goes wrong:** `POST /api/doc-intelligence/process/:problemSetId` returns 400 with `INTERVIEW_REQUIRED` if no scoping context exists. A user who drops a file before completing the interview will get a confusing error.
**Why it happens:** The orchestrator requires a `ProblemSetContext` to scope document classification (lines 584-594 of doc-intelligence.ts).
**How to avoid:** The `POST /api/ingest/submit` router must check for `ProblemSetContext` before routing to doc-intelligence and surface a clear inline message: "Complete the problem set scoping interview first." The universal input zone should show an interview-required banner when no context exists.
**Warning signs:** 400 response with `code: 'INTERVIEW_REQUIRED'` from the process endpoint.

### Pitfall 2: SSE Connection Race on Multiple Parallel Items
**What goes wrong:** When multiple items are submitted simultaneously, each gets its own `processId`. The existing `useBrainIngestion` hook monitors a single problem-set-wide SSE stream — parallel items will interleave events. If the frontend uses `processId` correctly to route events to the right `IngestItem`, this is fine. If processId is ignored, status updates appear on the wrong item.
**Why it happens:** The problem-set SSE stream in `problemSetSSEClients` multiplexes all sessions. Each event carries `processId` (added in `createSSEProgressCallback`).
**How to avoid:** `useUniversalIngest` must index all status updates by `processId`. Never use a positional index.
**Warning signs:** Progress bars jumping between items during batch uploads.

### Pitfall 3: URL Unfurling Timeout / CORS
**What goes wrong:** Some URLs return slowly, redirect many times, or have CORS headers that block frontend fetching. If URL unfurling is done in the browser, many intelligence sources will fail.
**Why it happens:** OSINT sources often have anti-scraping measures that block browser User-Agent strings.
**How to avoid:** URL unfurling MUST happen on the backend (`/api/ingest/classify` with the URL as body). Never fetch external URLs from the frontend. Use `AbortSignal.timeout(5000)` for HEAD and `AbortSignal.timeout(10000)` for GET.
**Warning signs:** CORS errors in console, or classification never resolving for URL inputs.

### Pitfall 4: Paste Event Content Ambiguity
**What goes wrong:** `navigator.clipboard.readText()` is async and permission-gated. `document.addEventListener('paste', ...)` fires synchronously with `ClipboardEvent.clipboardData.getData('text/plain')` — this is the correct approach for Ctrl+V ingestion.
**Why it happens:** Two different browser APIs exist for reading clipboard.
**How to avoid:** Use the synchronous `paste` event on the document/input element. Check `e.clipboardData.files` first (clipboard image paste), then `e.clipboardData.getData('text/plain')` for text.
**Warning signs:** Permission dialogs appearing unexpectedly on paste.

### Pitfall 5: RSS vs. HTML Disambiguation
**What goes wrong:** Some RSS feed URLs return `Content-Type: text/html` despite serving valid XML. Some web pages include `<link rel="alternate" type="application/rss+xml">` pointing to the actual feed. Naive HEAD-only classification will misidentify feeds as articles.
**Why it happens:** Servers misconfigure content types; CMS platforms like WordPress serve feeds at `/feed` which may redirect.
**How to avoid:** Three-step check: (1) HEAD request Content-Type, (2) if HTML, check for `<link rel="alternate" type="application/rss+xml">` in DOM, (3) attempt `rssParser.parseURL(url)` with short timeout. If any step confirms RSS, treat as feed.
**Warning signs:** Wikipedia/Reuters articles being auto-subscribed as RSS feeds.

### Pitfall 6: Duplicate Detection Surfacing
**What goes wrong:** The existing doc-intelligence endpoint returns 409 for duplicates. Without proper handling in the universal submit path, duplicate documents will silently fail or show a generic error.
**Why it happens:** The 409 has structured data (`code: 'DUPLICATE_EXACT'` or `'DUPLICATE_SIMILAR'`) that the new ingest router must propagate.
**How to avoid:** `/api/ingest/submit` must surface the 409 back to the frontend with the duplicate info. The frontend renders a "Already ingested" inline chip with optional "Force re-ingest" button.
**Warning signs:** Files disappearing from the status feed with no explanation.

---

## Code Examples

Verified patterns from existing codebase:

### Existing Drag-Drop Pattern (DocIntelligencePanel.tsx)
```typescript
// Source: frontend/src/components/doc-intelligence/DocIntelligencePanel.tsx
const [dragOver, setDragOver] = useState(false);
const dropZoneRef = useRef<HTMLDivElement>(null);

// The dropzone div uses onDragOver, onDragLeave, onDrop handlers
// This exact pattern should be reused in UniversalInputZone
```

### Existing SSE Progress Callback (doc-intelligence.ts lines 176-206)
```typescript
// Source: backend/src/api/doc-intelligence.ts
function createSSEProgressCallback(session: ProcessingSession): ProgressCallback {
  return (event: string, data: Record<string, unknown>) => {
    const enrichedData = { ...data, processId: session.processingId, documentId: session.documentId };
    // Broadcasts to per-session AND problem-set-wide clients
    const psClients = problemSetSSEClients.get(session.problemSetId);
    if (psClients) {
      for (const client of psClients) {
        client.write(`event: ${event}\n`);
        client.write(`data: ${JSON.stringify(enrichedData)}\n\n`);
      }
    }
  };
}
// New classification events (classify:start, classify:result, route:selected)
// should follow this exact same pattern
```

### Existing OSINT Feed Create Pattern (osint-service.ts)
```typescript
// Source: frontend/src/lib/osint-service.ts
async createFeed(data: CreateFeedInput): Promise<OSINTFeedConfig> {
  const res = await fetch(`${API_BASE}/api/osint/feeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  // ...
}
// UniversalInputZone calls this directly after RSS classification confirmed
```

### Existing Retry/Backoff Pattern (useBrainIngestion.ts lines 286-292)
```typescript
// Source: frontend/src/components/brain/hooks/useBrainIngestion.ts
if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
  const delay = 3000 * Math.pow(2, reconnectAttemptsRef.current);
  reconnectAttemptsRef.current += 1;
  reconnectTimer.current = setTimeout(() => connectRef.current(), delay);
}
// Copy this pattern for item-level retry in useUniversalIngest
```

### Existing SSE Event Handler Pattern (useBrainIngestion.ts)
```typescript
// Source: frontend/src/components/brain/hooks/useBrainIngestion.ts
es.addEventListener('processing:error', (e: MessageEvent) => {
  const data = JSON.parse(e.data) as { processId?: string; error?: string; timestamp?: string };
  const pid = data.processId ?? '';
  // Update activeProcesses Map keyed by processId
  setActiveProcesses((prev) => {
    const next = new Map(prev);
    // ...
  });
});
// useUniversalIngest should follow identical pattern with ingestItems Map
```

### RSS Validation Pattern (feed-poller.ts)
```typescript
// Source: backend/src/osint/feed-poller.ts
import RSSParser from 'rss-parser';
const rssParser = new RSSParser();
// In url-unfurler.ts, use: await rssParser.parseURL(url) — throws if not valid RSS
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual OSINT modal (sourceType + URL + interval) | Auto-detected from URL + smart defaults | Phase 50 | Removes cognitive burden from user |
| Separate "Ingest Documents" button launching panel | Universal drag-drop zone always visible | Phase 50 | One interaction surface for all content |
| Filter tags scoped to event type | Unified feed with per-item type badge | Phase 50 | Cleaner feed; type still visible |
| DocIntelligencePanel in collapsible section | DocIntelligencePanel behind "Advanced" link | Phase 50 | Declutters primary sidebar |

**What MUST NOT change:**
- The `DocIntelligenceStateAnnotation` LangGraph graph — zero changes needed
- The `osintFeedStore` and `feed-poller.ts` polling loop — RSS subscriptions still work the same way
- The `problemSetSSEClients` multiplexing in doc-intelligence.ts — just add new event types
- The `ProblemSetContext` requirement for document processing — enforce gracefully with clear UX message

---

## Open Questions

1. **ProblemSetContext bypass for URL/text ingestion**
   - What we know: File processing requires interview completion. Text snippets and URLs may not need full scoping context.
   - What's unclear: Should URL articles and pasted text bypass the context gate, or should they also require interview completion?
   - Recommendation: For Phase 50, require interview completion for all pipeline-bound content (same as current). Show "Complete scoping interview first" inline rather than blocking the entire input zone.

2. **Clipboard image handling (UNIV-01)**
   - What we know: `ClipboardEvent.clipboardData.files` can contain image data. The existing doc-intelligence pipeline accepts images via `application/octet-stream`.
   - What's unclear: Is image OCR / vision-based extraction in scope for Phase 50, or is this just "drop image → treat as document file → document-classifier handles it"?
   - Recommendation: Treat clipboard images the same as file drops. Send as `application/octet-stream` to doc-intelligence pipeline. No special OCR needed — the format-converter specialist can handle it if configured.

3. **API endpoint URL input (UNIV-02)**
   - What we know: `FeedSourceType` includes `'api'` as a type. The current OSINT system supports API endpoints with polling.
   - What's unclear: How does the classifier distinguish an API endpoint URL from a regular article URL? Most API endpoints don't return `application/json` on HEAD requests without auth headers.
   - Recommendation: For Phase 50, classify non-RSS, non-HTML URLs as `'unknown'` and show the smart suggestion chip (UNIV-13) rather than auto-routing. User confirms pipeline via chip.

---

## Validation Architecture

> `workflow.nyquist_validation` not set in config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (frontend — inferred from vite config) / manual API testing (backend) |
| Config file | None detected in `.planning/` — see Wave 0 |
| Quick run command | `cd frontend && npx vitest run --reporter=verbose` |
| Full suite command | `cd frontend && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UNIV-02 | `classifyInput()` detects URL vs text vs JSON vs XML | unit | `vitest run --reporter=verbose src/lib/universal-classifier.test.ts` | Wave 0 |
| UNIV-03 | `unfurlUrl()` extracts RSS vs article vs PDF | unit (mock fetch) | `vitest run src/lib/url-unfurler.test.ts` | Wave 0 |
| UNIV-04 | RSS URL creates feed with defaults, no modal | integration | manual — POST /api/ingest/submit with RSS URL | N/A |
| UNIV-05 | Article URL ingested through doc-intelligence | integration | manual — POST /api/ingest/classify returns `article_url` | N/A |
| UNIV-09 | SSE events carry processId, status transitions correctly | unit | `vitest run src/hooks/useUniversalIngest.test.ts` | Wave 0 |
| UNIV-15 | POST /api/ingest/classify returns correct type + confidence | integration | `curl -X POST /api/ingest/classify -d '{"content":"https://feeds.reuters.com/reuters/worldnews"}'` | N/A |
| UNIV-20 | ARIA labels present on input zone and status chips | unit (DOM) | `vitest run src/components/brain/UniversalInputZone.test.tsx` | Wave 0 |

### Sampling Rate
- **Per task commit:** Run unit tests for the file being changed
- **Per wave merge:** Full frontend suite green
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/src/ingest/universal-classifier.test.ts` — covers UNIV-02 content-type detection
- [ ] `backend/src/ingest/url-unfurler.test.ts` — covers UNIV-03 RSS vs article disambiguation
- [ ] `frontend/src/hooks/useUniversalIngest.test.ts` — covers UNIV-09 SSE state machine
- [ ] `frontend/src/components/brain/UniversalInputZone.test.tsx` — covers UNIV-20 accessibility

---

## Sources

### Primary (HIGH confidence)
- Direct code reading: `backend/src/api/doc-intelligence.ts` — upload endpoint, SSE machinery, duplicate detection
- Direct code reading: `backend/src/doc-intelligence/orchestrator.ts` + `orchestrator-wiring.ts` — LangGraph pipeline structure
- Direct code reading: `backend/src/osint/feed-poller.ts` — RSS parsing, rss-parser usage
- Direct code reading: `frontend/src/components/brain/IngestionSidebar.tsx` — existing UI structure to be replaced
- Direct code reading: `frontend/src/components/brain/hooks/useBrainIngestion.ts` — SSE event pattern, processId tracking, retry/backoff
- Direct code reading: `frontend/src/lib/osint-service.ts` — createFeed() API shape
- Direct code reading: `backend/src/doc-intelligence/orchestrator.ts` — `TRIAGE_SYSTEM_PROMPT` for text classification reference
- `backend/package.json` — confirmed jsdom, rss-parser, axios, multer all present
- `frontend/package.json` — confirmed no react-dropzone (use native HTML5 drag-drop)
- `.planning/ROADMAP.md` Phase 50 detail section — UNIV-01 through UNIV-20 requirements verbatim

### Secondary (MEDIUM confidence)
- HTML5 File Drag and Drop API MDN — native `ondrop` / `ondragover` with `e.dataTransfer.files`; confirmed working in React with `onDrop` prop
- ClipboardEvent API — `e.clipboardData.files` for clipboard images; `getData('text/plain')` for pasted text
- rss-parser npm — `parseURL()` throws on non-RSS content; can be used as RSS validator

### Tertiary (LOW confidence — flag for validation)
- (none — all claims verified against project code)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json
- Architecture: HIGH — all integration points read directly from source
- Pitfalls: HIGH — ProblemSetContext gate and SSE processId routing verified in source code
- Test infrastructure: MEDIUM — vitest assumed from Vite setup; no vitest.config.ts found

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable codebase; no fast-moving external dependencies)
