/**
 * EchelonBadge
 *
 * Displays a compact badge showing the echelon level (TACTICAL, OPERATIONAL, STRATEGIC)
 * and the associated planning workflow (MDMP, JPP, Strategic Guidance).
 * Rendered in the TabLayout header slot above sidebar nav items.
 */

export const ECHELON_CONFIG = {
  tactical: {
    label: 'TACTICAL',
    workflow: 'MDMP',
    color: 'bg-amber-600',
  },
  operational: {
    label: 'OPERATIONAL',
    workflow: 'JPP',
    color: 'bg-blue-600',
  },
  strategic: {
    label: 'STRATEGIC',
    workflow: 'Strategic Guidance',
    color: 'bg-purple-600',
  },
} as const;

interface EchelonBadgeProps {
  echelon: 'strategic' | 'operational' | 'tactical';
}

export function EchelonBadge({ echelon }: EchelonBadgeProps) {
  const config = ECHELON_CONFIG[echelon];

  return (
    <div className={`${config.color} px-3 py-1.5 rounded-md`}>
      <span className="text-xs font-bold tracking-wider text-white">
        {config.label}
      </span>
      <span className="text-xs text-white/70">
        {' '}- {config.workflow}
      </span>
    </div>
  );
}
