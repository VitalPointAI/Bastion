# Phase 15: JPP Staff Organization Workspaces - Context

**Gathered:** 2026-03-01
**Updated:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize the exercise workspace to mirror Joint staff organization. Provide role-based workspaces for the complete Joint staff — J-staff (J1-J9), special staff, supporting elements, and component commands — with templated doctrinal products, cross-staff real-time notifications, AI agent team integration, and strategic direction import from Design tab. Implementation scoped to the Exercise area first, with future extension to remodel the rest of the application.

</domain>

<decisions>
## Implementation Decisions

### Complete Staff Roster (31 positions)

Workspaces are data-driven — adding a new role requires only a configuration entry, not code changes. The full roster is organized into 5 categories:

**Command (2):**
| Role Key | Position | Doctrinal Focus |
|----------|----------|-----------------|
| `commander` | Commander (JFC) | Intent, guidance, COA selection, decisions |
| `dcom` | Deputy Commander | Day-to-day battle rhythm, staff coordination oversight |

**J-Staff (11):**
| Role Key | Position | Doctrinal Focus |
|----------|----------|-----------------|
| `cos` | Chief of Staff | Staff coordination, battle rhythm management |
| `j1` | J1 Personnel | Manpower, casualty reporting, morale, admin |
| `j2` | J2 Intelligence | IPB, threat assessment, intel summaries, collection mgmt |
| `j3` | J3 Operations | Current ops, synchronization matrices, battle tracking |
| `j35` | J35 Future Ops/Plans | COA development, future operations planning |
| `j4` | J4 Logistics | Sustainment, supply chain, movement, maintenance |
| `j5` | J5 Strategic Plans | Theater strategy, policy coordination, campaign plans |
| `j6` | J6 Communications | C4/IT, network ops, PACE plans, spectrum mgmt |
| `j7` | J7 Training/Exercises | Training objectives, exercise control, lessons learned |
| `j8` | J8 Resources | Force structure, budget, capability assessment |
| `j9` | J9 Civil-Military | Civil affairs, CIMIC, humanitarian assistance |

**Special Staff (4):**
| Role Key | Position | Doctrinal Focus |
|----------|----------|-----------------|
| `sja` | SJA/LEGAD | Legal review, ROE, law of armed conflict |
| `polad` | POLAD | Political context, diplomatic coordination |
| `pao` | PAO/Public Affairs | Strategic comms, media, information environment |
| `surgeon` | Surgeon | Medical planning, casualty estimates, health services |

**Supporting Elements (7):**
| Role Key | Position | Doctrinal Focus |
|----------|----------|-----------------|
| `cyber` | Cyber Operations | Offensive/defensive cyber, network defense |
| `space` | Space Operations | ISR, SATCOM, PNT, space domain awareness |
| `transcom` | Strategic Mobility | Airlift, sealift, strategic movement planning |
| `socom` | Special Operations | SOF integration, unconventional warfare |
| `io` | Information Operations | MISO, OPSEC, military deception |
| `fires` | Joint Fires Element | Targeting, fire support coordination, strike planning |
| `ew` | Electronic Warfare | EMS operations, jamming, spectrum management |

**Component Commands (4):**
| Role Key | Position | Doctrinal Focus |
|----------|----------|-----------------|
| `jfacc` | JFACC (Air) | Air tasking orders, airspace control, air defense |
| `jflcc` | JFLCC (Land) | Ground scheme of maneuver, land force integration |
| `jfmcc` | JFMCC (Maritime) | Maritime ops, sea control, naval fires |
| `jfsocc` | JFSOCC (SOF) | Special operations component integration |

**Additional Elements (3):**
| Role Key | Position | Doctrinal Focus |
|----------|----------|-----------------|
| `engineer` | Joint Engineer | Obstacle planning, route clearance, construction |
| `cbrn` | CBRN | Chemical/bio/rad/nuclear defense planning |
| `knowledge_mgmt` | Knowledge Management | COP management, information flow architecture |

### Workspace Customization (Critical)
- With 31 possible roles, exercises MUST only show workspaces for roles actually being used
- Exercise creator selects which roles to enable during exercise creation — only enabled roles appear in sidebar
- Offer preset templates for common configurations:
  - **Full Joint Staff** — all 31 positions
  - **Core Staff** — Commander, CoS, J1-J6, J35 (10 positions)
  - **Intel Focus** — Commander, J2, J35, J3, JFACC, Fires (6 positions)
  - **Custom** — pick individual roles from the full roster
- Sidebar should group roles by category (Command, J-Staff, Special Staff, Supporting, Components) with collapsible sections — flat list of 31 would be unwieldy
- Roles can be added/removed from an exercise after creation

### Workspace Structure & Navigation
- Vertical sidebar within the exercise area listing enabled staff roles, grouped by category
- Collapsible category headers (Command, J-Staff, Special Staff, Supporting, Components)
- Users click a role in the sidebar to load that role's workspace in the main content area
- Free switching between any role workspace — no assignment-based restriction

### Role Dashboard
- Each role workspace opens to a task-centric dashboard overview
- Outstanding actions first: pending notifications, draft products needing attention
- Then product summary showing all products with status (draft/published/needs update)
- Recent activity and quick actions available below
- Commander's workspace doubles as the combined staff overview — Commander sees all published products from all roles in addition to their own workspace

### Doctrinal Product Templates
- Hybrid template approach: structured data fields (dropdowns, tables, maps) for data that feeds other products + freeform rich text sections for narrative analysis
- Stacked layout: structured fields on top, freeform narrative below — scroll down to write
- Products pre-populated from existing exercise data (Phase 14 IPB/COA work) as editable drafts — users can immediately edit and publish
- Cross-product relationships use notification + manual pull: when a source product changes, linked products show a notification badge; user reviews and accepts/rejects the update
- Each role starts with their doctrinal default product set, but can also create custom products from a template library
- Publish snapshots only for versioning — only published versions are tracked; drafts are just current state

### Publishing & Distribution
- Explicit publish trigger — user clicks "Publish" when a product is ready; work-in-progress stays private and does not trigger notifications
- Publishing broadcasts to all enabled roles — everyone sees it
- System highlights roles where the product is most relevant

### Cross-Staff Notifications
- Global notification panel (bell icon) shows everything across the exercise — one unified feed
- Filter toggle available to scope to current role workspace
- Notifications persist until explicitly dismissed — user marks them read/done
- Notification action: view diff of what changed in source product + "Integrate" button

### Integration Flow
- Auto-merge with preview: system proposes merged content — user reviews a before/after diff and confirms
- Diff view splits structured field changes (shown as summary table) from narrative text changes (shown as text diff below)

### Strategic Direction Import
- Manual import anytime — "Import Strategic Direction" button available in the exercise to pull latest from Design tab on demand
- Strategic direction imports into the Commander's workspace specifically
- Commander distributes guidance to other roles through the publish/notification system

### AI Agent Panel
- Collapsible right-side panel that slides open alongside the editor — non-intrusive, human stays in control
- On-demand only: user clicks "Generate Suggestion" button — AI stays silent until asked
- Agent teams configured per-role with per-product overrides: each role has a configured agent team (applies to all products), with ability to customize per product if needed
- Accept/reject blocks: suggestion broken into blocks — user accepts or rejects each piece individually

### Claude's Discretion
- Notification delivery mechanism (real-time WebSocket vs poll-based — pick what fits existing architecture)
- Dashboard component styling and exact layout per role
- Exact structured field types per doctrinal product template
- Which doctrinal products to pre-configure for each role (based on JP 5-0 and joint planning doctrine)
- Category grouping visual design in sidebar

</decisions>

<specifics>
## Specific Ideas

- Role sidebar should feel natural within the existing exercise area — extend current UI patterns rather than introducing new navigation paradigms
- With 31 roles, the sidebar MUST use category grouping with collapsible sections — a flat list would be unusable
- Pre-population from Phase 14 data is key: J2 should see existing IPB products, threat assessments, and intelligence summaries immediately available in their workspace as editable drafts
- The publish/notification flow mirrors how real staff sections operate — products are shared when ready, not during draft state
- Commander workspace is the doctrinal entry point for strategic direction, reflecting how guidance flows in real Joint planning (Commander's Intent down to staff)
- Commander's workspace also serves as the combined staff overview — they see all published products from all roles, matching the doctrinal role of the Commander as the integrating authority
- AI agent suggestion panel should feel like a helpful assistant, not an automatic generator — on-demand with accept/reject granularity
- Role definitions are data-driven config — adding a new role should never require code changes, only a new entry in the role configuration

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 15-jpp-staff-organization-workspaces*
*Context gathered: 2026-03-01*
