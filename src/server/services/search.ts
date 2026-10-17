export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * High-speed, zero-cost real-time web search service for Cortex AI.
 * Fetches live search results, extracts titles, URLs, and snippets.
 */
export async function performWebSearch(query: string, maxResults: number = 5): Promise<SearchResult[]> {
  try {
    const cleanQuery = query.replace(/^\[Web Search\]\s*/i, '').trim();
    if (!cleanQuery) return [];

    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(cleanQuery)}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];

    const titleRegex = /<h2 class="result__title">[\s\S]*?<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

    const titles: Array<{ title: string; url: string }> = [];
    let tMatch: RegExpExecArray | null;
    while ((tMatch = titleRegex.exec(html)) !== null && titles.length < maxResults) {
      let rawUrl = tMatch[1];
      let realUrl = rawUrl;
      if (rawUrl.includes('uddg=')) {
        try {
          realUrl = decodeURIComponent(rawUrl.split('uddg=')[1].split('&')[0]);
        } catch {
          realUrl = rawUrl;
        }
      }
      const title = tMatch[2]
        .replace(/<[^>]+>/g, '')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
      titles.push({ title, url: realUrl });
    }

    const snippets: string[] = [];
    let sMatch: RegExpExecArray | null;
    while ((sMatch = snippetRegex.exec(html)) !== null && snippets.length < maxResults) {
      const snippet = sMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .trim();
      snippets.push(snippet);
    }

    for (let i = 0; i < titles.length; i++) {
      results.push({
        title: titles[i].title,
        url: titles[i].url,
        snippet: snippets[i] || '',
      });
    }

    return results;
  } catch (err) {
    console.warn('[Cortex Search] Web search lookup failed:', err);
    return [];
  }
}

/**
 * Formats search results into an augmented prompt injection with clean citations.
 */
export function formatSearchAugmentation(results: SearchResult[]): string {
  if (results.length === 0) return '';

  const formattedSources = results
    .map((r, i) => `[${i + 1}] "${r.title}"\nURL: ${r.url}\nSummary: ${r.snippet}`)
    .join('\n\n');

  return `\n\n---\n[LIVE WEB SEARCH RESULTS - CURRENT AND VERIFIED]:\n${formattedSources}\n\nInstructions: Synthesize the answer accurately using these verified search results. Include numerical inline markdown links [1](url), [2](url) to cite these sources directly in your response.\n---`;
}
