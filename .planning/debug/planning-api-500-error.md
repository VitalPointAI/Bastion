---
status: diagnosed
trigger: "Planning API 500 Error - GET /api/planning/missions/{missionId}/plans returns 500"
created: 2026-02-01T00:50:00.000Z
updated: 2026-02-01T00:57:00.000Z
---

## Current Focus

hypothesis: Vite proxy configuration uses localhost:3001 which doesn't work in Docker containers
test: Test connectivity from frontend container to both localhost:3001 and backend:3001
expecting: localhost:3001 fails, backend:3001 succeeds
next_action: Report findings - root cause confirmed

## Symptoms

expected: GET /api/planning/missions/{missionId}/plans returns list of plans
actual: Returns 500 Internal Server Error
errors: "planning-service.ts:7  GET http://localhost:5173/api/planning/missions/MSN-f5789b96-af8d-447a-accb-2acf3e41687b/plans 500 (Internal Server Error)"
reproduction: Any call to /api/planning/* from frontend
started: Unknown

## Eliminated

(none - first hypothesis was correct)

## Evidence

- timestamp: 2026-02-01T00:52:00Z
  checked: Backend API endpoint directly from within backend container
  found: curl http://localhost:3001/api/planning/missions/MSN-f5789b96-af8d-447a-accb-2acf3e41687b/plans returns valid JSON array with 3 plans
  implication: Backend code and database are working correctly

- timestamp: 2026-02-01T00:54:00Z
  checked: Frontend container connectivity to localhost:3001
  found: fetch('http://localhost:3001/health') fails with "fetch failed"
  implication: Frontend container cannot reach localhost:3001 (localhost is container itself in Docker)

- timestamp: 2026-02-01T00:56:00Z
  checked: Frontend container connectivity to backend:3001 (Docker network name)
  found: fetch('http://backend:3001/health') returns {"status":"healthy"}
  implication: Docker networking works correctly using service names

- timestamp: 2026-02-01T00:57:00Z
  checked: Vite proxy configuration in frontend/vite.config.ts line 14-18
  found: proxy target is 'http://localhost:3001'
  implication: This is the root cause - proxy target should be 'http://backend:3001' when running in Docker

## Resolution

root_cause: Vite proxy configuration in frontend/vite.config.ts uses 'http://localhost:3001' as the target, but when running in Docker containers, 'localhost' refers to the frontend container itself, not the backend container. The proxy should use 'http://backend:3001' (the Docker Compose service name) for container-to-container communication.

fix: Not applied (diagnosis-only mode)

verification: Not performed

files_changed: []
