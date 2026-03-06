#!/usr/bin/env node
/**
 * Rename workspace components to problem-set equivalents.
 * Handles all text replacements systematically.
 */
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'frontend', 'src', 'components', 'workspace');
const destDir = path.join(__dirname, '..', 'frontend', 'src', 'components', 'problem-set');

// File rename map: oldName -> newName (null = keep same name)
const FILE_MAP = {
  'WorkspaceSelector.tsx': 'ProblemSetSelector.tsx', // already exists, skip
  'WorkspaceSwitcher.tsx': 'ProblemSetSwitcher.tsx',
  'WorkspaceSwitcher.css': 'ProblemSetSwitcher.css',
  'WorkspaceBreadcrumb.tsx': 'ProblemSetBreadcrumb.tsx',
  'WorkspaceDashboard.tsx': 'ProblemSetDashboard.tsx',
  'WorkspaceInviteModal.tsx': 'ProblemSetInviteModal.tsx',
  'WorkspaceMemberManager.tsx': 'ProblemSetMemberManager.tsx',
  'WorkspaceTabContainer.tsx': 'ProblemSetTabContainer.tsx',
  'CreateWorkspaceWizard.tsx': 'CreateProblemSetWizard.tsx',
  'CreateWorkspaceWizard.css': 'CreateProblemSetWizard.css',
  'CrossWorkspaceLayerToggle.tsx': 'CrossProblemSetLayerToggle.tsx',
  'OrgTree.tsx': null,
  'OrgTreeSidebar.tsx': null,
  'ActivityFeed.tsx': null,
  'CommanderPanel.tsx': null,
  'CompartmentManager.tsx': null,
  'EscalationPanel.tsx': null,
  'InviteAcceptPage.tsx': null,
  'MemberDirectory.tsx': null,
  'NotificationBadge.tsx': null,
  'ObserverPanel.tsx': null,
  'StaffPanel.tsx': null,
  'SubscriptionManager.tsx': null,
  'TabNotificationDropdown.tsx': null,
};

// Ordered replacements (order matters -- more specific first)
const REPLACEMENTS = [
  // Import paths
  ['../../context/WorkspaceContext', '../../context/ProblemSetContext'],
  ['../../lib/workspace-service', '../../lib/problem-set-service'],
  ['./WorkspaceSwitcher.css', './ProblemSetSwitcher.css'],
  ['./CreateWorkspaceWizard.css', './CreateProblemSetWizard.css'],

  // Cross-component imports (within same directory)
  ['./WorkspaceSelector', './ProblemSetSelector'],
  ['./WorkspaceSwitcher', './ProblemSetSwitcher'],
  ['./WorkspaceBreadcrumb', './ProblemSetBreadcrumb'],
  ['./WorkspaceDashboard', './ProblemSetDashboard'],
  ['./WorkspaceInviteModal', './ProblemSetInviteModal'],
  ['./WorkspaceMemberManager', './ProblemSetMemberManager'],
  ['./WorkspaceTabContainer', './ProblemSetTabContainer'],
  ['./CreateWorkspaceWizard', './CreateProblemSetWizard'],
  ['./CrossWorkspaceLayerToggle', './CrossProblemSetLayerToggle'],

  // Hook/context renames
  ['useWorkspace()', 'useProblemSet()'],
  ['useWorkspace,', 'useProblemSet,'],
  ['useWorkspace }', 'useProblemSet }'],
  ['useWorkspace}', 'useProblemSet}'],
  ['useWorkspace', 'useProblemSet'],

  // Type imports
  ['CrossWorkspaceUpdate', 'CrossProblemSetUpdate'],
  ['type WorkspaceRole', 'type ProblemSetRole'],
  ['type WorkspaceInviteDetail', 'type ProblemSetInviteDetail'],
  ['type WorkspaceMemberDetail', 'type ProblemSetMemberDetail'],
  ['type WorkspaceCompartment', 'type ProblemSetCompartment'],
  ['type WorkspaceActivityItem', 'type ProblemSetActivityItem'],
  ['type HierarchyNode', 'type HierarchyNode'],
  ['type Subscription', 'type Subscription'],
  ['type EscalationRule', 'type EscalationRule'],
  ['type CreateWorkspaceInput', 'type CreateProblemSetInput'],
  ['WorkspaceRole[]', 'ProblemSetRole[]'],
  ['WorkspaceInviteDetail[]', 'ProblemSetInviteDetail[]'],
  ['WorkspaceMemberDetail[]', 'ProblemSetMemberDetail[]'],
  ['WorkspaceCompartment[]', 'ProblemSetCompartment[]'],
  ['WorkspaceActivityItem[]', 'ProblemSetActivityItem[]'],
  ['WorkspaceMemberDetail>', 'ProblemSetMemberDetail>'],
  ['WorkspaceCompartment>', 'ProblemSetCompartment>'],
  ['WorkspaceRole>', 'ProblemSetRole>'],
  ['WorkspaceInviteDetail>', 'ProblemSetInviteDetail>'],

  // Service calls
  ['workspaceService.', 'problemSetService.'],
  ['workspaceService,', 'problemSetService,'],

  // Component/function export names
  ['export function WorkspaceSwitcher', 'export function ProblemSetSwitcher'],
  ['export function WorkspaceBreadcrumb', 'export function ProblemSetBreadcrumb'],
  ['export function WorkspaceDashboard', 'export function ProblemSetDashboard'],
  ['export function WorkspaceInviteModal', 'export function ProblemSetInviteModal'],
  ['export function WorkspaceMemberManager', 'export function ProblemSetMemberManager'],
  ['export function WorkspaceTabContainer', 'export function ProblemSetTabContainer'],
  ['export function CreateWorkspaceWizard', 'export function CreateProblemSetWizard'],
  ['export function CrossWorkspaceLayerToggle', 'export function CrossProblemSetLayerToggle'],
  ['export default WorkspaceTabContainer', 'export default ProblemSetTabContainer'],
  ['export default CrossWorkspaceLayerToggle', 'export default CrossProblemSetLayerToggle'],
  ['export default CompartmentManager', 'export default CompartmentManager'],
  ['export default MemberDirectory', 'export default MemberDirectory'],
  ['export default OrgTree', 'export default OrgTree'],
  ['export default OrgTreeSidebar', 'export default OrgTreeSidebar'],
  ['export default TabNotificationDropdown', 'export default TabNotificationDropdown'],

  // Variable names (careful ordering)
  ['activeWorkspaceId', 'activeProblemSetId'],
  ['activeWorkspace', 'activeProblemSet'],
  ['setActiveWorkspace', 'setActiveProblemSet'],
  ['primaryWorkspaceId', 'primaryProblemSetId'],
  ['workspaceId', 'problemSetId'],
  ['rootWorkspaceId', 'rootProblemSetId'],
  ['currentUserWorkspaceId', 'currentUserProblemSetId'],
  ['parentWorkspaceId', 'parentProblemSetId'],
  ['publisherWorkspaceId', 'publisherProblemSetId'],
  ['subscriberWorkspaceId', 'subscriberProblemSetId'],
  ['joinedWorkspaceId', 'joinedProblemSetId'],
  ['selectedPublisherId', 'selectedPublisherId'], // no change needed

  // Props interface renames
  ['WorkspaceInviteModalProps', 'ProblemSetInviteModalProps'],
  ['WorkspaceMemberManagerProps', 'ProblemSetMemberManagerProps'],
  ['CrossWorkspaceLayerToggleProps', 'CrossProblemSetLayerToggleProps'],

  // workspaceType -> echelon (for memberships)
  ['workspaceType', 'echelon'],

  // URL paths
  ['/workspace/', '/problem-set/'],
  ["'/workspace/", "'/problem-set/"],
  ['`/workspace/', '`/problem-set/'],

  // UI text replacements
  ['Workspace', 'Problem Set'],
  ['workspace', 'problem set'],

  // CSS file references
  ['WorkspaceSwitcher', 'ProblemSetSwitcher'],
  ['CreateWorkspaceWizard', 'CreateProblemSetWizard'],
  ['CrossWorkspaceLayerToggle', 'CrossProblemSetLayerToggle'],

  // Clean up double replacements
  ['Problem Settype', 'echelon'], // fix workspaceType -> Problem Settype
];

// Create dest dir if not exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

let created = 0;
let skipped = 0;

for (const [oldFile, newFile] of Object.entries(FILE_MAP)) {
  const destFile = newFile || oldFile;
  const destPath = path.join(destDir, destFile);

  // Skip ProblemSetSelector.tsx - already exists
  if (destFile === 'ProblemSetSelector.tsx' && fs.existsSync(destPath)) {
    console.log(`SKIP: ${destFile} (already exists)`);
    skipped++;
    continue;
  }

  const srcPath = path.join(srcDir, oldFile);
  if (!fs.existsSync(srcPath)) {
    console.log(`SKIP: ${oldFile} (source not found)`);
    skipped++;
    continue;
  }

  let content = fs.readFileSync(srcPath, 'utf-8');

  // Apply replacements for .tsx and .ts files
  if (destFile.endsWith('.tsx') || destFile.endsWith('.ts')) {
    for (const [search, replace] of REPLACEMENTS) {
      // Use string split/join for literal replacement (not regex)
      content = content.split(search).join(replace);
    }
  }
  // For CSS files, only rename comments
  if (destFile.endsWith('.css')) {
    content = content.split('WorkspaceSwitcher').join('ProblemSetSwitcher');
    content = content.split('CreateWorkspaceWizard').join('CreateProblemSetWizard');
    content = content.split('Workspace').join('Problem Set');
    content = content.split('workspace').join('problem set');
  }

  fs.writeFileSync(destPath, content, 'utf-8');
  console.log(`CREATED: ${destFile}`);
  created++;
}

console.log(`\nDone: ${created} created, ${skipped} skipped`);
