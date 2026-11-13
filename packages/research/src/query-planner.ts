import {
  getDefaultSourceRegistry,
  getSynonymsForTopic,
  LanguageCode,
  ResearchSourceConfig,
  SearchJobParams,
  SourceRegistry,
  TradingTopic,
} from '@discord-link-hunter/core';
import { QueryPlanItem } from './types.js';

interface PlannedSourceTarget {
  operator: string | null;
  platform: string;
}

export class QueryPlanner {
  private maxQueries: number;
  private sourceRegistry: SourceRegistry;

  constructor(maxQueries = 12, sourceRegistry?: SourceRegistry) {
    this.maxQueries = maxQueries;
    this.sourceRegistry = sourceRegistry || getDefaultSourceRegistry();
  }

  generatePlan(params: SearchJobParams): QueryPlanItem[] {
    const planned: QueryPlanItem[] = [];
    const seenQueries = new Set<string>();

    const topics = params.topics.length > 0 ? params.topics : (['forex', 'xauusd'] as TradingTopic[]);
    const languages = params.languages.length > 0 ? params.languages : (['en'] as LanguageCode[]);
    const targetPlatforms =
      params.targetPlatforms && params.targetPlatforms.length > 0 ? params.targetPlatforms : undefined;

    // Get active sources to consider
    const activeSources = this.sourceRegistry.getActiveSources(targetPlatforms);

    // Build planned source targets based on budget and platform selection
    const targetsToUse: PlannedSourceTarget[] = [];

    if (targetPlatforms) {
      // User explicitly requested specific platforms
      for (const src of activeSources) {
        targetsToUse.push({
          operator: src.searchOperatorTemplate,
          platform: src.id,
        });
      }
    } else if (this.maxQueries >= activeSources.length + 1) {
      // Full budget mode (>= 11 queries): Generate dedicated individual query per platform
      targetsToUse.push({ operator: null, platform: 'general_web' });
      for (const src of activeSources) {
        targetsToUse.push({
          operator: src.searchOperatorTemplate,
          platform: src.id,
        });
      }
    } else {
      // Compact budget mode (< 11 queries, e.g. 4 queries):
      // Group the 10 platforms into compound queries using site: OR operators so that
      // all 10 platform categories receive search coverage without exceeding the budget.
      targetsToUse.push({ operator: null, platform: 'general_web' });
      targetsToUse.push({
        operator: '(site:reddit.com OR site:x.com OR site:twitter.com)',
        platform: 'reddit,x_twitter',
      });
      targetsToUse.push({
        operator: '(site:tradingview.com OR site:stocktwits.com OR site:forexfactory.com OR site:babypips.com)',
        platform: 'tradingview,stocktwits,trading_forums',
      });
      targetsToUse.push({
        operator:
          '(site:substack.com OR site:patreon.com OR site:medium.com OR site:quora.com OR site:wordpress.com)',
        platform: 'substack,patreon,medium,quora,trading_blogs',
      });
    }

    // Distribute queries across languages, topics, and source targets
    for (const lang of languages) {
      for (const topic of topics) {
        const synonyms = getSynonymsForTopic(topic, lang);
        // Use up to 4 synonyms per topic
        const topSynonyms = synonyms.slice(0, 4);

        for (const synonym of topSynonyms) {
          for (const target of targetsToUse) {
            if (planned.length >= this.maxQueries) break;

            const query =
              target.operator === null
                ? `"${synonym}" "discord.gg/"`
                : `${target.operator} "${synonym}" "discord.gg/"`;

            if (!seenQueries.has(query)) {
              seenQueries.add(query);
              planned.push({
                query,
                topic,
                language: lang,
                priority: planned.length + 1,
                platform: target.platform,
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
