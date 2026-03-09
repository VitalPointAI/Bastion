/**
 * Pluggable Web Search Provider
 *
 * Priority chain:
 * 1. SearXNG (self-hosted, set SEARXNG_URL — default http://localhost:8888)
 * 2. Tavily (paid API, set TAVILY_API_KEY)
 * 3. Placeholder fallback
 *
 * No external dependencies — uses Node 18+ built-in fetch.
 */

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  retrievalDate: string;
}

// ---------------------------------------------------------------------------
// SearXNG provider
// ---------------------------------------------------------------------------

interface SearXNGResult {
  url: string;
  title: string;
  content: string;
}

interface SearXNGResponse {
  results: SearXNGResult[];
}

async function searchSearXNG(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[] | null> {
  const baseUrl = process.env.SEARXNG_URL;
  if (!baseUrl) return null;

  const retrievalDate = new Date().toISOString();
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    categories: 'general',
    language: 'en',
    pageno: '1',
  });

  try {
    const response = await fetch(`${baseUrl}/search?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      console.error(
        `[web-search] SearXNG returned ${response.status}: ${response.statusText}`,
      );
      return null; // Fall through to next provider
    }

    const data = (await response.json()) as SearXNGResponse;

    return (data.results || []).slice(0, maxResults).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
      retrievalDate,
    }));
  } catch (error) {
    console.error('[web-search] SearXNG call failed:', error);
    return null; // Fall through to next provider
  }
}

// ---------------------------------------------------------------------------
// Tavily provider (fallback)
// ---------------------------------------------------------------------------

interface TavilySearchResponse {
  results: Array<{
    url: string;
    title: string;
    content: string;
  }>;
}

async function searchTavily(
  query: string,
  maxResults: number,
): Promise<WebSearchResult[] | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const retrievalDate = new Date().toISOString();

  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: maxResults,
        search_depth: 'basic',
      }),
    });

    if (!response.ok) {
      console.error(
        `[web-search] Tavily API returned ${response.status}: ${response.statusText}`,
      );
      return null;
    }

    const data = (await response.json()) as TavilySearchResponse;

    return (data.results || []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.content,
      retrievalDate,
    }));
  } catch (error) {
    console.error('[web-search] Tavily API call failed:', error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main entry point — provider chain
// ---------------------------------------------------------------------------

let loggedProvider = false;

/**
 * Perform a web search using the first available provider:
 * SearXNG → Tavily → placeholder.
 */
export async function performWebSearch(
  query: string,
  maxResults: number = 5,
): Promise<WebSearchResult[]> {
  // 1. Try SearXNG (self-hosted, free)
  const searxResults = await searchSearXNG(query, maxResults);
  if (searxResults !== null) {
    if (!loggedProvider) {
      console.log('[web-search] Using SearXNG provider');
      loggedProvider = true;
    }
    return searxResults;
  }

  // 2. Try Tavily (paid API)
  const tavilyResults = await searchTavily(query, maxResults);
  if (tavilyResults !== null) {
    if (!loggedProvider) {
      console.log('[web-search] Using Tavily provider');
      loggedProvider = true;
    }
    return tavilyResults;
  }

  // 3. Placeholder fallback
  if (!loggedProvider) {
    console.warn(
      '[web-search] No search provider configured. ' +
      'Set SEARXNG_URL (recommended) or TAVILY_API_KEY.',
    );
    loggedProvider = true;
  }

  const retrievalDate = new Date().toISOString();
  return [{
    url: `https://search.example.com/q=${encodeURIComponent(query)}`,
    title: `Research query: ${query}`,
    snippet: `No web search provider configured. Set SEARXNG_URL or TAVILY_API_KEY.`,
    retrievalDate,
  }];
}
