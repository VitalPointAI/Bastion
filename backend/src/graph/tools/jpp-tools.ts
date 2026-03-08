/**
 * JPP MCP Tools
 *
 * MCP tool definitions for Joint Planning Process step product management.
 * Used by JPP step agents for CRUD operations on step products, instance management,
 * and bridging Operational Design LOEs into JPP COA development.
 */

import type { MCPToolInput } from '../../agents/character-schema.js';
import type { JPPStepId, StepStatus, StepProductStatus } from '../../jpp/types.js';

/**
 * Map step number (1-7) to JPPStepId string
 */
const STEP_NUMBER_TO_ID: Record<number, JPPStepId> = {
  1: 'planning_initiation',
  2: 'mission_analysis',
  3: 'coa_development',
  4: 'coa_analysis',
  5: 'coa_comparison',
  6: 'coa_approval',
  7: 'plan_development',
};

/**
 * Tool definitions for registration in ToolRegistry
 */
export const jppToolDefinitions: MCPToolInput[] = [
  {
    toolId: 'get_jpp_instance',
    name: 'Get JPP Instance',
    description:
      'Get the JPP instance for a problem set. Creates one automatically if none exists. Returns the full JPP record including step statuses.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to get or create JPP instance for',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_jpp_instance'],
    isEnabled: true,
  },
  {
    toolId: 'save_step_product',
    name: 'Save Step Product',
    description:
      'Save or update a step product for a JPP step. Products include mission statements, COA sketches, staff estimates, decision matrices, and plan documents.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID this product belongs to',
        },
        step: {
          type: 'integer',
          description: 'JPP step number (1-7)',
          minimum: 1,
          maximum: 7,
        },
        roleId: {
          type: 'string',
          description: 'Staff role key that produced this product (e.g. j2, j35, commander)',
        },
        content: {
          type: 'object',
          description: 'JSONB content object with structured fields specific to the product type',
        },
        aiDraftedBy: {
          type: 'string',
          description: 'Agent ID that drafted this product (omit for human-authored)',
        },
        status: {
          type: 'string',
          description: 'Product status',
          enum: ['draft', 'reviewed', 'approved'],
          default: 'draft',
        },
        productId: {
          type: 'string',
          description: 'Existing product ID to update (omit for new product)',
        },
      },
      required: ['jppInstanceId', 'step', 'roleId', 'content'],
    },
    handler: 'builtin',
    permissions: ['tool:save_step_product'],
    isEnabled: true,
  },
  {
    toolId: 'get_step_products',
    name: 'Get Step Products',
    description:
      'Get all products for a specific JPP step. Returns products sorted by creation date.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID',
        },
        step: {
          type: 'integer',
          description: 'JPP step number (1-7)',
          minimum: 1,
          maximum: 7,
        },
      },
      required: ['jppInstanceId', 'step'],
    },
    handler: 'builtin',
    permissions: ['tool:get_step_products'],
    isEnabled: true,
  },
  {
    toolId: 'update_step_status',
    name: 'Update Step Status',
    description:
      'Update the status of a JPP step. Tracks progression through the planning process.',
    category: 'action',
    inputSchema: {
      type: 'object',
      properties: {
        jppInstanceId: {
          type: 'string',
          description: 'JPP instance ID',
        },
        step: {
          type: 'integer',
          description: 'JPP step number (1-7)',
          minimum: 1,
          maximum: 7,
        },
        status: {
          type: 'string',
          description: 'New status for the step',
          enum: ['not_started', 'in_progress', 'ready', 'approved', 'rejected'],
        },
      },
      required: ['jppInstanceId', 'step', 'status'],
    },
    handler: 'builtin',
    permissions: ['tool:update_step_status'],
    isEnabled: true,
  },
  {
    toolId: 'get_parent_jpp_products',
    name: 'Get Parent JPP Products',
    description:
      'Get JPP products from the parent problem set for inheritance. Returns read-only reference data that child JPP instances can use as input.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Current (child) problem set ID. The tool will look up the parent.',
        },
        step: {
          type: 'integer',
          description: 'JPP step number to get parent products for (1-7)',
          minimum: 1,
          maximum: 7,
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_parent_jpp_products'],
    isEnabled: true,
  },
  {
    toolId: 'get_loes_from_design',
    name: 'Get LOEs from Operational Design',
    description:
      'Fetch Lines of Effort from the Operational Design (Design tab) for a problem set. Bridges Design tab output into JPP COA Development input. Returns LOEs with decisive points and CoG linkages.',
    category: 'data',
    inputSchema: {
      type: 'object',
      properties: {
        problemSetId: {
          type: 'string',
          description: 'Problem set ID to fetch operational design LOEs for',
        },
      },
      required: ['problemSetId'],
    },
    handler: 'builtin',
    permissions: ['tool:get_loes_from_design'],
    isEnabled: true,
  },
];

/**
 * Tool execution handlers
 *
 * Handlers call store methods at runtime. Stores are imported lazily
 * since they may not be available at tool registration time.
 */
export const jppToolHandlers = {
  /**
   * Get or create a JPP instance for a problem set
   */
  async get_jpp_instance(input: {
    problemSetId: string;
  }): Promise<{ jppInstance: unknown }> {
    const { jppStore } = await import('../../jpp/jpp-store.js');
    const jppInstance = await jppStore.getInstanceByProblemSet(input.problemSetId);
    return { jppInstance };
  },

  /**
   * Save or update a step product
   */
  async save_step_product(input: {
    jppInstanceId: string;
    step: number;
    roleId: string;
    content: Record<string, unknown>;
    aiDraftedBy?: string;
    status?: string;
    productId?: string;
  }): Promise<{ productId: string; success: boolean }> {
    const { jppStore } = await import('../../jpp/jpp-store.js');
    const stepId = STEP_NUMBER_TO_ID[input.step] as JPPStepId;
    const product = await jppStore.saveStepProduct({
      id: input.productId,
      jppInstanceId: input.jppInstanceId,
      step: stepId,
      roleId: input.roleId,
      content: input.content,
      aiDraftedBy: input.aiDraftedBy ?? null,
      status: (input.status ?? 'draft') as StepProductStatus,
    });
    return { productId: product.id, success: true };
  },

  /**
   * Get products for a JPP step
   */
  async get_step_products(input: {
    jppInstanceId: string;
    step: number;
  }): Promise<{ products: unknown[]; total: number }> {
    const { jppStore } = await import('../../jpp/jpp-store.js');
    const stepId = STEP_NUMBER_TO_ID[input.step] as JPPStepId;
    const products = await jppStore.getStepProducts(input.jppInstanceId, stepId);
    return { products, total: products.length };
  },

  /**
   * Update a step's status
   */
  async update_step_status(input: {
    jppInstanceId: string;
    step: number;
    status: string;
  }): Promise<{ success: boolean }> {
    const { jppStore } = await import('../../jpp/jpp-store.js');
    const stepId = STEP_NUMBER_TO_ID[input.step] as JPPStepId;
    await jppStore.updateStepStatus(input.jppInstanceId, stepId, input.status as StepStatus);
    return { success: true };
  },

  /**
   * Get parent JPP products for inheritance.
   * Looks up the current JPP instance, finds its parent via parentJppId,
   * and returns products from the parent instance.
   */
  async get_parent_jpp_products(input: {
    problemSetId: string;
    step?: number;
  }): Promise<{ products: unknown[]; parentProblemSetId: string | null }> {
    const { jppStore } = await import('../../jpp/jpp-store.js');

    // Get the child's JPP instance
    const childInstance = await jppStore.getInstanceByProblemSet(input.problemSetId);
    if (!childInstance.parentJppId) {
      return { products: [], parentProblemSetId: null };
    }

    // Get the parent instance
    const parentInstance = await jppStore.getInstance(childInstance.parentJppId);
    if (!parentInstance) {
      return { products: [], parentProblemSetId: null };
    }

    // Get products from parent, optionally filtered by step
    if (input.step) {
      const stepId = STEP_NUMBER_TO_ID[input.step] as JPPStepId;
      const products = await jppStore.getStepProducts(parentInstance.id, stepId);
      return { products, parentProblemSetId: parentInstance.problemSetId };
    }

    // Get all products across all steps
    const allProducts: unknown[] = [];
    for (const stepId of Object.values(STEP_NUMBER_TO_ID)) {
      const products = await jppStore.getStepProducts(parentInstance.id, stepId);
      allProducts.push(...products);
    }

    return { products: allProducts, parentProblemSetId: parentInstance.problemSetId };
  },

  /**
   * Fetch LOEs from Operational Design for COA Development
   */
  async get_loes_from_design(input: {
    problemSetId: string;
  }): Promise<{
    linesOfEffort: unknown[];
    problemStatement: string;
    assumptions: string[];
    constraints: string[];
  }> {
    const { designStore } = await import('../../design/design-store.js');
    const design = await designStore.getByProblemSetId(input.problemSetId);

    return {
      linesOfEffort: design.linesOfEffort,
      problemStatement: design.problemFraming.problemStatement,
      assumptions: design.problemFraming.assumptions,
      constraints: design.problemFraming.constraints,
    };
  },
};
