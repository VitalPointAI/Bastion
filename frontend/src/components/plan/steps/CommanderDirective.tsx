/**
 * CommanderDirective
 *
 * Phase 36 Plan 04: Step 3 content component for the Commander's Directive.
 * Provides structured fields for commander's intent, planning guidance,
 * directive sections, finalization controls, and version history.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { sgService } from '../../../lib/strategic-guidance-service.ts';
import { DirectiveVersionHistory } from '../DirectiveVersionHistory.tsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommandersIntent {
  purpose: string;
  keyTasks: string[];
  endState: string;
  constraints: string[];
  criticalFactors: string[];
}

interface DirectiveSection {
  id: string;
  title: string;
  content: string;
}

type DirectiveStatus = 'draft' | 'review' | 'finalized';

interface DirectiveContent {
  commandersIntent: CommandersIntent;
  planningGuidance: string;
  directiveSections: DirectiveSection[];
  additionalGuidance: string;
  status: DirectiveStatus;
  finalizedAt: string | null;
  finalizedBy: string | null;
}

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_SECTIONS: DirectiveSection[] = [
  { id: 'sec-1', title: 'Strategic Objectives', content: '' },
  { id: 'sec-2', title: 'Concept of Operations', content: '' },
  { id: 'sec-3', title: 'Coordinating Instructions', content: '' },
];

const EMPTY_CONTENT: DirectiveContent = {
  commandersIntent: {
    purpose: '',
    keyTasks: [],
    endState: '',
    constraints: [],
    criticalFactors: [],
  },
  planningGuidance: '',
  directiveSections: DEFAULT_SECTIONS,
  additionalGuidance: '',
  status: 'draft',
  finalizedAt: null,
  finalizedBy: null,
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommanderDirectiveProps {
  problemSetId: string;
  instanceId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommanderDirective({
  problemSetId: _problemSetId,
  instanceId,
}: CommanderDirectiveProps) {
  const [content, setContent] = useState<DirectiveContent>(EMPTY_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [versionRefresh, setVersionRefresh] = useState(0);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Load step content
  // -------------------------------------------------------------------------

  const loadContent = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sgService.getStepContent(instanceId, 'commander_directive');
      if (data && data.content) {
        const loaded = data.content as unknown as DirectiveContent;
        setContent({
          ...EMPTY_CONTENT,
          ...loaded,
          commandersIntent: {
            ...EMPTY_CONTENT.commandersIntent,
            ...(loaded.commandersIntent || {}),
          },
          directiveSections:
            loaded.directiveSections && loaded.directiveSections.length > 0
              ? loaded.directiveSections
              : DEFAULT_SECTIONS,
        });
      }
    } catch (err) {
      // If not found, use defaults
      if (!(err instanceof Error && err.message.includes('Not found'))) {
        console.error('[CommanderDirective] Failed to load content:', err);
      }
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // -------------------------------------------------------------------------
  // Auto-save (debounced)
  // -------------------------------------------------------------------------

  const saveContent = useCallback(
    async (updated: DirectiveContent) => {
      try {
        setSaving(true);
        await sgService.saveStepContent(instanceId, 'commander_directive', updated as unknown as Record<string, unknown>);
      } catch (err) {
        console.error('[CommanderDirective] Auto-save failed:', err);
      } finally {
        setSaving(false);
      }
    },
    [instanceId],
  );

  const debouncedSave = useCallback(
    (updated: DirectiveContent) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => saveContent(updated), 500);
    },
    [saveContent],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // -------------------------------------------------------------------------
  // Content update helper
  // -------------------------------------------------------------------------

  function updateContent(patch: Partial<DirectiveContent>) {
    const updated = { ...content, ...patch };
    setContent(updated);
    debouncedSave(updated);
  }

  function updateIntent(patch: Partial<CommandersIntent>) {
    const updatedIntent = { ...content.commandersIntent, ...patch };
    updateContent({ commandersIntent: updatedIntent });
  }

  // -------------------------------------------------------------------------
  // Status transitions
  // -------------------------------------------------------------------------

  async function handleSubmitForReview() {
    const updated = { ...content, status: 'review' as DirectiveStatus };
    setContent(updated);
    await saveContent(updated);
  }

  async function handleFinalize() {
    try {
      await sgService.finalizeDirective(instanceId);
      const updated: DirectiveContent = {
        ...content,
        status: 'finalized',
        finalizedAt: new Date().toISOString(),
        finalizedBy: 'commander',
      };
      setContent(updated);
      setVersionRefresh((v) => v + 1);
      setShowConfirmModal(false);
    } catch (err) {
      console.error('[CommanderDirective] Finalization failed:', err);
      setShowConfirmModal(false);
    }
  }

  async function handleCreateNewVersion() {
    const updated: DirectiveContent = {
      ...content,
      status: 'draft',
      finalizedAt: null,
      finalizedBy: null,
    };
    setContent(updated);
    await saveContent(updated);
  }

  // -------------------------------------------------------------------------
  // List editors (keyTasks, constraints, criticalFactors)
  // -------------------------------------------------------------------------

  function renderEditableList(
    label: string,
    items: string[],
    onChange: (items: string[]) => void,
    disabled: boolean,
  ) {
    return (
      <div style={{ marginBottom: '0.75rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.25rem' }}>
          {label}
        </label>
        {items.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem' }}>
            <input
              type="text"
              value={item}
              disabled={disabled}
              onChange={(e) => {
                const next = [...items];
                next[idx] = e.target.value;
                onChange(next);
              }}
              style={{
                flex: 1,
                padding: '0.375rem 0.5rem',
                backgroundColor: 'rgba(55, 65, 81, 0.5)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '0.25rem',
                color: '#e5e7eb',
                fontSize: '0.8rem',
              }}
            />
            <button
              disabled={disabled}
              onClick={() => {
                const next = items.filter((_, i) => i !== idx);
                onChange(next);
              }}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '0.25rem',
                color: '#f87171',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '0.7rem',
              }}
            >
              Remove
            </button>
          </div>
        ))}
        <button
          disabled={disabled}
          onClick={() => onChange([...items, ''])}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0.25rem',
            color: '#60a5fa',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontSize: '0.7rem',
          }}
        >
          + Add
        </button>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={{ color: '#9ca3af', padding: '1rem', fontSize: '0.85rem' }}>
        Loading commander's directive...
      </div>
    );
  }

  const isFinalized = content.status === 'finalized';
  const isReview = content.status === 'review';
  const isDisabled = isFinalized;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '0.5rem 0' }}>
      {/* Save indicator */}
      {saving && (
        <div style={{ fontSize: '0.7rem', color: '#fbbf24', textAlign: 'right' }}>Saving...</div>
      )}

      {/* 1. Commander's Intent */}
      <section>
        <h3 style={{ margin: '0 0 0.625rem', fontSize: '0.95rem', fontWeight: 600, color: '#93c5fd' }}>
          Commander's Intent
        </h3>

        {/* Purpose */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.25rem' }}>
            Purpose
          </label>
          <textarea
            value={content.commandersIntent.purpose}
            disabled={isDisabled}
            onChange={(e) => updateIntent({ purpose: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '0.25rem',
              color: '#e5e7eb',
              fontSize: '0.8rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Key Tasks */}
        {renderEditableList(
          'Key Tasks',
          content.commandersIntent.keyTasks,
          (items) => updateIntent({ keyTasks: items }),
          isDisabled,
        )}

        {/* End State */}
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.25rem' }}>
            End State
          </label>
          <textarea
            value={content.commandersIntent.endState}
            disabled={isDisabled}
            onChange={(e) => updateIntent({ endState: e.target.value })}
            rows={3}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'rgba(55, 65, 81, 0.5)',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '0.25rem',
              color: '#e5e7eb',
              fontSize: '0.8rem',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Constraints */}
        {renderEditableList(
          'Constraints',
          content.commandersIntent.constraints,
          (items) => updateIntent({ constraints: items }),
          isDisabled,
        )}

        {/* Critical Factors */}
        {renderEditableList(
          'Critical Factors',
          content.commandersIntent.criticalFactors,
          (items) => updateIntent({ criticalFactors: items }),
          isDisabled,
        )}
      </section>

      {/* 2. Planning Guidance */}
      <section>
        <h3 style={{ margin: '0 0 0.625rem', fontSize: '0.95rem', fontWeight: 600, color: '#93c5fd' }}>
          Planning Guidance
        </h3>
        <textarea
          value={content.planningGuidance}
          disabled={isDisabled}
          onChange={(e) => updateContent({ planningGuidance: e.target.value })}
          rows={6}
          placeholder="Enter commander's planning guidance for subordinate commands..."
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: 'rgba(55, 65, 81, 0.5)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '0.25rem',
            color: '#e5e7eb',
            fontSize: '0.8rem',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </section>

      {/* 3. Directive Sections */}
      <section>
        <h3 style={{ margin: '0 0 0.625rem', fontSize: '0.95rem', fontWeight: 600, color: '#93c5fd' }}>
          Directive Sections
        </h3>
        {content.directiveSections.map((sec, idx) => (
          <div
            key={sec.id}
            style={{
              marginBottom: '0.75rem',
              padding: '0.625rem',
              border: '1px solid rgba(107, 114, 128, 0.2)',
              borderRadius: '0.25rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.375rem' }}>
              <input
                type="text"
                value={sec.title}
                disabled={isDisabled}
                onChange={(e) => {
                  const next = [...content.directiveSections];
                  next[idx] = { ...next[idx], title: e.target.value };
                  updateContent({ directiveSections: next });
                }}
                style={{
                  flex: 1,
                  padding: '0.375rem 0.5rem',
                  backgroundColor: 'rgba(55, 65, 81, 0.5)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              />
              <button
                disabled={isDisabled}
                onClick={() => {
                  const next = content.directiveSections.filter((_, i) => i !== idx);
                  updateContent({ directiveSections: next });
                }}
                style={{
                  padding: '0.25rem 0.5rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#f87171',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontSize: '0.7rem',
                }}
              >
                Remove
              </button>
            </div>
            <textarea
              value={sec.content}
              disabled={isDisabled}
              onChange={(e) => {
                const next = [...content.directiveSections];
                next[idx] = { ...next[idx], content: e.target.value };
                updateContent({ directiveSections: next });
              }}
              rows={4}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: 'rgba(55, 65, 81, 0.5)',
                border: '1px solid rgba(107, 114, 128, 0.3)',
                borderRadius: '0.25rem',
                color: '#e5e7eb',
                fontSize: '0.8rem',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>
        ))}
        <button
          disabled={isDisabled}
          onClick={() => {
            const id = `sec-${Date.now()}`;
            updateContent({
              directiveSections: [
                ...content.directiveSections,
                { id, title: 'New Section', content: '' },
              ],
            });
          }}
          style={{
            padding: '0.375rem 0.75rem',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.3)',
            borderRadius: '0.25rem',
            color: '#60a5fa',
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            fontSize: '0.75rem',
          }}
        >
          + Add Section
        </button>
      </section>

      {/* 4. Additional Commander Guidance */}
      <section>
        <h3 style={{ margin: '0 0 0.625rem', fontSize: '0.95rem', fontWeight: 600, color: '#93c5fd' }}>
          Additional Commander Guidance
        </h3>
        <textarea
          value={content.additionalGuidance}
          disabled={isDisabled}
          onChange={(e) => updateContent({ additionalGuidance: e.target.value })}
          rows={4}
          placeholder="Enter any additional direction or guidance..."
          style={{
            width: '100%',
            padding: '0.5rem',
            backgroundColor: 'rgba(55, 65, 81, 0.5)',
            border: '1px solid rgba(107, 114, 128, 0.3)',
            borderRadius: '0.25rem',
            color: '#e5e7eb',
            fontSize: '0.8rem',
            resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
      </section>

      {/* 5. Status & Finalization */}
      <section
        style={{
          padding: '0.75rem',
          border: '1px solid rgba(107, 114, 128, 0.3)',
          borderRadius: '0.375rem',
          backgroundColor: 'rgba(55, 65, 81, 0.2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Status badge */}
          <span
            style={{
              padding: '0.25rem 0.625rem',
              borderRadius: '0.25rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor:
                content.status === 'finalized'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : content.status === 'review'
                    ? 'rgba(234, 179, 8, 0.15)'
                    : 'rgba(107, 114, 128, 0.2)',
              color:
                content.status === 'finalized'
                  ? '#4ade80'
                  : content.status === 'review'
                    ? '#fbbf24'
                    : '#9ca3af',
            }}
          >
            {content.status === 'finalized'
              ? 'Finalized'
              : content.status === 'review'
                ? 'In Review'
                : 'Draft'}
          </span>

          {/* Finalized date */}
          {isFinalized && content.finalizedAt && (
            <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
              {new Date(content.finalizedAt).toLocaleDateString()}
            </span>
          )}

          {/* Action buttons */}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
            {content.status === 'draft' && (
              <button
                onClick={handleSubmitForReview}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'rgba(234, 179, 8, 0.15)',
                  border: '1px solid rgba(234, 179, 8, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#fbbf24',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Submit for Review
              </button>
            )}

            {isReview && (
              <button
                onClick={() => setShowConfirmModal(true)}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  border: '1px solid rgba(34, 197, 94, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#4ade80',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Finalize Directive
              </button>
            )}

            {isFinalized && (
              <button
                onClick={handleCreateNewVersion}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#60a5fa',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                }}
              >
                Create New Version
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: '#1f2937',
              border: '1px solid rgba(107, 114, 128, 0.3)',
              borderRadius: '0.5rem',
              padding: '1.5rem',
              maxWidth: '28rem',
              width: '90%',
            }}
          >
            <h3 style={{ margin: '0 0 0.75rem', color: '#e5e7eb', fontSize: '1rem' }}>
              Finalize Strategic Directive?
            </h3>
            <p style={{ margin: '0 0 1.25rem', color: '#9ca3af', fontSize: '0.85rem', lineHeight: 1.5 }}>
              This will create a versioned directive and notify child campaign problem sets. Continue?
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'rgba(107, 114, 128, 0.2)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  borderRadius: '0.25rem',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleFinalize}
                style={{
                  padding: '0.375rem 0.75rem',
                  backgroundColor: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  borderRadius: '0.25rem',
                  color: '#4ade80',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                Finalize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Version History */}
      <DirectiveVersionHistory
        instanceId={instanceId}
        currentVersion={undefined}
        refreshSignal={versionRefresh}
      />
    </div>
  );
}
