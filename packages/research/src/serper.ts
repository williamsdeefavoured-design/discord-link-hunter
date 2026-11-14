import { ProviderSearchResult, SearchProvider, SearchProviderOptions } from './types.js';

export class SerperAdapter implements SearchProvider {
  name: 'serper' = 'serper';
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
      throw new Error('Serper API key is not configured');
    }

    if (this.requestCount >= this.dailyCap) {
      throw new Error(`Serper daily cap reached (${this.dailyCap} requests)`);
    }

    this.requestCount++;
    const start = Date.now();
    // The community result limit is NOT Serper's per-query Google page size.
    const limit = Math.max(1, Math.min(options.limit || 10, 10));

    const langMap: Record<string, { gl: string; hl: string }> = {
      en: { gl: 'us', hl: 'en' },
      de: { gl: 'de', hl: 'de' },
      es: { gl: 'es', hl: 'es' },
      pt: { gl: 'br', hl: 'pt' },
      fr: { gl: 'fr', hl: 'fr' },
      ar: { gl: 'sa', hl: 'ar' },
    };

    const locale = (options.language && langMap[options.language]) || { gl: 'us', hl: 'en' };

    try {
      const res = await this.fetchFn('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          gl: locale.gl,
          hl: locale.hl,
          num: limit,
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
          provider: 'serper',
          query,
          items: [],
          statusCode,
          durationMs,
          error: `Serper authentication failure (${statusCode}): invalid or forbidden credentials`,
          isPermanentError: true,
        };
      }

      if (statusCode === 429) {
        return {
          provider: 'serper',
          query,
          items: [],
          statusCode: 429,
          durationMs,
          error: `Serper rate limit exceeded (429)${retryAfterSeconds ? ` - retry after ${retryAfterSeconds}s` : ''}`,
          retryAfterSeconds,
        };
      }

      if (!res.ok) {
        let reason = '';
        try {
          const body = typeof res.text === 'function' ? await res.text() : '';
          const payload = JSON.parse(body);
          const value = payload?.message ?? payload?.error;
          reason = typeof value === 'string' ? value.slice(0, 180) : '';
        } catch {
          // Provider error body may be unavailable.
        }
        return {
          provider: 'serper',
          query,
          items: [],
          statusCode,
          durationMs,
          error: `Serper HTTP error ${statusCode}${reason ? `: ${reason}` : ''}`,
        };
      }

      const data = (await res.json()) as any;
      const organic = Array.isArray(data.organic) ? data.organic : [];

      const items = organic.map((item: any) => ({
        title: String(item.title || ''),
        url: String(item.link || ''),
        snippet: String(item.snippet || ''),
        date: item.date ? String(item.date) : undefined,
      }));

      return {
        provider: 'serper',
        query,
        items,
        creditCost: 1,
        statusCode: 200,
        durationMs,
      };
    } catch (err: any) {
      return {
        provider: 'serper',
        query,
        items: [],
        statusCode: 500,
        durationMs: Date.now() - start,
        error: `Serper network error: ${err.message || 'unknown'}`,
      };
    }
  }
}

