# Phase 58: On-Chain Resource DID Caveats with Contract Enforcement - Research

**Researched:** 2026-03-26
**Domain:** NEAR smart contracts (Rust), resource DID registry, role-based access control, frontend security editor
**Confidence:** HIGH

## Summary

Phase 58 extends the existing DID registry smart contract (`contracts/did-registry/src/lib.rs`) with structured caveat fields tied to resource DIDs, and adds a `check_employment_authorized()` view method for contract-level enforcement. The current `DIDEntry` struct stores only encrypted document bytes, owner, timestamps, and active flag — it has no domain-specific caveat fields. This phase adds plaintext (non-encrypted) caveat fields directly to `DIDEntry` since caveats are policy metadata that must be readable by the contract's enforcement logic without decryption keys.

The backend already has all the plumbing for NEAR contract calls: `tx-signer.ts` provides `signAndSubmitFunctionCall()` used by problem-sets.ts and gates; `resource-registry.ts` is a fully operational singleton with DB-backed cache; `resource-store.ts` manages the PostgreSQL resources table. The pattern for adding new contract operations follows the `storeDIDOnChain` / `anchorCredentialOnChain` functions in `tx-signer.ts`. The `ResourceDetailPanel.tsx` is a placeholder shell awaiting data — it currently shows "Data loading will be wired in Plan 42-06" — making it straightforward to add a new Security & Caveats section.

The caveat fields required (classification, releasability, geographic bounds, ROE tier, time windows, employment constraints) map cleanly to Rust struct fields using `near-sdk 5.6.0` with `BorshSerialize/Deserialize` and `serde`. The `check_employment_authorized()` view function takes a blinded key and an `EmploymentContext` argument, evaluates the stored caveats, and returns a boolean with a reasons array — pure view logic with no state mutation. Role-based permission gating uses the existing `problemSetMemberStore.getMember()` pattern where `commander` and `xo` roles can update caveats; resource owners (determined by comparing `resource.did` ownership to the caller's derived DID) can also update their own resource's caveats.

**Primary recommendation:** Extend `DIDEntry` with an `Option<ResourceCaveats>` field (backward-compatible via `Option`), add `update_resource_caveats()` and `check_employment_authorized()` methods to the contract, rebuild WASM, redeploy to testnet using `near-cli-rs 0.22.1` + `cargo-near`, then wire backend endpoints and frontend editor using the already-proven patterns.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| REQ-58-01 | Smart contract caveat enforcement via `check_employment_authorized()` view method | Rust contract extension with `ResourceCaveats` struct + view method evaluating classification, releasability, geo bounds, ROE tier, time windows, employment constraints |
| REQ-58-02 | Role-based caveat management (resource owners + problem set admins can update) | `problemSetMemberStore.getMember()` for commander/xo check; DID ownership comparison for resource owner check — same patterns as problem-sets.ts `requireCommanderOrXo` |
| REQ-58-03 | On-chain resource DID registration with caveats stored at time of DID creation | Extend `store_did()` to accept optional `ResourceCaveats` param, or add `update_resource_caveats()` as a separate mutating method; migration path for existing resources |
| REQ-58-04 | Frontend Security & Caveats editor in ResourceDetailPanel, permission-gated | Add new section to `ResourceDetailPanel.tsx` shell (currently placeholder); gate edit controls by querying member role from `problemSetMemberStore` |
| REQ-58-05 | Deploy updated contract to testnet | Rebuild with `cargo build --target wasm32-unknown-unknown --release`, deploy with `near-cli-rs 0.22.1` `near contract deploy`, update `DID_CONTRACT_ID` env var |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| near-sdk (Rust) | 5.6.0 | Smart contract SDK | Already used in `contracts/did-registry/Cargo.toml` |
| borsh | 1.0 | Binary serialization for contract state | Already used in DID registry contract |
| schemars | 0.8 | JSON Schema for contract ABI | Already used in DID registry contract |
| @near-js/accounts | ^2.5.1 | NEAR account + function call | Already used in `tx-signer.ts` |
| @near-js/providers | ^2.5.1 | JSON RPC provider | Already used in `tx-signer.ts` |
| @noble/hashes | existing | HKDF derivation for signing keys | Already used in `tx-signer.ts` |
| near-cli-rs | 0.22.1 | Contract deployment CLI | Installed at `/home/vitalpointai/.cargo/bin/near` |
| cargo-near | installed | WASM build tool | Installed at `/home/vitalpointai/.cargo/bin/cargo-near` |
| cargo | 1.92.0 | Rust build system | Available for `--target wasm32-unknown-unknown` builds |

### Supporting (already in project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | existing | Request body validation | Backend API input validation for caveat update endpoints |
| react-hook-form | existing | Frontend form management | Caveat editor form in ResourceDetailPanel |
| problemSetMemberStore | internal | Problem set role checks | Permission gating — `getMember(problemSetId, userDid)` |
| signAndSubmitFunctionCall | internal | Signed NEAR contract calls | Calling `update_resource_caveats` on the DID contract |
| json-rules-engine | existing | ROE rule evaluation | Existing ROE engine uses this; caveat ROE tier is a simpler version at contract level |

### New Dependencies Required
None. All required libraries are installed.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Adding caveats to existing DIDEntry | Separate contract/table | Existing contract is the natural home for caveat enforcement; separate contract adds cross-contract call complexity |
| Plaintext caveat fields on-chain | Encrypted caveats | Encryption would prevent the contract from evaluating caveats without decryption keys — plaintext is required for enforcement logic |
| Extending `store_did()` signature | Separate `update_resource_caveats()` | Separate method is cleaner: existing DID entries get migrated without re-encrypting documents; store_did already has a complex signature |

## Architecture Patterns

### Recommended Project Structure
```
contracts/did-registry/src/lib.rs     # Extend DIDEntry + add caveat methods
backend/src/near/tx-signer.ts         # Add storeResourceCaveatsOnChain() and checkEmploymentAuth() helpers
backend/src/resources/resource-caveat-service.ts  # New: caveat CRUD + on-chain bridge
backend/src/api/resources.ts          # Add PATCH /:id/caveats and GET /:id/employment-check routes
backend/src/resources/types.ts        # Extend Resource type with caveats field
backend/src/db/migrations/046-resource-caveats.sql  # Add caveats columns to resources table
frontend/src/components/resources/ResourceDetailPanel.tsx  # Add Security & Caveats section
frontend/src/lib/resource-service.ts  # Add updateCaveats() and checkEmployment() API calls
```

### Pattern 1: Rust Contract Struct Extension (Backward-Compatible)

**What:** Add `ResourceCaveats` as an `Option` field on `DIDEntry` so existing stored entries deserialize without the field (Borsh handles `Option` as 0/1 prefix byte).
**When to use:** Any time you need to add fields to an existing contract state struct without migration.
**Example:**
```rust
// Source: contracts/did-registry/src/lib.rs — extend DIDEntry
#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct ResourceCaveats {
    pub classification: String,          // "UNCLASSIFIED" | "SECRET" | "TOPSECRET"
    pub releasability: Vec<String>,      // ["USA", "GBR", "AUS"] — empty means unrestricted
    pub geo_bounds: Option<GeoBounds>,   // Optional geographic restriction
    pub roe_tier: u8,                    // 1-5 ROE tier (mirrors existing ROE engine tiers)
    pub time_windows: Vec<TimeWindow>,   // Active employment windows
    pub employment_constraints: Vec<String>, // Free-text constraints e.g. "KINETIC_ONLY_WITH_APPROVAL"
    pub updated_by: AccountId,
    pub updated_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct GeoBounds {
    pub north: i64,  // Degrees * 1_000_000 (avoid floats in contract)
    pub south: i64,
    pub east: i64,
    pub west: i64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
#[borsh(crate = "near_sdk::borsh")]
pub struct TimeWindow {
    pub start_ms: u64,   // Unix timestamp milliseconds
    pub end_ms: u64,
}

// Extend DIDEntry — Option<> is backward-compatible in Borsh
pub struct DIDEntry {
    // ... existing fields ...
    pub caveats: Option<ResourceCaveats>,  // NEW: None for existing entries
}
```

### Pattern 2: Contract `update_resource_caveats()` Method

**What:** Separate write method for setting caveats on an existing DID entry. Caller must be the DID owner or contract admin.
**When to use:** When updating caveats after DID creation (or at registration time via a two-step: store_did then update_resource_caveats).
**Example:**
```rust
// In contracts/did-registry/src/lib.rs — add to DIDRegistry impl
#[payable]
pub fn update_resource_caveats(
    &mut self,
    blinded_key: Vec<u8>,
    caveats: ResourceCaveats,
) {
    self.assert_not_paused();
    let key_hex = hex_encode(&blinded_key);
    let caller = env::predecessor_account_id();

    let mut entry = self.dids.get(&key_hex)
        .unwrap_or_else(|| env::panic_str("DID not found"))
        .clone();

    // Only owner or admin can update caveats
    assert!(
        entry.owner == caller || caller == self.admin,
        "Only the DID owner or admin can update caveats"
    );

    entry.caveats = Some(caveats);
    entry.updated_at = env::block_timestamp();
    self.dids.insert(key_hex, entry);

    // Storage cost refund pattern (same as store_did)
}
```

### Pattern 3: Contract `check_employment_authorized()` View Method

**What:** Pure view function that evaluates caveats against a provided context. Returns authorization result with reasons.
**When to use:** Before any resource employment decision — called from backend or directly via RPC.
**Example:**
```rust
// In contracts/did-registry/src/lib.rs
#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct EmploymentContext {
    pub requesting_account: String,
    pub location: Option<GeoBounds>,      // Where employment will occur
    pub timestamp_ms: u64,               // When employment will occur
    pub roe_tier_required: u8,            // ROE tier the operation is at
    pub nation_code: Option<String>,      // Requesting nation (for releasability)
}

#[derive(Serialize, Deserialize, JsonSchema)]
#[serde(crate = "near_sdk::serde")]
pub struct EmploymentAuthResult {
    pub authorized: bool,
    pub reasons: Vec<String>,  // Empty if authorized, violation descriptions if not
}

pub fn check_employment_authorized(
    &self,
    blinded_key: Vec<u8>,
    context: EmploymentContext,
) -> EmploymentAuthResult {
    let key_hex = hex_encode(&blinded_key);

    let entry = match self.dids.get(&key_hex) {
        Some(e) => e,
        None => return EmploymentAuthResult {
            authorized: false,
            reasons: vec!["DID not found".to_string()],
        },
    };

    if !entry.active {
        return EmploymentAuthResult {
            authorized: false,
            reasons: vec!["Resource DID is inactive".to_string()],
        };
    }

    let caveats = match &entry.caveats {
        Some(c) => c,
        None => return EmploymentAuthResult { authorized: true, reasons: vec![] },
    };

    let mut reasons = Vec::new();

    // Check releasability
    if !caveats.releasability.is_empty() {
        if let Some(nation) = &context.nation_code {
            if !caveats.releasability.contains(nation) {
                reasons.push(format!("Nation {} not in releasability list", nation));
            }
        }
    }

    // Check ROE tier
    if context.roe_tier_required > caveats.roe_tier {
        reasons.push(format!(
            "ROE tier {} exceeds authorized tier {}",
            context.roe_tier_required, caveats.roe_tier
        ));
    }

    // Check time windows
    if !caveats.time_windows.is_empty() {
        let in_window = caveats.time_windows.iter().any(|w| {
            context.timestamp_ms >= w.start_ms && context.timestamp_ms <= w.end_ms
        });
        if !in_window {
            reasons.push("Current time outside authorized employment windows".to_string());
        }
    }

    // Check geographic bounds
    if let (Some(geo), Some(loc)) = (&caveats.geo_bounds, &context.location) {
        if loc.north > geo.north || loc.south < geo.south
            || loc.east > geo.east || loc.west < geo.west {
            reasons.push("Employment location outside authorized geographic bounds".to_string());
        }
    }

    EmploymentAuthResult {
        authorized: reasons.is_empty(),
        reasons,
    }
}
```

### Pattern 4: Backend Caveat Endpoint (Following existing resources.ts pattern)

**What:** New `PATCH /:id/caveats` endpoint with auth guard + role check. Follows the `requireCommanderOrXo` pattern from problem-sets.ts.
**When to use:** Frontend caveat editor save action.
**Example:**
```typescript
// backend/src/api/resources.ts — add after existing registry endpoints
// Pattern: copied from problem-sets.ts requireCommanderOrXo
async function requireCaveatUpdatePermission(
  resourceId: string,
  problemSetId: string,
  callerDid: string,
): Promise<void> {
  // Check if caller is resource owner (their DID matches resource's stored owner DID)
  const resource = await resourceStore.getResource(resourceId);
  if (!resource) throw Object.assign(new Error('Resource not found'), { code: '404' });

  const isOwner = resource.did &&
    resource.did === callerDid; // did:near:resource-{id} vs caller's did:near:{accountId}
    // NOTE: resource DIDs are did:near:resource-{id}, NOT the caller's DID
    // Ownership for caveats = the blinded_key owner on-chain (stored as entry.owner)
    // For simplicity: check problemSet commander/xo OR the resource's creator (stored in DB)

  // Check if caller is commander or XO in the problem set
  const member = await problemSetMemberStore.getMember(problemSetId, callerDid);
  const isCommanderOrXo = member && (member.role === 'commander' || member.role === 'xo');

  if (!isOwner && !isCommanderOrXo) {
    throw Object.assign(new Error('Only resource owner or commander/XO can update caveats'), { code: '403' });
  }
}

// PATCH /api/resources/:id/caveats
router.patch('/:id/caveats', requireAuth, async (req: Request, res: Response) => {
  const callerDid = `did:near:${req.anonUser!.nearAccountId}`;
  const { id } = req.params;
  const { problemSetId, caveats } = req.body;

  await requireCaveatUpdatePermission(id, problemSetId, callerDid);

  // Store caveats in DB
  await resourceStore.updateResourceCaveats(id, caveats);

  // Store on-chain via tx-signer (fire-and-forget with warning on fail)
  const resource = await resourceStore.getResource(id);
  if (resource?.blindedKey) {
    const userSecret = deriveUserSecret(req.anonUser!.nearAccountId);
    const result = await storeResourceCaveatsOnChain(userSecret, resource.blindedKey, caveats);
    if (!result.success) {
      console.warn(`[resources] On-chain caveat update failed: ${result.error}`);
    }
  }

  res.json({ success: true });
});

// GET /api/resources/:id/employment-check
router.get('/:id/employment-check', requireAuth, async (req: Request, res: Response) => {
  // Call check_employment_authorized via RPC (view method — no signing needed)
  const resource = await resourceStore.getResource(req.params.id);
  if (!resource?.blindedKey) return res.status(404).json({ error: 'Resource not found or not registered' });

  const context = {
    requestingAccount: req.anonUser!.nearAccountId,
    locationBounds: req.query.bounds ? JSON.parse(req.query.bounds as string) : null,
    timestampMs: Date.now(),
    roeTierRequired: Number(req.query.roeTier) || 1,
    nationCode: req.query.nationCode as string || null,
  };

  const result = await checkEmploymentAuthViaRPC(resource.blindedKey, context);
  res.json(result);
});
```

### Pattern 5: On-Chain Call Helper in tx-signer.ts (Following storeDIDOnChain pattern)

**What:** New exported functions in `tx-signer.ts` that wrap `signAndSubmitFunctionCall` for the two new contract methods.
**When to use:** From resource-caveat-service or directly from resources.ts.
**Example:**
```typescript
// backend/src/near/tx-signer.ts — add alongside storeDIDOnChain

export async function storeResourceCaveatsOnChain(
  userSecret: Uint8Array,
  blindedKeyHex: string,         // stored as hex string in DB (from resource-did.ts)
  caveats: ResourceCaveats,
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  // blindedKey is stored as hex in DB, convert to byte array for contract
  const blindedKeyBytes = Array.from(Buffer.from(blindedKeyHex, 'hex'));
  const STORAGE_DEPOSIT = BigInt('5000000000000000000000'); // 0.005 NEAR

  return signAndSubmitFunctionCall(
    userSecret,
    DID_CONTRACT_ID,
    'update_resource_caveats',
    {
      blinded_key: blindedKeyBytes,
      caveats: serializeCaveatsForChain(caveats),
    },
    DEFAULT_GAS,
    STORAGE_DEPOSIT,
  );
}

// View method — no signing needed, direct RPC fetch
export async function checkEmploymentAuthViaRPC(
  blindedKeyHex: string,
  context: EmploymentContext,
): Promise<{ authorized: boolean; reasons: string[] }> {
  const blindedKeyBytes = Array.from(Buffer.from(blindedKeyHex, 'hex'));
  const response = await fetch(NEAR_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'employment-check',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: DID_CONTRACT_ID,
        method_name: 'check_employment_authorized',
        args_base64: Buffer.from(JSON.stringify({
          blinded_key: blindedKeyBytes,
          context,
        })).toString('base64'),
      },
    }),
  });
  const result = await response.json() as { result?: { result?: number[] } };
  if (result.result?.result) {
    return JSON.parse(Buffer.from(result.result.result).toString());
  }
  return { authorized: false, reasons: ['RPC call failed'] };
}
```

### Pattern 6: Frontend Security & Caveats Editor Section

**What:** New collapsible section in the existing `ResourceDetailPanel.tsx` shell. Visible to all, editable only by owner/commander/xo (permission checked via API response).
**When to use:** Added as a third section in ResourceDetailPanel after "DID Master Record" and "Local (Problem Set)".
**Example:**
```typescript
// frontend/src/components/resources/ResourceDetailPanel.tsx — new section
function SecurityCaveatsSection({
  resourceId,
  canEdit,
  caveats,
  onSave,
}: {
  resourceId: string;
  canEdit: boolean;
  caveats: ResourceCaveats | null;
  onSave: (caveats: ResourceCaveats) => void;
}) {
  // Uses react-hook-form (already installed)
  // Fields: classification select, releasability multi-select (USA/GBR/AUS/CAN/NZL + custom),
  //         ROE tier select (1-5), time windows (add/remove pairs), geo bounds (lat/lng bounds),
  //         employment constraints (free text tags)
  // Save button disabled if !canEdit
  // Shows on-chain verification badge (timestamp of last on-chain sync)
}
```

### Anti-Patterns to Avoid
- **Using floats in the Rust contract for lat/lng:** NEAR contracts should avoid floating point arithmetic due to determinism concerns. Use integer degrees * 1_000_000 (fixed-point arithmetic).
- **Encrypting caveat fields:** Caveats must be plaintext for the contract's `check_employment_authorized()` enforcement logic to evaluate them without a decryption key.
- **Calling `update_resource_caveats` as the contract admin account for every update:** The signed transaction must come from the resource DID's actual owner account (the signing account derived via `deriveSigningKeyPair(userSecret)`). This is the same pattern as `storeDIDOnChain`.
- **Blocking resource create/update on on-chain failure:** The `storeDIDOnChain` pattern logs a warning and continues if the chain call fails. Apply the same soft-failure pattern to caveat updates — DB is source of truth, chain provides immutable audit.
- **Adding caveats to `store_did()` signature:** The existing `store_did` signature is already complex (5 params). Adding caveats makes it unwieldy. Use a separate `update_resource_caveats()` call immediately after DID registration.
- **Requiring `requireAuth` middleware in resources.ts for read endpoints:** Currently resources.ts has NO auth middleware. Only the new write endpoints (`PATCH /:id/caveats`) need auth. Don't break existing unauthenticated read endpoints.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Contract signing/submission | Custom NEAR tx builder | `signAndSubmitFunctionCall()` in tx-signer.ts | Already handles key derivation, auto-funding, gas, deposits, error handling |
| Role permission checks | Custom permission table | `problemSetMemberStore.getMember()` + role comparison | Established pattern — getMember returns `{role, status}` immediately |
| RPC view calls | Custom fetch wrapper | Pattern from `did-service.ts` `getEncryptedDID()` | Proven base64 args encoding, result decoding, error handling |
| Time window validation | Custom date library | Plain timestamp comparison in Rust (ms since epoch) | No dependency needed; u64 timestamps are sufficient |
| Contract WASM build | Manual rustc | `cargo build --target wasm32-unknown-unknown --release` or `cargo-near build non-reproducible-wasm` | Toolchain already configured, `rust-toolchain.toml` sets correct nightly |
| Contract deployment | Custom deploy script | `near contract deploy` (near-cli-rs 0.22.1) | CLI installed and proven from previous contract deploys |

**Key insight:** Every piece of infrastructure this phase needs (contract call signing, RPC view calls, DB-backed resource store, member role checks, frontend auth) already exists in fully operational form. The work is purely additive extension.

## Common Pitfalls

### Pitfall 1: Borsh Schema Invalidation on Struct Change
**What goes wrong:** Adding fields to an existing `BorshSerialize/Deserialize` struct breaks deserialization of data already stored on-chain. Old entries were serialized without the new field and cannot be deserialized by the new code.
**Why it happens:** Borsh is an ordered binary format — field order is part of the schema. Any addition or reordering breaks existing entries.
**How to avoid:** Use `Option<ResourceCaveats>` as the new field type. Borsh encodes `Option::None` as a single `0u8` prefix byte. Existing entries that were serialized WITHOUT this field will fail to deserialize because there's no prefix byte. The correct approach is to keep `caveats` as a completely new `LookupMap<String, ResourceCaveats>` keyed by `blinded_key_hex`, separate from `DIDEntry`. This avoids touching the existing `DIDEntry` serialization entirely.
**Warning signs:** `PanicOnDefault` on contract state read after upgrade; contract calls panicking on `dids.get()` for old entries.
**Mitigation:** Store caveats in a SEPARATE `LookupMap<String, ResourceCaveats>` with key `caveat_blinded_key_hex`. This is the safest approach — zero impact on existing `DIDEntry` serialization. Add new storage key `Caveats` to `StorageKey` enum.

### Pitfall 2: Coordinate Floats in Rust Contract
**What goes wrong:** Using `f64` for lat/lng in the contract causes compilation warnings or unexpected behavior due to NEAR's determinism requirements and the WASM32 target's float handling.
**Why it happens:** NEAR WASM contracts can technically use floats, but they're discouraged. Fixed-point integers avoid all ambiguity.
**How to avoid:** Use `i64` with degrees multiplied by `1_000_000` (±180° fits in i64). The frontend/backend converts before sending: `lat * 1_000_000` as integer. Document this conversion clearly.
**Warning signs:** Build warnings about float usage; frontend sending `33.4` and getting unexpected comparison results.

### Pitfall 3: Resource Owner Identity Mismatch
**What goes wrong:** The resource's `blinded_key` was stored on-chain by a signing account derived from the backend's system secret + resource ID (the `resource-did.ts` pattern), NOT by the user's personal signing account. So `entry.owner` on-chain is a backend-derived signing account, not the user's account.
**Why it happens:** Phase 27 created resource DIDs using HKDF from the system `ENCRYPTION_KEY`, not from a user secret. This is the opposite of how user DIDs work (which use user-specific secrets via `tx-signer.ts`).
**How to avoid:** For the initial batch of existing resources, the contract admin (set in `admin` field of `DIDRegistry`) must call `update_resource_caveats` since those DIDs were stored under admin-controlled keys. For the permission model, rely entirely on the `problemSetMemberStore` role check (commander/xo) and skip the on-chain ownership check. Document that resource DID ownership on-chain is admin-level, with RBAC enforced at the application layer.
**Warning signs:** "Only the DID owner or admin can update caveats" panic for all resource caveat update attempts if we try to use user signing accounts.

### Pitfall 4: Missing `requireAuth` Import in resources.ts
**What goes wrong:** The existing `resources.ts` does NOT import `requireAuth` — confirmed by inspection. Adding new authenticated endpoints requires importing `requireAuth` from `../auth/auth-instance.js` and using it correctly.
**Why it happens:** Legacy API file created before per-route auth was needed; all resource endpoints are currently open.
**How to avoid:** Add `import { requireAuth } from '../auth/auth-instance.js';` and apply it only to the new caveat write endpoints. Do not retroactively add auth to existing read endpoints to avoid breaking changes.

### Pitfall 5: Contract Upgrade with Existing Testnet State
**What goes wrong:** Deploying a new WASM to an existing testnet contract with incompatible state schema causes all subsequent contract calls to fail with deserialization errors.
**Why it happens:** Contract upgrade replaces the WASM but the state (in `LookupMap`) persists. If `DIDEntry` struct changes, old stored entries can't be read.
**How to avoid:** Use the Separate LookupMap approach (Pitfall 1 mitigation) — new `caveats: LookupMap<String, ResourceCaveats>` never touches existing `DIDEntry` serialization. Alternatively, if the testnet contract has no valuable state, just `near contract delete` and redeploy fresh with `new()` initialization.
**Warning signs:** All `get_did` calls fail with "Failed to deserialize" after contract upgrade.

### Pitfall 6: anonUser Not Set Without Middleware
**What goes wrong:** Adding `requireAuth` to resource endpoints but accessing `req.anonUser!` before verifying the middleware is registered in the route chain.
**Why it happens:** `anonUser` is set by the `@vitalpoint/near-phantom-auth` middleware, which is separate from `requireAuth`. The auth middleware must be registered globally (it is, in `index.ts`) for `requireAuth` to work correctly.
**How to avoid:** Follow the exact pattern from `problem-sets.ts`: `router.patch('/:id/caveats', requireAuth, async (req, res) => { const callerDid = buildDID(req.anonUser!.nearAccountId); ... })`. The `requireAuth` middleware ensures `req.anonUser` is set before the handler runs.

## Code Examples

### Contract: Separate LookupMap for Caveats (Safest Schema Approach)
```rust
// Source: contracts/did-registry/src/lib.rs — modification plan
// SAFE: Adds a new storage map without touching DIDEntry struct

#[derive(BorshStorageKey, BorshDeserialize, BorshSerialize)]
enum StorageKey {
    Dids,
    Caveats,  // NEW: separate map for resource caveats
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DIDRegistry {
    dids: LookupMap<String, DIDEntry>,        // UNCHANGED
    caveats: LookupMap<String, ResourceCaveats>,  // NEW
    admin: AccountId,
    paused: bool,
}

// update_resource_caveats writes to self.caveats, not self.dids
// check_employment_authorized reads from self.caveats
// get_caveats(blinded_key) is a new view method
```

### Backend: deriveUserSecret Pattern (from problem-sets.ts)
```typescript
// Source: backend/src/api/problem-sets.ts lines 129-135
// Used in resources.ts caveat endpoints to get userSecret for tx-signer
function deriveUserSecret(accountId: string): Uint8Array {
  const seed = process.env.DID_SECRET_SEED || 'dev-secret-seed';
  const encoder = new TextEncoder();
  const combined = encoder.encode(`${seed}:${accountId}`);
  return sha256(combined); // @noble/hashes sha256
}
```

### Backend: View RPC Call Pattern (from did-service.ts)
```typescript
// Source: backend/src/identity/did-service.ts lines 136-176
// Pattern for calling check_employment_authorized (view method, no signing)
const response = await fetch(NEAR_RPC_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 'dontcare',
    method: 'query',
    params: {
      request_type: 'call_function',
      finality: 'final',
      account_id: DID_CONTRACT_ID,
      method_name: 'check_employment_authorized',
      args_base64: Buffer.from(JSON.stringify({ blinded_key, context })).toString('base64'),
    },
  }),
});
const result = await response.json();
const decoded = JSON.parse(Buffer.from(result.result.result).toString());
```

### Database Migration for Caveats
```sql
-- backend/src/db/migrations/046-resource-caveats.sql
-- Add caveat fields to resources table (DB is source of truth; chain is audit layer)
ALTER TABLE resources
  ADD COLUMN IF NOT EXISTS caveat_classification TEXT,
  ADD COLUMN IF NOT EXISTS caveat_releasability TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS caveat_geo_bounds JSONB,
  ADD COLUMN IF NOT EXISTS caveat_roe_tier SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS caveat_time_windows JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS caveat_employment_constraints TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS caveat_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS caveat_on_chain_synced_at TIMESTAMPTZ;

-- Index for ROE tier queries
CREATE INDEX IF NOT EXISTS idx_resource_caveat_roe_tier ON resources(caveat_roe_tier);
-- Index for classification queries
CREATE INDEX IF NOT EXISTS idx_resource_caveat_classification ON resources(caveat_classification);
```

### Contract Deployment Commands
```bash
# Build WASM (from contracts/did-registry directory)
cargo build --target wasm32-unknown-unknown --release

# Or using cargo-near (from near-contracts/build.sh pattern):
cargo near build non-reproducible-wasm --no-wasmopt

# Deploy to testnet (near-cli-rs syntax)
# If contract already exists with valuable state — just upgrade the WASM:
near contract deploy \
  use-file ./target/wasm32-unknown-unknown/release/did_registry.wasm \
  without-init-call \
  network-config testnet \
  sign-with-keychain \
  send

# If contract is fresh or state can be wiped (clean deploy):
near contract deploy \
  use-file ./target/wasm32-unknown-unknown/release/did_registry.wasm \
  with-init-call new \
  json-args '{"admin": "YOUR_ADMIN_ACCOUNT.testnet"}' \
  prepaid-gas '100.0 Tgas' \
  attached-deposit '0 NEAR' \
  network-config testnet \
  sign-with-keychain \
  send
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| DID registry stores only encrypted documents | DID registry stores both encrypted docs AND structured plaintext caveats | This phase | Blockchain becomes the authoritative policy enforcement layer |
| ROE enforcement only in backend (json-rules-engine) | ROE tier also enforced at contract level via `check_employment_authorized()` | This phase | Immutable, auditable constraint enforcement independent of backend |
| Resource employment authorization is implied | Resource employment authorization is explicit, queryable, and on-chain | This phase | Demo story: "blockchain is single source of truth for how resources can be employed" |
| ResourceDetailPanel is a placeholder shell | ResourceDetailPanel has live data + Security & Caveats editor | This phase | Completes the resource detail UX started in Phase 42 |

**Important note on NEAR contract upgrade:**
- near-cli-rs 0.22.1 (installed) uses a different CLI syntax than the older near-cli (JS). Commands use subcommand chains like `near contract deploy use-file ... network-config testnet sign-with-keychain send` rather than `near deploy --wasmFile ... --accountId ...`.

## Open Questions

1. **On-Chain Resource DID Ownership: Admin vs. User Account**
   - What we know: Phase 27 resource DIDs were created via `resource-did.ts` using system HKDF (not user-specific secrets). The on-chain `entry.owner` for resource DIDs would be whatever account the backend signed with — likely the admin/funder account or a backend signing account.
   - What's unclear: Were resource DIDs actually pushed on-chain in Phase 27, or were they only stored in the DB? The current `resource-registry.ts` generates DIDs locally and stores them in PostgreSQL; it does NOT call `storeDIDOnChain`. The contract call was never wired for resource DIDs.
   - Recommendation: Phase 58 is likely the FIRST time resource DIDs actually go on-chain. This is "on-chain resource DID registration" — the migration task. Use the contract admin account to both register DIDs and set caveats for existing resources. For new resource registrations going forward, use the problem set commander's signing account.

2. **Caveat Classification Encoding**
   - What we know: `classification` is a string field in the proposed schema
   - What's unclear: Should it use a fixed enum (matching `personnel.clearanceLevel`: "UNCLASS" | "SECRET" | "TOPSECRET") or be free-form text?
   - Recommendation: Mirror the `clearanceLevel` enum already in `types.ts` for consistency: `"UNCLASSIFIED" | "SECRET" | "TOPSECRET" | "TS_SCI"`. Use a string on-chain (contracts don't benefit from enums) but validate at the backend API layer with zod.

3. **Migration of Existing Resources to On-Chain DIDs**
   - What we know: ~N existing resources have DIDs in PostgreSQL but are NOT on-chain. Phase 58 goal includes "migrate existing resources on-chain".
   - What's unclear: Scale of existing resources in testnet DB; whether admin signing account is configured and funded.
   - Recommendation: Create a one-time migration script (`scripts/migrate-resources-to-chain.ts`) that iterates all resources with DIDs, calls `store_did` + `update_resource_caveats` using the contract admin account. This is a manual migration step, not automatic startup migration, to avoid production risk.

## Validation Architecture

> nyquist_validation key is absent from .planning/config.json — treating as enabled.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Rust built-in tests (`#[cfg(test)]` + `near-sdk::test_utils`) |
| Config file | No separate config — `cargo test` within `contracts/did-registry/` |
| Quick run command | `cd contracts/did-registry && cargo test 2>&1` |
| Full suite command | `cd contracts/did-registry && cargo test -- --nocapture 2>&1` |
| Backend integration tests | Manual via curl/Postman against local backend |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-58-01 | `check_employment_authorized` returns authorized=true when no caveats | unit | `cd contracts/did-registry && cargo test test_check_employment_no_caveats` | Wave 0 |
| REQ-58-01 | `check_employment_authorized` returns authorized=false when ROE tier exceeded | unit | `cd contracts/did-registry && cargo test test_check_employment_roe_tier_exceeded` | Wave 0 |
| REQ-58-01 | `check_employment_authorized` returns authorized=false when time window outside | unit | `cd contracts/did-registry && cargo test test_check_employment_time_window` | Wave 0 |
| REQ-58-01 | `check_employment_authorized` returns authorized=false for wrong nation | unit | `cd contracts/did-registry && cargo test test_check_employment_releasability` | Wave 0 |
| REQ-58-02 | Non-owner cannot update caveats | unit | `cd contracts/did-registry && cargo test test_update_caveats_unauthorized` | Wave 0 |
| REQ-58-02 | Admin can update caveats for any DID | unit | `cd contracts/did-registry && cargo test test_update_caveats_admin` | Wave 0 |
| REQ-58-03 | `update_resource_caveats` stores caveats retrievable by `get_caveats` | unit | `cd contracts/did-registry && cargo test test_store_and_retrieve_caveats` | Wave 0 |
| REQ-58-03 | Existing DID entries unaffected after contract upgrade | unit | `cd contracts/did-registry && cargo test test_existing_did_unaffected` | Wave 0 |
| REQ-58-04 | ResourceDetailPanel renders Security & Caveats section | manual | Visual inspection in browser | N/A |
| REQ-58-05 | Contract deployed to testnet and `get_caveats` returns data | smoke | `near contract call-function as-read-only did-registry.testnet get_caveats ...` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd /home/vitalpointai/projects/ssr/contracts/did-registry && cargo test 2>&1`
- **Per wave merge:** Full Rust test suite + manual browser check of ResourceDetailPanel
- **Phase gate:** All Rust unit tests green + successful testnet deployment verified via RPC call

### Wave 0 Gaps
- [ ] `contracts/did-registry/src/lib.rs` tests — add `test_check_employment_*`, `test_update_caveats_*`, `test_store_and_retrieve_caveats`, `test_existing_did_unaffected` to the existing `#[cfg(test)]` block
- [ ] Smoke test script: `scripts/test-caveat-enforcement.sh` — calls `check_employment_authorized` via RPC against testnet

## Sources

### Primary (HIGH confidence)
- `contracts/did-registry/src/lib.rs` — Current DIDEntry struct, contract methods, storage keys, test patterns
- `backend/src/near/tx-signer.ts` — signAndSubmitFunctionCall, storeDIDOnChain, anchorCredentialOnChain patterns
- `backend/src/identity/did-service.ts` — RPC view call pattern (getEncryptedDID, checkDIDActive)
- `backend/src/resources/types.ts` — Current Resource type with DID fields
- `backend/src/resources/resource-registry.ts` — ResourceRegistry singleton, DB-backed cache
- `backend/src/resources/resource-did.ts` — Resource DID creation (system HKDF, NOT user-specific)
- `backend/src/api/problem-sets.ts` — requireCommanderOrXo pattern, anonUser usage, signAndSubmitFunctionCall usage
- `backend/src/api/resources.ts` — Current resource API routes (no auth middleware — confirmed by inspection)
- `frontend/src/components/resources/ResourceDetailPanel.tsx` — Current placeholder shell structure
- `contracts/did-registry/Cargo.toml` — near-sdk 5.6.0, borsh 1.0, schemars 0.8
- `backend/package.json` — @near-js/* 2.5.1, confirmed versions
- System: `near-cli-rs 0.22.1`, `cargo-near` installed, `cargo 1.92.0`
- `.env.example` — DID_CONTRACT_ID, DID_SECRET_SEED, NEAR_RPC patterns

### Secondary (MEDIUM confidence)
- NEAR SDK 5.6.0 docs — LookupMap separate storage key pattern for schema evolution
- near-cli-rs 0.22.1 command syntax — `near contract deploy use-file ... network-config testnet sign-with-keychain send`

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Contract extension approach: HIGH — current contract code inspected directly; Borsh schema pitfall is well-documented NEAR pattern
- Backend patterns: HIGH — tx-signer.ts, did-service.ts, problem-sets.ts all inspected directly
- Frontend patterns: HIGH — ResourceDetailPanel inspected, confirmed as placeholder shell
- Contract deployment: MEDIUM — near-cli-rs 0.22.1 syntax verified from installed binary; `--version` confirms it's the newer Rust CLI, not the older JS CLI
- Resource DID on-chain status: MEDIUM — resource-registry.ts inspected; `store_did` is NOT called for resource DIDs in Phase 27 code, but confirming zero on-chain resource DIDs would require a live RPC call

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable NEAR SDK, internal patterns)
