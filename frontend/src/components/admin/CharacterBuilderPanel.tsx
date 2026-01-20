/**
 * CharacterBuilderPanel Component
 *
 * Administrative panel for creating Eliza-compatible character definitions:
 * - Build character bio, lore, and knowledge
 * - Define communication style and personality
 * - Add conversation examples for few-shot learning
 * - Assign characters to agents
 */

import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import { adminService } from '../../lib/admin-service';
import type { AgentWithConfig, AgentCharacter } from '../../types/admin';
import { FormField } from './common/FormField';

// Zod schema for character form
const CharacterFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  bio: z.array(z.object({ value: z.string() })).default([]),
  lore: z.array(z.object({ value: z.string() })).default([]),
  knowledge: z.array(z.object({ value: z.string() })).default([]),
  topics: z.array(z.object({ value: z.string() })).default([]),
  adjectives: z.array(z.object({ value: z.string() })).default([]),
  postExamples: z.array(z.object({ value: z.string() })).default([]),
  styleAll: z.array(z.object({ value: z.string() })).default([]),
  styleChat: z.array(z.object({ value: z.string() })).default([]),
  stylePost: z.array(z.object({ value: z.string() })).default([]),
  modelProvider: z.string().optional(),
  plugins: z.string().optional(),
});

type CharacterFormData = z.infer<typeof CharacterFormSchema>;

// Helper to convert form data to AgentCharacter
function formToCharacter(data: CharacterFormData): AgentCharacter {
  return {
    name: data.name,
    bio: data.bio.map(b => b.value).filter(Boolean),
    lore: data.lore.map(l => l.value).filter(Boolean),
    knowledge: data.knowledge.map(k => k.value).filter(Boolean),
    messageExamples: [],
    postExamples: data.postExamples.map(p => p.value).filter(Boolean),
    topics: data.topics.map(t => t.value).filter(Boolean),
    style: {
      all: data.styleAll.map(s => s.value).filter(Boolean),
      chat: data.styleChat.map(s => s.value).filter(Boolean),
      post: data.stylePost.map(s => s.value).filter(Boolean),
    },
    adjectives: data.adjectives.map(a => a.value).filter(Boolean),
    modelProvider: data.modelProvider || undefined,
    plugins: data.plugins ? data.plugins.split(',').map(p => p.trim()).filter(Boolean) : [],
  };
}

// Helper to convert AgentCharacter to form data
function characterToForm(character: AgentCharacter): CharacterFormData {
  return {
    name: character.name,
    bio: character.bio.map(v => ({ value: v })),
    lore: character.lore.map(v => ({ value: v })),
    knowledge: character.knowledge.map(v => ({ value: v })),
    topics: character.topics.map(v => ({ value: v })),
    adjectives: character.adjectives.map(v => ({ value: v })),
    postExamples: character.postExamples.map(v => ({ value: v })),
    styleAll: character.style.all.map(v => ({ value: v })),
    styleChat: character.style.chat.map(v => ({ value: v })),
    stylePost: character.style.post.map(v => ({ value: v })),
    modelProvider: character.modelProvider || '',
    plugins: character.plugins.join(', '),
  };
}

export function CharacterBuilderPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Agents with/without characters
  const [agents, setAgents] = useState<AgentWithConfig[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [currentCharacter, setCurrentCharacter] = useState<AgentCharacter | null>(null);

  // Form state
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<CharacterFormData>({
    resolver: zodResolver(CharacterFormSchema),
    defaultValues: {
      name: '',
      bio: [],
      lore: [],
      knowledge: [],
      topics: [],
      adjectives: [],
      postExamples: [],
      styleAll: [],
      styleChat: [],
      stylePost: [],
      modelProvider: '',
      plugins: '',
    },
  });

  // Field arrays for dynamic entries
  const bioFields = useFieldArray({ control, name: 'bio' });
  const loreFields = useFieldArray({ control, name: 'lore' });
  const knowledgeFields = useFieldArray({ control, name: 'knowledge' });
  const topicsFields = useFieldArray({ control, name: 'topics' });
  const adjectivesFields = useFieldArray({ control, name: 'adjectives' });
  const postExamplesFields = useFieldArray({ control, name: 'postExamples' });
  const styleAllFields = useFieldArray({ control, name: 'styleAll' });
  const styleChatFields = useFieldArray({ control, name: 'styleChat' });
  const stylePostFields = useFieldArray({ control, name: 'stylePost' });

  // Load agents
  const loadAgents = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const agentList = await adminService.listAgents();
      setAgents(agentList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  // Load character when agent is selected
  const loadCharacter = useCallback(async (agentId: string) => {
    if (!agentId) {
      setCurrentCharacter(null);
      reset({
        name: '',
        bio: [],
        lore: [],
        knowledge: [],
        topics: [],
        adjectives: [],
        postExamples: [],
        styleAll: [],
        styleChat: [],
        stylePost: [],
        modelProvider: '',
        plugins: '',
      });
      return;
    }

    try {
      const character = await adminService.getAgentCharacter(agentId);
      if (character) {
        setCurrentCharacter(character);
        reset(characterToForm(character));
      } else {
        // No character - use agent name as default
        const agent = agents.find(a => a.agentId === agentId);
        setCurrentCharacter(null);
        reset({
          name: agent?.name || '',
          bio: [],
          lore: [],
          knowledge: [],
          topics: [],
          adjectives: [],
          postExamples: [],
          styleAll: [],
          styleChat: [],
          stylePost: [],
          modelProvider: '',
          plugins: '',
        });
      }
    } catch (err) {
      console.warn('Failed to load character:', err);
      setCurrentCharacter(null);
    }
  }, [agents, reset]);

  // Handle agent selection change
  const handleAgentChange = (agentId: string) => {
    setSelectedAgentId(agentId);
    loadCharacter(agentId);
  };

  // Save character
  const onSubmit = async (data: CharacterFormData) => {
    if (!selectedAgentId) {
      setError('Please select an agent first');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const character = formToCharacter(data);
      await adminService.updateAgentCharacter(selectedAgentId, character);

      setCurrentCharacter(character);
      setSuccessMessage('Character saved successfully!');

      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save character');
    } finally {
      setIsSaving(false);
    }
  };

  // Remove character
  const handleRemoveCharacter = async () => {
    if (!selectedAgentId) return;

    setIsRemoving(true);
    setError(null);

    try {
      await adminService.removeAgentCharacter(selectedAgentId);

      setCurrentCharacter(null);
      const agent = agents.find(a => a.agentId === selectedAgentId);
      reset({
        name: agent?.name || '',
        bio: [],
        lore: [],
        knowledge: [],
        topics: [],
        adjectives: [],
        postExamples: [],
        styleAll: [],
        styleChat: [],
        stylePost: [],
        modelProvider: '',
        plugins: '',
      });

      setSuccessMessage('Character removed');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove character');
    } finally {
      setIsRemoving(false);
    }
  };

  // Helper component for dynamic list entries
  const DynamicList = ({
    fields,
    append,
    remove,
    label,
    placeholder,
    register: registerFn,
  }: {
    fields: { id: string }[];
    append: () => void;
    remove: (idx: number) => void;
    label: string;
    placeholder: string;
    register: (name: string) => ReturnType<typeof register>;
  }) => (
    <div className="dynamic-list">
      <div className="dynamic-list-header">
        <span className="dynamic-list-label">{label}</span>
        <button
          type="button"
          className="btn btn--sm btn--secondary"
          onClick={() => append()}
        >
          + Add
        </button>
      </div>
      <div className="dynamic-list-items">
        {fields.length === 0 ? (
          <p className="dynamic-list-empty">No entries yet. Click "Add" to create one.</p>
        ) : (
          fields.map((field, idx) => (
            <div key={field.id} className="dynamic-list-item">
              <textarea
                {...registerFn(`${idx}.value` as any)}
                className="form-input form-textarea--sm"
                placeholder={placeholder}
                rows={2}
              />
              <button
                type="button"
                className="btn btn--sm btn--danger dynamic-list-remove"
                onClick={() => remove(idx)}
              >
                &times;
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="config-panel config-panel--loading">
        <div className="loading-spinner" />
        <p>Loading character builder...</p>
      </div>
    );
  }

  return (
    <div className="config-panel">
      <div className="config-panel-header">
        <h2>Character Builder</h2>
        <p>Create Eliza-compatible character definitions for agent personalities.</p>
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

      {/* Agent Selection */}
      <div className="config-section">
        <div className="config-section-header-row">
          <h3>Select Agent</h3>
          {currentCharacter && (
            <span className="badge badge--character">Has Character</span>
          )}
        </div>

        <FormField label="Agent">
          <select
            className="form-select"
            value={selectedAgentId}
            onChange={(e) => handleAgentChange(e.target.value)}
          >
            <option value="">Select an agent...</option>
            {agents.map(agent => (
              <option key={agent.agentId} value={agent.agentId}>
                {agent.name}
              </option>
            ))}
          </select>
        </FormField>
      </div>

      {selectedAgentId && (
        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs className="character-tabs">
            <TabList className="management-tab-list">
              <Tab className="management-tab" selectedClassName="management-tab--selected">
                Identity
              </Tab>
              <Tab className="management-tab" selectedClassName="management-tab--selected">
                Background
              </Tab>
              <Tab className="management-tab" selectedClassName="management-tab--selected">
                Style
              </Tab>
              <Tab className="management-tab" selectedClassName="management-tab--selected">
                Knowledge
              </Tab>
              <Tab className="management-tab" selectedClassName="management-tab--selected">
                Settings
              </Tab>
            </TabList>

            {/* Identity Tab */}
            <TabPanel className="management-tab-panel">
              <div className="config-section">
                <h3>Character Identity</h3>

                <FormField label="Character Name" required error={errors.name?.message}>
                  <input
                    type="text"
                    {...register('name')}
                    className="form-input"
                    placeholder="Enter character name"
                  />
                </FormField>

                <DynamicList
                  fields={adjectivesFields.fields}
                  append={() => adjectivesFields.append({ value: '' })}
                  remove={adjectivesFields.remove}
                  label="Personality Traits"
                  placeholder="e.g., analytical, cautious, helpful"
                  register={(name) => register(`adjectives.${name}` as any)}
                />

                <DynamicList
                  fields={topicsFields.fields}
                  append={() => topicsFields.append({ value: '' })}
                  remove={topicsFields.remove}
                  label="Topics of Interest"
                  placeholder="e.g., governance, security, AI ethics"
                  register={(name) => register(`topics.${name}` as any)}
                />
              </div>
            </TabPanel>

            {/* Background Tab */}
            <TabPanel className="management-tab-panel">
              <div className="config-section">
                <h3>Bio & Backstory</h3>

                <DynamicList
                  fields={bioFields.fields}
                  append={() => bioFields.append({ value: '' })}
                  remove={bioFields.remove}
                  label="Biography Entries"
                  placeholder="A brief statement about who the character is..."
                  register={(name) => register(`bio.${name}` as any)}
                />

                <DynamicList
                  fields={loreFields.fields}
                  append={() => loreFields.append({ value: '' })}
                  remove={loreFields.remove}
                  label="Lore & History"
                  placeholder="Background details, history, or world-building..."
                  register={(name) => register(`lore.${name}` as any)}
                />
              </div>
            </TabPanel>

            {/* Style Tab */}
            <TabPanel className="management-tab-panel">
              <div className="config-section">
                <h3>Communication Style</h3>
                <p className="config-section-desc">
                  Define how the character communicates in different contexts.
                </p>

                <DynamicList
                  fields={styleAllFields.fields}
                  append={() => styleAllFields.append({ value: '' })}
                  remove={styleAllFields.remove}
                  label="Universal Style (All Contexts)"
                  placeholder="e.g., uses technical terminology, asks clarifying questions"
                  register={(name) => register(`styleAll.${name}` as any)}
                />

                <DynamicList
                  fields={styleChatFields.fields}
                  append={() => styleChatFields.append({ value: '' })}
                  remove={styleChatFields.remove}
                  label="Chat Style (Conversational)"
                  placeholder="e.g., uses contractions, keeps responses concise"
                  register={(name) => register(`styleChat.${name}` as any)}
                />

                <DynamicList
                  fields={stylePostFields.fields}
                  append={() => stylePostFields.append({ value: '' })}
                  remove={stylePostFields.remove}
                  label="Post Style (Formal Writing)"
                  placeholder="e.g., uses bullet points, includes citations"
                  register={(name) => register(`stylePost.${name}` as any)}
                />

                <DynamicList
                  fields={postExamplesFields.fields}
                  append={() => postExamplesFields.append({ value: '' })}
                  remove={postExamplesFields.remove}
                  label="Example Posts"
                  placeholder="An example of how this character writes formally..."
                  register={(name) => register(`postExamples.${name}` as any)}
                />
              </div>
            </TabPanel>

            {/* Knowledge Tab */}
            <TabPanel className="management-tab-panel">
              <div className="config-section">
                <h3>Knowledge Base</h3>
                <p className="config-section-desc">
                  Add knowledge entries that will be available for RAG (Retrieval Augmented Generation).
                </p>

                <DynamicList
                  fields={knowledgeFields.fields}
                  append={() => knowledgeFields.append({ value: '' })}
                  remove={knowledgeFields.remove}
                  label="Knowledge Entries"
                  placeholder="A fact, definition, or piece of information the character knows..."
                  register={(name) => register(`knowledge.${name}` as any)}
                />
              </div>
            </TabPanel>

            {/* Settings Tab */}
            <TabPanel className="management-tab-panel">
              <div className="config-section">
                <h3>Advanced Settings</h3>

                <div className="form-row">
                  <FormField label="Model Provider Override" hint="Leave empty to use default">
                    <input
                      type="text"
                      {...register('modelProvider')}
                      className="form-input"
                      placeholder="e.g., anthropic, openai"
                    />
                  </FormField>
                </div>

                <div className="form-row">
                  <FormField label="Enabled Plugins" hint="Comma-separated list">
                    <input
                      type="text"
                      {...register('plugins')}
                      className="form-input"
                      placeholder="e.g., web_search, document_analysis"
                    />
                  </FormField>
                </div>
              </div>
            </TabPanel>
          </Tabs>

          <div className="form-actions character-actions">
            {currentCharacter && (
              <button
                type="button"
                className="btn btn--danger"
                onClick={handleRemoveCharacter}
                disabled={isRemoving}
              >
                {isRemoving ? 'Removing...' : 'Remove Character'}
              </button>
            )}

            <button
              type="submit"
              className="btn btn--primary"
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Saving...' : currentCharacter ? 'Update Character' : 'Create Character'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
