/**
 * GitHub Integration Service for Ironclaw Agent
 *
 * Phase 30 Plan 07: Enables agent-initiated code changes via GitHub PRs,
 * CI status tracking, deployment monitoring, and emergency merge with auto-revert.
 *
 * Security: GitHub token stays in backend process -- never exposed to Ironclaw or frontend.
 */

import { Octokit } from '@octokit/rest';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatePRParams {
  title: string;
  description: string;
  branchName: string;
  files: Array<{ path: string; content: string }>;
  baseBranch?: string;
}

export interface CreatePRResult {
  prNumber: number;
  prUrl: string;
  summary: string;
}

export interface PRStatus {
  state: string;
  mergeable: boolean | null;
  ciStatus: 'success' | 'failure' | 'pending';
  checks: Array<{
    name: string;
    status: string;
    conclusion: string | null;
  }>;
}

export interface DeploymentStatus {
  status: string;
  environment: string;
  url?: string;
}

export interface EmergencyMergeResult {
  merged: boolean;
  sha: string;
  deploymentStarted: boolean;
}

// ---------------------------------------------------------------------------
// Governance File Protection
// ---------------------------------------------------------------------------

/**
 * File paths (glob-like prefixes) that agent-authored PRs are NEVER permitted
 * to modify. These files define the agent's own authority boundaries.
 *
 * This only applies to PRs created through the Ironclaw pipeline (branches
 * prefixed `ironclaw/`). Human developers can modify any file normally via
 * direct commits, manual PRs, or CI workflows.
 */
export const PROTECTED_FILE_PATHS = [
  // Ironclaw governance code
  'backend/src/ironclaw/ironclaw-types.ts',     // Risk levels, protected keys, rate limits
  'backend/src/ironclaw/action-registry.ts',     // Registry lock, risk classification
  'backend/src/ironclaw/action-pipeline.ts',     // Confirmation pipeline, gate routing
  'backend/src/ironclaw/tool-bridge.ts',         // Self-modification detection, scope validation
  'backend/src/ironclaw/github-service.ts',      // This file — protected file list itself
  // Auth & middleware
  'backend/src/auth/',                           // Authentication system
  // Gate system (approval workflow)
  'backend/src/gates/',                          // Decision gate enforcement
  // CI/CD & deployment (could remove governance checks or swap deployment targets)
  '.github/',                                    // GitHub Actions workflows, PR templates
  'docker-compose.prod.yml',                     // Production container config
  'docker-compose.yml',                          // Dev container config
  'Dockerfile',                                  // Build image definition
  '.dockerignore',                               // Build context control
  // Server entry points & API layer (indirect governance bypass)
  'backend/src/index.ts',                        // Server entry point, router mounting
  'backend/src/api/',                            // API route layer above Ironclaw router
  'backend/src/messaging/',                      // WebSocket message bus
  // Dependency & build config (malicious dependency injection)
  'package.json',                                // Root dependencies
  'package-lock.json',                           // Dependency lock
  'backend/package.json',                        // Backend dependencies
  'backend/package-lock.json',                   // Backend dependency lock
  'frontend/package.json',                       // Frontend dependencies
  'frontend/package-lock.json',                  // Frontend dependency lock
  'tsconfig.json',                               // Root TypeScript config
  'backend/tsconfig.json',                       // Backend TypeScript config
  'frontend/tsconfig.json',                      // Frontend TypeScript config
  // Scripts (deployment, seeding, migrations)
  'scripts/',                                    // All operational scripts
  // Environment defaults
  '.env',                                        // Environment variable defaults
  // Frontend entry & context (UI guardrail bypass)
  'frontend/src/App.tsx',                        // App entry point
  'frontend/src/context/',                       // React contexts (auth, permissions)
] as const;

/**
 * Check if a file path matches any protected path.
 * Supports exact match and directory prefix matching.
 */
function isProtectedPath(filePath: string): boolean {
  for (const protectedPath of PROTECTED_FILE_PATHS) {
    if (protectedPath.endsWith('/')) {
      // Directory prefix match
      if (filePath.startsWith(protectedPath)) return true;
    } else {
      // Exact file match
      if (filePath === protectedPath) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class GitHubService {
  private octokit: Octokit | null = null;
  private owner: string;
  private repo: string;

  constructor() {
    const repoSlug = process.env.GITHUB_REPO || 'vitalpointai/bastion';
    const [owner, repo] = repoSlug.split('/');
    this.owner = owner;
    this.repo = repo;

    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    }
  }

  // -------------------------------------------------------------------------
  // Configuration check
  // -------------------------------------------------------------------------

  /**
   * Returns true if GITHUB_TOKEN is set. Allows graceful degradation
   * when GitHub integration is not configured.
   */
  isConfigured(): boolean {
    return this.octokit !== null;
  }

  private requireOctokit(): Octokit {
    if (!this.octokit) {
      throw new Error(
        'GitHubService: GITHUB_TOKEN not configured. Set GITHUB_TOKEN env var to enable GitHub integration.',
      );
    }
    return this.octokit;
  }

  // -------------------------------------------------------------------------
  // PR Creation
  // -------------------------------------------------------------------------

  /**
   * Creates a GitHub PR with the provided file changes.
   *
   * Flow: get base SHA -> create branch -> create blobs -> build tree ->
   * create commit -> update ref -> create PR.
   *
   * On partial failure (branch created but PR fails), cleans up the branch.
   */
  async createPR(params: CreatePRParams): Promise<CreatePRResult> {
    const octokit = this.requireOctokit();
    const baseBranch = params.baseBranch || 'master';
    const branchRef = `ironclaw/${params.branchName}`;
    let branchCreated = false;

    // Governance guardrail: block agent PRs that touch protected files.
    // Only applies to ironclaw/ branches (agent-authored). Human developers
    // create PRs through normal git workflows, not this service.
    const blocked = params.files.filter((f) => isProtectedPath(f.path));
    if (blocked.length > 0) {
      const paths = blocked.map((f) => f.path).join(', ');
      console.warn(
        `[GitHubService] BLOCKED: Agent PR attempted to modify governance files: ${paths}`,
      );
      throw new Error(
        `Agent PRs cannot modify governance files. Blocked paths: ${paths}. ` +
        `These files control agent authority boundaries and must be modified by human developers directly.`,
      );
    }

    try {
      // 1. Get base branch SHA
      const { data: baseRef } = await octokit.rest.git.getRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${baseBranch}`,
      });
      const baseSha = baseRef.object.sha;

      // 2. Create new branch
      await octokit.rest.git.createRef({
        owner: this.owner,
        repo: this.repo,
        ref: `refs/heads/${branchRef}`,
        sha: baseSha,
      });
      branchCreated = true;

      // 3. Create blobs and build tree entries
      const treeEntries: Array<{
        path: string;
        mode: '100644';
        type: 'blob';
        sha: string;
      }> = [];

      for (const file of params.files) {
        const { data: blob } = await octokit.rest.git.createBlob({
          owner: this.owner,
          repo: this.repo,
          content: file.content,
          encoding: 'utf-8',
        });
        treeEntries.push({
          path: file.path,
          mode: '100644',
          type: 'blob',
          sha: blob.sha,
        });
      }

      // 4. Create tree with base_tree from base branch
      const { data: tree } = await octokit.rest.git.createTree({
        owner: this.owner,
        repo: this.repo,
        base_tree: baseSha,
        tree: treeEntries,
      });

      // 5. Create commit
      const { data: commit } = await octokit.rest.git.createCommit({
        owner: this.owner,
        repo: this.repo,
        message: params.title,
        tree: tree.sha,
        parents: [baseSha],
      });

      // 6. Update branch ref to point to new commit
      await octokit.rest.git.updateRef({
        owner: this.owner,
        repo: this.repo,
        ref: `heads/${branchRef}`,
        sha: commit.sha,
      });

      // 7. Create PR
      const { data: pr } = await octokit.rest.pulls.create({
        owner: this.owner,
        repo: this.repo,
        title: params.title,
        body: params.description,
        head: branchRef,
        base: baseBranch,
      });

      const summary = `PR #${pr.number}: ${params.title} (${params.files.length} files changed) - ${pr.html_url}`;
      console.log(`[GitHubService] Created PR: ${summary}`);

      return {
        prNumber: pr.number,
        prUrl: pr.html_url,
        summary,
      };
    } catch (error) {
      // Cleanup: if branch was created but subsequent steps failed, delete the branch
      if (branchCreated) {
        try {
          await octokit.rest.git.deleteRef({
            owner: this.owner,
            repo: this.repo,
            ref: `heads/${branchRef}`,
          });
          console.log(`[GitHubService] Cleaned up branch ${branchRef} after failure`);
        } catch (cleanupError) {
          console.error(`[GitHubService] Failed to cleanup branch ${branchRef}:`, cleanupError);
        }
      }
      console.error('[GitHubService] PR creation failed:', error);
      throw error;
    }
  }

  // -------------------------------------------------------------------------
  // PR Status / CI Tracking
  // -------------------------------------------------------------------------

  /**
   * Gets PR state, mergeability, and CI check status.
   */
  async getPRStatus(prNumber: number): Promise<PRStatus> {
    const octokit = this.requireOctokit();

    // 1. Get PR details
    const { data: pr } = await octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });

    // 2. Get check runs for PR head SHA
    const { data: checkRuns } = await octokit.rest.checks.listForRef({
      owner: this.owner,
      repo: this.repo,
      ref: pr.head.sha,
    });

    // 3. Aggregate CI status
    const checks = checkRuns.check_runs.map((run) => ({
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
    }));

    let ciStatus: 'success' | 'failure' | 'pending' = 'success';
    if (checks.some((c) => c.conclusion === 'failure')) {
      ciStatus = 'failure';
    } else if (checks.some((c) => c.status !== 'completed')) {
      ciStatus = 'pending';
    } else if (checks.length === 0) {
      ciStatus = 'pending';
    }

    return {
      state: pr.state,
      mergeable: pr.mergeable,
      ciStatus,
      checks,
    };
  }

  // -------------------------------------------------------------------------
  // Deployment Status
  // -------------------------------------------------------------------------

  /**
   * Gets deployment status for a given commit SHA.
   * Returns null if no deployments found.
   */
  async getDeploymentStatus(sha: string): Promise<DeploymentStatus | null> {
    const octokit = this.requireOctokit();

    // 1. List deployments for SHA
    const { data: deployments } = await octokit.rest.repos.listDeployments({
      owner: this.owner,
      repo: this.repo,
      sha,
    });

    if (deployments.length === 0) {
      return null;
    }

    // 2. Get latest deployment status
    const latestDeployment = deployments[0];
    const { data: statuses } = await octokit.rest.repos.listDeploymentStatuses({
      owner: this.owner,
      repo: this.repo,
      deployment_id: latestDeployment.id,
    });

    if (statuses.length === 0) {
      return {
        status: 'pending',
        environment: latestDeployment.environment,
      };
    }

    const latest = statuses[0];
    return {
      status: latest.state,
      environment: latestDeployment.environment,
      url: latest.environment_url || undefined,
    };
  }

  // -------------------------------------------------------------------------
  // Emergency Merge
  // -------------------------------------------------------------------------

  /**
   * Emergency-merges a PR with squash, then monitors CI on the merged SHA.
   * If CI fails within the monitoring window (5 minutes), automatically creates
   * a revert PR.
   */
  async handleEmergencyMerge(prNumber: number): Promise<EmergencyMergeResult> {
    const octokit = this.requireOctokit();

    // 1. Merge PR via squash
    const { data: mergeResult } = await octokit.rest.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      merge_method: 'squash',
    });

    const mergedSha = mergeResult.sha;
    console.log(`[GitHubService] Emergency merged PR #${prNumber}, SHA: ${mergedSha}`);

    // 2. Poll CI status (max 5 minutes, every 30 seconds)
    const maxAttempts = 10;
    const pollInterval = 30_000;
    let ciFailed = false;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(pollInterval);

      const { data: checkRuns } = await octokit.rest.checks.listForRef({
        owner: this.owner,
        repo: this.repo,
        ref: mergedSha,
      });

      const allCompleted = checkRuns.check_runs.every((r) => r.status === 'completed');
      const anyFailed = checkRuns.check_runs.some((r) => r.conclusion === 'failure');

      if (anyFailed) {
        ciFailed = true;
        console.error(
          `[GitHubService] CI failed for emergency merge SHA ${mergedSha}. Initiating revert.`,
        );
        break;
      }

      if (allCompleted && checkRuns.check_runs.length > 0) {
        console.log(`[GitHubService] CI passed for emergency merge SHA ${mergedSha}`);
        break;
      }
    }

    // 3. Auto-revert on CI failure
    if (ciFailed) {
      try {
        await this.createRevertPR(prNumber, mergedSha);
      } catch (revertError) {
        console.error(`[GitHubService] Failed to create revert PR for #${prNumber}:`, revertError);
      }
    }

    // 4. Check for deployment
    const deployment = await this.getDeploymentStatus(mergedSha).catch(() => null);

    return {
      merged: mergeResult.merged,
      sha: mergedSha,
      deploymentStarted: deployment !== null,
    };
  }

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  /**
   * Creates a revert PR for a failed emergency merge.
   */
  private async createRevertPR(originalPrNumber: number, mergedSha: string): Promise<void> {
    const octokit = this.requireOctokit();
    const revertBranch = `ironclaw/revert-${originalPrNumber}`;

    // Get the parent commit (pre-merge)
    const { data: commit } = await octokit.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: mergedSha,
    });

    const parentSha = commit.parents[0].sha;

    // Create revert branch from current HEAD
    const { data: masterRef } = await octokit.rest.git.getRef({
      owner: this.owner,
      repo: this.repo,
      ref: 'heads/master',
    });

    await octokit.rest.git.createRef({
      owner: this.owner,
      repo: this.repo,
      ref: `refs/heads/${revertBranch}`,
      sha: masterRef.object.sha,
    });

    // Create a revert commit by resetting tree to parent state
    const { data: parentCommit } = await octokit.rest.git.getCommit({
      owner: this.owner,
      repo: this.repo,
      commit_sha: parentSha,
    });

    const { data: revertCommit } = await octokit.rest.git.createCommit({
      owner: this.owner,
      repo: this.repo,
      message: `Revert: Emergency PR #${originalPrNumber} - CI failed`,
      tree: parentCommit.tree.sha,
      parents: [masterRef.object.sha],
    });

    await octokit.rest.git.updateRef({
      owner: this.owner,
      repo: this.repo,
      ref: `heads/${revertBranch}`,
      sha: revertCommit.sha,
    });

    // Create the revert PR
    const { data: revertPR } = await octokit.rest.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title: `Revert: Emergency PR #${originalPrNumber} - CI failed`,
      body: `Automated revert of emergency merge PR #${originalPrNumber}.\n\nCI checks failed on merged SHA \`${mergedSha}\`. This PR reverts to the pre-merge state.`,
      head: revertBranch,
      base: 'master',
    });

    console.log(
      `[GitHubService] Created revert PR #${revertPR.number} for failed emergency merge #${originalPrNumber}`,
    );
  }

  // -------------------------------------------------------------------------
  // Direct file commit to master (skill .md files only)
  // -------------------------------------------------------------------------

  /**
   * Allowed path prefix for direct commits. Only skill definition files
   * can be committed directly — all other paths are blocked.
   */
  private static readonly DIRECT_COMMIT_ALLOWED_PREFIX = 'backend/src/skills/';

  /**
   * Create or update a single file directly on master via the GitHub Contents API.
   * Scoped to backend/src/skills/ — refuses to write anywhere else.
   *
   * Used by registerRuntimeSkill so Ironclaw-created skills are git-tracked
   * without needing git CLI access or a PR workflow.
   */
  async commitFileToMaster(
    filePath: string,
    content: string,
    commitMessage: string,
  ): Promise<{ sha: string; path: string }> {
    const octokit = this.requireOctokit();

    // Path safety: only allow writes under the skills directory
    if (!filePath.startsWith(GitHubService.DIRECT_COMMIT_ALLOWED_PREFIX)) {
      throw new Error(
        `Direct commits restricted to ${GitHubService.DIRECT_COMMIT_ALLOWED_PREFIX}. ` +
        `Attempted path: ${filePath}`,
      );
    }

    // Only .md files
    if (!filePath.endsWith('.md')) {
      throw new Error('Direct commits restricted to .md files only');
    }

    // Check if file already exists (need its SHA for updates)
    let existingSha: string | undefined;
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: this.owner,
        repo: this.repo,
        path: filePath,
        ref: 'master',
      });
      if (!Array.isArray(data) && data.type === 'file') {
        existingSha = data.sha;
      }
    } catch (err) {
      // 404 = file doesn't exist yet, which is fine
      if ((err as { status?: number }).status !== 404) throw err;
    }

    // Create or update the file
    const { data } = await octokit.rest.repos.createOrUpdateFileContents({
      owner: this.owner,
      repo: this.repo,
      path: filePath,
      message: commitMessage,
      content: Buffer.from(content, 'utf-8').toString('base64'),
      sha: existingSha,
      branch: 'master',
    });

    const resultSha = data.commit.sha ?? '';
    console.log(`[GitHubService] Committed ${filePath} to master (${resultSha.slice(0, 8)})`);

    return { sha: resultSha, path: filePath };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const githubService = new GitHubService();
