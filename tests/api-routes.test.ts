import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../apps/api/src/server.js';
import { FastifyInstance } from 'fastify';

describe('Fastify HTTP API Routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns 200 with service status', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('discord-link-hunter-api');
    expect(body.providers).toBeDefined();
  });

  it('POST /api/jobs queues a new job and returns 202', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/jobs',
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
      payload: {
        topics: ['forex'],
        languages: ['en'],
        limit: 5,
        mode: 'mock',
      },
    });

    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.payload);
    expect(body.jobId).toBeDefined();
    expect(body.mode).toBe('mock');
  });

  it('GET /api/results/job-seed-demo-01 returns seed results in sorted order (95 above 92)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/results/job-seed-demo-01',
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.count).toBe(3);
    // Verifies score 95 strictly precedes score 92
    expect(body.results[0].score).toBe(95);
    expect(body.results[0].invite.code).toBe('gold-scalpers-vip');
    expect(body.results[1].score).toBe(92);
    expect(body.results[1].invite.code).toBe('fx-elite-club');
    expect(body.results[2].score).toBe(88);
    expect(body.results[2].invite.code).toBe('arab-gold-traders');
  });

  it('GET /api/export/job-seed-demo-01?format=csv returns CSV content', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/export/job-seed-demo-01?format=csv',
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.payload).toContain('Canonical URL');
  });

  it('GET /api/export/job-seed-demo-01?format=json returns JSON download', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/export/job-seed-demo-01?format=json',
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const parsed = JSON.parse(res.payload);
    expect(Array.isArray(parsed)).toBe(true);
  });

  it('POST /api/verify rejects invalid input format', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/verify',
      headers: { 'x-api-key': 'dlh_dev_secret_key' },
      payload: { url: 'https://google.com/search?q=not-discord' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toContain('Invalid Discord invite format');
  });
});
