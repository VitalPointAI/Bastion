/**
 * Document Intelligence API Routes
 *
 * Express router for the scoping interview and problem set context.
 * Provides endpoints for:
 * - Starting and continuing conversational interviews
 * - Retrieving interview state for resume
 * - Completing interviews and storing ProblemSetContext
 * - Retrieving stored ProblemSetContext
 */

import { Router, Request, Response } from 'express';
import { InterviewService } from '../doc-intelligence/interview/interview-service.js';
import { getProblemSetContext } from '../doc-intelligence/interview/interview-store.js';
import { BriefingService } from '../doc-intelligence/briefing/briefing-service.js';
import { ChangeTracker } from '../doc-intelligence/briefing/change-tracker.js';

const router = Router();
const interviewService = new InterviewService();
const briefingService = new BriefingService();
const changeTracker = new ChangeTracker();

// ==========================================================================
// Interview Endpoints
// ==========================================================================

/**
 * POST /api/doc-intelligence/interview/:problemSetId/start
 * Start a new scoping interview for a problem set.
 * Returns the first AI message (introduction and opening question).
 */
router.post(
  '/interview/:problemSetId/start',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const result = await interviewService.startInterview(problemSetId as string);

      res.json({
        success: true,
        message: {
          role: 'assistant',
          content:
            typeof result.message.content === 'string'
              ? result.message.content
              : JSON.stringify(result.message.content),
        },
        state: result.state,
      });
    } catch (error) {
      console.error('[DocIntelligence] Start interview error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

/**
 * POST /api/doc-intelligence/interview/:problemSetId/message
 * Send a user message and receive the next AI response.
 * Body: { message: string }
 */
router.post(
  '/interview/:problemSetId/message',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const { message } = req.body;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      if (!message || typeof message !== 'string') {
        res.status(400).json({ success: false, error: 'message is required' });
        return;
      }

      const result = await interviewService.continueInterview(problemSetId as string, message);

      res.json({
        success: true,
        message: {
          role: 'assistant',
          content:
            typeof result.message.content === 'string'
              ? result.message.content
              : JSON.stringify(result.message.content),
        },
        state: result.state,
      });
    } catch (error) {
      console.error('[DocIntelligence] Continue interview error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

/**
 * GET /api/doc-intelligence/interview/:problemSetId/state
 * Get the current interview state for resume after page refresh.
 * Returns messages, questions asked, completion status, and derived context.
 */
router.get(
  '/interview/:problemSetId/state',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const state = await interviewService.getInterviewState(problemSetId as string);

      if (!state) {
        res.json({
          success: true,
          state: null,
        });
        return;
      }

      // Serialize messages to simple role/content format for the frontend
      const serializedMessages = state.messages.map((msg) => {
        const msgType = msg._getType();
        return {
          role: msgType === 'human' ? 'user' : 'assistant',
          content:
            typeof msg.content === 'string'
              ? msg.content
              : JSON.stringify(msg.content),
        };
      });

      res.json({
        success: true,
        state: {
          messages: serializedMessages,
          questionsAsked: state.questionsAsked,
          isComplete: state.isComplete,
          derivedContext: state.derivedContext,
        },
      });
    } catch (error) {
      console.error('[DocIntelligence] Get interview state error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

/**
 * POST /api/doc-intelligence/interview/:problemSetId/complete
 * Finalize the interview and store the validated ProblemSetContext.
 * Returns the extracted and validated context.
 */
router.post(
  '/interview/:problemSetId/complete',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const context = await interviewService.completeInterview(problemSetId as string);

      res.json({
        success: true,
        context,
      });
    } catch (error) {
      console.error('[DocIntelligence] Complete interview error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

// ==========================================================================
// Context Endpoints
// ==========================================================================

/**
 * GET /api/doc-intelligence/context/:problemSetId
 * Retrieve the stored ProblemSetContext for a problem set.
 */
router.get(
  '/context/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const context = await getProblemSetContext(problemSetId as string);

      if (!context) {
        res.status(404).json({
          success: false,
          error: 'No context found for this problem set',
        });
        return;
      }

      res.json({
        success: true,
        context,
      });
    } catch (error) {
      console.error('[DocIntelligence] Get context error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  }
);

// ==========================================================================
// Briefing Endpoints (Phase 40 Plan 08)
// ==========================================================================

/**
 * GET /api/doc-intelligence/briefing/:problemSetId
 * Generate a strategic environment briefing for the authenticated user.
 * Returns a narrative briefing with change detection and predictive analytics.
 */
router.get(
  '/briefing/:problemSetId',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const requestedBy: string = String(req.headers['x-did'] || 'anonymous');

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const briefing = await briefingService.generateBriefing(problemSetId as string, requestedBy);

      res.json({
        success: true,
        briefing,
      });
    } catch (error) {
      console.error('[DocIntelligence] Generate briefing error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * GET /api/doc-intelligence/briefing/:problemSetId/changes
 * Quick check if changes exist since the user's last access.
 * Lightweight endpoint -- does not generate a full briefing.
 */
router.get(
  '/briefing/:problemSetId/changes',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const accessedBy: string = String(req.headers['x-did'] || 'anonymous');

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const hasChanges = await changeTracker.hasChanges(problemSetId as string, accessedBy);

      res.json({
        success: true,
        hasChanges,
      });
    } catch (error) {
      console.error('[DocIntelligence] Check changes error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

/**
 * GET /api/doc-intelligence/briefing/:problemSetId/history
 * Retrieve past briefings for the authenticated user on a problem set.
 */
router.get(
  '/briefing/:problemSetId/history',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { problemSetId } = req.params;
      const requestedBy: string = String(req.headers['x-did'] || 'anonymous');

      if (!problemSetId) {
        res.status(400).json({ success: false, error: 'problemSetId is required' });
        return;
      }

      const history = await briefingService.getBriefingHistory(problemSetId as string, requestedBy);

      res.json({
        success: true,
        history,
      });
    } catch (error) {
      console.error('[DocIntelligence] Get briefing history error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Internal error',
      });
    }
  },
);

export default router;
