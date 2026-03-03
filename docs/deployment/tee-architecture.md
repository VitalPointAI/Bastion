# TEE-Aware Component Separation — Bastion Deployment Architecture

This document describes the current development deployment topology (Phase 17) and the future
TEE-aware production separation path using Phala Cloud.

---

## Current Dev Deployment (Phase 17)

All components co-located on one Hetzner CAX21 or CAX31 server running Ubuntu 24.04.

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

### How traffic flows

1. Internet → **Host nginx** (port 443, TLS terminated with Let's Encrypt certificate)
2. Host nginx → **frontend container** (port 8080 on host → port 80 inside container)
3. Frontend container's `nginx.conf` → `/api/*` requests proxied to **backend:3001** on Docker network
4. Backend → **postgres:5432** and **neo4j:7687** on Docker network (internal only)

### Security model

- Databases (postgres:5432, neo4j:7474/7687) have **no host port mappings** — only accessible on the `bastion-network` Docker bridge
- Internet can only reach port 80 (redirects to HTTPS) and port 443 (TLS)
- UFW firewall allows only 22/80/443
- All services run with `restart: always` for auto-recovery after reboots
- Secrets (POSTGRES_PASSWORD, NEO4J_PASSWORD, AI API keys) stored in `/home/deploy/bastion/.env.prod` (not committed to git)

---

## Future Production TEE Deployment

TEE-aware separation moves sensitive AI operations (NEAR key management, LLM API calls,
encryption) into a Trusted Execution Environment (TEE) while keeping non-sensitive components
(static files, operational databases) on a traditional VPS.

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

### Phala Cloud CVM model

Phala Cloud's Confidential Virtual Machine (CVM) model places all services in one Docker Compose
file running inside the same CVM. This provides:

- **Encrypted memory**: JVM heap, Node.js heap, and all inter-service traffic is encrypted
- **Remote attestation**: Verifiable proof that the backend code is running unmodified in TEE
- **Runtime secret injection**: Secrets encrypted client-side; only decrypted inside the TEE at
  runtime — never visible to the cloud provider
- **Secure inter-service communication**: Services inside the same CVM communicate over localhost
  without exposure to the host hypervisor

---

## Migration Path: Phase 17 → TEE Production

When migrating from the Phase 17 co-located deployment to TEE-aware separation:

### What stays the same

- Backend `Dockerfile` target `runtime` — unchanged; Phala Cloud wraps the container in a CVM
- `docker-compose.prod.yml` structure — Phala Cloud deploys from the same Docker Compose file
- Database schemas and application logic — no code changes required for TEE migration

### What changes

| Component | Phase 17 (Current) | TEE Production |
|-----------|-------------------|----------------|
| Backend runtime | Docker container on Hetzner VPS | Same container inside Phala Cloud CVM |
| Secret storage | `/home/deploy/bastion/.env.prod` | TEE-encrypted secrets (client-side encryption) |
| NEAR signing keys | Server-side env vars | Injected into TEE only at runtime |
| AI API keys | Server-side env vars | Injected into TEE only at runtime |
| Database access | Backend connects via Docker network | Backend (in CVM) connects to VPS databases via TLS |
| Attestation | None | CVM provides hardware attestation proofs |

### Network boundary

In TEE deployment, a new network boundary exists between:
- **VPS** (frontend, postgres, neo4j) — public-facing infrastructure
- **CVM** (backend) — trusted execution environment

Backend API calls from the CVM to VPS databases must use TLS with certificate pinning.
The frontend continues to proxy `/api/` requests to the backend CVM's public endpoint.

---

## Design Decision

**Phase 17 co-locates everything on one Hetzner server.** This is intentional for the development
deployment — TEE separation is a future production concern, not a Phase 17 deliverable.

The benefits of the current approach:
- Simple, single-server operation and debugging
- Lower infrastructure cost for development
- All Docker networking is local (no inter-datacenter latency)
- Direct `docker compose logs` access to all services

TEE migration is triggered when:
1. The application handles real coalition operational data requiring confidentiality guarantees
2. NEAR key management requires verifiable protection beyond server-level security
3. The deployment needs to provide cryptographic proof of code integrity to external auditors
