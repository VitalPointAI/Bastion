/**
 * URL Unfurler Tests
 *
 * Phase 50 Plan 01 — Task 2 TDD
 * Tests unfurlUrl() for all detection paths.
 * All network calls are mocked; no real HTTP is made.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock rss-parser before importing unfurler
vi.mock('rss-parser', () => {
  function RSSParser(this: { parseURL: ReturnType<typeof vi.fn> }) {
    this.parseURL = vi.fn().mockRejectedValue(new Error('Not RSS'));
  }
  return { default: RSSParser };
});

// Mock jsdom — will be configured per-test via setupJsdom()
let _jsdomImpl: (html: string) => { window: { document: unknown } } = () => ({
  window: { document: { querySelector: () => null } },
});

vi.mock('jsdom', () => {
  function JSDOM(this: { window: unknown }, html: string) {
    const result = _jsdomImpl(html);
    this.window = result.window;
  }
  return { JSDOM };
});

// We'll mock global fetch per test
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { unfurlUrl } from './url-unfurler.js';
import RSSParser from 'rss-parser';

const MockedRSSParser = vi.mocked(RSSParser);

/** Build a minimal mock Response for fetch */
function buildHeadResponse(contentType: string, finalUrl?: string): Response {
  return {
    ok: true,
    url: finalUrl ?? 'https://example.com',
    headers: {
      get: (name: string) => (name === 'content-type' ? contentType : null),
    },
    text: vi.fn(),
  } as unknown as Response;
}

function buildGetResponse(body: string, finalUrl?: string): Response {
  return {
    ok: true,
    url: finalUrl ?? 'https://example.com',
    headers: {
      get: () => null,
    },
    text: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

/** Helper to set up JSDOM mock with a given querySelector implementation */
function setupJsdom(querySelectorFn: (sel: string) => Element | null, _titleText = '') {
  _jsdomImpl = (_html: string) => ({
    window: {
      document: {
        querySelector: querySelectorFn,
      },
    },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('fetch', mockFetch);
});

// ─── RSS via Content-Type ──────────────────────────────────────────────────

describe('unfurlUrl — RSS via Content-Type', () => {
  it('returns type:rss when HEAD returns application/rss+xml', async () => {
    mockFetch.mockResolvedValueOnce(buildHeadResponse('application/rss+xml'));

    const result = await unfurlUrl('https://example.com/feed.xml');
    expect(result.type).toBe('rss');
    expect(result.url).toBe('https://example.com');
  });

  it('returns type:rss when HEAD returns application/atom+xml', async () => {
    mockFetch.mockResolvedValueOnce(buildHeadResponse('application/atom+xml'));

    const result = await unfurlUrl('https://example.com/atom.xml');
    expect(result.type).toBe('rss');
  });
});

// ─── PDF via Content-Type ─────────────────────────────────────────────────

describe('unfurlUrl — PDF via Content-Type', () => {
  it('returns type:pdf_url when HEAD returns application/pdf', async () => {
    mockFetch.mockResolvedValueOnce(buildHeadResponse('application/pdf'));

    const result = await unfurlUrl('https://example.com/doc.pdf');
    expect(result.type).toBe('pdf_url');
    expect(result.url).toBe('https://example.com');
  });
});

// ─── HTML with RSS autodiscovery ──────────────────────────────────────────

describe('unfurlUrl — HTML with RSS autodiscovery', () => {
  it('returns type:rss with discoveredFrom when RSS link tag found', async () => {
    mockFetch
      .mockResolvedValueOnce(buildHeadResponse('text/html', 'https://example.com/'))
      .mockResolvedValueOnce(
        buildGetResponse(
          '<html><head><link type="application/rss+xml" href="https://example.com/feed.xml"/></head></html>',
          'https://example.com/',
        ),
      );

    setupJsdom((sel: string) => {
      if (
        sel === 'link[type="application/rss+xml"], link[type="application/atom+xml"]'
      ) {
        return {
          getAttribute: (attr: string) =>
            attr === 'href' ? 'https://example.com/feed.xml' : null,
        } as unknown as Element;
      }
      return null;
    });

    const result = await unfurlUrl('https://example.com/');
    expect(result.type).toBe('rss');
    expect(result.url).toBe('https://example.com/feed.xml');
    expect(result.discoveredFrom).toBe('https://example.com/');
  });
});

// ─── HTML article with OG metadata ────────────────────────────────────────

describe('unfurlUrl — HTML article', () => {
  it('returns type:article with title and description from OG tags', async () => {
    mockFetch
      .mockResolvedValueOnce(buildHeadResponse('text/html', 'https://example.com/article'))
      .mockResolvedValueOnce(
        buildGetResponse(
          '<html><head><meta property="og:title" content="Strategy Article"/><meta property="og:description" content="Deep analysis"/></head></html>',
          'https://example.com/article',
        ),
      );

    setupJsdom((sel: string): Element | null => {
      if (sel === 'link[type="application/rss+xml"], link[type="application/atom+xml"]') return null;
      if (sel === 'meta[property="og:title"]') {
        return { getAttribute: (a: string) => (a === 'content' ? 'Strategy Article' : null) } as unknown as Element;
      }
      if (sel === 'meta[property="og:description"]') {
        return { getAttribute: (a: string) => (a === 'content' ? 'Deep analysis' : null) } as unknown as Element;
      }
      if (sel === 'title') return null;
      return null;
    });

    // Ensure rssParser.parseURL throws (not RSS)
    const rssInstance = new (MockedRSSParser as unknown as new () => { parseURL: ReturnType<typeof vi.fn> })();
    rssInstance.parseURL.mockRejectedValue(new Error('not rss'));

    const result = await unfurlUrl('https://example.com/article');
    expect(result.type).toBe('article');
    expect(result.title).toBe('Strategy Article');
    expect(result.description).toBe('Deep analysis');
  });
});

// ─── Timeout and error handling ───────────────────────────────────────────

describe('unfurlUrl — error handling', () => {
  it('returns type:unknown when HEAD times out', async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }),
    );

    const result = await unfurlUrl('https://slow.example.com');
    expect(result.type).toBe('unknown');
    expect(result.url).toBe('https://slow.example.com');
  });

  it('returns type:unknown on network error without throwing', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network connection refused'));

    const result = await unfurlUrl('https://unreachable.example.com');
    expect(result.type).toBe('unknown');
    expect(() => result).not.toThrow();
  });
});
