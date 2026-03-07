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

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const githubService = new GitHubService();
