/**
 * MissionWizard Component
 *
 * Multi-step wizard for creating new missions with:
 * 1. Name & Classification
 * 2. Area of Operations (Map Drawing)
 * 3. Participants (Invite Collection)
 * 4. Review & Create
 */

import { useState, useCallback } from 'react';
import { missionService, type CreateMissionInput, type GeoJSONPolygon, type ParticipantRole } from '../../../lib/mission-service.js';
import { NameStep } from './steps/NameStep.js';
import { AreaStep } from './steps/AreaStep.js';
import { ParticipantsStep } from './steps/ParticipantsStep.js';
import { ReviewStep } from './steps/ReviewStep.js';
import './MissionWizard.css';

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 1, title: 'Name & Classification', description: 'Basic mission information' },
  { id: 2, title: 'Area of Operations', description: 'Define operational area' },
  { id: 3, title: 'Participants', description: 'Invite team members' },
  { id: 4, title: 'Review', description: 'Review and create' },
];

export interface PendingInvite {
  inviteeDID?: string;
  email?: string;
  role: ParticipantRole;
  expiresInHours: number;
}

export interface MissionFormData {
  name: string;
  description: string;
  classification: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
  problemSetId: string;
  areaOfOperations: GeoJSONPolygon | null;
  pendingInvites: PendingInvite[];
}

interface MissionWizardProps {
  userDID: string;
  onClose: () => void;
  onMissionCreated: (missionId: string) => void;
}

export function MissionWizard({ userDID, onClose, onMissionCreated }: MissionWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<MissionFormData>({
    name: '',
    description: '',
    classification: 'UNCLASSIFIED',
    problemSetId: '',
    areaOfOperations: null,
    pendingInvites: [],
  });

  // Update form data
  const updateFormData = useCallback(<K extends keyof MissionFormData>(
    field: K,
    value: MissionFormData[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Validate current step
  const validateStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        // Name is required
        return formData.name.trim().length > 0 && formData.name.length <= 100;
      case 2:
        // Area of operations is optional
        return true;
      case 3:
        // Participants are optional
        return true;
      case 4:
        // Review step
        return true;
      default:
        return true;
    }
  }, [currentStep, formData.name]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (!validateStep()) {
      setError('Please complete all required fields');
      return;
    }
    setError(null);
    setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length));
  }, [validateStep]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  // Create mission
  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      const createInput: CreateMissionInput = {
        name: formData.name,
        description: formData.description || undefined,
        classification: formData.classification,
        problemSetId: formData.problemSetId || undefined,
        areaOfOperations: formData.areaOfOperations || undefined,
        pendingInvites: formData.pendingInvites.length > 0 ? formData.pendingInvites : undefined,
      };

      const mission = await missionService.createMission(createInput, userDID);
      onMissionCreated(mission.missionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <NameStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 2:
        return (
          <AreaStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 3:
        return (
          <ParticipantsStep
            formData={formData}
            updateFormData={updateFormData}
          />
        );
      case 4:
        return (
          <ReviewStep
            formData={formData}
            onEdit={(step) => setCurrentStep(step)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="mission-wizard-overlay">
      <div className="mission-wizard">
        <div className="wizard-header">
          <h2>Create New Mission</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">&times;</button>
        </div>

        <div className="wizard-progress">
          {WIZARD_STEPS.map((step) => (
            <div
              key={step.id}
              className={`progress-step ${currentStep === step.id ? 'active' : ''} ${currentStep > step.id ? 'completed' : ''}`}
            >
              <div className="step-number">{step.id}</div>
              <div className="step-info">
                <span className="step-title">{step.title}</span>
                <span className="step-desc">{step.description}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="wizard-body">
          {error && (
            <div className="wizard-error">
              {error}
            </div>
          )}
          {renderStepContent()}
        </div>

        <div className="wizard-footer">
          <button
            className="btn-secondary"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <div className="footer-nav">
            {currentStep > 1 && (
              <button
                className="btn-secondary"
                onClick={handlePrevious}
                disabled={loading}
              >
                Previous
              </button>
            )}
            {currentStep < WIZARD_STEPS.length ? (
              <button
                className="btn-primary"
                onClick={handleNext}
                disabled={!validateStep()}
              >
                Next
              </button>
            ) : (
              <button
                className="btn-primary create-btn"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Mission'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
