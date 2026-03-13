/**
 * FundingPanel Component
 *
 * Admin panel for monitoring and managing the NEAR funder account.
 * Shows balance, accounts remaining, funding history, and account check tool.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  adminService,
  type FundingStatus,
  type FundingHistoryItem,
} from '../../lib/admin-service';
import './FundingPanel.css';

// Auto-refresh interval (30 seconds)
const REFRESH_INTERVAL_MS = 30_000;

export function FundingPanel() {
  const [status, setStatus] = useState<FundingStatus | null>(null);
  const [history, setHistory] = useState<FundingHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Account check state
  const [checkAccountId, setCheckAccountId] = useState('');
  const [checkResult, setCheckResult] = useState<{
    accountId: string;
    funded: boolean;
  } | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Copy-to-clipboard state
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(prev => prev || !status); // only show spinner on first load
    setError(null);

    try {
      const [statusResult, historyResult] = await Promise.all([
        adminService.getFundingStatus(),
        adminService.getFundingHistory(0, 20),
      ]);

      setStatus(statusResult);
      setHistory(historyResult.history || []);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load funding data');
    } finally {
      setLoading(false);
    }
  }, [status]);

  // Initial load + auto-refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCheckAccount() {
    if (!checkAccountId.trim()) {
      setCheckError('Please enter an account ID');
      return;
    }

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

  async function handleCopyCommand() {
    const cmd = `near send YOUR_ACCOUNT.testnet ${status?.funderAccountId} 10`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  }

  // Warning levels based on accounts remaining
  function getWarningLevel(): 'critical' | 'warning' | 'normal' | null {
    if (!status?.enabled || status.accountsRemaining === undefined) return null;
    if (status.accountsRemaining < 3) return 'critical';
    if (status.accountsRemaining < 10) return 'warning';
    return 'normal';
  }

  const warningLevel = getWarningLevel();

  // Loading state (first load only)
  if (loading && !status) {
    return (
      <div className="funding-panel funding-panel--loading">
        <div className="loading-spinner" />
        <p>Loading funder account status...</p>
      </div>
    );
  }

  // Error state
  if (error && !status) {
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
          <h3>Funder Account Not Configured</h3>
          <p>
            The NEAR funder account is not configured. Set the following environment variables
            to enable automatic account funding:
          </p>
          <div className="env-instructions">
            <code>NEAR_FUNDER_ACCOUNT_ID</code>
            <code>NEAR_FUNDER_PRIVATE_KEY</code>
          </div>
          <p className="funding-hint">
            The funder account sends NEAR directly to new implicit accounts.
            No smart contract required.
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
              be funded. Top up the funder account immediately to avoid registration failures.
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
              Only {status.accountsRemaining} accounts remaining. Consider topping up soon.
            </p>
          </div>
        </div>
      )}

      {/* Funder Account Status */}
      <div className="config-section">
        <div className="config-section-header-row">
          <h3>Funder Account Status</h3>
          <div className="header-actions">
            {lastRefresh && (
              <span className="last-refresh">
                Updated {lastRefresh.toLocaleTimeString()}
              </span>
            )}
            <button className="btn btn--sm btn--secondary" onClick={loadData}>
              Refresh
            </button>
          </div>
        </div>
        <div className="funding-stats-grid">
          <div className="funding-stat">
            <span className="funding-stat-label">Account ID</span>
            <span className="funding-stat-value funding-stat-value--mono">
              {status.funderAccountId}
            </span>
          </div>
          <div className="funding-stat">
            <span className="funding-stat-label">Total Balance</span>
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
            <span className="funding-stat-label">Funded This Session</span>
            <span className="funding-stat-value funding-stat-value--highlight">
              {status.totalFundedThisSession?.toLocaleString() ?? 0}
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

      {/* Top-up Section */}
      <div className="config-section">
        <h3>Top Up Funder Account</h3>
        <p className="config-section-desc">
          Send NEAR to <strong>{status.funderAccountId}</strong> to increase the funding balance.
          Use any NEAR wallet or the CLI command below:
        </p>
        <div className="cli-command">
          <div className="cli-command-row">
            <code>
              near send YOUR_ACCOUNT.testnet {status.funderAccountId} 10
            </code>
            <button
              className="btn btn--sm btn--ghost"
              onClick={handleCopyCommand}
              title="Copy to clipboard"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <span className="cli-hint">Replace YOUR_ACCOUNT.testnet with your funded account and 10 with desired NEAR amount</span>
        </div>
        <div className="topup-methods">
          <div className="topup-method">
            <span className="topup-method-label">Via NEAR Wallet</span>
            <span className="topup-method-desc">
              Send any amount of NEAR to <code>{status.funderAccountId}</code>
            </span>
          </div>
          <div className="topup-method">
            <span className="topup-method-label">Via Explorer</span>
            <span className="topup-method-desc">
              View account on{' '}
              <a
                href={`https://testnet.nearblocks.io/address/${status.funderAccountId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="explorer-link"
              >
                NearBlocks Explorer
              </a>
            </span>
          </div>
        </div>
      </div>

      {/* Account Check Tool */}
      <div className="config-section">
        <h3>Check Account Funding</h3>
        <p className="config-section-desc">
          Enter a 64-character hex implicit account ID to check if it exists on-chain.
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
                {checkResult.funded ? 'Account exists on-chain (funded)' : 'Account does NOT exist on-chain'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="config-section">
        <div className="config-section-header-row">
          <h3>Recent Funding Activity</h3>
          <span className="session-note">This session only</span>
        </div>

        {history.length === 0 ? (
          <div className="empty-state">No funding activity this session.</div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Account ID</th>
                  <th>Amount</th>
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
