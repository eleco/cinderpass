import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratelimitMock, storeMock } from '../mocks/store';

vi.mock('@/lib/store', () => storeMock);
vi.mock('@/lib/ratelimit', () => ratelimitMock);

import { GET, POST } from '@/app/api/retrieve/[id]/route';

const PARAMS = { params: Promise.resolve({ id: 'secret-abc' }) };
const VALID_IV = btoa(String.fromCharCode(...new Array(12).fill(0)));
const VALID_CT = btoa('super secret payload');

function makeGet() {
  return new Request('http://localhost/api/retrieve/secret-abc');
}

function makePost(body: Record<string, unknown> = {}) {
  return new Request('http://localhost/api/retrieve/secret-abc', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET (metadata) ──────────────────────────────────────────────────────────

describe('GET /api/retrieve/[id]', () => {
  it('returns metadata for an active secret', async () => {
    storeMock.getSecretMetadata.mockResolvedValue({
      state: 'active', passphraseRequired: true, passphraseSalt: 'v2.salt', note: 'test note',
    });

    const res = await GET(makeGet(), PARAMS);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toEqual({ passphraseRequired: true, passphraseSalt: 'v2.salt', note: 'test note' });
  });

  it('returns 404 for unknown secret', async () => {
    storeMock.getSecretMetadata.mockResolvedValue({ state: 'missing' });
    expect((await GET(makeGet(), PARAMS)).status).toBe(404);
  });

  it('returns 410 for already-opened secret', async () => {
    storeMock.getSecretMetadata.mockResolvedValue({ state: 'closed', reason: 'opened' });
    const res = await GET(makeGet(), PARAMS);
    expect(res.status).toBe(410);
    expect((await res.json()).error).toContain('already opened');
  });

  it('returns 410 for expired secret', async () => {
    storeMock.getSecretMetadata.mockResolvedValue({ state: 'closed', reason: 'expired' });
    const res = await GET(makeGet(), PARAMS);
    expect(res.status).toBe(410);
    expect((await res.json()).error).toContain('expired');
  });

  it('is rate limited', async () => {
    ratelimitMock.checkRateLimit.mockReturnValueOnce(false);
    expect((await GET(makeGet(), PARAMS)).status).toBe(429);
    expect(storeMock.getSecretMetadata).not.toHaveBeenCalled();
  });
});

// ── POST (reveal + burn) ───────────────────────────────────────────────────

describe('POST /api/retrieve/[id]', () => {
  it('returns the payload once opened, uncached', async () => {
    storeMock.revealSecret.mockResolvedValue({
      state: 'opened',
      payload: { ciphertext: VALID_CT, iv: VALID_IV, note: null, passphraseRequired: false, passphraseSalt: null },
    });

    const res = await POST(makePost(), PARAMS);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(data).toMatchObject({ ciphertext: VALID_CT, iv: VALID_IV, passphraseRequired: false });
    expect(data.openedAt).toBeTruthy();
    expect(storeMock.revealSecret).toHaveBeenCalledWith('secret-abc', null);
  });

  it('passes the passphrase proof to the store', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'wrong', remaining: 4 });
    await POST(makePost({ passphraseVerifier: 'proof==' }), PARAMS);
    expect(storeMock.revealSecret).toHaveBeenCalledWith('secret-abc', 'proof==');
  });

  it('drops malformed or oversized proofs', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'proof_required' });
    await POST(makePost({ passphraseVerifier: 'x'.repeat(129) }), PARAMS);
    await POST(makePost({ passphraseVerifier: 42 }), PARAMS);
    expect(storeMock.revealSecret.mock.calls.map((call) => call[1])).toEqual([null, null]);
  });

  it('returns 404 for unknown secret', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'missing' });
    expect((await POST(makePost(), PARAMS)).status).toBe(404);
  });

  it('returns 410 for opened, destroyed or expired secrets', async () => {
    for (const reason of ['opened', 'destroyed', 'expired']) {
      storeMock.revealSecret.mockResolvedValue({ state: 'closed', reason });
      expect((await POST(makePost(), PARAMS)).status).toBe(410);
    }
  });

  it('returns 400 when passphrase proof is required', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'proof_required' });
    const res = await POST(makePost(), PARAMS);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Passphrase proof');
  });

  it('shows remaining attempts on a wrong passphrase', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'wrong', remaining: 1 });
    const res = await POST(makePost({ passphraseVerifier: 'bad' }), PARAMS);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('Incorrect passphrase. 1 attempt remaining.');
  });

  it('says the secret is now locked after the last wrong attempt', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'wrong', remaining: 0 });
    const res = await POST(makePost({ passphraseVerifier: 'bad' }), PARAMS);
    expect((await res.json()).error).toBe('Incorrect passphrase. This secret is now locked.');
  });

  it('returns 403 for a locked secret', async () => {
    storeMock.revealSecret.mockResolvedValue({ state: 'locked' });
    const res = await POST(makePost({ passphraseVerifier: 'good' }), PARAMS);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('locked');
  });

  it('returns 500 when the store fails', async () => {
    storeMock.revealSecret.mockRejectedValue(new Error('down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await POST(makePost(), PARAMS)).status).toBe(500);
  });
});
