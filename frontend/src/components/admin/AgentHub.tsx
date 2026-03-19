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
import { SkillRegistryPanel } from './SkillRegistryPanel';
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
        {activeTab === 'skills' && <SkillRegistryPanel />}
        {activeTab === 'activity' && <AgentActivityPanel />}
        {activeTab === 'health' && <ValidationDashboard />}
      </div>
    </div>
  );
}

