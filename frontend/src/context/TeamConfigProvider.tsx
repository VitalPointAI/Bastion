/**
 * TeamConfigProvider — Centralized team label context
 *
 * Phase 64 Plan 01: Replaces 5 hardcoded "CJTF WestPAC" / "PRC/TCC" locations
 * across OrderEditor.tsx (3 locations), IPBPanel.tsx, and ExerciseDashboard.tsx.
 *
 * All components that display team labels should consume useTeamConfig() rather
 * than hardcoding scenario-specific coalition names.
 *
 * Later phases will wire the config prop to read blueTeamLabel / redTeamLabel
 * from the active problem set metadata.
 *
 * Usage:
 *   // In layout wrapper:
 *   <TeamConfigProvider config={problemSet?.teamConfig}>
 *     <ExerciseContent />
 *   </TeamConfigProvider>
 *
 *   // In consuming component:
 *   const { blueTeamLabel, redTeamLabel } = useTeamConfig();
 */

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamConfig {
  blueTeamLabel: string;
  redTeamLabel: string;
  blueTeamShort: string;
  redTeamShort: string;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TEAM_CONFIG: TeamConfig = {
  blueTeamLabel: 'Blue Force',
  redTeamLabel: 'Red Force',
  blueTeamShort: 'Blue',
  redTeamShort: 'Red',
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const TeamConfigContext = createContext<TeamConfig>(DEFAULT_TEAM_CONFIG);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface TeamConfigProviderProps {
  children: ReactNode;
  /** Optional partial config — merged with defaults. Later phases will pass
   *  problem set metadata here. */
  config?: Partial<TeamConfig>;
}

export function TeamConfigProvider({ children, config }: TeamConfigProviderProps) {
  const value: TeamConfig = {
    ...DEFAULT_TEAM_CONFIG,
    ...config,
  };

  return (
    <TeamConfigContext.Provider value={value}>
      {children}
    </TeamConfigContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current team config from context.
 * If used outside a TeamConfigProvider, returns the default config (does not throw).
 */
export function useTeamConfig(): TeamConfig {
  return useContext(TeamConfigContext);
}
