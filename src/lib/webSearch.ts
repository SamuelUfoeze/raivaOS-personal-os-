import { loadSettings } from "./settings";

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
}

/**
 * Search the web using DuckDuckGo's free API (no key required).
 * Used as a fallback when the primary search API is unavailable.
 */
async function searchDuckDuckGo(query: string): Promise<WebSearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`DuckDuckGo returned ${resp.status}`);
    const data = await resp.json();

    const results: WebSearchResult[] = [];

    // Abstract (featured snippet)
    if (data.AbstractText) {
      results.push({
        title: data.Heading || "DuckDuckGo Answer",
        url: data.AbstractURL || "",
        snippet: data.AbstractText.slice(0, 500),
        source: "duckduckgo",
      });
    }

    // Related topics
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 5)) {
        if (topic.Text) {
          results.push({
            title: topic.Text.split(" - ")[0] || topic.Text,
            url: topic.FirstURL || "",
            snippet: topic.Text.slice(0, 500),
            source: "duckduckgo",
          });
        }
        // Nested topics
        if (topic.Topics) {
          for (const sub of topic.Topics.slice(0, 3)) {
            if (sub.Text) {
              results.push({
                title: sub.Text.split(" - ")[0] || sub.Text,
                url: sub.FirstURL || "",
                snippet: sub.Text.slice(0, 500),
                source: "duckduckgo",
              });
            }
          }
        }
      }
    }

    return results;
  } catch (err) {
    console.warn("DuckDuckGo API failed:", err);
    return [];
  }
}

/**
 * Fallback: search using a public web search API (serpapi, google custom search, etc.)
 * This is a placeholder that can be configured with an API key in settings.
 */
async function searchFallback(query: string): Promise<WebSearchResult[]> {
  // Try multiple free sources
  const results: WebSearchResult[] = [];

  // Try Wikipedia API
  try {
    const wikiUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.split(" ").join("_"))}`;
    const wikiResp = await fetch(wikiUrl);
    if (wikiResp.ok) {
      const wikiData = await wikiResp.json();
      if (wikiData.extract) {
        results.push({
          title: wikiData.title,
          url: `https://en.wikipedia.org/wiki/${encodeURIComponent(wikiData.title.replace(/ /g, "_"))}`,
          snippet: wikiData.extract.slice(0, 500),
          source: "wikipedia",
        });
      }
    }
  } catch { /* ignore */ }

  return results;
}

/**
 * Main web search function. Uses DuckDuckGo API primarily,
 * falls back to other free APIs.
 */
export async function searchWeb(query: string): Promise<WebSearchResult[]> {
  const settings = loadSettings();

  if (settings.webSearch === "never") {
    return [];
  }

  let results = await searchDuckDuckGo(query);

  // If DuckDuckGo returned nothing, try fallback
  if (results.length === 0) {
    results = await searchFallback(query);
  }

  return results.slice(0, 5);
}

/**
 * Check if web search is allowed based on current settings.
 * Returns { allowed: true } or { allowed: false, reason: string }
 */
export function checkWebSearchAllowed(): { allowed: boolean; reason?: string } {
  const settings = loadSettings();
  if (settings.webSearch === "never") {
    return { allowed: false, reason: "Web search is disabled in settings." };
  }
  return { allowed: true };
}

/**
 * Format search results for AI context injection.
 */
export function formatSearchResults(results: WebSearchResult[]): string {
  if (results.length === 0) return "";
  let ctx = "\n--- WEB SEARCH RESULTS ---\n";
  for (const r of results) {
    ctx += `• ${r.title}${r.url ? ` (${r.url})` : ""}\n`;
    ctx += `  ${r.snippet.slice(0, 300)}\n\n`;
  }
  return ctx.trim();
}
