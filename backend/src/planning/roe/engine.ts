import { Engine, RuleProperties } from 'json-rules-engine';
import { roeStore } from '../stores/roe-store.js';
import { TacticalAction, ROECheckResult, ROEViolation, ROEWarning } from './types.js';
import { ROERule, CreateROERuleInput } from '../types.js';

class ROEEngine {
  private engines: Map<string, Engine> = new Map();

  /**
   * Get or create rules engine for a mission
   */
  private async getEngine(missionId: string): Promise<Engine> {
    // Check cache (invalidated on rule changes)
    if (this.engines.has(missionId)) {
      return this.engines.get(missionId)!;
    }

    // Load active rules from database
    const rules = await roeStore.findActiveRulesByMission(missionId);

    // Create new engine
    const engine = new Engine();

    // Add each rule
    for (const rule of rules) {
      const ruleProperties: RuleProperties = {
        name: rule.name,
        conditions: rule.conditions as unknown as RuleProperties['conditions'],
        event: {
          ...rule.event,
          params: {
            ...rule.event.params,
            ruleId: rule.id,
            ruleName: rule.name,
          },
        },
      };
      engine.addRule(ruleProperties);
    }

    this.engines.set(missionId, engine);
    return engine;
  }

  /**
   * Invalidate cached engine when rules change
   */
  invalidateCache(missionId: string): void {
    this.engines.delete(missionId);
  }

  /**
   * Check action against ROE rules
   */
  async checkAction(action: TacticalAction): Promise<ROECheckResult> {
    const engine = await this.getEngine(action.missionId);

    // Build facts from action
    const facts = {
      actionType: action.actionType,
      targetType: action.targetType,
      targetClassification: action.targetClassification,
      weaponType: action.weaponType,
      weaponCategory: action.weaponCategory,
      urbanArea: action.location.isUrban || false,
      culturalSite: action.location.isCulturalSite || false,
      protectedArea: action.location.isProtected || false,
      collateralDamageEstimate: action.collateralDamageEstimate || 0,
      timeOfDay: action.timeOfDay,
      hostileAct: action.hostileAct || false,
      hostileIntent: action.hostileIntent || false,
      selfDefense: action.selfDefense || false,
      escalationLevel: action.escalationLevel || 1,
      ...action.metadata,
    };

    // Run rules
    const { events } = await engine.run(facts);

    // Categorize results
    const violations: ROEViolation[] = [];
    const warnings: ROEWarning[] = [];

    for (const event of events) {
      if (event.type === 'roe-violation') {
        violations.push({
          ruleId: event.params?.ruleId,
          ruleName: event.params?.ruleName,
          severity: event.params?.severity || 'major',
          message: event.params?.message || 'ROE violation detected',
          citation: event.params?.citation || 'See ROE card',
          overrideAuthority: event.params?.overrideAuthority || 'commander-only',
        });
      } else if (event.type === 'roe-warning') {
        warnings.push({
          ruleId: event.params?.ruleId,
          ruleName: event.params?.ruleName,
          severity: event.params?.severity || 'medium',
          message: event.params?.message || 'ROE warning',
          recommendation: event.params?.recommendation,
        });
      }
    }

    // Determine if override is required
    const requiresOverride = violations.length > 0;
    const overrideAuthority = violations.reduce((highest, v) => {
      // commander-only is highest authority required
      if (v.overrideAuthority === 'commander-only') return 'commander-only';
      if (highest === 'commander-only') return highest;
      if (v.overrideAuthority === 'battalion-commander') return 'battalion-commander';
      if (highest === 'battalion-commander') return highest;
      return v.overrideAuthority;
    }, violations[0]?.overrideAuthority);

    const rules = await roeStore.findActiveRulesByMission(action.missionId);

    return {
      actionId: action.id,
      missionId: action.missionId,
      approved: violations.length === 0,
      violations,
      warnings,
      rulesChecked: rules.length,
      checkedAt: new Date(),
      requiresOverride,
      overrideAuthority: requiresOverride ? overrideAuthority as ROECheckResult['overrideAuthority'] : undefined,
    };
  }

  /**
   * Create default ROE rules for a mission
   */
  async createDefaultRules(missionId: string, createdBy: string): Promise<ROERule[]> {
    const defaultRules: Omit<ROERule, 'id' | 'createdAt' | 'updatedAt'>[] = [
      {
        missionId,
        name: 'Civilian Target Prohibition',
        description: 'Prohibition on engaging civilian targets with lethal weapons',
        category: 'targets',
        conditions: {
          all: [
            { fact: 'targetClassification', operator: 'equal', value: 'civilian' },
            { fact: 'weaponCategory', operator: 'equal', value: 'lethal' },
          ],
        },
        event: {
          type: 'roe-violation',
          params: {
            severity: 'critical',
            message: 'Engagement of civilian targets with lethal weapons prohibited',
            citation: 'ROE Card Section 3.1',
            overrideAuthority: 'commander-only',
          },
        },
        active: true,
        createdBy,
      },
      {
        missionId,
        name: 'Urban Area High CDE Warning',
        description: 'Warning for high collateral damage estimate in urban areas',
        category: 'targets',
        conditions: {
          all: [
            { fact: 'urbanArea', operator: 'equal', value: true },
            { fact: 'collateralDamageEstimate', operator: 'greaterThan', value: 10 },
          ],
        },
        event: {
          type: 'roe-warning',
          params: {
            severity: 'high',
            message: 'High CDE in urban area requires legal review - Consult JAG before proceeding',
            overrideAuthority: 'legal-officer',
            citation: 'CDE assessment guidelines',
          },
        },
        active: true,
        createdBy,
      },
      {
        missionId,
        name: 'Cultural Site Protection',
        description: 'Protection of cultural sites per Hague Convention',
        category: 'targets',
        conditions: {
          all: [
            { fact: 'culturalSite', operator: 'equal', value: true },
            { fact: 'actionType', operator: 'in', value: ['strike', 'engagement'] },
          ],
        },
        event: {
          type: 'roe-violation',
          params: {
            severity: 'critical',
            message: 'Actions against cultural sites prohibited',
            citation: '1954 Hague Convention',
            overrideAuthority: 'commander-only',
          },
        },
        active: true,
        createdBy,
      },
    ];

    const created: ROERule[] = [];
    for (const rule of defaultRules) {
      const r = await roeStore.createRule(rule as CreateROERuleInput, createdBy);
      created.push(r);
    }

    // Invalidate cache
    this.invalidateCache(missionId);

    return created;
  }
}

export const roeEngine = new ROEEngine();
