---
phase: 02-identity-security-framework
plan: 04
type: tdd
---

<objective>
Implement ABAC (Attribute-Based Access Control) policy engine using Casbin with military classification model.

Purpose: Enable fine-grained access control based on subject attributes (clearance, nationality, role, caveats) and object attributes (classification, releasability, dissemination controls) following military security patterns.

Output: Working ABAC enforcer with comprehensive policy model supporting classification hierarchies, coalition caveats, and nation-specific restrictions.
</objective>

<execution_context>
~/.claude/get-shit-done/workflows/execute-phase.md
~/.claude/get-shit-done/templates/summary.md
~/.claude/get-shit-done/references/tdd.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/02-identity-security-framework/2-RESEARCH.md
@.planning/phases/02-identity-security-framework/2-CONTEXT.md
@backend/src/index.ts

**Tech stack available:** Node.js, Express, TypeScript
**Established patterns:** API routes, lib modules
**TDD rationale:** ABAC has clear input/output contract - `(subject, object, action) → boolean` - ideal for test-first development

**From 2-RESEARCH.md:**
- Casbin for ABAC policy enforcement
- Model file defines request/policy/effect/matcher structure
- Policy file defines actual rules
- Support classification hierarchy and coalition caveats

**From 2-CONTEXT.md:**
- Identity-specific caveats for coalition partners
- Releasability checking (REL TO, NOFORN)
- Bilateral agreement enforcement
- Nation-specific restrictions
</context>

<feature>
  <name>ABAC Policy Enforcement with Military Classification</name>
  <files>backend/src/security/abac-enforcer.ts, backend/src/security/abac-model.conf, backend/src/security/policies/security.csv, backend/src/security/__tests__/abac-enforcer.test.ts</files>
  <behavior>
**Core behavior:** Given subject attributes and object attributes, determine if action is allowed.

**Test cases:**

1. Classification hierarchy enforcement:
   - Input: subject.clearance=SECRET, object.classification=CONFIDENTIAL, action=read
   - Expected: true (SECRET >= CONFIDENTIAL)

2. Classification denial:
   - Input: subject.clearance=CONFIDENTIAL, object.classification=SECRET, action=read
   - Expected: false (CONFIDENTIAL < SECRET)

3. NOFORN enforcement:
   - Input: subject.nationality=GBR, object.dissemination=[NOFORN], action=read
   - Expected: false (non-US cannot access NOFORN)

4. NOFORN for US nationals:
   - Input: subject.nationality=USA, object.dissemination=[NOFORN], action=read
   - Expected: true (US can access NOFORN)

5. Releasability check (positive):
   - Input: subject.nationality=GBR, object.releasability=[USA, GBR, FVEY], action=read
   - Expected: true (GBR in releasability list)

6. Releasability check (negative):
   - Input: subject.nationality=DEU, object.releasability=[USA, GBR], action=read
   - Expected: false (DEU not in releasability list)

7. Bilateral agreement enforcement:
   - Input: subject.caveats.bilateral=[UK-USA], object.bilateralMarking=UK-USA, action=read
   - Expected: true (bilateral agreement present)

8. Bilateral agreement missing:
   - Input: subject.caveats.bilateral=[], object.bilateralMarking=UK-USA, action=read
   - Expected: false (no bilateral agreement)

9. Combined classification + releasability:
   - Input: subject.clearance=SECRET, subject.nationality=GBR, object.classification=SECRET, object.releasability=[FVEY], action=read
   - Expected: true (clearance sufficient AND GBR in FVEY)

10. Write permission with originator control:
    - Input: subject.did=did:near:alice.near, object.originator=did:near:alice.near, object.orcon=true, action=write
    - Expected: true (subject is originator)

11. Write denied for non-originator with ORCON:
    - Input: subject.did=did:near:bob.near, object.originator=did:near:alice.near, object.orcon=true, action=write
    - Expected: false (not originator)

**Attribute model:**

Subject attributes (from DID credentials):
```typescript
interface SubjectAttributes {
  did: string;
  clearance: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
  nationality: string;  // ISO 3166-1 alpha-3
  organization: string;
  role: string;
  caveats: {
    releasability: string[];      // Countries/groups subject can receive from
    bilateral: string[];          // Bilateral agreements
    specialAccess: string[];      // SAP/SCI programs
  };
}
```

Object attributes (from data classification):
```typescript
interface ObjectAttributes {
  classification: 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET';
  releasability: string[];        // REL TO countries/groups
  dissemination: string[];        // NOFORN, ORCON, PROPIN, etc.
  bilateralMarking?: string;      // Bilateral agreement required
  originator: string;             // DID of data originator
  orcon: boolean;                 // Originator controlled
}
```
  </behavior>
  <implementation>
**Install Casbin:**
```bash
cd backend && pnpm add casbin
pnpm add -D vitest @types/node
```

**Create directory structure:**
```
backend/src/security/
├── abac-enforcer.ts          # Main enforcer class
├── abac-model.conf           # Casbin model definition
├── attribute-provider.ts     # Fetch attributes from DIDs
├── policies/
│   └── security.csv          # Security policy rules
└── __tests__/
    └── abac-enforcer.test.ts # TDD tests
```

**abac-model.conf:**
```conf
[request_definition]
r = sub, obj, act

[policy_definition]
p = sub_rule, obj_rule, act

[policy_effect]
e = some(where (p.eft == allow))

[matchers]
m = eval(p.sub_rule) && eval(p.obj_rule) && r.act == p.act
```

**Classification level mapping:**
- UNCLASS = 1
- CUI = 2
- CONFIDENTIAL = 3
- SECRET = 4
- TOPSECRET = 5

**Key implementation patterns:**
- Convert classification strings to numeric levels for comparison
- Use array.includes() for releasability/caveat checks
- Short-circuit evaluation for performance
- Log access decisions for audit trail
  </implementation>
</feature>

<verification>
```bash
cd /home/vitalpointai/projects/ssr/backend && pnpm test security
```
All 11 test cases must pass.
</verification>

<success_criteria>
- Failing tests written for all 11 scenarios
- Casbin enforcer implementation passes all tests
- Classification hierarchy correctly enforced
- Coalition caveats (NOFORN, REL TO, bilateral) working
- ORCON enforcement functional
- Code refactored for clarity
- All commits follow TDD pattern (test → feat → refactor)
</success_criteria>

<output>
After completion, create `.planning/phases/02-identity-security-framework/2-04-SUMMARY.md` with:
- RED: What tests were written, why they failed
- GREEN: What implementation made them pass
- REFACTOR: What cleanup was done
- Commits: List of commits produced
</output>
