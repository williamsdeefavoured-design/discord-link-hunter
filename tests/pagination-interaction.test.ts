import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildResultsPageEmbed,
  buildPaginationRow,
  handleButtonInteraction,
} from '../apps/bot/src/commands.js';
import { RankedInviteResult, SearchJob } from '../packages/core/src/types.js';
import { InMemoryRepository, resetRepositoryInstance } from '../packages/db/src/repositories.js';

function createMockRankedResults(count: number): RankedInviteResult[] {
  return Array.from({ length: count }, (_, i) => ({
    invite: {
      code: `invite-${i + 1}`,
      canonicalUrl: `https://discord.gg/invite-${i + 1}`,
      status: 'valid' as const,
      community: {
        id: `guild-${i + 1}`,
        name: `Community ${i + 1}`,
        approximateMemberCount: (i + 1) * 1000,
        approximatePresenceCount: (i + 1) * 200,
      },
      lastVerifiedAt: new Date().toISOString(),
    },
    sources: [],
    score: 95 - i,
    scoreBreakdown: {
      topicRelevance: 30,
      inviteValidity: 20,
      languageMatch: 15,
      sourceCredibility: 10,
      freshness: 10,
      activitySignal: 10,
      total: 95 - i,
      explanations: [`Rank ${i + 1} community`],
    },
    detectedTopics: ['forex'],
    detectedLanguage: 'en',
    isVerifiedFact: true,
  }));
}

function createMockJob(id: string, count: number): SearchJob {
  return {
    id,
    params: {
      topics: ['forex'],
      languages: ['en'],
      limit: count,
      depth: 1,
    },
    mode: 'live',
    status: 'completed',
    progress: {
      queriesPlanned: 1,
      queriesAttempted: 1,
      queriesSuccessful: 1,
      queriesFailed: 0,
      urlsDiscovered: count,
      invitesExtracted: count,
      uniqueInvites: count,
      invitesChecked: count,
      validInvites: count,
      invalidInvites: 0,
      restrictedOrUnverified: 0,
      queriesExecuted: 1,
      invitesVerified: count,
      validInvitesFound: count,
      providerErrors: [],
    },
    results: createMockRankedResults(count),
    createdAt: new Date().toISOString(),
  };
}

describe('Discord Results Button Pagination Interactions', () => {
  let mockRepo: InMemoryRepository;

  beforeEach(() => {
    mockRepo = new InMemoryRepository();
    resetRepositoryInstance(mockRepo);
  });

  it('10 results: page 1 shows results 1 to 5 with Previous disabled and Next enabled', () => {
    const results = createMockRankedResults(10);
    const job = createMockJob('job-10', 10);
    const totalPages = Math.ceil(results.length / 5);

    expect(totalPages).toBe(2);

    const embed = buildResultsPageEmbed('job-10', results, 1, totalPages, job);
    const row = buildPaginationRow('job-10', 1, totalPages, 'user-1');

    const fields = (embed.data as any).fields;
    expect(fields.length).toBe(5);
    expect(fields[0].name).toContain('#1');
    expect(fields[0].name).toContain('Community 1');
    expect(fields[4].name).toContain('#5');
    expect(fields[4].name).toContain('Community 5');

    const [prevBtn, indicatorBtn, nextBtn] = row.components as any[];
    expect(prevBtn.data.disabled).toBe(true);
    expect(prevBtn.data.custom_id).toBe('page:job-10:0:user-1');
    expect(indicatorBtn.data.label).toBe('Page 1 of 2');
    expect(indicatorBtn.data.disabled).toBe(true);
    expect(nextBtn.data.disabled).toBe(false);
    expect(nextBtn.data.custom_id).toBe('page:job-10:2:user-1');
  });

  it('Click Next: page 2 shows results 6 to 10 with Next disabled and Previous enabled', async () => {
    const results = createMockRankedResults(10);
    const job = createMockJob('job-10', 10);
    await mockRepo.saveJob(job);
    await mockRepo.saveResults('job-10', results);

    const deferUpdateSpy = vi.fn().mockResolvedValue(undefined);
    const editReplySpy = vi.fn().mockResolvedValue(undefined);

    const callOrder: string[] = [];
    deferUpdateSpy.mockImplementation(async () => {
      callOrder.push('deferUpdate');
    });

    const origGetResults = mockRepo.getJobResults.bind(mockRepo);
    mockRepo.getJobResults = async (id: string) => {
      callOrder.push('getJobResults');
      return origGetResults(id);
    };

    const interaction: any = {
      customId: 'page:job-10:2:user-1',
      user: { id: 'user-1' },
      deferred: false,
      replied: false,
      deferUpdate: deferUpdateSpy,
      editReply: editReplySpy,
      reply: vi.fn(),
      followUp: vi.fn(),
    };

    await handleButtonInteraction(interaction);

    // 1. deferUpdate must be called BEFORE data fetching
    expect(deferUpdateSpy).toHaveBeenCalledTimes(1);
    expect(callOrder[0]).toBe('deferUpdate');
    expect(callOrder[1]).toBe('getJobResults');

    // 2. editReply must update message with page 2
    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const payload = editReplySpy.mock.calls[0][0];
    const page2Embed = payload.embeds[0];
    const page2Row = payload.components[0];

    const fields = page2Embed.data.fields;
    expect(fields.length).toBe(5);
    expect(fields[0].name).toContain('#6');
    expect(fields[0].name).toContain('Community 6');
    expect(fields[4].name).toContain('#10');
    expect(fields[4].name).toContain('Community 10');

    const [prevBtn, indicatorBtn, nextBtn] = page2Row.components;
    expect(prevBtn.data.disabled).toBe(false);
    expect(prevBtn.data.custom_id).toBe('page:job-10:1:user-1');
    expect(indicatorBtn.data.label).toBe('Page 2 of 2');
    expect(nextBtn.data.disabled).toBe(true);
  });

  it('Click Previous: page 1 returns from page 2', async () => {
    const results = createMockRankedResults(10);
    const job = createMockJob('job-10', 10);
    await mockRepo.saveJob(job);
    await mockRepo.saveResults('job-10', results);

    const deferUpdateSpy = vi.fn().mockResolvedValue(undefined);
    const editReplySpy = vi.fn().mockResolvedValue(undefined);

    const interaction: any = {
      customId: 'page:job-10:1:user-1',
      user: { id: 'user-1' },
      deferred: false,
      replied: false,
      deferUpdate: deferUpdateSpy,
      editReply: editReplySpy,
      reply: vi.fn(),
      followUp: vi.fn(),
    };

    await handleButtonInteraction(interaction);

    expect(deferUpdateSpy).toHaveBeenCalledTimes(1);
    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const payload = editReplySpy.mock.calls[0][0];
    const page1Embed = payload.embeds[0];
    const page1Row = payload.components[0];

    const fields = page1Embed.data.fields;
    expect(fields[0].name).toContain('#1');
    expect(fields[4].name).toContain('#5');

    const [prevBtn, indicatorBtn, nextBtn] = page1Row.components;
    expect(prevBtn.data.disabled).toBe(true);
    expect(indicatorBtn.data.label).toBe('Page 1 of 2');
    expect(nextBtn.data.disabled).toBe(false);
  });

  it('12 results: creates 3 pages (5, 5, 2) with correct button states', async () => {
    const results = createMockRankedResults(12);
    const job = createMockJob('job-12', 12);
    await mockRepo.saveJob(job);
    await mockRepo.saveResults('job-12', results);

    // Page 3 interaction
    const deferUpdateSpy = vi.fn().mockResolvedValue(undefined);
    const editReplySpy = vi.fn().mockResolvedValue(undefined);

    const interaction: any = {
      customId: 'page:job-12:3:user-1',
      user: { id: 'user-1' },
      deferred: false,
      replied: false,
      deferUpdate: deferUpdateSpy,
      editReply: editReplySpy,
      reply: vi.fn(),
      followUp: vi.fn(),
    };

    await handleButtonInteraction(interaction);

    expect(deferUpdateSpy).toHaveBeenCalledTimes(1);
    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const payload = editReplySpy.mock.calls[0][0];
    const page3Embed = payload.embeds[0];
    const page3Row = payload.components[0];

    // Page 3 has 2 remaining results (items 11 and 12)
    const fields = page3Embed.data.fields;
    expect(fields.length).toBe(2);
    expect(fields[0].name).toContain('#11');
    expect(fields[1].name).toContain('#12');

    const [prevBtn, indicatorBtn, nextBtn] = page3Row.components;
    expect(prevBtn.data.disabled).toBe(false);
    expect(indicatorBtn.data.label).toBe('Page 3 of 3');
    expect(nextBtn.data.disabled).toBe(true);
  });

  it('rejects unauthorized users with ephemeral reply without deferring update', async () => {
    const replySpy = vi.fn().mockResolvedValue(undefined);
    const deferUpdateSpy = vi.fn().mockResolvedValue(undefined);

    const interaction: any = {
      customId: 'page:job-10:2:original-author',
      user: { id: 'unauthorized-user' },
      deferred: false,
      replied: false,
      reply: replySpy,
      deferUpdate: deferUpdateSpy,
      editReply: vi.fn(),
      followUp: vi.fn(),
    };

    await handleButtonInteraction(interaction);

    expect(replySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('Only the user who ran this search can paginate results'),
        ephemeral: true,
      })
    );
    expect(deferUpdateSpy).not.toHaveBeenCalled();
  });

  it('paginates successfully after simulating bot restart (fetching from fresh repo)', async () => {
    const results = createMockRankedResults(10);
    const job = createMockJob('job-restart', 10);
    await mockRepo.saveJob(job);
    await mockRepo.saveResults('job-restart', results);

    // Simulate bot restart: reset repository instance and point to existing data store
    resetRepositoryInstance(mockRepo);

    const deferUpdateSpy = vi.fn().mockResolvedValue(undefined);
    const editReplySpy = vi.fn().mockResolvedValue(undefined);

    const interaction: any = {
      customId: 'page:job-restart:2:user-1',
      user: { id: 'user-1' },
      deferred: false,
      replied: false,
      deferUpdate: deferUpdateSpy,
      editReply: editReplySpy,
      reply: vi.fn(),
      followUp: vi.fn(),
    };

    await handleButtonInteraction(interaction);

    expect(deferUpdateSpy).toHaveBeenCalledTimes(1);
    expect(editReplySpy).toHaveBeenCalledTimes(1);
    const payload = editReplySpy.mock.calls[0][0];
    const embed = payload.embeds[0];
    expect(embed.data.fields[0].name).toContain('#6');
  });

  it('handles non-existent or deleted jobs gracefully with followUp error', async () => {
    const deferUpdateSpy = vi.fn().mockResolvedValue(undefined);
    const followUpSpy = vi.fn().mockResolvedValue(undefined);

    const interaction: any = {
      customId: 'page:job-deleted:2:user-1',
      user: { id: 'user-1' },
      deferred: false,
      replied: false,
      deferUpdate: deferUpdateSpy,
      editReply: vi.fn(),
      reply: vi.fn(),
      followUp: followUpSpy,
    };

    await handleButtonInteraction(interaction);

    expect(deferUpdateSpy).toHaveBeenCalledTimes(1);
    expect(followUpSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.stringContaining('was not found'),
        ephemeral: true,
      })
    );
  });
});

