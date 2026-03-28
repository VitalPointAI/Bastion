/**
 * AdvancedTab
 *
 * Phase 60 Plan 07: Advanced configuration — system status, WASM tool builder,
 * and admin-only update controls.
 *
 * Blueprint Phase 6 — Self-expansion capabilities:
 *
 * Sections:
 *   1. System Status (all users)  — Ironclaw version, health, last check, update badge
 *   2. WASM Tool Builder (all)    — Natural language → WASM tool via Ironclaw
 *   3. Admin Controls (admin only) — Container update trigger, update history,
 *                                    webhook configuration status
 */

import { useState, useEffect, useCallback } from 'react';
import type { AgentConfig, CustomSkill } from '../../../types/agent-config.ts';
import { useUser } from '../../../context/UserContext.tsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface IronclawStatus {
  healthy: boolean;
  version: string;
  lastCheck: string | null;
  updateAvailable: boolean;
  availableVersion: string | null;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AdvancedTabProps {
  config: AgentConfig;
  updateConfig: (partial: Partial<AgentConfig>) => void;
  /** Injected for testing; defaults to true when ADMIN_DIDS matches current user */
  isAdmin?: boolean;
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function HealthDot({ healthy }: { healthy: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        healthy ? 'bg-emerald-500' : 'bg-red-500'
      }`}
      title={healthy ? 'Healthy' : 'Unreachable'}
    />
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ label }: { label: string }) {
  return (
    <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2.5">
      {label}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AdvancedTab({ config, updateConfig: _updateConfig, isAdmin: isAdminProp }: AdvancedTabProps) {
  const { accountId } = useUser();

  // ---------------------------------------------------------------------------
  // Admin detection
  // Heuristic: fetch /api/admin/ironclaw-status — if it succeeds (200) the
  // caller is admin, otherwise they are not. isAdminProp overrides for tests.
  // ---------------------------------------------------------------------------
  const [isAdmin, setIsAdmin] = useState<boolean>(isAdminProp ?? false);

  // ---------------------------------------------------------------------------
  // System status
  // ---------------------------------------------------------------------------
  const [status, setStatus] = useState<IronclawStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch('/api/admin/ironclaw-status', {
        credentials: 'include',
      });
      if (res.ok) {
        const data = (await res.json()) as IronclawStatus;
        setStatus(data);
        if (isAdminProp === undefined) setIsAdmin(true);
      } else if (res.status === 403 || res.status === 401) {
        // Not admin — status section shows limited info
        setStatus(null);
        setIsAdmin(false);
      } else {
        setStatusError('Failed to load status');
      }
    } catch {
      setStatusError('Could not reach backend');
    } finally {
      setStatusLoading(false);
    }
  }, [isAdminProp]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // WASM tool builder
  // ---------------------------------------------------------------------------
  const [toolDescription, setToolDescription] = useState('');
  const [buildStatus, setBuildStatus] = useState<'idle' | 'building' | 'done' | 'error'>('idle');
  const [buildMessage, setBuildMessage] = useState('');

  const handleBuildTool = useCallback(async () => {
    if (!toolDescription.trim()) return;
    setBuildStatus('building');
    setBuildMessage('');

    try {
      const res = await fetch('/api/ironclaw/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: `/tool build ${toolDescription.trim()}`,
          context: { tab: 'advanced', action: 'wasm-tool-build' },
        }),
      });
      if (res.ok) {
        setBuildStatus('done');
        setBuildMessage(
          'Build request sent to Ironclaw. The tool will appear in your custom skills once built.',
        );
      } else {
        setBuildStatus('error');
        setBuildMessage('Failed to send build request. Try again.');
      }
    } catch {
      setBuildStatus('error');
      setBuildMessage('Network error — could not reach Ironclaw.');
    }
  }, [toolDescription]);

  // ---------------------------------------------------------------------------
  // Admin: trigger update
  // ---------------------------------------------------------------------------
  const [showUpdateConfirm, setShowUpdateConfirm] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);

  const handleTriggerUpdate = useCallback(async () => {
    setShowUpdateConfirm(false);
    setUpdateLoading(true);
    setUpdateResult(null);

    try {
      const res = await fetch('/api/admin/ironclaw-update', {
        method: 'POST',
        credentials: 'include',
      });
      const data = (await res.json()) as { status?: string; version?: string; error?: string };
      if (res.ok) {
        setUpdateResult(`Update initiated — new version: ${data.version ?? 'unknown'}`);
        await fetchStatus();
      } else {
        setUpdateResult(`Update failed: ${data.error ?? 'Unknown error'}`);
      }
    } catch {
      setUpdateResult('Network error during update.');
    } finally {
      setUpdateLoading(false);
    }
  }, [fetchStatus]);

  // ---------------------------------------------------------------------------
  // Render: custom skills list
  // ---------------------------------------------------------------------------
  const customSkills: CustomSkill[] = config.customSkills ?? [];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="p-4 flex flex-col gap-6">

      {/* ── Section 1: System Status ─────────────────────────────────── */}
      <section>
        <SectionHeader label="System Status" />

        {statusLoading && (
          <p className="text-xs text-slate-500">Loading status...</p>
        )}

        {statusError && !statusLoading && (
          <p className="text-xs text-red-400">{statusError}</p>
        )}

        {!statusLoading && status && (
          <div className="rounded-md border border-slate-700/60 bg-slate-800/40 px-4 py-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HealthDot healthy={status.healthy} />
                <span className="text-xs text-slate-200 font-medium">
                  {status.healthy ? 'Ironclaw Online' : 'Ironclaw Unreachable'}
                </span>
              </div>
              {status.updateAvailable && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-700/40 text-amber-300 font-medium">
                  Update Available: {status.availableVersion}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-slate-400 mt-1">
              <div>
                <span className="text-slate-500">Version: </span>
                <span className="text-slate-300 font-mono">{status.version}</span>
              </div>
              <div>
                <span className="text-slate-500">Last Check: </span>
                <span className="text-slate-300">
                  {status.lastCheck
                    ? new Date(status.lastCheck).toLocaleString()
                    : 'Never'}
                </span>
              </div>
            </div>
          </div>
        )}

        {!statusLoading && !status && !statusError && (
          <div className="rounded-md border border-slate-700/60 bg-slate-800/40 px-4 py-3">
            <p className="text-xs text-slate-400">
              Status details require admin access.
            </p>
          </div>
        )}

        <div className="mt-2 flex justify-end">
          <button
            onClick={() => void fetchStatus()}
            disabled={statusLoading}
            className="text-[10px] px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </section>

      {/* ── Section 2: WASM Tool Builder ─────────────────────────────── */}
      <section>
        <SectionHeader label="WASM Tool Builder" />

        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          Ironclaw can build custom WASM tools from natural language descriptions.
          Built tools become available as skills in your configuration.
        </p>

        <div className="flex flex-col gap-2">
          <textarea
            value={toolDescription}
            onChange={(e) => setToolDescription(e.target.value)}
            placeholder="Example: A tool that converts MGRS coordinates to lat/lng and displays on the map"
            rows={3}
            className="w-full rounded border border-slate-700/60 bg-slate-800/60 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-600 resize-none"
          />

          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleBuildTool()}
              disabled={!toolDescription.trim() || buildStatus === 'building'}
              className="text-xs px-3 py-1.5 rounded border border-blue-700/60 bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {buildStatus === 'building' ? 'Building...' : 'Build Tool'}
            </button>

            {buildStatus !== 'idle' && (
              <span
                className={`text-[11px] ${
                  buildStatus === 'done'
                    ? 'text-emerald-400'
                    : buildStatus === 'error'
                    ? 'text-red-400'
                    : 'text-slate-400'
                }`}
              >
                {buildMessage}
              </span>
            )}
          </div>
        </div>

        {/* Custom skills list */}
        {customSkills.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">
              Your custom skills ({customSkills.length})
            </p>
            <div className="flex flex-col gap-1.5">
              {customSkills.map((skill, i) => (
                <div
                  key={i}
                  className="flex items-start gap-2 rounded border border-slate-700/40 bg-slate-800/30 px-3 py-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-200 font-medium">{skill.name}</p>
                    {skill.description && (
                      <p className="text-[10px] text-slate-500 mt-0.5">{skill.description}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {customSkills.length === 0 && (
          <p className="text-[11px] text-slate-600 mt-3">
            No custom skills yet. Describe a tool above to get started.
          </p>
        )}
      </section>

      {/* ── Section 3: Admin Controls (admin only) ───────────────────── */}
      {isAdmin && (
        <section>
          <SectionHeader label="Admin Controls" />

          <div className="rounded-md border border-slate-700/60 bg-slate-800/40 px-4 py-4 flex flex-col gap-4">

            {/* Update button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-200 font-medium">Update Ironclaw Container</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {status?.updateAvailable
                    ? `Version ${status.availableVersion} is ready to install.`
                    : 'No update available.'}
                </p>
              </div>

              {!showUpdateConfirm && (
                <button
                  onClick={() => setShowUpdateConfirm(true)}
                  disabled={!status?.updateAvailable || updateLoading}
                  className="text-xs px-3 py-1.5 rounded border border-amber-700/60 bg-amber-900/20 text-amber-300 hover:bg-amber-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-medium"
                >
                  {updateLoading ? 'Updating...' : 'Update Ironclaw'}
                </button>
              )}

              {showUpdateConfirm && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-amber-300">
                    This will restart the container. Active conversations will be interrupted.
                  </span>
                  <button
                    onClick={() => void handleTriggerUpdate()}
                    className="text-xs px-2.5 py-1 rounded border border-red-700/60 bg-red-900/20 text-red-300 hover:bg-red-900/40 font-medium transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowUpdateConfirm(false)}
                    className="text-xs px-2.5 py-1 rounded border border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {updateResult && (
              <p
                className={`text-[11px] mt-1 ${
                  updateResult.startsWith('Update initiated')
                    ? 'text-emerald-400'
                    : 'text-red-400'
                }`}
              >
                {updateResult}
              </p>
            )}

            {/* Webhook configuration status */}
            <div className="border-t border-slate-700/40 pt-3">
              <p className="text-xs text-slate-300 font-medium mb-1">GitHub Webhook Status</p>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Configure a GitHub release webhook to be notified automatically when a new
                Ironclaw version is published. Set{' '}
                <code className="font-mono bg-slate-700/60 px-1 rounded text-slate-300">
                  GITHUB_WEBHOOK_SECRET
                </code>{' '}
                in your backend environment and register the endpoint:
              </p>
              <p className="text-[10px] font-mono bg-slate-900/60 border border-slate-700/40 rounded px-2 py-1 mt-2 text-slate-400 break-all">
                POST /api/admin/ironclaw-webhook/github-release
              </p>
            </div>

            {/* Signed-in admin account note */}
            <div className="border-t border-slate-700/40 pt-3">
              <p className="text-[10px] text-slate-600">
                Logged in as:{' '}
                <span className="font-mono text-slate-500">{accountId ?? 'unknown'}</span>
              </p>
            </div>
          </div>
        </section>
      )}

    </div>
  );
}
