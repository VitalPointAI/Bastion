/**
 * Problem SetSwitcher
 *
 * Compact dropdown button in the nav bar for problem set navigation.
 * - Shows active problem set abbreviation as the trigger label
 * - Dropdown lists all problem sets with type icons, badges, notifications
 * - "+" button at bottom to create a new problem set
 * - Closes on outside click
 *
 * Styled with Problem SetSwitcher.css (plain CSS, no Tailwind).
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { problemSetService } from '../../lib/problem-set-service';
import { CreateProblemSetWizard } from './CreateProblemSetWizard';
import { NotificationBadge } from './NotificationBadge';
import './ProblemSetSwitcher.css';

// ─── Type label maps ─────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  Organization: 'O',
  Unit: 'U',
  Team: 'T',
};

const TYPE_ICON_CLASS: Record<string, string> = {
  Organization: 'org',
  Unit: 'unit',
  Team: 'team',
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ProblemSetSwitcher() {
  const { memberships, activeProblemSetId, notificationCounts, primaryProblemSetId, setActiveProblemSet, refreshMemberships } =
    useProblemSet();
  const { userDID } = useUser();
  const navigate = useNavigate();
  const [showWizard, setShowWizard] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Sort: primary problem set first, then alphabetically
  const sorted = [...memberships].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1;
    if (!a.isPrimary && b.isPrimary) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleProblemSetClick = (problemSetId: string) => {
    setActiveProblemSet(problemSetId);
    navigate(`/problem-set/${problemSetId}`);
    setIsOpen(false);
  };

  const handleDelete = async (problemSetId: string) => {
    if (!userDID) return;
    setDeleting(true);
    try {
      await problemSetService.deleteProblemSet(problemSetId, userDID);
      setDeleteTarget(null);
      if (activeProblemSetId === problemSetId) {
        // Navigate back to selector if we deleted the active one
        navigate('/');
      }
      await refreshMemberships();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const handleCreated = async (problemSetId: string, options?: { navigateTo?: string }) => {
    setShowWizard(false);
    await refreshMemberships();
    setActiveProblemSet(problemSetId);
    const path = options?.navigateTo
      ? `/problem-set/${problemSetId}/${options.navigateTo}`
      : `/problem-set/${problemSetId}`;
    navigate(path);
  };

  // Abbreviation: first letters of each word, max 2, uppercase
  const getAbbreviation = (name: string) =>
    (name || 'PS')
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'PS';

  // Active problem set info for trigger label
  const activeWs = memberships.find((m) => m.problemSetId === activeProblemSetId);
  const triggerAbbrev = activeWs ? getAbbreviation(activeWs.name) : 'PS';

  // Total unread notifications across all non-active problem sets
  const totalNotifs = sorted
    .filter((ws) => ws.problemSetId !== activeProblemSetId)
    .reduce((sum, ws) => sum + (notificationCounts[ws.problemSetId] ?? 0), 0);

  return (
    <>
      <div className="ws-switcher" ref={containerRef} aria-label="Problem Set switcher">
        <button
          className={`ws-switcher-trigger${isOpen ? ' open' : ''}`}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title={activeWs ? `${activeWs.name} (${activeWs.echelon})` : 'Problem Sets'}
        >
          <span className="ws-trigger-abbrev">{triggerAbbrev}</span>
          {totalNotifs > 0 && <span className="ws-notif-dot" />}
          <span className="ws-trigger-caret">&#9660;</span>
        </button>

        {isOpen && (
          <div className="ws-switcher-dropdown" role="listbox">
            <div className="ws-dropdown-header">Problem Sets</div>

            <div className="ws-list">
              {sorted.map((ws) => {
                const isActive = ws.problemSetId === activeProblemSetId;
                const isPrimary = ws.problemSetId === primaryProblemSetId;
                const notifCount = notificationCounts[ws.problemSetId] ?? 0;
                const abbreviation = getAbbreviation(ws.name);
                const iconClass = TYPE_ICON_CLASS[ws.echelon] ?? 'org';
                const isDeleteTarget = deleteTarget === ws.problemSetId;

                return (
                  <div key={ws.problemSetId} className="ws-item-row">
                    {isDeleteTarget ? (
                      <div className="ws-delete-confirm">
                        <span className="ws-delete-confirm-text">Delete {ws.name}?</span>
                        <div className="ws-delete-confirm-actions">
                          <button
                            className="ws-delete-cancel-btn"
                            onClick={() => setDeleteTarget(null)}
                            disabled={deleting}
                          >
                            Cancel
                          </button>
                          <button
                            className="ws-delete-confirm-btn"
                            onClick={() => handleDelete(ws.problemSetId)}
                            disabled={deleting}
                          >
                            {deleting ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        className={`ws-item${isActive ? ' active' : ''}`}
                        onClick={() => handleProblemSetClick(ws.problemSetId)}
                        role="option"
                        aria-selected={isActive}
                        aria-label={`Switch to ${ws.name} (${ws.echelon})`}
                      >
                        {/* Problem Set icon */}
                        <div className={`ws-item-icon ${iconClass}`}>
                          <span>{abbreviation}</span>
                          <span className="ws-item-type-badge">{TYPE_LABEL[ws.echelon] ?? '?'}</span>
                          {isPrimary && <span className="ws-item-primary-star">★</span>}
                        </div>

                        {/* Text content */}
                        <div className="ws-item-text">
                          <span className="ws-item-name">{ws.name}</span>
                          <span className="ws-item-meta">{ws.echelon} · {ws.role}</span>
                        </div>

                        {/* Active indicator */}
                        {isActive && <span className="ws-item-active-dot" />}

                        {/* Notification badge — hidden for active problem set */}
                        {!isActive && notifCount > 0 && (
                          <span className="ws-item-notif">{notifCount}</span>
                        )}

                        {/* NotificationBadge component (for pulse animation) */}
                        {!isActive && (
                          <NotificationBadge count={notifCount} />
                        )}

                        {/* Delete button — visible on hover */}
                        <button
                          className="ws-item-delete"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(ws.problemSetId);
                          }}
                          aria-label={`Delete ${ws.name}`}
                          title="Delete problem set"
                        >
                          ✕
                        </button>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {sorted.length > 0 && <hr className="ws-dropdown-divider" />}

            {/* Create new problem set */}
            <button
              className="ws-create-btn"
              onClick={() => { setShowWizard(true); setIsOpen(false); }}
              aria-label="Create new problem set"
            >
              <span className="ws-create-icon">+</span>
              <span>Create new problem set</span>
            </button>
          </div>
        )}
      </div>

      {/* Create problem set modal */}
      {showWizard && (
        <CreateProblemSetWizard
          onClose={() => setShowWizard(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}
