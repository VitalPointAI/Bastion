/**
 * AgentHub — Unified agent administration view
 *
 * Consolidates agent management into 4 tabs:
 * - Overview: Health dashboard with metrics grid
 * - Agents: CRUD, config, character, memory, test harness
 * - Teams: Drag-and-drop team composition
 * - Activity: Audit trail timeline
 */

import { useState } from 'react';
import { AgentDashboardPanel } from './AgentDashboardPanel';
import { TeamDesignerPanel } from './TeamDesignerPanel';
import { AgentActivityPanel } from './AgentActivityPanel';

type AgentHubTab = 'overview' | 'agents' | 'teams' | 'activity';

const TABS: { id: AgentHubTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agents' },
  { id: 'teams', label: 'Teams' },
  { id: 'activity', label: 'Activity' },
];

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentHubTab>('overview');

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
        {activeTab === 'overview' && <AgentDashboardPanel viewMode="overview" />}
        {activeTab === 'agents' && <AgentDashboardPanel viewMode="management" />}
        {activeTab === 'teams' && <TeamDesignerPanel />}
        {activeTab === 'activity' && <AgentActivityPanel />}
      </div>
    </div>
  );
}
