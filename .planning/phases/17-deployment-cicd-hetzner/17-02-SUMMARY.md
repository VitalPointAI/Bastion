---
phase: 17-deployment-cicd-hetzner
plan: 02
subsystem: ci-cd-pipeline
tags: [github-actions, ci, cd, docker, ghcr, pnpm, hetzner]
dependency_graph:
  requires: []
  provides:
    - .github/workflows/ci.yml
    - .github/workflows/deploy.yml
  affects:
    - docker-compose.prod.yml (deploy job references it via SSH)
    - backend/Dockerfile (deploy builds targeting runtime stage)
    - frontend/Dockerfile (deploy builds targeting production stage)
tech_stack:
  added:
    - GitHub Actions (CI/CD orchestration)
    - docker/login-action@v3 (GHCR authentication)
    - docker/metadata-action@v5 (SHA + latest image tagging)
    - docker/build-push-action@v6 (multi-stage image build and push)
    - appleboy/ssh-action@v1 (SSH remote deployment)
    - pnpm/action-setup@v4 (pnpm installation in CI)
    - actions/setup-node@v4 (Node.js with pnpm cache)
  patterns:
    - Two-workflow CI/CD split (ci.yml for validation, deploy.yml for promotion)
    - Parallel CI jobs (backend and frontend run concurrently)
    - VITE_* vars passed as Docker build-args (baked at build time, not runtime)
    - SHA + latest dual tagging via metadata-action
    - deploy job health check via docker compose exec -T (port not host-exposed)
key_files:
  created:
    - .github/workflows/ci.yml
    - .github/workflows/deploy.yml
  modified: []
decisions:
  - IMAGE_PREFIX hardcoded as ghcr.io/vitalpointai/bastion (lowercase per GHCR requirement)
  - Health check uses docker compose exec -T with node fetch (not curl) since backend port 3001 not exposed to host in prod
  - GHCR_TOKEN/GHCR_USER login step included for private repo compatibility (no-op if repo public)
  - git pull origin master in deploy script ensures docker-compose.prod.yml and SQL files are up to date
metrics:
  duration: 7 minutes
  completed: "2026-03-03"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 17 Plan 02: GitHub Actions CI/CD Workflows Summary

**One-liner:** Two-workflow CI/CD pipeline using pnpm caching, GHCR image push with SHA+latest tags, and SSH deploy via appleboy/ssh-action with docker compose exec health check.

## What Was Built

Two GitHub Actions workflow files that form the complete CI/CD pipeline for the Bastion application:

**`.github/workflows/ci.yml`** — Runs on every PR and push to master. Parallel jobs:
- `ci-backend`: installs pnpm 10, runs `pnpm install --frozen-lockfile`, `pnpm build` (TypeScript compile via tsup), `pnpm test` (vitest run)
- `ci-frontend`: installs pnpm 10, runs `pnpm install --frozen-lockfile`, `pnpm lint` (eslint), `pnpm build` (Vite bundle)
- Both use workspace-scoped `cache-dependency-path` for independent pnpm lockfile caching

**`.github/workflows/deploy.yml`** — Runs on push to master only. Sequential jobs:
- `build-and-push`: logs in to GHCR via `GITHUB_TOKEN`, builds backend (targeting `runtime` stage) and frontend (targeting `production` stage) images, tags each with both git SHA and `latest`, pushes to `ghcr.io/vitalpointai/bastion/`
- Frontend build receives all `VITE_*` variables as Docker `build-args` so they are baked into the static Vite bundle at build time
- `deploy` (depends on `build-and-push`): SSHs to Hetzner server via `appleboy/ssh-action@v1`, runs `git pull origin master`, pulls new images, restarts with `docker compose up -d --remove-orphans`, prunes old images, waits 15s then verifies backend health via `docker compose exec -T backend node -e "fetch(...)"` (uses exec because port 3001 is not host-mapped in production)

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create CI workflow for pull requests | e4c42ac | .github/workflows/ci.yml |
| 2 | Create deploy workflow for master branch | d6df237 | .github/workflows/deploy.yml |

## Deviations from Plan

None — plan executed exactly as written. The `down -v` comment in the deploy script is correct (it explicitly warns never to use it, while the actual script only uses `up -d`).

## Key Decisions Made

1. **IMAGE_PREFIX set to `ghcr.io/vitalpointai/bastion`** — GHCR requires lowercase paths; hardcoded rather than derived from `github.repository` to ensure consistent lowercase.

2. **Health check via `docker compose exec -T`** — Production compose does not expose backend port 3001 to the host (intentionally, for security). Using `docker compose exec -T backend node -e "fetch(...)"` runs the check inside the container, reaching `localhost:3001` within the container network. This avoids the broken `curl http://localhost:3001/health` pattern that would fail on the host.

3. **GHCR login with GHCR_TOKEN secret in deploy script** — Included for private repository compatibility. If the repository is public, this step is harmless (will use the token if set, otherwise the login command would error — documented in Plan 03 secrets checklist).

4. **`git pull origin master` in deploy step** — Ensures the server has the latest `docker-compose.prod.yml` and SQL migration files before pulling new Docker images. This is safe because the critical application code is in the images, not the working directory.

## Secrets and Variables Required

The following must be configured in GitHub repository settings before the deploy workflow will succeed (documented for Plan 03 checkpoint):

**Secrets (encrypted):**
- `HETZNER_HOST` — Hetzner server IP or domain
- `HETZNER_USER` — `deploy` (the non-root user from server-setup.sh)
- `HETZNER_SSH_KEY` — ED25519 private key, no passphrase
- `VITE_PRIVY_APP_ID` — Privy dashboard app ID
- `VITE_PINATA_GATEWAY` — Pinata IPFS gateway URL
- `GHCR_TOKEN` — PAT with `read:packages` scope (only required if repo is private)
- `GHCR_USER` — GitHub username (only required if repo is private)

**Variables (non-secret):**
- `VITE_NEAR_NETWORK` — `testnet` or `mainnet`
- `VITE_NEAR_RPC` — e.g. `https://rpc.testnet.near.org`
- `VITE_BACKEND_URL` — production URL (e.g. `https://bastion.example.com`)

## Self-Check: PASSED

Files exist:
- FOUND: .github/workflows/ci.yml
- FOUND: .github/workflows/deploy.yml

Commits exist:
- FOUND: e4c42ac (Task 1 — ci.yml)
- FOUND: d6df237 (Task 2 — deploy.yml)
