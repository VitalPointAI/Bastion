/**
 * Pluggable Web Search Provider
 *
 * Provides web search capability for the researcher specialist.
 * Uses Tavily Search API when TAVILY_API_KEY is set in environment,
 * falls back to placeholder results otherwise.
 *
 * No external dependencies -- uses Node 18+ built-in fetch.
 */

export interface WebSearchResult {
  url: string;
  title: string;
  snippet: string;
  retrievalDate: string;
}

interface TavilySearchResponse {
  results: Array<{
    url: string;
    title: string;
    content: string;
  }>;
}

let warnedNoApiKey = false;

/**
 * Perform a web search using Tavily API (if configured) or return
 * placeholder results for graceful degradation.
 */
export async function performWebSearch(
  query: string,
  maxResults: number = 5,
): Promise<WebSearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  const retrievalDate = new Date().toISOString();

  if (!apiKey) {
    if (!warnedNoApiKey) {
      console.warn(
        '[web-search] TAVILY_API_KEY not set -- returning placeholder results. ' +
        'Set the environment variable to enable real web search.',
      );
      warnedNoApiKey = true;
    }
    return [{
      url: `https://search.example.com/q=${encodeURIComponent(query)}`,
      title: `Research query: ${query}`,
      snippet: `Automated research query for: ${query}`,
      retrievalDate,
    }];
  }

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
      console.error(`[web-search] Tavily API returned ${response.status}: ${response.statusText}`);
      return [];
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
    return [];
  }
}
