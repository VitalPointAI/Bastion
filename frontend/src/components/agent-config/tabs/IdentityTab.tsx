/**
 * IdentityTab
 *
 * Phase 60 Plan 04: Military identity form fields for the Agent Config panel.
 *
 * Captures all identity fields from AgentConfig:
 * - Personal: displayName, rank
 * - Assignment: staffSection, position, unit, higherHQ
 * - Relationships: reportingToDid, areasOfResponsibility
 *
 * Each field change calls updateConfig() immediately — debounce is handled
 * by the useAgentConfig hook.
 */

import type { AgentConfig, StaffSection } from '../../../types/agent-config.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const STAFF_SECTIONS: { value: StaffSection; label: string }[] = [
  { value: 'Commander', label: 'Commander' },
  { value: 'XO', label: 'XO (Executive Officer)' },
  { value: 'CSM', label: 'CSM (Command Sergeant Major)' },
  { value: 'S1', label: 'S1 / J1 (Personnel)' },
  { value: 'S2', label: 'S2 / J2 (Intelligence)' },
  { value: 'S3', label: 'S3 / J3 (Operations)' },
  { value: 'S4', label: 'S4 / J4 (Logistics)' },
  { value: 'S6', label: 'S6 / J6 (Communications)' },
  { value: 'S9', label: 'S9 / J9 (Civil Affairs)' },
  { value: 'Other', label: 'Other' },
];

const COMMON_RANKS = [
  // Enlisted
  'PVT', 'PV2', 'PFC', 'SPC', 'CPL',
  'SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM', 'SMA',
  // Warrant Officers
  'WO1', 'CW2', 'CW3', 'CW4', 'CW5',
  // Officers
  '2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL',
  'BG', 'MG', 'LTG', 'GEN', 'GA',
  // Other/Civilian
  'CIV', 'SES', 'GS',
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface IdentityTabProps {
  config: AgentConfig;
  updateConfig: (partial: Partial<AgentConfig>) => void;
}

// ─── Helper sub-components ───────────────────────────────────────────────────

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

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  hint?: string;
}

function FormField({ label, children, hint }: FormFieldProps) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-300 mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
    </div>
  );
}

const inputClass = [
  'w-full px-2.5 py-1.5 text-sm bg-slate-800/80 border border-slate-700/60 rounded',
  'text-slate-200 placeholder-slate-600',
  'focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30',
  'transition-colors',
].join(' ');

const selectClass = [
  'w-full px-2.5 py-1.5 text-sm bg-slate-800/80 border border-slate-700/60 rounded',
  'text-slate-200',
  'focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30',
  'transition-colors',
].join(' ');

// ─── Component ────────────────────────────────────────────────────────────────

export function IdentityTab({ config, updateConfig }: IdentityTabProps) {
  // Handle AOR as comma-separated text field
  const aorText = config.areasOfResponsibility.join(', ');

  function handleAorChange(value: string) {
    const areas = value
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    updateConfig({ areasOfResponsibility: areas });
  }

  return (
    <div className="px-4 py-4">
      {/* Personal */}
      <FieldGroup label="Personal">
        <FormField label="Display Name" hint="Your name as it will appear in communications">
          <input
            type="text"
            className={inputClass}
            value={config.displayName}
            onChange={(e) => updateConfig({ displayName: e.target.value })}
            placeholder="e.g. John Smith"
          />
        </FormField>

        <FormField label="Rank">
          <div className="flex gap-2">
            <input
              type="text"
              className={`${inputClass} flex-1`}
              value={config.rank}
              onChange={(e) => updateConfig({ rank: e.target.value })}
              placeholder="e.g. LTC"
              list="rank-suggestions"
            />
            <datalist id="rank-suggestions">
              {COMMON_RANKS.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </div>
        </FormField>
      </FieldGroup>

      {/* Assignment */}
      <FieldGroup label="Assignment">
        <FormField label="Staff Section" hint="Drives Ironclaw's default personality and communication style">
          <select
            className={selectClass}
            value={config.staffSection}
            onChange={(e) => updateConfig({ staffSection: e.target.value as StaffSection })}
          >
            {STAFF_SECTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Position / Billet">
          <input
            type="text"
            className={inputClass}
            value={config.position}
            onChange={(e) => updateConfig({ position: e.target.value })}
            placeholder="e.g. S3 Operations Officer"
          />
        </FormField>

        <FormField label="Unit">
          <input
            type="text"
            className={inputClass}
            value={config.unit}
            onChange={(e) => updateConfig({ unit: e.target.value })}
            placeholder="e.g. 1st Battalion, 5th Marines"
          />
        </FormField>

        <FormField label="Higher HQ" hint="Parent command or headquarters">
          <input
            type="text"
            className={inputClass}
            value={config.higherHQ}
            onChange={(e) => updateConfig({ higherHQ: e.target.value })}
            placeholder="e.g. 1st Marine Division"
          />
        </FormField>
      </FieldGroup>

      {/* Relationships */}
      <FieldGroup label="Relationships & Responsibilities">
        <FormField
          label="Reports To (DID)"
          hint="DID of the officer you report to — leave blank if top-level"
        >
          <input
            type="text"
            className={inputClass}
            value={config.reportingToDid ?? ''}
            onChange={(e) => updateConfig({ reportingToDid: e.target.value || null })}
            placeholder="did:near:account.near (optional)"
          />
        </FormField>

        <FormField
          label="Areas of Responsibility"
          hint="Comma-separated list of geographic or functional AORs"
        >
          <textarea
            className={`${inputClass} resize-none`}
            rows={2}
            value={aorText}
            onChange={(e) => handleAorChange(e.target.value)}
            placeholder="e.g. Northern Theater, Maritime Approaches, Logistics Node Alpha"
          />
        </FormField>
      </FieldGroup>

      {/* DID / NEAR info (read-only) */}
      <FieldGroup label="Identity (Read-only)">
        <FormField label="DID" hint="Your decentralized identifier — cannot be changed">
          <div className="px-2.5 py-1.5 text-xs bg-slate-800/40 border border-slate-700/40 rounded text-slate-500 font-mono truncate">
            {config.did || 'Not set'}
          </div>
        </FormField>
        <FormField label="NEAR Account">
          <div className="px-2.5 py-1.5 text-xs bg-slate-800/40 border border-slate-700/40 rounded text-slate-500 font-mono truncate">
            {config.nearAccount || 'Not set'}
          </div>
        </FormField>
      </FieldGroup>
    </div>
  );
}
