---
phase: quick-12
plan: 12
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/src/api/problem-sets.ts
autonomous: true
requirements: [QUICK-12]
must_haves:
  truths:
    - "A platform admin (DID in ADMIN_DIDS env var) can delete any problem set"
    - "Non-admin, non-creator, non-commander users still receive 403"
    - "Existing creator and commander delete paths continue to work"
  artifacts:
    - path: "backend/src/api/problem-sets.ts"
      provides: "DELETE /:id with admin bypass"
      contains: "isAdmin"
  key_links:
    - from: "DELETE /api/problem-sets/:id"
      to: "ADMIN_DIDS env var"
      via: "inline DID check matching admin.ts pattern"
      pattern: "adminDids\\.includes\\(userDid\\)"
---

<objective>
Fix the DELETE /api/problem-sets/:id endpoint to allow platform admins to delete any problem set.

Purpose: Admins are blocked with a 403 because the permission check only tests for creator or commander membership roles; it does not test whether the requesting user is a platform admin.
Output: Updated permission check in the DELETE handler that also passes when the user's DID is in the ADMIN_DIDS env allowlist.
</objective>

<execution_context>
@/home/vitalpointai/.claude/get-shit-done/workflows/execute-plan.md
@/home/vitalpointai/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add admin bypass to problem-set DELETE permission check</name>
  <files>backend/src/api/problem-sets.ts</files>
  <action>
In the DELETE /:id handler (around line 1028), add an admin check using the same ADMIN_DIDS env-var pattern used in backend/src/api/admin.ts.

After the existing `isCommander` assignment (line 1031), insert:

```typescript
const adminDids = (process.env.ADMIN_DIDS || '').split(',').map((d) => d.trim()).filter(Boolean);
const isAdmin = adminDids.includes(userDid);
```

Then change the guard from:
```typescript
if (!isCreator && !isCommander) {
  return res.status(403).json({ error: 'Only the creator or a commander can delete a problem set' });
}
```
to:
```typescript
if (!isCreator && !isCommander && !isAdmin) {
  return res.status(403).json({ error: 'Only the creator, a commander, or a platform admin can delete a problem set' });
}
```

Also update the comment above from "Allow creator or any commander to delete" to "Allow creator, any commander, or platform admin to delete".

No other changes are required. The child-problem-set guard (lines 1036-1040) remains in place so admins still cannot delete parents with active children.
  </action>
  <verify>
    <automated>cd /home/vitalpointai/projects/ssr && export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20 && npx tsc --noEmit -p backend/tsconfig.json 2>&1 | tail -20</automated>
  </verify>
  <done>
- TypeScript compiles with no errors in backend/src/api/problem-sets.ts
- The DELETE handler contains `isAdmin` check derived from ADMIN_DIDS env var
- Guard condition reads `!isCreator && !isCommander && !isAdmin`
- Error message updated to mention "platform admin"
  </done>
</task>

</tasks>

<verification>
Compile check passes. Manually confirm by reviewing the diff:

```bash
git diff backend/src/api/problem-sets.ts
```

Expected diff: three additions (adminDids derivation, isAdmin assignment, updated guard + message), one updated comment, no deletions to existing logic.
</verification>

<success_criteria>
A user whose DID is listed in ADMIN_DIDS can call DELETE /api/problem-sets/:id and receive 204, not 403. All other non-privileged users still receive 403.
</success_criteria>

<output>
After completion, create `.planning/quick/12-fix-admin-unable-to-delete-problem-sets-/12-SUMMARY.md`
</output>
