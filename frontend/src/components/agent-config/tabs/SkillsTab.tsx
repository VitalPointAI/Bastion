/**
 * SkillsTab
 *
 * Phase 60 Plan 05: Role-specific skill pack management and custom skills editor
 * for the Agent Config panel.
 *
 * Blueprint Phase 4 — Skill packs give Ironclaw domain expertise for each staff
 * role. S2 gets intelligence analysis skills, S3 gets operations planning skills,
 * etc. The catalog is fetched dynamically from GET /api/skill-packs.
 *
 * Features:
 * - Toggleable skill pack cards loaded from the backend catalog
 * - Cards relevant to the user's staffSection are highlighted/recommended
 * - Custom skills section: add/edit/remove user-defined skills with triggers
 */

import { useState, useEffect, useCallback } from 'react';
import type { AgentConfig, CustomSkill } from '../../../types/agent-config.ts';

// ---------------------------------------------------------------------------
// Types (mirrors backend SkillPack interface)
// ---------------------------------------------------------------------------

interface SkillPack {
  id: string;
  name: string;
  description: string;
  staffSections: string[];
  triggers: string[];
  requiredTools: string[];
  trustLevel: 'high' | 'medium' | 'low';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRUST_COLORS: Record<string, string> = {
  high: 'text-amber-400 bg-amber-900/20 border-amber-700/40',
  medium: 'text-blue-400 bg-blue-900/20 border-blue-700/40',
  low: 'text-slate-400 bg-slate-800/40 border-slate-700/40',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SkillsTabProps {
  config: AgentConfig;
  updateConfig: (partial: Partial<AgentConfig>) => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface FieldGroupProps {
  label: string;
  children: React.ReactNode;
}

function FieldGroup({ label, children }: FieldGroupProps) {
  return (
    <div className="mb-5">
      <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-2.5">
        {label}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  );
}

interface CustomSkillEditorProps {
  skill: CustomSkill;
  index: number;
  onUpdate: (index: number, updated: CustomSkill) => void;
  onRemove: (index: number) => void;
}

function CustomSkillEditor({ skill, index, onUpdate, onRemove }: CustomSkillEditorProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-slate-700/60 bg-slate-800/40 overflow-hidden">
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-slate-800/60"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className={`w-3 h-3 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-xs text-slate-200 font-medium truncate">
            {skill.name || <span className="text-slate-500 italic">Unnamed skill</span>}
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(index);
          }}
          className="text-slate-600 hover:text-red-400 transition-colors ml-2 flex-shrink-0"
          title="Remove skill"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 pt-1 flex flex-col gap-2 border-t border-slate-700/40">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Name</label>
            <input
              type="text"
              value={skill.name}
              onChange={(e) => onUpdate(index, { ...skill, name: e.target.value })}
              placeholder="e.g., Targeting Cycle"
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">Description</label>
            <textarea
              value={skill.description}
              onChange={(e) => onUpdate(index, { ...skill, description: e.target.value })}
              placeholder="What this skill enables Ironclaw to do..."
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600 resize-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">
              Triggers
              <span className="text-slate-600 ml-1">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={skill.triggers.join(', ')}
              onChange={(e) =>
                onUpdate(index, {
                  ...skill,
                  triggers: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              placeholder='e.g., "targeting cycle", "fire support", "HPT"'
              className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function SkillsTab({ config, updateConfig }: SkillsTabProps) {
  const [catalog, setCatalog] = useState<SkillPack[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // Fetch skill catalog from backend on mount
  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);

    fetch('/api/skill-packs')
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load skill catalog: ${res.status}`);
        return res.json() as Promise<SkillPack[]>;
      })
      .then((packs) => {
        if (!cancelled) {
          setCatalog(packs);
          setCatalogLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : 'Unknown error');
          setCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Toggle a skill pack on/off
  const togglePack = useCallback(
    (packId: string) => {
      const current = config.enabledSkillPacks ?? [];
      const updated = current.includes(packId)
        ? current.filter((id) => id !== packId)
        : [...current, packId];
      updateConfig({ enabledSkillPacks: updated });
    },
    [config.enabledSkillPacks, updateConfig],
  );

  // Custom skills handlers
  const addCustomSkill = useCallback(() => {
    const current = config.customSkills ?? [];
    updateConfig({
      customSkills: [...current, { name: '', description: '', triggers: [] }],
    });
  }, [config.customSkills, updateConfig]);

  const updateCustomSkill = useCallback(
    (index: number, updated: CustomSkill) => {
      const current = [...(config.customSkills ?? [])];
      current[index] = updated;
      updateConfig({ customSkills: current });
    },
    [config.customSkills, updateConfig],
  );

  const removeCustomSkill = useCallback(
    (index: number) => {
      const current = [...(config.customSkills ?? [])];
      current.splice(index, 1);
      updateConfig({ customSkills: current });
    },
    [config.customSkills, updateConfig],
  );

  const enabledPacks = config.enabledSkillPacks ?? [];
  const customSkills = config.customSkills ?? [];

  // Classify packs: recommended (matches user's staff section) vs others
  const recommended = catalog.filter((p) => p.staffSections.includes(config.staffSection));
  const others = catalog.filter((p) => !p.staffSections.includes(config.staffSection));

  return (
    <div className="p-4">
      {/* Skill Pack Catalog */}
      <FieldGroup label="Skill Packs">
        <p className="text-[11px] text-slate-400 -mt-1 mb-1">
          Enable packs to give Ironclaw domain expertise for specific staff roles.
          Packs recommended for your staff section are highlighted.
        </p>

        {catalogLoading && (
          <div className="flex items-center gap-2 py-4 text-slate-500">
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span className="text-xs">Loading skill catalog...</span>
          </div>
        )}

        {catalogError && (
          <div className="text-xs text-red-400 py-2">{catalogError}</div>
        )}

        {!catalogLoading && !catalogError && (
          <>
            {/* Recommended packs */}
            {recommended.length > 0 && (
              <div className="mb-3">
                <div className="text-[10px] text-emerald-600 uppercase tracking-wider font-semibold mb-2">
                  Recommended for {config.staffSection}
                </div>
                <div className="flex flex-col gap-2">
                  {recommended.map((pack) => (
                    <SkillPackCard
                      key={pack.id}
                      pack={pack}
                      enabled={enabledPacks.includes(pack.id)}
                      recommended
                      onToggle={togglePack}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Other packs */}
            {others.length > 0 && (
              <div>
                {recommended.length > 0 && (
                  <div className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold mb-2">
                    Other Packs
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  {others.map((pack) => (
                    <SkillPackCard
                      key={pack.id}
                      pack={pack}
                      enabled={enabledPacks.includes(pack.id)}
                      recommended={false}
                      onToggle={togglePack}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </FieldGroup>

      {/* Custom Skills */}
      <FieldGroup label="Custom Skills">
        <p className="text-[11px] text-slate-400 -mt-1 mb-1">
          Define additional skills for Ironclaw specific to your unit's SOPs,
          TTPs, or mission requirements.
        </p>

        {customSkills.length === 0 && (
          <p className="text-xs text-slate-600 italic">No custom skills defined.</p>
        )}

        {customSkills.map((skill, index) => (
          <CustomSkillEditor
            key={index}
            skill={skill}
            index={index}
            onUpdate={updateCustomSkill}
            onRemove={removeCustomSkill}
          />
        ))}

        <button
          onClick={addCustomSkill}
          className="mt-1 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add custom skill
        </button>
      </FieldGroup>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SkillPackCard
// ---------------------------------------------------------------------------

interface SkillPackCardProps {
  pack: SkillPack;
  enabled: boolean;
  recommended: boolean;
  onToggle: (packId: string) => void;
}

function SkillPackCard({ pack, enabled, recommended, onToggle }: SkillPackCardProps) {
  const [expanded, setExpanded] = useState(false);
  const trustStyle = TRUST_COLORS[pack.trustLevel] ?? TRUST_COLORS.low;

  return (
    <div
      className={`rounded-md border transition-colors ${
        enabled
          ? 'border-blue-600/60 bg-blue-900/10'
          : recommended
            ? 'border-emerald-700/40 bg-slate-800/30'
            : 'border-slate-700/60 bg-slate-800/20'
      }`}
    >
      {/* Card header */}
      <div className="flex items-start gap-3 px-3 py-2.5">
        {/* Toggle */}
        <button
          onClick={() => onToggle(pack.id)}
          className={`flex-shrink-0 mt-0.5 w-8 h-4.5 rounded-full transition-colors relative ${
            enabled ? 'bg-blue-600' : 'bg-slate-700'
          }`}
          role="switch"
          aria-checked={enabled}
          title={enabled ? 'Disable skill pack' : 'Enable skill pack'}
        >
          <span
            className={`block w-3 h-3 rounded-full bg-white shadow transition-transform absolute top-[3px] ${
              enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
            }`}
          />
        </button>

        {/* Name & description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-200">{pack.name}</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide ${trustStyle}`}
            >
              {pack.trustLevel} trust
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{pack.description}</p>
        </div>

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex-shrink-0 text-slate-600 hover:text-slate-400 transition-colors mt-1"
          title="Show trigger phrases"
        >
          <svg
            className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-700/40 pt-2">
          <div className="mb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Trigger phrases</p>
            <div className="flex flex-wrap gap-1">
              {pack.triggers.map((t) => (
                <span
                  key={t}
                  className="text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Required tools</p>
            <div className="flex flex-wrap gap-1">
              {pack.requiredTools.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-mono bg-slate-900 border border-slate-700/60 rounded px-1.5 py-0.5 text-slate-400"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
