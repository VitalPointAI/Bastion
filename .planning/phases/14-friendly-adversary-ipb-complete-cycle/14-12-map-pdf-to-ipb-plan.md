# Plan 14-12: Map PDF → IPB Graph Conversion

## Problem Statement

Planning map PDFs contain visual/spatial content (terrain features, hex grids, unit positions, boundaries) that `unpdf` cannot extract as text. These documents currently get stored with empty `textContent` and show as "Parse failed" in the document table. The map data needs to be converted into structured IPB overlay layers.

---

## Phase 1: Vision-Based Map Extraction

**Goal**: Extract structured geographic/military data from map PDFs using a vision-capable LLM.

### 1.1 PDF-to-Image Rendering

**File**: `backend/src/strategic/ingestion/pdf-renderer.ts` (new)

- Install `pdf2pic` (uses GraphicsMagick) or use `pdfjs-dist` + `canvas` for pure-JS rendering
- Recommended: `pdfjs-dist` + `@napi-rs/canvas` — no system dependencies, runs in Docker Node image
- Method: `renderPagesToImages(buffer: Buffer, opts?: { dpi?: number, maxPages?: number }): Promise<{ page: number, base64: string, width: number, height: number }[]>`
- For the 133MB map PDF, render at 150 DPI to keep image sizes manageable (~2-4MB per page)
- Cap at 10 pages maximum per document to stay within vision API limits

**Docker considerations**:
- `@napi-rs/canvas` is a native module — add to Dockerfile build stage
- Alternative: `sharp` can render PDF via libvips but requires `poppler-glib` in the container

### 1.2 Vision Extraction Prompt

**File**: `backend/src/exercise/extraction-service.ts` — new method `extractMapWithVision()`

- Detect PLANNING_MAP documents with empty textContent
- Send rendered page images to Claude vision API with a specialized prompt:
  ```
  You are a military map analyst. Extract structured geographic and military data from this planning map.
  Identify:
  - Named regions and hex grid identifiers
  - Key terrain features (mountains, rivers, urban areas, chokepoints)
  - Unit positions and symbols (identify SIDC codes if possible)
  - Boundaries (operational areas, phase lines, boundaries between units)
  - Avenues of approach and engagement areas
  - Named Areas of Interest (NAIs)

  For each feature, estimate geographic coordinates or provide hex grid references.
  ```
- Use the existing `extract_exercise_data` tool schema, focusing on `forceDispositions` and geographic features
- Store vision-extracted description as `textContent` for subsequent standard extraction

### 1.3 Integration with Retry Flow

**File**: `backend/src/api/exercise.ts` — update retry-extraction endpoint

- When retrying a PLANNING_MAP document with empty text:
  1. Check if `file_data` exists
  2. Render PDF pages to images via `renderPagesToImages()`
  3. Call `extractMapWithVision()` instead of standard text extraction
  4. Store the vision-generated text description + structured overlay data

### 1.4 Dependencies

```
pnpm add @napi-rs/canvas    # Pure-JS canvas for PDF rendering (or)
pnpm add pdf2pic             # GraphicsMagick-based (requires GM in Docker)
```

Dockerfile addition (if using pdf2pic):
```dockerfile
RUN apk add --no-cache graphicsmagick ghostscript
```

### 1.5 Estimated Effort
- PDF renderer utility: 1-2 hours
- Vision extraction method: 2-3 hours
- Integration + Docker config: 1-2 hours
- Testing with actual map PDF: 1 hour

---

## Phase 2: IPB Overlay Layer Mapping

**Goal**: Convert vision-extracted map data into IPB overlay layers that render on the ValidityMap.

### 2.1 Map Feature → IPB Layer Converter

**File**: `backend/src/exercise/map-to-ipb-layers.ts` (new)

- Input: `ExtractedExerciseData` from vision extraction
- Output: `IPBLayer[]` compatible with existing overlay rendering

Mapping rules:
| Extracted Feature | IPB Layer Type | `layerType` |
|---|---|---|
| Unit positions | `unit` | `forces` |
| Mountains, rivers, obstacles | `area`/`line` | `key_terrain` / `obstacle` |
| Avenues of approach | `line` | `avenue_of_approach` |
| Named Areas of Interest | `area` | `nai` |
| Engagement areas | `area` | `engagement_area` |

### 2.2 Coordinate Resolution

Vision-extracted locations will often be:
- Hex grid references (e.g., "hex 1423") → need a hex-to-lat/lng conversion based on the map's grid system
- Named locations (e.g., "near Ankara") → geocode via a lookup table or geocoding API
- Relative positions (e.g., "northwest of the river junction") → estimate from map context

**Approach**:
1. Build a hex-grid-to-coordinate lookup if the exercise map uses a known hex grid
2. Use a static gazetteer for named locations within the exercise area
3. For relative positions, use the vision model to estimate pixel coordinates, then map to geo coordinates using known reference points

### 2.3 Auto-populate IPB from Map

When a PLANNING_MAP is successfully extracted:
1. Generate `IPBLayer[]` from the extracted data
2. Offer to auto-populate these layers into the team's IPB assessment
3. Staff reviews and confirms which layers to include (matches the manual MDMP workflow)

### 2.4 Frontend: Map Layer Preview

**File**: `frontend/src/components/exercise/MapExtractionPreview.tsx` (new)

- Shows extracted features from the map overlaid on a Leaflet/MapLibre map
- Staff can toggle individual layers on/off before importing to IPB
- Connects to existing ValidityMap rendering infrastructure

### 2.5 Estimated Effort
- Layer converter: 2-3 hours
- Coordinate resolution (hex grid + gazetteer): 3-4 hours
- IPB auto-population + review UI: 3-4 hours
- Map preview component: 2-3 hours

---

## Implementation Order

1. **Phase 1.1** — PDF-to-image rendering (unblocks everything else)
2. **Phase 1.2** — Vision extraction method (produces structured data)
3. **Phase 1.3** — Wire into retry flow (makes it usable immediately)
4. **Phase 2.1** — Feature-to-layer converter (automated IPB population)
5. **Phase 2.2** — Coordinate resolution (geographic accuracy)
6. **Phase 2.3-2.4** — Auto-populate IPB + preview UI (staff workflow integration)

## Risk Factors

- **Vision API cost**: Each map page = ~1 vision API call. A 10-page map = 10 calls.
- **Coordinate accuracy**: Vision models estimate positions from visual context; accuracy depends on map quality and labeled reference points.
- **Large file sizes**: 133MB PDF rendering to images at 150 DPI could produce 20-40MB of base64 images per page. May need to downsample.
- **Docker image size**: Canvas/GraphicsMagick dependencies add ~100-200MB to the Docker image.
