/**
 * AgentHub — Unified agent administration view
 *
 * Tabs:
 * - Agents: Stats cards + full agent list (combined overview + management)
 * - Teams: Drag-and-drop team composition
 * - Activity: Audit trail timeline
 * - Health: Validation & compliance testing
 */

import { useState } from 'react';
import { AgentDashboardPanel } from './AgentDashboardPanel';
import { TeamDesignerPanel } from './TeamDesignerPanel';
import { AgentActivityPanel } from './AgentActivityPanel';
import { ValidationDashboard } from './ValidationDashboard';

type AgentHubTab = 'agents' | 'teams' | 'activity' | 'health';

const TABS: { id: AgentHubTab; label: string }[] = [
  { id: 'agents', label: 'Agents' },
  { id: 'teams', label: 'Teams' },
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
        {activeTab === 'activity' && <AgentActivityPanel />}
        {activeTab === 'health' && <ValidationDashboard />}
      </div>
    </div>
  );
}
