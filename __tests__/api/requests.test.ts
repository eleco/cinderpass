import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn(() => true),
  getIp: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })),
}));

import { POST as createRequest } from '@/app/api/requests/route';
import { POST as submitRequest } from '@/app/api/requests/[token]/submit/route';

const VALID_IV = btoa(String.fromCharCode(...new Array(12).fill(0)));
const VALID_CT = btoa('encrypted secret');
const FUTURE = new Date(Date.now() + 3600_000);
const PAST = new Date(Date.now() - 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST /api/requests ──────────────────────────────────────────────────────

describe('POST /api/requests', () => {
  it('creates a request and returns requestUrl', async () => {
    prismaMock.secretRequest.create.mockResolvedValue({ id: 'req-1', token: 'tok-abc' });

    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'Please send your SSH key', ttlHours: 24 }),
    });

    const res = await createRequest(req as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requestUrl).toContain('/request/');
  });

  it('returns 400 when label is missing', async () => {
    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ttlHours: 24 }),
    });

    const res = await createRequest(req as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('label');
  });

  it('returns 400 when label is whitespace only', async () => {
    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: '   ' }),
    });

    const res = await createRequest(req as never);
    expect(res.status).toBe(400);
  });

  it('defaults to 24h TTL for invalid ttlHours', async () => {
    prismaMock.secretRequest.create.mockResolvedValue({ id: 'req-2', token: 'tok-def' });

    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'test', ttlHours: 9999 }),
    });

    await createRequest(req as never);

    const createCall = prismaMock.secretRequest.create.mock.calls[0][0];
    const diff = createCall.data.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan((86400 - 5) * 1000);
  });

  it('truncates label to 100 characters', async () => {
    prismaMock.secretRequest.create.mockResolvedValue({ id: 'req-3', token: 'tok-ghi' });

    const req = new Request('http://localhost/api/requests', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ label: 'a'.repeat(200) }),
    });

    await createRequest(req as never);

    const createCall = prismaMock.secretRequest.create.mock.calls[0][0];
    expect(createCall.data.label).toHaveLength(100);
  });
});

// ── POST /api/requests/[token]/submit ───────────────────────────────────────

describe('POST /api/requests/[token]/submit', () => {
  const PARAMS = { params: Promise.resolve({ token: 'valid-token' }) };

  const OPEN_REQUEST = {
    id: 'req-open',
    token: 'valid-token',
    status: 'OPEN',
    expiresAt: FUTURE,
    label: 'Please send credentials',
  };

  it('submits a secret for an open request and returns revealUrl', async () => {
    prismaMock.secretRequest.findUnique.mockResolvedValue(OPEN_REQUEST);
    prismaMock.secret.create.mockResolvedValue({ id: 'submitted-secret' });
    prismaMock.secretRequest.update.mockResolvedValue({});

    const req = new Request('http://localhost/api/requests/valid-token/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: VALID_CT, iv: VALID_IV }),
    });

    const res = await submitRequest(req as never, PARAMS);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.revealUrl).toContain('/secret/submitted-secret');
  });

  it('returns 404 for unknown token', async () => {
    prismaMock.secretRequest.findUnique.mockResolvedValue(null);

    const req = new Request('http://localhost/api/requests/bad-token/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: VALID_CT, iv: VALID_IV }),
    });

    const res = await submitRequest(req as never, { params: Promise.resolve({ token: 'bad-token' }) });
    expect(res.status).toBe(404);
  });

  it('returns 410 for expired request', async () => {
    prismaMock.secretRequest.findUnique.mockResolvedValue({
      ...OPEN_REQUEST,
      expiresAt: PAST,
    });

    const req = new Request('http://localhost/api/requests/valid-token/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: VALID_CT, iv: VALID_IV }),
    });

    const res = await submitRequest(req as never, PARAMS);
    expect(res.status).toBe(410);
  });

  it('returns 410 for already-submitted request', async () => {
    prismaMock.secretRequest.findUnique.mockResolvedValue({
      ...OPEN_REQUEST,
      status: 'SUBMITTED',
    });

    const req = new Request('http://localhost/api/requests/valid-token/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: VALID_CT, iv: VALID_IV }),
    });

    const res = await submitRequest(req as never, PARAMS);
    expect(res.status).toBe(410);
  });

  it('rejects invalid ciphertext payload', async () => {
    const req = new Request('http://localhost/api/requests/valid-token/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: 'not!!valid', iv: VALID_IV }),
    });

    const res = await submitRequest(req as never, PARAMS);
    expect(res.status).toBe(400);
  });

  it('marks the request as SUBMITTED after secret creation', async () => {
    prismaMock.secretRequest.findUnique.mockResolvedValue(OPEN_REQUEST);
    prismaMock.secret.create.mockResolvedValue({ id: 'new-secret' });
    prismaMock.secretRequest.update.mockResolvedValue({});

    const req = new Request('http://localhost/api/requests/valid-token/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: VALID_CT, iv: VALID_IV }),
    });

    await submitRequest(req as never, PARAMS);

    expect(prismaMock.secretRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-open' },
        data: expect.objectContaining({ status: 'SUBMITTED' }),
      })
    );
  });
});
