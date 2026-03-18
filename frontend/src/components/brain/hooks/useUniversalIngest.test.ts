/**
 * Tests for useUniversalIngest — state machine for tracking ingest items + API calls
 *
 * Phase 50 Plan 03 TDD scaffold.
 *
 * Tests define expected behavior for:
 * - submitText: URL/text creates IngestItem with status lifecycle queued->classifying->routing->processing
 * - submitFiles: batch file submission via Promise.allSettled
 * - handleSSEEvent: classify:result, route:selected, route:error, processing:complete, processing:error
 * - Special status handling: interview_required, duplicate
 * - retryItem: increments retryCount, resets status to queued
 * - dismissItem: removes item from list
 * - clearCompleted: removes all complete items
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// ─── Types (imported from module under test) ──────────────────────────────────

// Will import after module exists
// import { useUniversalIngest } from './useUniversalIngest.js';

// ─── Fetch Mock Setup ─────────────────────────────────────────────────────────

const mockClassifyResponse = {
  inputType: 'article_url' as const,
  confidence: 0.95,
  suggestedPipeline: 'osint-subscribe' as const,
  metadata: { title: 'Test Article', isRss: false },
};

const mockSubmitResponse = {
  processId: 'proc-123',
  status: 'processing',
};

function setupFetchMock(overrides?: {
  classifyResponse?: object;
  submitResponse?: object;
  classifyStatus?: number;
  submitStatus?: number;
}) {
  const classifyResponse = overrides?.classifyResponse ?? mockClassifyResponse;
  const submitResponse = overrides?.submitResponse ?? mockSubmitResponse;
  const classifyStatus = overrides?.classifyStatus ?? 200;
  const submitStatus = overrides?.submitStatus ?? 200;

  return vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('classify')) {
      return Promise.resolve({
        ok: classifyStatus === 200,
        status: classifyStatus,
        json: async () => classifyResponse,
      });
    }
    return Promise.resolve({
      ok: submitStatus === 200,
      status: submitStatus,
      json: async () => submitResponse,
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('useUniversalIngest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('submitText — URL submission', () => {
    it('creates IngestItem with queued status initially, then classifying', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');

      // Fetch that resolves after we observe the intermediate state
      let resolveClassify!: (v: unknown) => void;
      const classifyPromise = new Promise((res) => { resolveClassify = res; });

      globalThis.fetch = vi.fn().mockImplementation((url: string) => {
        if (String(url).includes('classify')) {
          return classifyPromise.then(() => ({
            ok: true,
            status: 200,
            json: async () => mockClassifyResponse,
          }));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockSubmitResponse,
        });
      });

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        // Don't await — observe intermediate state
        void result.current.submitText('https://example.com');
      });

      // After submit starts, item should be in classifying state
      expect(result.current.items.length).toBe(1);
      expect(result.current.items[0].status).toBe('classifying');

      // Resolve classify and submit
      await act(async () => {
        resolveClassify(undefined);
        // Allow microtasks to settle
        await new Promise((r) => setTimeout(r, 0));
      });
    });

    it('label is truncated to 60 chars for plain text', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));
      const longText = 'a'.repeat(100);

      await act(async () => {
        await result.current.submitText(longText);
      });

      const item = result.current.items[0];
      expect(item).toBeDefined();
      expect(item.label.length).toBeLessThanOrEqual(60);
    });

    it('label is the URL itself for URL input', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      expect(result.current.items[0].label).toBe('https://example.com');
    });

    it('item has createdAt ISO timestamp', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const item = result.current.items[0];
      expect(item.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('item has unique ID', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com/a');
        await result.current.submitText('https://example.com/b');
      });

      const ids = result.current.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('items list is newest first', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://first.com');
        await result.current.submitText('https://second.com');
      });

      expect(result.current.items[0].label).toBe('https://second.com');
    });

    it('item reaches processing status after classify + submit sequence', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const item = result.current.items[0];
      expect(item.status).toBe('processing');
      expect(item.processId).toBe('proc-123');
    });

    it('item has classification after classify step', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const item = result.current.items[0];
      expect(item.classification).toBeDefined();
      expect(item.classification?.inputType).toBe('article_url');
    });
  });

  describe('submitText — special backend statuses', () => {
    it('sets status to error and isInterviewRequired when backend returns interview_required', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock({
        submitResponse: { processId: null, status: 'interview_required' },
      });

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      expect(result.current.isInterviewRequired).toBe(true);
      expect(result.current.items[0].status).toBe('error');
      expect(result.current.items[0].error).toContain('interview');
    });

    it('sets status to error with "Already ingested" for duplicate', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock({
        submitResponse: { processId: null, status: 'duplicate' },
      });

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      expect(result.current.items[0].status).toBe('error');
      expect(result.current.items[0].error).toContain('Already ingested');
    });
  });

  describe('submitText — error handling', () => {
    it('sets item status to error when fetch throws', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      expect(result.current.items[0].status).toBe('error');
      expect(result.current.items[0].error).toBeDefined();
    });

    it('sets item status to error when classify returns 500', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock({ classifyStatus: 500 });

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      expect(result.current.items[0].status).toBe('error');
    });
  });

  describe('submitFiles', () => {
    function makeFile(name: string, type = 'application/pdf'): File {
      return new File(['content'], name, { type });
    }

    it('creates one IngestItem per file with file name as label', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitFiles([makeFile('doc1.pdf'), makeFile('doc2.pdf')]);
      });

      expect(result.current.items.length).toBe(2);
      const labels = result.current.items.map((i) => i.label);
      expect(labels).toContain('doc1.pdf');
      expect(labels).toContain('doc2.pdf');
    });

    it('uses Promise.allSettled — one file error does not affect other files', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');

      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First file submit fails
          return Promise.reject(new Error('Upload failed'));
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => mockSubmitResponse,
        });
      });

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitFiles([makeFile('bad.pdf'), makeFile('good.pdf')]);
      });

      expect(result.current.items.length).toBe(2);
      const statuses = result.current.items.map((i) => i.status);
      // One should be error, one should be processing (order may vary)
      expect(statuses).toContain('error');
      expect(statuses).toContain('processing');
    });
  });

  describe('handleSSEEvent', () => {
    it('classify:result updates matching item with classification', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const processId = result.current.items[0].processId!;

      act(() => {
        result.current.handleSSEEvent('classify:result', {
          processId,
          classification: {
            inputType: 'rss_url',
            confidence: 0.9,
            suggestedPipeline: 'osint-subscribe',
            metadata: { isRss: true },
          },
        });
      });

      expect(result.current.items[0].classification?.inputType).toBe('rss_url');
    });

    it('route:selected transitions item status to processing', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const processId = result.current.items[0].processId!;

      act(() => {
        result.current.handleSSEEvent('route:selected', { processId });
      });

      expect(result.current.items[0].status).toBe('processing');
    });

    it('route:error transitions item status to error with message', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const processId = result.current.items[0].processId!;

      act(() => {
        result.current.handleSSEEvent('route:error', {
          processId,
          error: 'No pipeline matched',
        });
      });

      expect(result.current.items[0].status).toBe('error');
      expect(result.current.items[0].error).toBe('No pipeline matched');
    });

    it('processing:complete transitions item status to complete with progress 1', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const processId = result.current.items[0].processId!;

      act(() => {
        result.current.handleSSEEvent('processing:complete', { processId });
      });

      expect(result.current.items[0].status).toBe('complete');
      expect(result.current.items[0].progress).toBe(1);
    });

    it('processing:error transitions item status to error', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const processId = result.current.items[0].processId!;

      act(() => {
        result.current.handleSSEEvent('processing:error', {
          processId,
          error: 'Processing failed',
        });
      });

      expect(result.current.items[0].status).toBe('error');
    });

    it('ignores unknown processId gracefully', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      // Should not throw
      act(() => {
        result.current.handleSSEEvent('processing:complete', { processId: 'unknown-id' });
      });

      expect(result.current.items.length).toBe(1);
    });
  });

  describe('retryItem', () => {
    it('increments retryCount and resets status to queued', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      expect(result.current.items[0].status).toBe('error');
      const itemId = result.current.items[0].id;

      // Set up successful fetch for retry
      globalThis.fetch = setupFetchMock();

      await act(async () => {
        await result.current.retryItem(itemId);
      });

      const item = result.current.items.find((i) => i.id === itemId);
      expect(item).toBeDefined();
      expect(item!.retryCount).toBeGreaterThan(0);
    });
  });

  describe('dismissItem', () => {
    it('removes item from the items list', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com');
      });

      const itemId = result.current.items[0].id;
      expect(result.current.items.length).toBe(1);

      act(() => {
        result.current.dismissItem(itemId);
      });

      expect(result.current.items.length).toBe(0);
    });
  });

  describe('clearCompleted', () => {
    it('removes all items with status complete', async () => {
      const { useUniversalIngest } = await import('./useUniversalIngest.js');
      globalThis.fetch = setupFetchMock();

      const { result } = renderHook(() => useUniversalIngest('ps-1'));

      await act(async () => {
        await result.current.submitText('https://example.com/1');
        await result.current.submitText('https://example.com/2');
      });

      // Mark first item complete via SSE
      const match1 = result.current.items.find(
        (i) => i.label === 'https://example.com/1',
      );
      const processId1 = match1?.processId ?? '';

      act(() => {
        result.current.handleSSEEvent('processing:complete', { processId: processId1 });
      });

      expect(result.current.items.filter((i) => i.status === 'complete').length).toBe(1);

      act(() => {
        result.current.clearCompleted();
      });

      expect(result.current.items.filter((i) => i.status === 'complete').length).toBe(0);
      // Non-complete items remain
      expect(result.current.items.length).toBe(1);
    });
  });
});
