/**
 * AgentConfigPanel
 *
 * Phase 60 Plan 04: Tab-based panel for configuring a user's Chief of Staff persona.
 *
 * Blueprint Phase 3 — "One agent, many lenses." Users configure their Ironclaw
 * instance with their military identity (Identity tab) and communication
 * preferences (Personality tab). Changes auto-save with 500ms debounce and
 * trigger identity sync to Ironclaw's workspace.
 *
 * Future tabs: Skills, Channels, Routines, Advanced (added in later plans).
 */

import { useState } from 'react';
import { useUser } from '../../context/UserContext.tsx';
import { useAgentConfig } from './hooks/useAgentConfig.ts';
import { IdentityTab } from './tabs/IdentityTab.tsx';
import { PersonalityTab } from './tabs/PersonalityTab.tsx';
import { AgentPreviewChat } from './components/AgentPreviewChat.tsx';

// ─── Tab Definition ───────────────────────────────────────────────────────────

type TabId = 'identity' | 'personality';

const TABS: { id: TabId; label: string }[] = [
  { id: 'identity', label: 'Identity' },
  { id: 'personality', label: 'Personality' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AgentConfigPanelProps {
  /** User DID. If not provided, falls back to auth context. */
  userId?: string;
  /** Whether to show the preview chat panel */
  showPreview?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AgentConfigPanel({ userId, showPreview = true }: AgentConfigPanelProps) {
  const { userDID } = useUser();
  const effectiveUserId = userId ?? userDID ?? '';

  const { config, loading, error, updateConfig, saveStatus } = useAgentConfig(effectiveUserId);

  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [previewOpen, setPreviewOpen] = useState(false);

  // ─── Loading state ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-gray-500">
        <svg
          className="w-5 h-5 animate-spin mb-2 text-slate-500"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-xs text-slate-400">Loading configuration...</span>
      </div>
    );
  }

  // ─── Error state ───────────────────────────────────────────────────────

  if (error && !config) {
    return (
      <div className="px-4 py-6 text-center">
        <p className="text-sm text-red-400 mb-2">Failed to load agent configuration</p>
        <p className="text-xs text-slate-500">{error}</p>
      </div>
    );
  }

  if (!config) return null;

  // ─── Save status indicator ─────────────────────────────────────────────

  const saveBadge = (() => {
    if (saveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving...
        </span>
      );
    }
    if (saveStatus === 'saved') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-emerald-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Saved
        </span>
      );
    }
    if (saveStatus === 'error') {
      return (
        <span className="flex items-center gap-1 text-[10px] text-red-400">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Save failed
        </span>
      );
    }
    return null;
  })();

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-700/60">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Chief of Staff Configuration</h2>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Configure your Ironclaw persona — identity, communication style, and preferences
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveBadge}
          {showPreview && (
            <button
              onClick={() => setPreviewOpen((prev) => !prev)}
              className={`text-[10px] px-2.5 py-1 rounded border transition-colors ${
                previewOpen
                  ? 'bg-blue-900/40 border-blue-700/60 text-blue-300 hover:bg-blue-900/60'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
              }`}
            >
              {previewOpen ? 'Hide Preview' : 'Preview'}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 px-4 pt-2 border-b border-slate-700/60">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors border-b-2 mr-1 ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-300'
                : 'border-transparent text-slate-500 hover:text-slate-300 hover:border-slate-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Tab content */}
        <div className={`flex-1 overflow-y-auto ${previewOpen ? 'max-w-[60%]' : 'w-full'}`}>
          {activeTab === 'identity' && (
            <IdentityTab config={config} updateConfig={updateConfig} />
          )}
          {activeTab === 'personality' && (
            <PersonalityTab config={config} updateConfig={updateConfig} />
          )}
        </div>

        {/* Preview chat sidebar */}
        {showPreview && previewOpen && (
          <div className="w-[40%] min-w-64 border-l border-slate-700/60 flex flex-col overflow-hidden">
            <AgentPreviewChat config={config} />
          </div>
        )}
      </div>
    </div>
  );
}
