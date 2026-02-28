/**
 * ExerciseDashboard
 *
 * Phase 14 Plan 06: Main exercise container component.
 * Provides dual-perspective toggle (Blue/Red), phase timeline navigation,
 * tab-based content routing, scenario creation modal, and exercise controller view.
 *
 * Architecture:
 * - Upload tab renders ScenarioPackageUpload (Phase 14-06)
 * - IPB, COAs, Orders, Timeline tabs render content (Phase 14-07/08/09)
 * - Planning Board (tasks) and Gates tabs for Phase 14-10
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { ExerciseScenario } from '../../types/exercise';
import { ScenarioPackageUpload } from './ScenarioPackageUpload';
import './ExerciseDashboard.css';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Perspective = 'blue' | 'red';

type ActiveTab =
  | 'upload'
  | 'ipb'
  | 'coas'
  | 'orders'
  | 'tasks'
  | 'timeline'
  | 'gates';

interface TabDefinition {
  id: ActiveTab;
  label: string;
  controllerOnly?: boolean;
}

const TABS: TabDefinition[] = [
  { id: 'upload', label: 'Scenario Package' },
  { id: 'ipb', label: 'IPB' },
  { id: 'coas', label: 'COAs' },
  { id: 'orders', label: 'Orders' },
  { id: 'tasks', label: 'Planning Board' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'gates', label: 'Gates', controllerOnly: true },
];

// ─── Create Scenario Modal ─────────────────────────────────────────────────────

interface CreateScenarioModalProps {
  onClose: () => void;
  onCreate: (scenario: ExerciseScenario) => void;
}

function CreateScenarioModal({ onClose, onCreate }: CreateScenarioModalProps) {
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState<'training/exercise' | 'operational'>('training/exercise');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const scenario = await exerciseService.createScenario({
        name: name.trim(),
        designation,
      });
      onCreate(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="exercise-modal-overlay" onClick={onClose}>
      <div className="exercise-modal" onClick={(e) => e.stopPropagation()}>
        <h3>New Exercise Scenario</h3>

        <div className="exercise-modal-field">
          <label htmlFor="scenario-name">Scenario Name</label>
          <input
            id="scenario-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., WESTPAC Exercise 2026"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
        </div>

        <div className="exercise-modal-field">
          <label htmlFor="scenario-designation">Designation</label>
          <select
            id="scenario-designation"
            value={designation}
            onChange={(e) => setDesignation(e.target.value as 'training/exercise' | 'operational')}
          >
            <option value="training/exercise">Training / Exercise</option>
            <option value="operational">Operational</option>
          </select>
        </div>

        {error && <div className="exercise-error">{error}</div>}

        <div className="exercise-modal-actions">
          <button className="btn-cancel" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Scenario'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder Tab Content ───────────────────────────────────────────────────

function PlaceholderTab({ tab, planRef }: { tab: ActiveTab; planRef: string }) {
  const labels: Record<ActiveTab, string> = {
    upload: 'Scenario Package',
    ipb: 'Intelligence Preparation of the Battlefield',
    coas: 'Courses of Action',
    orders: 'Orders (WARNORD / OPORD / FRAGO)',
    tasks: 'Planning Board',
    timeline: 'Exercise Phase Timeline',
    gates: 'Gate Management',
  };

  return (
    <div className="exercise-placeholder">
      <h3>{labels[tab]}</h3>
      <p>Coming in Plan {planRef}</p>
    </div>
  );
}

// ─── ExerciseDashboard ─────────────────────────────────────────────────────────

export function ExerciseDashboard() {
  // ── State ────────────────────────────────────────────────────────────────────
  const [scenarios, setScenarios] = useState<ExerciseScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<ExerciseScenario | null>(null);
  const [perspective, setPerspective] = useState<Perspective>('blue');
  const [isControllerView, setIsControllerView] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('upload');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Browsed phase index (may differ from scenario.currentPhaseIndex for viewing past phases)
  const [browsedPhaseIndex, setBrowsedPhaseIndex] = useState<number>(0);

  // ── Load Scenarios on Mount ───────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await exerciseService.getScenarios();
        setScenarios(list);
        if (list.length > 0) {
          setSelectedScenario(list[0]);
          setBrowsedPhaseIndex(list[0].currentPhaseIndex);
        } else {
          // No scenarios — show upload tab
          setActiveTab('upload');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load scenarios');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleScenarioSelect = (id: string) => {
    const scenario = scenarios.find((s) => s.id === id) ?? null;
    setSelectedScenario(scenario);
    if (scenario) {
      setBrowsedPhaseIndex(scenario.currentPhaseIndex);
    }
  };

  const handleScenarioCreated = (scenario: ExerciseScenario) => {
    setScenarios((prev) => [scenario, ...prev]);
    setSelectedScenario(scenario);
    setBrowsedPhaseIndex(scenario.currentPhaseIndex);
    setShowCreateModal(false);
    setActiveTab('upload');
  };

  const handleUploadComplete = async () => {
    // Refresh scenario list after upload
    try {
      const list = await exerciseService.getScenarios();
      setScenarios(list);
      const updated = list.find((s) => s.id === selectedScenario?.id);
      if (updated) setSelectedScenario(updated);
    } catch {
      // Non-fatal — just skip refresh
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────────

  const phases = selectedScenario?.exercisePhases ?? [];
  const currentPhaseName = phases[browsedPhaseIndex] ?? 'No Phase';
  const canBrowsePrev = browsedPhaseIndex > 0;
  const canBrowseNext = browsedPhaseIndex < phases.length - 1;

  // Visible tabs: hide controller-only tabs unless in controller view
  const visibleTabs = TABS.filter((t) => !t.controllerOnly || isControllerView);

  // ── Render Guards ─────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="exercise-dashboard">
        <div className="exercise-empty-state">
          <p>Loading exercise scenarios...</p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="exercise-dashboard">

      {/* Header bar */}
      <div className="exercise-header">

        {/* Scenario selector */}
        <div className="scenario-selector">
          {scenarios.length > 0 && (
            <select
              className="scenario-select"
              value={selectedScenario?.id ?? ''}
              onChange={(e) => handleScenarioSelect(e.target.value)}
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          <button
            className="new-scenario-button"
            onClick={() => setShowCreateModal(true)}
          >
            + New Scenario
          </button>
        </div>

        {/* Perspective toggle */}
        <div className="perspective-toggle">
          <button
            className={`perspective-btn ${perspective === 'blue' ? 'active--blue' : ''}`}
            onClick={() => setPerspective('blue')}
            title="Blue Force perspective — CJTF WestPAC"
          >
            Blue (CJTF WestPAC)
          </button>
          <button
            className={`perspective-btn ${perspective === 'red' ? 'active--red' : ''}`}
            onClick={() => setPerspective('red')}
            title="Red Force perspective — PRC/TCC"
          >
            Red (PRC/TCC)
          </button>
        </div>

        {/* Controller view toggle */}
        <label className={`controller-toggle ${isControllerView ? 'active' : ''}`}>
          <input
            type="checkbox"
            checked={isControllerView}
            onChange={(e) => {
              setIsControllerView(e.target.checked);
              if (!e.target.checked && activeTab === 'gates') {
                setActiveTab('ipb');
              }
            }}
          />
          Controller View
        </label>

        {/* Phase navigation */}
        {selectedScenario && phases.length > 0 && (
          <div className="phase-indicator">
            <button
              className="phase-nav-btn"
              onClick={() => setBrowsedPhaseIndex((i) => i - 1)}
              disabled={!canBrowsePrev}
              title="Previous phase"
            >
              &lt;
            </button>
            <span
              className={`phase-label phase-label--${perspective}`}
              title={`Phase ${browsedPhaseIndex + 1} of ${phases.length}`}
            >
              {currentPhaseName}
            </span>
            <span className="phase-index">
              {browsedPhaseIndex + 1}/{phases.length}
            </span>
            <button
              className="phase-nav-btn"
              onClick={() => setBrowsedPhaseIndex((i) => i + 1)}
              disabled={!canBrowseNext}
              title="Next phase"
            >
              &gt;
            </button>
          </div>
        )}

      </div>

      {/* Error banner */}
      {error && <div className="exercise-error">{error}</div>}

      {/* Tab navigation */}
      <nav className="exercise-tab-nav">
        {visibleTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const activeClass = isActive
            ? `active active--${perspective}`
            : '';
          return (
            <button
              key={tab.id}
              className={`exercise-tab-btn ${activeClass} ${tab.controllerOnly ? 'controller-only' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content area */}
      <div className="exercise-content">
        {activeTab === 'upload' && (
          <ScenarioPackageUpload
            scenario={selectedScenario}
            onUploadComplete={handleUploadComplete}
          />
        )}
        {activeTab === 'ipb' && (
          selectedScenario
            ? <PlaceholderTab tab="ipb" planRef="14-07" />
            : <div className="exercise-empty-state"><p>Select or create a scenario to view IPB.</p></div>
        )}
        {activeTab === 'coas' && (
          selectedScenario
            ? <PlaceholderTab tab="coas" planRef="14-08" />
            : <div className="exercise-empty-state"><p>Select or create a scenario to view COAs.</p></div>
        )}
        {activeTab === 'orders' && (
          selectedScenario
            ? <PlaceholderTab tab="orders" planRef="14-09" />
            : <div className="exercise-empty-state"><p>Select or create a scenario to view Orders.</p></div>
        )}
        {activeTab === 'tasks' && (
          selectedScenario
            ? <PlaceholderTab tab="tasks" planRef="14-10" />
            : <div className="exercise-empty-state"><p>Select or create a scenario to view the Planning Board.</p></div>
        )}
        {activeTab === 'timeline' && (
          selectedScenario
            ? <PlaceholderTab tab="timeline" planRef="14-09" />
            : <div className="exercise-empty-state"><p>Select or create a scenario to view the Timeline.</p></div>
        )}
        {activeTab === 'gates' && (
          selectedScenario
            ? <PlaceholderTab tab="gates" planRef="14-10" />
            : <div className="exercise-empty-state"><p>Select or create a scenario to manage Gates.</p></div>
        )}
      </div>

      {/* Create scenario modal */}
      {showCreateModal && (
        <CreateScenarioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleScenarioCreated}
        />
      )}
    </div>
  );
}
