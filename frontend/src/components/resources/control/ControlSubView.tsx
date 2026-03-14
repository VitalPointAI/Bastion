/**
 * ControlSubView
 *
 * General-purpose resource command & control panel.
 * Queries GET /api/resources/:id/commands to discover available commands
 * per resource, then dynamically renders parameter forms from the schema.
 *
 * Works with any resource type — robots get mission commands, other resources
 * get lifecycle and plugin-defined Bastion commands.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { ResourceStatus, ResourceCategory } from '../../../lib/resource-service';

// ─── Types ──────────────────────────────────────────────────────────────────

interface CommandParamField {
  name: string;
  type: 'number' | 'string' | 'boolean' | 'select' | 'location' | 'waypoints' | 'area' | 'file';
  label: string;
  required?: boolean;
  default?: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  description?: string;
}

interface CommandDefinition {
  command: string;
  label: string;
  description: string;
  group: string;
  params: CommandParamField[];
}

interface ResourceCommands {
  resource_id: string;
  name: string;
  category: ResourceCategory;
  capabilities: string[];
  is_autonomous: boolean;
  commands: CommandDefinition[];
}

interface ResourceInfo {
  id: string;
  name: string;
  category: ResourceCategory;
  status: ResourceStatus;
  did?: string;
  isAutonomous?: boolean;
  capabilities?: string[];
  groupId?: string;
}

interface RobotInfo {
  robot_id: string;
  did: string;
  state: string;
  current_mission_id?: string;
  capabilities?: string[];
  latest_telemetry?: {
    position: { x: number; y: number };
    heading: number;
    battery: number;
  };
}

interface Waypoint {
  x: number;
  y: number;
}

interface ControlSubViewProps {
  problemSetId: string;
}

// ─── Status colors ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  FMC: { color: '#86efac', bg: 'rgba(34,197,94,0.15)', label: 'Fully Mission Capable' },
  PMC: { color: '#fde047', bg: 'rgba(234,179,8,0.15)', label: 'Partially Mission Capable' },
  NMC: { color: '#fca5a5', bg: 'rgba(239,68,68,0.15)', label: 'Not Mission Capable' },
};

const GROUP_COLORS: Record<string, string> = {
  mission: '#3b82f6',
  swarm: '#eab308',
  bastion: '#8b5cf6',
  lifecycle: '#6b7280',
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ControlSubView({ problemSetId }: ControlSubViewProps) {
  const [resources, setResources] = useState<ResourceInfo[]>([]);
  const [robots, setRobots] = useState<RobotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<ResourceStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<ResourceCategory | 'all'>('all');

  // Selected resource & its commands
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);
  const [resourceCommands, setResourceCommands] = useState<ResourceCommands | null>(null);
  const [loadingCommands, setLoadingCommands] = useState(false);

  // Active command execution
  const [activeCommand, setActiveCommand] = useState<CommandDefinition | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [executing, setExecuting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [resRes, robotsRes] = await Promise.all([
        fetch(`/api/resources?missionId=${problemSetId}`),
        fetch('/api/robot/robots'),
      ]);
      if (resRes.ok) {
        const data = await resRes.json();
        setResources(Array.isArray(data) ? data : data.resources || []);
      }
      if (robotsRes.ok) setRobots(await robotsRes.json());
    } catch (err) {
      console.warn('[ControlSubView] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Fetch commands when resource selected
  useEffect(() => {
    if (!selectedResourceId) {
      setResourceCommands(null);
      setActiveCommand(null);
      return;
    }
    let cancelled = false;
    setLoadingCommands(true);
    fetch(`/api/resources/${selectedResourceId}/commands`)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (!cancelled && data) setResourceCommands(data);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingCommands(false); });
    return () => { cancelled = true; };
  }, [selectedResourceId]);

  // Clear message after 4s
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // ─── Command execution ────────────────────────────────────────────────────

  function selectCommand(cmd: CommandDefinition) {
    setActiveCommand(cmd);
    // Initialize param values with defaults
    const defaults: Record<string, unknown> = {};
    for (const p of cmd.params) {
      if (p.default !== undefined) defaults[p.name] = p.default;
      else if (p.type === 'location') defaults[p.name] = { x: 2.5, y: 2.5 };
      else if (p.type === 'waypoints') defaults[p.name] = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 2.5, y: 4 }];
      else if (p.type === 'area') defaults[p.name] = { x_min: 0, y_min: 0, x_max: 5, y_max: 5 };
      else if (p.type === 'boolean') defaults[p.name] = false;
      else if (p.type === 'string') defaults[p.name] = '';
      else if (p.type === 'number') defaults[p.name] = p.min ?? 0;
    }
    setParamValues(defaults);
    setMessage(null);
  }

  async function executeCommand() {
    if (!activeCommand || !selectedResourceId) return;

    setExecuting(true);
    setMessage(null);

    try {
      // Route to the appropriate API based on command group
      if (activeCommand.command === 'set_status') {
        // Lifecycle command — use status endpoint
        const res = await fetch(`/api/resources/${selectedResourceId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: paramValues.status }),
        });
        if (res.ok) {
          setMessage({ type: 'success', text: `Status updated to ${paramValues.status}` });
          fetchData();
        } else {
          const data = await res.json();
          setMessage({ type: 'error', text: data.error || 'Failed' });
        }
      } else if (activeCommand.group === 'mission' || activeCommand.group === 'swarm') {
        // Robot mission command — find the robot for this resource
        const resource = resources.find((r) => r.id === selectedResourceId);
        const robot = resource?.did ? robots.find((r) => r.did === resource.did) : undefined;
        const robotId = robot?.robot_id || resource?.name || 'alpha';

        const res = await fetch('/api/robot/missions/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            robot_id: robotId,
            command: activeCommand.command,
            params: paramValues,
            problem_set_id: problemSetId,
          }),
        });

        const data = await res.json() as { mission_id?: string; error?: string; reason?: string };
        if (res.status === 201 && data.mission_id) {
          setMessage({ type: 'success', text: `Mission dispatched: ${data.mission_id.slice(0, 8)}...` });
        } else if (res.status === 403) {
          setMessage({ type: 'error', text: `Policy violation: ${data.reason || data.error}` });
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to dispatch' });
        }
      } else {
        // Bastion command or plugin command — placeholder for future execution
        setMessage({ type: 'success', text: `Command '${activeCommand.command}' queued (adapter integration pending)` });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setExecuting(false);
    }
  }

  // ─── Robot enrichment ────────────────────────────────────────────────────

  function getRobotForResource(resource: ResourceInfo): RobotInfo | undefined {
    return resource.did ? robots.find((r) => r.did === resource.did) : undefined;
  }

  // ─── Filtering ────────────────────────────────────────────────────────────

  const filteredResources = resources.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
    return true;
  });

  const statusCounts = resources.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>Loading resources...</div>;
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left panel — resource list */}
      <div style={{
        width: selectedResourceId ? '45%' : '100%',
        borderRight: selectedResourceId ? '1px solid var(--border-color, #334155)' : 'none',
        overflowY: 'auto',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transition: 'width 0.2s',
      }}>
        {/* Summary pills */}
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          <SummaryPill label="Total" count={resources.length} color="#94a3b8" />
          <SummaryPill label="FMC" count={statusCounts.FMC || 0} color="#22c55e" />
          <SummaryPill label="PMC" count={statusCounts.PMC || 0} color="#eab308" />
          <SummaryPill label="NMC" count={statusCounts.NMC || 0} color="#ef4444" />
          <SummaryPill label="Online" count={robots.length} color="#8b5cf6" />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.375rem' }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ResourceStatus | 'all')} style={filterSelect}>
            <option value="all">All Status</option>
            <option value="FMC">FMC</option>
            <option value="PMC">PMC</option>
            <option value="NMC">NMC</option>
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value as ResourceCategory | 'all')} style={filterSelect}>
            <option value="all">All Categories</option>
            <option value="vehicles">Vehicles</option>
            <option value="communications">Comms</option>
            <option value="sensors">Sensors</option>
            <option value="weapons">Weapons</option>
            <option value="medical">Medical</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Resource list */}
        {filteredResources.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#475569', fontSize: '0.8125rem' }}>
            No resources match filters
          </div>
        ) : (
          filteredResources.map((resource) => {
            const robot = getRobotForResource(resource);
            const statusConf = STATUS_CONFIG[resource.status] || STATUS_CONFIG.NMC;
            const isSelected = selectedResourceId === resource.id;

            return (
              <button
                key={resource.id}
                onClick={() => setSelectedResourceId(isSelected ? null : resource.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  padding: '0.625rem 0.75rem',
                  background: isSelected ? 'rgba(59,130,246,0.1)' : 'var(--surface-secondary, #1e293b)',
                  border: `1px solid ${isSelected ? 'rgba(59,130,246,0.4)' : 'var(--border-color, #334155)'}`,
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {/* Status indicator */}
                <div style={{
                  width: '10px', height: '10px', borderRadius: '50%',
                  background: statusConf.color,
                  flexShrink: 0,
                  boxShadow: robot?.state === 'connected' ? `0 0 6px ${statusConf.color}` : 'none',
                }} />

                {/* Name + meta */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <span style={{ fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600 }}>
                      {resource.name || resource.id.slice(0, 12)}
                    </span>
                    {resource.isAutonomous && (
                      <span style={autoBadge}>AUTO</span>
                    )}
                    {robot && (
                      <span style={{
                        fontSize: '0.5625rem', padding: '0 0.25rem', borderRadius: '0.125rem',
                        background: robot.state === 'connected' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                        color: robot.state === 'connected' ? '#86efac' : '#fca5a5',
                      }}>
                        {robot.robot_id}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.625rem', color: '#475569', marginTop: '0.125rem' }}>
                    {resource.category}
                    {(resource.capabilities?.length ?? 0) > 0 && ` · ${resource.capabilities!.length} capabilities`}
                    {robot?.latest_telemetry && ` · bat: ${robot.latest_telemetry.battery}%`}
                  </div>
                </div>

                {/* Status badge */}
                <span style={{
                  fontSize: '0.625rem', padding: '0.125rem 0.375rem', borderRadius: '0.25rem',
                  background: statusConf.bg, color: statusConf.color, fontWeight: 600, flexShrink: 0,
                }}>
                  {resource.status}
                </span>
              </button>
            );
          })
        )}
      </div>

      {/* Right panel — command & control */}
      {selectedResourceId && (
        <div style={{
          width: '55%',
          overflowY: 'auto',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          {loadingCommands ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
              Discovering commands...
            </div>
          ) : resourceCommands ? (
            <>
              {/* Resource header */}
              <div style={{
                padding: '0.75rem',
                background: 'var(--surface-secondary, #1e293b)',
                borderRadius: '0.5rem',
                border: '1px solid var(--border-color, #334155)',
              }}>
                <div style={{ fontSize: '0.875rem', color: '#e2e8f0', fontWeight: 600 }}>
                  {resourceCommands.name}
                </div>
                <div style={{ fontSize: '0.6875rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {resourceCommands.category} · {resourceCommands.capabilities.length} capabilities
                  {resourceCommands.is_autonomous && ' · autonomous'}
                </div>
                {resourceCommands.capabilities.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.375rem' }}>
                    {resourceCommands.capabilities.map((cap) => (
                      <span key={cap} style={capBadge}>{cap}</span>
                    ))}
                  </div>
                )}
              </div>

              {/* Available commands grouped */}
              <div>
                <div style={sectionLabel}>
                  Available Commands ({resourceCommands.commands.length})
                </div>
                {Object.entries(groupCommands(resourceCommands.commands)).map(([group, cmds]) => (
                  <div key={group} style={{ marginBottom: '0.75rem' }}>
                    <div style={{
                      fontSize: '0.625rem', color: GROUP_COLORS[group] || '#64748b',
                      textTransform: 'uppercase', letterSpacing: '0.05em',
                      marginBottom: '0.25rem', fontWeight: 600,
                    }}>
                      {group === 'mission' ? 'Mission Commands' :
                       group === 'swarm' ? 'Swarm Commands' :
                       group === 'bastion' ? 'Device Commands' :
                       'Lifecycle'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {cmds.map((cmd) => {
                        const isActive = activeCommand?.command === cmd.command;
                        return (
                          <button
                            key={cmd.command}
                            onClick={() => selectCommand(cmd)}
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '0.5rem 0.625rem',
                              background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                              border: `1px solid ${isActive ? 'rgba(59,130,246,0.4)' : 'var(--border-color, #334155)'}`,
                              borderRadius: '0.375rem',
                              color: isActive ? '#93c5fd' : '#94a3b8',
                              cursor: 'pointer',
                              textAlign: 'left',
                              width: '100%',
                              transition: 'all 0.15s',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400 }}>
                                {cmd.label}
                              </div>
                              <div style={{ fontSize: '0.625rem', color: '#475569', marginTop: '0.125rem' }}>
                                {cmd.description}
                              </div>
                            </div>
                            <span style={{
                              fontSize: '0.5625rem', color: GROUP_COLORS[cmd.group] || '#475569',
                              padding: '0.0625rem 0.25rem', borderRadius: '0.125rem',
                              background: `${GROUP_COLORS[cmd.group] || '#475569'}15`,
                            }}>
                              {cmd.params.length} params
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Active command form */}
              {activeCommand && (
                <div style={{
                  padding: '0.75rem',
                  background: 'var(--surface-secondary, #1e293b)',
                  borderRadius: '0.5rem',
                  border: `1px solid ${GROUP_COLORS[activeCommand.group] || '#334155'}40`,
                }}>
                  <div style={{
                    fontSize: '0.8125rem', color: '#e2e8f0', fontWeight: 600, marginBottom: '0.75rem',
                    display: 'flex', alignItems: 'center', gap: '0.375rem',
                  }}>
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: GROUP_COLORS[activeCommand.group] || '#64748b',
                    }} />
                    {activeCommand.label}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                    {activeCommand.params.map((param) => (
                      <DynamicParamField
                        key={param.name}
                        field={param}
                        value={paramValues[param.name]}
                        onChange={(v) => setParamValues((prev) => ({ ...prev, [param.name]: v }))}
                      />
                    ))}
                  </div>

                  {/* Execute button */}
                  <button
                    onClick={executeCommand}
                    disabled={executing}
                    style={{
                      width: '100%',
                      marginTop: '0.75rem',
                      padding: '0.5rem',
                      background: executing ? '#1e3a5f' : GROUP_COLORS[activeCommand.group] || '#2563eb',
                      border: 'none',
                      borderRadius: '0.375rem',
                      color: 'white',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      cursor: executing ? 'not-allowed' : 'pointer',
                      opacity: executing ? 0.7 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem',
                    }}
                  >
                    {executing ? (
                      <>
                        <span style={spinner} />
                        Executing...
                      </>
                    ) : (
                      `Execute ${activeCommand.label}`
                    )}
                  </button>

                  {/* Message */}
                  {message && (
                    <div style={{
                      marginTop: '0.5rem',
                      padding: '0.375rem 0.625rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      background: message.type === 'success' ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${message.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      color: message.type === 'success' ? '#86efac' : '#fca5a5',
                    }}>
                      {message.text}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#475569' }}>
              Unable to discover commands for this resource
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Dynamic parameter field renderer ───────────────────────────────────────

function DynamicParamField({
  field,
  value,
  onChange,
}: {
  field: CommandParamField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  switch (field.type) {
    case 'number':
      return (
        <div>
          <div style={fieldLabel}>
            {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
            {typeof value === 'number' && field.max && field.max > 20 && (
              <span style={{ float: 'right', color: '#64748b' }}>{value}</span>
            )}
          </div>
          {field.max && field.max > 20 ? (
            <input
              type="range"
              min={field.min ?? 0}
              max={field.max}
              step={field.step ?? 1}
              value={(value as number) ?? field.default ?? 0}
              onChange={(e) => onChange(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          ) : (
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={(value as number) ?? ''}
              onChange={(e) => onChange(Number(e.target.value))}
              style={inputStyle}
            />
          )}
          {field.description && <div style={descStyle}>{field.description}</div>}
        </div>
      );

    case 'string':
      return (
        <div>
          <div style={fieldLabel}>
            {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </div>
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.description}
            style={inputStyle}
          />
        </div>
      );

    case 'boolean':
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            style={{ accentColor: '#3b82f6' }}
          />
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{field.label}</span>
        </div>
      );

    case 'select':
      return (
        <div>
          <div style={fieldLabel}>{field.label}</div>
          <select
            value={(value as string) ?? field.default ?? ''}
            onChange={(e) => onChange(e.target.value)}
            style={selectStyle}
          >
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      );

    case 'location': {
      const loc = (value as { x: number; y: number }) ?? { x: 2.5, y: 2.5 };
      return (
        <div>
          <div style={fieldLabel}>
            {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </div>
          <div style={{ display: 'flex', gap: '0.375rem' }}>
            <div style={{ flex: 1 }}>
              <div style={miniLabel}>X</div>
              <input type="number" step={0.1} value={loc.x} onChange={(e) => onChange({ ...loc, x: Number(e.target.value) })} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={miniLabel}>Y</div>
              <input type="number" step={0.1} value={loc.y} onChange={(e) => onChange({ ...loc, y: Number(e.target.value) })} style={inputStyle} />
            </div>
          </div>
          {field.description && <div style={descStyle}>{field.description}</div>}
        </div>
      );
    }

    case 'waypoints': {
      const wps = (value as Waypoint[]) ?? [{ x: 0, y: 0 }];
      return (
        <div>
          <div style={fieldLabel}>
            {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </div>
          {wps.map((wp, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.25rem', marginBottom: '0.25rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.625rem', color: '#475569', width: '1rem' }}>{i + 1}.</span>
              <input type="number" step={0.1} value={wp.x} placeholder="X" style={{ ...inputStyle, flex: 1 }}
                onChange={(e) => {
                  const next = [...wps];
                  next[i] = { ...next[i], x: Number(e.target.value) };
                  onChange(next);
                }}
              />
              <input type="number" step={0.1} value={wp.y} placeholder="Y" style={{ ...inputStyle, flex: 1 }}
                onChange={(e) => {
                  const next = [...wps];
                  next[i] = { ...next[i], y: Number(e.target.value) };
                  onChange(next);
                }}
              />
              {wps.length > 2 && (
                <button onClick={() => onChange(wps.filter((_, j) => j !== i))} style={removeBtnStyle}>x</button>
              )}
            </div>
          ))}
          <button onClick={() => onChange([...wps, { x: 0, y: 0 }])} style={addBtnStyle}>+ Add</button>
        </div>
      );
    }

    case 'area': {
      const a = (value as { x_min: number; y_min: number; x_max: number; y_max: number }) ?? { x_min: 0, y_min: 0, x_max: 5, y_max: 5 };
      return (
        <div>
          <div style={fieldLabel}>
            {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.25rem' }}>
            <div><div style={miniLabel}>X Min</div><input type="number" step={0.1} value={a.x_min} onChange={(e) => onChange({ ...a, x_min: Number(e.target.value) })} style={inputStyle} /></div>
            <div><div style={miniLabel}>Y Min</div><input type="number" step={0.1} value={a.y_min} onChange={(e) => onChange({ ...a, y_min: Number(e.target.value) })} style={inputStyle} /></div>
            <div><div style={miniLabel}>X Max</div><input type="number" step={0.1} value={a.x_max} onChange={(e) => onChange({ ...a, x_max: Number(e.target.value) })} style={inputStyle} /></div>
            <div><div style={miniLabel}>Y Max</div><input type="number" step={0.1} value={a.y_max} onChange={(e) => onChange({ ...a, y_max: Number(e.target.value) })} style={inputStyle} /></div>
          </div>
          {field.description && <div style={descStyle}>{field.description}</div>}
        </div>
      );
    }

    case 'file':
      return (
        <div>
          <div style={fieldLabel}>
            {field.label}{field.required && <span style={{ color: '#ef4444' }}> *</span>}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                onChange(result.includes(',') ? result.split(',')[1] : result);
              };
              reader.readAsDataURL(file);
            }}
          />
          <button onClick={() => fileInputRef.current?.click()} style={addBtnStyle}>
            {value ? 'Change File' : 'Upload File'}
          </button>
          {value && (
            <div style={{ marginTop: '0.375rem', borderRadius: '0.25rem', overflow: 'hidden', border: '1px solid #334155' }}>
              <img src={`data:image/jpeg;base64,${value}`} alt="Preview" style={{ width: '100%', maxHeight: '80px', objectFit: 'cover', display: 'block' }} />
            </div>
          )}
          {field.description && <div style={descStyle}>{field.description}</div>}
        </div>
      );

    default:
      return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function groupCommands(commands: CommandDefinition[]): Record<string, CommandDefinition[]> {
  const groups: Record<string, CommandDefinition[]> = {};
  for (const cmd of commands) {
    (groups[cmd.group] ??= []).push(cmd);
  }
  // Sort: mission, swarm, bastion, lifecycle
  const order = ['mission', 'swarm', 'bastion', 'lifecycle'];
  const sorted: Record<string, CommandDefinition[]> = {};
  for (const g of order) {
    if (groups[g]) sorted[g] = groups[g];
  }
  // Any remaining groups
  for (const [g, cmds] of Object.entries(groups)) {
    if (!sorted[g]) sorted[g] = cmds;
  }
  return sorted;
}

function SummaryPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.25rem',
      padding: '0.125rem 0.5rem',
      borderRadius: '1rem',
      background: 'var(--surface-primary, #0f172a)',
      border: '1px solid var(--border-color, #334155)',
      fontSize: '0.6875rem',
    }}>
      <span style={{ color: '#475569' }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{count}</span>
    </div>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.375rem 0.5rem',
  background: 'var(--surface-primary, #0f172a)',
  border: '1px solid var(--border-color, #334155)',
  borderRadius: '0.25rem',
  color: '#e2e8f0',
  fontSize: '0.75rem',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
};

const filterSelect: React.CSSProperties = {
  padding: '0.25rem 0.375rem',
  background: 'var(--surface-primary, #0f172a)',
  border: '1px solid var(--border-color, #334155)',
  borderRadius: '0.25rem',
  color: '#e2e8f0',
  fontSize: '0.6875rem',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '0.5rem',
};

const fieldLabel: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: '#94a3b8',
  marginBottom: '0.25rem',
};

const miniLabel: React.CSSProperties = {
  fontSize: '0.5625rem',
  color: '#475569',
  marginBottom: '0.0625rem',
};

const descStyle: React.CSSProperties = {
  fontSize: '0.5625rem',
  color: '#475569',
  marginTop: '0.125rem',
};

const capBadge: React.CSSProperties = {
  fontSize: '0.5625rem',
  padding: '0.0625rem 0.25rem',
  borderRadius: '0.125rem',
  background: 'rgba(59,130,246,0.1)',
  color: '#93c5fd',
};

const autoBadge: React.CSSProperties = {
  fontSize: '0.5rem',
  padding: '0 0.1875rem',
  borderRadius: '0.125rem',
  background: 'rgba(139,92,246,0.15)',
  color: '#c4b5fd',
  border: '1px solid rgba(139,92,246,0.3)',
};

const spinner: React.CSSProperties = {
  display: 'inline-block',
  width: '12px',
  height: '12px',
  border: '2px solid rgba(255,255,255,0.3)',
  borderTopColor: 'white',
  borderRadius: '50%',
  animation: 'spin 0.6s linear infinite',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  fontSize: '0.6875rem',
  padding: '0.125rem',
};

const addBtnStyle: React.CSSProperties = {
  background: 'none',
  border: '1px dashed #334155',
  borderRadius: '0.25rem',
  color: '#64748b',
  cursor: 'pointer',
  fontSize: '0.6875rem',
  padding: '0.25rem 0.5rem',
  width: '100%',
};
