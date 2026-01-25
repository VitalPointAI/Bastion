import { roeStore } from '../stores/roe-store.js';
import { ROEOverrideRequest } from './types.js';
import { ROEOverride } from '../types.js';
import { roeAuditLog } from './audit.js';

class ROEOverrideWorkflow {
  /**
   * Request an override for ROE violations
   * Only commander can approve
   */
  async requestOverride(request: ROEOverrideRequest): Promise<ROEOverride> {
    // Validate justification is not empty
    if (!request.justification || request.justification.trim().length < 10) {
      throw new Error('Override justification must be at least 10 characters explaining the decision');
    }

    // Validate commander role (this would check against DAO membership in production)
    // For now, we accept the DID and log it
    if (!request.commanderDID || !request.commanderDID.startsWith('did:')) {
      throw new Error('Valid commander DID required for override');
    }

    // Check that violations exist
    if (!request.violations || request.violations.length === 0) {
      throw new Error('No violations to override');
    }

    // Create override records for each violation
    const overrides: ROEOverride[] = [];

    for (const violation of request.violations) {
      const override = await roeStore.createOverride({
        planId: request.planId,
        ruleId: violation.ruleId,
        actionContext: {
          actionId: request.actionId,
          violationMessage: violation.message,
          violationSeverity: violation.severity,
          citation: violation.citation,
        },
        violations: [violation.message],
        justification: request.justification,
        commanderDID: request.commanderDID,
        blockchainTxHash: '', // Will be set by audit
      });

      overrides.push(override);
    }

    // Record on blockchain for immutability
    const txHash = await roeAuditLog.recordOverride({
      overrides,
      request,
      timestamp: new Date(),
    });

    // Update overrides with transaction hash
    for (const override of overrides) {
      override.blockchainTxHash = txHash;
    }

    return overrides[0]; // Return first for API response
  }

  /**
   * Get all overrides for a plan
   */
  async getOverridesForPlan(planId: string): Promise<ROEOverride[]> {
    return roeStore.findOverridesByPlan(planId);
  }

  /**
   * Validate that action has been properly overridden
   */
  async isActionOverridden(actionId: string, planId: string): Promise<boolean> {
    const overrides = await roeStore.findOverridesByPlan(planId);
    return overrides.some(o => {
      const context = o.actionContext as { actionId?: string };
      return context.actionId === actionId;
    });
  }
}

export const roeOverrideWorkflow = new ROEOverrideWorkflow();
