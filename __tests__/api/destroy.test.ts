import { describe, it, expect, vi, beforeEach } from 'vitest';
import { storeMock } from '../mocks/store';

vi.mock('@/lib/store', () => storeMock);

import { POST } from '@/app/api/secrets/[id]/destroy/route';

const PARAMS = { params: Promise.resolve({ id: 'secret-xyz' }) };
const TOKEN = 'ab'.repeat(32);

function makeRequest(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/secrets/secret-xyz/destroy', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/secrets/[id]/destroy', () => {
  it('destroys an active secret with valid token', async () => {
    storeMock.destroySecret.mockResolvedValue({ state: 'destroyed' });

    const res = await POST(makeRequest({ destroyToken: TOKEN }), PARAMS);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ destroyed: true });
    expect(storeMock.destroySecret).toHaveBeenCalledWith('secret-xyz', TOKEN);
  });

  it('returns 400 when destroyToken is missing', async () => {
    const res = await POST(makeRequest({}), PARAMS);
    expect(res.status).toBe(400);
    expect(storeMock.destroySecret).not.toHaveBeenCalled();
  });

  it.each([
    [{ state: 'missing' }, 404],
    [{ state: 'closed', reason: 'opened' }, 410],
    [{ state: 'closed', reason: 'destroyed' }, 410],
    [{ state: 'forbidden' }, 403],
    [{ state: 'no_token' }, 409],
  ])('maps %o to HTTP %i', async (result, status) => {
    storeMock.destroySecret.mockResolvedValue(result);
    expect((await POST(makeRequest({ destroyToken: TOKEN }), PARAMS)).status).toBe(status);
  });
});
