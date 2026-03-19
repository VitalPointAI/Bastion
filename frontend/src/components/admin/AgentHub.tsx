/**
 * AgentHub — Unified agent administration view
 *
 * Tabs:
 * - Agents: Stats cards + full agent list with filters/sorting
 * - Teams: Drag-and-drop team composition
 * - Tools: MCP tool registry
 * - Skills: Agent skill definitions (future)
 * - Activity: Audit trail timeline
 * - Health: Validation & compliance testing
 */

import { useState } from 'react';
import { AgentDashboardPanel } from './AgentDashboardPanel';
import { TeamDesignerPanel } from './TeamDesignerPanel';
import { ToolRegistryPanel } from './ToolRegistryPanel';
import { AgentActivityPanel } from './AgentActivityPanel';
import { ValidationDashboard } from './ValidationDashboard';

type AgentHubTab = 'agents' | 'teams' | 'tools' | 'skills' | 'activity' | 'health';

const TABS: { id: AgentHubTab; label: string }[] = [
  { id: 'agents', label: 'Agents' },
  { id: 'teams', label: 'Teams' },
  { id: 'tools', label: 'Tools' },
  { id: 'skills', label: 'Skills' },
  { id: 'activity', label: 'Activity' },
  { id: 'health', label: 'Health' },
];

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentHubTab>('agents');

  return (
    <div className="agent-hub">
      {/* Tab bar */}
      <div className="agent-hub__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={`agent-hub__tab${activeTab === tab.id ? ' agent-hub__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="agent-hub__content">
        {activeTab === 'agents' && <AgentDashboardPanel />}
        {activeTab === 'teams' && <TeamDesignerPanel />}
        {activeTab === 'tools' && <ToolRegistryPanel />}
        {activeTab === 'skills' && <SkillsPlaceholder />}
        {activeTab === 'activity' && <AgentActivityPanel />}
        {activeTab === 'health' && <ValidationDashboard />}
      </div>
    </div>
  );
}

function SkillsPlaceholder() {
  return (
    <div className="config-panel config-panel--flush">
      <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
        <svg style={{ width: 48, height: 48, margin: '0 auto 12px', display: 'block', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Skills Registry</p>
        <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
          Define reusable skills that agents can learn and execute.
          Ironclaw can create new skills dynamically.
        </p>
        <p style={{ fontSize: '0.75rem', marginTop: 12, color: '#475569' }}>
          Coming soon — skills will be assignable to agents like tools, with versioning and validation.
        </p>
      </div>
    </div>
  );
}
