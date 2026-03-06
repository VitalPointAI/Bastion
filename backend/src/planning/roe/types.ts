
export interface TacticalAction {
  id: string;
  planId: string;
  missionId: string;
  actionType: 'engagement' | 'movement' | 'support' | 'reconnaissance' | 'strike';
  targetType: string;
  targetClassification?: 'civilian' | 'military' | 'dual_use' | 'unknown';
  weaponType?: string;
  weaponCategory?: 'lethal' | 'non_lethal' | 'kinetic' | 'non_kinetic';
  location: {
    lat: number;
    lng: number;
    isUrban?: boolean;
    isCulturalSite?: boolean;
    isProtected?: boolean;
  };
  collateralDamageEstimate?: number;
  timeOfDay?: 'day' | 'night';
  hostileAct?: boolean;
  hostileIntent?: boolean;
  selfDefense?: boolean;
  escalationLevel?: 1 | 2 | 3 | 4 | 5;
  metadata?: Record<string, unknown>;
}

export interface ROECheckResult {
  actionId: string;
  missionId: string;
  approved: boolean;
  violations: ROEViolation[];
  warnings: ROEWarning[];
  rulesChecked: number;
  checkedAt: Date;
  requiresOverride: boolean;
  overrideAuthority?: 'commander-only' | 'legal-officer' | 'battalion-commander';
}

export interface ROEViolation {
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'major' | 'minor';
  message: string;
  citation: string;
  overrideAuthority: string;
}

export interface ROEWarning {
  ruleId: string;
  ruleName: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
  recommendation?: string;
}

export interface ROEOverrideRequest {
  actionId: string;
  planId: string;
  violations: ROEViolation[];
  justification: string;
  commanderDID: string;
}
