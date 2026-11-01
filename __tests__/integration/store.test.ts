import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Runs the Lua scripts against a real Redis behind Upstash's REST protocol, e.g.
// serverless-redis-http (see README). Skipped unless TEST_REDIS_URL is set.
const redisUrl = process.env.TEST_REDIS_URL;
if (redisUrl) {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(redisUrl).hostname)) {
    throw new Error('Integration tests flush the database; TEST_REDIS_URL must point at localhost.');
  }
  process.env.KV_REST_API_URL = redisUrl;
  process.env.KV_REST_API_TOKEN = process.env.TEST_REDIS_TOKEN ?? 'test-token';
}

import { getRedis } from '@/lib/redis';
import {
  createRequest, createSecret, destroySecret, getRequest, getSecretMetadata, revealSecret, submitToRequest,
} from '@/lib/store';
import { POST as createRoute } from '@/app/api/secrets/route';
import { GET as metadataRoute, POST as retrieveRoute } from '@/app/api/retrieve/[id]/route';

const DESTROY_TOKEN = 'ab'.repeat(32);
const secret = (overrides: Record<string, unknown> = {}) => ({
  ciphertext: Buffer.from('encrypted fixture with tag').toString('base64'),
  iv: Buffer.alloc(12).toString('base64'),
  note: 'sensitive label',
  expiresAt: new Date(Date.now() + 3600_000),
  passphraseRequired: false,
  passphraseSalt: null,
  passphraseVerifier: null,
  ...overrides,
});
const protectedSecret = () => secret({
  passphraseRequired: true, passphraseSalt: `v2.${Buffer.alloc(16).toString('base64')}`,
  passphraseVerifier: Buffer.alloc(32, 1).toString('base64'),
});
const WRONG = Buffer.alloc(32, 2).toString('base64');
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe.skipIf(!redisUrl)('Redis store', () => {
  beforeAll(async () => { await getRedis().ping(); });
  beforeEach(async () => { await getRedis().flushdb(); });

  it('returns the payload to exactly one of many concurrent reveals and deletes it', async () => {
    const id = await createSecret(secret(), DESTROY_TOKEN);
    const results = await Promise.all(Array.from({ length: 10 }, () => revealSecret(id, null)));

    const opened = results.filter((r) => r.state === 'opened');
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatchObject({ payload: { note: 'sensitive label', passphraseRequired: false } });
    expect(results.filter((r) => r.state === 'closed')).toHaveLength(9);
    expect(await getRedis().exists(`secret:${id}`)).toBe(0);
    expect(await getSecretMetadata(id)).toEqual({ state: 'closed', reason: 'opened' });
  });

  it('counts failed passphrase proofs, locks after five, and never burns a locked secret', async () => {
    const id = await createSecret(protectedSecret(), DESTROY_TOKEN);

    expect(await revealSecret(id, null)).toEqual({ state: 'proof_required' });
    for (let remaining = 4; remaining >= 0; remaining--) {
      expect(await revealSecret(id, WRONG)).toEqual({ state: 'wrong', remaining });
    }
    expect(await revealSecret(id, protectedSecret().passphraseVerifier)).toEqual({ state: 'locked' });
    expect(await getRedis().exists(`secret:${id}`)).toBe(1);
  });

  it('serializes concurrent wrong guesses so no more than five are counted', async () => {
    const id = await createSecret(protectedSecret(), DESTROY_TOKEN);
    const results = await Promise.all(Array.from({ length: 12 }, () => revealSecret(id, WRONG)));
    expect(results.filter((r) => r.state === 'wrong')).toHaveLength(5);
    expect(results.filter((r) => r.state === 'locked')).toHaveLength(7);
  });

  it('opens a protected secret with the correct proof', async () => {
    const id = await createSecret(protectedSecret(), DESTROY_TOKEN);
    await revealSecret(id, WRONG);
    const result = await revealSecret(id, protectedSecret().passphraseVerifier);
    expect(result).toMatchObject({ state: 'opened', payload: { passphraseRequired: true, passphraseSalt: protectedSecret().passphraseSalt } });
  });

  it('destroys only with the right token', async () => {
    const id = await createSecret(secret(), DESTROY_TOKEN);
    expect(await destroySecret(id, 'cd'.repeat(32))).toEqual({ state: 'forbidden' });
    expect(await destroySecret(id, DESTROY_TOKEN.toUpperCase())).toEqual({ state: 'destroyed' });
    expect(await revealSecret(id, null)).toEqual({ state: 'closed', reason: 'destroyed' });
    expect(await destroySecret(id, DESTROY_TOKEN)).toEqual({ state: 'closed', reason: 'destroyed' });
    expect(await destroySecret('unknown', DESTROY_TOKEN)).toEqual({ state: 'missing' });
  });

  it('lets Redis expire secrets and reports them as expired', async () => {
    const id = await createSecret(secret({ expiresAt: new Date(Date.now() + 300) }), DESTROY_TOKEN);
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(await getRedis().exists(`secret:${id}`)).toBe(0);
    expect(await revealSecret(id, null)).toEqual({ state: 'closed', reason: 'expired' });
  });

  it('gives every key an expiry', async () => {
    const id = await createSecret(protectedSecret(), DESTROY_TOKEN);
    await revealSecret(id, WRONG);
    const token = await createRequest({ label: 'Prod DB password', note: null, expiresAt: new Date(Date.now() + 3600_000) });
    await submitToRequest(token, { ...secret(), note: null });
    const opened = await createSecret(secret(), DESTROY_TOKEN);
    await revealSecret(opened, null);

    const keys = await getRedis().keys('*');
    expect(keys.length).toBeGreaterThanOrEqual(6);
    for (const key of keys) expect(await getRedis().pttl(key), key).toBeGreaterThan(0);
  });

  it('accepts one secret per request and closes the request when the secret is opened', async () => {
    const expiresAt = new Date(Date.now() + 3600_000);
    const token = await createRequest({ label: 'Prod DB password', note: 'rotate after', expiresAt });
    expect(await getRequest(token)).toMatchObject({ state: 'open', label: 'Prod DB password', note: 'rotate after' });

    const submitted = await submitToRequest(token, { ...secret(), note: null });
    expect(submitted.state).toBe('submitted');
    expect(await submitToRequest(token, { ...secret(), note: null })).toEqual({ state: 'closed' });
    expect(await getRequest(token)).toMatchObject({ state: 'used' });
    expect(await submitToRequest('unknown', { ...secret(), note: null })).toEqual({ state: 'missing' });

    const id = (submitted as { id: string }).id;
    expect(await getRedis().pttl(`secret:${id}`)).toBeLessThanOrEqual(expiresAt.getTime() - Date.now() + 50);
    expect(await destroySecret(id, DESTROY_TOKEN)).toEqual({ state: 'no_token' });
    expect(await revealSecret(id, null)).toMatchObject({ state: 'opened', payload: { note: 'Prod DB password' } });
    expect(await getRedis().exists(`request:${token}`)).toBe(0);
    expect(await getRequest(token)).toEqual({ state: 'closed', reason: 'opened' });
    expect(await submitToRequest(token, { ...secret(), note: null })).toEqual({ state: 'closed' });
  });

  it('works end to end through the route handlers', async () => {
    const created = await createRoute(new Request('http://localhost/api/secrets', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ciphertext: secret().ciphertext, iv: secret().iv, ttlHours: 1 }),
    }) as never);
    const { id } = await created.json();

    expect((await metadataRoute(new Request(`http://localhost/api/retrieve/${id}`), params(id))).status).toBe(200);
    const post = () => retrieveRoute(new Request(`http://localhost/api/retrieve/${id}`, { method: 'POST', body: '{}' }), params(id));
    const first = await post();
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({ ciphertext: secret().ciphertext, iv: secret().iv, note: null });
    expect((await post()).status).toBe(410);
  });
});
