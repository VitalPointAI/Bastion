export type JP50Step =
  | 'planning_initiation'
  | 'mission_analysis'
  | 'coa_development'
  | 'coa_analysis'
  | 'coa_comparison'
  | 'coa_approval'
  | 'plan_development'
  | 'plan_approval';

export type StepStatus = 'not_started' | 'in_progress' | 'ready' | 'approved' | 'rejected';

export const JP50_STEPS: Array<{ key: JP50Step; label: string; description: string }> = [
  { key: 'planning_initiation', label: '1. Planning Initiation', description: 'Receive mission, issue warning order' },
  { key: 'mission_analysis', label: '2. Mission Analysis', description: 'Analyze mission, develop timeline, identify tasks' },
  { key: 'coa_development', label: '3. COA Development', description: 'Develop minimum 3 courses of action' },
  { key: 'coa_analysis', label: '4. COA Analysis', description: 'Wargame and analyze each COA' },
  { key: 'coa_comparison', label: '5. COA Comparison', description: 'Compare COAs against criteria' },
  { key: 'coa_approval', label: '6. COA Approval', description: 'Commander selects and approves COA' },
  { key: 'plan_development', label: '7. Plan Development', description: 'Develop OPLAN/OPORD from approved COA' },
  { key: 'plan_approval', label: '8. Plan Approval', description: 'Commander approves final plan' },
];

export interface OperationalPlan {
  id: string;
  missionId: string;
  objectiveIds: string[];
  name: string;
  classification: string;
  planType: 'OPLAN' | 'OPORD' | 'CONPLAN' | 'FRAGORD';
  step: JP50Step;
  stepStatuses: Record<JP50Step, StepStatus>;
  commanderApproval: {
    coaApproved: boolean;
    planApproved: boolean;
    coaApprovedAt?: string;
    planApprovedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface COA {
  id: string;
  planId: string;
  number: number;
  name: string;
  description: string;
  scheme: string;
  selected: boolean;
  commandersIntent?: {
    purpose: string;
    keyTasks: string[];
    endState: string;
  };
  comparisonScore?: {
    overallScore: number;
    ranking: number;
  };
  redTeamResults?: {
    vulnerabilities: string[];
    confidenceScore: number;
  };
}

export interface WorkflowState {
  value: string;
  context: {
    planId: string;
    currentStep: JP50Step;
    steps: Record<JP50Step, StepStatus>;
    coaCount: number;
    selectedCoaId: string | null;
    commanderApproval: {
      coaApproved: boolean;
      planApproved: boolean;
    };
  };
  atCheckpoint: boolean;
  checkpoint?: string;
}
