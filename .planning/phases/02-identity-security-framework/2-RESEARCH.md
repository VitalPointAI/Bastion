# Phase 2: Identity & Security Framework - Research

**Researched:** 2026-01-14
**Domain:** Decentralized Identity (DIDs), ABAC, Post-Quantum Cryptography, Zero Trust Architecture
**Confidence:** HIGH

<research_summary>
## Summary

Researched the complete ecosystem for implementing a comprehensive identity and security framework on NEAR Protocol. The standard approach uses NEAR's native DID support (`did:near` method) with on-chain smart contract registry, Casbin for ABAC policy enforcement, @noble/post-quantum for post-quantum cryptography, and Veramo as the verifiable credentials framework.

Key finding: NEAR Protocol has mature DID support via the Ontology-developed `did:near` specification with an on-chain registry smart contract. The idOS (Identity Operating System) provides production-ready KYC and identity reuse, but for military-grade identity with classification handling, a custom DID registry with ABAC integration is needed.

Post-quantum cryptography libraries are production-ready in TypeScript (@noble/post-quantum), but have not undergone independent security audits. For classified data protection, this should be paired with traditional crypto in hybrid mode until audits complete.

**Primary recommendation:** Build custom NEAR DID registry smart contract following Ontology's `did:near` specification, integrate Casbin for ABAC policy enforcement in backend, use @noble/post-quantum in hybrid mode (ML-KEM-768 + X25519) for key encapsulation, and Veramo for W3C verifiable credentials with custom `did:near` resolver.
</research_summary>

<standard_stack>
## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@near-js/*` | Latest | NEAR Protocol SDK (modular) | Official NEAR SDK, split modules |
| `near-sdk-rs` | 5.x | Rust smart contract SDK | Official NEAR Rust SDK, MSRV 1.85 |
| `casbin` | 5.x | ABAC Policy Engine | Battle-tested, supports ACL/RBAC/ABAC |
| `@noble/post-quantum` | 0.5.x | Post-quantum cryptography | Auditable, ML-KEM + ML-DSA, pure TypeScript |
| `@veramo/core` | 6.x | Verifiable credentials framework | W3C compliant, extensible plugins |
| `crypto-js` | 4.x | SHA-256 hashing for VCs | Credential hashing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@veramo/did-manager` | 6.x | DID lifecycle management | Creating/managing DIDs |
| `@veramo/credential-w3c` | 6.x | W3C VC issuance/verification | Credential operations |
| `@veramo/key-manager` | 6.x | Cryptographic key management | Signing operations |
| `@noble/ciphers` | 1.x | ChaCha20-Poly1305 encryption | Data encryption (already in Phase 1) |
| `@noble/curves` | 1.x | Ed25519/secp256k1 | Classical signature verification |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Casbin | OPA (Open Policy Agent) | OPA more powerful but heavier, Casbin simpler for Node.js |
| @noble/post-quantum | crystals-kyber + dilithium-crystals-js | Noble has unified API, better maintained |
| Custom DID registry | NEAR idOS | idOS focused on KYC, custom registry needed for entity types beyond users |
| Veramo | @digitalbazaar/vc | Veramo more modular, better TypeScript support |

**Installation:**
```bash
# Backend ABAC
pnpm add casbin

# Post-quantum crypto
pnpm add @noble/post-quantum

# Verifiable credentials
pnpm add @veramo/core @veramo/did-manager @veramo/did-resolver @veramo/credential-w3c @veramo/key-manager @veramo/kms-local

# Rust smart contract
# Add to Cargo.toml: near-sdk = "5.x"
```
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Recommended Project Structure
```
backend/
├── src/
│   ├── identity/           # DID management
│   │   ├── did-resolver.ts     # did:near resolution
│   │   ├── did-registry.ts     # Smart contract interface
│   │   └── veramo-agent.ts     # Veramo agent setup
│   ├── security/           # Access control
│   │   ├── abac-enforcer.ts    # Casbin policy enforcement
│   │   ├── policy-loader.ts    # Policy file loading
│   │   └── attribute-provider.ts # DID attribute fetching
│   ├── crypto/             # Post-quantum crypto
│   │   ├── pq-kem.ts           # ML-KEM key encapsulation
│   │   ├── pq-signatures.ts    # ML-DSA signatures
│   │   └── hybrid-crypto.ts    # PQ + classical hybrid
│   └── auth/               # Authentication
│       ├── privy-adapter.ts    # Privy → DID mapping
│       └── cac-piv.ts          # CAC/PIV cert extraction

near-contracts/
├── src/
│   ├── did_registry.rs     # DID document storage/CRUD
│   ├── credential_registry.rs  # VC hash storage
│   └── abac_policy.rs      # On-chain policy anchoring
```

### Pattern 1: DID Resolution with did:near
**What:** Resolve NEAR DIDs to DID documents following W3C spec
**When to use:** Any identity verification, attribute lookup, credential verification
**Example:**
```typescript
// Source: NEAR DID documentation + Ontology spec
import { NearDidResolver } from './did-resolver';

interface NearDIDDocument {
  '@context': string[];
  id: string;                    // did:near:alice.near
  publicKey: Array<{
    id: string;
    type: string;                // EcdsaSecp256k1VerificationKey2019
    controller: string;
    publicKeyBase58: string;
  }>;
  authentication: string[];
}

class NearDidResolver {
  constructor(private rpcUrl: string) {}

  async resolveDID(did: string): Promise<NearDIDDocument> {
    // Parse did:near:account.near
    const [, method, account] = did.split(':');
    if (method !== 'near') throw new Error('Invalid DID method');

    // Call smart contract get_document method
    const response = await this.nearRpc.callFunction({
      contractId: 'did-registry.near',
      methodName: 'get_document',
      args: { did }
    });

    return JSON.parse(Buffer.from(response.result).toString());
  }
}
```

### Pattern 2: ABAC with Casbin
**What:** Policy-based access control using subject attributes from DIDs
**When to use:** Every data access decision based on classification, role, nationality
**Example:**
```typescript
// Source: Casbin documentation
import { newEnforcer, Enforcer } from 'casbin';

// Model file (abac_model.conf)
const MODEL = `
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub_rule, obj_rule, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = eval(p.sub_rule) && eval(p.obj_rule) && r.act == p.act
`;

// Policy file (policy.csv)
// p, r.sub.clearance >= 3, r.obj.classification <= 3, read
// p, r.sub.nationality == "US", r.obj.releasability contains "US", read

async function createEnforcer(): Promise<Enforcer> {
  const enforcer = await newEnforcer('./abac_model.conf', './policy.csv');
  return enforcer;
}

async function checkAccess(
  subject: { clearance: number; nationality: string; role: string },
  object: { classification: number; releasability: string[] },
  action: string
): Promise<boolean> {
  const enforcer = await createEnforcer();
  return enforcer.enforce(subject, object, action);
}
```

### Pattern 3: Post-Quantum Hybrid Key Exchange
**What:** Use ML-KEM (Kyber) + X25519 hybrid for quantum-resistant key agreement
**When to use:** All key exchanges for classified data protection
**Example:**
```typescript
// Source: @noble/post-quantum documentation
import { ml_kem768_x25519 } from '@noble/post-quantum/hybrid';

// Key generation (done once per entity)
const aliceKeys = ml_kem768_x25519.keygen();

// Encapsulation (sender creates shared secret)
const { cipherText, sharedSecret: senderSecret } =
  ml_kem768_x25519.encapsulate(aliceKeys.publicKey);

// Decapsulation (receiver extracts shared secret)
const receiverSecret = ml_kem768_x25519.decapsulate(
  cipherText,
  aliceKeys.secretKey
);

// senderSecret === receiverSecret (use for symmetric encryption)
```

### Pattern 4: Verifiable Credential Issuance with Veramo
**What:** Issue and verify W3C verifiable credentials tied to NEAR DIDs
**When to use:** Clearance credentials, role attestations, entity registrations
**Example:**
```typescript
// Source: Veramo documentation
import { createAgent, ICredentialPlugin, IDIDManager, IKeyManager } from '@veramo/core';
import { CredentialPlugin } from '@veramo/credential-w3c';

const agent = createAgent<ICredentialPlugin & IDIDManager & IKeyManager>({
  plugins: [
    new CredentialPlugin(),
    // ... other plugins
  ],
});

// Issue a clearance credential
const credential = await agent.createVerifiableCredential({
  credential: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'SecurityClearanceCredential'],
    issuer: 'did:near:security-office.near',
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: 'did:near:alice.near',
      clearanceLevel: 'SECRET',
      nationality: 'US',
      expirationDate: '2027-01-01'
    }
  },
  proofFormat: 'jwt'
});
```

### Pattern 5: DID Registry Smart Contract (Rust)
**What:** On-chain DID document storage following did:near specification
**When to use:** Core identity infrastructure
**Example:**
```rust
// Source: Ontology DID-spec-near + NEAR SDK patterns
use near_sdk::{near, AccountId, PanicOnDefault, env};
use near_sdk::store::LookupMap;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct DIDRegistry {
    documents: LookupMap<String, DIDDocument>,
    owner_to_did: LookupMap<AccountId, String>,
}

#[derive(Clone, BorshSerialize, BorshDeserialize)]
pub struct DIDDocument {
    pub context: Vec<String>,
    pub id: String,
    pub public_keys: Vec<PublicKeyEntry>,
    pub authentication: Vec<String>,
    pub controllers: Vec<String>,
    pub active: bool,
}

#[near]
impl DIDRegistry {
    #[init]
    pub fn new() -> Self {
        Self {
            documents: LookupMap::new(b"d"),
            owner_to_did: LookupMap::new(b"o"),
        }
    }

    pub fn reg_did_using_account(&mut self) -> String {
        let account_id = env::predecessor_account_id();
        let did = format!("did:near:{}", account_id);

        assert!(
            !self.documents.contains_key(&did),
            "DID already registered"
        );

        let public_key = env::signer_account_pk();
        let doc = DIDDocument {
            context: vec!["https://www.w3.org/ns/did/v1".to_string()],
            id: did.clone(),
            public_keys: vec![PublicKeyEntry {
                id: format!("{}#key-1", did),
                key_type: "Ed25519VerificationKey2020".to_string(),
                controller: did.clone(),
                public_key_base58: bs58::encode(public_key).into_string(),
            }],
            authentication: vec![format!("{}#key-1", did)],
            controllers: vec![did.clone()],
            active: true,
        };

        self.documents.insert(did.clone(), doc);
        self.owner_to_did.insert(account_id, did.clone());

        did
    }

    pub fn get_document(&self, did: String) -> Option<DIDDocument> {
        self.documents.get(&did).cloned()
    }

    pub fn deactivate_did(&mut self, did: String) {
        let account_id = env::predecessor_account_id();
        let owner_did = self.owner_to_did.get(&account_id);

        assert!(
            owner_did == Some(&did),
            "Not authorized to deactivate this DID"
        );

        if let Some(doc) = self.documents.get_mut(&did) {
            doc.active = false;
        }
    }
}
```

### Anti-Patterns to Avoid
- **Storing personal data in DID documents:** DID documents should only contain verification methods and service endpoints, never PII
- **Single-source DID resolution:** Always query multiple NEAR nodes and compare results for security
- **Classical-only key exchange:** For long-term classified data, always use hybrid PQ+classical
- **Hardcoded policies:** Use externalized policy files that can be updated without code changes
- **Monolithic identity service:** Separate DID resolution, credential management, and ABAC into distinct services
</architecture_patterns>

<dont_hand_roll>
## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| DID resolution | Custom DID parsing | Veramo DIDResolver | Edge cases in DID syntax, caching, multi-method support |
| Policy evaluation | Custom if/else chains | Casbin enforcer | Policy language, conflict resolution, audit logging |
| Post-quantum signatures | Custom lattice math | @noble/post-quantum | Cryptographic implementation requires expert review |
| Credential schemas | Ad-hoc JSON | W3C VC Data Model 2.0 | Interoperability, standardized verification |
| Key derivation | Custom HKDF | @noble/hashes | Side-channel resistance, constant-time operations |
| Smart card auth | Custom PKCS#11 | Browser SSL client auth | Complex hardware abstraction, already in TLS stack |

**Key insight:** Identity and cryptography have decades of standardization work. The W3C DID 1.0 spec (2022), W3C VC 2.0 (2025), and NIST FIPS 203/204 (2024) represent years of expert review. Custom implementations introduce subtle vulnerabilities that only surface under adversarial conditions.
</dont_hand_roll>

<common_pitfalls>
## Common Pitfalls

### Pitfall 1: DID Deactivation Without Recovery
**What goes wrong:** User loses access to deactivated DID and all associated credentials
**Why it happens:** NEAR did:near spec doesn't allow reactivation once deactivated
**How to avoid:** Implement soft-delete with time-locked reactivation window; use controller delegation for recovery keys
**Warning signs:** Support requests for "lost" DIDs, users creating duplicate identities

### Pitfall 2: ABAC Policy Explosion
**What goes wrong:** Thousands of policy rules become unmanageable
**Why it happens:** Creating rules for every subject-object combination instead of attribute-based patterns
**How to avoid:** Use attribute expressions (e.g., `r.sub.clearance >= r.obj.classification`) instead of enumerated rules; organize policies by domain
**Warning signs:** Policy files exceeding 1000 lines, frequent policy update requests

### Pitfall 3: Post-Quantum Key Size Surprise
**What goes wrong:** Storage/bandwidth issues with PQ keys
**Why it happens:** ML-KEM-768 public keys are 1,184 bytes (vs 32 bytes for X25519)
**How to avoid:** Plan for ~40x larger key storage; use hybrid modes; cache public keys aggressively
**Warning signs:** Slow key exchange, database bloat, network timeouts

### Pitfall 4: Credential Revocation Lag
**What goes wrong:** Revoked credentials accepted during check delay
**Why it happens:** On-chain revocation takes ~1 second, clients cache credential status
**How to avoid:** Implement credential status list (W3C BitstringStatusListCredential); short cache TTLs for sensitive operations; require fresh status check for high-security actions
**Warning signs:** "Zombie" access after clearance revocation, audit findings

### Pitfall 5: CAC/PIV Certificate Extraction Complexity
**What goes wrong:** Cannot reliably extract user identity from smart card
**Why it happens:** PIV certificate structure varies by issuing agency; multiple certificates on card
**How to avoid:** Use SSL/TLS client auth at reverse proxy layer (nginx); extract identity from verified certificate DN in backend; map to DID via lookup table
**Warning signs:** "Works on my card" bugs, authentication failures for specific agencies

### Pitfall 6: Classification Label Granularity
**What goes wrong:** Over-classification or access denials due to missing caveats
**Why it happens:** Treating classification as simple hierarchy (TS > S > C) without caveats
**How to avoid:** Model full label: `{ classification: "SECRET", codewords: [], releasability: ["USA", "FVEY"], dissemination: ["NOFORN"] }`; implement caveat intersection logic
**Warning signs:** Users requesting classification downgrades, coalition access issues
</common_pitfalls>

<code_examples>
## Code Examples

Verified patterns from official sources:

### ABAC Policy Model for Military Classification
```conf
# Source: Casbin ABAC documentation + military classification patterns
# File: abac_model.conf

[request_definition]
r = sub, obj, act

[policy_definition]
p = sub_rule, obj_rule, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = eval(p.sub_rule) && eval(p.obj_rule) && r.act == p.act
```

```csv
# File: security_policy.csv
# Classification hierarchy: 1=UNCLASS, 2=CUI, 3=CONFIDENTIAL, 4=SECRET, 5=TOPSECRET

# Rule: Subject clearance >= Object classification
p, r.sub.clearance >= r.obj.classification, true, read

# Rule: Nationality must be in releasability list
p, r.sub.clearance >= r.obj.classification, r.obj.releasability.includes(r.sub.nationality), read

# Rule: No NOFORN access for non-US
p, r.sub.clearance >= r.obj.classification && r.sub.nationality == "US", r.obj.dissemination.includes("NOFORN"), read
```

### Universal DID Creation (for all entity types)
```typescript
// Source: Ontology DID-spec-near + project context requirements
interface EntityDID {
  type: 'human' | 'ai_agent' | 'vehicle' | 'mission' | 'data_object' | 'organization' | 'resource';
  accountId: string;
  attributes: Record<string, unknown>;
}

async function createEntityDID(entity: EntityDID): Promise<string> {
  const { wallet } = await getWallet();

  // All entities get DIDs through same registry
  const did = await wallet.callMethod({
    contractId: 'did-registry.near',
    method: 'reg_did_using_account',
    args: {}
  });

  // Store entity-specific attributes as verifiable credential
  const attributeVC = await agent.createVerifiableCredential({
    credential: {
      '@context': ['https://www.w3.org/2018/credentials/v1', 'https://bastion.mil/credentials/v1'],
      type: ['VerifiableCredential', `${entity.type}AttributeCredential`],
      issuer: 'did:near:bastion-system.near',
      credentialSubject: {
        id: did,
        entityType: entity.type,
        ...entity.attributes
      }
    },
    proofFormat: 'jwt'
  });

  // Anchor credential hash on-chain
  const credentialHash = SHA256(JSON.stringify(attributeVC)).toString(CryptoJS.enc.Base64);
  await wallet.callMethod({
    contractId: 'credential-registry.near',
    method: 'anchor_credential',
    args: { did, credentialHash }
  });

  return did;
}
```

### ML-DSA Signature for Credentials
```typescript
// Source: @noble/post-quantum documentation
import { ml_dsa65 } from '@noble/post-quantum/ml-dsa';
import { bytesToHex, hexToBytes } from '@noble/post-quantum/utils';

// Generate PQ signing keys (store securely!)
function generatePQSigningKeys() {
  const keys = ml_dsa65.keygen();
  return {
    publicKey: bytesToHex(keys.publicKey),
    secretKey: bytesToHex(keys.secretKey)  // 4,032 bytes for ML-DSA-65
  };
}

// Sign a credential with ML-DSA
function signCredentialPQ(credential: object, secretKeyHex: string): string {
  const message = new TextEncoder().encode(JSON.stringify(credential));
  const secretKey = hexToBytes(secretKeyHex);
  const signature = ml_dsa65.sign(message, secretKey);
  return bytesToHex(signature);  // ~3,309 bytes for ML-DSA-65
}

// Verify PQ signature
function verifySignaturePQ(
  credential: object,
  signatureHex: string,
  publicKeyHex: string
): boolean {
  const message = new TextEncoder().encode(JSON.stringify(credential));
  const signature = hexToBytes(signatureHex);
  const publicKey = hexToBytes(publicKeyHex);
  return ml_dsa65.verify(signature, message, publicKey);
}
```

### Zero Trust Request Validation Middleware
```typescript
// Source: Zero trust Node.js patterns
import { Enforcer } from 'casbin';

interface ZeroTrustContext {
  did: string;
  attributes: SubjectAttributes;
  requestTime: number;
  deviceFingerprint: string;
  geolocation?: { lat: number; lon: number };
}

async function zeroTrustMiddleware(
  enforcer: Enforcer,
  didResolver: NearDidResolver
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Extract identity from request (JWT, mTLS cert, etc.)
    const identityToken = req.headers.authorization?.split(' ')[1];
    if (!identityToken) {
      return res.status(401).json({ error: 'No identity token' });
    }

    // 2. Resolve DID and fetch current attributes
    const did = extractDIDFromToken(identityToken);
    const didDoc = await didResolver.resolveDID(did);

    // 3. Fetch subject attributes from verifiable credentials
    const attributes = await fetchSubjectAttributes(did);

    // 4. Validate token signature against DID document keys
    const isValidSignature = await verifyTokenSignature(
      identityToken,
      didDoc.publicKey
    );
    if (!isValidSignature) {
      return res.status(401).json({ error: 'Invalid token signature' });
    }

    // 5. Check ABAC policy for this request
    const resource = extractResourceFromPath(req.path);
    const action = req.method.toLowerCase();
    const resourceAttributes = await fetchResourceAttributes(resource);

    const allowed = await enforcer.enforce(attributes, resourceAttributes, action);
    if (!allowed) {
      return res.status(403).json({ error: 'Access denied by policy' });
    }

    // 6. Attach validated context for downstream use
    req.zeroTrust = {
      did,
      attributes,
      requestTime: Date.now(),
      deviceFingerprint: req.headers['x-device-fingerprint'] as string
    };

    next();
  };
}
```
</code_examples>

<sota_updates>
## State of the Art (2024-2026)

What's changed recently:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| near-api-js monolith | @near-js/* modular packages | 2024 | Use split packages for smaller bundles |
| W3C VC 1.1 | W3C VC 2.0 Recommendation | May 2025 | New proof formats, status list, securing mechanisms |
| CRYSTALS-Kyber draft | ML-KEM (FIPS 203) | Aug 2024 | NIST standardized, use ml_kem* names |
| CRYSTALS-Dilithium draft | ML-DSA (FIPS 204) | Aug 2024 | NIST standardized, use ml_dsa* names |
| Classical crypto only | Hybrid PQ required by 2030 (AUS) / 2035 (NIST) | 2024 | Plan for PQ migration now |
| NEAR DID via Ceramic | Native did:near method | 2024-2025 | Simpler, no external dependencies |

**New tools/patterns to consider:**
- **NEAR Name Tokens:** Multichain identity (`name*near`) for cross-chain operations
- **idOS on NEAR:** Reusable KYC credentials, but limited to identity verification use case
- **XWing hybrid:** ML-KEM-768 + X25519 combined mode for balanced security
- **BitstringStatusListCredential:** W3C standard for efficient credential revocation

**Deprecated/outdated:**
- **near-api-js:** Deprecated, use @near-js/* modules
- **CRYSTALS-Kyber/Dilithium names:** Use ML-KEM/ML-DSA per FIPS standards
- **W3C VC 1.0:** Superseded by 2.0, though 1.0 still supported
- **Classical-only key exchange:** Not recommended for classified data with >10 year lifetime
</sota_updates>

<open_questions>
## Open Questions

Things that couldn't be fully resolved:

1. **@noble/post-quantum Security Audit Status**
   - What we know: Library is "auditable" with transparent builds, but no independent audit
   - What's unclear: Timeline for formal security audit
   - Recommendation: Use hybrid modes (PQ + classical) until audit completes; monitor project for audit announcements

2. **NEAR DID Registry Smart Contract Reference Implementation**
   - What we know: Ontology spec exists, walt.id partnership mentioned
   - What's unclear: No public reference implementation found on NEAR mainnet
   - Recommendation: Build custom registry following Ontology spec; consider contributing upstream

3. **CAC/PIV JavaScript Integration**
   - What we know: Browser handles smart card via TLS client auth; no JS API
   - What's unclear: How to extract specific certificate fields (clearance, agency) programmatically
   - Recommendation: Configure nginx for client cert auth; parse certificate DN in backend; map to DID attributes

4. **Casbin Performance at Scale**
   - What we know: Works well for typical web apps
   - What's unclear: Performance with 10K+ policies and 100K+ subjects
   - Recommendation: Benchmark with realistic policy set; consider policy caching and sharding if needed
</open_questions>

<sources>
## Sources

### Primary (HIGH confidence)
- [NEAR DID Documentation](https://docs.near.org/primitives/did) - Official NEAR DID support
- [Ontology DID-spec-near](https://github.com/ontology-tech/DID-spec-near/blob/master/NEAR/DID-Method-NEAR.md) - did:near method specification
- [@noble/post-quantum](https://github.com/paulmillr/noble-post-quantum) - ML-KEM, ML-DSA implementation
- [Casbin Documentation](https://www.casbin.org/docs/overview/) - ABAC policy engine
- [Veramo Framework](https://veramo.io/docs/veramo_agent/introduction/) - W3C VC implementation
- [W3C DID Core 1.0](https://www.w3.org/TR/did-core/) - DID specification
- [W3C VC 2.0](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/) - Verifiable credentials standard

### Secondary (MEDIUM confidence)
- [NEAR idOS Developer Guide](https://pages.near.org/blog/unlocking-the-future-of-defi-with-the-idos-on-near-a-developers-guide/) - idOS integration patterns
- [Zero Trust in Node.js](https://dev.to/mehul_budasana/how-to-implement-zero-trust-authentication-in-your-nodejs-applications-3c4a) - Implementation patterns
- [ABAC Blockchain Patterns](https://www.mdpi.com/2071-1050/13/19/10556) - Smart contract ABAC research

### Tertiary (LOW confidence - needs validation)
- NEAR Name Tokens launch announcement - Cross-chain identity claims need verification
- idOS GDPR compliance claims - Requires legal review for military context
</sources>

<metadata>
## Metadata

**Research scope:**
- Core technology: NEAR Protocol DIDs, W3C Verifiable Credentials
- Ecosystem: Casbin, Veramo, @noble/post-quantum, idOS
- Patterns: did:near resolution, ABAC policy enforcement, PQ key exchange, zero trust
- Pitfalls: DID deactivation, policy explosion, PQ key sizes, CAC/PIV integration

**Confidence breakdown:**
- Standard stack: HIGH - Official NEAR docs, W3C standards, established libraries
- Architecture: HIGH - Based on Ontology spec, Casbin docs, Veramo patterns
- Pitfalls: MEDIUM - Based on general DID/ABAC experience, not NEAR-specific production use
- Code examples: HIGH - From official documentation and project context

**Research date:** 2026-01-14
**Valid until:** 2026-02-14 (30 days - identity ecosystem evolving but core standards stable)
</metadata>

---

*Phase: 02-identity-security-framework*
*Research completed: 2026-01-14*
*Ready for planning: yes*
