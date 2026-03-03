/**
 * CommanderGuidanceForm Component
 *
 * Commander guidance proposal creation form.
 * Creates CommanderGuidance proposals through the DAO system with assumption modification tracking.
 */

import { useState } from 'react';
import type { CommanderGuidanceData } from '../../types/dao';
import './CommanderGuidanceForm.css';

interface CommanderGuidanceFormProps {
  daoId: string;
  missionId: string;
  existingAssumptions: Array<{ id: string; description: string }>;
  onSubmit: (guidance: CommanderGuidanceData) => void;
}

export function CommanderGuidanceForm({
  daoId,
  missionId,
  existingAssumptions,
  onSubmit,
}: CommanderGuidanceFormProps) {
  const [guidanceText, setGuidanceText] = useState('');
  const [modifiesAssumptions, setModifiesAssumptions] = useState<string[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [errors, setErrors] = useState<{ guidanceText?: string; assumptions?: string }>({});

  const MIN_GUIDANCE_LENGTH = 50;

  // Validate form
  const validate = (): boolean => {
    const newErrors: { guidanceText?: string; assumptions?: string } = {};

    if (guidanceText.trim().length < MIN_GUIDANCE_LENGTH) {
      newErrors.guidanceText = `Guidance must be at least ${MIN_GUIDANCE_LENGTH} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Toggle assumption selection
  const toggleAssumption = (assumptionId: string) => {
    setModifiesAssumptions((prev) =>
      prev.includes(assumptionId)
        ? prev.filter((id) => id !== assumptionId)
        : [...prev, assumptionId]
    );
  };

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const guidance: CommanderGuidanceData = {
      guidance_text: guidanceText.trim(),
      modifies_assumptions: modifiesAssumptions.length > 0,
    };

    onSubmit(guidance);
  };

  // Handle preview toggle
  const handlePreviewToggle = () => {
    if (!showPreview) {
      validate();
    }
    setShowPreview(!showPreview);
  };

  const selectedAssumptions = existingAssumptions.filter((a) =>
    modifiesAssumptions.includes(a.id)
  );

  return (
    <div className="commander-guidance-form">
      <header className="form-header">
        <h2>Issue Commander Guidance</h2>
        <div className="form-info">
          <div className="info-row">
            <span className="info-label">DAO:</span>
            <span className="info-value">{daoId}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Mission:</span>
            <span className="info-value">{missionId}</span>
          </div>
        </div>
      </header>

      <div className="form-notice">
        <span className="notice-icon">ℹ️</span>
        <div className="notice-content">
          <strong>INVARIANT 7: On-Chain Traceability</strong>
          <p>
            Commander guidance will be recorded on-chain for full traceability. This ensures all
            planning decisions are auditable and tamper-proof.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Guidance Text */}
        <div className="form-field">
          <label htmlFor="guidance-text">
            Guidance Text <span className="required">*</span>
          </label>
          <textarea
            id="guidance-text"
            value={guidanceText}
            onChange={(e) => setGuidanceText(e.target.value)}
            placeholder="Provide clear, actionable guidance for the planning staff. Include intent, priorities, and constraints..."
            rows={8}
            className={errors.guidanceText ? 'error' : ''}
          />
          <div className="field-meta">
            <span className={`char-count ${guidanceText.length < MIN_GUIDANCE_LENGTH ? 'insufficient' : 'sufficient'}`}>
              {guidanceText.length} / {MIN_GUIDANCE_LENGTH} minimum characters
            </span>
          </div>
          {errors.guidanceText && <div className="error-message">{errors.guidanceText}</div>}
        </div>

        {/* Assumption Modifiers */}
        <div className="form-field">
          <label htmlFor="assumption-modifiers">Modified Assumptions (Optional)</label>
          <p className="field-description">
            Select assumptions that this guidance modifies, clarifies, or invalidates.
          </p>
          {existingAssumptions.length === 0 ? (
            <div className="no-assumptions">
              <p>No assumptions available for this mission.</p>
            </div>
          ) : (
            <div className="assumption-selector">
              {existingAssumptions.map((assumption) => (
                <div key={assumption.id} className="assumption-option">
                  <input
                    type="checkbox"
                    id={`assumption-${assumption.id}`}
                    checked={modifiesAssumptions.includes(assumption.id)}
                    onChange={() => toggleAssumption(assumption.id)}
                  />
                  <label htmlFor={`assumption-${assumption.id}`}>
                    <span className="assumption-id">{assumption.id}</span>
                    <span className="assumption-description">{assumption.description}</span>
                  </label>
                </div>
              ))}
            </div>
          )}
          {modifiesAssumptions.length > 0 && (
            <div className="selected-count">
              {modifiesAssumptions.length} assumption{modifiesAssumptions.length !== 1 ? 's' : ''} selected
            </div>
          )}
        </div>

        {/* Preview Section */}
        {showPreview && (
          <div className="preview-section">
            <h3>Proposal Preview</h3>
            <div className="preview-content">
              <div className="preview-field">
                <div className="preview-label">Proposal Kind:</div>
                <div className="preview-value">
                  <span className="kind-badge">CommanderGuidance</span>
                </div>
              </div>
              <div className="preview-field">
                <div className="preview-label">DAO:</div>
                <div className="preview-value">{daoId}</div>
              </div>
              <div className="preview-field">
                <div className="preview-label">Mission:</div>
                <div className="preview-value">{missionId}</div>
              </div>
              <div className="preview-field">
                <div className="preview-label">Guidance Text:</div>
                <div className="preview-value guidance-text">{guidanceText || '(empty)'}</div>
              </div>
              {selectedAssumptions.length > 0 && (
                <div className="preview-field">
                  <div className="preview-label">Modifies Assumptions:</div>
                  <div className="preview-value">
                    <ul className="modified-assumptions-list">
                      {selectedAssumptions.map((a) => (
                        <li key={a.id}>
                          <strong>{a.id}:</strong> {a.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <div className="preview-field">
                <div className="preview-label">Classification:</div>
                <div className="preview-value">Uses DAO default classification</div>
              </div>
              <div className="preview-field">
                <div className="preview-label">Autonomy Level:</div>
                <div className="preview-value">NotAutonomous (requires human approval)</div>
              </div>
            </div>
          </div>
        )}

        {/* Form Actions */}
        <div className="form-actions">
          <button
            type="button"
            className="preview-btn"
            onClick={handlePreviewToggle}
          >
            {showPreview ? 'Hide Preview' : 'Show Preview'}
          </button>
          <button
            type="submit"
            className="submit-btn"
            disabled={guidanceText.trim().length < MIN_GUIDANCE_LENGTH}
          >
            Create Proposal
          </button>
        </div>
      </form>
    </div>
  );
}
