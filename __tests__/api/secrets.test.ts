import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
// Disable rate limiting for all route tests
vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn(() => true),
  getIp: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })),
}));

import { POST } from '@/app/api/secrets/route';

const VALID_IV = btoa(String.fromCharCode(...new Array(12).fill(0)));
const VALID_CT = btoa('encrypted payload');

function makeRequest(body: Record<string, unknown>) {
  return new Request('http://localhost/api/secrets', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/secrets', () => {
  it('creates a secret and returns url + destroyToken', async () => {
    prismaMock.secret.create.mockResolvedValue({ id: 'secret-123' });

    const res = await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toContain('/secret/secret-123');
    expect(data.destroyToken).toBeTruthy();
    expect(data.id).toBe('secret-123');
  });

  it('stores the correct TTL when ttlHours is 1', async () => {
    prismaMock.secret.create.mockResolvedValue({ id: 'secret-ttl' });

    await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV, ttlHours: 1 }) as never);

    const createCall = prismaMock.secret.create.mock.calls[0][0];
    const diff = createCall.data.expiresAt.getTime() - Date.now();
    // Should be within 1 hour ± 5 seconds
    expect(diff).toBeGreaterThan((3600 - 5) * 1000);
    expect(diff).toBeLessThan((3600 + 5) * 1000);
  });

  it('defaults to 24h TTL for unknown ttlHours', async () => {
    prismaMock.secret.create.mockResolvedValue({ id: 'secret-default' });

    await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV, ttlHours: 999 }) as never);

    const createCall = prismaMock.secret.create.mock.calls[0][0];
    const diff = createCall.data.expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan((86400 - 5) * 1000);
    expect(diff).toBeLessThan((86400 + 5) * 1000);
  });

  it('rejects missing ciphertext', async () => {
    const res = await POST(makeRequest({ iv: VALID_IV }) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBeTruthy();
  });

  it('rejects invalid base64 ciphertext', async () => {
    const res = await POST(makeRequest({ ciphertext: 'not!!valid', iv: VALID_IV }) as never);
    expect(res.status).toBe(400);
  });

  it('rejects oversized ciphertext', async () => {
    const oversized = 'A'.repeat(87383);
    const res = await POST(makeRequest({ ciphertext: oversized, iv: VALID_IV }) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('maximum');
  });

  it('rejects passphrase flag without salt/verifier', async () => {
    const res = await POST(makeRequest({
      ciphertext: VALID_CT,
      iv: VALID_IV,
      passphraseRequired: true,
    }) as never);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('passphrase');
  });

  it('accepts passphrase with salt and verifier', async () => {
    prismaMock.secret.create.mockResolvedValue({ id: 'secret-pass' });

    const res = await POST(makeRequest({
      ciphertext: VALID_CT,
      iv: VALID_IV,
      passphraseRequired: true,
      passphraseSalt: 'somesalt==',
      passphraseVerifier: 'someverifier==',
    }) as never);

    expect(res.status).toBe(200);
    const createCall = prismaMock.secret.create.mock.calls[0][0];
    expect(createCall.data.passphraseRequired).toBe(true);
    expect(createCall.data.passphraseSalt).toBe('somesalt==');
  });

  it('truncates note to 140 characters', async () => {
    prismaMock.secret.create.mockResolvedValue({ id: 'secret-note' });
    const longNote = 'a'.repeat(200);

    await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV, note: longNote }) as never);

    const createCall = prismaMock.secret.create.mock.calls[0][0];
    expect(createCall.data.note).toHaveLength(140);
  });
});
