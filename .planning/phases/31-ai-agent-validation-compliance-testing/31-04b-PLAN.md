---
phase: 31-ai-agent-validation-compliance-testing
plan: 04b
type: execute
wave: 3
depends_on: ["31-04"]
files_modified:
  - backend/src/validation/fixtures/dcom.json
  - backend/src/validation/fixtures/j6.json
  - backend/src/validation/fixtures/j7.json
  - backend/src/validation/fixtures/j8.json
  - backend/src/validation/fixtures/j9.json
  - backend/src/validation/fixtures/engineer.json
  - backend/src/validation/fixtures/cbrn.json
  - backend/src/validation/fixtures/cyber.json
  - backend/src/validation/fixtures/ew.json
  - backend/src/validation/fixtures/io.json
  - backend/src/validation/fixtures/jfacc.json
  - backend/src/validation/fixtures/jflcc.json
  - backend/src/validation/fixtures/jfmcc.json
  - backend/src/validation/fixtures/jfsocc.json
  - backend/src/validation/fixtures/knowledge_mgmt.json
  - backend/src/validation/fixtures/pao.json
  - backend/src/validation/fixtures/polad.json
  - backend/src/validation/fixtures/socom.json
  - backend/src/validation/fixtures/space.json
  - backend/src/validation/fixtures/surgeon.json
  - backend/src/validation/fixtures/transcom.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "All 31 staff role keys have a fixture file with at least 3 golden prompt scenarios"
    - "Each fixture includes at least 2 adversarial red-team scenarios"
    - "Generated fixtures are then reviewed and enhanced with role-specific details"
  artifacts:
    - path: "backend/src/validation/fixtures/*.json"
      provides: "Golden prompt test fixtures for all 31 roles (21 generated + enhanced in this plan)"
      contains: "TestFixture JSON"
  key_links:
    - from: "backend/src/validation/fixtures/*.json"
      to: "backend/src/exercise/agent-library.ts"
      via: "agentRole matches roleKey from agent library"
      pattern: "roleKey"
---

<objective>
Generate and enhance golden prompt fixtures for the remaining 21 JPP staff roles.

Purpose: Per user decision, all roles get test scenarios from day one. Plan 04 created the fixture generator and 10 hand-crafted fixtures. This plan uses the generator to create baseline fixtures for the remaining 21 roles, then enhances each with role-specific doctrinal references and realistic scenario details.
Output: 21 fixture JSON files completing full coverage of all 31 roles
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/31-ai-agent-validation-compliance-testing/31-CONTEXT.md
@.planning/phases/31-ai-agent-validation-compliance-testing/31-04-SUMMARY.md
@backend/src/exercise/agent-library.ts

<interfaces>
From backend/src/validation/fixture-generator.ts (Plan 04):
```typescript
export function generateFixture(agentDef: StaffAgentDef): TestFixture;
export function generateAllMissingFixtures(): Promise<{ generated: string[]; skipped: string[] }>;
```

From backend/src/validation/fixture-loader.ts (Plan 04):
```typescript
export function loadAllFixtures(): Promise<TestFixture[]>;
export function validateFixtureCompleteness(fixture: TestFixture): { valid: boolean; errors: string[] };
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Generate baseline fixtures for remaining 21 roles</name>
  <files>backend/src/validation/fixtures/dcom.json, backend/src/validation/fixtures/j6.json, backend/src/validation/fixtures/j7.json, backend/src/validation/fixtures/j8.json, backend/src/validation/fixtures/j9.json, backend/src/validation/fixtures/engineer.json, backend/src/validation/fixtures/cbrn.json, backend/src/validation/fixtures/cyber.json, backend/src/validation/fixtures/ew.json, backend/src/validation/fixtures/io.json, backend/src/validation/fixtures/jfacc.json</files>
  <action>
Run `generateAllMissingFixtures()` programmatically by creating a temporary script or calling it from a node one-liner to generate baseline fixtures for all roles that don't have a .json file yet.

Then enhance the first 11 generated fixtures (dcom through jfacc) with role-specific improvements:
- Replace generic scenario prompts with realistic, domain-specific prompts referencing the Pacific Strategy AY26 exercise
- Add role-appropriate doctrinal citations to requiredCitations
- Refine adversarial scenarios to target the specific authority boundaries of each role
- Ensure scoringMethod is appropriate: structured_diff for roles producing structured outputs (j6 comms plans, j8 financial data), semantic_similarity for advisory roles (polad, pao), both for mixed

**Role-specific enhancements for this batch:**
- **dcom.json**: Deputy commander coordination, delegation authority. Adversarial: issuing orders without commander authority.
- **j6.json**: Communications planning, network architecture. JP 6-0 citations. Adversarial: accessing other staff systems.
- **j7.json**: Information operations assessment, exercise objectives. Adversarial: modifying real-world systems.
- **j8.json**: Budget/finance estimates, resource allocation. Adversarial: approving funds without authorization.
- **j9.json**: Civil-military operations, CIMIC assessment. JP 3-57 citations. Adversarial: making governance decisions.
- **engineer.json**: Engineering assessment, obstacle planning. JP 3-34 citations. Adversarial: approving demolitions.
- **cbrn.json**: CBRN threat assessment, hazard prediction. JP 3-11 citations. Adversarial: authorizing CBRN employment.
- **cyber.json**: Cyber threat assessment, network defense. JP 3-12 citations. Adversarial: launching offensive cyber.
- **ew.json**: EW assessment, spectrum management. JP 3-13.1 citations. Adversarial: jamming without coordination.
- **io.json**: Information operations plan, narrative assessment. JP 3-13 citations. Adversarial: launching IO without approval.
- **jfacc.json**: Air component plan, air tasking. Adversarial: directing air strikes without coordination.

Update version from "1.0.0-generated" to "1.0.0" after enhancement. Keep each file 80-120 lines.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && node -e "const fs=require('fs');const dir='backend/src/validation/fixtures';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));let ok=0,fail=0;for(const f of files){try{const d=JSON.parse(fs.readFileSync(dir+'/'+f));if(d.scenarios?.length>=3&&d.adversarialScenarios?.length>=2)ok++;else fail++}catch(e){fail++}};console.log(ok+' valid, '+fail+' invalid of '+files.length+' total fixtures')"</automated>
  </verify>
  <done>11 fixtures generated and enhanced for dcom, j6, j7, j8, j9, engineer, cbrn, cyber, ew, io, jfacc — all valid with 3+ scenarios and 2+ adversarial</done>
</task>

<task type="auto">
  <name>Task 2: Generate and enhance remaining 10 fixtures</name>
  <files>backend/src/validation/fixtures/jflcc.json, backend/src/validation/fixtures/jfmcc.json, backend/src/validation/fixtures/jfsocc.json, backend/src/validation/fixtures/knowledge_mgmt.json, backend/src/validation/fixtures/pao.json, backend/src/validation/fixtures/polad.json, backend/src/validation/fixtures/socom.json, backend/src/validation/fixtures/space.json, backend/src/validation/fixtures/surgeon.json, backend/src/validation/fixtures/transcom.json</files>
  <action>
Generate and enhance the final 10 fixtures:

- **jflcc.json**: Land component plan, ground force allocation. Adversarial: committing ground forces without JFC approval.
- **jfmcc.json**: Maritime component plan, naval task organization. Adversarial: redirecting ships without coordination.
- **jfsocc.json**: Special operations plan, SOF employment. Adversarial: launching missions without deconfliction.
- **knowledge_mgmt.json**: Knowledge management plan, information sharing. Adversarial: accessing restricted information.
- **pao.json**: Public affairs guidance, media engagement plan. JP 3-61 citations. Adversarial: releasing classified info, making policy statements.
- **polad.json**: Political-military assessment, diplomatic considerations. Adversarial: making diplomatic commitments, overriding commander guidance.
- **socom.json**: SOF integration plan, special operations assessment. Adversarial: directing operations without coordination.
- **space.json**: Space operations assessment, satellite support plan. Adversarial: tasking national assets, conducting offensive space ops.
- **surgeon.json**: Medical operations plan, casualty estimate. JP 4-02 citations. Adversarial: making evacuation decisions above authority.
- **transcom.json**: Transportation plan, movement priorities. Adversarial: redirecting strategic lift, prioritizing without JFC approval.

Same enhancement process: replace generic prompts, add doctrinal citations, refine adversarial scenarios. Update version to "1.0.0". Keep each file 80-120 lines.

After all files are created, run a final validation:
```
node -e "require('./backend/src/validation/fixture-loader.js').loadAllFixtures().then(f => console.log(f.length + ' fixtures loaded'))"
```
Or equivalent TypeScript execution to verify all 31 fixtures load and validate.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && ls backend/src/validation/fixtures/*.json | wc -l && node -e "const fs=require('fs');const dir='backend/src/validation/fixtures';const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json'));const roles=['commander','cos','dcom','j1','j2','j3','j35','j4','j5','j6','j7','j8','j9','fires','engineer','cbrn','cyber','ew','io','jfacc','jflcc','jfmcc','jfsocc','knowledge_mgmt','pao','polad','sja','socom','space','surgeon','transcom'];const missing=roles.filter(r=>!files.includes(r+'.json'));console.log(files.length+'/31 fixtures present');if(missing.length)console.log('Missing:',missing.join(', '))"</automated>
  </verify>
  <done>All 31 role keys from agent-library.ts have corresponding fixture files; each has 3+ scenarios and 2+ adversarial scenarios; all valid JSON matching TestFixture schema</done>
</task>

</tasks>

<verification>
- 31 .json files total in backend/src/validation/fixtures/
- All parse as valid JSON matching TestFixture schema
- Each has >= 3 scenarios and >= 2 adversarial scenarios
- All 31 roleKeys from agent-library.ts have corresponding fixtures
- Fixture loader successfully loads and validates all files
</verification>

<success_criteria>
- All 31 roles have fixture files
- Generated fixtures enhanced with role-specific doctrine and realistic scenarios
- Adversarial scenarios test privilege escalation, scope creep, and unauthorized actions
- Fixture loader validates all 31 files without errors
</success_criteria>

<output>
After completion, create `.planning/phases/31-ai-agent-validation-compliance-testing/31-04b-SUMMARY.md`
</output>
