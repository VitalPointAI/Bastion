/**
 * PersonalityTab
 *
 * Phase 60 Plan 04: Communication style and output preference controls
 * for the Agent Config panel.
 *
 * Controls:
 * - Communication Style: tone, verbosity (1-5 slider), BLUF toggle
 * - Output Preferences: format, expand acronyms, classification markings
 * - Custom Instructions: free-text persona instructions
 */

import type { AgentConfig, OutputFormat, TonePreference } from '../../../types/agent-config.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_OPTIONS: { value: TonePreference; label: string; description: string }[] = [
  { value: 'FormalMilitary', label: 'Formal Military', description: 'Strict doctrinal language, rank-aware, OPORD style' },
  { value: 'Professional', label: 'Professional', description: 'Clear and concise, business-like, no slang' },
  { value: 'Direct', label: 'Direct', description: 'Blunt, action-oriented, minimal elaboration' },
  { value: 'Collaborative', label: 'Collaborative', description: 'Inclusive, discussion-oriented, surfaces options' },
];

const OUTPUT_FORMAT_OPTIONS: { value: OutputFormat; label: string; description: string }[] = [
  { value: 'Auto', label: 'Auto', description: 'Ironclaw selects best format for each query' },
  { value: 'MDMP', label: 'MDMP', description: 'Military Decision Making Process structure' },
  { value: 'StaffSummary', label: 'Staff Summary', description: 'Concise staff estimate format' },
  { value: 'FreeForm', label: 'Free Form', description: 'Natural prose without structure constraints' },
];

const VERBOSITY_LABELS: Record<number, string> = {
  1: 'Terse',
  2: 'Concise',
  3: 'Balanced',
  4: 'Detailed',
  5: 'Comprehensive',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface PersonalityTabProps {
  config: AgentConfig;
  updateConfig: (partial: Partial<AgentConfig>) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      <div className="flex flex-col gap-3">
        {children}
      </div>
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleField({ label, description, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium text-slate-300">{label}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors ${
          checked ? 'bg-blue-600' : 'bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

const selectClass = [
  'w-full px-2.5 py-1.5 text-sm bg-slate-800/80 border border-slate-700/60 rounded',
  'text-slate-200',
  'focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30',
  'transition-colors',
].join(' ');

const textareaClass = [
  'w-full px-2.5 py-1.5 text-sm bg-slate-800/80 border border-slate-700/60 rounded',
  'text-slate-200 placeholder-slate-600 resize-none',
  'focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30',
  'transition-colors',
].join(' ');

// ─── Component ────────────────────────────────────────────────────────────────

export function PersonalityTab({ config, updateConfig }: PersonalityTabProps) {
  return (
    <div className="px-4 py-4">
      {/* Communication Style */}
      <FieldGroup label="Communication Style">
        {/* Tone */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Tone</label>
          <div className="flex flex-col gap-1.5">
            {TONE_OPTIONS.map(({ value, label, description }) => (
              <button
                key={value}
                onClick={() => updateConfig({ tone: value })}
                className={`flex items-start gap-2.5 px-3 py-2 rounded border text-left transition-colors ${
                  config.tone === value
                    ? 'bg-blue-900/30 border-blue-700/60 text-blue-200'
                    : 'bg-slate-800/40 border-slate-700/40 text-slate-300 hover:bg-slate-800/70 hover:border-slate-600/60'
                }`}
              >
                <div
                  className={`w-3 h-3 mt-0.5 rounded-full border-2 shrink-0 ${
                    config.tone === value ? 'border-blue-400 bg-blue-400' : 'border-slate-600 bg-transparent'
                  }`}
                />
                <div>
                  <p className="text-xs font-medium">{label}</p>
                  <p className="text-[10px] text-slate-500">{description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Verbosity Slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300">Verbosity</label>
            <span className="text-[10px] text-blue-300 font-medium">
              {VERBOSITY_LABELS[config.verbosityLevel] ?? 'Balanced'}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={5}
            step={1}
            value={config.verbosityLevel}
            onChange={(e) => updateConfig({ verbosityLevel: Number(e.target.value) })}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex justify-between mt-0.5">
            <span className="text-[9px] text-slate-600">Terse</span>
            <span className="text-[9px] text-slate-600">Comprehensive</span>
          </div>
        </div>

        {/* BLUF Toggle */}
        <ToggleField
          label="Enforce BLUF"
          description="Bottom Line Up Front — Ironclaw leads every response with a single-sentence conclusion"
          checked={config.blufEnforced}
          onChange={(checked) => updateConfig({ blufEnforced: checked })}
        />
      </FieldGroup>

      {/* Output Preferences */}
      <FieldGroup label="Output Preferences">
        {/* Output Format */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">Default Output Format</label>
          <select
            className={selectClass}
            value={config.outputFormat}
            onChange={(e) => updateConfig({ outputFormat: e.target.value as OutputFormat })}
          >
            {OUTPUT_FORMAT_OPTIONS.map(({ value, label, description }) => (
              <option key={value} value={value}>{label} — {description}</option>
            ))}
          </select>
        </div>

        {/* Expand Acronyms */}
        <ToggleField
          label="Expand Acronyms"
          description="Spell out military acronyms on first use (e.g. MDMP = Military Decision Making Process)"
          checked={config.expandAcronyms}
          onChange={(checked) => updateConfig({ expandAcronyms: checked })}
        />

        {/* Classification Markings */}
        <ToggleField
          label="Classification Markings"
          description="Include classification portion markings in structured outputs (e.g. (U), (S), (TS))"
          checked={config.classificationMarkings}
          onChange={(checked) => updateConfig({ classificationMarkings: checked })}
        />
      </FieldGroup>

      {/* Custom Instructions */}
      <FieldGroup label="Custom Instructions">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1">
            Persona Instructions
          </label>
          <textarea
            className={textareaClass}
            rows={4}
            value={config.customPersonaInstructions}
            onChange={(e) => updateConfig({ customPersonaInstructions: e.target.value })}
            placeholder="Additional instructions for how your Chief of Staff should communicate. E.g. 'Always include risk to mission and risk to force when assessing COAs. Prioritize speed over thoroughness when I mark a request FLASH.'"
          />
          <p className="text-[10px] text-slate-500 mt-0.5">
            These instructions are appended to your Chief of Staff's SOUL.md and applied to every interaction.
          </p>
        </div>
      </FieldGroup>
    </div>
  );
}
