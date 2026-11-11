import { describe, it, expect } from 'vitest';
import { slashCommands } from '../apps/bot/src/commands.js';

describe('Discord Slash Commands Configuration', () => {
  it('registers all required slash commands', () => {
    const commandNames = slashCommands.map((c) => c.name);
    const required = [
      'ping',
      'hunt',
      'deepsearch',
      'verify',
      'results',
      'status',
      'export',
      'dashboard',
    ];

    for (const name of required) {
      expect(commandNames).toContain(name);
    }
  });

  it('validates /hunt command options', () => {
    const hunt = slashCommands.find((c) => c.name === 'hunt')?.toJSON();
    expect(hunt).toBeDefined();

    const topicOpt = hunt?.options?.find((o: any) => o.name === 'topic');
    expect(topicOpt?.required).toBe(true);
  });
});

