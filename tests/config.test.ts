import { describe, it, expect } from 'vitest';
import { ConfigSchema, maskSecret } from '../packages/config/src/index.js';

describe('Environment & Config Validation', () => {
  it('parses valid minimal environment with defaults', () => {
    const parsed = ConfigSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.SEARCH_MODE).toBe('mock');
      expect(parsed.data.API_PORT).toBe(3001);
      expect(parsed.data.SEARCH_MAX_QUERIES_PER_JOB).toBe(12);
      expect(parsed.data.AI_PROVIDER).toBe('none');
    }
  });

  it('correctly transforms comma-separated allowed discord user ids', () => {
    const parsed = ConfigSchema.safeParse({
      ALLOWED_DISCORD_USER_IDS: '123456, 789101,  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.ALLOWED_DISCORD_USER_IDS).toEqual(['123456', '789101']);
    }
  });

  it('masks sensitive secrets safely without leaking values', () => {
    expect(maskSecret('')).toBe('(not configured)');
    expect(maskSecret('secret123')).toBe('secr...t123');
    expect(maskSecret('short')).toBe('********');
  });
});

