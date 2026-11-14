import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildServer } from '../apps/api/src/server.js';
import { InMemoryRepository } from '../packages/db/src/repositories.js';

describe('Phase 1 — API Security & Authentication', () => {
  let app: FastifyInstance;
  let testRepo: InMemoryRepository;

  beforeAll(async () => {
    testRepo = new InMemoryRepository();
    // Initialize server with a custom test API key alongside default valid keys
    app = buildServer(testRepo, { apiKey: 'test_custom_secret_key_123' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Public Endpoints (No Auth Required)', () => {
    it('GET /health is public and returns 200 without authentication headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(data.status).toBe('ok');
    });

    it('GET /api/sources is public and returns registered platforms without auth headers', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/sources',
      });
      expect(res.statusCode).toBe(200);
      const data = JSON.parse(res.payload);
      expect(Array.isArray(data.sources)).toBe(true);
      expect(data.sources.length).toBeGreaterThan(0);
    });
  });

  describe('Sensitive Endpoints - 401 Unauthorized on Missing Credentials', () => {
    it('POST /api/jobs returns 401 when no auth header is provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        payload: { topics: ['forex'], mode: 'mock' },
      });
      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.payload);
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toContain('Authentication required');
    });

    it('GET /api/jobs returns 401 when no auth header is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/jobs',
      });
      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.payload);
      expect(data.error).toBe('Unauthorized');
    });

    it('GET /api/results/test-job returns 401 when no auth header is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/results/test-job',
      });
      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.payload);
      expect(data.error).toBe('Unauthorized');
    });

    it('GET /api/export/test-job returns 401 when no auth header is provided', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/export/test-job',
      });
      expect(res.statusCode).toBe(401);
      const data = JSON.parse(res.payload);
      expect(data.error).toBe('Unauthorized');
    });

    it('POST /api/jobs/test-job/cancel returns 401 when no auth header is provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/test-job/cancel',
      });
      expect(res.statusCode).toBe(401);
    });

    it('POST /api/jobs/test-job/execute returns 401 when no auth header is provided', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs/test-job/execute',
        payload: { confirm: true },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('Sensitive Endpoints - 403 Forbidden on Invalid Credentials', () => {
    it('POST /api/jobs returns 403 when invalid x-api-key is supplied', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { 'x-api-key': 'completely_wrong_key' },
        payload: { topics: ['forex'], mode: 'mock' },
      });
      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.payload);
      expect(data.error).toBe('Forbidden');
      expect(data.message).toContain('Invalid API key or authorization token');
    });

    it('POST /api/jobs returns 403 when invalid Bearer token is supplied', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { authorization: 'Bearer invalid_bearer_token' },
        payload: { topics: ['forex'], mode: 'mock' },
      });
      expect(res.statusCode).toBe(403);
      const data = JSON.parse(res.payload);
      expect(data.error).toBe('Forbidden');
    });
  });

  describe('Sensitive Endpoints - 200/202 Success on Authorized Requests', () => {
    it('accepts valid credentials via x-api-key header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { 'x-api-key': 'test_custom_secret_key_123' },
        payload: { topics: ['forex'], mode: 'mock' },
      });
      expect(res.statusCode).toBe(202);
      const data = JSON.parse(res.payload);
      expect(data.jobId).toBeDefined();
    });

    it('accepts valid credentials via Authorization: Bearer header', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { authorization: 'Bearer test_custom_secret_key_123' },
        payload: { topics: ['forex'], mode: 'mock' },
      });
      expect(res.statusCode).toBe(202);
      const data = JSON.parse(res.payload);
      expect(data.jobId).toBeDefined();
    });

    it('accepts standard development/test key in non-production environments', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/jobs',
        headers: { 'x-api-key': 'dlh_dev_secret_key' },
        payload: { topics: ['forex'], mode: 'mock' },
      });
      expect(res.statusCode).toBe(202);
      const data = JSON.parse(res.payload);
      expect(data.jobId).toBeDefined();
    });
  });
});

