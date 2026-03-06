/**
 * CreateScenarioPanel
 *
 * Inline panel shown in TrainingPackagesView when no scenario is linked.
 * Two paths:
 * - "Upload Package" — quick-creates a scenario with default name, then user uploads files
 * - "Create Manually" — form for name, phases, role preset before creating
 */

import { useState } from 'react';
import { problemSetService } from '../../lib/problem-set-service.js';
import { STAFF_PRESET_TEMPLATES } from '../../types/exercise.js';
import type { ExerciseScenario } from '../../types/exercise.js';
import './CreateScenarioPanel.css';

const PRESET_LABELS: Record<string, string> = {
  core_staff: 'Core Staff (9 roles)',
  full_joint_staff: 'Full Joint Staff (31 roles)',
  intel_focus: 'Intel Focus (6 roles)',
};

interface CreateScenarioPanelProps {
  problemSetId: string;
  problemSetName: string;
  onCreated: (scenario: ExerciseScenario) => void;
}

export function CreateScenarioPanel({ problemSetId, problemSetName, onCreated }: CreateScenarioPanelProps) {
  const [mode, setMode] = useState<'choose' | 'manual' | 'uploading'>(
    'choose',
  );
  const [name, setName] = useState(`${problemSetName} Scenario`);
  const [phases, setPhases] = useState('');
  const [preset, setPreset] = useState('core_staff');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async (quickCreate = false) => {
    setLoading(true);
    setError(null);
    try {
      const scenarioName = quickCreate ? `${problemSetName} Scenario` : name.trim();
      const exercisePhases = quickCreate
        ? undefined
        : phases.split(',').map((p) => p.trim()).filter(Boolean);

      const scenario = await problemSetService.createLinkedScenario(problemSetId, {
        name: scenarioName,
        designation: 'training/exercise',
        exercisePhases: exercisePhases && exercisePhases.length > 0 ? exercisePhases : undefined,
        enabledRoles: STAFF_PRESET_TEMPLATES[preset],
      });
      onCreated(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
      setLoading(false);
    }
  };

  if (mode === 'choose') {
    return (
      <div className="create-scenario-panel">
        <div className="create-scenario-header">
          <h3>Create Exercise Scenario</h3>
          <p>This training problem set needs a scenario to manage exercise documents and phases.</p>
        </div>

        <div className="create-scenario-cards">
          <button
            className="create-scenario-card"
            onClick={() => handleCreate(true)}
            disabled={loading}
            type="button"
          >
            <span className="create-scenario-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" strokeLinecap="round"/>
              </svg>
            </span>
            <span className="create-scenario-card-title">Upload Package</span>
            <span className="create-scenario-card-desc">
              {loading ? 'Creating...' : 'Auto-create scenario and upload exercise files'}
            </span>
          </button>

          <button
            className="create-scenario-card"
            onClick={() => setMode('manual')}
            disabled={loading}
            type="button"
          >
            <span className="create-scenario-card-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </span>
            <span className="create-scenario-card-title">Create Manually</span>
            <span className="create-scenario-card-desc">
              Configure scenario name, phases, and staff roles
            </span>
          </button>
        </div>

        {error && <div className="create-scenario-error">{error}</div>}
      </div>
    );
  }

  // Manual creation form
  return (
    <div className="create-scenario-panel">
      <div className="create-scenario-header">
        <h3>Create Exercise Scenario</h3>
        <button className="create-scenario-back" onClick={() => setMode('choose')} type="button">
          Back
        </button>
      </div>

      <div className="create-scenario-form">
        <div className="create-scenario-field">
          <label htmlFor="scenario-name">Scenario Name</label>
          <input
            id="scenario-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Pacific Strategy AY26"
            maxLength={100}
            autoFocus
          />
        </div>

        <div className="create-scenario-field">
          <label htmlFor="scenario-phases">Exercise Phases</label>
          <input
            id="scenario-phases"
            type="text"
            value={phases}
            onChange={(e) => setPhases(e.target.value)}
            placeholder="Comma-separated phase names"
          />
          <span className="create-scenario-hint">Comma-separated. Leave blank to add phases later or let AI suggest structure.</span>
        </div>

        <div className="create-scenario-field">
          <label htmlFor="scenario-preset">Staff Role Preset</label>
          <select
            id="scenario-preset"
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
          >
            {Object.entries(PRESET_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {error && <div className="create-scenario-error">{error}</div>}

        <div className="create-scenario-actions">
          <button
            className="create-scenario-btn create-scenario-btn--secondary"
            onClick={() => setMode('choose')}
            disabled={loading}
            type="button"
          >
            Cancel
          </button>
          <button
            className="create-scenario-btn create-scenario-btn--primary"
            onClick={() => handleCreate(false)}
            disabled={loading || name.trim().length < 2}
            type="button"
          >
            {loading ? 'Creating...' : 'Create Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}
