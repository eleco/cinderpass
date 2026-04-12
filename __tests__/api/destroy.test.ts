import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

import { POST } from '@/app/api/secrets/[id]/destroy/route';

const VALID_TOKEN = 'a'.repeat(64); // 32 bytes hex = 64 chars
const PARAMS = { params: Promise.resolve({ id: 'secret-abc' }) };

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/secrets/secret-abc/destroy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const ACTIVE_SECRET = {
  id: 'secret-abc',
  status: 'ACTIVE',
  destroyToken: VALID_TOKEN,
  requestId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/secrets/[id]/destroy', () => {
  it('destroys an active secret with valid token', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(ACTIVE_SECRET);
    prismaMock.secret.update.mockResolvedValue({});

    const res = await POST(makeRequest({ destroyToken: VALID_TOKEN }), PARAMS);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.destroyed).toBe(true);
    expect(prismaMock.secret.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'secret-abc' },
        data: expect.objectContaining({ status: 'DESTROYED' }),
      })
    );
  });

  it('returns 400 when destroyToken is missing', async () => {
    const res = await POST(makeRequest({}), PARAMS);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('destroyToken');
  });

  it('returns 404 for unknown secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(null);

    const res = await POST(makeRequest({ destroyToken: VALID_TOKEN }), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 410 for already-opened secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({ ...ACTIVE_SECRET, status: 'OPENED' });

    const res = await POST(makeRequest({ destroyToken: VALID_TOKEN }), PARAMS);
    expect(res.status).toBe(410);
    // Must not attempt to destroy it
    expect(prismaMock.secret.update).not.toHaveBeenCalled();
  });

  it('returns 410 for already-destroyed secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({ ...ACTIVE_SECRET, status: 'DESTROYED' });

    const res = await POST(makeRequest({ destroyToken: VALID_TOKEN }), PARAMS);
    expect(res.status).toBe(410);
  });

  it('returns 403 for wrong destroy token (timing-safe comparison)', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(ACTIVE_SECRET);

    const wrongToken = 'b'.repeat(64);
    const res = await POST(makeRequest({ destroyToken: wrongToken }), PARAMS);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Invalid');
    expect(prismaMock.secret.update).not.toHaveBeenCalled();
  });

  it('returns 409 when secret has no destroyToken set', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({ ...ACTIVE_SECRET, destroyToken: null });

    const res = await POST(makeRequest({ destroyToken: VALID_TOKEN }), PARAMS);
    expect(res.status).toBe(409);
  });

  it('also destroys linked SecretRequest when requestId is set', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({ ...ACTIVE_SECRET, requestId: 'req-xyz' });
    prismaMock.secret.update.mockResolvedValue({});
    prismaMock.secretRequest.update.mockResolvedValue({});

    await POST(makeRequest({ destroyToken: VALID_TOKEN }), PARAMS);

    expect(prismaMock.secretRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'req-xyz' },
        data: expect.objectContaining({ status: 'DESTROYED' }),
      })
    );
  });
});
