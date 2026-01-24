/**
 * NameStep Component
 *
 * Step 1: Name & Classification
 * - Mission name (required, 1-100 chars)
 * - Description (optional)
 * - Classification dropdown
 * - Workspace selector (optional)
 */

import type { MissionFormData } from '../MissionWizard.js';
import './WizardSteps.css';

interface NameStepProps {
  formData: MissionFormData;
  updateFormData: <K extends keyof MissionFormData>(
    field: K,
    value: MissionFormData[K]
  ) => void;
}

export function NameStep({ formData, updateFormData }: NameStepProps) {
  return (
    <div className="wizard-step-content name-step">
      <h3>Mission Name & Classification</h3>
      <p className="step-description">
        Provide basic information about the mission.
      </p>

      <div className="form-group">
        <label htmlFor="mission-name">
          Mission Name <span className="required">*</span>
        </label>
        <input
          id="mission-name"
          type="text"
          value={formData.name}
          onChange={(e) => updateFormData('name', e.target.value)}
          placeholder="Operation Northern Shield"
          maxLength={100}
          required
        />
        <span className="help-text">
          {formData.name.length}/100 characters
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="mission-description">Description</label>
        <textarea
          id="mission-description"
          value={formData.description}
          onChange={(e) => updateFormData('description', e.target.value)}
          placeholder="Brief description of the mission objectives and scope..."
          rows={4}
        />
        <span className="help-text">Optional - provide context for participants</span>
      </div>

      <div className="form-group">
        <label htmlFor="mission-classification">
          Classification <span className="required">*</span>
        </label>
        <select
          id="mission-classification"
          value={formData.classification}
          onChange={(e) =>
            updateFormData(
              'classification',
              e.target.value as 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET'
            )
          }
        >
          <option value="UNCLASSIFIED">UNCLASSIFIED</option>
          <option value="SECRET">SECRET</option>
          <option value="TOPSECRET">TOP SECRET</option>
        </select>
        <span className="help-text">
          Determines who can access this mission
        </span>
      </div>

      <div className="form-group">
        <label htmlFor="mission-workspace">Workspace (Optional)</label>
        <input
          id="mission-workspace"
          type="text"
          value={formData.workspaceId}
          onChange={(e) => updateFormData('workspaceId', e.target.value)}
          placeholder="WS-12345"
        />
        <span className="help-text">
          Link to existing strategic workspace from Phase 4.3
        </span>
      </div>
    </div>
  );
}
