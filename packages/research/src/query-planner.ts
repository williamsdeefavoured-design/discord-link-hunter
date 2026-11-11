import { getSynonymsForTopic, LanguageCode, SearchJobParams, TradingTopic } from '@discord-link-hunter/core';
import { QueryPlanItem } from './types.js';

export class QueryPlanner {
  private maxQueries: number;

  constructor(maxQueries = 12) {
    this.maxQueries = maxQueries;
  }

  generatePlan(params: SearchJobParams): QueryPlanItem[] {
    const planned: QueryPlanItem[] = [];
    const seenQueries = new Set<string>();

    const topics = params.topics.length > 0 ? params.topics : (['forex', 'xauusd'] as TradingTopic[]);
    const languages = params.languages.length > 0 ? params.languages : (['en'] as LanguageCode[]);

    // Discord search operators
    const discordSuffixes = ['"discord.gg/"', '"discord.com/invite/"'];

    for (const lang of languages) {
      for (const topic of topics) {
        const synonyms = getSynonymsForTopic(topic, lang);
        // Take top 2 synonyms per topic to maintain strict budget
        const topSynonyms = synonyms.slice(0, 2);

        for (const synonym of topSynonyms) {
          for (const suffix of discordSuffixes) {
            if (planned.length >= this.maxQueries) break;

            const query = `${synonym} ${suffix}`;
            if (!seenQueries.has(query)) {
              seenQueries.add(query);
              planned.push({
                query,
                topic,
                language: lang,
                priority: planned.length + 1,
              });
            }
          }
          if (planned.length >= this.maxQueries) break;
        }
        if (planned.length >= this.maxQueries) break;
      }
      if (planned.length >= this.maxQueries) break;
    }

    return planned;
  }
}

