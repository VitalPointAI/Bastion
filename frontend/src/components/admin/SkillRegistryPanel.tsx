/**
 * SkillRegistryPanel Component
 *
 * Phase 52: Agent Skills & MCP
 *
 * Administrative panel for creating and managing agent skills:
 * - Create skills with JSON Schema input/output definitions
 * - List skills with status and agent assignment counts
 * - Assign/unassign skills to agents
 * - Delete skills with confirmation
 */

import { useState, useEffect, useCallback } from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { adminService } from '../../lib/admin-service';
import type { AgentSkillDef, AgentSkillInput, AgentWithConfig } from '../../types/admin';
import { FormField } from './common/FormField';

// ============================================================================
// SkillRegistryPanel
// ============================================================================

export function SkillRegistryPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Skill list
  const [skills, setSkills] = useState<AgentSkillDef[]>([]);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  // Create form state
  const [createForm, setCreateForm] = useState<AgentSkillInput>({
    name: '',
    description: '',
    version: '1.0.0',
    inputSchema: { type: 'object', properties: {}, required: [] },
    outputSchema: undefined,
  });
  const [inputSchemaJson, setInputSchemaJson] = useState(
    JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2)
  );
  const [outputSchemaJson, setOutputSchemaJson] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<AgentSkillDef | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Agent assignment
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);
  const [assigningSkill, setAssigningSkill] = useState<AgentSkillDef | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Load skills
  const loadSkills = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const skillList = await adminService.listSkills();
      setSkills(skillList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load agents for assignment
  const loadAgents = useCallback(async () => {
    try {
      const agentList = await adminService.listAgents();
      setAgents(agentList);
    } catch (err) {
      console.warn('Failed to load agents:', err);
    }
  }, []);

  useEffect(() => {
    loadSkills();
    loadAgents();
  }, [loadSkills, loadAgents]);

  // Handle create form submit
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors: Record<string, string> = {};

    if (!createForm.name.trim()) errors.name = 'Name is required';
    if (!createForm.description.trim()) errors.description = 'Description is required';

    // Parse input schema JSON
    let parsedInputSchema: Record<string, unknown>;
    try {
      parsedInputSchema = JSON.parse(inputSchemaJson) as Record<string, unknown>;
    } catch {
      errors.inputSchema = 'Invalid JSON for input schema';
    }

    let parsedOutputSchema: Record<string, unknown> | undefined;
    if (outputSchemaJson.trim()) {
      try {
        parsedOutputSchema = JSON.parse(outputSchemaJson) as Record<string, unknown>;
      } catch {
        errors.outputSchema = 'Invalid JSON for output schema';
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setIsCreating(true);
    setError(null);

    try {
      const input: AgentSkillInput = {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
        version: createForm.version || '1.0.0',
        inputSchema: parsedInputSchema!,
        outputSchema: parsedOutputSchema,
      };

      await adminService.createSkill(input);
      setSuccessMessage(`Skill "${input.name}" created successfully!`);

      // Reset form
      setCreateForm({ name: '', description: '', version: '1.0.0', inputSchema: { type: 'object', properties: {}, required: [] } });
      setInputSchemaJson(JSON.stringify({ type: 'object', properties: {}, required: [] }, null, 2));
      setOutputSchemaJson('');

      await loadSkills();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill');
    } finally {
      setIsCreating(false);
    }
  };

  // Handle delete
  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await adminService.deleteSkill(deleteTarget.skillId);
      await loadSkills();
      setSuccessMessage(`Skill "${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete skill');
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle enabled/disabled
  const toggleEnabled = async (skill: AgentSkillDef) => {
    try {
      await adminService.updateSkill(skill.skillId, { isEnabled: !skill.isEnabled });
      await loadSkills();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skill');
    }
  };

  // Handle assign
  const handleAssign = async () => {
    if (!assigningSkill || !selectedAgentId) return;

    setIsAssigning(true);
    try {
      await adminService.assignSkillToAgent(assigningSkill.skillId, selectedAgentId);
      await loadSkills();
      setSuccessMessage(`Skill assigned to agent`);
      setAssigningSkill(null);
      setSelectedAgentId('');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign skill');
    } finally {
      setIsAssigning(false);
    }
  };

  if (isLoading && skills.length === 0) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading skill registry...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>Skill Registry</h2>
        <p>Define reusable skills that agents can learn and execute. Ironclaw can create new skills dynamically.</p>
      </div>

      {error && (
        <div className="alert alert--error">
          <span className="alert-icon">!</span>
          {error}
        </div>
      )}

      {successMessage && (
        <div className="alert alert--success">
          <span className="alert-icon">&#10003;</span>
          {successMessage}
        </div>
      )}

      <Tabs className="management-tabs">
        <TabList className="management-tab-list">
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Registered Skills ({skills.length})
          </Tab>
          <Tab className="management-tab" selectedClassName="management-tab--selected">
            Create Skill
          </Tab>
        </TabList>

        {/* Registered Skills Tab */}
        <TabPanel className="management-tab-panel">
          <div className="config-section">
            <div className="config-section-header-row">
              <h3>Skills</h3>
            </div>

            {skills.length === 0 ? (
              <div className="empty-state">
                No skills registered yet. Create one in the "Create Skill" tab.
              </div>
            ) : (
              <div className="tool-cards-list">
                {skills.map((skill) => (
                  <div
                    key={skill.skillId}
                    className={`tool-card ${expandedSkillId === skill.skillId ? 'tool-card--expanded' : ''}`}
                  >
                    <div
                      className="tool-card-header"
                      onClick={() => setExpandedSkillId(expandedSkillId === skill.skillId ? null : skill.skillId)}
                    >
                      <div className="tool-card-info">
                        <span className="tool-card-name">{skill.name}</span>
                        <div className="tool-card-badges">
                          <span className="badge badge--category badge--data">
                            v{skill.version}
                          </span>
                          <span className={`badge ${skill.isEnabled ? 'badge--handler badge--builtin' : 'badge--category badge--integration'}`}>
                            {skill.isEnabled ? 'enabled' : 'disabled'}
                          </span>
                        </div>
                      </div>
                      <div className="tool-card-meta">
                        <span className="tool-card-agents">
                          {skill.assignedAgentCount ?? 0} agents
                        </span>
                        <span className={`tool-card-expand ${expandedSkillId === skill.skillId ? 'expanded' : ''}`}>
                          &#9660;
                        </span>
                      </div>
                    </div>

                    <div className={`tool-card-body ${expandedSkillId === skill.skillId ? '' : 'collapsed'}`}>
                      <p className="tool-description">{skill.description}</p>

                      <div className="tool-did-display">
                        <span className="tool-did-label">ID:</span>
                        <code className="tool-did-value">{skill.skillId}</code>
                      </div>

                      {skill.inputSchema && (
                        <div className="tool-schema-section">
                          <h4>Input Schema</h4>
                          <pre className="tool-schema">{JSON.stringify(skill.inputSchema, null, 2)}</pre>
                        </div>
                      )}

                      {skill.outputSchema && (
                        <div className="tool-schema-section">
                          <h4>Output Schema</h4>
                          <pre className="tool-schema">{JSON.stringify(skill.outputSchema, null, 2)}</pre>
                        </div>
                      )}

                      {skill.toolIds && skill.toolIds.length > 0 && (
                        <div className="tool-permissions">
                          <h4>Composed Tools</h4>
                          <div className="permission-badges">
                            {skill.toolIds.map((toolId) => (
                              <span key={toolId} className="badge badge--permission">{toolId}</span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="tool-card-actions">
                        <label className="toggle-label toggle-label--inline">
                          <input
                            type="checkbox"
                            checked={skill.isEnabled}
                            onChange={() => toggleEnabled(skill)}
                            className="toggle-input"
                          />
                          <span className="toggle-switch toggle-switch--sm" />
                          <span className="toggle-text">{skill.isEnabled ? 'Enabled' : 'Disabled'}</span>
                        </label>

                        <button
                          className="btn btn--sm btn--secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssigningSkill(skill);
                          }}
                        >
                          Assign
                        </button>

                        <button
                          className="btn btn--sm btn--danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(skill);
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabPanel>

        {/* Create Skill Tab */}
        <TabPanel className="management-tab-panel">
          <form onSubmit={handleCreate} className="tool-create-form">
            <div className="config-section">
              <h3>Basic Information</h3>

              <div className="form-row">
                <FormField label="Name" required error={formErrors.name}>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    className="form-input"
                    placeholder="Operational Planning Skill"
                  />
                </FormField>

                <FormField label="Version" error={formErrors.version}>
                  <input
                    type="text"
                    value={createForm.version ?? '1.0.0'}
                    onChange={(e) => setCreateForm((f) => ({ ...f, version: e.target.value }))}
                    className="form-input"
                    placeholder="1.0.0"
                  />
                </FormField>
              </div>

              <div className="form-row">
                <FormField label="Description" required error={formErrors.description}>
                  <textarea
                    value={createForm.description}
                    onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                    className="form-input form-textarea"
                    placeholder="Describe what this skill enables an agent to do..."
                    rows={3}
                  />
                </FormField>
              </div>
            </div>

            <div className="config-section">
              <h3>Schema Definition</h3>
              <p className="config-section-desc">
                Define the input and output schemas using JSON Schema format.
                These document what parameters the skill accepts and what it returns.
              </p>

              <FormField label="Input Schema (JSON)" required error={formErrors.inputSchema}>
                <textarea
                  value={inputSchemaJson}
                  onChange={(e) => setInputSchemaJson(e.target.value)}
                  className="form-input form-textarea form-textarea--code"
                  rows={10}
                  placeholder='{"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]}'
                />
              </FormField>

              <FormField label="Output Schema (JSON, optional)" error={formErrors.outputSchema}>
                <textarea
                  value={outputSchemaJson}
                  onChange={(e) => setOutputSchemaJson(e.target.value)}
                  className="form-input form-textarea form-textarea--code"
                  rows={6}
                  placeholder='{"type": "object", "properties": {"result": {"type": "string"}}}'
                />
              </FormField>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Skill'}
              </button>
            </div>
          </form>
        </TabPanel>
      </Tabs>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header modal-header--danger">
              <h3>Delete Skill</h3>
              <button className="modal-close" onClick={() => setDeleteTarget(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
              </p>
              <p className="text-muted">
                This will remove the skill and all agent assignments. This action cannot be undone.
              </p>
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
                  {isDeleting ? 'Deleting...' : 'Delete Skill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign Skill Modal */}
      {assigningSkill && (
        <div className="modal-overlay" onClick={() => setAssigningSkill(null)}>
          <div className="modal modal--sm" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assign Skill to Agent</h3>
              <button className="modal-close" onClick={() => setAssigningSkill(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <p>
                Assign <strong>{assigningSkill.name}</strong> to an agent.
              </p>

              <FormField label="Select Agent">
                <select
                  className="form-select"
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.agentId} value={agent.agentId}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <div className="modal-footer">
                <button
                  className="btn btn--secondary"
                  onClick={() => setAssigningSkill(null)}
                  disabled={isAssigning}
                >
                  Cancel
                </button>
                <button
                  className="btn btn--primary"
                  onClick={handleAssign}
                  disabled={isAssigning || !selectedAgentId}
                >
                  {isAssigning ? 'Assigning...' : 'Assign Skill'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
