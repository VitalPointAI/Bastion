/**
 * AdminDashboard Component
 *
 * Main admin interface with tabbed navigation for system configuration.
 * Provides access to LLM, agents, workflow, OSINT sources, and audit log.
 */

import { useState, useEffect } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { adminService } from '../../lib/admin-service';
import { useUser } from '../../context/UserContext';
import { LLMConfigPanel } from './LLMConfigPanel';
import { AgentConfigPanel } from './AgentConfigPanel';
import { AgentManagementPanel } from './AgentManagementPanel';
import { ToolRegistryPanel } from './ToolRegistryPanel';
import { CharacterBuilderPanel } from './CharacterBuilderPanel';
import { TeamComposerPanel } from './TeamComposerPanel';
import { WorkflowConfigPanel } from './WorkflowConfigPanel';
import { OSINTSourcePanel } from './OSINTSourcePanel';
import { AuditLogPanel } from './AuditLogPanel';
import { FundingPanel } from './FundingPanel';
import './AdminDashboard.css';

interface AdminDashboardProps {
  onBack?: () => void;
}

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const { userDID, isAuthenticated } = useUser();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check admin access when userDID is available
  useEffect(() => {
    const checkAdminAccess = async () => {
      // Wait for DID to be ready if authenticated
      if (isAuthenticated && !userDID) {
        // DID not ready yet - stay in loading state
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        // Set the user DID on the admin service before checking access
        if (userDID) {
          adminService.setUserDID(userDID);
        }

        const hasAccess = await adminService.isAdmin();
        setIsAdmin(hasAccess);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to verify admin access');
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminAccess();
  }, [userDID, isAuthenticated]);

  // Loading state
  if (isLoading) {
    return (
      <div className="admin-dashboard loading">
        <div className="loading-content">
          <p>Verifying admin access...</p>
        </div>
      </div>
    );
  }

  // Access denied state
  if (!isAdmin) {
    return (
      <div className="admin-dashboard access-denied">
        <div className="access-denied-content">
          <div className="access-denied-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <h2>Access Denied</h2>
          <p>
            {error || 'You do not have administrator privileges to access this section.'}
          </p>
          <p className="access-denied-hint">
            Contact your system administrator if you believe this is an error.
          </p>
          {onBack && (
            <button className="back-button" onClick={onBack}>
              Return to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  // Admin dashboard with tabs
  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>System Configuration</h1>
        <div className="header-actions">
          <button
            className="refresh-cache-button"
            onClick={async () => {
              try {
                await adminService.invalidateCache();
              } catch (err) {
                console.error('Failed to invalidate cache:', err);
              }
            }}
            title="Invalidate configuration cache"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6" />
              <path d="M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            Refresh Cache
          </button>
        </div>
      </div>

      <Tabs className="admin-tabs">
        <TabList className="admin-tab-list">
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            LLM Provider
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Agents
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Agent Management
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Tools
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Characters
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Teams
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Workflow
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            OSINT Sources
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Audit Log
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Funding
          </Tab>
        </TabList>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <LLMConfigPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <AgentConfigPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <AgentManagementPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <ToolRegistryPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <CharacterBuilderPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <TeamComposerPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <WorkflowConfigPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <OSINTSourcePanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <AuditLogPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel" selectedClassName="admin-tab-panel--selected">
          <FundingPanel />
        </TabPanel>
      </Tabs>
    </div>
  );
}
