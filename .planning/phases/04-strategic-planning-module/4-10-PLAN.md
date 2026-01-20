# Plan 4-10: Objective Detail View & MIDLIFE Categorization

## Overview

Add a document detail view that displays extracted strategic objectives with the ability to view, edit, and categorize them. Implement automatic MIDLIFE categorization during extraction with human override capability.

## MIDLIFE Framework

MIDLIFE is an expanded categorization framework for instruments of national/strategic power:

- **M**ilitary - Armed forces, defense capabilities, military operations
- **I**nformation - Communications, media, cyber, public affairs
- **D**iplomatic - Foreign relations, treaties, alliances, negotiations
- **L**egal - International law, domestic law, rules of engagement
- **I**ntelligence - Collection, analysis, counterintelligence
- **F**inancial - Banking, sanctions, monetary policy
- **E**conomic - Trade, resources, development, industrial base

This extends the traditional DIME (Diplomatic, Information, Military, Economic) framework with Legal, Intelligence, and Financial as distinct categories.

## Dependencies

- Plan 4-09: End-to-End Strategic Flow (document upload, extraction)
- Existing objectives API endpoints
- Admin-configured LLM provider

## Tasks

### Task 1: Backend - MIDLIFE Schema Update
**Type:** auto
**Files:**
- `backend/src/strategic/schemas/strategic-objective.ts`
- `backend/src/strategic/objectives/store.ts`
- `backend/src/strategic/extraction/schemas.ts`

Update objective schema to support MIDLIFE categorization:
- Add `midlifeCategory` field with enum: MILITARY, INFORMATION, DIPLOMATIC, LEGAL, INTELLIGENCE, FINANCIAL, ECONOMIC
- Keep existing `primaryInstrument` (DIME) for backwards compatibility
- Add `midlifeCategorizedBy` field: 'AI' | 'HUMAN'
- Add `midlifeConfidence` field (0-1) for AI categorizations

### Task 2: Backend - Auto-Categorization in Extraction
**Type:** auto
**Files:**
- `backend/src/strategic/extraction/extractor.ts`
- `backend/src/strategic/extraction/prompts.ts`

Enhance LLM extraction to auto-categorize objectives:
- Update extraction prompt to identify MIDLIFE category
- Map existing DIME to MIDLIFE (D→Diplomatic, I→Information, M→Military, E→Economic)
- Add prompt guidance for Legal, Intelligence, Financial categories
- Return confidence score for categorization
- Default to 'AI' categorization source

### Task 3: Backend - Objective Update API Enhancement
**Type:** auto
**Files:**
- `backend/src/api/strategic.ts`

Enhance objective update endpoint:
- Accept MIDLIFE category updates
- Track when human overrides AI categorization
- Validate MIDLIFE category values

### Task 4: Frontend - Objective List Component
**Type:** auto
**Files:**
- `frontend/src/components/strategic/ObjectiveList.tsx`
- `frontend/src/components/strategic/ObjectiveList.css`

Create component to display objectives for a document:
- Fetch objectives via `/api/strategic/documents/:id/objectives`
- Display objective description (truncated with expand)
- Show MIDLIFE category badge with color coding
- Show AI/Human badge for categorization source
- Show confidence indicator for AI categorizations
- Support selecting an objective for detail view

### Task 5: Frontend - Objective Detail Panel
**Type:** auto
**Files:**
- `frontend/src/components/strategic/ObjectiveDetail.tsx`
- `frontend/src/components/strategic/ObjectiveDetail.css`

Create component for viewing/editing single objective:
- Display full objective description
- Show Ends/Ways/Means breakdown
- Show source reference from document
- Editable MIDLIFE category dropdown
- Show constraints and assumptions
- Edit mode toggle for modifications
- Save button to update via API

### Task 6: Frontend - MIDLIFE Category Selector
**Type:** auto
**Files:**
- `frontend/src/components/strategic/MidlifeCategorySelector.tsx`
- `frontend/src/components/strategic/MidlifeCategorySelector.css`

Create reusable MIDLIFE category component:
- Dropdown with all 7 categories
- Color-coded options matching badges
- Icon for each category
- Tooltip with category description
- Indicate when changing from AI to HUMAN categorization

### Task 7: Frontend - Integrate into StrategicDashboard
**Type:** auto
**Files:**
- `frontend/src/components/strategic/StrategicDashboard.tsx`
- `frontend/src/components/strategic/StrategicDashboard.css`

Update dashboard to show objectives in detail view:
- Replace placeholder text with ObjectiveList
- Add ObjectiveDetail panel when objective selected
- Handle objective selection state
- Breadcrumb: Documents → Document → Objective

### Task 8: Frontend Types Update
**Type:** auto
**Files:**
- `frontend/src/lib/types/strategic.ts`

Add MIDLIFE types to frontend:
- MidlifeCategory type union
- Update StrategicObjective interface
- Add category metadata types

### Task 9: Human Verification Checkpoint
**Type:** checkpoint:human-verify

Test the complete flow:
1. Upload a document
2. Extract objectives (verify MIDLIFE auto-categorization)
3. Click document card to see objective list
4. Click objective to see detail view
5. Change MIDLIFE category and save
6. Verify category persists on refresh

## MIDLIFE Color Scheme

```
MILITARY:     #dc2626 (red-600)     - Shield icon
INFORMATION:  #2563eb (blue-600)    - Broadcast icon
DIPLOMATIC:   #7c3aed (violet-600)  - Handshake icon
LEGAL:        #059669 (emerald-600) - Scale icon
INTELLIGENCE: #4f46e5 (indigo-600)  - Eye icon
FINANCIAL:    #ca8a04 (yellow-600)  - Dollar icon
ECONOMIC:     #ea580c (orange-600)  - Chart icon
```

## API Endpoints Used

- `GET /api/strategic/documents/:id/objectives` - List objectives
- `GET /api/strategic/objectives/:id` - Get single objective
- `PUT /api/strategic/objectives/:id` - Update objective (including MIDLIFE)

## Notes

- MIDLIFE extends DIME, so existing DIME categorizations remain valid
- AI categorization happens during extraction; humans can override anytime
- Confidence scores help users identify objectives needing human review
- Low confidence objectives (< 0.7) could be highlighted for review
