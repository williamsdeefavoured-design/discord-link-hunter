import { LanguageCode, TradingTopic } from './types.js';

export interface TopicDictionary {
  topic: TradingTopic;
  keywords: string[];
}

export const LANGUAGE_TRADING_DICTIONARIES: Record<LanguageCode, Record<TradingTopic, string[]>> = {
  en: {
    forex: ['forex', 'fx trading', 'currency trading', 'forex signals'],
    xauusd: ['xauusd', 'gold trading', 'gold signals', 'xau usd analysis'],
    stocks: ['stocks', 'stock market', 'equities', 'shares', 'equity trading'],
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

export function getSynonymsForTopic(topic: TradingTopic, language: LanguageCode): string[] {
  const dict = LANGUAGE_TRADING_DICTIONARIES[language] || LANGUAGE_TRADING_DICTIONARIES.en;
  return dict[topic] || LANGUAGE_TRADING_DICTIONARIES.en[topic] || [topic];
}

export function detectLanguageFromText(text: string): LanguageCode {
  const lower = text.toLowerCase();

  // Arabic character check
  if (/[\u0600-\u06FF]/.test(text)) return 'ar';

  let maxMatches = 0;
  let detectedLang: LanguageCode = 'en';

  for (const [lang, dict] of Object.entries(LANGUAGE_TRADING_DICTIONARIES) as [LanguageCode, Record<TradingTopic, string[]>][]) {
    let matchCount = 0;
    for (const keywords of Object.values(dict)) {
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          matchCount++;
        }
      }
    }
    if (matchCount > maxMatches) {
      maxMatches = matchCount;
      detectedLang = lang;
    }
  }

  return detectedLang;
}

export function detectTopicsFromText(text: string): TradingTopic[] {
  const lower = text.toLowerCase();
  const matchedTopics = new Set<TradingTopic>();

  for (const dict of Object.values(LANGUAGE_TRADING_DICTIONARIES)) {
    for (const [topic, keywords] of Object.entries(dict) as [TradingTopic, string[]][]) {
      for (const kw of keywords) {
        if (lower.includes(kw.toLowerCase())) {
          matchedTopics.add(topic);
          break;
        }
      }
    }
  }

  return Array.from(matchedTopics);
}

