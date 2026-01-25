import { setup, assign } from 'xstate';
import { JP50Context, JP50Event } from './types';
import { JP50Step } from '../types';

export const jp50Machine = setup({
  types: {
    context: {} as JP50Context,
    events: {} as JP50Event,
  },
  guards: {
    // Can mark step ready only if it has work done
    canMarkReady: ({ context, event }) => {
      if (event.type !== 'MARK_STEP_READY') return false;
      return context.steps[event.step] === 'in_progress';
    },

    // COA development requires minimum 3 COAs
    hasSufficientCOAs: ({ context }) => {
      return context.coaCount >= 3;
    },

    // Can request COA approval only if coa_development, coa_analysis, coa_comparison all ready
    canRequestCOAApproval: ({ context }) => {
      return (
        context.steps.coa_development === 'ready' &&
        context.steps.coa_analysis === 'ready' &&
        context.steps.coa_comparison === 'ready' &&
        context.selectedCoaId !== null
      );
    },

    // Can request plan approval only if COA approved and plan_development ready
    canRequestPlanApproval: ({ context }) => {
      return (
        context.commanderApproval.coaApproved &&
        context.steps.plan_development === 'ready'
      );
    },

    // COA already approved
    isCOAApproved: ({ context }) => context.commanderApproval.coaApproved,

    // Plan already approved
    isPlanApproved: ({ context }) => context.commanderApproval.planApproved,
  },
  actions: {
    navigateToStep: assign({
      currentStep: ({ event }) => {
        if (event.type === 'NAVIGATE_TO_STEP') return event.step;
        return undefined as never;
      },
    }),

    startStep: assign({
      steps: ({ context, event }) => {
        if (event.type !== 'START_STEP') return context.steps;
        return {
          ...context.steps,
          [event.step]: 'in_progress' as const,
        };
      },
      currentStep: ({ event }) => {
        if (event.type === 'START_STEP') return event.step;
        return undefined as never;
      },
      lastUpdated: () => new Date(),
      lastUpdatedBy: ({ event }) => {
        if (event.type === 'START_STEP') return event.actorDID;
        return undefined as never;
      },
    }),

    markStepReady: assign({
      steps: ({ context, event }) => {
        if (event.type !== 'MARK_STEP_READY') return context.steps;
        return {
          ...context.steps,
          [event.step]: 'ready' as const,
        };
      },
      lastUpdated: () => new Date(),
      lastUpdatedBy: ({ event }) => {
        if (event.type === 'MARK_STEP_READY') return event.actorDID;
        return undefined as never;
      },
    }),

    updateCOACount: assign({
      coaCount: ({ event }) => {
        if (event.type === 'UPDATE_COA_COUNT') return event.count;
        return undefined as never;
      },
    }),

    selectCOA: assign({
      selectedCoaId: ({ event }) => {
        if (event.type === 'SELECT_COA') return event.coaId;
        return undefined as never;
      },
      lastUpdated: () => new Date(),
      lastUpdatedBy: ({ event }) => {
        if (event.type === 'SELECT_COA') return event.actorDID;
        return undefined as never;
      },
    }),

    recordCOAApproval: assign({
      commanderApproval: ({ context, event }) => {
        if (event.type !== 'COMMANDER_APPROVE_COA') return context.commanderApproval;
        return {
          ...context.commanderApproval,
          coaApproved: true,
          coaApprovedAt: new Date(),
          coaApprovedBy: event.commanderDID,
        };
      },
      steps: ({ context }) => ({
        ...context.steps,
        coa_approval: 'approved' as const,
      }),
    }),

    recordCOARejection: assign({
      steps: ({ context }) => ({
        ...context.steps,
        coa_approval: 'rejected' as const,
        // Reset prior steps for revision
        coa_development: 'in_progress' as const,
        coa_analysis: 'not_started' as const,
        coa_comparison: 'not_started' as const,
      }),
      selectedCoaId: () => null,
    }),

    recordPlanApproval: assign({
      commanderApproval: ({ context, event }) => {
        if (event.type !== 'COMMANDER_APPROVE_PLAN') return context.commanderApproval;
        return {
          ...context.commanderApproval,
          planApproved: true,
          planApprovedAt: new Date(),
          planApprovedBy: event.commanderDID,
        };
      },
      steps: ({ context }) => ({
        ...context.steps,
        plan_approval: 'approved' as const,
      }),
    }),

    recordPlanRejection: assign({
      steps: ({ context }) => ({
        ...context.steps,
        plan_approval: 'rejected' as const,
        plan_development: 'in_progress' as const,
      }),
    }),
  },
}).createMachine({
  id: 'jp50Planning',
  initial: 'navigation',
  context: {
    planId: '',
    missionId: '',
    currentStep: 'planning_initiation' as JP50Step,
    steps: {
      planning_initiation: 'not_started' as const,
      mission_analysis: 'not_started' as const,
      coa_development: 'not_started' as const,
      coa_analysis: 'not_started' as const,
      coa_comparison: 'not_started' as const,
      coa_approval: 'not_started' as const,
      plan_development: 'not_started' as const,
      plan_approval: 'not_started' as const,
    },
    coaCount: 0,
    selectedCoaId: null,
    commanderApproval: {
      coaApproved: false,
      coaApprovedAt: null,
      coaApprovedBy: null,
      planApproved: false,
      planApprovedAt: null,
      planApprovedBy: null,
    },
    lastUpdated: new Date(),
    lastUpdatedBy: '',
  },
  states: {
    navigation: {
      description: 'Flexible navigation - users can work on any step',
      on: {
        NAVIGATE_TO_STEP: {
          actions: 'navigateToStep',
        },
        START_STEP: {
          actions: 'startStep',
        },
        MARK_STEP_READY: {
          guard: 'canMarkReady',
          actions: 'markStepReady',
        },
        UPDATE_COA_COUNT: {
          actions: 'updateCOACount',
        },
        SELECT_COA: {
          actions: 'selectCOA',
        },
        REQUEST_COA_APPROVAL: {
          target: 'awaitingCOAApproval',
          guard: 'canRequestCOAApproval',
        },
      },
    },
    awaitingCOAApproval: {
      description: 'Human checkpoint: Commander must approve selected COA',
      on: {
        COMMANDER_APPROVE_COA: {
          target: 'navigation',
          actions: 'recordCOAApproval',
        },
        COMMANDER_REJECT_COA: {
          target: 'navigation',
          actions: 'recordCOARejection',
        },
      },
    },
    awaitingPlanApproval: {
      description: 'Human checkpoint: Commander must approve final plan',
      on: {
        COMMANDER_APPROVE_PLAN: {
          target: 'planApproved',
          actions: 'recordPlanApproval',
        },
        COMMANDER_REJECT_PLAN: {
          target: 'navigation',
          actions: 'recordPlanRejection',
        },
      },
    },
    planApproved: {
      type: 'final',
      description: 'Plan is approved and ready for execution',
    },
  },
  on: {
    REQUEST_PLAN_APPROVAL: {
      target: '.awaitingPlanApproval',
      guard: 'canRequestPlanApproval',
    },
  },
});
