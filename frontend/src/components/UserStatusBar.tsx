/**
 * UserStatusBar Component
 *
 * Compact user info display for header placement.
 * Shows profile icon, truncated name, and connected indicator.
 * Click to expand dropdown with full account details.
 */

import { useState, useRef, useEffect } from 'react';
import { useUser } from '../context/UserContext';
import './UserStatusBar.css';

export function UserStatusBar() {
  const { email, accountId, userDID, mpcRegistered, isAuthenticated } = useUser();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  // Get display name (truncated email or "User")
  const displayName = email || 'User';
  const truncatedName = displayName.length > 20
    ? displayName.substring(0, 17) + '...'
    : displayName;

  // Get initials for avatar
  const initials = displayName
    .split('@')[0]
    .substring(0, 2)
    .toUpperCase();

  return (
    <div className="user-status-bar" ref={dropdownRef}>
      <button
        className="user-status-trigger"
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        aria-expanded={isDropdownOpen}
        aria-haspopup="true"
      >
        <span className="user-avatar">{initials}</span>
        <span className="user-name">{truncatedName}</span>
        <span className="connected-indicator" title="Connected" />
      </button>

      {isDropdownOpen && (
        <div className="user-dropdown">
          <div className="dropdown-header">
            <span className="user-avatar large">{initials}</span>
            <div className="dropdown-user-info">
              <span className="dropdown-email">{email || 'User'}</span>
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
        </div>
      )}
    </div>
  );
}
