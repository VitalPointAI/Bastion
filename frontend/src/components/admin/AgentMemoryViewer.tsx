/**
 * AgentMemoryViewer Component
 *
 * Phase 51: Memory browser for agent memory entries.
 *
 * Tabbed view: Knowledge | Working | Episodes
 * Each tab shows list of memory entries with delete confirmation.
 */

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../lib/admin-service';
import type { AgentMemoryEntry } from '../../types/admin';

interface AgentMemoryViewerProps {
  agentId: string;
}

type MemoryTab = 'knowledge' | 'working' | 'episode';

const TABS: Array<{ key: MemoryTab; label: string }> = [
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'working', label: 'Working' },
  { key: 'episode', label: 'Episodes' },
];

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function importanceBar(importance: number) {
  const pct = Math.round(importance * 100);
  const color = importance > 0.7 ? '#22c55e' : importance > 0.4 ? '#f59e0b' : '#9ca3af';
  return (
    <div className="memory-importance">
      <div className="memory-importance__bar">
        <div
          className="memory-importance__fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="memory-importance__label">{pct}%</span>
    </div>
  );
}

export function AgentMemoryViewer({ agentId }: AgentMemoryViewerProps) {
  const [activeTab, setActiveTab] = useState<MemoryTab>('knowledge');
  const [entries, setEntries] = useState<AgentMemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AgentMemoryEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadEntries = useCallback(async (tab: MemoryTab) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await adminService.listAgentMemory(agentId, tab);
      setEntries(response.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load memory');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    loadEntries(activeTab);
  }, [activeTab, loadEntries]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await adminService.deleteAgentMemoryEntry(agentId, deleteTarget.entryId);
      setDeleteTarget(null);
      await loadEntries(activeTab);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete entry');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="memory-viewer">
      <div className="memory-viewer__tabs">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`memory-viewer__tab${activeTab === tab.key ? ' memory-viewer__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="alert alert--error" style={{ margin: '8px 0' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="memory-viewer__loading">
          <div className="loading-spinner" />
          <span>Loading {activeTab} memory...</span>
        </div>
      ) : entries.length === 0 ? (
        <div className="memory-viewer__empty">
          <p>No {activeTab} memory entries for this agent.</p>
        </div>
      ) : (
        <div className="memory-viewer__list">
          {entries.map((entry) => (
            <div key={entry.entryId} className="memory-entry">
              <div className="memory-entry__header">
                <div className="memory-entry__meta">
                  {entry.category && (
                    <span className="memory-entry__category">{entry.category}</span>
                  )}
                  <span className="memory-entry__date">{formatDate(entry.createdAt)}</span>
                  {entry.taskId && (
                    <span className="memory-entry__task" title={`Task: ${entry.taskId}`}>
                      Task
                    </span>
                  )}
                </div>
                {importanceBar(entry.importance)}
                <button
                  className="btn btn--sm btn--danger"
                  onClick={() => setDeleteTarget(entry)}
                  title="Delete this memory entry"
                >
                  Delete
                </button>
              </div>
              <div className="memory-entry__content">
                <p>{entry.content}</p>
              </div>
              {entry.lastAccessed && (
                <div className="memory-entry__accessed">
                  Last accessed: {formatDate(entry.lastAccessed)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header--danger">
              <h3>Delete Memory Entry</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete this memory entry?</p>
              <div className="memory-entry__content" style={{ margin: '12px 0', opacity: 0.7 }}>
                <p style={{ fontSize: '0.8rem' }}>
                  {deleteTarget.content.substring(0, 200)}
                  {deleteTarget.content.length > 200 ? '...' : ''}
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn--secondary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Entry'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
