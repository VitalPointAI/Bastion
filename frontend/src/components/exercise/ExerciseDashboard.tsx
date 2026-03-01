/**
 * ExerciseDashboard
 *
 * Phase 14 Plan 06: Main exercise container component.
 * Phase 14 Plan 10: Fully wired — all tabs render actual components.
 * Phase 15 Plan 02: Added StaffWorkspace view mode, role selection in Create Scenario
 *                   modal, and "Manage Roles" panel for post-creation role editing.
 *
 * Provides:
 * - Dual-perspective toggle (Blue/Red) with visual barrier indicators
 * - Phase timeline navigation
 * - Tab-based content routing to all exercise components (Classic View)
 * - Staff Workspaces view: role-based sidebar navigation (new default)
 * - Scenario creation modal with editable phase list + role selection
 * - "Manage Roles" button for post-creation role configuration
 * - Exercise controller view with Gates tab
 * - Watermark-style information barrier indicators per CONTEXT.md
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type { ExerciseScenario } from '../../types/exercise';
import {
  STAFF_ROLE_CONFIG,
  STAFF_ROLE_CATEGORIES,
  STAFF_PRESET_TEMPLATES,
} from '../../types/exercise';
import { ScenarioPackageUpload } from './ScenarioPackageUpload';
import { IPBPanel } from './IPBPanel';
import { COAScoringPanel } from './COAScoringPanel';
import { CommanderDecisionPanel } from './CommanderDecisionPanel';
import { OrderEditor } from './OrderEditor';
import { PlanningBoard } from './PlanningBoard';
import { ExerciseTimeline } from './ExerciseTimeline';
import { GateControl } from './GateControl';
import { StaffWorkspace } from './StaffWorkspace';
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

type ViewMode = 'staff' | 'legacy';

interface TabDefinition {
  id: ActiveTab;
  label: string;
  icon: string;
  controllerOnly?: boolean;
}

const TABS: TabDefinition[] = [
  { id: 'upload',   label: 'Scenario Package', icon: 'folder' },
  { id: 'ipb',      label: 'IPB',              icon: 'shield' },
  { id: 'coas',     label: 'COAs',             icon: 'diagram' },
  { id: 'orders',   label: 'Orders',           icon: 'doc' },
  { id: 'tasks',    label: 'Planning Board',   icon: 'check' },
  { id: 'timeline', label: 'Timeline',         icon: 'calendar' },
  { id: 'gates',    label: 'Gates',            icon: 'lock', controllerOnly: true },
];

// Default Pacific Strategy exercise phases (per CONTEXT.md specifics)
const DEFAULT_EXERCISE_PHASES = [
  'Competition',
  'Crisis',
  'Conflict Day 4',
  'Conflict Day 10',
  'Conflict Day 22',
  'Negotiation',
];

// ─── Role Selector ─────────────────────────────────────────────────────────────
// Shared UI for role selection — used in both Create Scenario modal and Manage Roles modal.

interface RoleSelectorProps {
  selectedRoles: string[];
  onChange: (roles: string[]) => void;
}

function RoleSelector({ selectedRoles, onChange }: RoleSelectorProps) {
  const toggleRole = (key: string) => {
    if (selectedRoles.includes(key)) {
      onChange(selectedRoles.filter((r) => r !== key));
    } else {
      onChange([...selectedRoles, key]);
    }
  };

  const toggleCategory = (category: string) => {
    const categoryRoles = Object.values(STAFF_ROLE_CONFIG)
      .filter((r) => r.category === category)
      .map((r) => r.key);
    const allSelected = categoryRoles.every((k) => selectedRoles.includes(k));
    if (allSelected) {
      // Deselect all in category, but always keep 'commander'
      onChange(selectedRoles.filter((r) => !categoryRoles.includes(r) || r === 'commander'));
    } else {
      // Select all in category
      const merged = new Set([...selectedRoles, ...categoryRoles]);
      onChange(Array.from(merged));
    }
  };

  const applyPreset = (presetKey: string) => {
    const roles = STAFF_PRESET_TEMPLATES[presetKey];
    if (roles) onChange(roles);
  };

  return (
    <div className="role-selector">
      {/* Preset buttons */}
      <div className="role-selector-presets">
        <button
          type="button"
          className={`role-preset-btn ${selectedRoles.length === STAFF_PRESET_TEMPLATES.full_joint_staff.length ? 'active' : ''}`}
          onClick={() => applyPreset('full_joint_staff')}
        >
          Full Joint Staff (31)
        </button>
        <button
          type="button"
          className={`role-preset-btn ${JSON.stringify([...selectedRoles].sort()) === JSON.stringify([...STAFF_PRESET_TEMPLATES.core_staff].sort()) ? 'active' : ''}`}
          onClick={() => applyPreset('core_staff')}
        >
          Core Staff (9)
        </button>
        <button
          type="button"
          className={`role-preset-btn ${JSON.stringify([...selectedRoles].sort()) === JSON.stringify([...STAFF_PRESET_TEMPLATES.intel_focus].sort()) ? 'active' : ''}`}
          onClick={() => applyPreset('intel_focus')}
        >
          Intel Focus (6)
        </button>
        <button
          type="button"
          className="role-preset-btn"
          onClick={() => onChange(['commander'])}
        >
          Custom (reset)
        </button>
      </div>

      {/* Selected count */}
      <div className="role-selector-count">
        {selectedRoles.length} role{selectedRoles.length !== 1 ? 's' : ''} selected
      </div>

      {/* Category-grouped checkboxes */}
      <div className="role-selector-categories">
        {STAFF_ROLE_CATEGORIES.map((category) => {
          const categoryRoles = Object.values(STAFF_ROLE_CONFIG).filter(
            (r) => r.category === category
          );
          const allSelected = categoryRoles.every((r) => selectedRoles.includes(r.key));
          const someSelected = categoryRoles.some((r) => selectedRoles.includes(r.key));

          return (
            <div key={category} className="role-selector-category">
              <div className="role-selector-category-header">
                <label className="role-selector-category-label">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => toggleCategory(category)}
                  />
                  {category}
                </label>
              </div>
              <div className="role-selector-role-grid">
                {categoryRoles.map((role) => (
                  <label
                    key={role.key}
                    className={`role-selector-role ${role.key === 'commander' ? 'role-selector-role--required' : ''}`}
                    title={role.doctrinalFocus}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoles.includes(role.key)}
                      onChange={() => toggleRole(role.key)}
                      disabled={role.key === 'commander'} // Commander always enabled
                    />
                    <span className="role-selector-role-label">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Manage Roles Modal ────────────────────────────────────────────────────────

interface ManageRolesModalProps {
  scenario: ExerciseScenario;
  onClose: () => void;
  onSaved: (updatedScenario: ExerciseScenario) => void;
}

function ManageRolesModal({ scenario, onClose, onSaved }: ManageRolesModalProps) {
  const [enabledRoles, setEnabledRoles] = useState<string[]>(
    scenario.enabledRoles ?? STAFF_PRESET_TEMPLATES.core_staff
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await exerciseService.updateEnabledRoles(scenario.id, enabledRoles);
      // Refresh the scenario to get updated enabledRoles
      const updated = await exerciseService.getScenario(scenario.id);
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update roles');
      setIsSaving(false);
    }
  };

  return (
    <div className="exercise-modal-overlay" onClick={onClose}>
      <div
        className="exercise-modal exercise-modal--wide exercise-modal--tall"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Manage Roles — {scenario.name}</h3>
        <p className="exercise-modal-subtitle">
          Select the staff roles enabled for this exercise. Changes take effect immediately
          and update the role sidebar.
        </p>

        <RoleSelector selectedRoles={enabledRoles} onChange={setEnabledRoles} />

        {error && <div className="exercise-error">{error}</div>}

        <div className="exercise-modal-actions">
          <button className="btn-cancel" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={enabledRoles.length === 0 || isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Roles'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create Scenario Modal ─────────────────────────────────────────────────────

interface CreateScenarioModalProps {
  onClose: () => void;
  onCreate: (scenario: ExerciseScenario) => void;
}

function CreateScenarioModal({ onClose, onCreate }: CreateScenarioModalProps) {
  const [name, setName] = useState('');
  const [designation, setDesignation] = useState<'training/exercise' | 'operational'>('training/exercise');
  const [phases, setPhases] = useState<string[]>([...DEFAULT_EXERCISE_PHASES]);
  const [enabledRoles, setEnabledRoles] = useState<string[]>([...STAFF_PRESET_TEMPLATES.core_staff]);
  const [editingPhaseIndex, setEditingPhaseIndex] = useState<number | null>(null);
  const [editingPhaseValue, setEditingPhaseValue] = useState('');
  const [newPhase, setNewPhase] = useState('');
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
        exercisePhases: phases,
        enabledRoles,
      });
      onCreate(scenario);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scenario');
    } finally {
      setIsCreating(false);
    }
  };

  const handlePhaseEdit = (index: number) => {
    setEditingPhaseIndex(index);
    setEditingPhaseValue(phases[index]);
  };

  const handlePhaseEditSave = () => {
    if (editingPhaseIndex === null) return;
    if (!editingPhaseValue.trim()) {
      setEditingPhaseIndex(null);
      return;
    }
    const updated = [...phases];
    updated[editingPhaseIndex] = editingPhaseValue.trim();
    setPhases(updated);
    setEditingPhaseIndex(null);
  };

  const handlePhaseRemove = (index: number) => {
    setPhases(phases.filter((_, i) => i !== index));
  };

  const handlePhaseAdd = () => {
    const trimmed = newPhase.trim();
    if (!trimmed) return;
    setPhases([...phases, trimmed]);
    setNewPhase('');
  };

  return (
    <div className="exercise-modal-overlay" onClick={onClose}>
      <div className="exercise-modal exercise-modal--wide exercise-modal--tall" onClick={(e) => e.stopPropagation()}>
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

        {/* Editable phase list */}
        <div className="exercise-modal-field">
          <label>Exercise Phases</label>
          <div className="phase-editor">
            <ul className="phase-editor-list">
              {phases.map((phase, index) => (
                <li key={index} className="phase-editor-item">
                  {editingPhaseIndex === index ? (
                    <input
                      className="phase-editor-input"
                      value={editingPhaseValue}
                      onChange={(e) => setEditingPhaseValue(e.target.value)}
                      onBlur={handlePhaseEditSave}
                      onKeyDown={(e) => e.key === 'Enter' && handlePhaseEditSave()}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span className="phase-editor-num">{index + 1}</span>
                      <span className="phase-editor-name">{phase}</span>
                      <button
                        className="phase-editor-btn"
                        onClick={() => handlePhaseEdit(index)}
                        title="Rename phase"
                      >
                        Edit
                      </button>
                      <button
                        className="phase-editor-btn phase-editor-btn--remove"
                        onClick={() => handlePhaseRemove(index)}
                        title="Remove phase"
                        disabled={phases.length <= 1}
                      >
                        Remove
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="phase-editor-add">
              <input
                className="phase-editor-new-input"
                value={newPhase}
                onChange={(e) => setNewPhase(e.target.value)}
                placeholder="Add new phase..."
                onKeyDown={(e) => e.key === 'Enter' && handlePhaseAdd()}
              />
              <button
                className="phase-editor-btn phase-editor-btn--add"
                onClick={handlePhaseAdd}
                disabled={!newPhase.trim()}
              >
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Staff Roles selection */}
        <div className="exercise-modal-field">
          <label>Staff Roles</label>
          <RoleSelector selectedRoles={enabledRoles} onChange={setEnabledRoles} />
        </div>

        {error && <div className="exercise-error">{error}</div>}

        <div className="exercise-modal-actions">
          <button className="btn-cancel" onClick={onClose} disabled={isCreating}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || isCreating || phases.length === 0}
          >
            {isCreating ? 'Creating...' : 'Create Scenario'}
          </button>
        </div>
      </div>
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
  const [viewMode, setViewMode] = useState<ViewMode>('staff');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageRolesModal, setShowManageRolesModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Browsed phase index (may differ from scenario.currentPhaseIndex for viewing past/future phases)
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
    // Switch to staff view for the new scenario
    setViewMode('staff');
  };

  const handleUploadComplete = async () => {
    try {
      const list = await exerciseService.getScenarios();
      setScenarios(list);
      const updated = list.find((s) => s.id === selectedScenario?.id);
      if (updated) setSelectedScenario(updated);
    } catch {
      // Non-fatal
    }
  };

  /** Navigate to a phase by name (from timeline click or phase nav arrows) */
  const handlePhaseSelect = (phaseName: string) => {
    if (!selectedScenario) return;
    const index = selectedScenario.exercisePhases.indexOf(phaseName);
    if (index !== -1) {
      setBrowsedPhaseIndex(index);
    }
  };

  /** Called when GateControl advances the phase — refresh scenario state */
  const handlePhaseAdvanced = async () => {
    try {
      const list = await exerciseService.getScenarios();
      setScenarios(list);
      const updated = list.find((s) => s.id === selectedScenario?.id);
      if (updated) {
        setSelectedScenario(updated);
        setBrowsedPhaseIndex(updated.currentPhaseIndex);
      }
    } catch {
      // Non-fatal
    }
  };

  /** Called when Manage Roles modal saves — updates selectedScenario and the list */
  const handleRolesSaved = (updatedScenario: ExerciseScenario) => {
    setSelectedScenario(updatedScenario);
    setScenarios((prev) =>
      prev.map((s) => (s.id === updatedScenario.id ? updatedScenario : s))
    );
    setShowManageRolesModal(false);
  };

  // ── Derived values ────────────────────────────────────────────────────────────

  const phases = selectedScenario?.exercisePhases ?? [];
  const currentPhaseName = phases[browsedPhaseIndex] ?? 'No Phase';
  const canBrowsePrev = browsedPhaseIndex > 0;
  const canBrowseNext = browsedPhaseIndex < phases.length - 1;

  // Visible tabs: hide controller-only tabs unless in controller view
  const visibleTabs = TABS.filter((t) => !t.controllerOnly || isControllerView);

  // Information barrier watermark text
  const watermarkText = isControllerView
    ? 'EXERCISE CONTROL'
    : perspective === 'blue'
    ? 'BLUE FORCE'
    : 'RED FORCE';

  // Barrier color class on the dashboard
  const barrierClass = isControllerView
    ? 'exercise-barrier--controller'
    : `exercise-barrier--${perspective}`;

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
    <div className={`exercise-dashboard ${barrierClass}`}>

      {/* Information barrier watermark */}
      <div className="exercise-watermark" aria-hidden="true">{watermarkText}</div>

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
          {selectedScenario && (
            <button
              className="manage-roles-button"
              onClick={() => setShowManageRolesModal(true)}
              title="Add or remove staff roles from this exercise"
            >
              Manage Roles
            </button>
          )}
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

        {/* View mode toggle */}
        {selectedScenario && (
          <div className="view-mode-toggle">
            <button
              className={`view-mode-btn ${viewMode === 'staff' ? 'active' : ''}`}
              onClick={() => setViewMode('staff')}
              title="Role-based staff workspace view"
            >
              Staff Workspaces
            </button>
            <button
              className={`view-mode-btn ${viewMode === 'legacy' ? 'active' : ''}`}
              onClick={() => setViewMode('legacy')}
              title="Classic horizontal tab view"
            >
              Classic View
            </button>
          </div>
        )}

      </div>

      {/* Error banner */}
      {error && <div className="exercise-error">{error}</div>}

      {/* ── Staff Workspaces view ── */}
      {viewMode === 'staff' && selectedScenario ? (
        <StaffWorkspace
          scenario={selectedScenario}
          perspective={perspective}
          exercisePhase={currentPhaseName}
          isControllerView={isControllerView}
        />
      ) : (
        <>
          {/* ── Classic View: Tab navigation ── */}
          <nav className="exercise-tab-nav">
            {visibleTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const isDisabled = !selectedScenario && tab.id !== 'upload';
              const activeClass = isActive ? `active active--${perspective}` : '';
              return (
                <button
                  key={tab.id}
                  className={`exercise-tab-btn ${activeClass} ${tab.controllerOnly ? 'controller-only' : ''} ${isDisabled ? 'exercise-tab-btn--disabled' : ''}`}
                  onClick={() => !isDisabled && setActiveTab(tab.id)}
                  disabled={isDisabled}
                  title={isDisabled ? 'Select or create a scenario first' : undefined}
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
                ? (
                  <IPBPanel
                    scenarioId={selectedScenario.id}
                    perspective={perspective}
                    exercisePhase={currentPhaseName}
                  />
                )
                : <div className="exercise-empty-state"><p>Select or create a scenario to view IPB.</p></div>
            )}

            {activeTab === 'coas' && (
              selectedScenario
                ? (
                  <div className="exercise-coas-layout">
                    <COAScoringPanel
                      scenarioId={selectedScenario.id}
                      perspective={perspective}
                      exercisePhase={currentPhaseName}
                    />
                    <CommanderDecisionPanel
                      scenarioId={selectedScenario.id}
                      perspective={perspective}
                      exercisePhase={currentPhaseName}
                      coas={[]}
                      exerciseRole={isControllerView ? 'exercise_control' : undefined}
                    />
                  </div>
                )
                : <div className="exercise-empty-state"><p>Select or create a scenario to view COAs.</p></div>
            )}

            {activeTab === 'orders' && (
              selectedScenario
                ? (
                  <OrderEditor
                    scenarioId={selectedScenario.id}
                    perspective={perspective}
                    exercisePhase={currentPhaseName}
                  />
                )
                : <div className="exercise-empty-state"><p>Select or create a scenario to view Orders.</p></div>
            )}

            {activeTab === 'tasks' && (
              selectedScenario
                ? (
                  <PlanningBoard
                    scenarioId={selectedScenario.id}
                    perspective={perspective}
                    exercisePhase={currentPhaseName}
                  />
                )
                : <div className="exercise-empty-state"><p>Select or create a scenario to view the Planning Board.</p></div>
            )}

            {activeTab === 'timeline' && (
              selectedScenario
                ? (
                  <ExerciseTimeline
                    scenario={selectedScenario}
                    currentPhaseIndex={selectedScenario.currentPhaseIndex}
                    onPhaseSelect={handlePhaseSelect}
                  />
                )
                : <div className="exercise-empty-state"><p>Select or create a scenario to view the Timeline.</p></div>
            )}

            {activeTab === 'gates' && (
              selectedScenario
                ? (
                  <GateControl
                    scenarioId={selectedScenario.id}
                    exercisePhase={currentPhaseName}
                    exercisePhases={selectedScenario.exercisePhases}
                    isController={isControllerView}
                    onPhaseAdvanced={handlePhaseAdvanced}
                  />
                )
                : <div className="exercise-empty-state"><p>Select or create a scenario to manage Gates.</p></div>
            )}
          </div>
        </>
      )}

      {/* No scenario — staff mode empty state */}
      {viewMode === 'staff' && !selectedScenario && (
        <div className="exercise-content">
          <div className="exercise-empty-state">
            <h3>No Scenario Selected</h3>
            <p>Create a new exercise scenario or select an existing one to access staff workspaces.</p>
            <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
              + New Scenario
            </button>
          </div>
        </div>
      )}

      {/* Create scenario modal */}
      {showCreateModal && (
        <CreateScenarioModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleScenarioCreated}
        />
      )}

      {/* Manage Roles modal */}
      {showManageRolesModal && selectedScenario && (
        <ManageRolesModal
          scenario={selectedScenario}
          onClose={() => setShowManageRolesModal(false)}
          onSaved={handleRolesSaved}
        />
      )}
    </div>
  );
}
