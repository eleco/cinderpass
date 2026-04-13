import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prismaMock } from '../mocks/prisma';

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/ratelimit', () => ({
  checkRateLimit: vi.fn(() => true),
  getIp: vi.fn(() => '127.0.0.1'),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })),
}));

import { GET, POST } from '@/app/api/retrieve/[id]/route';

const PARAMS = { params: Promise.resolve({ id: 'secret-abc' }) };
const FUTURE = new Date(Date.now() + 3600_000);
const PAST = new Date(Date.now() - 1000);
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
  it('returns metadata for an active, non-expired secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      expiresAt: FUTURE,
      passphraseRequired: false,
      passphraseSalt: null,
      note: 'test note',
    });

    const res = await GET(makeGet(), PARAMS);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.passphraseRequired).toBe(false);
    expect(data.note).toBe('test note');
  });

  it('returns 404 for unknown secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(null);

    const res = await GET(makeGet(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 410 for already-opened secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      status: 'OPENED',
      expiresAt: FUTURE,
      passphraseRequired: false,
      passphraseSalt: null,
      note: null,
    });

    const res = await GET(makeGet(), PARAMS);
    expect(res.status).toBe(410);
  });

  it('returns 410 for expired secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      expiresAt: PAST,
      passphraseRequired: false,
      passphraseSalt: null,
      note: null,
    });

    const res = await GET(makeGet(), PARAMS);
    expect(res.status).toBe(410);
  });

  it('indicates passphrase required when set', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      expiresAt: FUTURE,
      passphraseRequired: true,
      passphraseSalt: 'saltvalue==',
      note: null,
    });

    const res = await GET(makeGet(), PARAMS);
    const data = await res.json();
    expect(data.passphraseRequired).toBe(true);
    expect(data.passphraseSalt).toBe('saltvalue==');
  });
});

// ── POST (burn & reveal) ────────────────────────────────────────────────────

const ACTIVE_SECRET = {
  id: 'secret-abc',
  status: 'ACTIVE',
  expiresAt: FUTURE,
  ciphertext: VALID_CT,
  iv: VALID_IV,
  passphraseRequired: false,
  passphraseSalt: null,
  passphraseVerifier: null,
  passphraseAttempts: 0,
  note: null,
  requestId: null,
};

describe('POST /api/retrieve/[id] — burn & reveal', () => {
  it('returns ciphertext and marks secret as opened', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(ACTIVE_SECRET);
    prismaMock.secret.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makePost(), PARAMS);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.ciphertext).toBe(VALID_CT);
    expect(data.iv).toBe(VALID_IV);
    expect(prismaMock.secret.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'secret-abc', status: 'ACTIVE' }),
        data: expect.objectContaining({ status: 'OPENED' }),
      })
    );
  });

  it('the atomic burn includes expiresAt > now (prevents stale burn)', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(ACTIVE_SECRET);
    prismaMock.secret.updateMany.mockResolvedValue({ count: 1 });

    await POST(makePost(), PARAMS);

    const updateCall = prismaMock.secret.updateMany.mock.calls[0][0];
    expect(updateCall.where.expiresAt).toBeDefined();
    expect(updateCall.where.expiresAt.gt).toBeInstanceOf(Date);
  });

  it('returns 410 when atomic burn finds count=0 (race condition — already opened)', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(ACTIVE_SECRET);
    // Simulate another request winning the race
    prismaMock.secret.updateMany.mockResolvedValue({ count: 0 });

    const res = await POST(makePost(), PARAMS);
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error).toContain('already opened');
  });

  it('returns 404 for unknown secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue(null);

    const res = await POST(makePost(), PARAMS);
    expect(res.status).toBe(404);
  });

  it('returns 410 for already-opened secret', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({ ...ACTIVE_SECRET, status: 'OPENED' });

    const res = await POST(makePost(), PARAMS);
    expect(res.status).toBe(410);
  });

  it('returns 410 for expired secret and marks it expired', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({ ...ACTIVE_SECRET, expiresAt: PAST });
    prismaMock.secret.updateMany.mockResolvedValue({ count: 1 });

    const res = await POST(makePost(), PARAMS);
    expect(res.status).toBe(410);
    const data = await res.json();
    expect(data.error).toContain('expired');
  });

  it('returns 400 when passphrase required but not provided', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      ...ACTIVE_SECRET,
      passphraseRequired: true,
      passphraseSalt: 'salt==',
      passphraseVerifier: 'verifier==',
    });

    const res = await POST(makePost({}), PARAMS);
    expect(res.status).toBe(400);
  });

  it('returns 403 on wrong passphrase without burning the secret', async () => {
    const storedVerifier = btoa('correct-verifier');
    const wrongVerifier = btoa('wrong-verifier-xx');

    prismaMock.secret.findUnique.mockResolvedValue({
      ...ACTIVE_SECRET,
      passphraseRequired: true,
      passphraseSalt: 'salt==',
      passphraseVerifier: storedVerifier,
      passphraseAttempts: 0,
    });
    prismaMock.secret.update.mockResolvedValue({ passphraseAttempts: 1 });

    const res = await POST(makePost({ passphraseVerifier: wrongVerifier }), PARAMS);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('Incorrect passphrase');
    // The burn (updateMany) must NOT have been called
    expect(prismaMock.secret.updateMany).not.toHaveBeenCalled();
  });

  it('shows remaining attempts in wrong passphrase error', async () => {
    const storedVerifier = btoa('correct-verifier');
    const wrongVerifier = btoa('wrong-verifier-xx');

    prismaMock.secret.findUnique.mockResolvedValue({
      ...ACTIVE_SECRET,
      passphraseRequired: true,
      passphraseSalt: 'salt==',
      passphraseVerifier: storedVerifier,
      passphraseAttempts: 3,
    });
    prismaMock.secret.update.mockResolvedValue({ passphraseAttempts: 4 });

    const res = await POST(makePost({ passphraseVerifier: wrongVerifier }), PARAMS);
    const data = await res.json();
    expect(data.error).toContain('1 attempt');
  });

  it('waits for the passphrase attempt increment before returning', async () => {
    const storedVerifier = btoa('correct-verifier');
    const wrongVerifier = btoa('wrong-verifier-xx');

    prismaMock.secret.findUnique.mockResolvedValue({
      ...ACTIVE_SECRET,
      passphraseRequired: true,
      passphraseSalt: 'salt==',
      passphraseVerifier: storedVerifier,
      passphraseAttempts: 0,
    });

    prismaMock.secret.update.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve({ passphraseAttempts: 1 }), 25);
        }),
    );

    const start = Date.now();
    const res = await POST(makePost({ passphraseVerifier: wrongVerifier }), PARAMS);
    const elapsed = Date.now() - start;

    expect(res.status).toBe(403);
    expect(elapsed).toBeGreaterThanOrEqual(20);
  });

  it('returns 403 locked when passphrase attempts >= 5', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      ...ACTIVE_SECRET,
      passphraseRequired: true,
      passphraseSalt: 'salt==',
      passphraseVerifier: btoa('verifier'),
      passphraseAttempts: 5,
    });

    const res = await POST(makePost({ passphraseVerifier: btoa('anything') }), PARAMS);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain('locked');
    // No burn, no attempt increment
    expect(prismaMock.secret.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.secret.update).not.toHaveBeenCalled();
  });

  it('also updates linked SecretRequest status on successful burn', async () => {
    prismaMock.secret.findUnique.mockResolvedValue({
      ...ACTIVE_SECRET,
      requestId: 'req-xyz',
    });
    prismaMock.secret.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.secretRequest.update.mockResolvedValue({});

    await POST(makePost(), PARAMS);

    expect(prismaMock.secretRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'req-xyz' } })
    );
  });
});
