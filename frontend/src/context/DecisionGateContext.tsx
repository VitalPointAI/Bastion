/**
 * DecisionGateContext
 *
 * Provides decision gate state to all child tabs.
 * Fetches gates ONCE per problem set load, groups by tab,
 * and distributes gate awareness via useDecisionGates hook.
 *
 * - Single fetch on mount via gateService.fetchGatesForProblemSet
 * - Pre-groups gates by tab for efficient per-tab lookups
 * - Action functions (submit, approve, reject, etc.) auto-refresh after mutation
 * - useDecisionGates hook filters gates by tab ID with role awareness
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  gateService,
  type DecisionGate,
  type GateProposalContext,
  type CreateGateParams,
  GateStatus,
} from '../lib/gate-service';
import { useProblemSet } from './ProblemSetContext';
import { useMode } from './ModeContext';

// ============================================================================
// Context Type
// ============================================================================

interface DecisionGateContextType {
  gates: DecisionGate[];
  gatesByTab: Record<string, DecisionGate[]>;
  pendingApprovals: DecisionGate[];
  loading: boolean;
  error: string | null;
  submitForApproval: (gateId: string, context: GateProposalContext) => Promise<void>;
  approveGate: (gateId: string) => Promise<void>;
  rejectGate: (gateId: string, reason: string) => Promise<void>;
  overrideGate: (gateId: string, justification: string) => Promise<void>;
  escalateGate: (gateId: string, reason: string) => Promise<void>;
  refreshGates: () => Promise<void>;
  createGate: (params: CreateGateParams) => Promise<void>;
}

// ============================================================================
// Default Context
// ============================================================================

const defaultContext: DecisionGateContextType = {
  gates: [],
  gatesByTab: {},
  pendingApprovals: [],
  loading: false,
  error: null,
  submitForApproval: async () => undefined,
  approveGate: async () => undefined,
  rejectGate: async () => undefined,
  overrideGate: async () => undefined,
  escalateGate: async () => undefined,
  refreshGates: async () => undefined,
  createGate: async () => undefined,
};

const DecisionGateContext = createContext<DecisionGateContextType>(defaultContext);

// ============================================================================
// Helper: Group gates by tab
// ============================================================================

function groupByTab(gates: DecisionGate[]): Record<string, DecisionGate[]> {
  const grouped: Record<string, DecisionGate[]> = {};
  for (const gate of gates) {
    if (!grouped[gate.tab]) {
      grouped[gate.tab] = [];
    }
    grouped[gate.tab].push(gate);
  }
  return grouped;
}

// ============================================================================
// Provider Component
// ============================================================================

interface DecisionGateProviderProps {
  children: ReactNode;
  problemSetId: string;
}

export function DecisionGateProvider({ children, problemSetId }: DecisionGateProviderProps) {
  const { userRoleInActive } = useProblemSet();
  const { mode } = useMode();

  const [gates, setGates] = useState<DecisionGate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Derive the user identifier for submitted_by / decided_by
  // Using userRoleInActive as the acting identity for gate operations
  const actingAs = userRoleInActive || 'unknown';

  // Fetch all gates for this problem set
  const refreshGates = useCallback(async () => {
    if (!problemSetId) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await gateService.fetchGatesForProblemSet(problemSetId);
      setGates(fetched);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch gates';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  // Fetch on mount and when problemSetId changes
  useEffect(() => {
    refreshGates();
  }, [refreshGates]);

  // Pre-group gates by tab
  const gatesByTab = useMemo(() => groupByTab(gates), [gates]);

  // Gates with status 'submitted' (pending approval)
  const pendingApprovals = useMemo(
    () => gates.filter((g) => g.status === GateStatus.submitted),
    [gates]
  );

  // Action functions — call gateService then refresh
  const submitForApproval = useCallback(
    async (gateId: string, context: GateProposalContext) => {
      await gateService.submitGateForApproval(gateId, actingAs, context);
      await refreshGates();
    },
    [actingAs, refreshGates]
  );

  const approveGateAction = useCallback(
    async (gateId: string) => {
      await gateService.approveGate(gateId, actingAs);
      await refreshGates();
    },
    [actingAs, refreshGates]
  );

  const rejectGateAction = useCallback(
    async (gateId: string, reason: string) => {
      await gateService.rejectGate(gateId, actingAs, reason);
      await refreshGates();
    },
    [actingAs, refreshGates]
  );

  const overrideGateAction = useCallback(
    async (gateId: string, justification: string) => {
      await gateService.overrideGate(gateId, actingAs, justification);
      await refreshGates();
    },
    [actingAs, refreshGates]
  );

  const escalateGateAction = useCallback(
    async (gateId: string, reason: string) => {
      await gateService.escalateGate(gateId, actingAs, reason);
      await refreshGates();
    },
    [actingAs, refreshGates]
  );

  const createGateAction = useCallback(
    async (params: CreateGateParams) => {
      // Tag with current mode if not explicitly set
      const gateParams: CreateGateParams = {
        ...params,
        mode: params.mode || mode,
      };
      await gateService.createGate(gateParams);
      await refreshGates();
    },
    [mode, refreshGates]
  );

  const value = useMemo<DecisionGateContextType>(
    () => ({
      gates,
      gatesByTab,
      pendingApprovals,
      loading,
      error,
      submitForApproval,
      approveGate: approveGateAction,
      rejectGate: rejectGateAction,
      overrideGate: overrideGateAction,
      escalateGate: escalateGateAction,
      refreshGates,
      createGate: createGateAction,
    }),
    [
      gates,
      gatesByTab,
      pendingApprovals,
      loading,
      error,
      submitForApproval,
      approveGateAction,
      rejectGateAction,
      overrideGateAction,
      escalateGateAction,
      refreshGates,
      createGateAction,
    ]
  );

  return (
    <DecisionGateContext.Provider value={value}>
      {children}
    </DecisionGateContext.Provider>
  );
}

// ============================================================================
// Hook: useDecisionGates
// ============================================================================

interface UseDecisionGatesResult {
  /** All gates (or tab-filtered if tabId provided) */
  gates: DecisionGate[];
  /** Count of 'submitted' gates for this tab/scope */
  pendingCount: number;
  /** Gates with status 'submitted' for this tab/scope */
  pendingApprovals: DecisionGate[];
  /** Whether the current user is commander or XO */
  isCommander: boolean;
  /** Loading state */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Submit a gate for approval */
  submitForApproval: (gateId: string, context: GateProposalContext) => Promise<void>;
  /** Approve a gate (commander/XO only) */
  approveGate: (gateId: string) => Promise<void>;
  /** Reject a gate with reason (commander/XO only) */
  rejectGate: (gateId: string, reason: string) => Promise<void>;
  /** Override a gate with justification (commander/XO only) */
  overrideGate: (gateId: string, justification: string) => Promise<void>;
  /** Escalate a gate with reason */
  escalateGate: (gateId: string, reason: string) => Promise<void>;
  /** Refresh gates from server */
  refreshGates: () => Promise<void>;
  /** Create a new gate */
  createGate: (params: CreateGateParams) => Promise<void>;
}

/**
 * Hook to consume decision gate context.
 * If tabId is provided, returns only gates for that tab.
 */
export function useDecisionGates(tabId?: string): UseDecisionGatesResult {
  const context = useContext(DecisionGateContext);
  const { userRoleInActive } = useProblemSet();

  // Derive commander status from role
  const isCommander = userRoleInActive === 'commander' || userRoleInActive === 'xo';

  // Filter gates by tab if tabId provided
  const gates = useMemo(() => {
    if (!tabId) return context.gates;
    return context.gatesByTab[tabId] || [];
  }, [tabId, context.gates, context.gatesByTab]);

  // Filter pending approvals by tab if tabId provided
  const pendingApprovals = useMemo(() => {
    if (!tabId) return context.pendingApprovals;
    return gates.filter((g) => g.status === GateStatus.submitted);
  }, [tabId, context.pendingApprovals, gates]);

  const pendingCount = pendingApprovals.length;

  return {
    gates,
    pendingCount,
    pendingApprovals,
    isCommander,
    loading: context.loading,
    error: context.error,
    submitForApproval: context.submitForApproval,
    approveGate: context.approveGate,
    rejectGate: context.rejectGate,
    overrideGate: context.overrideGate,
    escalateGate: context.escalateGate,
    refreshGates: context.refreshGates,
    createGate: context.createGate,
  };
}
