import { LanguageCode, TradingTopic } from './types.js';

export interface TopicDictionary {
  topic: TradingTopic;
  keywords: string[];
}

// Keep these public dictionaries and their existing topic names intact: the
// query planner and other packages can already depend on them.
export const LANGUAGE_TRADING_DICTIONARIES: Record<LanguageCode, Record<TradingTopic, string[]>> = {
  en: {
    forex: ['forex', 'fx trading', 'currency trading', 'forex signals'],
    xauusd: ['xauusd', 'gold trading', 'gold signals', 'xau usd analysis'],
    stocks: ['stocks', 'stock', 'stock trading', 'stock market', 'equities', 'shares', 'equity trading'],
    crypto: ['crypto', 'cryptocurrency', 'bitcoin', 'altcoins', 'defi'],
    futures: ['futures trading', 'es futures', 'nq futures', 'micro futures'],
    options: ['options trading', 'call options', 'put options', 'options flow'],
    indices: ['indices', 'sp500', 'nasdaq', 'dow jones', 'index trading'],
    day_trading: ['day trading', 'intraday', 'scalping', 'day trader'],
    swing_trading: ['swing trading', 'swing trade', 'position trading'],
    investing: ['investing', 'long term investing', 'portfolio', 'value investing'],
    technical_analysis: ['technical analysis', 'price action', 'chart patterns', 'support resistance'],
    education: ['trading education', 'trading course', 'learn trading', 'mentorship'],
  },
  de: {
    forex: ['forex', 'devisenhandel', 'devisen', 'forex signale'],
    xauusd: ['xauusd', 'gold handeln', 'gold trading', 'goldpreis analyse'],
    stocks: ['aktien', 'aktienmarkt', 'wertpapiere', 'börse'],
    crypto: ['krypto', 'kryptowährung', 'bitcoin', 'altcoins'],
    futures: ['futures', 'termingeschäfte', 'dax futures'],
    options: ['optionen', 'optionshandel', 'optionsscheine'],
    indices: ['indizes', 'dax', 'eurostoxx', 'indexhandel'],
    day_trading: ['daytrading', 'intraday trading', 'scalpen'],
    swing_trading: ['swing trading', 'swingtrade'],
    investing: ['investieren', 'geldanlage', 'vermögensaufbau', 'aktienanlage'],
    technical_analysis: ['chartanalyse', 'technische analyse', 'charttechnik'],
    education: ['trading lernen', 'trading ausbildung', 'börsenwissen'],
  },
  es: {
    forex: ['forex', 'mercado de divisas', 'señales forex', 'divisas'],
    xauusd: ['xauusd', 'trading de oro', 'señales oro', 'análisis xauusd'],
    stocks: ['acciones', 'bolsa de valores', 'renta variable', 'mercado bursátil'],
    crypto: ['criptomonedas', 'cripto', 'bitcoin', 'altcoins'],
    futures: ['futuros', 'trading de futuros', 'micro futuros'],
    options: ['opciones financieras', 'trading de opciones', 'call y put'],
    indices: ['índices', 'sp500', 'ibex35', 'nasdaq'],
    day_trading: ['day trading', 'trading intradiario', 'scalping'],
    swing_trading: ['swing trading', 'operaciones swing'],
    investing: ['inversión', 'invertir en bolsa', 'crecimiento patrimonial'],
    technical_analysis: ['análisis técnico', 'acción del precio', 'patrones gráficos'],
    education: ['educación trading', 'aprender trading', 'curso de trading'],
  },
  pt: {
    forex: ['forex', 'mercado cambial', 'sinais forex', 'câmbio'],
    xauusd: ['xauusd', 'trading de ouro', 'ouro análise', 'sinais xauusd'],
    stocks: ['ações', 'bolsa de valores', 'mercado de capitais', 'b3'],
    crypto: ['criptomoedas', 'cripto', 'bitcoin', 'altcoins'],
    futures: ['mercado futuro', 'contratos futuros', 'mini índice', 'mini dólar'],
    options: ['opções', 'mercado de opções', 'travas de opções'],
    indices: ['índices', 'ibovespa', 'sp500', 'índice futuro'],
    day_trading: ['day trade', 'day trader', 'scalping brasil'],
    swing_trading: ['swing trade', 'operações swing'],
    investing: ['investimentos', 'investir em ações', 'renda variável'],
    technical_analysis: ['análise técnica', 'price action', 'gráficos de candlestick'],
    education: ['curso de trading', 'aprender a operar', 'mentoria trading'],
  },
  fr: {
    forex: ['forex', 'marché des changes', 'signaux forex', 'devises'],
    xauusd: ['xauusd', 'trading or', 'cours de l or', 'analyse or'],
    stocks: ['actions', 'bourse', 'marché boursier', 'actions paris'],
    crypto: ['crypto', 'cryptomonnaies', 'bitcoin', 'altcoins'],
    futures: ['contrats à terme', 'trading futures'],
    options: ['options vanilles', 'trading d options', 'warrants'],
    indices: ['indices', 'cac 40', 'sp500', 'dax 40'],
    day_trading: ['day trading', 'intraday', 'scalping france'],
    swing_trading: ['swing trading', 'position trading'],
    investing: ['investissement', 'investir en bourse', 'gestion de portefeuille'],
    technical_analysis: ['analyse technique', 'figures chartistes', 'price action'],
    education: ['formation trading', 'apprendre le trading', 'cours bourse'],
  },
  ar: {
    forex: ['فوركس', 'تداول العملات', 'توصيات فوركس', 'سوق العملات'],
    xauusd: ['ذهب', 'تداول الذهب', 'تحليل الذهب', 'xauusd'],
    stocks: ['أسهم', 'سوق الأسهم', 'تداول الأسهم', 'البورصة'],
    crypto: ['عملات رقمية', 'كريبتو', 'بيتكوين', 'تداول الكريبتو'],
    futures: ['عقود آجلة', 'تداول الفيوتشر'],
    options: ['خيارات', 'عقود الخيارات', 'أوبشن'],
    indices: ['مؤشرات', 'داو جونز', 'ناسداك', 'اس اند بي'],
    day_trading: ['تداول يومي', 'مضاربة يومية', 'سكالبينج'],
    swing_trading: ['تداول سوينغ', 'سوينق تريدينج'],
    investing: ['استثمار', 'استثمار طويل الأجل', 'محفظة استثمارية'],
    technical_analysis: ['تحليل فني', 'حركة السعر', 'نماذج فنية', 'برايس اكشن'],
    education: ['تعليم تداول', 'دورة تداول', 'تعلم الفوركس', 'كورس تداول'],
  },
};

export const DISCORD_SEARCH_TERMS = [
  'site:discord.gg',
  'site:discord.com/invite',
  '"discord.gg/"',
  '"discord.com/invite/"',
];

/** Whole words/phrases only, so 'b3' won't accidentally match 'ab34'. */
function normalizeText(value: string): string {
  return ` ${value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
}

function hasPhrase(normalizedText: string, phrase: string): boolean {
  const normalizedPhrase = normalizeText(phrase).trim();
  return normalizedPhrase.length > 0 && normalizedText.includes(` ${normalizedPhrase} `);
}

export function getSynonymsForTopic(topic: TradingTopic, language: LanguageCode): string[] {
  const dict = LANGUAGE_TRADING_DICTIONARIES[language] || LANGUAGE_TRADING_DICTIONARIES.en;
  return dict[topic] || LANGUAGE_TRADING_DICTIONARIES.en[topic] || [topic];
}

/**
 * Some trading terms (forex, crypto, bitcoin, etc.) are used in many languages.
 * Do not interpret them as evidence of a language merely because they occur in
 * a language's trading dictionary.
 */
const LANGUAGE_HINTS: Record<LanguageCode, string[]> = {
  en: ['welcome', 'join us', 'we are', 'learn trading'],
  de: ['deutsch', 'deutsche', 'deutscher', 'der', 'die', 'und', 'für', 'aktien', 'börse', 'wertpapiere', 'devisenhandel', 'investieren'],
  es: ['español', 'española', 'bienvenidos', 'acciones', 'señales', 'futuros', 'inversión', 'análisis', 'divisas'],
  pt: ['português', 'portugues', 'brasileiro', 'brasil', 'ações', 'opções', 'investimentos', 'sinais', 'câmbio', 'ibovespa'],
  fr: ['français', 'française', 'bienvenue', 'bourse', 'signaux', 'investissement', 'cryptomonnaies', 'marché', 'devises'],
  ar: ['العربية', 'عربي', 'تداول', 'الأسهم', 'عملات', 'الذهب', 'استثمار'],
};

// Precompute terms that belong to only one language across all dictionaries.
const LANGUAGE_SPECIFIC_TERMS = (() => {
  const owners = new Map<string, Set<LanguageCode>>();
  for (const [language, topics] of Object.entries(LANGUAGE_TRADING_DICTIONARIES) as [LanguageCode, Record<TradingTopic, string[]>][]) {
    for (const words of Object.values(topics)) {
      for (const word of words) {
        const normalized = normalizeText(word).trim();
        if (!normalized) continue;
        const set = owners.get(normalized) || new Set<LanguageCode>();
        set.add(language);
        owners.set(normalized, set);
      }
    }
  }
  const terms = {} as Record<LanguageCode, string[]>;
  for (const language of Object.keys(LANGUAGE_TRADING_DICTIONARIES) as LanguageCode[]) {
    terms[language] = [...owners.entries()]
      .filter(([, languages]) => languages.size === 1 && languages.has(language))
      .map(([term]) => term);
  }
  return terms;
})();

export interface LanguageEvidence {
  language: LanguageCode | null;
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Heuristic language evidence, NOT verified server language. Null means there
 * is not enough distinguishing text to responsibly claim any language.
 */
export function detectLanguageEvidence(text: string): LanguageEvidence {
  if (!text.trim()) return { language: null, confidence: 'low' };

  // Arabic script is a stronger language signal than multilingual market terms.
  if (/[\u0600-\u06FF]/u.test(text)) {
    return { language: 'ar', confidence: 'high' };
  }

  const normalized = normalizeText(text);
  const scores = {} as Record<LanguageCode, number>;
  const explicitLabels: Record<LanguageCode, string[]> = {
    en: ['english'], de: ['deutsch', 'german'], es: ['español', 'spanish'],
    pt: ['português', 'portuguese'], fr: ['français', 'french'], ar: ['arabic'],
  };
  for (const language of Object.keys(LANGUAGE_TRADING_DICTIONARIES) as LanguageCode[]) {
    const distinctHints = new Set(LANGUAGE_HINTS[language].map((term) => normalizeText(term).trim()));
    const distinctTerms = new Set(LANGUAGE_SPECIFIC_TERMS[language]);
    let points = 0;

    for (const hint of distinctHints) {
      if (hasPhrase(normalized, hint)) points += 2;
    }
    for (const term of distinctTerms) {
      if (hasPhrase(normalized, term)) points += 2;
    }
    if (explicitLabels[language].some((label) => hasPhrase(normalized, label))) points += 5;
    scores[language] = points;
  }

  // Recognize common German compound nouns like "Aktienprofi". Avoid broad
  // substring matching in all other cases.
  if (/(?:^|[^\p{L}\p{N}])aktien[\p{L}]{2,}/iu.test(text)) {
    scores.de += 3;
  }

  const ranked = (Object.entries(scores) as [LanguageCode, number][])
    .sort((a, b) => b[1] - a[1]);
  const [language, best] = ranked[0];
  const runnerUp = ranked[1]?.[1] ?? 0;

  if (best < 3 || best - runnerUp < 2) {
    return { language: null, confidence: 'low' };
  }
  return {
    language,
    confidence: best >= 6 && best - runnerUp >= 3 ? 'high' : 'medium',
  };
}

/**
 * Compatibility helper for existing callers expecting LanguageCode.
 * IMPORTANT: 'en' is a legacy fallback, NOT a claim that English was detected.
 * Ranking uses detectLanguageEvidence() to avoid rewarding this fallback.
 */
export function detectLanguageFromText(text: string): LanguageCode {
  return detectLanguageEvidence(text).language ?? 'en';
}

/** Detect markets from explicit keyword boundaries (not arbitrary substrings). */
export function detectTopicsFromText(text: string): TradingTopic[] {
  const normalized = normalizeText(text);
  const matchedTopics = new Set<TradingTopic>();

  for (const dict of Object.values(LANGUAGE_TRADING_DICTIONARIES)) {
    for (const [topic, keywords] of Object.entries(dict) as [TradingTopic, string[]][]) {
      if (keywords.some((word) => hasPhrase(normalized, word))) {
        matchedTopics.add(topic);
      }
    }
  }

  // German compounds such as 'Aktienprofi' still explicitly refer to stocks.
  if (/(?:^|[^\p{L}\p{N}])aktien[\p{L}]{2,}/iu.test(text)) {
    matchedTopics.add('stocks');
  }

  return Array.from(matchedTopics);
}
