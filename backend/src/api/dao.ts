/**
 * DAO REST API Endpoints
 *
 * REST API for DAO governance operations with classification-based filtering.
 * Integrates with zero-trust middleware for authentication/authorization.
 */

import { Router, Request, Response } from 'express';
import { getDAOService } from '../dao/dao-service.js';
import {
  AutonomyLevel,
  Classification,
  DAOConfig,
  DAOMetadata,
  Proposal,
  ProposalKind,
  TransactionArgs,
  VoteType,
} from '../dao/types.js';
import {
  zeroTrustAuth,
  CLASSIFICATION_LEVELS,
  SubjectAttributes,
} from '../security/index.js';

const router = Router();
const daoService = getDAOService();

// ==========================================================================
// Response Types
// ==========================================================================

interface DAOResponse<T> {
  success: boolean;
  data?: T;
  transaction?: TransactionArgs;
  error?: string;
}

// ==========================================================================
// Classification Filtering Helpers
// ==========================================================================

/**
 * Map contract Classification enum to ABAC clearance level.
 */
function mapClassificationToClearance(
  classification: Classification
): 'UNCLASS' | 'CUI' | 'CONFIDENTIAL' | 'SECRET' | 'TOPSECRET' {
  switch (classification) {
    case Classification.Public:
      return 'UNCLASS';
    case Classification.Secret:
      return 'SECRET';
    case Classification.TopSecret:
      return 'TOPSECRET';
    default:
      return 'UNCLASS';
  }
}

/**
 * Check if subject can access content at given classification level.
 */
function canAccessClassification(
  subjectAttributes: SubjectAttributes,
  classification: Classification
): boolean {
  const requiredLevel = mapClassificationToClearance(classification);
  const subjectLevel = CLASSIFICATION_LEVELS[subjectAttributes.clearance] ?? 0;
  const requiredLevelNum = CLASSIFICATION_LEVELS[requiredLevel] ?? 0;

  return subjectLevel >= requiredLevelNum;
}

/**
 * Filter items by classification based on user's clearance level.
 */
function filterByClassification<T extends { config?: { classification: Classification }; classification?: Classification }>(
  items: T[],
  subjectAttributes: SubjectAttributes
): T[] {
  return items.filter((item) => {
    // Check both direct classification and nested config.classification
    const classification = item.classification || item.config?.classification;
    if (!classification) {
      // No classification = public
      return true;
    }
    return canAccessClassification(subjectAttributes, classification);
  });
}

/**
 * Extract subject attributes from request (set by zeroTrustAuth middleware).
 * Falls back to default UNCLASS user if not authenticated.
 */
function getSubjectFromRequest(req: Request): SubjectAttributes {
  if (req.zeroTrust?.attributes) {
    return req.zeroTrust.attributes;
  }

  // Default: unauthenticated user with lowest clearance
  return {
    did: 'anonymous',
    clearance: 'UNCLASS',
    nationality: 'USA',
    organization: '',
    role: '',
    caveats: {
      releasability: [],
      bilateral: [],
      specialAccess: [],
    },
  };
}

// ==========================================================================
// DAO Management Endpoints
// ==========================================================================

/**
 * GET /api/dao
 * List all DAOs (filtered by user clearance).
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const allDAOs = await daoService.listDAOs(offset, limit);
    const subject = getSubjectFromRequest(req);
    const filteredDAOs = filterByClassification(allDAOs, subject);

    const response: DAOResponse<DAOMetadata[]> = {
      success: true,
      data: filteredDAOs,
    };
    res.json(response);
  } catch (error) {
    console.error('Error listing DAOs:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to list DAOs',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/dao/:daoId
 * Get DAO details (checks clearance).
 */
router.get('/:daoId', async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;

    const dao = await daoService.getDAO(daoId);
    if (!dao) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'DAO not found',
      };
      res.status(404).json(response);
      return;
    }

    // Check classification access
    const subject = getSubjectFromRequest(req);
    if (!canAccessClassification(subject, dao.config.classification)) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'Access denied',
      };
      res.status(403).json(response);
      return;
    }

    const response: DAOResponse<DAOMetadata> = {
      success: true,
      data: dao,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting DAO:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to get DAO',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/dao
 * Create a new DAO (returns transaction for signing).
 * Requires authentication.
 */
router.post('/', zeroTrustAuth(), async (req: Request, res: Response) => {
  try {
    const config: DAOConfig = req.body;

    // Validate required fields
    if (!config.name || !config.description) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'name and description are required',
      };
      res.status(400).json(response);
      return;
    }

    // Set defaults
    const fullConfig: DAOConfig = {
      name: config.name,
      description: config.description,
      classification: config.classification || Classification.Public,
      default_autonomy_level: config.default_autonomy_level || AutonomyLevel.NotAutonomous,
      proposal_bond: config.proposal_bond || '1000000000000000000000000', // 1 NEAR
      voting_period_ns: config.voting_period_ns || '604800000000000', // 7 days
      parent_dao_id: config.parent_dao_id || null,
    };

    const tx = daoService.buildCreateDAOTx(fullConfig);

    const response: DAOResponse<never> = {
      success: true,
      transaction: tx,
    };
    res.json(response);
  } catch (error) {
    console.error('Error creating DAO:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to create DAO',
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/dao/:daoId/config
 * Update DAO config (returns transaction for signing).
 * Requires authentication.
 */
router.put('/:daoId/config', zeroTrustAuth(), async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;
    const config: Partial<DAOConfig> = req.body;

    const tx = daoService.buildUpdateConfigTx(daoId, config);

    const response: DAOResponse<never> = {
      success: true,
      transaction: tx,
    };
    res.json(response);
  } catch (error) {
    console.error('Error updating DAO config:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to update DAO config',
    };
    res.status(500).json(response);
  }
});

// ==========================================================================
// Proposal Endpoints
// ==========================================================================

/**
 * GET /api/dao/:daoId/proposals
 * List proposals for a DAO (filtered by classification).
 */
router.get('/:daoId/proposals', async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;
    const offset = parseInt(req.query.offset as string) || 0;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const allProposals = await daoService.listProposals(daoId, offset, limit);
    const subject = getSubjectFromRequest(req);
    const filteredProposals = filterByClassification(allProposals, subject);

    const response: DAOResponse<Proposal[]> = {
      success: true,
      data: filteredProposals,
    };
    res.json(response);
  } catch (error) {
    console.error('Error listing proposals:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to list proposals',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/dao/:daoId/proposals/:proposalId
 * Get proposal details (checks classification access).
 */
router.get('/:daoId/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;
    const proposalId = req.params.proposalId as string;

    const proposal = await daoService.getProposal(daoId, parseInt(proposalId));
    if (!proposal) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'Proposal not found',
      };
      res.status(404).json(response);
      return;
    }

    // Check classification access
    const subject = getSubjectFromRequest(req);
    if (!canAccessClassification(subject, proposal.classification)) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'Access denied',
      };
      res.status(403).json(response);
      return;
    }

    const response: DAOResponse<Proposal> = {
      success: true,
      data: proposal,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting proposal:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to get proposal',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/dao/:daoId/proposals
 * Create a new proposal (returns transaction for signing).
 * Requires authentication.
 */
router.post('/:daoId/proposals', zeroTrustAuth(), async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;
    const { kind, description, classification, autonomy_override } = req.body;

    if (!kind || !description) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'kind and description are required',
      };
      res.status(400).json(response);
      return;
    }

    const tx = daoService.buildCreateProposalTx(
      daoId,
      kind as ProposalKind,
      description,
      classification || Classification.Public,
      autonomy_override as AutonomyLevel | undefined
    );

    const response: DAOResponse<never> = {
      success: true,
      transaction: tx,
    };
    res.json(response);
  } catch (error) {
    console.error('Error creating proposal:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to create proposal',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/dao/:daoId/proposals/:proposalId/votes
 * Get votes for a proposal.
 */
router.get('/:daoId/proposals/:proposalId/votes', async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;
    const proposalId = req.params.proposalId as string;

    // First check proposal access
    const proposal = await daoService.getProposal(daoId, parseInt(proposalId));
    if (!proposal) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'Proposal not found',
      };
      res.status(404).json(response);
      return;
    }

    const subject = getSubjectFromRequest(req);
    if (!canAccessClassification(subject, proposal.classification)) {
      const response: DAOResponse<never> = {
        success: false,
        error: 'Access denied',
      };
      res.status(403).json(response);
      return;
    }

    const votes = await daoService.getVotes(daoId, parseInt(proposalId));

    const response: DAOResponse<typeof votes> = {
      success: true,
      data: votes,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting votes:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to get votes',
    };
    res.status(500).json(response);
  }
});

// ==========================================================================
// Voting Endpoints
// ==========================================================================

/**
 * POST /api/dao/:daoId/proposals/:proposalId/vote
 * Cast a vote (returns transaction for signing).
 * Requires authentication.
 */
router.post(
  '/:daoId/proposals/:proposalId/vote',
  zeroTrustAuth(),
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const proposalId = req.params.proposalId as string;
      const { vote_type } = req.body;

      if (!vote_type || !['Approve', 'Reject', 'Abstain'].includes(vote_type)) {
        const response: DAOResponse<never> = {
          success: false,
          error: 'vote_type must be Approve, Reject, or Abstain',
        };
        res.status(400).json(response);
        return;
      }

      const tx = daoService.buildCastVoteTx(daoId, parseInt(proposalId), vote_type as VoteType);

      const response: DAOResponse<never> = {
        success: true,
        transaction: tx,
      };
      res.json(response);
    } catch (error) {
      console.error('Error creating vote transaction:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to create vote transaction',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * POST /api/dao/:daoId/proposals/:proposalId/veto
 * Submit a veto (returns transaction for signing).
 * Requires authentication.
 */
router.post(
  '/:daoId/proposals/:proposalId/veto',
  zeroTrustAuth(),
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const proposalId = req.params.proposalId as string;

      const tx = daoService.buildSubmitVetoTx(daoId, parseInt(proposalId));

      const response: DAOResponse<never> = {
        success: true,
        transaction: tx,
      };
      res.json(response);
    } catch (error) {
      console.error('Error creating veto transaction:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to create veto transaction',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * POST /api/dao/:daoId/proposals/:proposalId/approve
 * Submit human approval (returns transaction for signing).
 * Requires authentication.
 */
router.post(
  '/:daoId/proposals/:proposalId/approve',
  zeroTrustAuth(),
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const proposalId = req.params.proposalId as string;

      const tx = daoService.buildSubmitHumanApprovalTx(daoId, parseInt(proposalId));

      const response: DAOResponse<never> = {
        success: true,
        transaction: tx,
      };
      res.json(response);
    } catch (error) {
      console.error('Error creating approval transaction:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to create approval transaction',
      };
      res.status(500).json(response);
    }
  }
);

// ==========================================================================
// Coalition Endpoints
// ==========================================================================

/**
 * GET /api/dao/:daoId/proposals/:proposalId/coalition
 * Get coalition status for a proposal.
 */
router.get(
  '/:daoId/proposals/:proposalId/coalition',
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const proposalId = req.params.proposalId as string;

      // First check proposal access
      const proposal = await daoService.getProposal(daoId, parseInt(proposalId));
      if (!proposal) {
        const response: DAOResponse<never> = {
          success: false,
          error: 'Proposal not found',
        };
        res.status(404).json(response);
        return;
      }

      const subject = getSubjectFromRequest(req);
      if (!canAccessClassification(subject, proposal.classification)) {
        const response: DAOResponse<never> = {
          success: false,
          error: 'Access denied',
        };
        res.status(403).json(response);
        return;
      }

      const coalition = await daoService.getCoalitionStatus(daoId, parseInt(proposalId));

      const response: DAOResponse<typeof coalition> = {
        success: true,
        data: coalition,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting coalition status:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to get coalition status',
      };
      res.status(500).json(response);
    }
  }
);

/**
 * POST /api/dao/:daoId/proposals/:proposalId/coalition/approve
 * Submit party approval for coalition proposal (returns transaction for signing).
 * Requires authentication.
 */
router.post(
  '/:daoId/proposals/:proposalId/coalition/approve',
  zeroTrustAuth(),
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const proposalId = req.params.proposalId as string;
      const { party } = req.body;

      if (!party) {
        const response: DAOResponse<never> = {
          success: false,
          error: 'party is required',
        };
        res.status(400).json(response);
        return;
      }

      const tx = daoService.buildRecordCoalitionApprovalTx(
        daoId,
        parseInt(proposalId),
        party
      );

      const response: DAOResponse<never> = {
        success: true,
        transaction: tx,
      };
      res.json(response);
    } catch (error) {
      console.error('Error creating coalition approval transaction:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to create coalition approval transaction',
      };
      res.status(500).json(response);
    }
  }
);

// ==========================================================================
// Role Management Endpoints
// ==========================================================================

/**
 * GET /api/dao/:daoId/members/:account/roles
 * Get roles for a member in a DAO.
 */
router.get('/:daoId/members/:account/roles', async (req: Request, res: Response) => {
  try {
    const daoId = req.params.daoId as string;
    const account = req.params.account as string;

    const roles = await daoService.getMemberRoles(daoId, account);

    const response: DAOResponse<string[]> = {
      success: true,
      data: roles,
    };
    res.json(response);
  } catch (error) {
    console.error('Error getting member roles:', error);
    const response: DAOResponse<never> = {
      success: false,
      error: 'Failed to get member roles',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/dao/:daoId/members/:account/roles
 * Assign a role to a member (returns transaction for signing).
 * Requires authentication.
 */
router.post(
  '/:daoId/members/:account/roles',
  zeroTrustAuth(),
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const account = req.params.account as string;
      const { role } = req.body;

      if (!role) {
        const response: DAOResponse<never> = {
          success: false,
          error: 'role is required',
        };
        res.status(400).json(response);
        return;
      }

      const tx = daoService.buildAssignRoleTx(daoId, account, role);

      const response: DAOResponse<never> = {
        success: true,
        transaction: tx,
      };
      res.json(response);
    } catch (error) {
      console.error('Error creating role assignment transaction:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to create role assignment transaction',
      };
      res.status(500).json(response);
    }
  }
);

// ==========================================================================
// Execution State Endpoint
// ==========================================================================

/**
 * GET /api/dao/:daoId/proposals/:proposalId/execution
 * Get execution state for a proposal.
 */
router.get(
  '/:daoId/proposals/:proposalId/execution',
  async (req: Request, res: Response) => {
    try {
      const daoId = req.params.daoId as string;
      const proposalId = req.params.proposalId as string;

      const state = await daoService.getExecutionState(daoId, parseInt(proposalId));

      const response: DAOResponse<typeof state> = {
        success: true,
        data: state,
      };
      res.json(response);
    } catch (error) {
      console.error('Error getting execution state:', error);
      const response: DAOResponse<never> = {
        success: false,
        error: 'Failed to get execution state',
      };
      res.status(500).json(response);
    }
  }
);

export default router;
