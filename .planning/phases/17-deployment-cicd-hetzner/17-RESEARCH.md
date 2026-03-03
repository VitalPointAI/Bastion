# Phase 17: Deployment - CI/CD Pipeline & Hetzner Server - Research

**Researched:** 2026-03-02
**Domain:** CI/CD (GitHub Actions), Container Deployment (Docker Compose), VPS Provisioning (Hetzner Cloud)
**Confidence:** HIGH

## Summary

Phase 17 deploys the Bastion application from the GitHub repository at `https://github.com/ALuhning/Bastion.git` (origin remote confirmed) to a Hetzner Cloud VPS using a GitHub Actions CI/CD pipeline. The project already has multi-stage Dockerfiles for both frontend (nginx:alpine for production static serving) and backend (node:20-slim with TypeScript build), plus a `docker-compose.yml` for development. The CI/CD pipeline needs to: build images, push to GHCR, provision (or reconfigure) a Hetzner server, deploy Docker Compose with production settings, and configure nginx + TLS. The phase also requires documenting TEE-aware component separation for the future production path where the Node.js backend moves into Phala TEE — while co-locating everything on a single server for the development deployment.

The project stack requires meaningful server resources: PostgreSQL (TimescaleDB), Neo4j, Node.js backend, and nginx serving the React frontend. Based on research, a **CAX21 (8GB RAM, €6.49/month)** is the minimum viable choice; **CAX31 (16GB RAM, €12.49/month)** is the recommended starting point to give Neo4j adequate memory headroom. The existing Docker Compose already has health checks, restart policies, and the right structure — it needs a production override file, secrets handling, and a GitHub Actions workflow.

The TEE documentation component is architectural: the backend Dockerfile already targets `runtime` (non-TEE) for current deployment. The TEE path would replace the backend container with a Phala Cloud CVM deployment where all services in one Docker Compose file run inside the same Confidential Virtual Machine.

**Primary recommendation:** Use GHCR for image storage (free, GITHUB_TOKEN auth, already on GitHub), `docker/build-push-action` with metadata-action for tagging, `appleboy/ssh-action@v1` for remote deployment over SSH, a `docker-compose.prod.yml` override for production settings, and certbot/nginx for TLS. Start with CAX21 (8GB) minimum, prefer CAX31 (16GB).

## Standard Stack

### Core

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| GitHub Actions | N/A | CI/CD orchestration | Already on GitHub, free tier minutes, native integration |
| `docker/build-push-action` | v6 (latest) | Build & push Docker images | Official Docker action, supports multi-arch, attestation |
| `docker/metadata-action` | v5 (latest) | Generate image tags/labels | Automatic semver/SHA tagging from git context |
| `docker/login-action` | v3 (latest) | Authenticate to GHCR | Handles GHCR auth with GITHUB_TOKEN |
| `appleboy/ssh-action` | v1 | Execute remote deploy commands | De-facto standard for SSH deployment in GHA |
| `pnpm/action-setup` | v4 | Install pnpm in CI | Official pnpm GitHub Action |
| `actions/setup-node` | v4 | Node.js setup with pnpm cache | Handles caching via `cache: "pnpm"` |
| `actions/checkout` | v4 | Checkout repository | Standard checkout |
| GitHub Container Registry (GHCR) | N/A | Docker image storage | Free, uses GITHUB_TOKEN, scoped to repo |
| nginx:alpine | stable | Reverse proxy + frontend static serving | Already in frontend Dockerfile, TLS termination |
| Certbot (certbot-nginx) | current | Let's Encrypt TLS certificates | Standard automated TLS, free, auto-renewal |
| docker-compose.prod.yml | N/A | Production override file | Separates dev/prod configuration cleanly |
| Hetzner CAX21/CAX31 | N/A | VPS host | ARM-based, best EUR/performance, 8-16GB RAM |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| Hetzner Cloud Console / hcloud CLI | latest | Server provisioning | Initial server creation; manual for dev deploy |
| cloud-init (user_data) | N/A | Bootstrap server on creation | Automates Docker, user, SSH key, UFW setup |
| UFW (Uncomplicated Firewall) | system | Server firewall | Block all except 22, 80, 443 |
| `actions/attest-build-provenance` | v3 | Supply chain security attestation | Add to production workflow for supply chain security |
| GitHub Environments (production) | N/A | Deployment protection gates | Optional reviewer approval before production deploy |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GHCR | Docker Hub | Docker Hub has rate limits on free tier; GHCR uses GITHUB_TOKEN automatically |
| certbot on host | Traefik with Let's Encrypt | Traefik is more automated but adds orchestration complexity; certbot simpler for single-server |
| docker-compose.prod.yml override | Separate docker-compose.production.yml | Override pattern lets base file stay canonical; both approaches are valid |
| Hetzner CAX (ARM) | Hetzner CX (x86) | CAX has ~2x value score; ARM Docker images supported by all official images (node:20-slim, nginx:alpine, postgres, neo4j) |
| Single-server Docker Compose | Kubernetes | K8s is overkill for development deployment; Docker Compose sufficient |

## Architecture Patterns

### Recommended Project Structure

```
.github/
├── workflows/
│   ├── ci.yml                    # Build & test on PR (lint, typecheck, unit tests)
│   └── deploy.yml                # Build, push GHCR, deploy to Hetzner on main push
docker-compose.yml                # Development (existing - keep as-is)
docker-compose.prod.yml           # Production override (NEW)
scripts/
├── server-setup.sh               # One-time server bootstrap script
├── deploy.sh                     # Deploy script executed over SSH
└── seed-scenario.sh              # Existing
nginx/
└── nginx.prod.conf               # Production nginx config (host-level, not container)
```

### Pattern 1: Two-Workflow CI/CD Split

**What:** Separate `ci.yml` (build/test on every PR) from `deploy.yml` (build+push+deploy on merge to main). Deploy job depends on CI passing.

**When to use:** Always — prevents deploying untested code, keeps CI fast by running tests without deployment overhead.

```yaml
# .github/workflows/deploy.yml
name: Build & Deploy

on:
  push:
    branches: [master]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      attestations: write
      id-token: write
    outputs:
      image-tag: ${{ steps.meta.outputs.tags }}
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata for backend
        id: meta-backend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/backend

      - name: Build and push backend
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          target: runtime
          push: true
          tags: ${{ steps.meta-backend.outputs.tags }}
          labels: ${{ steps.meta-backend.outputs.labels }}

      - name: Extract metadata for frontend
        id: meta-frontend
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/frontend

      - name: Build and push frontend
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          target: production
          push: true
          tags: ${{ steps.meta-frontend.outputs.tags }}
          labels: ${{ steps.meta-frontend.outputs.labels }}
          build-args: |
            VITE_PRIVY_APP_ID=${{ secrets.VITE_PRIVY_APP_ID }}
            VITE_NEAR_NETWORK=${{ vars.VITE_NEAR_NETWORK }}
            VITE_NEAR_RPC=${{ vars.VITE_NEAR_RPC }}
            VITE_PINATA_GATEWAY=${{ secrets.VITE_PINATA_GATEWAY }}
            VITE_BACKEND_URL=${{ vars.VITE_BACKEND_URL }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    environment: production   # optional: add reviewer protection
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ${{ secrets.HETZNER_USER }}
          key: ${{ secrets.HETZNER_SSH_KEY }}
          script: |
            cd /home/deploy/bastion
            git pull origin master
            docker compose -f docker-compose.prod.yml pull
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            docker image prune -f
```

### Pattern 2: Production Docker Compose Override

**What:** Base `docker-compose.yml` stays development-focused. `docker-compose.prod.yml` overrides: removes volume mounts, uses GHCR images, adds `restart: always`, applies resource limits.

```yaml
# docker-compose.prod.yml
services:
  postgres:
    restart: always
    # No ports exposed to host in production (only internal network)
    ports: []
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}

  neo4j:
    restart: always
    ports: []
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
    # Override memory to fit CAX21 (8GB total)
    environment:
      NEO4J_server_memory_heap_initial__size: 256m
      NEO4J_server_memory_heap_max__size: 512m
      NEO4J_server_memory_pagecache_size: 256m

  backend:
    image: ghcr.io/aluhing/bastion/backend:latest
    build: null    # Don't build locally in production
    restart: always
    env_file:
      - .env.prod
    ports: []      # Only internal network; nginx proxies externally

  frontend:
    image: ghcr.io/aluhing/bastion/frontend:latest
    build: null
    target: production    # Use nginx:alpine static stage
    restart: always
    ports:
      - "80:80"
    volumes: []   # No source code mounts in production
```

### Pattern 3: Server-Level Nginx (Host nginx for TLS termination)

**What:** nginx installed on the host (not in Docker) handles TLS termination and proxies to Docker containers. Frontend container serves on internal port 80; backend on 3001. Host nginx handles 443 → Docker containers.

**Alternative:** nginx-proxy Docker container or Traefik — but host nginx is simpler for a single-server dev deployment.

```nginx
# /etc/nginx/sites-available/bastion
server {
    listen 80;
    server_name bastion.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name bastion.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/bastion.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/bastion.yourdomain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # Frontend (React SPA via nginx container)
    location / {
        proxy_pass http://localhost:5173;  # or port 80 if using production image
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Pattern 4: pnpm CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  ci-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
          cache-dependency-path: backend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: backend
      - run: pnpm build
        working-directory: backend
      - run: pnpm test
        working-directory: backend

  ci-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"
          cache-dependency-path: frontend/pnpm-lock.yaml
      - run: pnpm install --frozen-lockfile
        working-directory: frontend
      - run: pnpm build
        working-directory: frontend
      - run: pnpm lint
        working-directory: frontend
```

### TEE-Aware Component Separation Documentation

For the current **development deployment** (Phase 17), all components co-locate on one Hetzner server:

```
┌─────────────── Hetzner CAX21/31 (Ubuntu 24.04) ─────────────────┐
│  Host nginx (TLS termination, port 443)                           │
│       │                                                           │
│  ┌────▼─────────────────────────────────────────────────────┐    │
│  │              Docker Compose (bastion network)            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐ │    │
│  │  │ frontend │  │ backend  │  │ postgres │  │  neo4j  │ │    │
│  │  │(nginx:   │  │(node:20- │  │(timescale│  │(neo4j:  │ │    │
│  │  │ alpine)  │  │  slim)   │  │  db)     │  │2025-ce) │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘ │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

For the **future production deployment** (documented, not implemented in Phase 17), TEE-aware separation means:

```
┌────────── Traditional Cloud / VPS ─────────┐   ┌─── Phala Cloud TEE ───────────┐
│  frontend (nginx:alpine - static files)     │   │  backend (Node.js in CVM)     │
│  postgres (operational data)                │   │  All services in CVM share     │
│  neo4j (context graph)                      │   │  encrypted memory + attestation│
│  nginx (public entry, TLS)                  │   │  Secrets decrypted at runtime  │
│                                             │   │  in TEE only                  │
└─────────────────────────────────────────────┘   └───────────────────────────────┘
                          ↑                                       ↑
                 Non-sensitive components                 Sensitive AI operations
                 Fast queries, static serving             Encryption key mgmt
                 Coalition operational data               NEAR signing
                 (still encrypted at rest)                TEE attestation proofs
```

In Phala Cloud's model: all services in one Docker Compose file run inside the same CVM, enabling secure inter-service communication within the trusted environment. Secrets are encrypted client-side and only decrypted inside the TEE at runtime.

### Anti-Patterns to Avoid

- **Committing .env files**: Use GitHub Secrets for all sensitive values; `.env.prod` should never be in the repo
- **Building images on the deployment server**: Build in CI (GitHub Actions), push to GHCR, pull on server — this separates build from deploy
- **Using `latest` tag exclusively**: Tag with commit SHA for traceability; `latest` tag for convenience rollout
- **Exposing database ports to host**: PostgreSQL (5432) and Neo4j (7474/7687) should only be on internal Docker network in production
- **Missing restart policies**: All services need `restart: always` in production to survive server reboots
- **Running as root in containers**: Backend Dockerfile already has `USER nodejs` non-root setup — maintain this

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TLS certificates | Custom cert generation/renewal scripts | Certbot (`certbot --nginx`) | Auto-renewal via cron, ACME protocol, Let's Encrypt integration |
| Image tagging strategy | Custom SHA/tag scripts | `docker/metadata-action@v5` | Handles semver, SHA, branch tags automatically |
| SSH deployment logic | Custom paramiko/expect scripts | `appleboy/ssh-action@v1` | Battle-tested, handles connection retries, multi-host |
| Container registry auth | Custom registry setup | GHCR with `GITHUB_TOKEN` | Zero credential management, free, scoped to repo |
| pnpm CI caching | Manual cache-paths setup | `pnpm/action-setup@v4` + `actions/setup-node@v4` `cache: pnpm` | Native pnpm store caching, one line config |
| Database migration on deploy | Custom migration runner | Existing SQL files via `docker-entrypoint-initdb.d` + manual for schema updates | PostgreSQL Docker auto-runs `*.sql` in `initdb.d` on first start |

**Key insight:** The deployment stack for a single-server Docker Compose app is a solved problem. Every component has a battle-tested GitHub Action or tool. The value is in wiring them correctly, not building custom tooling.

## Common Pitfalls

### Pitfall 1: VITE_ Environment Variables Baked at Build Time

**What goes wrong:** Vite `VITE_*` variables are embedded into the static bundle at build time. If you try to inject them at runtime via Docker environment variables, they won't work.

**Why it happens:** Vite replaces `import.meta.env.VITE_*` at bundle compilation time, not at container runtime.

**How to avoid:** Pass all `VITE_*` vars as Docker `ARG`/`ENV` build arguments during the `docker build` step in GitHub Actions. The frontend Dockerfile already has `ARG VITE_PRIVY_APP_ID` etc. — the workflow must pass them as `build-args` to `docker/build-push-action`.

**Warning signs:** Frontend shows default values or broken auth even though environment variables appear correct in the container.

### Pitfall 2: Neo4j Memory on Small Servers

**What goes wrong:** Default Neo4j Docker configuration (512m heap + 512m pagecache) is fine for development, but the JVM heap can spike higher under load, causing OOM kills or severe performance degradation alongside TimescaleDB and Node.js.

**Why it happens:** Neo4j is JVM-based. The `docker-compose.yml` already caps Neo4j at 1GB heap max and 256m pagecache — this should stay as-is for an 8GB CAX21.

**How to avoid:** For CAX21 (8GB): keep Neo4j at 512m heap, 256m pagecache. PostgreSQL `shared_buffers` should be ~1GB (not the "25% of RAM" rule, since other services share the server). Backend Node.js naturally limits itself. Reserve ~2GB for OS.

**Warning signs:** Container OOM kills visible in `docker events`, `docker stats` showing Neo4j memory spiking.

### Pitfall 3: Missing `--frozen-lockfile` in CI

**What goes wrong:** `pnpm install` without `--frozen-lockfile` can silently update `pnpm-lock.yaml`, causing CI to install different dependency versions than committed.

**Why it happens:** CI should be a deterministic, reproducible environment.

**How to avoid:** Always use `pnpm install --frozen-lockfile` in CI workflows.

### Pitfall 4: Database Volume Data Loss on `docker compose down -v`

**What goes wrong:** Running `docker compose down -v` removes named volumes, destroying all database data. This is catastrophic in production.

**Why it happens:** Developers use `down -v` in development to reset state — but if a deploy script runs this, production data is gone.

**How to avoid:** Deploy script should only run `docker compose -f docker-compose.prod.yml up -d --remove-orphans` (never `down -v`). Only use `up -d` + `pull` to redeploy.

### Pitfall 5: SSH Key Passphrase in appleboy/ssh-action

**What goes wrong:** If the SSH private key stored in GitHub Secrets has a passphrase, `appleboy/ssh-action` will fail (it doesn't prompt for passphrases).

**Why it happens:** SSH keys used for CI/CD automation should be passphrase-free (the secret storage is the security layer).

**How to avoid:** Generate a dedicated deployment SSH key without passphrase: `ssh-keygen -t ed25519 -C "github-actions-deploy" -f deploy_key -N ""`. Add public key to server's `~/.ssh/authorized_keys`. Store private key in GitHub Secrets as `HETZNER_SSH_KEY`.

### Pitfall 6: Port Conflicts (PostgreSQL 5432 / Neo4j 7474 Exposed on Host)

**What goes wrong:** The development `docker-compose.yml` exposes PostgreSQL 5432 and Neo4j 7474/7687 to the host. In production on a public server, this exposes databases to the internet.

**Why it happens:** `docker-compose.yml` maps host ports for local development convenience.

**How to avoid:** The `docker-compose.prod.yml` override must set `ports: []` for `postgres` and `neo4j` (or remove host port mappings). Only nginx port 80/443 and backend 3001 (if needed externally) should be exposed.

### Pitfall 7: GitHub Actions Cache Invalidation on Lock File Changes

**What goes wrong:** If a developer updates `pnpm-lock.yaml` without clearing the cache key, CI may use stale cached dependencies.

**Why it happens:** `actions/setup-node` with `cache: pnpm` uses `pnpm-lock.yaml` as the cache key — this is actually correct behavior and self-heals when the lock file changes.

**How to avoid:** Use `cache-dependency-path: backend/pnpm-lock.yaml` (for monorepo-style layout) to scope cache to each workspace's lockfile.

## Code Examples

### GitHub Actions: Build and Push Both Images to GHCR

```yaml
# Source: Official GitHub docs - https://docs.github.com/en/actions/publishing-packages/publishing-docker-images
# Combined with project-specific multi-image pattern

name: Build and Push
on:
  push:
    branches: [master]

env:
  REGISTRY: ghcr.io
  REPO: ${{ github.repository }}

jobs:
  build-push:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
      attestations: write
      id-token: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      # Backend image
      - name: Backend metadata
        id: meta-be
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ env.REPO }}/backend
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build & push backend
        id: push-be
        uses: docker/build-push-action@v6
        with:
          context: ./backend
          target: runtime
          push: true
          tags: ${{ steps.meta-be.outputs.tags }}
          labels: ${{ steps.meta-be.outputs.labels }}

      # Frontend image (Vite vars baked in at build time)
      - name: Frontend metadata
        id: meta-fe
        uses: docker/metadata-action@v5
        with:
          images: ghcr.io/${{ env.REPO }}/frontend
          tags: |
            type=sha,prefix=
            type=raw,value=latest,enable={{is_default_branch}}

      - name: Build & push frontend
        id: push-fe
        uses: docker/build-push-action@v6
        with:
          context: ./frontend
          target: production
          push: true
          tags: ${{ steps.meta-fe.outputs.tags }}
          labels: ${{ steps.meta-fe.outputs.labels }}
          build-args: |
            VITE_PRIVY_APP_ID=${{ secrets.VITE_PRIVY_APP_ID }}
            VITE_NEAR_NETWORK=${{ vars.VITE_NEAR_NETWORK }}
            VITE_NEAR_RPC=${{ vars.VITE_NEAR_RPC }}
            VITE_PINATA_GATEWAY=${{ secrets.VITE_PINATA_GATEWAY }}
            VITE_BACKEND_URL=${{ vars.VITE_BACKEND_URL }}
```

### Deploy Step via SSH

```yaml
# Source: appleboy/ssh-action@v1 README + project-specific deploy pattern
  deploy:
    needs: build-push
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Hetzner
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.HETZNER_HOST }}
          username: ${{ secrets.HETZNER_USER }}
          key: ${{ secrets.HETZNER_SSH_KEY }}
          port: 22
          script: |
            set -e
            cd /home/deploy/bastion
            # Pull latest images
            docker compose -f docker-compose.prod.yml pull
            # Restart services with new images
            docker compose -f docker-compose.prod.yml up -d --remove-orphans
            # Clean up old images
            docker image prune -f
            # Verify health
            sleep 10
            curl -f http://localhost:3001/health || exit 1
            echo "Deployment successful"
```

### Server Bootstrap cloud-init (one-time, not in CI pipeline)

```yaml
# cloud-config for Hetzner server creation via Console or hcloud CLI
# hcloud server create --name bastion-dev --type cax21 --image ubuntu-24.04 \
#   --ssh-key my-key --user-data-from-file cloud-init.yml
#cloud-config
users:
  - name: deploy
    groups: [docker, sudo]
    shell: /bin/bash
    sudo: ALL=(ALL) NOPASSWD:ALL
    ssh_authorized_keys:
      - ssh-ed25519 AAAA... your-deploy-public-key

packages:
  - apt-transport-https
  - ca-certificates
  - curl
  - gnupg
  - ufw
  - nginx
  - certbot
  - python3-certbot-nginx

runcmd:
  # Install Docker
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  - echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  # Configure firewall
  - ufw default deny incoming
  - ufw default allow outgoing
  - ufw allow 22/tcp
  - ufw allow 80/tcp
  - ufw allow 443/tcp
  - ufw --force enable
  # Create app directory
  - mkdir -p /home/deploy/bastion
  - chown deploy:deploy /home/deploy/bastion
  # Disable root login
  - sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
  - systemctl reload sshd
```

### pnpm CI Caching

```yaml
# Source: https://pnpm.io/continuous-integration (official pnpm docs)
- uses: pnpm/action-setup@v4
  with:
    version: 10
- uses: actions/setup-node@v4
  with:
    node-version: 20
    cache: "pnpm"
    cache-dependency-path: backend/pnpm-lock.yaml
- run: pnpm install --frozen-lockfile
  working-directory: backend
```

### docker-compose.prod.yml Production Override

```yaml
# docker-compose.prod.yml
# Run with: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
# Or standalone: docker compose -f docker-compose.prod.yml up -d (with pre-pulled images)
services:
  postgres:
    restart: always
    ports: []       # Remove host port exposure in production

  neo4j:
    restart: always
    ports: []       # Remove 7474/7687 host exposure in production
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      # Tuned for CAX21 (8GB total RAM shared with other services)
      NEO4J_server_memory_heap_initial__size: 256m
      NEO4J_server_memory_heap_max__size: 512m
      NEO4J_server_memory_pagecache_size: 256m

  backend:
    image: ghcr.io/${GITHUB_REPOSITORY}/backend:latest
    restart: always
    ports: []       # Only expose via nginx proxy
    environment:
      - NODE_ENV=production

  frontend:
    image: ghcr.io/${GITHUB_REPOSITORY}/frontend:latest
    restart: always
    ports:
      - "8080:80"   # nginx on host proxies to here
    volumes: []     # No source code mounts in production
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| docker-compose v1 (YAML v2) | Docker Compose v2 plugin (`docker compose` not `docker-compose`) | Docker Desktop 2022, Docker Engine 20.10+ | CLI syntax change; `docker-compose` is deprecated |
| Building images on deploy server | Build in CI, push to registry, pull on server | 2021-2023 | Separates concerns; server doesn't need build tools |
| Manual TLS cert renewal | Certbot auto-renewal via cron | 2016+ | Let's Encrypt + certbot is fully automated |
| Personal Access Tokens for registry | `GITHUB_TOKEN` for GHCR | GHCR GA 2021 | No credentials to manage; token scoped to workflow |
| Storing secrets in .env in repo | GitHub Secrets + GitHub Environments | 2020+ | Encrypted at rest, masked in logs, reviewer gates |
| `docker/build-push-action@v1/v2` | `docker/build-push-action@v6` | 2024-2025 | Updated BuildKit, provenance attestation support |

**Deprecated/outdated:**
- `docker-compose` (v1 Python binary): Replaced by `docker compose` plugin (v2). All official docs use `docker compose`. The development docker-compose.yml in this project uses the correct format.
- `actions/checkout@v2`: Current standard is `@v4`
- Classic PATs for GHCR: Use `GITHUB_TOKEN` instead

## Open Questions

1. **Domain name availability**
   - What we know: CI/CD will deploy to a Hetzner server IP; TLS requires a domain name
   - What's unclear: Does the project have a domain name configured? Is `bastion.yourdomain.com` available?
   - Recommendation: Phase 17 plans should include a step for domain setup or document "use IP address only (HTTP) for dev deployment" as fallback

2. **GHCR package visibility for private repository**
   - What we know: GHCR packages inherit repository visibility; private repos produce private packages requiring GITHUB_TOKEN to pull
   - What's unclear: The GitHub repo is `ALuhning/Bastion.git` - if it's public, GHCR images are public too (fine); if private, the server needs a pull credential
   - Recommendation: For private repos, create a PAT with `read:packages` scope and store as `GHCR_TOKEN` secret; use in deploy script as `docker login ghcr.io -u USERNAME -p $GHCR_TOKEN`

3. **Database migration strategy for incremental schema updates**
   - What we know: Project has `backend/database/` with numbered SQL files (001-017). The Docker init.sql runs on first start only. Subsequent schema files need manual application.
   - What's unclear: No migration tool (Flyway, Atlas, node-migrate) is currently in use
   - Recommendation: Phase 17 plan should include a simple migration step in the deploy script that runs new SQL files. Since the project uses raw SQL (not an ORM), `psql -f new_file.sql` via `docker compose exec postgres` is the pragmatic approach. Document this pattern — full migration tooling is Phase 18+ scope.

4. **Server firewall vs. Hetzner Cloud Firewall**
   - What we know: Hetzner Cloud offers both a cloud-level firewall (configured in console/hcloud CLI) and host-level UFW
   - What's unclear: Which to use as primary layer?
   - Recommendation: Use both — Hetzner Cloud Firewall as the outer layer (blocks before reaching server), UFW as defense-in-depth. Both allow only 22, 80, 443.

5. **ARM compatibility for Neo4j and TimescaleDB**
   - What we know: CAX servers use ARM64 (Ampere Altra). Neo4j and TimescaleDB both publish official ARM64 Docker images.
   - What's unclear: The `docker-compose.yml` uses `timescale/timescaledb:latest-pg16` and `neo4j:2025-community` — both have ARM64 images published to Docker Hub.
   - Recommendation: Verify ARM64 support during plan execution by confirming image manifests. If an image lacks ARM64, use CX23 (x86) instead of CAX21.

## Validation Architecture

> Skipping — `workflow.nyquist_validation` is not set to `true` in `.planning/config.json` (config uses `mode`, `depth`, `gates`, `safety` keys only, no `workflow` key).

## Sources

### Primary (HIGH confidence)
- [GitHub Actions - Publishing Docker Images](https://docs.github.com/en/actions/publishing-packages/publishing-docker-images) - Official GHCR workflow YAML, GITHUB_TOKEN auth, metadata-action usage
- [pnpm Continuous Integration docs](https://pnpm.io/continuous-integration) - Official pnpm/action-setup workflow, frozen-lockfile recommendation
- [GitHub Actions - Deployment Environments](https://docs.github.com/actions/deployment/targeting-different-environments/using-environments-for-deployment) - Environment-level secrets, protection rules, YAML syntax
- [Docker Compose Production docs](https://docs.docker.com/compose/how-tos/production/) - Official override pattern, restart policies, volume removal for production
- [appleboy/ssh-action README](https://github.com/appleboy/ssh-action) - v1 action parameters, multi-command SSH script pattern
- Project codebase: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, `frontend/nginx.conf`, `backend/package.json`, `frontend/package.json` — existing build infrastructure confirmed

### Secondary (MEDIUM confidence)
- [Hetzner Cloud - Official pricing](https://www.hetzner.com/cloud) - CAX21 €6.49/month (8GB RAM), CAX31 €12.49/month (16GB RAM) verified Feb 2026
- [Achromatic.dev Hetzner comparison](https://www.achromatic.dev/blog/hetzner-server-comparison) - CAX value scores, CAX31 recommendation for database workloads
- [InFocus Data - CI/CD with Hetzner](https://infocusdata.com/blog/devops/ci-cd-docker-github-actions-hetzner-deployment) - Complete workflow steps, SSH deployment pattern, health check approach
- [jmh.me - Zero-downtime Docker Compose](https://jmh.me/blog/zero-downtime-docker-compose-deploy) - Blue-green pattern with Caddy, rollback via image tagging
- [Phala Cloud Docker Compose guide](https://docs.phala.com/phala-cloud/phala-cloud-user-guides/create-cvm/create-with-docker-compose) - TEE architecture: all services in one compose file run inside same CVM

### Tertiary (LOW confidence)
- [DEV.to - VPS with Nginx/Docker/GHA](https://dev.to/iyadhgallah/setting-up-a-vps-with-nginx-docker-and-github-actions-1jb7) - Server setup steps, certbot pattern, secrets structure (single-source tutorial)
- Cloud-init pattern for Hetzner bootstrap from community tutorials — standard Linux cloud-init practices (confirmed pattern, specific YAML from community tutorials not independently verified)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - GitHub Actions, GHCR, appleboy/ssh-action are all well-documented official tools; Hetzner pricing verified from official site
- Architecture: HIGH - Based on existing project Dockerfiles and confirmed Docker Compose patterns from official docs
- Pitfalls: MEDIUM-HIGH - VITE build-time vars pitfall is HIGH (documented in Vite official docs); Neo4j memory is MEDIUM (based on Neo4j docs + general experience); others from cross-verified community sources
- TEE separation: MEDIUM - Phala Cloud docs confirm the CVM model; specific migration path from standard to TEE is architectural judgment

**Research date:** 2026-03-02
**Valid until:** 2026-06-01 (stable ecosystem - GitHub Actions versions, Hetzner pricing may drift; Phala docs may update)
