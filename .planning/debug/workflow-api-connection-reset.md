---
status: diagnosed
trigger: "Workflow API ERR_CONNECTION_RESET - POST /api/planning/plans/{id}/workflow/events fails"
created: 2026-01-31T00:00:00Z
updated: 2026-01-31T23:58:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - Wrong backend running on port 3001
test: docker ps shows comps-server-1 on port 3001, not bastion-backend
expecting: N/A - Root cause found
next_action: Return diagnosis

## Symptoms

expected: Clicking workflow step shows details, Start Step changes status to in_progress, Mark Ready changes status to ready
actual: POST /api/planning/plans/{id}/workflow/events fails with ERR_CONNECTION_RESET
errors: ERR_CONNECTION_RESET
reproduction: Click any workflow step in the planning UI
started: Unknown - reported as blocker

## Eliminated

- hypothesis: Backend planning routes not registered
  evidence: backend/src/index.ts line 97 correctly mounts planningRouter at /api/planning
  timestamp: 2026-01-31T23:56:00Z

- hypothesis: Workflow engine not initialized
  evidence: jp50WorkflowEngine properly exported and lazy-initializes on first use
  timestamp: 2026-01-31T23:56:30Z

- hypothesis: Code bug in planning API
  evidence: Code review shows proper Express route handlers, Zod validation, and error handling
  timestamp: 2026-01-31T23:57:00Z

## Evidence

- timestamp: 2026-01-31T23:56:00Z
  checked: backend/src/index.ts
  found: planningRouter is imported (line 25) and mounted at /api/planning (line 97)
  implication: Routes are correctly registered in code

- timestamp: 2026-01-31T23:56:30Z
  checked: backend/src/api/planning.ts
  found: POST /plans/:id/workflow/events endpoint exists (lines 138-152), properly imports jp50WorkflowEngine
  implication: Endpoint code is correct

- timestamp: 2026-01-31T23:56:45Z
  checked: curl http://localhost:3001/health
  found: Returns {"status":"healthy"} - server responding
  implication: Something is running on port 3001

- timestamp: 2026-01-31T23:57:20Z
  checked: docker logs comps-server-1
  found: "Prisma schema loaded", "SQLite database comps.db", "[WhisperService]"
  implication: WRONG APPLICATION - this is a different backend using Prisma/SQLite, not BASTION

- timestamp: 2026-01-31T23:57:45Z
  checked: docker ps
  found: comps-server-1 on port 3001, bastion-backend NOT RUNNING
  implication: The BASTION backend container is not started

- timestamp: 2026-01-31T23:58:00Z
  checked: docker-compose.yml
  found: Defines bastion-backend service but it's not running - only comps-* containers and bastion infrastructure
  implication: User has started wrong docker-compose project

## Resolution

root_cause: The BASTION backend (bastion-backend) is NOT running. A different application (comps-server) is occupying port 3001. This different application does not have /api/planning routes, so all planning API requests fail with connection reset or 404.
fix: Stop comps-server containers, start BASTION containers with docker-compose up
verification: N/A - diagnosis only
files_changed: []
