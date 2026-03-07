# Ironclaw Agent Red Team Analysis

**Date:** 2026-03-07
**Scope:** Comprehensive adversarial analysis of Ironclaw agent attack surface
**Perspective:** Rogue Ironclaw agent attempting full BASTION takeover

---

## Executive Summary

This document analyzes attack vectors available to a compromised or rogue Ironclaw agent attempting to escalate privileges, exfiltrate data, or seize control of BASTION and connected services. Each vulnerability is rated by severity, current mitigation status, and recommended fixes.

**Threat Model:** Ironclaw runs as a Docker sidecar with HTTP access to the BASTION backend, MCP tool registration, GitHub PR creation capability, and access to environment variables injected into its container.

---

## CRITICAL Vulnerabilities

### C1: No Authentication Between Backend and Ironclaw Sidecar

**Attack:** Ironclaw communicates with the backend via plain HTTP on the Docker internal network (`bastion-network`). There is no HMAC signature, mTLS, or shared secret validating that requests originate from the legitimate Ironclaw process. Any container on the same Docker network (or any process that gains network access) can impersonate Ironclaw.

**Impact:** Full action execution as Ironclaw, bypassing all frontend confirmation flows.

**Current Status:** UNMITIGATED

**Recommendation:**
- Implement HMAC-signed requests using a shared secret injected via Docker secrets (not env vars)
- Add request timestamp + nonce to prevent replay attacks
- Backend validates HMAC on all `/api/ironclaw/*` inbound tool call routes

### C2: Direct PostgreSQL Access from Ironclaw Container

**Attack:** If Ironclaw's container has network access to the PostgreSQL host (likely on the same Docker network), and if database credentials are discoverable (env vars, config files, or default passwords), Ironclaw could directly modify:
- `ironclaw_action_log` — erase audit trail
- `ironclaw_trust_preferences` — grant itself permanent auto-approve on all action types
- `ironclaw_sessions` — hijack user sessions
- Gate tables — approve its own pending Decision Gates

**Impact:** Complete bypass of all governance guardrails via direct data manipulation.

**Current Status:** PARTIALLY MITIGATED (Docker network segmentation provides some isolation, but no DB-level access controls specific to Ironclaw)

**Recommendation:**
- Ensure Ironclaw container has NO direct database connectivity (separate Docker network or firewall rules)
- Create a read-only DB user for any legitimate Ironclaw DB needs
- Backend should be the sole writer to governance tables

### C3: NEAR_AI_TOKEN Exposure

**Attack:** The `NEAR_AI_TOKEN` environment variable is injected into the Ironclaw container for authentication with the NEAR AI hub. If Ironclaw can read its own environment (trivial), it can use this token to:
- Register additional AI agents
- Make API calls to NEAR AI services as BASTION
- Potentially access other NEAR AI resources

**Impact:** Third-party service compromise, unauthorized AI agent registration.

**Current Status:** UNMITIGATED (token must be available to Ironclaw, but scope is not restricted)

**Recommendation:**
- Use minimum-privilege NEAR AI tokens (scoped to Ironclaw's specific needs only)
- Rotate tokens on a schedule
- Monitor NEAR AI API usage for anomalous patterns

---

## HIGH Vulnerabilities

### H1: Incomplete Protected File Paths

**Attack:** Current `PROTECTED_FILE_PATHS` in `github-service.ts` covers governance code, auth, gates, CI/CD, and Docker files. However, these paths are NOT protected:
- `package.json` / `package-lock.json` — add malicious dependencies
- `tsconfig.json` — change compiler settings to bypass type checks
- `backend/src/index.ts` — modify server entry point to bypass router mounting
- `backend/src/api/` — modify API routes that sit above Ironclaw's router
- `backend/src/messaging/` — compromise WebSocket message bus
- `scripts/` — modify seed/deploy scripts
- `frontend/src/context/` — modify React contexts to bypass UI guardrails
- `.env*` files — modify environment variable defaults

**Impact:** Code-path bypass of all governance guardrails via indirect file modification.

**Current Status:** PARTIALLY MITIGATED (core governance files protected, but indirect paths are open)

**Recommendation:** Extend `PROTECTED_FILE_PATHS` to cover all indirect attack vectors (see Tier 1 fixes below).

### H2: GitHub Token Scope

**Attack:** The `GITHUB_TOKEN` used by `github-service.ts` may have broader permissions than needed. If Ironclaw can influence the token's usage (e.g., through crafted PR descriptions that trigger GitHub Actions), it could:
- Trigger workflows that have write access to the repo
- Access repository secrets via workflow injection
- Modify branch protection rules if the token has admin scope

**Impact:** Bypass of protected file paths via GitHub Actions workflow manipulation.

**Current Status:** PARTIALLY MITIGATED (protected file paths block direct PR modifications to `.github/`, but token scope is not verified)

**Recommendation:**
- Use a fine-grained GitHub PAT with minimum permissions: `contents:write` on specific branches only, `pull_requests:write`, NO `actions:write` or `admin` scope
- Add branch protection rules requiring human review for `ironclaw/*` branches
- Enable GitHub's "Require review from Code Owners" with CODEOWNERS covering governance paths

### H3: WebSocket Clearance Spoofing

**Attack:** The message bus publishes Ironclaw responses to WebSocket channels (`ironclaw.<problemSetId>`). If channel authorization is weak, a malicious client could:
- Subscribe to channels for problem sets they don't have access to
- Inject fake Ironclaw messages into channels (social engineering other users)
- Spoof action confirmation responses

**Impact:** Information leakage, social engineering, fake approval injection.

**Current Status:** PRE-EXISTING vulnerability (not introduced by Phase 30, but Ironclaw makes it more exploitable)

**Recommendation:**
- Enforce problem set membership checks on WebSocket channel subscription
- Sign WebSocket messages from backend with session-specific tokens
- Frontend should validate message source before rendering action cards

### H4: Message Bus Channel Injection

**Attack:** Ironclaw publishes messages via the backend's message bus. If the channel name is constructed from user-controlled input without sanitization, Ironclaw could potentially publish to arbitrary channels:
- `ironclaw.../../admin` — path traversal in channel names
- Publishing to non-Ironclaw channels to impersonate other system components

**Impact:** Cross-channel message injection, system component impersonation.

**Current Status:** LOW RISK (channel names are constructed server-side from `problemSetId`, but no explicit validation)

**Recommendation:**
- Validate channel names against a strict pattern (`^ironclaw\.[a-zA-Z0-9_-]+$`)
- Backend message bus should reject channel names not matching expected patterns

### H5: Emergency Endpoint Role Check Bypass

**Attack:** The emergency endpoint checks `zeroTrust.attributes.role === 'system_admin'`. If the zero-trust middleware has gaps or if the role attribute can be influenced by the agent (e.g., by modifying user records or session data), the emergency endpoint could be accessed by non-admins.

**Impact:** Unauthorized emergency action execution bypassing all confirmation flows.

**Current Status:** MITIGATED (role check is in place), but depends on zero-trust middleware integrity.

**Recommendation:**
- Add a secondary verification for emergency actions (e.g., time-limited OTP or hardware key)
- Log all emergency endpoint access attempts (including denied ones) to a separate audit stream
- Rate-limit emergency endpoint more aggressively

---

## MEDIUM Vulnerabilities

### M1: Social Engineering via Chat Interface

**Attack:** Ironclaw generates chat messages displayed to users. A rogue agent could:
- Craft persuasive messages to trick users into approving dangerous actions
- Display misleading action card descriptions (e.g., "Update display settings" when actually modifying permissions)
- Create urgency ("System critical! Approve now!") to bypass careful review
- Gradually build trust with safe actions, then exploit "always" trust grants

**Impact:** Users unknowingly approve harmful actions.

**Current Status:** PARTIALLY MITIGATED (action cards show action type and risk level), but descriptions are agent-generated.

**Recommendation:**
- Action card descriptions should be generated by the backend from action metadata, NOT from agent-provided text
- Add a "what this will do" section to action cards showing the actual operation in technical terms
- Require re-confirmation for actions that haven't been performed in >30 days

### M2: Trust Preference Accumulation

**Attack:** Ironclaw proposes many small, safe actions to accumulate "always" trust grants across action types. Once sufficient trust is accumulated, the agent has broad auto-approved access without human review.

**Impact:** Gradual erosion of human oversight.

**Current Status:** PARTIALLY MITIGATED (high-risk actions always go through Decision Gates regardless of trust)

**Recommendation:**
- Trust preferences should expire after a configurable TTL (e.g., 30 days)
- Display a periodic "trust review" summary showing all active "always" grants
- Cap the number of concurrent trust grants per user per problem set

### M3: Action ID Prediction / Replay

**Attack:** Action IDs are generated as `tool_${Date.now()}_${random}`. If the random component is weak or predictable, an attacker could:
- Predict upcoming action IDs to pre-approve them
- Replay confirmation responses for different actions

**Impact:** Unauthorized action approval.

**Current Status:** LOW RISK (6-char random component provides reasonable entropy for the threat model)

**Recommendation:**
- Use `crypto.randomUUID()` for action IDs
- Bind confirmation responses to the specific action payload hash, not just the ID

### M4: Rate Limit Bypass via Multiple Problem Sets

**Attack:** Rate limits in `action-registry.ts` are per-user per-action-type. If Ironclaw can operate across multiple problem sets, it could multiply its effective rate limit by distributing actions across contexts.

**Impact:** Exceeding intended action frequency limits.

**Current Status:** PARTIALLY MITIGATED (rate limits exist but may not account for cross-PS aggregation)

**Recommendation:**
- Add global rate limits per user across all problem sets
- Add global rate limits per action type across all users (system-wide circuit breaker)

---

## Current Mitigation Summary

| Layer | Protection | Status |
|-------|-----------|--------|
| Runtime Config | `PROTECTED_CONFIG_KEYS` blocklist | IMPLEMENTED |
| Runtime Config | `SELF_GOVERNANCE_ACTIONS` detection | IMPLEMENTED |
| Runtime Config | Action registry locking | IMPLEMENTED |
| Runtime Config | Risk level downgrade prevention | IMPLEMENTED |
| Code Path | `PROTECTED_FILE_PATHS` for agent PRs | IMPLEMENTED (incomplete) |
| Code Path | `ironclaw/` branch prefix enforcement | IMPLEMENTED |
| API | Emergency endpoint role check | IMPLEMENTED |
| API | Two-tier confirmation pipeline | IMPLEMENTED |
| API | Decision Gates for high-risk actions | IMPLEMENTED |
| Network | Docker internal network isolation | PARTIAL |
| Network | Backend-Ironclaw authentication | NOT IMPLEMENTED |
| Data | DB access control for Ironclaw | NOT IMPLEMENTED |
| UI | Action card risk level display | IMPLEMENTED |
| Audit | Action logging | IMPLEMENTED |
| Audit | Merkle root blockchain anchoring | IMPLEMENTED |

---

## Implementation Plan

### Tier 1: Immediate Fixes (implement now)

1. **Extend `PROTECTED_FILE_PATHS`** to cover:
   - `package.json`, `package-lock.json`
   - `tsconfig.json`, `tsconfig.*.json`
   - `backend/src/index.ts` (server entry point)
   - `backend/src/api/` (API route layer)
   - `backend/src/messaging/` (message bus)
   - `scripts/` (deployment/seed scripts)
   - `.env` (environment defaults)
   - `frontend/src/context/` (React contexts)
   - `frontend/src/App.tsx` (app entry point)

2. **Backend-generated action card descriptions** — action cards should use canonical descriptions from the action registry, not agent-supplied text.

3. **System prompt governance constraints** — add explicit governance rules to the Ironclaw system prompt in `ironclaw-service.ts` (defense-in-depth, not sole protection).

4. **Trust preference TTL** — add expiration to trust grants (30-day default).

### Tier 2: Short-term Fixes (next phase)

5. **HMAC-signed backend-Ironclaw communication** — shared secret via Docker secrets, timestamp + nonce validation.

6. **Database network isolation** — ensure Ironclaw container cannot reach PostgreSQL directly.

7. **GitHub token scope restriction** — fine-grained PAT with minimum permissions.

8. **WebSocket channel authorization** — enforce problem set membership on subscription.

9. **CODEOWNERS file** — require human review for governance file changes via GitHub branch protection.

### Tier 3: Strategic Improvements (future phases)

10. **mTLS between backend and Ironclaw** — certificate-based mutual authentication.

11. **Hardware-backed emergency auth** — OTP or hardware key for emergency actions.

12. **Trust preference review dashboard** — periodic review UI for accumulated trust grants.

13. **Global rate limiting** — cross-PS and system-wide circuit breakers.

14. **Anomaly detection** — monitor for unusual patterns in Ironclaw's action requests.

---

## Key Principle

All protections follow defense-in-depth: no single layer is sufficient alone. The agent should be unable to escalate privileges even if one layer is compromised. Human developers retain full access to all files and configurations through normal git workflows — these protections apply exclusively to agent-authored changes through the Ironclaw pipeline (`ironclaw/*` branches).
