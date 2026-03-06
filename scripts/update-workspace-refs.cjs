#!/usr/bin/env node
/**
 * Update remaining workspace references in cross-cutting frontend files.
 * Renames imports, props, variables from workspace -> problemSet terminology.
 * Keeps backend API wire format (query params) as workspaceId since backend hasn't been renamed.
 */
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'frontend', 'src');

// Files to process (non-workspace-component files that reference workspace)
const FILES_TO_PROCESS = [
  // COP
  'components/cop/COPTab.tsx',
  'components/cop/COPAgentActivity.tsx',
  'components/cop/COPMapView.tsx',
  'types/cop.ts',
  'lib/cop-service.ts',
  // Tabs
  'components/tabs/DecideTab.tsx',
  'components/tabs/DesignTab.tsx',
  'components/tabs/CampaignTab.tsx',
  'components/tabs/MonitorTab.tsx',
  'components/tabs/TrainTab.tsx',
  // Strategic
  'components/strategic/StrategicDashboard.tsx',
  'components/strategic/DocumentList.tsx',
  'components/strategic/DocumentUpload.tsx',
  'lib/strategic-service.ts',
  // Graph
  'components/graph/GraphExplorer.tsx',
  // Validity
  'components/validity/StrategicValidityDashboard.tsx',
  'components/validity/ValidityMap.tsx',
  // Mission
  'lib/mission-service.ts',
  'components/mission/wizard/MissionWizard.tsx',
  'components/mission/wizard/steps/NameStep.tsx',
  'components/mission/wizard/steps/ReviewStep.tsx',
  // Context
  'context/ModeContext.tsx',
];

// Ordered replacements (order matters!)
const REPLACEMENTS = [
  // Import path updates: workspace components -> problem-set components
  ["from '../workspace/EscalationPanel.js'", "from '../problem-set/EscalationPanel.js'"],
  ["from '../workspace/SubscriptionManager.js'", "from '../problem-set/SubscriptionManager.js'"],
  ["from '../workspace/ActivityFeed.js'", "from '../problem-set/ActivityFeed.js'"],
  ["from '../workspace/StaffPanel.js'", "from '../problem-set/StaffPanel.js'"],
  ["from '../workspace/ObserverPanel.js'", "from '../problem-set/ObserverPanel.js'"],
  ["from '../workspace/CommanderPanel.js'", "from '../problem-set/CommanderPanel.js'"],

  // Import updates: WorkspaceContext -> ProblemSetContext
  ["from '../../context/WorkspaceContext.js'", "from '../../context/ProblemSetContext.js'"],
  ["from '../../context/WorkspaceContext'", "from '../../context/ProblemSetContext'"],
  ["from '../context/WorkspaceContext'", "from '../context/ProblemSetContext'"],

  // Import names
  ['useWorkspace', 'useProblemSet'],
  ['CrossWorkspaceUpdate', 'CrossProblemSetUpdate'],

  // Interface prop renames (prop names in interfaces/types)
  // Be careful not to rename query string params sent to backend
  ['workspaceId: string;', 'problemSetId: string;'],
  ['workspaceId?: string;', 'problemSetId?: string;'],
  ['workspaceId?: string,', 'problemSetId?: string,'],
  ['workspaceId: string,', 'problemSetId: string,'],

  // Variable/parameter names in function signatures
  // These are method params that get mapped to API query params internally
  ['{ workspaceId }', '{ problemSetId }'],
  ['{ workspaceId:', '{ problemSetId:'],
  ['workspaceId: _workspaceId', 'problemSetId: _problemSetId'],
  ['(workspaceId:', '(problemSetId:'],
  ['(workspaceId)', '(problemSetId)'],
  ['(workspaceId,', '(problemSetId,'],

  // Destructured props / component usage
  ['workspaceId={workspaceId}', 'problemSetId={problemSetId}'],
  ['workspaceId={displayId}', 'problemSetId={displayId}'],
  ['workspaceId={_workspaceId}', 'problemSetId={_problemSetId}'],

  // Function body references
  ['formData.workspaceId', 'formData.problemSetId'],
  ["'workspaceId'", "'problemSetId'"],

  // GraphNode interface
  ['workspaceId?:', 'problemSetId?:'],

  // Comments
  ['workspace selector', 'problem set selector'],
  ['Workspace ID', 'Problem Set ID'],
  ['workspace view', 'problem set view'],
  ['parent workspace', 'parent problem set'],
  ['cross-workspace', 'cross-problem-set'],
  ['Cross-workspace', 'Cross-problem-set'],
  ['workspace-scoped', 'problem-set-scoped'],
  ['Workspace ', 'Problem Set '],  // be careful with this one

  // Types
  ['interface Workspace {', 'interface ProblemSet {'],

  // Tooltip text updates
  ["'Escalate decisions to parent workspace'", "'Escalate decisions to parent problem set'"],
  ["'Manage cross-workspace data subscriptions'", "'Manage cross-problem-set data subscriptions'"],
];

let totalFixed = 0;

for (const relPath of FILES_TO_PROCESS) {
  const filePath = path.join(SRC, relPath);
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${relPath} (not found)`);
    continue;
  }

  let content = fs.readFileSync(filePath, 'utf-8');
  let fileFixed = 0;

  for (const [search, replace] of REPLACEMENTS) {
    if (search === replace) continue;
    const count = content.split(search).length - 1;
    if (count > 0) {
      content = content.split(search).join(replace);
      fileFixed += count;
    }
  }

  if (fileFixed > 0) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`FIXED: ${relPath} (${fileFixed} replacements)`);
    totalFixed += fileFixed;
  } else {
    console.log(`NOCHANGE: ${relPath}`);
  }
}

console.log(`\nTotal fixes: ${totalFixed}`);
