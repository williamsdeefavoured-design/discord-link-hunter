import { DetectedLanguage, LanguageCode, TradingTopic } from './types.js';

export interface TopicDictionary {
  topic: TradingTopic;
  keywords: string[];
}

// Keep these public dictionaries and their existing topic names intact: the
// query planner and other packages can already depend on them.
export const LANGUAGE_TRADING_DICTIONARIES: Record<LanguageCode, Record<TradingTopic, string[]>> = {
  en: {
    forex: ['forex', 'fx trading', 'currency trading', 'forex signals'],
    xauusd: ['xauusd', 'gold trading', 'gold signals', 'xau usd analysis', 'gold', 'xau', 'gold scalping', 'gold traders'],
    stocks: ['stocks', 'stock', 'stock trading', 'stock market', 'equities', 'shares', 'equity trading'],
    crypto: ['crypto', 'cryptocurrency', 'bitcoin', 'altcoins', 'defi'],
    futures: ['futures trading', 'es futures', 'nq futures', 'micro futures'],
    options: ['options trading', 'call options', 'put options', 'options flow'],
    indices: ['indices', 'sp500', 'nasdaq', 'dow jones', 'index trading', 'US100', 'US500', 'S&P 500', 'Nasdaq 100', 'DAX 40'],
    day_trading: ['day trading', 'intraday', 'scalping', 'day trader'],
    swing_trading: ['swing trading', 'swing trade', 'position trading'],
    investing: ['investing', 'long term investing', 'portfolio', 'value investing'],
    technical_analysis: ['technical analysis', 'price action', 'chart patterns', 'support resistance'],
    education: ['trading education', 'trading course', 'learn trading', 'mentorship'],
  },
  de: {
    forex: ['devisenhandel', 'devisen', 'forex signale', 'forex'],
    xauusd: ['gold handeln', 'goldpreis analyse', 'gold trading', 'xauusd', 'gold', 'xau', 'goldpreis', 'gold signale'],
    stocks: ['aktien', 'aktienmarkt', 'wertpapiere', 'börse', 'boerse', 'aktienhandel'],
    crypto: ['kryptowährung', 'krypto', 'bitcoin', 'altcoins'],
    futures: ['termingeschäfte', 'futures', 'dax futures'],
    options: ['optionen', 'optionshandel', 'optionsscheine'],
    indices: ['indizes', 'dax', 'eurostoxx', 'indexhandel'],
    day_trading: ['daytrading', 'intraday trading', 'scalpen'],
    swing_trading: ['swing trading', 'swingtrade'],
    investing: ['investieren', 'geldanlage', 'vermögensaufbau', 'aktienanlage'],
    technical_analysis: ['chartanalyse', 'technische analyse', 'charttechnik'],
    education: ['trading lernen', 'trading ausbildung', 'börsenwissen'],
  },
  es: {
    forex: ['mercado de divisas', 'señales forex', 'divisas', 'forex'],
    xauusd: ['trading de oro', 'señales oro', 'análisis xauusd', 'xauusd', 'oro', 'xau', 'trading oro', 'scalping oro', 'señales de oro', 'senales oro', 'analisis xauusd'],
    stocks: ['acciones', 'bolsa de valores', 'renta variable', 'mercado bursátil', 'bolsa', 'mercado bursatil', 'inversión en bolsa', 'inversion en bolsa'],
    crypto: ['criptomonedas', 'cripto', 'bitcoin', 'altcoins'],
    futures: ['trading de futuros', 'futuros', 'micro futuros'],
    options: ['opciones financieras', 'trading de opciones', 'call y put'],
    indices: ['índices', 'sp500', 'ibex35', 'nasdaq'],
    day_trading: ['trading intradiario', 'day trading', 'scalping'],
    swing_trading: ['operaciones swing', 'swing trading'],
    investing: ['inversión', 'invertir en bolsa', 'crecimiento patrimonial'],
    technical_analysis: ['análisis técnico', 'acción del precio', 'patrones gráficos'],
    education: ['educación trading', 'aprender trading', 'curso de trading'],
  },
  pt: {
    forex: ['mercado cambial', 'sinais forex', 'câmbio', 'forex'],
    xauusd: ['trading de ouro', 'ouro análise', 'sinais xauusd', 'xauusd', 'ouro', 'xau', 'sinais ouro', 'ouro analise', 'trading ouro'],
    stocks: ['ações', 'bolsa de valores', 'mercado de capitais', 'b3', 'acoes', 'bolsa', 'dividendos', 'mercado de acoes', 'mercado de ações'],
    crypto: ['criptomoedas', 'cripto', 'bitcoin', 'altcoins'],
    futures: ['mercado futuro', 'contratos futuros', 'mini índice', 'mini dólar'],
    options: ['mercado de opções', 'opções', 'travas de opções'],
    indices: ['índice futuro', 'mini índice', 'ibovespa', 'índices', 'WINFUT', 'US100', 'US500', 'S&P 500', 'Nasdaq 100', 'DAX 40', 'sp500'],
    day_trading: ['day trade brasil', 'day trade', 'scalping brasil'],
    swing_trading: ['swing trade', 'operações swing'],
    investing: ['investimentos', 'investir em ações', 'renda variável'],
    technical_analysis: ['análise técnica', 'price action', 'gráficos de candlestick'],
    education: ['curso de trading', 'aprender a operar', 'mentoria trading'],
  },
  fr: {
    forex: ['marché des changes', 'signaux forex', 'devises', 'forex'],
    xauusd: ['trading or', 'cours de l or', 'analyse or', 'xauusd', 'xau', 'signaux or'],
    stocks: ['actions', 'bourse', 'marché boursier', 'marche boursier', 'actions paris'],
    crypto: ['cryptomonnaies', 'crypto', 'bitcoin', 'altcoins'],
    futures: ['contrats à terme', 'trading futures'],
    options: ['trading d options', 'options vanilles', 'warrants'],
    indices: ['indices', 'cac 40', 'sp500', 'dax 40'],
    day_trading: ['trading intraday', 'day trading', 'scalping france'],
    swing_trading: ['swing trading', 'position trading'],
    investing: ['investissement', 'investir en bourse', 'gestion de portefeuille'],
    technical_analysis: ['analyse technique', 'figures chartistes', 'price action'],
    education: ['formation trading', 'apprendre le trading', 'cours bourse'],
  },
  ar: {
    forex: ['تداول العملات', 'سوق العملات', 'توصيات فوركس', 'فوركس'],
    xauusd: ['تداول الذهب', 'تحليل الذهب', 'ذهب', 'الذهب', 'xauusd'],
    stocks: ['تداول الأسهم', 'سوق الأسهم', 'البورصة', 'أسهم'],
    crypto: ['عملات رقمية', 'تداول الكريبتو', 'بيتكوين', 'كريبتو'],
    futures: ['عقود آجلة', 'تداول الفيوتشر'],
    options: ['خيارات', 'عقود الخيارات', 'أوبشن'],
    indices: ['مؤشرات', 'داو جونز', 'ناسداك', 'اس اند بي'],
    day_trading: ['تداول يومي', 'مضاربة يومية', 'سكالبينج'],
    swing_trading: ['تداول سوينغ', 'سوينق تريدينج'],
    investing: ['استثمار', 'استثمار طويل الأجل', 'محفظة استثمارية'],
    technical_analysis: ['تحليل فني', 'حركة السعر', 'نماذج فنية', 'برايس اكشن'],
    education: ['تعليم تداول', 'دورة تداول', 'تعلم الفوركس', 'كورس تداول'],
  },
  it: {
    forex: ["mercato valutario","valute"],
    xauusd: ["trading sull oro","analisi dell oro"],
    stocks: ["mercato azionario","azioni"],
    crypto: ["criptovalute","mercato delle criptovalute"],
    futures: ["contratti a termine"],
    options: ["opzioni finanziarie"],
    indices: ["indici di borsa"],
    day_trading: ["trading giornaliero"],
    swing_trading: ["operazioni swing"],
    investing: ["investimenti","investire"],
    technical_analysis: ["analisi tecnica"],
    education: ["formazione sul trading","imparare a fare trading"],
  },
  tr: {
    forex: ["döviz piyasası","döviz işlemleri"],
    xauusd: ["altın işlemleri","altın analizi"],
    stocks: ["hisse senetleri","borsa"],
    crypto: ["kripto para","dijital varlıklar"],
    futures: ["vadeli işlemler"],
    options: ["opsiyon işlemleri"],
    indices: ["borsa endeksleri"],
    day_trading: ["gün içi işlemler"],
    swing_trading: ["salınım ticareti"],
    investing: ["yatırım","portföy"],
    technical_analysis: ["teknik analiz"],
    education: ["işlem eğitimi"],
  },
  nl: {
    forex: ["valutahandel","valutamarkt"],
    xauusd: ["goudhandel","goudprijs"],
    stocks: ["aandelen","aandelenmarkt"],
    crypto: ["cryptovaluta","digitale munten"],
    futures: ["termijncontracten"],
    options: ["optiehandel"],
    indices: ["beursindices"],
    day_trading: ["daghandel"],
    swing_trading: ["swinghandel"],
    investing: ["beleggen","beleggingsportefeuille"],
    technical_analysis: ["technische analyse"],
    education: ["leren handelen"],
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
export const NON_TRADING_TERMS = [
  'minecraft',
  'roblox',
  'anime',
  'manga',
  'gaming',
  'gamer',
  'gamers',
  'fortnite',
  'juegos',
  'videojuegos',
  'jogos',
  'meme',
  'memes',
  'dating',
  'nsfw',
  'roleplay',
  'valorant',
  'league of legends',
  'pubg',
  'gta',
  'fivem',
];

export const GENERAL_TRADING_TERMS = [
  'trading',
  'trader',
  'traders',
  'trade',
  'invest',
  'investing',
  'investment',
  'investments',
  'investor',
  'investors',
  'inversión',
  'inversion',
  'inversiones',
  'inversor',
  'inversores',
  'invertir',
  'investimento',
  'investimentos',
  'investidor',
  'investidores',
  'investieren',
  'anleger',
  'geldanlage',
  'finanzen',
  'finance',
  'financial',
  'finanzas',
  'finanças',
  'signals',
  'signale',
  'sinais',
  'señales',
  'senales',
  'signaux',
  'scalp',
  'scalper',
  'scalpers',
  'scalping',
  'chart',
  'charts',
  'market',
  'markets',
  'mercado',
  'mercados',
  'marché',
  'marche',
  'börse',
  'boerse',
  'bolsa',
  'forex',
  'crypto',
  'stocks',
  'xauusd',
  'gold',
  'oro',
  'ouro',
];

export function hasNonTradingContext(text: string): boolean {
  const normalized = normalizeText(text);
  return NON_TRADING_TERMS.some((term) => hasPhrase(normalized, term));
}

export function hasGeneralTradingContext(text: string): boolean {
  const normalized = normalizeText(text);
  return GENERAL_TRADING_TERMS.some((term) => hasPhrase(normalized, term));
}

// Distinguishing phrases rather than generic trading terms (traders, signals,
// server, group) which occur in communities of many languages.
const LANGUAGE_HINTS: Record<LanguageCode, string[]> = {
  en: ['welcome to', 'join us', 'we are', 'our community', 'english speaking', 'learn trading', 'stock market', 'official', 'community', 'and', 'with', 'for', 'our', 'strategies', 'probability', 'published', 'daily'],
  de: ['deutschsprachig', 'deutschsprachige', 'deutscher', 'deutschland', 'börse', 'devisenhandel', 'wertpapiere', 'gemeinschaft', 'für anfänger'],
  es: ['español', 'española', 'bienvenidos', 'comunidad', 'mercado de divisas', 'señales', 'análisis', 'inversores', 'mercado bursátil'],
  pt: ['português', 'portugues', 'brasileiro', 'brasil', 'bem vindos', 'comunidade', 'ações', 'opções', 'investimentos', 'câmbio', 'negociação', 'operações', 'mercado financeiro'],
  fr: ['français', 'française', 'bienvenue', 'communauté', 'marché des changes', 'signaux', 'investisseurs', 'investissement', 'devises'],
  it: ['benvenuti', 'la nostra comunità', 'degli investimenti', 'mercati finanziari'],
  tr: ['topluluğumuza', 'piyasalarda', 'yatırımcılar', 'işlem stratejileri'],
  nl: ['welkom bij', 'onze gemeenschap', 'beleggers', 'financiële markten'],
  ar: ['العربية', 'عربي', 'تداول', 'الأسهم', 'الذهب', 'استثمار', 'مجتمع', 'توصيات', 'مستثمرين'],
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
  // Never treat two-letter language codes inside ordinary text as proof of language.
  // E.g. "de" is also a Spanish/French word, "es" is a Spanish verb.
  const explicitLabels: Record<LanguageCode, string[]> = {
    en: ['english', 'english speaking'],
    de: ['deutsch', 'german', 'deutschsprachig', 'germany', 'österreich'],
    es: ['español', 'spanish', 'españa', 'latinoamérica'],
    pt: ['português', 'portuguese', 'brasil', 'brazil', 'portugal'],
    fr: ['français', 'french', 'france'],
    it: ['lingua italiana', 'in italiano'],
    tr: ['türkçe', 'türkçe konuşan'],
    nl: ['nederlandstalig', 'in het nederlands'],
    ar: ['arabic', 'عربي', 'العربية'],
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
 * Returns the detected language code or 'unknown' if evidence is insufficient.
 */
export function detectDetectedLanguage(text: string): DetectedLanguage {
  return detectLanguageEvidence(text).language ?? 'unknown';
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
