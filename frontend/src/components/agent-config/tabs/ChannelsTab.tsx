/**
 * ChannelsTab
 *
 * Phase 60 Plan 05: Channel configuration for Ironclaw notifications.
 *
 * Blueprint Section 4.3 — Multi-channel notification routing.
 * Users configure which channels receive which urgency levels:
 *   CRITICAL → Telegram DM + Bastion in-app
 *   URGENT   → Telegram during duty hours; Bastion-only outside
 *   ROUTINE  → Bastion in-app only; daily digest
 *   INFO     → Workspace memory write only
 *
 * Sections:
 *   - Bastion In-App (always enabled, notification level configurable)
 *   - Telegram (enable/disable, pairing status, notification level)
 */

import { useState, useCallback } from 'react';
import type { AgentConfig, NotificationLevel } from '../../../types/agent-config.ts';
import { TelegramPairWizard } from '../components/TelegramPairWizard.tsx';
import { useUser } from '../../../context/UserContext.tsx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NOTIFICATION_LEVELS: { value: NotificationLevel; label: string; description: string }[] = [
  {
    value: 'Critical',
    label: 'Critical',
    description: 'Immediate action required. Enemy contact, mission-critical failures.',
  },
  {
    value: 'Urgent',
    label: 'Urgent',
    description: 'Time-sensitive. CCIR met, planning deadline approaching.',
  },
  {
    value: 'Routine',
    label: 'Routine',
    description: 'Normal staff activity. Status updates, completed products.',
  },
  {
    value: 'Informational',
    label: 'Informational',
    description: 'Awareness only. Written to workspace memory, no alert sent.',
  },
];

/** Blueprint priority routing reference table. */
const PRIORITY_TABLE = [
  {
    level: 'CRITICAL',
    color: 'text-red-400',
    channels: 'Telegram DM + Bastion in-app',
    timing: 'Immediate, any hour',
  },
  {
    level: 'URGENT',
    color: 'text-amber-400',
    channels: 'Telegram (duty hours); Bastion only (off-hours)',
    timing: 'Within 30 minutes',
  },
  {
    level: 'ROUTINE',
    color: 'text-blue-400',
    channels: 'Bastion in-app only',
    timing: 'Daily digest',
  },
  {
    level: 'INFO',
    color: 'text-slate-400',
    channels: 'Workspace memory write only',
    timing: 'No alert',
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChannelsTabProps {
  config: AgentConfig;
  updateConfig: (partial: Partial<AgentConfig>) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldGroupProps {
  label: string;
  children: React.ReactNode;
}

function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2.5">
        {label}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

interface NotificationLevelSelectProps {
  value: NotificationLevel;
  onChange: (level: NotificationLevel) => void;
  label: string;
}

function NotificationLevelSelect({ value, onChange, label }: NotificationLevelSelectProps) {
  return (
    <div>
      <label className="text-[10px] text-slate-400 block mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as NotificationLevel)}
        className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-600"
      >
        {NOTIFICATION_LEVELS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label} — {opt.description}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ChannelsTab({ config, updateConfig }: ChannelsTabProps) {
  const { accountId } = useUser();
  const [showPairWizard, setShowPairWizard] = useState(false);

  // ---------------------------------------------------------------------------
  // Telegram handlers
  // ---------------------------------------------------------------------------

  const handleTelegramToggle = useCallback(() => {
    updateConfig({ telegramEnabled: !config.telegramEnabled });
  }, [config.telegramEnabled, updateConfig]);

  const handleUnpair = useCallback(() => {
    updateConfig({
      telegramEnabled: false,
      telegramChatId: null,
    });
  }, [updateConfig]);

  const handlePairSuccess = useCallback(
    (chatId: string) => {
      updateConfig({
        telegramEnabled: true,
        telegramChatId: chatId,
      });
      setShowPairWizard(false);
    },
    [updateConfig],
  );

  // Determine Telegram pairing status label
  const telegramStatus = (() => {
    if (!config.telegramEnabled) return 'disabled';
    if (config.telegramChatId) return 'paired';
    return 'enabled-not-paired';
  })();

  return (
    <div className="p-4">
      {/* Bastion In-App */}
      <FieldGroup label="Bastion In-App">
        <div className="rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs font-medium text-slate-200">Bastion In-App Notifications</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wide">
              Always On
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mb-3">
            Ironclaw alerts appear as notifications in the Bastion dashboard.
            This channel cannot be disabled.
          </p>
          <NotificationLevelSelect
            value={config.telegramNotificationLevel ?? 'Routine'}
            onChange={(level) => updateConfig({ telegramNotificationLevel: level })}
            label="Minimum notification level for in-app alerts"
          />
        </div>
      </FieldGroup>

      {/* Telegram */}
      <FieldGroup label="Telegram">
        <div className="rounded-md border border-slate-700/60 bg-slate-800/30 px-3 py-3">
          {/* Enable toggle */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
              </svg>
              <span className="text-xs font-medium text-slate-200">Telegram Notifications</span>
            </div>
            <button
              onClick={handleTelegramToggle}
              className={`w-9 h-5 rounded-full transition-colors relative ${
                config.telegramEnabled ? 'bg-blue-600' : 'bg-slate-700'
              }`}
              role="switch"
              aria-checked={config.telegramEnabled}
            >
              <span
                className={`block w-3.5 h-3.5 rounded-full bg-white shadow transition-transform absolute top-0.75 ${
                  config.telegramEnabled ? 'translate-x-4.75' : 'translate-x-0.75'
                }`}
              />
            </button>
          </div>

          {/* Status & pairing UI */}
          {telegramStatus === 'disabled' && (
            <p className="text-[11px] text-slate-500">
              Enable Telegram to receive Ironclaw notifications outside the
              Bastion dashboard.
            </p>
          )}

          {telegramStatus === 'enabled-not-paired' && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-xs text-amber-400">Not paired</span>
              </div>
              <p className="text-[11px] text-slate-400 mb-3">
                Pair your Telegram account to start receiving notifications.
              </p>
              <button
                onClick={() => setShowPairWizard(true)}
                className="text-xs px-3 py-1.5 bg-blue-700 hover:bg-blue-600 text-white rounded transition-colors"
              >
                Pair Now
              </button>
            </div>
          )}

          {telegramStatus === 'paired' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  <span className="text-xs text-emerald-400">Paired</span>
                  <span className="text-[11px] text-slate-500">
                    Chat ID: {config.telegramChatId}
                  </span>
                </div>
                <button
                  onClick={handleUnpair}
                  className="text-[11px] text-slate-500 hover:text-red-400 underline transition-colors"
                >
                  Unpair
                </button>
              </div>

              <NotificationLevelSelect
                value={config.telegramNotificationLevel ?? 'Urgent'}
                onChange={(level) => updateConfig({ telegramNotificationLevel: level })}
                label="Minimum notification level for Telegram alerts"
              />
            </div>
          )}
        </div>
      </FieldGroup>

      {/* Priority Reference Table */}
      <FieldGroup label="Notification Priority Reference">
        <div className="rounded-md border border-slate-700/60 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="bg-slate-800/60 border-b border-slate-700/60">
                <th className="px-3 py-2 text-left text-slate-500 font-medium uppercase tracking-wide">
                  Level
                </th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium uppercase tracking-wide">
                  Channels
                </th>
                <th className="px-3 py-2 text-left text-slate-500 font-medium uppercase tracking-wide">
                  Timing
                </th>
              </tr>
            </thead>
            <tbody>
              {PRIORITY_TABLE.map((row, i) => (
                <tr
                  key={row.level}
                  className={`border-b border-slate-700/40 ${
                    i % 2 === 0 ? 'bg-slate-800/20' : 'bg-slate-800/10'
                  }`}
                >
                  <td className={`px-3 py-2 font-semibold ${row.color}`}>{row.level}</td>
                  <td className="px-3 py-2 text-slate-400">{row.channels}</td>
                  <td className="px-3 py-2 text-slate-500">{row.timing}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-600">
          Blueprint Section 4.3 — Notification routing follows this priority table
          regardless of which channels are enabled.
        </p>
      </FieldGroup>

      {/* Telegram Pair Wizard overlay */}
      {showPairWizard && nearAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <TelegramPairWizard
            userId={nearAccount}
            onSuccess={handlePairSuccess}
            onCancel={() => setShowPairWizard(false)}
          />
        </div>
      )}
    </div>
  );
}
