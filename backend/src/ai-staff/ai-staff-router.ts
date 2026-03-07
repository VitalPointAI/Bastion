/**
 * AI Staff REST API Router
 *
 * Phase 29 Plan 02: Express router mounted at /api/ai-staff with 11
 * endpoints for feed items, annotations, chat messages, and tab routing.
 * Publishes real-time updates via MessageBus WebSocket channels.
 *
 * NOT mounted in app.ts yet -- wiring happens in Plan 05 integration.
 */

import { Router } from 'express';
import { aiStaffStore } from './ai-staff-store.js';
import { rankFeedItems } from './feed-priority.js';
import { getMessageBus } from '../messaging/message-bus.js';
import type { AIFeedItemRow, AIAnnotationRow, ChatMessageRow } from './ai-staff-types.js';

const SERVICE_DID = 'did:system:ai-staff-service';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function wsChannel(problemSetId: string): string {
  return `ai.staff.${problemSetId}`;
}

async function publishToChannel(
  problemSetId: string,
  messageType: string,
  payload: unknown,
): Promise<void> {
  try {
    const bus = getMessageBus();
    await bus.publish({
      sourceDid: SERVICE_DID,
      sourceType: 'system',
      destinationType: 'channel',
      destinationTarget: wsChannel(problemSetId),
      messageType,
      payload,
    });
  } catch (err) {
    // Non-blocking: log but don't fail the HTTP response
    console.error(`[ai-staff] WebSocket publish error (${messageType}):`, err);
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export const aiStaffRouter = Router();

// =========================================================================
// 1. GET /api/ai-staff/:problemSetId/feed
// =========================================================================

aiStaffRouter.get('/:problemSetId/feed', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const tab = req.query.tab as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const items = await aiStaffStore.getFeedItems(problemSetId, { tab, limit, offset });
    const ranked = rankFeedItems(items);
    res.json({ items: ranked, total: ranked.length });
  } catch (err) {
    console.error('[ai-staff] GET feed error:', err);
    res.status(500).json({ error: 'Failed to retrieve feed items' });
  }
});

// =========================================================================
// 2. POST /api/ai-staff/:problemSetId/feed
// =========================================================================

aiStaffRouter.post('/:problemSetId/feed', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const body = req.body as Omit<AIFeedItemRow, 'id' | 'created_at' | 'updated_at' | 'is_read'>;

    const item = await aiStaffStore.createFeedItem({
      ...body,
      problem_set_id: problemSetId,
    });

    await publishToChannel(problemSetId, 'ai.feed.new', item);

    res.status(201).json(item);
  } catch (err) {
    console.error('[ai-staff] POST feed error:', err);
    res.status(500).json({ error: 'Failed to create feed item' });
  }
});

// =========================================================================
// 3. PATCH /api/ai-staff/:problemSetId/feed/:itemId/read
// =========================================================================

aiStaffRouter.patch('/:problemSetId/feed/:itemId/read', async (req, res) => {
  try {
    const { itemId } = req.params;
    await aiStaffStore.markRead(itemId);
    res.json({ success: true });
  } catch (err) {
    console.error('[ai-staff] PATCH feed read error:', err);
    res.status(500).json({ error: 'Failed to mark item as read' });
  }
});

// =========================================================================
// 4. POST /api/ai-staff/:problemSetId/feed/read-all
// =========================================================================

aiStaffRouter.post('/:problemSetId/feed/read-all', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    await aiStaffStore.markAllRead(problemSetId);
    res.json({ success: true });
  } catch (err) {
    console.error('[ai-staff] POST feed read-all error:', err);
    res.status(500).json({ error: 'Failed to mark all items as read' });
  }
});

// =========================================================================
// 5. GET /api/ai-staff/:problemSetId/annotations
// =========================================================================

aiStaffRouter.get('/:problemSetId/annotations', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const annotations = await aiStaffStore.getAnnotations(problemSetId, {
      status: status as AIAnnotationRow['status'],
      limit,
      offset,
    });
    res.json({ annotations, total: annotations.length });
  } catch (err) {
    console.error('[ai-staff] GET annotations error:', err);
    res.status(500).json({ error: 'Failed to retrieve annotations' });
  }
});

// =========================================================================
// 6. POST /api/ai-staff/:problemSetId/annotations
// =========================================================================

aiStaffRouter.post('/:problemSetId/annotations', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const body = req.body as Omit<AIAnnotationRow, 'id' | 'created_at' | 'updated_at'>;

    const annotation = await aiStaffStore.createAnnotation({
      ...body,
      problem_set_id: problemSetId,
    });

    await publishToChannel(problemSetId, 'ai.annotation.new', annotation);

    res.status(201).json(annotation);
  } catch (err) {
    console.error('[ai-staff] POST annotations error:', err);
    res.status(500).json({ error: 'Failed to create annotation' });
  }
});

// =========================================================================
// 7. PATCH /api/ai-staff/:problemSetId/annotations/:annotationId
// =========================================================================

aiStaffRouter.patch('/:problemSetId/annotations/:annotationId', async (req, res) => {
  try {
    const { problemSetId, annotationId } = req.params;
    const { status } = req.body as { status: AIAnnotationRow['status'] };

    if (!status) {
      res.status(400).json({ error: 'Missing required field: status' });
      return;
    }

    const updated = await aiStaffStore.updateAnnotationStatus(annotationId, status);

    await publishToChannel(problemSetId, 'ai.annotation.updated', updated);

    res.json(updated);
  } catch (err) {
    console.error('[ai-staff] PATCH annotation error:', err);
    res.status(500).json({ error: 'Failed to update annotation status' });
  }
});

// =========================================================================
// 8. GET /api/ai-staff/:problemSetId/chat
// =========================================================================

aiStaffRouter.get('/:problemSetId/chat', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const messages = await aiStaffStore.getChatHistory(problemSetId, limit);
    res.json({ messages, total: messages.length });
  } catch (err) {
    console.error('[ai-staff] GET chat error:', err);
    res.status(500).json({ error: 'Failed to retrieve chat history' });
  }
});

// =========================================================================
// 9. POST /api/ai-staff/:problemSetId/chat
// =========================================================================

aiStaffRouter.post('/:problemSetId/chat', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const body = req.body as Omit<ChatMessageRow, 'id' | 'created_at'>;

    const message = await aiStaffStore.addChatMessage({
      ...body,
      problem_set_id: problemSetId,
    });

    await publishToChannel(problemSetId, 'ai.chat.new', message);

    // TODO: If sender is 'user', trigger agent routing (Plan 05+)

    res.status(201).json(message);
  } catch (err) {
    console.error('[ai-staff] POST chat error:', err);
    res.status(500).json({ error: 'Failed to add chat message' });
  }
});

// =========================================================================
// 10. GET /api/ai-staff/:problemSetId/routing
// =========================================================================

aiStaffRouter.get('/:problemSetId/routing', async (req, res) => {
  try {
    const { problemSetId } = req.params;
    const routing = await aiStaffStore.getTabRouting(problemSetId);
    res.json({ routing });
  } catch (err) {
    console.error('[ai-staff] GET routing error:', err);
    res.status(500).json({ error: 'Failed to retrieve routing config' });
  }
});

// =========================================================================
// 11. PUT /api/ai-staff/:problemSetId/routing/:tabId
// =========================================================================

aiStaffRouter.put('/:problemSetId/routing/:tabId', async (req, res) => {
  try {
    const { problemSetId, tabId } = req.params;
    const { agentIds } = req.body as { agentIds: string[] };

    if (!Array.isArray(agentIds)) {
      res.status(400).json({ error: 'Missing required field: agentIds (string[])' });
      return;
    }

    const routing = await aiStaffStore.updateTabRouting(problemSetId, tabId, agentIds);
    res.json(routing);
  } catch (err) {
    console.error('[ai-staff] PUT routing error:', err);
    res.status(500).json({ error: 'Failed to update routing config' });
  }
});
