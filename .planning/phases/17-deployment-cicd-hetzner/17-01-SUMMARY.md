---
phase: 17-deployment-cicd-hetzner
plan: 01
subsystem: infra
tags: [docker, docker-compose, nginx, certbot, letsencrypt, hetzner, ghcr, tee, phala]

# Dependency graph
requires: []
provides:
  - Production Docker Compose with GHCR image refs and locked-down database ports
  - Host-level nginx config with TLS termination and SSE support
  - One-time Hetzner server bootstrap script (Docker, certbot, UFW, deploy user)
  - TEE-aware component separation documentation with Phala Cloud migration path
affects: [17-02, 17-03, 17-04]

# Tech tracking
tech-stack:
  added: [docker-compose.prod.yml, certbot, ufw, ghcr.io/vitalpointai/bastion]
  patterns:
    - Standalone prod compose (not merge override) runnable with docker compose -f docker-compose.prod.yml up -d
    - Host nginx for TLS termination proxies to frontend container on 8080; frontend nginx proxies /api/ internally
    - Database ports never exposed to host in production (bastion-network only)
    - Secrets in .env.prod file on server (not committed to git)

key-files:
  created:
    - docker-compose.prod.yml
    - nginx/nginx.prod.conf
    - scripts/server-setup.sh
    - docs/deployment/tee-architecture.md
  modified: []

key-decisions:
  - "Standalone prod compose (not docker-compose override merge) — simpler to reason about and deploy with single -f flag"
  - "Frontend maps 8080:80, host nginx proxies 443->8080; frontend container nginx handles /api/ proxy internally"
  - "GHCR image paths use vitalpointai/bastion/* (overriding research notes that said ALuhning/Bastion)"
  - "Neo4j heap reduced from dev 1g to prod 512m to share 8GB CAX21 RAM with all services"
  - "Phase 17 co-locates all services on one server — TEE separation documented as future production concern"

patterns-established:
  - "Pattern: Database ports omitted (not 'ports: []') in prod compose to prevent host exposure"
  - "Pattern: env_file + environment block together in backend — env_file for most secrets, environment for Docker network overrides"
  - "Pattern: server-setup.sh takes domain + SSH pubkey as args, fully automated bootstrap including certbot"

requirements-completed: []

# Metrics
duration: 108min
completed: 2026-03-03
---

# Phase 17 Plan 01: Production Infrastructure Configuration Summary

**Production Docker Compose with GHCR images, host nginx TLS termination, automated Hetzner bootstrap script, and TEE architecture documentation for Phala Cloud migration path**

## Performance

- **Duration:** 108 min
- **Started:** 2026-03-03T01:00:15Z
- **Completed:** 2026-03-03T02:48:33Z
- **Tasks:** 4
- **Files modified:** 4 created

## Accomplishments

- Created `docker-compose.prod.yml` as a standalone production compose file using GHCR images (`ghcr.io/vitalpointai/bastion/backend:latest` and `frontend:latest`), with all database ports removed from host mapping and all services configured with `restart: always`
- Created `nginx/nginx.prod.conf` as host-level nginx configuration handling TLS termination with Let's Encrypt via certbot, HTTP-to-HTTPS redirect with ACME challenge support, and SSE-compatible proxy settings (proxy_buffering off, 86400s timeout)
- Created `scripts/server-setup.sh` as a fully automated one-time bootstrap script that installs Docker CE + Compose plugin, nginx, certbot, configures UFW firewall, creates the deploy user, clones the repo, installs nginx config with domain substitution, obtains TLS certificate, and hardens SSH
- Created `docs/deployment/tee-architecture.md` documenting the current Phase 17 co-located topology and the future Phala Cloud TEE-aware separation path with ASCII diagrams, traffic flow explanation, and a migration path table

## Task Commits

Each task was committed atomically:

1. **Task 1: Create production Docker Compose override** - `d5c3162` (chore)
2. **Task 2: Create host-level nginx config** - `2811550` (chore)
3. **Task 3: Create server bootstrap script** - `4c09fde` (chore)
4. **Task 4: Create TEE-aware component separation documentation** - `668efc5` (docs)

**Plan metadata:** (this summary commit)

## Files Created/Modified

- `docker-compose.prod.yml` - Standalone production compose: GHCR images, no DB host ports, restart: always, .env.prod secrets, frontend on 8080:80
- `nginx/nginx.prod.conf` - Host-level nginx: HTTP→HTTPS redirect, TLS termination, proxy to 127.0.0.1:8080, SSE support, ACME challenge
- `scripts/server-setup.sh` - Bootstrap script: Docker install, certbot, UFW, deploy user, repo clone, nginx config install, TLS cert, SSH hardening
- `docs/deployment/tee-architecture.md` - TEE architecture: current dev topology, future Phala Cloud separation, migration path table

## Decisions Made

- **Standalone compose vs merge override:** Used standalone `docker-compose.prod.yml` (not `docker-compose.yml -f docker-compose.prod.yml`) — simpler to reason about, single `-f` flag deploys everything
- **GHCR image paths:** Used `ghcr.io/vitalpointai/bastion/*` (not `ALuhning/Bastion` from research notes) — plan explicitly specified VitalPointAI as the GitHub org
- **Frontend port 8080:** Frontend container maps 8080:80 (not 80:80) because host nginx occupies port 80 directly. Host nginx 443→8080, frontend container 8080→80 internal
- **Neo4j memory tuning:** Reduced heap from dev 1g to prod 512m to share 8GB CAX21 RAM with postgres, node.js, and OS — documented in compose comments
- **TEE separation timeline:** Co-located Phase 17 deployment is intentional for dev — TEE migration triggered by confidentiality requirements, not Phase 17 deliverable

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

External server setup requires manual steps after running `scripts/server-setup.sh`:
1. Edit `/home/deploy/bastion/.env.prod` with real `POSTGRES_PASSWORD` and `NEO4J_PASSWORD`
2. Configure GitHub Secrets: `HETZNER_HOST`, `HETZNER_USER`, `HETZNER_SSH_KEY` for CI/CD workflow (Plan 02)

## Next Phase Readiness

- All four infrastructure files are self-consistent: prod compose references GHCR images, host nginx proxies to port 8080 matching prod compose frontend mapping, bootstrap script installs all dependencies
- Ready for Plan 02 (GitHub Actions CI/CD workflow) to build and push images to the GHCR paths defined here
- `docs/deployment/tee-architecture.md` provides TEE migration path reference for future production hardening

## Self-Check: PASSED

All files verified present on disk. All task commits verified in git history.

| Check | Status |
|-------|--------|
| docker-compose.prod.yml | FOUND |
| nginx/nginx.prod.conf | FOUND |
| scripts/server-setup.sh | FOUND |
| docs/deployment/tee-architecture.md | FOUND |
| Commit d5c3162 (Task 1) | FOUND |
| Commit 2811550 (Task 2) | FOUND |
| Commit 4c09fde (Task 3) | FOUND |
| Commit 668efc5 (Task 4) | FOUND |

---
*Phase: 17-deployment-cicd-hetzner*
*Completed: 2026-03-03*
