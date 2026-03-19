/**
 * AdminDashboard Component
 *
 * Main admin interface with sidebar navigation for system configuration.
 * Provides access to LLM, agents, workflow, OSINT sources, and audit log.
 * Uses shared TabLayout sidebar pattern consistent with other main tabs.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.js';
import { adminService } from '../../lib/admin-service';
import { useUser } from '../../context/UserContext';
import { useProblemSet } from '../../context/ProblemSetContext';
import { LLMConfigPanel } from './LLMConfigPanel';
import { AgentHub } from './AgentHub';
import { WorkflowConfigPanel } from './WorkflowConfigPanel';
import { AuditLogPanel } from './AuditLogPanel';
import { FundingPanel } from './FundingPanel';
import { RegistrationControlPanel } from './RegistrationControlPanel';
import './AdminDashboard.css';

interface AdminDashboardProps {
  onBack?: () => void;
}

type AdminView =
  | 'llm'
  | 'agent-hub'
  | 'workflow'
  | 'audit'
  | 'funding'
  | 'registration';

const ADMIN_ITEMS: SidebarItem[] = [
  { id: 'llm', label: 'LLM Provider', tooltip: 'Configure LLM provider settings' },
  { id: 'agent-hub', label: 'Agent Hub', tooltip: 'Agents, tools, skills, teams, activity, and health' },
  { id: 'workflow', label: 'Workflow', tooltip: 'Workflow configuration' },
  { id: 'audit', label: 'Audit Log', tooltip: 'System audit trail' },
  { id: 'funding', label: 'Funding', tooltip: 'NEAR account funding management' },
  { id: 'registration', label: 'Registration', tooltip: 'Domain whitelist & email blacklist' },
];

export function AdminDashboard({ onBack }: AdminDashboardProps) {
  const navigate = useNavigate();
  const { userDID, isAuthenticated } = useUser();
  const { activeProblemSetId } = useProblemSet();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedView, setSelectedView] = useState<AdminView>('llm');

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

  // Admin dashboard with sidebar navigation
  return (
    <div className="admin-dashboard">
      <div style={{ padding: '0.5rem 1rem 0' }}>
        <button
          onClick={() => navigate(activeProblemSetId ? `/problem-set/${activeProblemSetId}` : '/problem-set')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary, #94a3b8)',
            fontSize: '0.8rem',
            cursor: 'pointer',
            padding: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary, #e2e8f0)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary, #94a3b8)')}
        >
          &larr; Back to Dashboard
        </button>
      </div>
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

      <div className="admin-sidebar-wrapper">
        <TabLayout
          items={ADMIN_ITEMS}
          selectedItem={selectedView}
          onSelectItem={(id) => setSelectedView(id as AdminView)}
        >
          {selectedView === 'llm' && <LLMConfigPanel />}
          {selectedView === 'agent-hub' && <AgentHub />}
          {selectedView === 'workflow' && <WorkflowConfigPanel />}
          {selectedView === 'audit' && <AuditLogPanel />}
          {selectedView === 'funding' && <FundingPanel />}
          {selectedView === 'registration' && <RegistrationControlPanel />}
        </TabLayout>
      </div>
    </div>
  );
}
