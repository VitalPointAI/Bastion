/**
 * OrderEditor
 *
 * Phase 14 Plan 09: WARNORD/OPORD/FRAGO authoring with AI generation and manual editing.
 * Supports dual-team perspective (Blue/Red), doctrinal order sequence, and publish workflow.
 *
 * Layout:
 * - Left sidebar (30%): order list with type filter and generate/create buttons
 * - Right content area (70%): order viewer/editor with per-type structured sections
 * - Bottom action bar: edit toggle, save draft, publish
 *
 * Per CONTEXT.md:
 * - Both AI-generated and manual authoring modes
 * - Per-team order content (Blue=CJTF WestPAC, Red=PRC/TCC)
 * - Order sequence follows doctrine: WARNORD -> OPORD -> FRAGOs
 */

import { useState, useEffect } from 'react';
import { exerciseService } from '../../services/exercise-service';
import type {
  ExerciseOrder,
  ScenarioCOA,
  WARNORDContent,
  OPORDContent,
  FRAGOContent,
} from '../../types/exercise';
import './OrderEditor.css';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OrderEditorProps {
  scenarioId: string;
  perspective: 'blue' | 'red';
  exercisePhase: string;
}

type OrderTypeFilter = 'ALL' | 'WARNORD' | 'OPORD' | 'FRAGO';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function isWARNORD(content: ExerciseOrder['content']): content is WARNORDContent {
  return 'missionStatement' in content;
}

function isOPORD(content: ExerciseOrder['content']): content is OPORDContent {
  return 'situation' in content && 'mission' in content && 'execution' in content;
}

function isFRAGO(content: ExerciseOrder['content']): content is FRAGOContent {
  return 'changedParagraphs' in content;
}

function emptyWARNORD(): WARNORDContent {
  return {
    situation: '',
    missionStatement: '',
    commandersIntent: '',
    initialTasks: [],
    timelineSummary: '',
    serviceAndSupport: '',
    commandAndSignal: '',
  };
}

function emptyOPORD(): OPORDContent {
  return {
    situation: {
      enemyForces: '',
      friendlyForces: '',
      assumptions: '',
    },
    mission: {
      who: '',
      what: '',
      when: '',
      where: '',
      why: '',
    },
    execution: {
      conceptOfOperations: '',
      subordinateTasks: [],
      coordinatingInstructions: '',
    },
    serviceAndSupport: {
      logistics: '',
      personnel: '',
      medical: '',
    },
    commandAndSignal: {
      commandPosts: '',
      reportingFrequency: '',
      signals: '',
    },
  };
}

function emptyFRAGO(): FRAGOContent {
  return {
    changedParagraphs: {},
    effectiveTime: new Date().toISOString().slice(0, 16),
    references: [],
  };
}

// ─── Order Type Badge ────────────────────────────────────────────────────────────

function OrderTypeBadge({ type }: { type: 'WARNORD' | 'OPORD' | 'FRAGO' }) {
  const classMap = {
    WARNORD: 'order-badge order-badge--warnord',
    OPORD: 'order-badge order-badge--opord',
    FRAGO: 'order-badge order-badge--frago',
  };
  return <span className={classMap[type]}>{type}</span>;
}

// ─── Status Badge ────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'draft' | 'published' }) {
  return (
    <span className={`order-status order-status--${status}`}>
      {status === 'draft' ? 'Draft' : 'Published'}
    </span>
  );
}

// ─── Doctrinal Sequence Diagram ──────────────────────────────────────────────────

function DoctrinalSequence() {
  return (
    <div className="order-sequence">
      <span className="order-seq-item order-seq-item--warnord">WARNORD</span>
      <span className="order-seq-arrow">→</span>
      <span className="order-seq-item order-seq-item--opord">OPORD</span>
      <span className="order-seq-arrow">→</span>
      <span className="order-seq-item order-seq-item--frago">FRAGOs</span>
    </div>
  );
}

// ─── WARNORD Editor ──────────────────────────────────────────────────────────────

interface WARNORDEditorProps {
  content: WARNORDContent;
  editMode: boolean;
  onChange: (updated: WARNORDContent) => void;
}

function WARNORDEditor({ content, editMode, onChange }: WARNORDEditorProps) {
  const field = (key: keyof WARNORDContent, label: string, placeholder = '') => {
    const val = content[key] as string;
    return (
      <div className="order-section">
        <label className="order-section-label">{label}</label>
        {editMode ? (
          <textarea
            className="order-textarea"
            value={val}
            placeholder={placeholder}
            rows={4}
            onChange={(e) => onChange({ ...content, [key]: e.target.value })}
          />
        ) : (
          <p className="order-section-text">{val || <em className="order-empty">Not specified</em>}</p>
        )}
      </div>
    );
  };

  return (
    <div className="order-body">
      {field('situation', 'Situation', 'Describe the current situation...')}
      {field('missionStatement', 'Mission Statement', 'State the mission clearly...')}
      {field('commandersIntent', "Commander's Intent", "State the commander's intent...")}

      <div className="order-section">
        <label className="order-section-label">Initial Tasks</label>
        {editMode && (
          <button
            className="btn-add-row"
            onClick={() =>
              onChange({
                ...content,
                initialTasks: [
                  ...content.initialTasks,
                  { assignedTo: '', task: '', purpose: '', deadline: '' },
                ],
              })
            }
          >
            + Add Task
          </button>
        )}
        {content.initialTasks.length === 0 && (
          <p className="order-empty">No initial tasks defined.</p>
        )}
        {content.initialTasks.length > 0 && (
          <table className="order-tasks-table">
            <thead>
              <tr>
                <th>Assigned To</th>
                <th>Task</th>
                <th>Purpose</th>
                <th>Deadline</th>
                {editMode && <th></th>}
              </tr>
            </thead>
            <tbody>
              {content.initialTasks.map((task, i) => (
                <tr key={i}>
                  <td>
                    {editMode ? (
                      <input
                        type="text"
                        value={task.assignedTo}
                        placeholder="Role or unit..."
                        onChange={(e) => {
                          const tasks = [...content.initialTasks];
                          tasks[i] = { ...tasks[i], assignedTo: e.target.value };
                          onChange({ ...content, initialTasks: tasks });
                        }}
                      />
                    ) : (
                      task.assignedTo || '—'
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <textarea
                        value={task.task}
                        rows={2}
                        placeholder="Task description..."
                        onChange={(e) => {
                          const tasks = [...content.initialTasks];
                          tasks[i] = { ...tasks[i], task: e.target.value };
                          onChange({ ...content, initialTasks: tasks });
                        }}
                      />
                    ) : (
                      task.task || '—'
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <textarea
                        value={task.purpose}
                        rows={2}
                        placeholder="Purpose..."
                        onChange={(e) => {
                          const tasks = [...content.initialTasks];
                          tasks[i] = { ...tasks[i], purpose: e.target.value };
                          onChange({ ...content, initialTasks: tasks });
                        }}
                      />
                    ) : (
                      task.purpose || '—'
                    )}
                  </td>
                  <td>
                    {editMode ? (
                      <input
                        type="date"
                        value={task.deadline ?? ''}
                        onChange={(e) => {
                          const tasks = [...content.initialTasks];
                          tasks[i] = { ...tasks[i], deadline: e.target.value };
                          onChange({ ...content, initialTasks: tasks });
                        }}
                      />
                    ) : (
                      task.deadline || '—'
                    )}
                  </td>
                  {editMode && (
                    <td>
                      <button
                        className="btn-remove-row"
                        onClick={() => {
                          const tasks = content.initialTasks.filter((_, idx) => idx !== i);
                          onChange({ ...content, initialTasks: tasks });
                        }}
                      >
                        ×
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {field('timelineSummary', 'Timeline Summary', 'Summarize key timeline events...')}
      {field('serviceAndSupport', '4. Service & Support', 'Service and support details...')}
      {field('commandAndSignal', '5. Command & Signal', 'Command posts, reporting, signals...')}
    </div>
  );
}

// ─── OPORD Sub-components (extracted to module scope for React Fast Refresh) ──

function SubField({
  paragraph,
  fieldKey,
  label,
  placeholder,
  content,
  editMode,
  onChange,
}: {
  paragraph: string;
  fieldKey: string;
  label: string;
  placeholder?: string;
  content: OPORDContent;
  editMode: boolean;
  onChange: (updated: OPORDContent) => void;
}) {
  const paragraphData = content[paragraph as keyof OPORDContent] as Record<string, unknown>;
  const val = paragraphData[fieldKey] as string;
  return (
    <div className="order-sub-section">
      <label className="order-sub-label">{label}</label>
      {editMode ? (
        <textarea
          className="order-textarea"
          value={val || ''}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => {
            onChange({
              ...content,
              [paragraph]: {
                ...paragraphData,
                [fieldKey]: e.target.value,
              },
            });
          }}
        />
      ) : (
        <p className="order-section-text">{val || <em className="order-empty">Not specified</em>}</p>
      )}
    </div>
  );
}

function SectionHeader({
  num,
  title,
  sectionKey,
  collapsed,
  toggleSection,
}: {
  num: string;
  title: string;
  sectionKey: string;
  collapsed: Record<string, boolean>;
  toggleSection: (key: string) => void;
}) {
  return (
    <div className="order-para-header" onClick={() => toggleSection(sectionKey)}>
      <span className="order-para-num">{num}</span>
      <span className="order-para-title">{title}</span>
      <span className="order-para-toggle">{collapsed[sectionKey] ? '+' : '−'}</span>
    </div>
  );
}

// ─── OPORD Editor ────────────────────────────────────────────────────────────────

interface OPORDEditorProps {
  content: OPORDContent;
  editMode: boolean;
  onChange: (updated: OPORDContent) => void;
}

function OPORDEditor({ content, editMode, onChange }: OPORDEditorProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleSection = (key: string) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const situation = content.situation as Record<string, unknown>;
  const mission = content.mission as Record<string, unknown>;
  const execution = content.execution as Record<string, unknown>;
  const _sustainment = content.serviceAndSupport as Record<string, unknown>;
  const cmdSig = content.commandAndSignal as Record<string, unknown>;

  return (
    <div className="order-body">
      {/* Paragraph 1 - Situation */}
      <div className="order-paragraph">
        <SectionHeader num="1." title="Situation" sectionKey="situation" collapsed={collapsed} toggleSection={toggleSection} />
        {!collapsed['situation'] && (
          <div className="order-para-body">
            <div className="order-sub-section">
              <label className="order-sub-label">a. Enemy Forces</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(situation.enemyForces as string) || ''}
                  placeholder="Describe enemy forces..."
                  rows={3}
                  onChange={(e) =>
                    onChange({ ...content, situation: { ...situation, enemyForces: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(situation.enemyForces as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
            <div className="order-sub-section">
              <label className="order-sub-label">b. Friendly Forces</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(situation.friendlyForces as string) || ''}
                  placeholder="Describe friendly forces..."
                  rows={3}
                  onChange={(e) =>
                    onChange({ ...content, situation: { ...situation, friendlyForces: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(situation.friendlyForces as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
            <div className="order-sub-section">
              <label className="order-sub-label">c. Assumptions</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(situation.assumptions as string) || ''}
                  placeholder="List planning assumptions..."
                  rows={3}
                  onChange={(e) =>
                    onChange({ ...content, situation: { ...situation, assumptions: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(situation.assumptions as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Paragraph 2 - Mission */}
      <div className="order-paragraph">
        <SectionHeader num="2." title="Mission" sectionKey="mission" collapsed={collapsed} toggleSection={toggleSection} />
        {!collapsed['mission'] && (
          <div className="order-para-body">
            {editMode ? (
              <textarea
                className="order-textarea"
                value={(mission.missionStatement as string) || (mission.who ? `${mission.who} ${mission.what} ${mission.where} NLT ${mission.when} in order to ${mission.why}` : '') || ''}
                placeholder="State the mission (who, what, when, where, why)..."
                rows={4}
                onChange={(e) =>
                  onChange({ ...content, mission: { ...mission, missionStatement: e.target.value } })
                }
              />
            ) : (
              <p className="order-section-text">
                {(mission.missionStatement as string) ||
                  (mission.who
                    ? `${mission.who} conducts ${mission.what} at ${mission.where} NLT ${mission.when} in order to ${mission.why}.`
                    : '') || <em className="order-empty">Not specified</em>}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Paragraph 3 - Execution */}
      <div className="order-paragraph">
        <SectionHeader num="3." title="Execution" sectionKey="execution" collapsed={collapsed} toggleSection={toggleSection} />
        {!collapsed['execution'] && (
          <div className="order-para-body">
            <div className="order-sub-section">
              <label className="order-sub-label">Concept of Operations</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(execution.conceptOfOperations as string) || ''}
                  placeholder="Describe the overall concept of operations..."
                  rows={4}
                  onChange={(e) =>
                    onChange({ ...content, execution: { ...execution, conceptOfOperations: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(execution.conceptOfOperations as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
            <div className="order-sub-section">
              <label className="order-sub-label">Coordinating Instructions</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(execution.coordinatingInstructions as string) || ''}
                  placeholder="List coordinating instructions..."
                  rows={3}
                  onChange={(e) =>
                    onChange({ ...content, execution: { ...execution, coordinatingInstructions: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(execution.coordinatingInstructions as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Paragraph 4 - Service & Support */}
      <div className="order-paragraph">
        <SectionHeader num="4." title="Service & Support" sectionKey="sustainment" collapsed={collapsed} toggleSection={toggleSection} />
        {!collapsed['sustainment'] && (
          <div className="order-para-body">
            <SubField paragraph="serviceAndSupport" fieldKey="logistics" label="Logistics" placeholder="Logistics support details..." content={content} editMode={editMode} onChange={onChange} />
            <SubField paragraph="serviceAndSupport" fieldKey="medical" label="Medical" placeholder="Medical support details..." content={content} editMode={editMode} onChange={onChange} />
          </div>
        )}
      </div>

      {/* Paragraph 5 - Command & Signal */}
      <div className="order-paragraph">
        <SectionHeader num="5." title="Command & Signal" sectionKey="cmdSig" collapsed={collapsed} toggleSection={toggleSection} />
        {!collapsed['cmdSig'] && (
          <div className="order-para-body">
            <div className="order-sub-section">
              <label className="order-sub-label">Command Posts</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(cmdSig.commandPosts as string) || ''}
                  placeholder="Command post locations..."
                  rows={2}
                  onChange={(e) =>
                    onChange({ ...content, commandAndSignal: { ...cmdSig, commandPosts: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(cmdSig.commandPosts as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
            <div className="order-sub-section">
              <label className="order-sub-label">Signals / Communications</label>
              {editMode ? (
                <textarea
                  className="order-textarea"
                  value={(cmdSig.signals as string) || ''}
                  placeholder="Communication frequencies, call signs..."
                  rows={2}
                  onChange={(e) =>
                    onChange({ ...content, commandAndSignal: { ...cmdSig, signals: e.target.value } })
                  }
                />
              ) : (
                <p className="order-section-text">{(cmdSig.signals as string) || <em className="order-empty">Not specified</em>}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FRAGO Editor ────────────────────────────────────────────────────────────────

interface FRAGOEditorProps {
  content: FRAGOContent;
  editMode: boolean;
  existingOrders: ExerciseOrder[];
  onChange: (updated: FRAGOContent) => void;
}

function FRAGOEditor({ content, editMode, existingOrders, onChange }: FRAGOEditorProps) {
  const changedKeys = Object.keys(content.changedParagraphs);
  const paragraphNames: Record<string, string> = {
    situation: '1. Situation',
    mission: '2. Mission',
    execution: '3. Execution',
    serviceAndSupport: '4. Service & Support',
    commandAndSignal: '5. Command & Signal',
  };

  return (
    <div className="order-body">
      <div className="order-section">
        <label className="order-section-label">Effective Time</label>
        {editMode ? (
          <input
            type="datetime-local"
            className="order-input"
            value={content.effectiveTime}
            onChange={(e) => onChange({ ...content, effectiveTime: e.target.value })}
          />
        ) : (
          <p className="order-section-text">{content.effectiveTime || '—'}</p>
        )}
      </div>

      <div className="order-section">
        <label className="order-section-label">References (Base Orders)</label>
        {existingOrders
          .filter((o) => content.references.includes(o.id))
          .map((o) => (
            <div key={o.id} className="order-ref-link">
              <OrderTypeBadge type={o.orderType} />
              <span>{o.exercisePhase}</span>
              <StatusBadge status={o.status} />
              <span className="order-ref-version">v{o.version}</span>
            </div>
          ))}
        {editMode && (
          <select
            className="order-select"
            value=""
            onChange={(e) => {
              const id = e.target.value;
              if (id && !content.references.includes(id)) {
                onChange({ ...content, references: [...content.references, id] });
              }
            }}
          >
            <option value="">+ Add reference order...</option>
            {existingOrders
              .filter((o) => o.orderType === 'OPORD' && !content.references.includes(o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.orderType} — {o.exercisePhase} v{o.version}
                </option>
              ))}
          </select>
        )}
      </div>

      <div className="order-section">
        <label className="order-section-label">Changed Paragraphs</label>
        <div className="order-changed-paragraphs">
          {changedKeys.length === 0 && (
            <p className="order-empty">No paragraphs changed.</p>
          )}
          {changedKeys.map((key) => (
            <span key={key} className="order-changed-badge">
              {paragraphNames[key] ?? key}
            </span>
          ))}
        </div>
        {editMode && (
          <select
            className="order-select"
            value=""
            onChange={(e) => {
              const key = e.target.value;
              if (key && !(key in content.changedParagraphs)) {
                onChange({
                  ...content,
                  changedParagraphs: {
                    ...content.changedParagraphs,
                    [key]: {},
                  },
                });
              }
            }}
          >
            <option value="">+ Mark paragraph as changed...</option>
            {Object.entries(paragraphNames)
              .filter(([k]) => !(k in content.changedParagraphs))
              .map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
          </select>
        )}
      </div>

      {changedKeys.map((key) => (
        <div key={key} className="order-section order-changed-section">
          <label className="order-section-label">{paragraphNames[key] ?? key} (Changed)</label>
          {editMode ? (
            <textarea
              className="order-textarea"
              value={JSON.stringify((content.changedParagraphs as Record<string, unknown>)[key] ?? {}, null, 2)}
              rows={5}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  onChange({
                    ...content,
                    changedParagraphs: {
                      ...content.changedParagraphs,
                      [key]: parsed,
                    },
                  });
                } catch {
                  // ignore invalid JSON while editing
                }
              }}
            />
          ) : (
            <pre className="order-section-text order-pre">
              {JSON.stringify((content.changedParagraphs as Record<string, unknown>)[key] ?? {}, null, 2)}
            </pre>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Publish Confirmation Modal ──────────────────────────────────────────────────

interface PublishModalProps {
  order: ExerciseOrder;
  onConfirm: () => void;
  onCancel: () => void;
  publishing: boolean;
}

function PublishModal({ order, onConfirm, onCancel, publishing }: PublishModalProps) {
  const teamLabel = order.team === 'blue' ? 'Blue (CJTF WestPAC)' : 'Red (PRC/TCC)';
  return (
    <div className="order-modal-overlay" onClick={onCancel}>
      <div className="order-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Publish {order.orderType}?</h3>
        <p className="order-modal-body">
          Publishing this order will create planning tasks for{' '}
          <strong>{teamLabel}</strong> staff for phase{' '}
          <strong>{order.exercisePhase}</strong>. Tasks will appear on the Planning
          Board and cannot be undone.
        </p>
        <div className="order-modal-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={publishing}>
            Cancel
          </button>
          <button className="btn-publish" onClick={onConfirm} disabled={publishing}>
            {publishing ? 'Publishing...' : 'Publish Order'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Generate OPORD Dialog ───────────────────────────────────────────────────────

interface GenerateOPORDDialogProps {
  coas: ScenarioCOA[];
  onGenerate: (coaId: string) => void;
  onCancel: () => void;
  generating: boolean;
}

function GenerateOPORDDialog({ coas, onGenerate, onCancel, generating }: GenerateOPORDDialogProps) {
  const [selectedCOA, setSelectedCOA] = useState('');
  const approvedCOAs = coas.filter((c) => c.commanderDecision === 'accepted' || c.selected);

  return (
    <div className="order-modal-overlay" onClick={onCancel}>
      <div className="order-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Generate OPORD</h3>
        <p className="order-modal-body">Select the approved COA to base this OPORD on:</p>
        {approvedCOAs.length === 0 ? (
          <p className="order-empty">No approved COAs available. Approve a COA first.</p>
        ) : (
          <select
            className="order-select"
            value={selectedCOA}
            onChange={(e) => setSelectedCOA(e.target.value)}
          >
            <option value="">-- Select COA --</option>
            {approvedCOAs.map((coa) => (
              <option key={coa.id} value={coa.id}>
                COA {coa.number}: {coa.name}
              </option>
            ))}
          </select>
        )}
        <div className="order-modal-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={generating}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => selectedCOA && onGenerate(selectedCOA)}
            disabled={!selectedCOA || generating}
          >
            {generating ? 'Generating...' : 'Generate OPORD'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Generate FRAGO Dialog ───────────────────────────────────────────────────────

interface GenerateFRAGODialogProps {
  orders: ExerciseOrder[];
  onGenerate: (baseOrderId: string) => void;
  onCancel: () => void;
  generating: boolean;
}

function GenerateFRAGODialog({ orders, onGenerate, onCancel, generating }: GenerateFRAGODialogProps) {
  const [selectedOrder, setSelectedOrder] = useState('');
  const opords = orders.filter((o) => o.orderType === 'OPORD');

  return (
    <div className="order-modal-overlay" onClick={onCancel}>
      <div className="order-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Generate FRAGO</h3>
        <p className="order-modal-body">Select the OPORD this FRAGO modifies:</p>
        {opords.length === 0 ? (
          <p className="order-empty">No OPORDs available. Generate an OPORD first.</p>
        ) : (
          <select
            className="order-select"
            value={selectedOrder}
            onChange={(e) => setSelectedOrder(e.target.value)}
          >
            <option value="">-- Select OPORD --</option>
            {opords.map((o) => (
              <option key={o.id} value={o.id}>
                OPORD — {o.exercisePhase} v{o.version}
              </option>
            ))}
          </select>
        )}
        <div className="order-modal-actions">
          <button className="btn-cancel" onClick={onCancel} disabled={generating}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={() => selectedOrder && onGenerate(selectedOrder)}
            disabled={!selectedOrder || generating}
          >
            {generating ? 'Generating...' : 'Generate FRAGO'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── OrderEditor ─────────────────────────────────────────────────────────────────

export function OrderEditor({ scenarioId, perspective, exercisePhase }: OrderEditorProps) {
  // ── State ────────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<ExerciseOrder[]>([]);
  const [coas, setCoas] = useState<ScenarioCOA[]>([]);
  const [activeOrder, setActiveOrder] = useState<ExerciseOrder | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editContent, setEditContent] = useState<ExerciseOrder['content'] | null>(null);
  const [typeFilter, setTypeFilter] = useState<OrderTypeFilter>('ALL');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Dialog states
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [showOPORDDialog, setShowOPORDDialog] = useState(false);
  const [showFRAGODialog, setShowFRAGODialog] = useState(false);

  // ── Load orders ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [ordersData, coasData] = await Promise.all([
          exerciseService.getOrders(scenarioId, { team: perspective }),
          exerciseService.getCOAs(scenarioId, { team: perspective }),
        ]);
        setOrders(ordersData);
        setCoas(coasData);
        if (ordersData.length > 0 && !activeOrder) {
          setActiveOrder(ordersData[0]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load orders');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioId, perspective, exercisePhase]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleSelectOrder = (order: ExerciseOrder) => {
    setActiveOrder(order);
    setEditMode(false);
    setEditContent(null);
    setSuccessMsg(null);
    setError(null);
  };

  const handleEditToggle = () => {
    if (!editMode && activeOrder) {
      setEditContent(JSON.parse(JSON.stringify(activeOrder.content)));
    } else {
      setEditContent(null);
    }
    setEditMode((prev) => !prev);
  };

  const handleSaveDraft = async () => {
    if (!activeOrder || !editContent) return;
    setSaving(true);
    setError(null);
    try {
      await exerciseService.updateOrderContent(activeOrder.id, editContent);
      // Refresh orders
      const updated = await exerciseService.getOrders(scenarioId, { team: perspective });
      setOrders(updated);
      const refreshed = updated.find((o) => o.id === activeOrder.id);
      if (refreshed) {
        setActiveOrder(refreshed);
        setEditContent(JSON.parse(JSON.stringify(refreshed.content)));
      }
      setSuccessMsg('Draft saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handlePublishConfirm = async () => {
    if (!activeOrder) return;
    setPublishing(true);
    setError(null);
    try {
      const result = await exerciseService.publishOrder(activeOrder.id);
      const updated = await exerciseService.getOrders(scenarioId, { team: perspective });
      setOrders(updated);
      setActiveOrder(result.order);
      setEditMode(false);
      setEditContent(null);
      setShowPublishModal(false);
      setSuccessMsg(`Order published. ${result.tasks.length} planning task${result.tasks.length !== 1 ? 's' : ''} created.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish order');
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateWARNORD = async () => {
    setGenerating(true);
    setError(null);
    try {
      const order = await exerciseService.generateOrder(scenarioId, {
        team: perspective,
        orderType: 'WARNORD',
        exercisePhase,
      });
      const updated = await exerciseService.getOrders(scenarioId, { team: perspective });
      setOrders(updated);
      setActiveOrder(order);
      setEditMode(false);
      setEditContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate WARNORD');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateOPORD = async (coaId: string) => {
    setGenerating(true);
    setError(null);
    try {
      const order = await exerciseService.generateOrder(scenarioId, {
        team: perspective,
        orderType: 'OPORD',
        exercisePhase,
        coaId,
      });
      const updated = await exerciseService.getOrders(scenarioId, { team: perspective });
      setOrders(updated);
      setActiveOrder(order);
      setShowOPORDDialog(false);
      setEditMode(false);
      setEditContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate OPORD');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFRAGO = async (baseOrderId: string) => {
    setGenerating(true);
    setError(null);
    try {
      const order = await exerciseService.generateOrder(scenarioId, {
        team: perspective,
        orderType: 'FRAGO',
        exercisePhase,
        referencedOrderId: baseOrderId,
      });
      const updated = await exerciseService.getOrders(scenarioId, { team: perspective });
      setOrders(updated);
      setActiveOrder(order);
      setShowFRAGODialog(false);
      setEditMode(false);
      setEditContent(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate FRAGO');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateBlankDraft = async (orderType: 'WARNORD' | 'OPORD' | 'FRAGO') => {
    setGenerating(true);
    setError(null);
    const contentMap = {
      WARNORD: emptyWARNORD(),
      OPORD: emptyOPORD(),
      FRAGO: emptyFRAGO(),
    };
    try {
      const order = await exerciseService.createDraftOrder(scenarioId, {
        team: perspective,
        orderType,
        exercisePhase,
        content: contentMap[orderType],
      });
      const updated = await exerciseService.getOrders(scenarioId, { team: perspective });
      setOrders(updated);
      setActiveOrder(order);
      setEditMode(true);
      setEditContent(JSON.parse(JSON.stringify(order.content)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create draft');
    } finally {
      setGenerating(false);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────

  const filteredOrders = typeFilter === 'ALL'
    ? orders
    : orders.filter((o) => o.orderType === typeFilter);

  const hasWARNORD = orders.some((o) => o.orderType === 'WARNORD');
  const teamLabel = perspective === 'blue' ? 'Blue (CJTF WestPAC)' : 'Red (PRC/TCC)';

  const currentContent = editMode && editContent ? editContent : activeOrder?.content ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="order-editor-shell">
        <div className="order-loading">Loading orders...</div>
      </div>
    );
  }

  return (
    <div className={`order-editor-shell order-editor--${perspective}`}>

      {/* Left Sidebar */}
      <aside className="order-sidebar">
        <DoctrinalSequence />

        {/* Type filter */}
        <div className="order-type-filter">
          {(['ALL', 'WARNORD', 'OPORD', 'FRAGO'] as OrderTypeFilter[]).map((t) => (
            <button
              key={t}
              className={`order-filter-btn ${typeFilter === t ? 'active' : ''}`}
              onClick={() => setTypeFilter(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Order list */}
        <div className="order-list">
          {filteredOrders.length === 0 && (
            <p className="order-list-empty">No orders yet. Generate or create one below.</p>
          )}
          {filteredOrders.map((order) => {
            const isFirst = order.orderType === 'WARNORD' && !hasWARNORD;
            return (
              <div
                key={order.id}
                className={`order-list-item ${activeOrder?.id === order.id ? 'active' : ''}`}
                onClick={() => handleSelectOrder(order)}
              >
                <div className="order-list-item-header">
                  <OrderTypeBadge type={order.orderType} />
                  <StatusBadge status={order.status} />
                  {isFirst && <span className="order-initiation-badge">Exercise Init</span>}
                </div>
                <div className="order-list-item-meta">
                  <span>{order.exercisePhase}</span>
                  <span className="order-list-version">v{order.version}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Generate buttons */}
        <div className="order-generate-group">
          <p className="order-generate-label">AI-Generated</p>
          <button
            className="btn-generate btn-generate--warnord"
            onClick={handleGenerateWARNORD}
            disabled={generating}
          >
            {generating ? 'Generating...' : 'Generate WARNORD'}
          </button>
          <button
            className="btn-generate btn-generate--opord"
            onClick={() => setShowOPORDDialog(true)}
            disabled={generating}
          >
            Generate OPORD
          </button>
          <button
            className="btn-generate btn-generate--frago"
            onClick={() => setShowFRAGODialog(true)}
            disabled={generating}
          >
            Generate FRAGO
          </button>
        </div>

        <div className="order-create-group">
          <p className="order-generate-label">Manual Authoring</p>
          <button
            className="btn-create-blank"
            onClick={() => handleCreateBlankDraft('WARNORD')}
            disabled={generating}
          >
            Blank WARNORD
          </button>
          <button
            className="btn-create-blank"
            onClick={() => handleCreateBlankDraft('OPORD')}
            disabled={generating}
          >
            Blank OPORD
          </button>
          <button
            className="btn-create-blank"
            onClick={() => handleCreateBlankDraft('FRAGO')}
            disabled={generating}
          >
            Blank FRAGO
          </button>
        </div>
      </aside>

      {/* Right Content Area */}
      <main className="order-content">
        {!activeOrder ? (
          <div className="order-empty-state">
            <p>Select an order from the list, or generate a new one.</p>
            <p className="order-team-hint">Team: <strong>{teamLabel}</strong></p>
          </div>
        ) : (
          <>
            {/* Order header */}
            <div className="order-content-header">
              <div className="order-content-meta">
                <OrderTypeBadge type={activeOrder.orderType} />
                <span className="order-content-team">{teamLabel}</span>
                <span className="order-content-phase">{activeOrder.exercisePhase}</span>
                <StatusBadge status={activeOrder.status} />
                <span className="order-content-version">v{activeOrder.version}</span>
              </div>
              {activeOrder.orderType === 'WARNORD' && orders.indexOf(activeOrder) === 0 && orders.length > 0 && (
                <div className="order-initiation-callout">
                  Exercise Initiation Order — This WARNORD initiates the exercise cycle.
                </div>
              )}
              {editMode && (
                <div className="order-edit-indicator">EDIT MODE — Changes not yet saved</div>
              )}
            </div>

            {/* Error / success banners */}
            {error && <div className="order-error">{error}</div>}
            {successMsg && (
              <div className="order-success">
                {successMsg}
              </div>
            )}

            {/* Order body */}
            {activeOrder.orderType === 'WARNORD' && currentContent && isWARNORD(currentContent) && (
              <WARNORDEditor
                content={currentContent}
                editMode={editMode}
                onChange={(updated) => setEditContent(updated)}
              />
            )}
            {activeOrder.orderType === 'OPORD' && currentContent && isOPORD(currentContent) && (
              <OPORDEditor
                content={currentContent}
                editMode={editMode}
                onChange={(updated) => setEditContent(updated)}
              />
            )}
            {activeOrder.orderType === 'FRAGO' && currentContent && isFRAGO(currentContent) && (
              <FRAGOEditor
                content={currentContent}
                editMode={editMode}
                existingOrders={orders}
                onChange={(updated) => setEditContent(updated)}
              />
            )}

            {/* Action bar */}
            <div className="order-action-bar">
              {activeOrder.status === 'draft' && (
                <>
                  <button
                    className={`btn-edit-toggle ${editMode ? 'active' : ''}`}
                    onClick={handleEditToggle}
                  >
                    {editMode ? 'Cancel Edit' : 'Edit'}
                  </button>
                  {editMode && (
                    <button
                      className="btn-save-draft"
                      onClick={handleSaveDraft}
                      disabled={saving || !editContent}
                    >
                      {saving ? 'Saving...' : 'Save Draft'}
                    </button>
                  )}
                  <button
                    className="btn-publish"
                    onClick={() => setShowPublishModal(true)}
                    disabled={publishing}
                  >
                    Publish Order
                  </button>
                </>
              )}
              {activeOrder.status === 'published' && (
                <span className="order-published-note">
                  Published {activeOrder.publishedAt
                    ? new Date(activeOrder.publishedAt).toLocaleString()
                    : ''}
                </span>
              )}
            </div>
          </>
        )}
      </main>

      {/* Dialogs */}
      {showPublishModal && activeOrder && (
        <PublishModal
          order={activeOrder}
          onConfirm={handlePublishConfirm}
          onCancel={() => setShowPublishModal(false)}
          publishing={publishing}
        />
      )}
      {showOPORDDialog && (
        <GenerateOPORDDialog
          coas={coas}
          onGenerate={handleGenerateOPORD}
          onCancel={() => setShowOPORDDialog(false)}
          generating={generating}
        />
      )}
      {showFRAGODialog && (
        <GenerateFRAGODialog
          orders={orders}
          onGenerate={handleGenerateFRAGO}
          onCancel={() => setShowFRAGODialog(false)}
          generating={generating}
        />
      )}
    </div>
  );
}
