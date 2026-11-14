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

    // Distribute across targets and synonyms without spending the entire query
    // budget on the first phrase. Native terms + widely-used market terminology
    // improve recall for mixed-language trading communities.
    const globalTopicTerm: Partial<Record<TradingTopic, string>> = {
      forex: 'forex', xauusd: 'xauusd', stocks: 'stocks', crypto: 'crypto',
      futures: 'futures', options: 'options', indices: 'indices',
      day_trading: 'day trading', swing_trading: 'swing trading',
      investing: 'investing', technical_analysis: 'technical analysis',
      education: 'trading education',
    };

    for (const lang of languages) {
      for (const topic of topics) {
        const localized = getSynonymsForTopic(topic, lang);
        const variants = Array.from(new Set([
          localized[0], globalTopicTerm[topic], ...localized.slice(1, 4),
        ].filter((value): value is string => Boolean(value))));

        // Each pass visits EVERY source category, with a different search term.
        // A 4-query job therefore covers all 4 broad source groups and no more.
        for (let round = 0; round < variants.length; round++) {
          for (let targetIndex = 0; targetIndex < targetsToUse.length; targetIndex++) {
            if (planned.length >= this.maxQueries) return planned;
            const target = targetsToUse[targetIndex];
            const synonym = variants[(round + targetIndex) % variants.length];
            // Public posts often say "Discord" without printing the invite in
            // indexed text; don't require "discord.gg/" for every platform.
            const discordTerm = target.operator === null || targetIndex === 1
              ? '"discord.gg/"'
              : '"discord"';
            const query = target.operator === null
              ? `"${synonym}" ${discordTerm}`
              : `${target.operator} "${synonym}" ${discordTerm}`;
            if (seenQueries.has(query)) continue;
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
      }
    }

    return planned;
  }
}
