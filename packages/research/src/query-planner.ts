import {
  getDefaultSourceRegistry,
  getCountryName,
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
    const countryName = params.country && params.country !== 'all' ? getCountryName(params.country) : null;

    // Get active sources to consider
    const activeSources = this.sourceRegistry.getActiveSources(targetPlatforms);

    // Build planned source targets based on budget and platform selection
    const targetsToUse: PlannedSourceTarget[] = [];

    if (targetPlatforms && activeSources.length > this.maxQueries && this.maxQueries > 0) {
      for (let index = 0; index < this.maxQueries; index++) {
        const group = activeSources.filter((_, i) => i % this.maxQueries === index);
        targetsToUse.push({
          operator: '(' + group.map((source) => source.searchOperatorTemplate).join(' OR ') + ')',
          platform: group.map((source) => source.id).join(','),
        });
      }
    } else if (targetPlatforms) {
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
      // Group indexed sources to preserve coverage within the query budget.
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
      const directories = activeSources.filter((source) =>
        ['disboard', 'discadia', 'top_gg', 'discord_me', 'discord_discovery'].includes(source.id));
      if (directories.length) {
        targetsToUse.push({
          operator: '(' + directories.map((source) => source.searchOperatorTemplate).join(' OR ') + ')',
          platform: directories.map((source) => source.id).join(','),
        });
      }
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

    const combinations = languages.flatMap((language) => topics.map((topic) => {
      const localized = getSynonymsForTopic(topic, language);
      const variants = [...new Set([localized[0], globalTopicTerm[topic], ...localized.slice(1, 4)])]
        .filter((value): value is string => Boolean(value));
      return { language, topic, variants };
    }));
    const maxVariants = Math.max(...combinations.map(({ variants }) => variants.length));

    for (let round = 0; round < combinations.length * maxVariants; round++) {
      for (const [targetIndex, target] of targetsToUse.entries()) {
        if (planned.length >= this.maxQueries) return planned;
        const combination = combinations[(round + targetIndex) % combinations.length];
        const variantIndex = Math.floor(round / combinations.length);
        if (variantIndex >= combination.variants.length) continue;
        const synonym = combination.variants[(variantIndex + targetIndex) % combination.variants.length];
        const discordTerm = target.operator === null && round === 0
          ? '(site:discord.gg OR site:discord.com/invite)'
          : '"discord"';
        const countryTerm = countryName && (target.operator === null || round === 0 || round % 2 === 0)
          ? ['"' + countryName + '"']
          : [];
        const query = [target.operator, '"' + synonym + '"', ...countryTerm, discordTerm].filter(Boolean).join(' ');
        const key = combination.language + ':' + query;
        if (seenQueries.has(key)) continue;
        seenQueries.add(key);
        planned.push({
          query,
          topic: combination.topic,
          language: combination.language,
          priority: planned.length + 1,
          platform: target.platform,
        });
      }
    }

    return planned;
  }
}
