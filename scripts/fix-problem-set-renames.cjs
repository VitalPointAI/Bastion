#!/usr/bin/env node
/**
 * Fix broken renames where "workspace" became "problem set" in identifiers.
 * The initial rename was too aggressive - it replaced "workspace" even in
 * camelCase identifiers where it should have been "problemSet".
 */
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '..', 'frontend', 'src', 'components', 'problem-set');

// These are broken patterns and their fixes
const FIXES = [
  // Broken type names (space in identifier)
  ['Problem SetActivityItem', 'ProblemSetActivityItem'],
  ['Problem SetCompartment', 'ProblemSetCompartment'],
  ['Problem SetMemberDetail', 'ProblemSetMemberDetail'],
  ['Problem SetRole', 'ProblemSetRole'],
  ['Problem SetInviteDetail', 'ProblemSetInviteDetail'],
  ['Problem SetType', 'ProblemSetType'],

  // Broken component names in imports/usage
  ['CreateProblem SetWizard', 'CreateProblemSetWizard'],
  ['CrossProblem SetLayerToggle', 'CrossProblemSetLayerToggle'],

  // Broken variable names
  ['problem setService', 'problemSetService'],
  ['problem setName', 'problemSetName'],
  ['setProblem SetName', 'setProblemSetName'],
  ['parentProblem SetName', 'parentProblemSetName'],
  ['setJoinedProblem SetId', 'setJoinedProblemSetId'],
  ['joinedProblem SetId', 'joinedProblemSetId'],
  ['extractProblem SetName', 'extractProblemSetName'],

  // Broken camelCase from "workspace" -> "problem set" in identifiers
  ['problem set.', 'problemSet.'], // only in code, not comments
  ['activeProblem Set', 'activeProblemSet'],

  // Fix comments that got broken identifiers
  ['problem set-service', 'problem-set-service'],

  // sessionStorage key
  ['problem set-invite-token', 'problem-set-invite-token'],

  // More broken identifiers from second pass
  ['crossProblem SetUpdates', 'crossProblemSetUpdates'],
  ['sourceProblem SetName', 'sourceProblemSetName'],
  ['handleProblem SetClick', 'handleProblemSetClick'],
  ['Problem SetDashboard', 'ProblemSetDashboard'],
  ['Problem SetInviteModal', 'ProblemSetInviteModal'],
  ['Problem SetTab', 'ProblemSetTab'],
  ['Problem SetMemberDetail', 'ProblemSetMemberDetail'],
  ['Sub-Problem Sets', 'Sub-Problem Sets'], // keep
  ['Sub-problem set', 'Sub-Problem Set'],
  ['createProblem Set', 'createProblemSet'],
  ['sourceProblem Set', 'sourceProblemSet'],
  ['parentProblem Set', 'parentProblemSet'],
  ['refreshActiveProblem Set', 'refreshActiveProblemSet'],
  ['refreshCrossProblem Set', 'refreshCrossProblemSet'],
  ['clearTabProblem Set', 'clearTabProblemSet'],
  ['problem setId', 'problemSetId'],
];

const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx') || f.endsWith('.ts'));

let totalFixed = 0;

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let fileFixed = 0;

  for (const [search, replace] of FIXES) {
    const count = content.split(search).length - 1;
    if (count > 0) {
      content = content.split(search).join(replace);
      fileFixed += count;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`FIXED: ${file} (${fileFixed} replacements)`);
    totalFixed += fileFixed;
  }
}

console.log(`\nTotal fixes: ${totalFixed}`);
