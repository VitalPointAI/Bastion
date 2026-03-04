/**
 * RegistrationControlPanel
 *
 * Admin panel for managing registration access control:
 * - Domain whitelist: restrict registration to specific email domains
 * - Email blacklist: block specific email addresses from registering
 */

import { useState, useEffect } from 'react';
import { adminService } from '../../lib/admin-service';
import './RegistrationControlPanel.css';

export function RegistrationControlPanel() {
  // Domain whitelist state
  const [domains, setDomains] = useState<string[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [domainsLoading, setDomainsLoading] = useState(true);

  // Email blacklist state
  const [blockedEmails, setBlockedEmails] = useState<string[]>([]);
  const [newBlockedEmail, setNewBlockedEmail] = useState('');
  const [emailsLoading, setEmailsLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load data on mount
  useEffect(() => {
    loadDomains();
    loadBlockedEmails();
  }, []);

  async function loadDomains() {
    setDomainsLoading(true);
    try {
      const data = await adminService.getEmailDomains();
      setDomains(data.domains);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load domains');
    } finally {
      setDomainsLoading(false);
    }
  }

  async function loadBlockedEmails() {
    setEmailsLoading(true);
    try {
      const data = await adminService.getBlockedEmails();
      setBlockedEmails(data.emails);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load blocked emails');
    } finally {
      setEmailsLoading(false);
    }
  }

  // Domain whitelist actions
  async function handleAddDomain() {
    const domain = newDomain.trim().toLowerCase();
    if (!domain || domains.includes(domain)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = [...domains, domain];
      await adminService.setEmailDomains(updated);
      setDomains(updated);
      setNewDomain('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add domain');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveDomain(domain: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = domains.filter(d => d !== domain);
      if (updated.length === 0) {
        await adminService.clearEmailDomains();
      } else {
        await adminService.setEmailDomains(updated);
      }
      setDomains(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove domain');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearDomains() {
    setSaving(true);
    setError(null);
    try {
      await adminService.clearEmailDomains();
      setDomains([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear domains');
    } finally {
      setSaving(false);
    }
  }

  // Email blacklist actions
  async function handleAddBlockedEmail() {
    const email = newBlockedEmail.trim().toLowerCase();
    if (!email || !email.includes('@') || blockedEmails.includes(email)) return;
    setSaving(true);
    setError(null);
    try {
      const updated = [...blockedEmails, email];
      await adminService.setBlockedEmails(updated);
      setBlockedEmails(updated);
      setNewBlockedEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to block email');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveBlockedEmail(email: string) {
    setSaving(true);
    setError(null);
    try {
      const updated = blockedEmails.filter(e => e !== email);
      if (updated.length === 0) {
        await adminService.clearBlockedEmails();
      } else {
        await adminService.setBlockedEmails(updated);
      }
      setBlockedEmails(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unblock email');
    } finally {
      setSaving(false);
    }
  }

  async function handleClearBlockedEmails() {
    setSaving(true);
    setError(null);
    try {
      await adminService.clearBlockedEmails();
      setBlockedEmails([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear blocked emails');
    } finally {
      setSaving(false);
    }
  }

  const isLoading = domainsLoading || emailsLoading;

  if (isLoading) {
    return (
      <div className="reg-panel reg-panel--loading">
        <p>Loading registration settings...</p>
      </div>
    );
  }

  return (
    <div className="reg-panel">
      {error && (
        <div className="reg-error">
          {error}
          <button className="reg-error-dismiss" onClick={() => setError(null)} type="button">
            Dismiss
          </button>
        </div>
      )}

      {/* Domain Whitelist Section */}
      <section className="reg-section">
        <h3 className="reg-section-title">Domain Whitelist</h3>
        <p className="reg-section-desc">
          Restrict registration to specific email domains. When empty, all domains are allowed.
          {domains.length > 0 && (
            <span className="reg-restriction-badge">
              Restricted to {domains.length} domain{domains.length !== 1 ? 's' : ''}
            </span>
          )}
        </p>

        <div className="reg-input-row">
          <input
            className="reg-input"
            type="text"
            placeholder="e.g. army.mil"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAddDomain(); }}
            disabled={saving}
          />
          <button
            className="reg-btn reg-btn-add"
            onClick={() => void handleAddDomain()}
            disabled={saving || !newDomain.trim()}
            type="button"
          >
            Add Domain
          </button>
        </div>

        {domains.length > 0 && (
          <div className="reg-list">
            {domains.map(domain => (
              <div key={domain} className="reg-list-item">
                <span className="reg-list-value">{domain}</span>
                <button
                  className="reg-btn reg-btn-remove"
                  onClick={() => void handleRemoveDomain(domain)}
                  disabled={saving}
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="reg-btn reg-btn-clear"
              onClick={() => void handleClearDomains()}
              disabled={saving}
              type="button"
            >
              Clear All (Allow All Domains)
            </button>
          </div>
        )}

        {domains.length === 0 && (
          <p className="reg-empty-note">No domain restriction — all email domains are currently allowed.</p>
        )}
      </section>

      {/* Email Blacklist Section */}
      <section className="reg-section">
        <h3 className="reg-section-title">Email Blacklist</h3>
        <p className="reg-section-desc">
          Block specific email addresses from registering.
          {blockedEmails.length > 0 && (
            <span className="reg-restriction-badge reg-badge-red">
              {blockedEmails.length} email{blockedEmails.length !== 1 ? 's' : ''} blocked
            </span>
          )}
        </p>

        <div className="reg-input-row">
          <input
            className="reg-input"
            type="email"
            placeholder="e.g. user@example.com"
            value={newBlockedEmail}
            onChange={(e) => setNewBlockedEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleAddBlockedEmail(); }}
            disabled={saving}
          />
          <button
            className="reg-btn reg-btn-add"
            onClick={() => void handleAddBlockedEmail()}
            disabled={saving || !newBlockedEmail.trim()}
            type="button"
          >
            Block Email
          </button>
        </div>

        {blockedEmails.length > 0 && (
          <div className="reg-list">
            {blockedEmails.map(email => (
              <div key={email} className="reg-list-item">
                <span className="reg-list-value">{email}</span>
                <button
                  className="reg-btn reg-btn-remove"
                  onClick={() => void handleRemoveBlockedEmail(email)}
                  disabled={saving}
                  type="button"
                >
                  Unblock
                </button>
              </div>
            ))}
            <button
              className="reg-btn reg-btn-clear"
              onClick={() => void handleClearBlockedEmails()}
              disabled={saving}
              type="button"
            >
              Clear All (Unblock All)
            </button>
          </div>
        )}

        {blockedEmails.length === 0 && (
          <p className="reg-empty-note">No emails blocked.</p>
        )}
      </section>
    </div>
  );
}
