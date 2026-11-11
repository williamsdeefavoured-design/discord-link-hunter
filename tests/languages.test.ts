import { describe, it, expect } from 'vitest';
import {
  detectLanguageFromText,
  detectTopicsFromText,
  getSynonymsForTopic,
  SUPPORTED_LANGUAGES,
  TRADING_TOPICS,
} from '../packages/core/src/index.js';

describe('Multilingual Trading Dictionaries', () => {
  it('covers all six supported languages for all trading topics', () => {
    for (const lang of SUPPORTED_LANGUAGES) {
      for (const topic of TRADING_TOPICS) {
        const synonyms = getSynonymsForTopic(topic, lang);
        expect(synonyms.length).toBeGreaterThan(0);
        expect(typeof synonyms[0]).toBe('string');
      }
    }
  });

  it('detects native languages correctly from trading terminology', () => {
    expect(detectLanguageFromText('Live forex scalping and currency signals')).toBe('en');
    expect(detectLanguageFromText('Deutscher Devisenhandel und Aktienmarkt Börse')).toBe('de');
    expect(detectLanguageFromText('Comunidad de trading de divisas y señales forex')).toBe('es');
    expect(detectLanguageFromText('Mercado de câmbio e mini índice no Brasil')).toBe('pt');
    expect(detectLanguageFromText('Marché des changes et formation trading France')).toBe('fr');
    expect(detectLanguageFromText('توصيات فوركس وتداول الذهب')).toBe('ar');
  });

  it('identifies trading topics from text content', () => {
    const topics = detectTopicsFromText('Analysis on gold xauusd and bitcoin crypto trading');
    expect(topics).toContain('xauusd');
    expect(topics).toContain('crypto');
  });
});

