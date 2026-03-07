/**
 * ProblemSetSettings
 *
 * Settings page for a problem set. Provides editable fields for name,
 * description, invite mode, and discoverability.
 * Also hosts TeamRoster in training mode.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProblemSet } from '../../context/ProblemSetContext';
import { useUser } from '../../context/UserContext';
import { useMode } from '../../context/ModeContext';
import { problemSetService, type ProblemSetDetail } from '../../lib/problem-set-service';
import { TeamRoster } from '../exercise/TeamRoster';

type SettingsSection = 'general' | 'team-roster';

export function ProblemSetSettings() {
  const { problemSetId } = useParams<{ problemSetId: string }>();
  const navigate = useNavigate();
  const { activeProblemSetId, setActiveProblemSet, refreshMemberships } = useProblemSet();
  const { userDID } = useUser();
  const { mode } = useMode();

  const [detail, setDetail] = useState<ProblemSetDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [section, setSection] = useState<SettingsSection>('general');

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [inviteMode, setInviteMode] = useState('gated');
  const [discoverability, setDiscoverability] = useState('private');

  const displayId = problemSetId ?? activeProblemSetId ?? '';

  // Sync context
  useEffect(() => {
    if (problemSetId && problemSetId !== activeProblemSetId) {
      setActiveProblemSet(problemSetId);
    }
  }, [problemSetId, activeProblemSetId, setActiveProblemSet]);

  // Fetch detail
  useEffect(() => {
    if (!displayId || !userDID) return;
    let cancelled = false;
    setLoading(true);
    problemSetService.getProblemSet(displayId, userDID)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        setName(d.name);
        setDescription(d.description ?? '');
        setInviteMode(d.inviteMode);
        setDiscoverability(d.discoverability);
      })
      .catch(() => { if (!cancelled) setDetail(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [displayId, userDID]);

  const handleSave = async () => {
    if (!displayId || !userDID) return;
    setSaving(true);
    try {
      const updated = await problemSetService.updateProblemSet(displayId, {
        name: name.trim(),
        description: description.trim() || undefined,
        inviteMode,
        discoverability,
      }, userDID);
      setDetail(updated);
      await refreshMemberships();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64 p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-8 text-center text-gray-500">Problem set not found.</div>
    );
  }

  const hasChanges =
    name.trim() !== detail.name ||
    (description.trim() || '') !== (detail.description ?? '') ||
    inviteMode !== detail.inviteMode ||
    discoverability !== detail.discoverability;

  const sidebarItems: { id: SettingsSection; label: string }[] = [
    { id: 'general', label: 'General' },
    ...(mode === 'training' ? [{ id: 'team-roster' as const, label: 'Team Roster' }] : []),
  ];

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-700 bg-gray-800 px-6 py-4 flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate(`/problem-set/${displayId}`)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          &larr; Back
        </button>
        <h2 className="text-lg font-semibold text-white">Settings</h2>
        <span className="text-sm text-gray-500">{detail.name}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-48 border-r border-gray-700 bg-gray-900 p-3 shrink-0">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSection(item.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors mb-1 ${
                section === item.id
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </aside>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 min-w-0">
          {section === 'general' && (
            <div className="max-w-lg space-y-5">
              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  maxLength={80}
                />
              </div>

              <div>
                <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 resize-y"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Invite Mode</label>
                  <select
                    value={inviteMode}
                    onChange={(e) => setInviteMode(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="open">Open</option>
                    <option value="gated">Invite Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">Discoverability</label>
                  <select
                    value={discoverability}
                    onChange={(e) => setDiscoverability(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="discoverable">Discoverable</option>
                    <option value="private">Private</option>
                  </select>
                </div>
              </div>

              {/* Read-only info */}
              <div className="pt-3 border-t border-gray-700 grid grid-cols-3 gap-3 text-xs text-gray-500">
                <div>
                  <span className="block uppercase tracking-wide mb-0.5">Echelon</span>
                  <span className="text-gray-300 capitalize">{detail.echelon}</span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide mb-0.5">Classification</span>
                  <span className="text-gray-300">{detail.classification}</span>
                </div>
                <div>
                  <span className="block uppercase tracking-wide mb-0.5">Members</span>
                  <span className="text-gray-300">{detail.memberCount}</span>
                </div>
              </div>

              <div className="pt-3">
                <button
                  onClick={() => void handleSave()}
                  disabled={saving || !hasChanges || !name.trim()}
                  className="px-4 py-2 rounded bg-blue-700 hover:bg-blue-600 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}

          {section === 'team-roster' && mode === 'training' && (
            <TeamRoster problemSetId={displayId} />
          )}
        </main>
      </div>
    </div>
  );
}
