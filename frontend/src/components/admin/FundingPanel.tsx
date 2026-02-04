/**
 * FundingPanel Component
 *
 * Admin panel for managing NEAR implicit account funding contract.
 * Displays contract status, balance, funding history, and account check tool.
 */

import { useState, useEffect } from 'react';
import {
  adminService,
  type FundingStatus,
  type FundingHistoryItem,
} from '../../lib/admin-service';
import './FundingPanel.css';

export function FundingPanel() {
  const [status, setStatus] = useState<FundingStatus | null>(null);
  const [history, setHistory] = useState<FundingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Account check state
  const [checkAccountId, setCheckAccountId] = useState('');
  const [checkResult, setCheckResult] = useState<{
    accountId: string;
    funded: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Load funding status and history
  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);

    try {
      const [statusResult, historyResult] = await Promise.all([
        adminService.getFundingStatus(),
        adminService.getFundingHistory(0, 20),
      ]);

      setStatus(statusResult);
      setHistory(historyResult.history || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load funding data');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckAccount() {
    if (!checkAccountId.trim()) {
      setCheckError('Please enter an account ID');
      return;
    }

    // Validate 64-character hex format
    if (!/^[a-f0-9]{64}$/i.test(checkAccountId.trim())) {
      setCheckError('Account ID must be 64 hexadecimal characters');
      return;
    }

    setChecking(true);
    setCheckError(null);
    setCheckResult(null);

    try {
      const result = await adminService.checkAccountFunding(checkAccountId.trim().toLowerCase());
      setCheckResult({
        accountId: result.accountId || checkAccountId.trim().toLowerCase(),
        funded: result.funded,
      });
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'Failed to check account');
    } finally {
      setChecking(false);
    }
  }

  // Get warning level based on accounts remaining
  function getWarningLevel(): 'critical' | 'warning' | 'normal' | null {
    if (!status?.enabled || status.accountsRemaining === undefined) {
      return null;
    }
    if (status.accountsRemaining < 3) {
      return 'critical';
    }
    if (status.accountsRemaining < 10) {
      return 'warning';
    }
    return 'normal';
  }

  const warningLevel = getWarningLevel();

  // Loading state
  if (loading) {
    return (
      <div className="funding-panel funding-panel--loading">
        <div className="loading-spinner" />
        <p>Loading funding contract status...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="funding-panel">
        <div className="alert alert--error">
          <span className="alert-icon">!</span>
          {error}
        </div>
        <button className="btn btn--secondary" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

  // Not configured state
  if (!status?.enabled) {
    return (
      <div className="funding-panel">
        <div className="funding-not-configured">
          <div className="funding-not-configured-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h3>Funding Contract Not Configured</h3>
          <p>
            The NEAR funding contract is not configured. Set the following environment variables
            to enable automatic account funding:
          </p>
          <div className="env-instructions">
            <code>NEAR_FUNDING_CONTRACT_ID</code>
            <code>NEAR_BACKEND_ACCOUNT_ID</code>
            <code>NEAR_BACKEND_PRIVATE_KEY</code>
          </div>
          <p className="funding-hint">
            See the deployment documentation for instructions on deploying the funding contract.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="funding-panel">
      {/* Balance Warning Banner */}
      {warningLevel === 'critical' && (
        <div className="funding-warning funding-warning--critical">
          <div className="warning-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <div className="warning-content">
            <strong>CRITICAL: Low Balance</strong>
            <p>
              Only {status.accountsRemaining} account{status.accountsRemaining !== 1 ? 's' : ''} can
              be funded. Top up the contract immediately to avoid registration failures.
            </p>
          </div>
        </div>
      )}

      {warningLevel === 'warning' && (
        <div className="funding-warning funding-warning--warning">
          <div className="warning-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="warning-content">
            <strong>Warning: Balance Running Low</strong>
            <p>
              Only {status.accountsRemaining} accounts remaining. Consider topping up the
              funding contract soon.
            </p>
          </div>
        </div>
      )}

      {/* Contract Status Section */}
      <div className="config-section">
        <h3>Contract Status</h3>
        <div className="funding-stats-grid">
          <div className="funding-stat">
            <span className="funding-stat-label">Contract ID</span>
            <span className="funding-stat-value funding-stat-value--mono">
              {status.contractId}
            </span>
          </div>
          <div className="funding-stat">
            <span className="funding-stat-label">Contract Balance</span>
            <span className="funding-stat-value">{status.balance} NEAR</span>
          </div>
          <div className="funding-stat">
            <span className="funding-stat-label">Available Balance</span>
            <span className="funding-stat-value">{status.availableBalance} NEAR</span>
          </div>
          <div className="funding-stat">
            <span className="funding-stat-label">Amount Per Account</span>
            <span className="funding-stat-value">{status.fundingAmountPerAccount} NEAR</span>
          </div>
          <div className="funding-stat">
            <span className="funding-stat-label">Total Accounts Funded</span>
            <span className="funding-stat-value funding-stat-value--highlight">
              {status.totalAccountsFunded?.toLocaleString()}
            </span>
          </div>
          <div className={`funding-stat ${warningLevel === 'critical' ? 'funding-stat--critical' : warningLevel === 'warning' ? 'funding-stat--warning' : ''}`}>
            <span className="funding-stat-label">Accounts Remaining</span>
            <span className="funding-stat-value funding-stat-value--highlight">
              {status.accountsRemaining?.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Top-up Instructions */}
      <div className="config-section">
        <h3>Top-up Contract</h3>
        <p className="config-section-desc">
          To add more NEAR to the funding contract, use the NEAR CLI:
        </p>
        <div className="cli-command">
          <code>
            near send YOUR_ACCOUNT.testnet {status.contractId} 10
          </code>
          <span className="cli-hint">Replace 10 with desired NEAR amount</span>
        </div>
      </div>

      {/* Account Check Tool */}
      <div className="config-section">
        <h3>Check Account Funding</h3>
        <p className="config-section-desc">
          Enter a 64-character hex implicit account ID to check if it has been funded.
        </p>
        <div className="account-check-form">
          <div className="form-field">
            <input
              type="text"
              className="form-input form-input--mono"
              placeholder="Enter 64-character hex account ID..."
              value={checkAccountId}
              onChange={(e) => setCheckAccountId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCheckAccount()}
              maxLength={64}
            />
          </div>
          <button
            className="btn btn--primary"
            onClick={handleCheckAccount}
            disabled={checking}
          >
            {checking ? 'Checking...' : 'Check'}
          </button>
        </div>

        {checkError && (
          <div className="alert alert--error" style={{ marginTop: '1rem' }}>
            <span className="alert-icon">!</span>
            {checkError}
          </div>
        )}

        {checkResult && (
          <div className={`check-result ${checkResult.funded ? 'check-result--funded' : 'check-result--not-funded'}`}>
            <span className="check-result-icon">
              {checkResult.funded ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22,4 12,14.01 9,11.01" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </span>
            <div className="check-result-content">
              <span className="check-result-account">{checkResult.accountId}</span>
              <span className="check-result-status">
                {checkResult.funded ? 'Account has been funded' : 'Account has NOT been funded'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="config-section">
        <div className="config-section-header-row">
          <h3>Recent Funding Activity</h3>
          <button className="btn btn--sm btn--secondary" onClick={loadData}>
            Refresh
          </button>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">No funding activity recorded yet.</div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Amount</th>
                  <th>Block Height</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, index) => (
                  <tr key={index}>
                    <td>
                      <span className="account-id-cell" title={item.accountId}>
                        {item.accountId.slice(0, 8)}...{item.accountId.slice(-8)}
                      </span>
                    </td>
                    <td>{item.amount}</td>
                    <td>{item.blockHeight?.toLocaleString()}</td>
                    <td className="timestamp">
                      {new Date(item.timestamp).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
