import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
    throw new Error('Integration tests require a disposable localhost database ending in _test.');
  }
}
const db = new PrismaClient({ datasourceUrl: databaseUrl || 'postgresql://unused@127.0.0.1/unused_test' });
vi.mock('@/lib/prisma', () => ({ get prisma() { return db; } }));
import { POST as retrieve } from '@/app/api/retrieve/[id]/route';
import { POST as destroy } from '@/app/api/secrets/[id]/destroy/route';
import { GET as prune } from '@/app/api/cron/prune/route';

const payload = {
  ciphertext: Buffer.from('encrypted fixture with tag').toString('base64'), iv: Buffer.alloc(12).toString('base64'),
  note: 'sensitive label', expiresAt: new Date(Date.now() + 3600_000),
  destroyToken: 'ab'.repeat(32), passphraseSalt: Buffer.alloc(16).toString('base64'),
  passphraseVerifier: Buffer.alloc(32, 1).toString('base64'),
};
function post(body: object = {}) {
  return new Request('http://localhost/api/retrieve/fixture', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });
async function expectErased(id: string, status: string) {
  expect(await db.secret.findUnique({ where: { id } })).toMatchObject({
    status, ciphertext: '', iv: '', note: null, passphraseSalt: null, passphraseVerifier: null, destroyToken: null,
  });
}

describe.skipIf(!databaseUrl)('PostgreSQL secret lifecycle and concurrency', () => {
  beforeAll(async () => { await db.$connect(); });
  beforeEach(async () => { await db.secret.deleteMany(); await db.secretRequest.deleteMany(); });
  afterAll(async () => { await db.secret.deleteMany(); await db.secretRequest.deleteMany(); await db.$disconnect(); });

  it('returns one payload for concurrent reveals and erases the stored fields', async () => {
    const secret = await db.secret.create({ data: payload });
    const responses = await Promise.all(Array.from({ length: 8 }, () => retrieve(post(), params(secret.id))));
    expect(responses.filter(r => r.status === 200)).toHaveLength(1);
    expect(responses.filter(r => r.status === 410)).toHaveLength(7);
    expect(await responses.find(r => r.status === 200)!.json()).toMatchObject({ ciphertext: payload.ciphertext, iv: payload.iv, note: payload.note });
    await expectErased(secret.id, 'OPENED');
  });

  it('caps concurrent wrong proofs at five, then rejects even the correct proof', async () => {
    const secret = await db.secret.create({ data: { ...payload, passphraseRequired: true } });
    const responses = await Promise.all(Array.from({ length: 16 }, () => retrieve(post({ passphraseVerifier: Buffer.alloc(32, 2).toString('base64') }), params(secret.id))));
    expect(responses.every(r => r.status === 403)).toBe(true);
    expect(await db.secret.findUnique({ where: { id: secret.id } })).toMatchObject({ passphraseAttempts: 5, status: 'ACTIVE', ciphertext: payload.ciphertext });
    expect((await retrieve(post({ passphraseVerifier: payload.passphraseVerifier }), params(secret.id))).status).toBe(403);
  });

  it('rejects a correct proof after the fifth failed attempt', async () => {
    const secret = await db.secret.create({ data: { ...payload, passphraseRequired: true, passphraseAttempts: 4 } });
    // A valid proof after the fifth failure must observe the committed lockout.
    expect((await retrieve(post({ passphraseVerifier: Buffer.alloc(32, 2).toString('base64') }), params(secret.id))).status).toBe(403);
    expect((await retrieve(post({ passphraseVerifier: payload.passphraseVerifier }), params(secret.id))).status).toBe(403);
  });

  it('allows exactly one winner between destroy and retrieval', async () => {
    const secret = await db.secret.create({ data: payload });
    const responses = await Promise.all([
      destroy(post({ destroyToken: payload.destroyToken }), params(secret.id)), retrieve(post(), params(secret.id)),
    ]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 410]);
    await expectErased(secret.id, responses[0].status === 200 ? 'DESTROYED' : 'OPENED');
  });

  it('clears linked request metadata in the burn transaction', async () => {
    const request = await db.secretRequest.create({ data: { token: 'integration-token', label: 'private label', note: 'private note', expiresAt: payload.expiresAt } });
    const secret = await db.secret.create({ data: { ...payload, requestId: request.id } });
    expect((await retrieve(post(), params(secret.id))).status).toBe(200);
    await expectErased(secret.id, 'OPENED');
    expect(await db.secretRequest.findUnique({ where: { id: request.id } })).toMatchObject({ status: 'OPENED', label: '', note: null });
  });

  it('erases expired secrets on retrieval and via cron, including submitted requests', async () => {
    const expired = await db.secret.create({ data: { ...payload, expiresAt: new Date(0) } });
    expect((await retrieve(post(), params(expired.id))).status).toBe(410);
    await expectErased(expired.id, 'EXPIRED');
    const request = await db.secretRequest.create({ data: { token: 'expired-token', label: 'private', note: 'private', status: 'SUBMITTED', expiresAt: new Date(0) } });
    const cronSecret = await db.secret.create({ data: { ...payload, expiresAt: new Date(0), requestId: request.id } });
    process.env.CRON_SECRET = 'integration-cron';
    expect((await prune(new Request('http://localhost/api/cron/prune', { headers: { authorization: 'Bearer integration-cron' } }) as never)).status).toBe(200);
    await expectErased(cronSecret.id, 'EXPIRED');
    expect(await db.secretRequest.findUnique({ where: { id: request.id } })).toMatchObject({ status: 'EXPIRED', label: '', note: null });
  });

  it('the historical cleanup migration erases terminal and expired payloads but preserves live links', async () => {
    const active = await db.secret.create({ data: payload });
    const closed = await db.secret.create({ data: { ...payload, destroyToken: 'cd'.repeat(32), status: 'OPENED' } });
    const expired = await db.secret.create({ data: { ...payload, destroyToken: 'ef'.repeat(32), expiresAt: new Date(0) } });
    const sql = readFileSync('prisma/migrations/0005_erase_closed_payloads/migration.sql', 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await db.$executeRawUnsafe(statement);
    await expectErased(closed.id, 'OPENED');
    await expectErased(expired.id, 'EXPIRED');
    expect(await db.secret.findUnique({ where: { id: active.id } })).toMatchObject({ ciphertext: payload.ciphertext, passphraseVerifier: payload.passphraseVerifier, status: 'ACTIVE' });
  });
});
