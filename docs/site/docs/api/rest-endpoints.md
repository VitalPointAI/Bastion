# REST API Reference

> Comprehensive endpoint catalog — approximately 572 REST endpoints

## Overview

BASTION exposes its backend functionality through a REST API organized by domain.
All endpoints are prefixed with `/api` and require authentication unless noted
otherwise. Authentication is handled via HttpOnly session cookies (passkey/WebAuthn)
and optionally an `X-DID` header for DID-based identity.

---

## Auth — `/api/auth`

Passkey-based authentication and account recovery.

- `POST /register` — begin passkey (WebAuthn) registration
- `POST /register/verify` — complete passkey registration
- `POST /login` — begin passkey authentication
- `POST /login/verify` — complete passkey authentication
- `POST /magic-link` — send a magic link for passwordless login
- `POST /magic-link/verify` — verify a magic link token
- `POST /recovery` — initiate account recovery
- `GET /session` — get current session info

## Accounts — `/api/accounts`

NEAR account creation and MPC key management.

- `POST /create` — create a new account (Privy + NEAR)
- `GET /:privyUserId` — get account details by Privy user ID
- `POST /add-mpc-key` — add an MPC signing key to an account
- `POST /update-mpc-key` — rotate or update an MPC key

## Identity — `/api/identity`

DID management, PRF credentials, and entity types.

- `POST /did/create` — create a new DID document
- `POST /did/resolve` — resolve a DID to its document
- `POST /did/check-active` — check if a DID is active
- `POST /derive-blinded-key` — derive a blinded signing key
- `GET /entity-types` — list available entity types
- `POST /register-prf` — register a PRF-derived credential
- `POST /resolve-prf` — resolve a PRF credential
- `GET /account/:accountId` — get account identity info
- `POST /register` — register identity
- `POST /validate` — validate an identity
- `GET /resolve/:did` — resolve a DID

## User Profile — `/api/user-profile`

User profile management and email validation.

- `POST /validate-email` — validate email against domain allowlist
- `GET /registration-requirements` — get required registration fields
- `GET /` — get current user's profile (requires auth)
- `POST /` — create or update user profile (requires auth)

## User Mode — `/api/user-mode`

Training/operational mode toggle.

- `GET /` — get current user mode (training or operational)
- `PUT /` — set user mode

---

## Problem Sets — `/api/problem-sets`

Problem set (workspace) management, membership, invitations, compartments,
activity, positions, subscriptions, and escalation rules.

### Core CRUD

- `POST /` — create a new problem set
- `POST /from-scenario` — create from a scenario package
- `GET /me` — list problem sets for current user
- `PUT /me/primary` — set primary problem set
- `GET /:id` — get problem set details
- `PATCH /:id` — update problem set
- `DELETE /:id` — archive a problem set
- `GET /:id/hierarchy` — get parent/child hierarchy

### Members

- `GET /:id/members` — list members
- `POST /:id/members/:memberDid/role` — assign role to member
- `POST /:id/members/:memberDid/suspend` — suspend a member
- `POST /:id/members/:memberDid/unsuspend` — unsuspend a member
- `DELETE /:id/members/:memberDid` — remove a member

### Invitations

- `GET /invite/code/:code` — look up invite by code
- `POST /invite/accept-by-code` — accept invite by code
- `POST /invite/accept` — accept invite by ID
- `POST /:id/invite` — create invitation
- `GET /:id/invites` — list pending invitations
- `POST /:id/invites/:inviteId/approve` — approve a pending invite
- `DELETE /:id/invites/:inviteId` — revoke an invitation

### Roles & Positions

- `GET /:id/roles` — list defined roles
- `GET /:id/positions` — list staff positions
- `POST /:id/positions` — create a position
- `PATCH /:id/positions/:positionId` — update a position
- `DELETE /:id/positions/:positionId` — delete a position
- `PUT /:id/positions/:positionId/phase-mappings` — set phase mappings
- `POST /:id/positions/bulk` — bulk create positions

### Compartments (Information Barriers)

- `GET /:id/compartments` — list compartments
- `POST /:id/compartments` — create a compartment
- `DELETE /:id/compartments/:cid` — delete a compartment
- `POST /:id/compartments/:cid/members` — add member to compartment
- `DELETE /:id/compartments/:cid/members/:mid` — remove member
- `GET /:id/members/:did/compartments` — list compartments for a member

### Activity & Notifications

- `GET /:id/activity` — activity feed
- `POST /notifications/counts` — batch notification counts

### Subscriptions & Escalation

- `POST /:id/subscriptions` — create notification subscription
- `GET /:id/subscriptions` — list subscriptions
- `PATCH /:id/subscriptions/:subId` — update subscription
- `DELETE /:id/subscriptions/:subId` — delete subscription
- `GET /:id/escalation-rules` — list escalation rules
- `POST /:id/escalation-rules` — create escalation rule
- `DELETE /:id/escalation-rules/:ruleId` — delete escalation rule
- `POST /:id/escalate` — trigger escalation

### Panel Config

- `GET /:id/panel-config` — get panel layout config
- `PUT /:id/panel-config` — update panel layout config

### Scenario & Agents

- `GET /:id/linked-scenario` — get linked scenario
- `POST /:id/scenario` — link a scenario
- `GET /scenario-usage-counts` — scenario usage statistics
- `GET /agents/list` — list agents available to problem set
- `GET /teams/list` — list agent teams

---

## Strategic Documents — `/api/strategic`

Document upload, extraction, objectives, reviews, assignments, and the
strategic environment workspace.

### Documents

- `POST /documents` — upload a document (multipart)
- `GET /documents` — list documents (with filters)
- `GET /documents/:id` — get document metadata
- `GET /documents/:id/text` — get extracted text
- `DELETE /documents/:id` — delete a document
- `POST /documents/:documentId/extract` — trigger AI extraction
- `GET /documents/:documentId/extract/stream` — stream extraction progress (SSE)

### Objectives

- `GET /documents/:documentId/objectives` — objectives from a specific document
- `GET /objectives` — list all objectives
- `GET /objectives/:id` — get objective details
- `PUT /objectives/:id` — update an objective
- `DELETE /objectives/:id` — delete an objective
- `POST /objectives/:id/verify` — trigger AI verification
- `POST /objectives/:id/submit` — submit for workflow review
- `POST /objectives/:id/review` — commander review (approve/reject)
- `GET /objectives/:id/workflow` — get workflow state
- `POST /objectives/:id/workflow/comment` — add workflow comment
- `POST /objectives/:id/workflow/escalate` — escalate objective
- `POST /objectives/:id/assess` — submit assessment update
- `GET /objectives/:id/risk` — get risk assessment
- `POST /objectives/:id/risk` — create risk assessment
- `PUT /risk/:assessmentId/review` — review risk assessment
- `GET /risk/high-risk` — list high-risk items

### Commander's Intent

- `POST /objectives/:id/intent` — create commander's intent
- `GET /objectives/:id/intent` — get intent
- `PUT /intent/:intentId` — update intent
- `POST /objectives/:id/intent/generate` — AI-generate intent

### Operationalize

- `GET /objectives/:id/operationalize` — get operational breakdown
- `POST /objectives/:id/operationalize` — trigger operationalization

### Document Reviews

- `POST /documents/:documentId/review` — trigger AI review
- `GET /documents/:documentId/review/stream` — stream review progress (SSE)
- `GET /documents/:documentId/reviews` — list reviews for document
- `GET /reviews/:reviewId` — get review details
- `POST /reviews/:reviewId/accept` — accept review
- `POST /reviews/:reviewId/accept-partial` — partially accept review
- `POST /reviews/:reviewId/reject` — reject review

### Assignments

- `POST /assignments` — create document assignment
- `GET /assignments` — list assignments
- `GET /documents/:documentId/assignments` — assignments for a document
- `PATCH /assignments/:id` — update assignment
- `DELETE /assignments/:id` — delete assignment

### Environment Workspace

- `GET /environments/by-problem-set/:problemSetId` — get environment
- `GET /environments/:envId/containers` — list containers
- `POST /environments/:envId/categories` — create category
- `PUT /categories/:categoryId` — update category
- `DELETE /categories/:categoryId` — delete category
- `POST /environments/:envId/containers` — create container
- `PUT /containers/:containerId` — update container
- `DELETE /containers/:containerId` — delete container
- `GET /containers/:containerId/documents` — documents in container
- `PUT /documents/:documentId/containers` — assign to containers
- `DELETE /documents/:documentId/containers/:containerId` — remove from container
- `GET /environments/:envId/unorganized` — unorganized documents
- `GET /documents/:documentId/containers` — containers for a document
- `POST /documents/:documentId/suggest-containers` — AI container suggestions

### Container Agents

- `POST /containers/:containerId/agents` — assign agent to container
- `GET /containers/:containerId/agents` — list container agents
- `DELETE /containers/:containerId/agents/:agentId` — remove agent

### Agents & Teams

- `GET /agents` — list strategic agents
- `GET /teams` — list strategic agent teams

## Strategic Tools — `/api/strategic-tools`

AI-powered analysis tools.

- `POST /categorize-midlife` — categorize documents by MIDLIFE framework
- `POST /prioritize-domain` — prioritize analysis by PMESII-PT domain

## Strategic Agents — `/api/strategic-agents`

OSINT collection, threat monitoring, intelligence fusion, and cycle management.

- `POST /osint/collect` — trigger OSINT collection
- `POST /threats/monitor` — start threat monitoring
- `GET /threats/alerts` — get threat alerts
- `POST /threats/alerts/:alertId/acknowledge` — acknowledge alert
- `POST /fuse` — trigger intelligence fusion
- `POST /cycle` — run full intelligence cycle
- `GET /fused/:id` — get fused product
- `GET /fused` — list fused products
- `POST /fused/:id/review` — review fused product
- `GET /checkpoints` — list agent checkpoints
- `POST /checkpoints/:id/resolve` — resolve a checkpoint
- `GET /status` — agent status summary

---

## Design — `/api/design`

Operational design workspace (CoG analysis, LOEs, operational approach).

- `GET /:problemSetId` — get design state
- `GET /:problemSetId/status` — get design completion status
- `PATCH /:problemSetId/:section` — update a design section
- `GET /:problemSetId/handoff` — get design-to-plan handoff package
- `POST /:problemSetId/push-handoff` — push handoff to Plan tab
- `POST /:problemSetId/analyze` — trigger AI design analysis

---

## Graph — `/api/graph`

RAFT knowledge graph (Relations, Actors, Facts, Themes), workspaces, OSINT
events, validity tracking, and entity resolution.

### Workspace Graph

- `GET /workspaces` — list graph workspaces
- `POST /workspaces` — create graph workspace
- `GET /workspaces/:id` — get workspace
- `PUT /workspaces/:id` — update workspace
- `DELETE /workspaces/:id` — delete workspace
- `GET /master-view` — get master (unified) graph view
- `GET /workspaces/:id/tree` — get workspace tree
- `GET /workspaces/:id/graph` — get full workspace graph data
- `GET /` — query graph (with workspaceId filter)

### Actors & Entities

- `GET /actors` — list actors
- `GET /actors/:id` — get actor details
- `GET /actors/search/:query` — search actors
- `GET /tensions` — get actor tensions

### OSINT Events

- `GET /osint/events` — list events (with filters)
- `POST /osint/events` — create an event
- `GET /osint/events/:id` — get event details
- `POST /osint/events/:eventId/link` — link event to graph entity

### Validity Tracking

- `POST /validity/:objectiveId/calculate` — calculate validity score
- `GET /validity/:objectiveId/history` — validity score history
- `GET /validity/:objectiveId/trend` — validity trend
- `GET /validity/alerts` — validity alerts
- `POST /validity/alerts/:alertId/acknowledge` — acknowledge alert
- `GET /validity/objectives` — list objectives with validity data

### Entity Resolution

- `GET /resolution/duplicates` — detect potential duplicates
- `POST /resolution/merge` — merge duplicate entities

### Graph Building & Summary

- `POST /graph/build/:documentId` — build graph from document
- `GET /summary/:containerId` — get container summary
- `POST /summary/:containerId/invalidate` — invalidate cached summary
- `GET /centrality-comparison` — compare centrality metrics

---

## Documents — `/api/documents`

Low-level document CRUD (used alongside strategic document API).

- `POST /upload` — upload a document (multipart)
- `GET /:documentId` — get document by ID
- `GET /` — list documents

---

## Inheritance — `/api/inheritance`

Strategic environment inheritance between parent and child problem sets.

- `GET /:id/inherited-context` — get inherited context from parent
- `POST /:id/inherited-context/acknowledge` — acknowledge inherited update
- `GET /:id/inherited-context/changelog` — changelog of inherited changes

### Annotations

- `POST /:id/annotations` — create annotation on inherited item
- `GET /:id/annotations` — list annotations
- `PUT /:id/annotations/:annotationId` — update annotation
- `GET /:id/annotations/parent-view` — parent's view of child annotations

### Requests for Information (RFIs)

- `POST /:id/rfis` — create RFI to parent
- `GET /:id/rfis` — list RFIs
- `POST /:id/rfis/:rfiId/messages` — add message to RFI thread
- `GET /:id/rfis/:rfiId/messages` — get RFI thread messages
- `PUT /:id/rfis/:rfiId/status` — update RFI status
- `POST /backfill` — backfill inheritance for existing problem sets

---

## DAO / Governance — `/api/dao`

DAO creation, proposals, voting, delegation, and role management.

- `GET /` — list DAOs (filtered by workspace)
- `GET /:daoId` — get DAO details
- `POST /` — create a DAO
- `PUT /:daoId/config` — update DAO configuration
- `GET /:daoId/proposals` — list proposals
- `GET /:daoId/proposals/:proposalId` — get proposal details
- `POST /:daoId/proposals` — submit a proposal
- `GET /:daoId/proposals/:proposalId/votes` — get votes on a proposal
- `POST /:daoId/proposals/:proposalId/vote` — cast a vote
- `POST /:daoId/proposals/:proposalId/execute` — execute approved proposal
- `POST /:daoId/proposals/:proposalId/finalize` — finalize voting
- `GET /:daoId/roles` — list DAO roles
- `POST /:daoId/roles` — create a DAO role
- `GET /:daoId/members/:account/roles` — get member's roles
- `POST /:daoId/delegate` — delegate voting power
- `GET /:daoId/delegations` — list delegations

## Decision Gates — `/api/gates`

Governance decision gates embedded at workflow transition points.

- `GET /:problemSetId` — list all gates for a problem set
- `GET /:problemSetId/:tab` — gates filtered by tab
- `GET /:problemSetId/escalated` — escalated gates from child problem sets
- `GET /:problemSetId/hierarchy` — own gates plus child gates
- `GET /:gateId/permissions/:userRole` — permission check for a role
- `POST /` — create a new decision gate
- `POST /:gateId/submit` — submit gate for approval
- `POST /:gateId/approve` — approve a gate
- `POST /:gateId/reject` — reject a gate (with reason)
- `POST /:gateId/override` — override a soft-warning gate (with justification)
- `POST /:gateId/escalate` — escalate gate to parent problem set
- `PATCH /:gateId/config` — update gate configuration (enforcement, deadline)

---

## Agents — `/api/agents`

AI agent registry, delegation, execution, and governance copilot.

- `GET /` — list all agents
- `GET /:agentId` — get agent details
- `POST /` — register a new agent
- `PUT /:agentId/deactivate` — deactivate an agent
- `GET /:agentId/delegations` — list agent delegations
- `POST /:agentId/delegations` — create delegation
- `DELETE /delegations/:delegationId` — revoke delegation
- `POST /:agentId/execute` — execute an agent task
- `POST /:agentId/analyze-all` — run full analysis
- `GET /:agentId/actions` — list agent actions
- `GET /governance-copilot/analyze` — governance copilot analysis

## AI Staff — `/api/ai-staff`

Contextual AI staff feed, annotations, chat, and tab routing.

- `GET /:problemSetId/feed` — get prioritized AI feed items (filter by tab)
- `POST /:problemSetId/feed` — create a feed item
- `PATCH /:problemSetId/feed/:itemId/read` — mark feed item read
- `POST /:problemSetId/feed/read-all` — mark all feed items read
- `GET /:problemSetId/annotations` — list AI annotations
- `POST /:problemSetId/annotations` — create annotation
- `PATCH /:problemSetId/annotations/:annotationId` — update annotation status
- `GET /:problemSetId/chat` — get chat history
- `POST /:problemSetId/chat` — send chat message
- `GET /:problemSetId/routing` — get tab-to-agent routing config
- `PUT /:problemSetId/routing/:tabId` — update routing for a tab

## Orchestration — `/api/orchestration`

Multi-agent workflow execution, supervisors, checkpoints, and metrics.

- `POST /execute` — execute an orchestrated workflow
- `GET /executions` — list executions
- `GET /executions/:id` — get execution details
- `POST /executions/:id/cancel` — cancel execution
- `GET /executions/:id/trace` — get execution trace
- `GET /executions/:id/graph` — get execution dependency graph
- `POST /supervisors` — create a supervisor config
- `GET /supervisors` — list supervisors
- `POST /supervisors/:id/execute` — execute via supervisor
- `GET /checkpoints` — list pending checkpoints
- `GET /checkpoints/:id` — get checkpoint details
- `POST /checkpoints/:id/approve` — approve checkpoint
- `POST /checkpoints/:id/reject` — reject checkpoint
- `GET /metrics` — execution metrics and statistics

---

## COP — `/api/cop`

Common Operating Picture layers, symbols, versioning, agents, entity linkages,
and conflict detection.

### Status

- `GET /status` — COP generation status and layer counts

### Layer CRUD & Lifecycle

- `POST /layers` — create a COP layer
- `GET /layers` — query layers (filter by state, type, section)
- `GET /layers/:id` — get layer details
- `PUT /layers/:id/spec` — update layer spec
- `POST /layers/:id/transition` — transition layer state (draft/review/published/cop)
- `POST /layers/:id/feedback` — add review feedback
- `POST /layers/:id/recall` — recall layer from COP to review

### Version Browsing

- `GET /layers/:id/versions` — list version snapshots
- `GET /layers/:id/versions/:version` — get specific version
- `GET /layers/:id/versions/:version/spec` — get spec at version

### Agent Control

- `POST /agents/trigger` — manually trigger COP generation
- `POST /agents/polling/start` — start change polling
- `POST /agents/polling/stop` — stop change polling
- `GET /agents/activity` — recent agent activity feed

### Entity Linkages

- `GET /linkages/pending` — get unreviewed entity linkages
- `POST /linkages/:id/review` — approve or reject a linkage
- `GET /linkages/entity/:entityId` — get linkages for an entity

### Conflict Detection

- `GET /conflicts` — detected cross-layer conflicts

---

## Resources — `/api/resources`

Resource registry with DID-based identity, groups, personnel, consumables,
sensors, and telemetry.

### Resource Registry

- `GET /` — list resources (with capability/area filters)
- `GET /registry/search` — search registry
- `GET /registry/capabilities` — list capability categories
- `GET /registry/stats` — registry statistics
- `POST /registry/register` — register a resource with DID
- `GET /did/:did` — get resource by DID

### Resource CRUD

- `GET /:id` — get resource by ID
- `POST /` — create a resource
- `PATCH /:id` — update resource
- `PATCH /:id/status` — update readiness status
- `DELETE /:id` — delete a resource
- `POST /bulk-import` — bulk import resources

### Resource Groups

- `GET /groups` — list groups
- `POST /groups` — create a group
- `GET /groups/:groupId` — get group details
- `GET /groups/:groupId/members` — list group members
- `POST /groups/:groupId/members` — add member to group
- `DELETE /groups/:groupId/members/:resourceId` — remove member
- `DELETE /groups/:groupId` — delete group

### Personnel

- `GET /personnel` — list personnel resources
- `GET /personnel/:id` — get personnel details
- `POST /personnel` — create personnel record
- `PATCH /personnel/:id` — update personnel
- `PATCH /personnel/:id/unit` — reassign unit
- `DELETE /personnel/:id` — delete personnel
- `POST /personnel/bulk-import` — bulk import personnel

### Consumables

- `GET /consumables` — list consumables
- `GET /consumables/:id` — get consumable details
- `POST /consumables` — create consumable
- `PATCH /consumables/:id` — update consumable
- `PATCH /consumables/:id/level` — update stock level
- `DELETE /consumables/:id` — delete consumable
- `GET /consumables/low-stock` — list low-stock items

### Telemetry

- `POST /telemetry` — ingest resource telemetry data

## Sensors — `/api/sensors`

Sensor registration, coverage tracking, and status management.

- `POST /` — register a sensor
- `GET /` — list sensors
- `GET /:id` — get sensor details
- `PATCH /:id` — update sensor config
- `PATCH /:id/status` — update sensor status
- `PATCH /:id/location` — update sensor location
- `DELETE /:id` — deregister a sensor
- `GET /coverage/:missionId` — get sensor coverage for mission
- `POST /:id/coverage` — report coverage data

---

## Command — `/api/command`

Command relationships, unit hierarchy, and responsibility matrices.

### Units

- `POST /units` — create a unit
- `GET /units` — list units
- `GET /units/:id` — get unit details
- `PATCH /units/:id` — update unit
- `DELETE /units/:id` — delete unit

### Relationships

- `POST /relationships` — create command relationship
- `GET /relationships` — list relationships
- `DELETE /relationships/:id` — delete relationship
- `PATCH /relationships/:id` — update relationship

### Hierarchy & Matrix

- `GET /hierarchy/:missionId` — get command hierarchy for mission
- `POST /validate-hierarchy/:missionId` — validate hierarchy integrity
- `GET /matrix/:missionId` — get responsibility/authority matrix

---

## MDMP — `/api/mdmp`

Military Decision-Making Process workflow, gates, assumptions, activities,
and safety matrix.

### Workflow

- `POST /workflows` — create a new MDMP workflow
- `GET /workflows/:missionId` — get workflow state
- `POST /workflows/:missionId/gates` — register phase gates
- `PUT /workflows/:missionId/gates/:gateId` — satisfy a gate
- `POST /workflows/:missionId/transitions` — request phase transition

### Assumptions

- `GET /workflows/:missionId/assumptions` — list assumptions
- `POST /workflows/:missionId/assumptions` — register assumption
- `PUT /workflows/:missionId/assumptions/:id/accept` — accept assumption

### Activity Registry

- `GET /activities` — list activities (filter by phase, category)
- `GET /activities/:id` — get activity by ID
- `GET /phases/:phase/statistics` — get phase statistics

### Safety Matrix

- `POST /safety/validate` — validate authority against safety matrix
- `GET /safety/matrix` — get full safety matrix

---

## Missions — `/api/missions`

Mission lifecycle, participants, and invitations (legacy path, largely
superseded by problem sets).

- `POST /` — create mission
- `GET /` — list missions
- `GET /:id` — get mission details
- `PATCH /:id` — update mission
- `POST /:id/activate` — activate mission
- `POST /:id/complete` — complete mission
- `POST /:id/archive` — archive mission
- `GET /:id/participants` — list participants
- `DELETE /:id/participants/:participantId` — remove participant
- `POST /:id/invites` — create invite
- `GET /:id/invites` — list invites
- `DELETE /:id/invites/:inviteId` — revoke invite
- `POST /accept-invite` — accept a mission invite

---

## Messaging — `/api/messages`

MessageBus pub/sub messaging, channels, and delivery tracking.

- `POST /` — publish a message
- `GET /` — query messages (filter by source, destination, type)
- `GET /:messageId` — get message by ID
- `POST /:messageId/acknowledge` — acknowledge receipt
- `GET /thread/:correlationId` — get message thread
- `GET /channels` — list channels (filter by problem set)
- `POST /channels/:channel/subscribe` — subscribe to channel
- `DELETE /channels/:channel/subscribe` — unsubscribe
- `GET /stats` — messaging statistics

## Credentials — `/api/credentials`

Verifiable credential issuance and verification.

- `POST /issue/security-clearance` — issue security clearance VC
- `POST /issue/entity-attribute` — issue entity attribute VC
- `POST /issue/role-assignment` — issue role assignment VC
- `POST /issue/coalition-membership` — issue coalition membership VC
- `POST /issue/derivative-data` — issue derivative data VC
- `POST /issue/user-profile` — issue user profile VC
- `POST /verify-hash` — verify credential hash
- `POST /hash` — hash a credential
- `GET /types` — list credential types

## Encryption — `/api/encryption`

Data encryption and decryption.

- `POST /encrypt` — encrypt data
- `POST /decrypt` — decrypt data

---

## Ironclaw — `/api/ironclaw`

AI assistant chat, action confirmation, trust preferences, and emergency mode.

### Health

- `GET /health` — check Ironclaw sidecar health

### Global Chat (no problem set context)

- `POST /global/message` — send message (response via WebSocket)
- `GET /global/history` — get global chat history

### Problem Set Chat

- `POST /:problemSetId/message` — send message (response via WebSocket)
- `GET /:problemSetId/history` — get chat history

### Action Confirmation & Trust

- `POST /:problemSetId/confirm` — confirm/deny an action (yes/no/always)
- `GET /trust-preferences` — get user trust preferences
- `DELETE /trust-preferences/:preferenceId` — revoke a trust preference

### Emergency

- `POST /:problemSetId/emergency` — emergency action (requires system_admin)

---

## Discovery — `/api/discovery`

Device discovery, scanner control, access lists, legal consent, EM spectrum
awareness, and network topology.

### Scanner Control

- `GET /status` — scanner status
- `POST /start` — start scanning
- `POST /stop` — stop scanning
- `POST /pause` — pause scanning
- `POST /resume` — resume scanning

### Access Lists

- `GET /access-list` — list access entries (allow/block)
- `POST /access-list` — add access entry
- `DELETE /access-list/:id` — remove access entry

### Legal Consent

- `GET /legal-consent/:origin` — get required consent text
- `POST /legal-consent` — record consent acceptance

### Devices

- `GET /devices` — list discovered devices (filter by state, transport)
- `GET /devices/:id` — get device details
- `POST /devices/:id/emergency-disconnect` — emergency disconnect

### Scan Targets

- `GET /scan-targets` — list remote scan targets
- `POST /scan-targets` — add scan target
- `PUT /scan-targets/:id` — update scan target
- `DELETE /scan-targets/:id` — remove scan target

### Client Discovery

- `POST /client-discovery` — ingest browser-reported device

### Scanner Config

- `PUT /scanner/:transport/config` — update scanner config per transport

### EM Spectrum

- `GET /em/snapshot` — current EM picture with per-band summaries
- `GET /em/own-footprint` — Bastion's own electromagnetic emissions (OPSEC)

### Network Topology

- `GET /topology` — full network topology graph
- `GET /topology/stats` — topology statistics
- `GET /topology/path/:from/:to` — shortest path between nodes

### Ironclaw Callback

- `POST /ironclaw-result` — receive Ironclaw analysis result for device

---

## Validation — `/api/validation`

Agent validation runs, scoring, circuit breaker, thresholds, and data export.

### Runs

- `POST /runs` — trigger manual validation run
- `GET /runs` — list recent runs
- `GET /runs/:runId` — get run details with results

### Dashboard & Scores

- `GET /dashboard` — dashboard summary (all agents)
- `GET /agents/:agentId/scores` — agent score history
- `GET /agents/:agentId/circuit-events` — circuit breaker event history

### Thresholds

- `GET /thresholds` — get threshold configs
- `PUT /thresholds` — upsert threshold

### Reinstatement

- `POST /agents/:agentId/reinstate` — reinstate a disabled agent

### Export

- `GET /export/csv` — export validation data as CSV
- `GET /export/pdf` — export validation report as PDF

---

## Edge Sync — `/api/edge-sync`

Offline-capable data synchronization for edge deployments.

- `POST /sync` — push sync payload from edge node
- `GET /sync/delta` — get delta since last sync

---

## Admin — `/api/admin`

System configuration, agent management, tools, teams, model config,
OSINT sources, funding, and agent builder.

### LLM & Workflow Config

- `GET /config/llm` — get LLM configuration
- `PUT /config/llm` — update LLM configuration
- `GET /config/agents` — get agent configuration
- `PUT /config/agents` — update agent configuration
- `GET /config/workflow` — get workflow configuration
- `PUT /config/workflow` — update workflow configuration
- `GET /config/audit` — get configuration audit trail

### OSINT Sources

- `GET /osint-sources` — list OSINT sources
- `POST /osint-sources` — create OSINT source
- `GET /osint-sources/:id` — get source details
- `PUT /osint-sources/:id` — update source
- `DELETE /osint-sources/:id` — delete source

### Email Domain Management

- `GET /config/email-domains` — list allowed email domains
- `PUT /config/email-domains` — update allowed domains
- `DELETE /config/email-domains` — remove domain
- `GET /config/blocked-emails` — list blocked emails
- `PUT /config/blocked-emails` — update blocked list
- `DELETE /config/blocked-emails` — remove from blocked list

### Agent Management

- `GET /agents` — list all agents
- `POST /agents` — create agent
- `GET /agents/:agentId` — get agent details
- `PUT /agents/:agentId` — update agent
- `DELETE /agents/:agentId` — delete agent
- `GET /agents/:agentId/did` — get agent DID
- `GET /agents/:agentId/character` — get agent character config
- `PUT /agents/:agentId/character` — update character
- `DELETE /agents/:agentId/character` — delete character
- `GET /agents/:agentId/model-config` — get model config
- `PUT /agents/:agentId/model-config` — update model config
- `DELETE /agents/:agentId/model-config` — delete model config
- `GET /agents/:agentId/tools` — list tools assigned to agent
- `GET /agents/:agentId/teams` — list teams agent belongs to

### Tool Management

- `GET /tools` — list all tools
- `POST /tools` — create tool
- `GET /tools/:toolId` — get tool details
- `PUT /tools/:toolId` — update tool
- `DELETE /tools/:toolId` — delete tool
- `POST /tools/:toolId/assign/:agentId` — assign tool to agent
- `DELETE /tools/:toolId/assign/:agentId` — unassign tool

### Team Management

- `GET /teams` — list teams
- `POST /teams` — create team
- `GET /teams/:teamId` — get team details
- `PUT /teams/:teamId` — update team
- `DELETE /teams/:teamId` — delete team
- `POST /teams/:teamId/members` — add member
- `DELETE /teams/:teamId/members/:agentId` — remove member

### Agent Builder

- `GET /agent-builder/templates` — list agent templates
- `GET /agent-builder/capabilities` — list available capabilities
- `GET /agent-builder/phases` — list available phases
- `GET /agent-builder/autonomy-levels` — list autonomy levels
- `POST /agent-builder/validate` — validate agent config
- `POST /agent-builder/preview-prompt` — preview system prompt

### LLM Models & Funding

- `GET /llm-models` — list available LLM models
- `GET /funding/status` — agent funding status
- `GET /funding/history` — funding history
- `GET /funding/check/:accountId` — check account funding

### Cache

- `POST /cache/invalidate` — invalidate cache entries

---

*Endpoint counts are approximate. Consult the backend source in `backend/src/`
for complete request/response schemas and validation rules.*
