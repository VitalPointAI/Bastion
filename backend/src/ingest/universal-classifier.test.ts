/**
 * Universal Classifier Tests
 *
 * Phase 50 Plan 01 — TDD RED phase
 * Tests classifyInput() for all 5 content categories.
 * Network calls are mocked; no real HTTP is made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UnfurlResult } from './types.js';

// Mock url-unfurler before importing classifier
vi.mock('./url-unfurler.js', () => ({
  unfurlUrl: vi.fn(),
}));

import { classifyInput } from './universal-classifier.js';
import { unfurlUrl } from './url-unfurler.js';

const mockUnfurlUrl = vi.mocked(unfurlUrl);

beforeEach(() => {
  vi.resetAllMocks();
});

// ─── File Buffer Detection ──────────────────────────────────────────────────

describe('classifyInput — file buffers', () => {
  it('classifies a PDF buffer by MIME type hint', async () => {
    const buf = Buffer.from('%PDF-1.4 fake content');
    const result = await classifyInput(buf, { mimeType: 'application/pdf' });
    expect(result.inputType).toBe('file');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies a Word docx buffer by MIME type hint', async () => {
    const buf = Buffer.from('PK fake docx content');
    const result = await classifyInput(buf, {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
    expect(result.inputType).toBe('file');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies a plain text buffer by MIME type hint', async () => {
    const buf = Buffer.from('Some plain text content');
    const result = await classifyInput(buf, { mimeType: 'text/plain' });
    expect(result.inputType).toBe('file');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies a buffer with no MIME hint as file with lower confidence', async () => {
    const buf = Buffer.from('unknown binary data');
    const result = await classifyInput(buf);
    expect(result.inputType).toBe('file');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
  });

  it('stores the contentType metadata when mimeType hint is provided', async () => {
    const buf = Buffer.from('pdf bytes');
    const result = await classifyInput(buf, { mimeType: 'application/pdf' });
    expect(result.metadata.contentType).toBe('application/pdf');
  });
});

// ─── URL Detection ──────────────────────────────────────────────────────────

describe('classifyInput — URLs', () => {
  it('classifies an RSS URL via unfurlUrl result', async () => {
    const mockResult: UnfurlResult = {
      type: 'rss',
      url: 'https://example.com/feed.xml',
    };
    mockUnfurlUrl.mockResolvedValue(mockResult);

    const result = await classifyInput('https://example.com/feed.xml');
    expect(result.inputType).toBe('rss_url');
    expect(result.suggestedPipeline).toBe('osint-subscribe');
    expect(unfurlUrl).toHaveBeenCalledWith('https://example.com/feed.xml');
  });

  it('classifies an article URL via unfurlUrl result', async () => {
    const mockResult: UnfurlResult = {
      type: 'article',
      url: 'https://example.com/article',
      title: 'Test Article',
      description: 'An article about strategy',
    };
    mockUnfurlUrl.mockResolvedValue(mockResult);

    const result = await classifyInput('https://example.com/article');
    expect(result.inputType).toBe('article_url');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
    expect(result.metadata.title).toBe('Test Article');
  });

  it('classifies a PDF URL via unfurlUrl result', async () => {
    const mockResult: UnfurlResult = {
      type: 'pdf_url',
      url: 'https://example.com/doc.pdf',
    };
    mockUnfurlUrl.mockResolvedValue(mockResult);

    const result = await classifyInput('https://example.com/doc.pdf');
    expect(result.inputType).toBe('pdf_url');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
  });

  it('classifies an unknown URL as api_url', async () => {
    const mockResult: UnfurlResult = {
      type: 'unknown',
      url: 'https://api.example.com/data',
    };
    mockUnfurlUrl.mockResolvedValue(mockResult);

    const result = await classifyInput('https://api.example.com/data');
    expect(result.inputType).toBe('api_url');
    expect(result.suggestedPipeline).toBe('manual');
  });

  it('recognises URLs with leading whitespace', async () => {
    const mockResult: UnfurlResult = { type: 'article', url: 'https://example.com' };
    mockUnfurlUrl.mockResolvedValue(mockResult);
    const result = await classifyInput('  https://example.com  ');
    expect(result.inputType).toBe('article_url');
  });
});

// ─── JSON Detection ─────────────────────────────────────────────────────────

describe('classifyInput — JSON', () => {
  it('classifies a valid JSON object string', async () => {
    const result = await classifyInput('{"key":"value","num":42}');
    expect(result.inputType).toBe('json_data');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('classifies a valid JSON array string', async () => {
    const result = await classifyInput('[1,2,3]');
    expect(result.inputType).toBe('json_data');
    expect(result.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('does NOT classify invalid JSON as json_data', async () => {
    const result = await classifyInput('{not valid json');
    expect(result.inputType).not.toBe('json_data');
  });
});

// ─── XML Detection ─────────────────────────────────────────────────────────

describe('classifyInput — XML', () => {
  it('classifies content with XML declaration', async () => {
    const result = await classifyInput('<?xml version="1.0"?><root/>');
    expect(result.inputType).toBe('xml_data');
    expect(result.suggestedPipeline).toBe('doc-intelligence');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('classifies content starting with a tag-like pattern', async () => {
    const result = await classifyInput('<Document><Title>Test</Title></Document>');
    expect(result.inputType).toBe('xml_data');
  });
});

// ─── Raw Text Fallback ──────────────────────────────────────────────────────

describe('classifyInput — raw text fallback', () => {
  it('classifies plain English text as raw_text', async () => {
    const result = await classifyInput('Some plain text about strategy');
    expect(result.inputType).toBe('raw_text');
    expect(result.suggestedPipeline).toBe('text-ingest');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
  });

  it('classifies non-URL, non-JSON, non-XML strings as raw_text', async () => {
    const result = await classifyInput('not a url, not json, not xml');
    expect(result.inputType).toBe('raw_text');
  });

  it('classifies multi-line text as raw_text', async () => {
    const text = 'Line one about operational planning.\nLine two about logistics.';
    const result = await classifyInput(text);
    expect(result.inputType).toBe('raw_text');
  });
});
