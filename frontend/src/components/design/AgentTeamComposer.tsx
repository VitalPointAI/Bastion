/**
 * AgentTeamComposer Component
 *
 * Allows users to augment the default agent assigned to each design section
 * by selecting additional agents from the registry. Shows the primary (default)
 * agent and a picker for adding supplementary agents to the analysis team.
 */

import { useState, useEffect, useCallback } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AgentSummary {
  agentId: string;
  name: string;
  description: string;
  active: boolean;
  capabilities: string[];
}

interface AgentTeamComposerProps {
  /** The design section (e.g. 'problem-framing') */
  section: string;
  /** Currently selected additional agent IDs */
  additionalAgents: string[];
  /** Callback when agents change */
  onAgentsChange: (agentIds: string[]) => void;
}

// ─── Section → Default Agent Mapping ─────────────────────────────────────────

const SECTION_DEFAULT_AGENTS: Record<string, { id: string; label: string }> = {
  'problem-framing': { id: 'problem_framing', label: 'Problem Framing Agent' },
  'cog-analysis': { id: 'cog_analysis', label: 'CoG Analysis Agent' },
  'lines-of-effort': { id: 'loe_gap_analysis', label: 'LOE Gap Analysis Agent' },
  'operational-approach': { id: 'narrative_synthesis', label: 'Narrative Synthesis Agent' },
};

const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── Component ───────────────────────────────────────────────────────────────

export function AgentTeamComposer({
  section,
  additionalAgents,
  onAgentsChange,
}: AgentTeamComposerProps) {
  const [expanded, setExpanded] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<AgentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const defaultAgent = SECTION_DEFAULT_AGENTS[section];

  // Fetch agents only when expanded for the first time
  const fetchAgents = useCallback(async () => {
    if (loaded) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/agents`);
      if (!res.ok) throw new Error('Failed to fetch agents');
      const json = await res.json();
      const agents: AgentSummary[] = (json.data || []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (a: any) => ({
          agentId: a.agentId,
          name: a.name,
          description: a.description,
          active: a.active,
          capabilities: a.capabilities || [],
        }),
      );
      setAvailableAgents(agents);
      setLoaded(true);
    } catch (err) {
      console.error('[AgentTeamComposer] Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, [loaded]);

  useEffect(() => {
    if (expanded && !loaded) {
      fetchAgents();
    }
  }, [expanded, loaded, fetchAgents]);

  const handleToggleAgent = (agentId: string) => {
    if (additionalAgents.includes(agentId)) {
      onAgentsChange(additionalAgents.filter((id) => id !== agentId));
    } else {
      onAgentsChange([...additionalAgents, agentId]);
    }
  };

  const handleRemoveAgent = (agentId: string) => {
    onAgentsChange(additionalAgents.filter((id) => id !== agentId));
  };

  // Filter out the default agent from the available list
  const selectableAgents = availableAgents.filter(
    (a) => a.agentId !== defaultAgent?.id,
  );

  return (
    <div className="border border-gray-700/50 rounded-lg bg-gray-800/40">
      {/* Header - always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-700/30 transition-colors rounded-lg"
      >
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Team:</span>
          <span className="text-gray-200 font-medium">
            {defaultAgent?.label || section}
          </span>
          {additionalAgents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-blue-600/30 text-blue-400 text-[10px] font-medium">
              +{additionalAgents.length}
            </span>
          )}
        </div>
        <span
          className={`text-gray-500 transition-transform text-[10px] ${
            expanded ? 'rotate-180' : ''
          }`}
        >
          &#9660;
        </span>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {/* Default agent badge */}
          <div className="flex items-center gap-2 py-1">
            <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-xs text-gray-300">{defaultAgent?.label}</span>
            <span className="text-[10px] text-gray-500 ml-auto">primary</span>
          </div>

          {/* Selected additional agents */}
          {additionalAgents.map((agentId) => {
            const agent = availableAgents.find((a) => a.agentId === agentId);
            return (
              <div
                key={agentId}
                className="flex items-center gap-2 py-1 group"
              >
                <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="text-xs text-gray-300 truncate">
                  {agent?.name || agentId}
                </span>
                <button
                  onClick={() => handleRemoveAgent(agentId)}
                  className="text-gray-600 hover:text-red-400 text-xs ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from team"
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Agent picker */}
          <div className="pt-1 border-t border-gray-700/50">
            <p className="text-[10px] text-gray-500 mb-1.5">
              Add agents to augment analysis:
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
              </div>
            ) : (
              <div className="max-h-[200px] overflow-y-auto space-y-0.5">
                {selectableAgents.map((agent) => {
                  const isSelected = additionalAgents.includes(agent.agentId);
                  return (
                    <button
                      key={agent.agentId}
                      onClick={() => handleToggleAgent(agent.agentId)}
                      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors ${
                        isSelected
                          ? 'bg-blue-600/20 text-blue-300'
                          : 'hover:bg-gray-700/50 text-gray-400'
                      }`}
                      title={agent.description}
                    >
                      <span
                        className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-500'
                            : 'border-gray-600'
                        }`}
                      >
                        {isSelected && (
                          <span className="text-white text-[8px]">&#10003;</span>
                        )}
                      </span>
                      <span className="truncate">{agent.name}</span>
                      {!agent.active && (
                        <span className="text-[9px] text-gray-600 ml-auto shrink-0">
                          inactive
                        </span>
                      )}
                    </button>
                  );
                })}
                {selectableAgents.length === 0 && !loading && (
                  <p className="text-[10px] text-gray-600 text-center py-2">
                    No additional agents available
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
