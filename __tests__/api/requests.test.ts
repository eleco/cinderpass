import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratelimitMock, storeMock } from '../mocks/store';

vi.mock('@/lib/store', () => storeMock);
vi.mock('@/lib/ratelimit', () => ratelimitMock);

import { POST as createRequest } from '@/app/api/requests/route';
import { POST as submitRequest } from '@/app/api/requests/[token]/submit/route';

const VALID_IV = btoa(String.fromCharCode(...new Array(12).fill(0)));
const VALID_CT = btoa('encrypted secret');

function post(url: string, body: Record<string, unknown>) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as never;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── POST /api/requests ──────────────────────────────────────────────────────

describe('POST /api/requests', () => {
  const create = (body: Record<string, unknown>) => createRequest(post('http://localhost/api/requests', body));

  it('creates a request and returns requestUrl', async () => {
    storeMock.createRequest.mockResolvedValue('tok-abc');

    const res = await create({ label: 'Please send your SSH key', ttlHours: 24 });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.requestUrl).toContain('/request/tok-abc');
  });

  it('returns 400 when label is missing', async () => {
    const res = await create({ ttlHours: 24 });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('label');
  });

  it('returns 400 when label is whitespace only', async () => {
    expect((await create({ label: '   ' })).status).toBe(400);
  });

  it('defaults to 24h TTL for invalid ttlHours', async () => {
    storeMock.createRequest.mockResolvedValue('tok-def');
    await create({ label: 'test', ttlHours: 9999 });

    const diff = storeMock.createRequest.mock.calls[0][0].expiresAt.getTime() - Date.now();
    expect(diff).toBeGreaterThan((86400 - 5) * 1000);
  });

  it('truncates label to 100 characters', async () => {
    storeMock.createRequest.mockResolvedValue('tok-ghi');
    await create({ label: 'a'.repeat(200) });
    expect(storeMock.createRequest.mock.calls[0][0].label).toHaveLength(100);
  });
});

// ── POST /api/requests/[token]/submit ───────────────────────────────────────

describe('POST /api/requests/[token]/submit', () => {
  const PARAMS = { params: Promise.resolve({ token: 'valid-token' }) };
  const submit = (body: Record<string, unknown>) =>
    submitRequest(post('http://localhost/api/requests/valid-token/submit', body), PARAMS);

  it('submits a secret for an open request and returns revealUrl', async () => {
    storeMock.submitToRequest.mockResolvedValue({ state: 'submitted', id: 'submitted-secret' });

    const res = await submit({ ciphertext: VALID_CT, iv: VALID_IV, note: '  for prod  ' });
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.revealUrl).toContain('/secret/submitted-secret');
    expect(storeMock.submitToRequest).toHaveBeenCalledWith('valid-token', expect.objectContaining({
      ciphertext: VALID_CT, iv: VALID_IV, note: 'for prod', passphraseRequired: false,
    }));
  });

  it('returns 404 for unknown token', async () => {
    storeMock.submitToRequest.mockResolvedValue({ state: 'missing' });
    expect((await submit({ ciphertext: VALID_CT, iv: VALID_IV })).status).toBe(404);
  });

  it('returns 410 for an expired or already-used request', async () => {
    storeMock.submitToRequest.mockResolvedValue({ state: 'closed' });
    const res = await submit({ ciphertext: VALID_CT, iv: VALID_IV });
    expect(res.status).toBe(410);
    expect((await res.json()).error).toBe('Request is closed');
  });

  it('rejects invalid ciphertext payload', async () => {
    expect((await submit({ ciphertext: 'not!!valid', iv: VALID_IV })).status).toBe(400);
    expect(storeMock.submitToRequest).not.toHaveBeenCalled();
  });

  it('rejects passphrase flag without salt/verifier', async () => {
    expect((await submit({ ciphertext: VALID_CT, iv: VALID_IV, passphraseRequired: true })).status).toBe(400);
  });
});
