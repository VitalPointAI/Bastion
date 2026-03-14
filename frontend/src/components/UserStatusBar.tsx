/**
 * UserStatusBar Component
 *
 * Compact user info display for header placement.
 * Shows display name with org email underneath, and connected indicator.
 * Click to expand dropdown with full account details.
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { useAuth } from '../hooks/useAuth';
import './UserStatusBar.css';

export function UserStatusBar() {
  const { displayName, orgEmail, email, accountId, userDID, mpcRegistered, isAuthenticated } = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isDropdownOpen]);

  if (!isAuthenticated) {
    return null;
  }

  // Primary display: displayName > email > 'User'
  const primaryName = displayName || email || 'User';
  const truncatedName = primaryName.length > 20
    ? primaryName.substring(0, 17) + '...'
    : primaryName;

  // Initials from display name or email
  const initials = (displayName || email || 'U')
    .split(/[\s@]/)[0]
    .substring(0, 2)
    .toUpperCase();

  // Secondary line: org email (only if different from primary)
  const secondaryEmail = orgEmail || null;

  return (
    <div className="user-status-bar" ref={dropdownRef}>
      <button
        className="user-status-trigger"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
      >
        <span className="user-avatar">{initials}</span>
        <div className="user-info-stack">
          <span className="user-name">{truncatedName}</span>
          {secondaryEmail && (
            <span className="user-org-email">{secondaryEmail}</span>
          )}
        </div>
        <span className="connected-indicator" title="Connected" />
      </button>

      {isDropdownOpen && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <span className="user-avatar large">{initials}</span>
            <div className="dropdown-user-info">
              <span className="dropdown-email">{primaryName}</span>
              {secondaryEmail && (
                <span className="dropdown-org-email">{secondaryEmail}</span>
              )}
              <span className="dropdown-status">Logged in</span>
            </div>
          </div>

          <div className="dropdown-details">
            {accountId && (
              <div className="detail-row">
                <span className="detail-label">Account ID</span>
                <span className="detail-value" title={accountId}>
                  {accountId.length > 24
                    ? accountId.substring(0, 12) + '...' + accountId.substring(accountId.length - 8)
                    : accountId}
                </span>
              </div>
            )}

            <div className="detail-row">
              <span className="detail-label">DID Status</span>
              <span className={`detail-value status-badge ${userDID ? 'active' : 'pending'}`}>
                {userDID ? 'Active' : 'Pending'}
              </span>
            </div>

            <div className="detail-row">
              <span className="detail-label">MPC Recovery</span>
              <span className={`detail-value status-badge ${mpcRegistered ? 'active' : 'pending'}`}>
                {mpcRegistered ? 'Enabled' : 'Pending'}
              </span>
            </div>
          </div>

          <div className="dropdown-actions">
            <button className="logout-btn" onClick={handleLogout}>
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
