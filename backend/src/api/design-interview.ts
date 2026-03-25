/**
 * Design Interview REST API
 *
 * Phase 55 Plan 03: Express routes for /api/design-interview/*
 * Exposes the design interview service to the frontend for guided
 * operational approach development via Ironclaw.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { DesignInterviewService } from '../design-interview/design-interview-service.js';

const router = Router();
const designInterviewService = new DesignInterviewService();

/** Extract text from AI message content (handles string, array of content blocks, etc.) */
function extractMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block: unknown) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) return (block as { text: string }).text;
        return '';
      })
      .filter(Boolean)
      .join('\n');
  }
  return String(content ?? '');
}

/**
 * POST /:problemSetId/start — Start a new design interview
 */
router.post('/:problemSetId/start', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { mode } = req.body as { mode?: 'new' | 'revision' };

    const result = await designInterviewService.startInterview(problemSetId, mode);

    res.json({
      message: extractMessageText(result.message.content),
      state: result.meta,
    });
  } catch (err) {
    console.error('[design-interview] start error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /:problemSetId/continue — Continue interview with user message
 */
router.post('/:problemSetId/continue', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { message } = req.body as { message: string };

    if (!message) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    const result = await designInterviewService.continueInterview(problemSetId, message);

    res.json({
      message: extractMessageText(result.message.content),
      state: result.meta,
    });
  } catch (err) {
    console.error('[design-interview] continue error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /:problemSetId/confirm-section — Confirm current section review gate
 */
router.post('/:problemSetId/confirm-section', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    const result = await designInterviewService.confirmSection(problemSetId);

    res.json({
      message: extractMessageText(result.message.content),
      state: result.meta,
    });
  } catch (err) {
    console.error('[design-interview] confirm-section error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /:problemSetId/state — Get current interview state (for resume)
 */
router.get('/:problemSetId/state', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    const result = await designInterviewService.getInterviewState(problemSetId);

    if (!result) {
      res.json({ state: null, lastMessage: null, chatHistory: [] });
      return;
    }

    // Extract simplified chat history from LangGraph messages for resume
    const chatHistory: Array<{ role: 'user' | 'assistant'; content: string }> = [];
    for (const msg of result.messages) {
      if (msg.type === 'system') continue;
      const text = extractMessageText(msg.content);
      if (!text) continue;
      chatHistory.push({
        role: msg.type === 'human' ? 'user' : 'assistant',
        content: text,
      });
    }

    // Last AI message for immediate display
    const lastAiMsg = [...result.messages].reverse().find(m => m.type === 'ai');
    const lastMessage = lastAiMsg ? extractMessageText(lastAiMsg.content) : null;

    res.json({ state: result.meta, lastMessage, chatHistory });
  } catch (err) {
    console.error('[design-interview] state error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /:problemSetId — Reset interview for fresh start
 */
router.delete('/:problemSetId', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;

    await designInterviewService.resetInterview(problemSetId);

    res.status(204).send();
  } catch (err) {
    console.error('[design-interview] reset error:', err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /:problemSetId/review-edits — Review user's field edits and provide critique
 * Called automatically when user pauses editing during an active interview
 */
router.post('/:problemSetId/review-edits', async (req: Request, res: Response) => {
  try {
    const problemSetId = req.params.problemSetId as string;
    const { edits } = req.body as {
      edits: Array<{ field: string; previousValue: string; newValue: string }>;
    };

    if (!edits?.length) {
      res.json({ critique: null });
      return;
    }

    // Get current interview state for context
    const state = await designInterviewService.getInterviewState(problemSetId);
    if (!state) {
      res.json({ critique: null });
      return;
    }

    // Build a concise diff summary
    const editSummary = edits.map((e) => {
      const prev = e.previousValue?.substring(0, 200) || '(empty)';
      const next = e.newValue?.substring(0, 200) || '(empty)';
      return `**${e.field}**: "${prev}" → "${next}"`;
    }).join('\n');

    // Use LLM to evaluate the edits
    const { createLLMForAgent } = await import('../agents/langgraph/llm-factory.js');
    const llm = await createLLMForAgent({ agentId: 'ironclaw', overrides: { temperature: 0.3, maxTokens: 512 } });

    const result = await llm.invoke([
      {
        role: 'system',
        content: `You are Ironclaw, an AI chief of staff observing the commander's edits to an operational design document (${state.meta.currentSection} section).

Your role is to provide BRIEF, THOUGHTFUL observations on the edits. You are NOT interrupting — the commander is working, and you are offering a quick professional observation.

Guidelines:
- If the edit is solid and improves the document, say nothing. Return exactly: NO_COMMENT
- Only comment if you see something genuinely worth raising: a logical gap, an assumption that needs testing, a missed connection to other sections, or a doctrinal concern
- Keep it to 1-2 sentences maximum. Be tactful and constructive.
- Frame as an observation, not a directive: "One consideration with this change..." or "This pairs well with the CoG analysis — worth noting that..."
- Do NOT repeat the edit back to the user. They know what they wrote.
- Return NO_COMMENT if the edit is routine, minor, or doesn't warrant input.`,
      },
      {
        role: 'user',
        content: `The commander just made these edits:\n${editSummary}`,
      },
    ]);

    const critique = extractMessageText(result.content).trim();
    if (critique === 'NO_COMMENT' || critique.length < 5) {
      res.json({ critique: null });
      return;
    }

    res.json({ critique });
  } catch (err) {
    console.error('[design-interview] review-edits error:', err);
    // Non-fatal — don't block the user's editing workflow
    res.json({ critique: null });
  }
});

export default router;
