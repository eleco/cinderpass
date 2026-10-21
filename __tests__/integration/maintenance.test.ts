import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { execFileSync } from 'node:child_process';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
    throw new Error('Integration tests require a disposable localhost database ending in _test.');
  }
}
const db = new PrismaClient({ datasourceUrl: databaseUrl || 'postgresql://unused@127.0.0.1/unused_test' });
vi.mock('@/lib/prisma', () => ({ get prisma() { return db; } }));
import { GET as prune } from '@/app/api/cron/prune/route';
import { GET as metadata } from '@/app/api/retrieve/[id]/route';

const payload = {
  ciphertext: Buffer.from('leftover ciphertext').toString('base64'), iv: Buffer.alloc(12).toString('base64'),
  note: 'leftover label', passphraseSalt: Buffer.alloc(16).toString('base64'),
  passphraseVerifier: Buffer.alloc(32, 1).toString('base64'),
};
const future = () => new Date(Date.now() + 3600_000);
const erased = { ciphertext: '', iv: '', note: null, passphraseSalt: null, passphraseVerifier: null, destroyToken: null };

function runCron() {
  process.env.CRON_SECRET = 'integration-cron';
  return prune(new Request('http://localhost/api/cron/prune', { headers: { authorization: 'Bearer integration-cron' } }) as never);
}

// Runs the real npm script, pointed at the disposable database only.
function runScrub() {
  execFileSync('npm', ['run', '--silent', 'db:scrub'], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
}

describe.skipIf(!databaseUrl)('PostgreSQL maintenance: cron and db:scrub', () => {
  beforeAll(async () => { await db.$connect(); });
  beforeEach(async () => { await db.secret.deleteMany(); await db.secretRequest.deleteMany(); });
  afterAll(async () => { await db.secret.deleteMany(); await db.secretRequest.deleteMany(); await db.$disconnect(); });

  it('cron erases newly expired rows and leaves closed history alone', async () => {
    const expiring = await db.secret.create({ data: { ...payload, destroyToken: 'aa'.repeat(32), expiresAt: new Date(Date.now() - 1000) } });
    const live = await db.secret.create({ data: { ...payload, destroyToken: 'bb'.repeat(32), expiresAt: future() } });
    // A tombstone with a leftover payload, as an old release or a backup restore could leave.
    const legacyClosed = await db.secret.create({ data: { ...payload, status: 'OPENED', expiresAt: future() } });

    const res = await runCron();
    expect(await res.json()).toMatchObject({ pruned: { secrets: 1, requests: 0 } });
    expect(await db.secret.findUnique({ where: { id: expiring.id } })).toMatchObject({ status: 'EXPIRED', ...erased });
    expect(await db.secret.findUnique({ where: { id: live.id } })).toMatchObject({ status: 'ACTIVE', ciphertext: payload.ciphertext });
    // No hourly re-scan of closed rows: that is now db:scrub's job.
    expect(await db.secret.findUnique({ where: { id: legacyClosed.id } })).toMatchObject({ ciphertext: payload.ciphertext });
  });

  it('db:scrub erases leftover closed payloads, keeps live links, and is idempotent', async () => {
    const live = await db.secret.create({ data: { ...payload, destroyToken: 'cc'.repeat(32), expiresAt: future() } });
    const closed = await db.secret.create({ data: { ...payload, status: 'DESTROYED', expiresAt: future() } });
    const request = await db.secretRequest.create({ data: { token: 'scrub-token', label: 'private label', note: 'private note', status: 'OPENED', expiresAt: future() } });

    runScrub();
    runScrub();

    expect(await db.secret.findUnique({ where: { id: closed.id } })).toMatchObject({ status: 'DESTROYED', ...erased });
    expect(await db.secretRequest.findUnique({ where: { id: request.id } })).toMatchObject({ status: 'OPENED', label: '', note: null });
    expect(await db.secret.findUnique({ where: { id: live.id } })).toMatchObject({ status: 'ACTIVE', ciphertext: payload.ciphertext, destroyToken: 'cc'.repeat(32) });
  }, 60_000);
});

describe.skipIf(!databaseUrl)('PostgreSQL metadata statuses the reader retries on', () => {
  const get = (id: string, ip: string) => metadata(new Request(`http://localhost/api/retrieve/${id}`, { headers: { 'x-forwarded-for': ip } }), { params: Promise.resolve({ id }) });

  beforeAll(async () => { await db.$connect(); });
  beforeEach(async () => { await db.secret.deleteMany(); });

  it('returns final 404/410 for missing or opened secrets, which the reader does not retry', async () => {
    const opened = await db.secret.create({ data: { ...erased, ciphertext: '', iv: '', status: 'OPENED', expiresAt: future() } });
    expect((await get('does-not-exist', '203.0.113.10')).status).toBe(404);
    expect((await get(opened.id, '203.0.113.10')).status).toBe(410);
  });

  it('returns a transient 429 after the per-IP limit, and a fresh client still gets metadata', async () => {
    const live = await db.secret.create({ data: { ...payload, expiresAt: future() } });
    const statuses = [];
    for (let i = 0; i < 21; i++) statuses.push((await get(live.id, '203.0.113.20')).status);
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
    const body = await (await get(live.id, '203.0.113.21')).json();
    expect(body).toMatchObject({ passphraseRequired: false, passphraseSalt: payload.passphraseSalt, note: payload.note });
  });
});
