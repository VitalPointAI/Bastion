import React, { useState, useEffect } from 'react';
import type { COA } from './types';
import { useYjsDocument, useYjsText } from '../../lib/yjs-hooks';
import { createCOA } from '../../lib/planning-service';
import './COAEditor.css';

interface COAEditorProps {
  planId: string;
  coa: COA | null;
  user: { did: string; name: string; role: string };
  onClose: () => void;
  onSave: () => void;
}

export function COAEditor({
  planId,
  coa,
  user,
  onClose,
  onSave,
}: COAEditorProps) {
  const [name, setName] = useState(coa?.name || '');
  const [description, setDescription] = useState(coa?.description || '');
  const [scheme, setScheme] = useState(coa?.scheme || '');
  const [purpose, setPurpose] = useState(coa?.commandersIntent?.purpose || '');
  const [keyTasks, setKeyTasks] = useState(coa?.commandersIntent?.keyTasks?.join('\n') || '');
  const [endState, setEndState] = useState(coa?.commandersIntent?.endState || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set up Yjs collaboration for this COA
  const documentId = coa ? `coa-${coa.id}` : `coa-new-${planId}`;
  const { doc, connected, connectedUsers } = useYjsDocument({
    documentId,
    planId,
    user: { ...user, color: '' },
  });

  // Sync description with Yjs for collaborative editing
  const descriptionText = doc?.getText('description');
  const yjsDescription = useYjsText(descriptionText ?? null);

  useEffect(() => {
    if (yjsDescription && !description) {
      setDescription(yjsDescription);
    }
  }, [yjsDescription, description]);

  const handleDescriptionChange = (value: string) => {
    setDescription(value);
    if (descriptionText) {
      descriptionText.delete(0, descriptionText.length);
      descriptionText.insert(0, value);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      if (coa) {
        // Update existing COA
        // Would call updateCOA here
      } else {
        // Create new COA
        await createCOA(planId, {
          name,
          description,
          scheme,
          commandersIntent: {
            purpose,
            keyTasks: keyTasks.split('\n').filter(t => t.trim()),
            endState,
          },
        });
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save COA');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="coa-editor-overlay">
      <div className="coa-editor">
        <div className="coa-editor-header">
          <h3>{coa ? `Edit ${coa.name}` : 'New Course of Action'}</h3>
          <div className="collaboration-status">
            {connected ? (
              <span className="connected">
                Connected ({connectedUsers.length} editing)
              </span>
            ) : (
              <span className="disconnected">Connecting...</span>
            )}
          </div>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {connectedUsers.length > 1 && (
          <div className="collaborators">
            {connectedUsers
              .filter(u => u.did !== user.did)
              .map((u, i) => (
                <span
                  key={i}
                  className="collaborator"
                  style={{ backgroundColor: u.color || '#666' }}
                >
                  {u.name}
                </span>
              ))}
          </div>
        )}

        {error && <div className="coa-editor-error">{error}</div>}

        <div className="coa-editor-form">
          <div className="form-group">
            <label>COA Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., COA 1: Direct Assault"
            />
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              placeholder="Brief description of the course of action..."
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>Scheme of Maneuver</label>
            <textarea
              value={scheme}
              onChange={(e) => setScheme(e.target.value)}
              placeholder="Describe the scheme of maneuver..."
              rows={4}
            />
          </div>

          <div className="form-section">
            <h4>Commander's Intent</h4>

            <div className="form-group">
              <label>Purpose</label>
              <input
                type="text"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="What is the purpose of this operation?"
              />
            </div>

            <div className="form-group">
              <label>Key Tasks (one per line)</label>
              <textarea
                value={keyTasks}
                onChange={(e) => setKeyTasks(e.target.value)}
                placeholder="Task 1&#10;Task 2&#10;Task 3"
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>End State</label>
              <input
                type="text"
                value={endState}
                onChange={(e) => setEndState(e.target.value)}
                placeholder="Desired end state..."
              />
            </div>
          </div>
        </div>

        <div className="coa-editor-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="save-btn"
            onClick={handleSave}
            disabled={saving || !name || !description}
          >
            {saving ? 'Saving...' : 'Save COA'}
          </button>
        </div>
      </div>
    </div>
  );
}
