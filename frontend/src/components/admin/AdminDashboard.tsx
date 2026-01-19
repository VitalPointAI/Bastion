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
            Workflow
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            OSINT Sources
          </Tab>
          <Tab className="admin-tab" selectedClassName="admin-tab--selected">
            Audit Log
          </Tab>
        </TabList>

        <TabPanel className="admin-tab-panel">
          <LLMConfigPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel">
          <AgentConfigPanel />
        </TabPanel>

        <TabPanel className="admin-tab-panel">
          <div className="panel-placeholder">
            <div className="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <h3>Workflow Configuration</h3>
            <p>Configure escalation timeouts, approval authorities, and notifications.</p>
            <span className="coming-soon">Configuration panel coming in next plan</span>
          </div>
        </TabPanel>

        <TabPanel className="admin-tab-panel">
          <div className="panel-placeholder">
            <div className="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </div>
            <h3>OSINT Sources</h3>
            <p>Manage open-source intelligence feeds, APIs, and data sources.</p>
            <span className="coming-soon">Configuration panel coming in next plan</span>
          </div>
        </TabPanel>

        <TabPanel className="admin-tab-panel">
          <div className="panel-placeholder">
            <div className="placeholder-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </div>
            <h3>Audit Log</h3>
            <p>View history of configuration changes and administrative actions.</p>
            <span className="coming-soon">Configuration panel coming in next plan</span>
          </div>
        </TabPanel>
      </Tabs>
    </div>
  );
}
