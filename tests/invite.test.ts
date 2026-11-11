import { describe, it, expect, vi } from 'vitest';
import {
  canonicalizeDiscordInvite,
  extractDiscordInviteCode,
  extractDiscordInvites,
  isSafeUrl,
  verifyDiscordInvite,
  verifyMockInvite,
} from '../packages/core/src/index.js';

describe('Discord Invite Parsing, SSRF Defenses & Verification', () => {
  it('extracts invite codes across various URL forms', () => {
    expect(extractDiscordInviteCode('https://discord.gg/alpha-traders')).toBe('alpha-traders');
    expect(extractDiscordInviteCode('http://discord.com/invite/beta-fx')).toBe('beta-fx');
    expect(extractDiscordInviteCode('https://discordapp.com/invite/gamma-gold?utm_source=twitter')).toBe('gamma-gold');
    expect(extractDiscordInviteCode('Visit discord.gg/delta-crypto! for details')).toBe('delta-crypto');
  });

  it('canonicalizes invite codes into standard URL', () => {
    const res = canonicalizeDiscordInvite('https://discord.com/invite/trading101?ref=test');
    expect(res).not.toBeNull();
    expect(res?.code).toBe('trading101');
    expect(res?.canonicalUrl).toBe('https://discord.gg/trading101');
  });

  it('deduplicates invite codes in text snippets', () => {
    const text = `
      Check out https://discord.gg/same-server and also visit
      discord.com/invite/same-server?ref=promo or discord.gg/other-server.
    `;
    const extracted = extractDiscordInvites(text, 'https://example.com/blog');
    expect(extracted.length).toBe(2);
    expect(extracted.map((e) => e.code)).toEqual(['same-server', 'other-server']);
  });

  it('blocks private, link-local, loopback and non-http addresses via SSRF defense', () => {
    expect(isSafeUrl('http://localhost/admin').safe).toBe(false);
    expect(isSafeUrl('http://127.0.0.1:8080').safe).toBe(false);
    expect(isSafeUrl('http://10.0.0.5/secrets').safe).toBe(false);
    expect(isSafeUrl('http://192.168.1.1/router').safe).toBe(false);
    expect(isSafeUrl('http://172.16.0.1/internal').safe).toBe(false);
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data').safe).toBe(false);
    expect(isSafeUrl('file:///etc/passwd').safe).toBe(false);

    // Public web addresses are permitted
    expect(isSafeUrl('https://tradingview.com').safe).toBe(true);
    expect(isSafeUrl('https://google.com/search').safe).toBe(true);
  });

  it('verifies active invite and extracts guild metadata on HTTP 200', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({
        code: 'gold-pro',
        approximate_member_count: 5400,
        approximate_presenceCount: 820,
        guild: {
          id: '123456789',
          name: 'Gold Pro Scalpers',
          description: 'Official gold trading Discord',
        },
      }),
    });

    const verified = await verifyDiscordInvite('gold-pro', mockFetch as any);
    expect(verified.status).toBe('valid');
    expect(verified.community?.name).toBe('Gold Pro Scalpers');
    expect(verified.community?.approximateMemberCount).toBe(5400);
  });

  it('correctly classifies expired or revoked invite on HTTP 404', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 404,
      json: async () => ({ message: 'Unknown Invite', code: 10006 }),
    });

    const verified = await verifyDiscordInvite('expired-code', mockFetch as any);
    expect(verified.status).toBe('expired_or_revoked');
    expect(verified.statusReason).toContain('Unknown Invite');
  });

  it('never marks an invite as invalid when a network error occurs', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Connection timed out'));

    const verified = await verifyDiscordInvite('network-test', mockFetch as any);
    expect(verified.status).toBe('unknown');
    expect(verified.statusReason).toContain('Network error');
  });

  describe('verifyMockInvite (Mock Mode Isolation)', () => {
    it('returns rich simulated community metadata for known mock fixtures', async () => {
      const verified = await verifyMockInvite('fx-elite-club');
      expect(verified.status).toBe('valid');
      expect(verified.community?.name).toBe('Global Forex Traders Club');
      expect(verified.community?.approximateMemberCount).toBe(4520);
      expect(verified.httpStatus).toBe(200);
    });

    it('simulates expired status for expired fixture codes', async () => {
      const verified = await verifyMockInvite('expired-test');
      expect(verified.status).toBe('expired_or_revoked');
      expect(verified.community).toBeNull();
      expect(verified.httpStatus).toBe(404);
    });

    it('simulates rate limit status for rate-limit fixture codes', async () => {
      const verified = await verifyMockInvite('rate-limit-test');
      expect(verified.status).toBe('rate_limited');
      expect(verified.community).toBeNull();
      expect(verified.httpStatus).toBe(429);
    });

    it('deterministically synthesizes communities for arbitrary mock codes without network access', async () => {
      const verified = await verifyMockInvite('crypto-scalpers-custom');
      expect(verified.status).toBe('valid');
      expect(verified.community).not.toBeNull();
      expect(verified.community?.approximateMemberCount).toBeGreaterThan(1000);
      expect(verified.httpStatus).toBe(200);
    });
  });
});

