/**
 * AgentBuilderWizard Component
 *
 * Multi-step wizard for creating new AI agents with:
 * 1. Template Selection
 * 2. Basic Information
 * 3. Capabilities & Phase
 * 4. Character Definition
 * 5. Model Configuration
 * 6. Tool Assignment
 * 7. Review & Create
 */

import { useState, useEffect, useCallback } from 'react';
import './AgentBuilderWizard.css';

// Types
interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  phase: string;
  suggestedCapabilities: string[];
  defaultTools: string[];
  characterPreset: {
    name: string;
    personality: string[];
    expertise: string[];
    communication_style: string;
  } | null;
}

interface Capability {
  id: string;
  name: string;
  description: string;
}

interface Phase {
  id: string;
  name: string;
  description: string;
}

interface AutonomyLevel {
  id: number;
  name: string;
  description: string;
  numericValue: number;
}

interface Tool {
  toolId: string;
  name: string;
  description: string;
  category: string;
}

interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  phase: string;
  capabilities: string[];
  maxAutonomy: string;
  isEnabled: boolean;
  modelConfig?: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
  };
  character?: {
    name: string;
    personality?: string[];
    expertise?: string[];
    communication_style?: string;
    background?: string;
    goals?: string[];
    constraints?: string[];
  };
  assignedTools: string[];
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
}

const WIZARD_STEPS: WizardStep[] = [
  { id: 1, title: 'Template', description: 'Choose a starting point' },
  { id: 2, title: 'Basics', description: 'Name and description' },
  { id: 3, title: 'Capabilities', description: 'Phase and abilities' },
  { id: 4, title: 'Character', description: 'Personality and style' },
  { id: 5, title: 'Model', description: 'LLM configuration' },
  { id: 6, title: 'Tools', description: 'Assign tools' },
  { id: 7, title: 'Review', description: 'Create agent' },
];

interface AgentBuilderWizardProps {
  userDID: string;
  onClose: () => void;
  onAgentCreated: (agentId: string) => void;
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function AgentBuilderWizard({
  userDID,
  onClose,
  onAgentCreated,
}: AgentBuilderWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data from backend
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [capabilities, setCapabilities] = useState<Capability[]>([]);
  const [phases, setPhases] = useState<Phase[]>([]);
  const [autonomyLevels, setAutonomyLevels] = useState<AutonomyLevel[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);

  // Agent definition being built
  const [agent, setAgent] = useState<AgentDefinition>({
    id: '',
    name: '',
    description: '',
    phase: 'Support',
    capabilities: [],
    maxAutonomy: 'TaskAutonomous',
    isEnabled: true,
    assignedTools: [],
  });

  // Selected template
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Generated prompt preview
  const [promptPreview, setPromptPreview] = useState<string>('');

  // Load data from backend
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const headers = { 'X-DID': userDID };

        const [templatesRes, capsRes, phasesRes, autonomyRes, toolsRes] = await Promise.all([
          fetch(`${API_BASE}/api/admin/agent-builder/templates`, { headers }),
          fetch(`${API_BASE}/api/admin/agent-builder/capabilities`, { headers }),
          fetch(`${API_BASE}/api/admin/agent-builder/phases`, { headers }),
          fetch(`${API_BASE}/api/admin/agent-builder/autonomy-levels`, { headers }),
          fetch(`${API_BASE}/api/admin/tools`, { headers }),
        ]);

        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(data.templates || []);
        }
        if (capsRes.ok) {
          const data = await capsRes.json();
          setCapabilities(data.capabilities || []);
        }
        if (phasesRes.ok) {
          const data = await phasesRes.json();
          setPhases(data.phases || []);
        }
        if (autonomyRes.ok) {
          const data = await autonomyRes.json();
          setAutonomyLevels(data.levels || []);
        }
        if (toolsRes.ok) {
          const data = await toolsRes.json();
          setTools(data.tools || []);
        }
      } catch (err) {
        console.error('Failed to load wizard data:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userDID]);

  // Apply template when selected
  const applyTemplate = useCallback((templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return;

    setSelectedTemplate(templateId);

    if (templateId === 'custom') {
      // Reset to blank for custom
      setAgent({
        id: '',
        name: '',
        description: '',
        phase: 'Support',
        capabilities: [],
        maxAutonomy: 'TaskAutonomous',
        isEnabled: true,
        assignedTools: [],
      });
    } else {
      // Apply template values
      setAgent(prev => ({
        ...prev,
        name: template.name,
        description: template.description,
        phase: template.phase,
        capabilities: template.suggestedCapabilities,
        assignedTools: template.defaultTools,
        character: template.characterPreset || undefined,
      }));
    }
  }, [templates]);

  // Update agent field
  const updateAgent = useCallback(<K extends keyof AgentDefinition>(
    field: K,
    value: AgentDefinition[K]
  ) => {
    setAgent(prev => ({ ...prev, [field]: value }));
  }, []);

  // Generate prompt preview
  const generatePromptPreview = useCallback(async () => {
    if (!agent.character) return;

    try {
      const response = await fetch(`${API_BASE}/api/admin/agent-builder/preview-prompt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DID': userDID,
        },
        body: JSON.stringify({
          character: agent.character,
          capabilities: agent.capabilities,
          phase: agent.phase,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setPromptPreview(data.prompt || '');
      }
    } catch (err) {
      console.error('Failed to generate prompt preview:', err);
    }
  }, [agent.character, agent.capabilities, agent.phase, userDID]);

  // Validate current step
  const validateStep = useCallback((): boolean => {
    switch (currentStep) {
      case 1:
        return selectedTemplate !== null;
      case 2:
        return agent.name.trim().length > 0 && agent.description.trim().length > 0;
      case 3:
        return agent.capabilities.length > 0;
      case 4:
        return true; // Character is optional
      case 5:
        return true; // Model config is optional
      case 6:
        return true; // Tool assignment is optional
      case 7:
        return true; // Review step
      default:
        return true;
    }
  }, [currentStep, selectedTemplate, agent]);

  // Handle next step
  const handleNext = useCallback(() => {
    if (!validateStep()) {
      setError('Please complete all required fields');
      return;
    }
    setError(null);

    if (currentStep === 4 && agent.character) {
      generatePromptPreview();
    }

    setCurrentStep(prev => Math.min(prev + 1, WIZARD_STEPS.length));
  }, [currentStep, validateStep, agent.character, generatePromptPreview]);

  // Handle previous step
  const handlePrevious = useCallback(() => {
    setError(null);
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  // Create agent
  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      // First validate
      const validateRes = await fetch(`${API_BASE}/api/admin/agent-builder/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DID': userDID,
        },
        body: JSON.stringify(agent),
      });

      const validateData = await validateRes.json();
      if (!validateData.valid) {
        setError(validateData.errors.map((e: { message: string }) => e.message).join(', '));
        setLoading(false);
        return;
      }

      // Create agent
      const createRes = await fetch(`${API_BASE}/api/admin/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-DID': userDID,
        },
        body: JSON.stringify(agent),
      });

      if (!createRes.ok) {
        const errData = await createRes.json();
        throw new Error(errData.error || 'Failed to create agent');
      }

      const result = await createRes.json();

      // Assign tools if any
      if (agent.assignedTools.length > 0) {
        for (const toolId of agent.assignedTools) {
          await fetch(`${API_BASE}/api/admin/tools/${toolId}/assign/${result.agentId}`, {
            method: 'POST',
            headers: { 'X-DID': userDID },
          });
        }
      }

      // Set character if defined
      if (agent.character) {
        await fetch(`${API_BASE}/api/admin/agents/${result.agentId}/character`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
          body: JSON.stringify(agent.character),
        });
      }

      // Set model config if defined
      if (agent.modelConfig) {
        await fetch(`${API_BASE}/api/admin/agents/${result.agentId}/model-config`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-DID': userDID,
          },
          body: JSON.stringify({
            ...agent.modelConfig,
            agentId: result.agentId,
            useGlobalDefault: false,
          }),
        });
      }

      onAgentCreated(result.agentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent');
    } finally {
      setLoading(false);
    }
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="wizard-step-content template-step">
            <h3>Choose a Template</h3>
            <p>Select a template to get started or build from scratch.</p>
            <div className="template-grid">
              {templates.map(template => (
                <div
                  key={template.id}
                  className={`template-card ${selectedTemplate === template.id ? 'selected' : ''}`}
                  onClick={() => applyTemplate(template.id)}
                >
                  <h4>{template.name}</h4>
                  <p>{template.description}</p>
                  <span className="template-phase">{template.phase}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="wizard-step-content basics-step">
            <h3>Basic Information</h3>
            <div className="form-group">
              <label htmlFor="agent-id">Agent ID</label>
              <input
                id="agent-id"
                type="text"
                value={agent.id}
                onChange={(e) => updateAgent('id', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                placeholder="my-custom-agent"
              />
              <span className="help-text">Unique identifier (lowercase, hyphens only)</span>
            </div>
            <div className="form-group">
              <label htmlFor="agent-name">Name *</label>
              <input
                id="agent-name"
                type="text"
                value={agent.name}
                onChange={(e) => updateAgent('name', e.target.value)}
                placeholder="My Custom Agent"
              />
            </div>
            <div className="form-group">
              <label htmlFor="agent-description">Description *</label>
              <textarea
                id="agent-description"
                value={agent.description}
                onChange={(e) => updateAgent('description', e.target.value)}
                placeholder="Describe what this agent does..."
                rows={3}
              />
            </div>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={agent.isEnabled}
                  onChange={(e) => updateAgent('isEnabled', e.target.checked)}
                />
                Enable agent immediately
              </label>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="wizard-step-content capabilities-step">
            <h3>Capabilities & Phase</h3>
            <div className="form-group">
              <label>Phase</label>
              <div className="phase-selector">
                {phases.map(phase => (
                  <button
                    key={phase.id}
                    className={`phase-btn ${agent.phase === phase.id ? 'selected' : ''}`}
                    onClick={() => updateAgent('phase', phase.id)}
                    type="button"
                  >
                    <span className="phase-name">{phase.name}</span>
                    <span className="phase-desc">{phase.description}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Capabilities *</label>
              <div className="capabilities-grid">
                {capabilities.map(cap => (
                  <label key={cap.id} className="capability-checkbox">
                    <input
                      type="checkbox"
                      checked={agent.capabilities.includes(cap.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateAgent('capabilities', [...agent.capabilities, cap.id]);
                        } else {
                          updateAgent('capabilities', agent.capabilities.filter(c => c !== cap.id));
                        }
                      }}
                    />
                    <div className="capability-info">
                      <span className="capability-name">{cap.name}</span>
                      <span className="capability-desc">{cap.description}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label>Autonomy Level</label>
              <select
                value={agent.maxAutonomy}
                onChange={(e) => updateAgent('maxAutonomy', e.target.value)}
              >
                {autonomyLevels.map(level => (
                  <option key={level.id} value={level.name.replace(/ /g, '')}>
                    {level.name} - {level.description}
                  </option>
                ))}
              </select>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="wizard-step-content character-step">
            <h3>Character Definition</h3>
            <p>Define the agent's personality and communication style (optional).</p>
            <div className="form-group">
              <label htmlFor="char-name">Character Name</label>
              <input
                id="char-name"
                type="text"
                value={agent.character?.name || ''}
                onChange={(e) => updateAgent('character', {
                  ...agent.character,
                  name: e.target.value,
                })}
                placeholder="Agent's display name"
              />
            </div>
            <div className="form-group">
              <label htmlFor="char-personality">Personality Traits (comma-separated)</label>
              <input
                id="char-personality"
                type="text"
                value={agent.character?.personality?.join(', ') || ''}
                onChange={(e) => updateAgent('character', {
                  ...agent.character,
                  name: agent.character?.name || agent.name,
                  personality: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                })}
                placeholder="analytical, thorough, methodical"
              />
            </div>
            <div className="form-group">
              <label htmlFor="char-expertise">Expertise Areas (comma-separated)</label>
              <input
                id="char-expertise"
                type="text"
                value={agent.character?.expertise?.join(', ') || ''}
                onChange={(e) => updateAgent('character', {
                  ...agent.character,
                  name: agent.character?.name || agent.name,
                  expertise: e.target.value.split(',').map(s => s.trim()).filter(Boolean),
                })}
                placeholder="strategic analysis, document review"
              />
            </div>
            <div className="form-group">
              <label htmlFor="char-style">Communication Style</label>
              <input
                id="char-style"
                type="text"
                value={agent.character?.communication_style || ''}
                onChange={(e) => updateAgent('character', {
                  ...agent.character,
                  name: agent.character?.name || agent.name,
                  communication_style: e.target.value,
                })}
                placeholder="professional and precise"
              />
            </div>
            <div className="form-group">
              <label htmlFor="char-background">Background</label>
              <textarea
                id="char-background"
                value={agent.character?.background || ''}
                onChange={(e) => updateAgent('character', {
                  ...agent.character,
                  name: agent.character?.name || agent.name,
                  background: e.target.value,
                })}
                placeholder="Describe the agent's background and role..."
                rows={3}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="wizard-step-content model-step">
            <h3>Model Configuration</h3>
            <p>Configure which LLM powers this agent (optional - uses global default if not set).</p>
            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={!agent.modelConfig}
                  onChange={(e) => {
                    if (e.target.checked) {
                      updateAgent('modelConfig', undefined);
                    } else {
                      updateAgent('modelConfig', {
                        provider: 'anthropic',
                        model: 'claude-sonnet-4-20250514',
                        temperature: 0.3,
                        maxTokens: 4096,
                      });
                    }
                  }}
                />
                Use global default model configuration
              </label>
            </div>
            {agent.modelConfig && (
              <>
                <div className="form-group">
                  <label>Provider</label>
                  <select
                    value={agent.modelConfig.provider}
                    onChange={(e) => updateAgent('modelConfig', {
                      ...agent.modelConfig!,
                      provider: e.target.value,
                    })}
                  >
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="near-ai">NEAR AI</option>
                    <option value="azure-openai">Azure OpenAI</option>
                    <option value="local">Local (Ollama)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Model</label>
                  <input
                    type="text"
                    value={agent.modelConfig.model}
                    onChange={(e) => updateAgent('modelConfig', {
                      ...agent.modelConfig!,
                      model: e.target.value,
                    })}
                    placeholder="claude-sonnet-4-20250514"
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Temperature</label>
                    <input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={agent.modelConfig.temperature ?? 0.3}
                      onChange={(e) => updateAgent('modelConfig', {
                        ...agent.modelConfig!,
                        temperature: parseFloat(e.target.value),
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Tokens</label>
                    <input
                      type="number"
                      min="100"
                      max="100000"
                      step="100"
                      value={agent.modelConfig.maxTokens ?? 4096}
                      onChange={(e) => updateAgent('modelConfig', {
                        ...agent.modelConfig!,
                        maxTokens: parseInt(e.target.value),
                      })}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case 6:
        return (
          <div className="wizard-step-content tools-step">
            <h3>Tool Assignment</h3>
            <p>Select which tools this agent can use.</p>
            <div className="tools-grid">
              {tools.map(tool => (
                <label key={tool.toolId} className="tool-checkbox">
                  <input
                    type="checkbox"
                    checked={agent.assignedTools.includes(tool.toolId)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        updateAgent('assignedTools', [...agent.assignedTools, tool.toolId]);
                      } else {
                        updateAgent('assignedTools', agent.assignedTools.filter(t => t !== tool.toolId));
                      }
                    }}
                  />
                  <div className="tool-info">
                    <span className="tool-name">{tool.name}</span>
                    <span className="tool-desc">{tool.description}</span>
                    <span className="tool-category">{tool.category}</span>
                  </div>
                </label>
              ))}
              {tools.length === 0 && (
                <p className="no-tools">No tools available. Create tools in the Tools panel first.</p>
              )}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="wizard-step-content review-step">
            <h3>Review & Create</h3>
            <div className="review-summary">
              <div className="review-section">
                <h4>Basic Information</h4>
                <dl>
                  <dt>ID</dt>
                  <dd>{agent.id || '(auto-generated)'}</dd>
                  <dt>Name</dt>
                  <dd>{agent.name}</dd>
                  <dt>Description</dt>
                  <dd>{agent.description}</dd>
                  <dt>Enabled</dt>
                  <dd>{agent.isEnabled ? 'Yes' : 'No'}</dd>
                </dl>
              </div>
              <div className="review-section">
                <h4>Configuration</h4>
                <dl>
                  <dt>Phase</dt>
                  <dd>{agent.phase}</dd>
                  <dt>Autonomy</dt>
                  <dd>{agent.maxAutonomy}</dd>
                  <dt>Capabilities</dt>
                  <dd>{agent.capabilities.length > 0 ? agent.capabilities.join(', ') : 'None'}</dd>
                  <dt>Tools</dt>
                  <dd>{agent.assignedTools.length > 0 ? agent.assignedTools.join(', ') : 'None'}</dd>
                </dl>
              </div>
              {agent.character && (
                <div className="review-section">
                  <h4>Character</h4>
                  <dl>
                    <dt>Name</dt>
                    <dd>{agent.character.name}</dd>
                    <dt>Personality</dt>
                    <dd>{agent.character.personality?.join(', ') || '-'}</dd>
                    <dt>Expertise</dt>
                    <dd>{agent.character.expertise?.join(', ') || '-'}</dd>
                  </dl>
                </div>
              )}
              {agent.modelConfig && (
                <div className="review-section">
                  <h4>Model Configuration</h4>
                  <dl>
                    <dt>Provider</dt>
                    <dd>{agent.modelConfig.provider}</dd>
                    <dt>Model</dt>
                    <dd>{agent.modelConfig.model}</dd>
                    <dt>Temperature</dt>
                    <dd>{agent.modelConfig.temperature}</dd>
                  </dl>
                </div>
              )}
              {promptPreview && (
                <div className="review-section prompt-preview">
                  <h4>Generated System Prompt</h4>
                  <pre>{promptPreview}</pre>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="agent-builder-wizard-overlay">
      <div className="agent-builder-wizard">
        <div className="wizard-header">
          <h2>Create New Agent</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
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
                {loading ? 'Creating...' : 'Create Agent'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
