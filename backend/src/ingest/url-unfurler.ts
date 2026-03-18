/**
 * Universal Intelligence Input — URL Unfurler
 *
 * Phase 50 Plan 01 Task 2
 * Fetches URL metadata and detects whether it's an RSS feed, article, or PDF.
 * This file is fully implemented in Task 2; the stub below is replaced there.
 */
import type { UnfurlResult } from './types.js';
import RSSParser from 'rss-parser';
import { JSDOM } from 'jsdom';

const rssParser = new RSSParser();

/**
 * Fetch a URL and return structured metadata about its content type.
 * Never throws — always returns an UnfurlResult (type:'unknown' on error).
 */
export async function unfurlUrl(url: string): Promise<UnfurlResult> {
  // ── Step 1: HEAD request (5 s timeout) ─────────────────────────────────
  let headRes: Response;
  try {
    headRes = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
      redirect: 'follow',
    });
  } catch {
    return { type: 'unknown', url };
  }

  const contentType = headRes.headers.get('content-type') ?? '';
  const finalUrl = headRes.url || url;

  // ── Step 2: Content-Type based detection ────────────────────────────────
  if (contentType.includes('application/rss+xml') || contentType.includes('application/atom+xml')) {
    return { type: 'rss', url: finalUrl };
  }

  if (contentType.includes('application/pdf')) {
    return { type: 'pdf_url', url: finalUrl };
  }

  // ── Step 3: HTML body inspection ────────────────────────────────────────
  if (contentType.includes('text/html')) {
    let body: string;
    try {
      const getRes = await fetch(finalUrl, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
      });
      body = await getRes.text();
    } catch {
      return { type: 'unknown', url: finalUrl };
    }

    const dom = new JSDOM(body);
    const doc = dom.window.document;

    // 3a. RSS autodiscovery via <link> tag
    const rssLink = doc.querySelector(
      'link[type="application/rss+xml"], link[type="application/atom+xml"]',
    );
    if (rssLink) {
      const feedHref = rssLink.getAttribute('href') ?? '';
      const feedUrl = feedHref.startsWith('http')
        ? feedHref
        : new URL(feedHref, finalUrl).toString();
      return { type: 'rss', url: feedUrl, discoveredFrom: url };
    }

    // 3b. Try parsing directly as RSS (some feeds serve text/html)
    try {
      const feed = await rssParser.parseURL(finalUrl);
      if (feed.items && feed.items.length > 0) {
        return { type: 'rss', url: finalUrl };
      }
    } catch {
      // Not an RSS feed
    }

    // 3c. Extract article metadata
    const ogTitle =
      doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ??
      doc.querySelector('title')?.textContent ??
      undefined;
    const ogDescription =
      doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ?? undefined;

    return {
      type: 'article',
      url: finalUrl,
      title: ogTitle ?? undefined,
      description: ogDescription ?? undefined,
      htmlBody: body,
    };
  }

  // ── Step 4: Fallback ────────────────────────────────────────────────────
  return { type: 'unknown', url: finalUrl };
}
