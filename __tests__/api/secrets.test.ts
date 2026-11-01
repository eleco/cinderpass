import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratelimitMock, storeMock } from '../mocks/store';

vi.mock('@/lib/store', () => storeMock);
// Disable rate limiting for all route tests
vi.mock('@/lib/ratelimit', () => ratelimitMock);

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

const stored = () => storeMock.createSecret.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.createSecret.mockResolvedValue('secret-123');
});

describe('POST /api/secrets', () => {
  it('creates a secret and returns url + destroyToken', async () => {
    const res = await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV }) as never);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toContain('/secret/secret-123');
    expect(data.destroyToken).toMatch(/^[0-9a-f]{64}$/);
    expect(storeMock.createSecret.mock.calls[0][1]).toBe(data.destroyToken);
    expect(data.id).toBe('secret-123');
  });

  it('stores the correct TTL when ttlHours is 1', async () => {
    await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV, ttlHours: 1 }) as never);

    const diff = stored().expiresAt.getTime() - Date.now();
    // Should be within 1 hour ± 5 seconds
    expect(diff).toBeGreaterThan((3600 - 5) * 1000);
    expect(diff).toBeLessThan((3600 + 5) * 1000);
  });

  it('defaults to 24h TTL for unknown ttlHours', async () => {
    await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV, ttlHours: 999 }) as never);

    const diff = stored().expiresAt.getTime() - Date.now();
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
    expect(storeMock.createSecret).not.toHaveBeenCalled();
  });

  it('accepts passphrase with salt and verifier', async () => {
    const res = await POST(makeRequest({
      ciphertext: VALID_CT,
      iv: VALID_IV,
      passphraseRequired: true,
      passphraseSalt: 'somesalt==',
      passphraseVerifier: 'someverifier==',
    }) as never);

    expect(res.status).toBe(200);
    expect(stored()).toMatchObject({ passphraseRequired: true, passphraseSalt: 'somesalt==', passphraseVerifier: 'someverifier==' });
  });

  it('truncates note to 140 characters', async () => {
    await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV, note: 'a'.repeat(200) }) as never);
    expect(stored().note).toHaveLength(140);
  });

  it('returns 503 when Redis is not configured', async () => {
    const { KV_REST_API_URL } = process.env;
    delete process.env.KV_REST_API_URL;
    try {
      const res = await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV }) as never);
      expect(res.status).toBe(503);
    } finally {
      process.env.KV_REST_API_URL = KV_REST_API_URL;
    }
  });

  it('returns 500 when the store fails', async () => {
    storeMock.createSecret.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await POST(makeRequest({ ciphertext: VALID_CT, iv: VALID_IV }) as never);
    expect(res.status).toBe(500);
  });
});
