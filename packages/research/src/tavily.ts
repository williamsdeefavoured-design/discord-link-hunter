import { ProviderSearchResult, SearchProvider, SearchProviderOptions } from './types.js';

export class TavilyAdapter implements SearchProvider {
  name: 'tavily' = 'tavily';
  private apiKey: string;
  private dailyCap: number;
  private requestCount = 0;
  private fetchFn: typeof fetch;

  constructor(apiKey: string, dailyCap = 50, fetchFn: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.dailyCap = dailyCap;
    this.fetchFn = fetchFn;
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey) && this.requestCount < this.dailyCap;
  }

  getDailyRequestCount(): number {
    return this.requestCount;
  }

  async search(query: string, options: SearchProviderOptions = {}): Promise<ProviderSearchResult> {
    if (!this.apiKey) {
      throw new Error('Tavily API key is not configured');
    }

    if (this.requestCount >= this.dailyCap) {
      throw new Error(`Tavily daily cap reached (${this.dailyCap} requests)`);
    }

    this.requestCount++;
    const start = Date.now();
    const limit = Math.min(options.limit || 10, 20);

    try {
      const res = await this.fetchFn('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth: (options.depth || 1) > 1 ? 'advanced' : 'basic',
          include_answer: false,
          max_results: limit,
        }),
      });

      const statusCode = res.status;
      const durationMs = Date.now() - start;

      let retryAfterSeconds: number | undefined;
      const retryHeader = res.headers?.get ? res.headers.get('retry-after') : undefined;
      if (retryHeader) {
        const parsed = parseInt(retryHeader, 10);
        if (!isNaN(parsed)) {
          retryAfterSeconds = parsed;
        }
      }

      if (statusCode === 401 || statusCode === 403) {
        return {
          provider: 'tavily',
          query,
          items: [],
          statusCode,
          durationMs,
          error: `Tavily authentication failure (${statusCode}): invalid or forbidden credentials`,
          isPermanentError: true,
        };
      }

      if (statusCode === 429) {
        return {
          provider: 'tavily',
          query,
          items: [],
          statusCode: 429,
          durationMs,
          error: `Tavily rate limit exceeded (429)${retryAfterSeconds ? ` - retry after ${retryAfterSeconds}s` : ''}`,
          retryAfterSeconds,
        };
      }

      if (!res.ok) {
        return {
          provider: 'tavily',
          query,
          items: [],
          statusCode,
          durationMs,
          error: `Tavily HTTP error ${statusCode}`,
        };
      }

      const data = (await res.json()) as any;
      const results = Array.isArray(data.results) ? data.results : [];

      const items = results.map((item: any) => ({
        title: String(item.title || ''),
        url: String(item.url || ''),
        snippet: String(item.content || ''),
        date: item.published_date ? String(item.published_date) : undefined,
      }));

      return {
        provider: 'tavily',
        query,
        items,
        creditCost: (options.depth || 1) > 1 ? 2 : 1,
        statusCode: 200,
        durationMs,
      };
    } catch (err: any) {
      return {
        provider: 'tavily',
        query,
        items: [],
        statusCode: 500,
        durationMs: Date.now() - start,
        error: `Tavily network error: ${err.message || 'unknown'}`,
      };
    }
  }
}

