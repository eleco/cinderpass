import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { NextRequest } from 'next/server';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (databaseUrl) {
  const url = new URL(databaseUrl);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || !url.pathname.endsWith('_test')) {
    throw new Error('Integration tests require a disposable localhost database ending in _test.');
  }
}
const db = new PrismaClient({ datasourceUrl: databaseUrl || 'postgresql://unused@127.0.0.1/unused_test' });
vi.mock('@/lib/prisma', () => ({ get prisma() { return db; } }));
import { POST as createSecret } from '@/app/api/secrets/route';
import { POST as submitToRequest } from '@/app/api/requests/[token]/submit/route';
import { GET as metadata, POST as retrieve } from '@/app/api/retrieve/[id]/route';
import { createSecretMaterial } from '@/lib/crypto';
import { bytesToBase64 } from '@/lib/encoding';
import { createPassphraseProof, derivePassphraseBits } from '@/lib/passphrase';
import { retrieveAndDecryptSecret } from '@/lib/reveal';

const PASS = 'correct horse battery staple';
let ipCounter = 0;

// Each test uses its own client IP so the per-instance rate limiter never interferes.
function jsonRequest(url: string, body: object, ip: string) {
  return new NextRequest(url, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'x-forwarded-for': ip } });
}

// Route the browser-side reveal helper's fetch to the real retrieve handler.
function routeFetchToHandlers(ip: string) {
  const fetcher = vi.fn(async (input: string, init: RequestInit) => {
    const id = input.split('/').pop()!;
    const request = new Request(`http://localhost${input}`, { ...init, headers: { ...init.headers as object, 'x-forwarded-for': ip } });
    return retrieve(request, { params: Promise.resolve({ id }) });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

/** Runs the same steps as the create form, then the reader page's metadata GET. */
async function createProtected(plaintext: string, passphrase: string, ip: string) {
  const proof = await createPassphraseProof(passphrase);
  const material = await createSecretMaterial(plaintext, proof.keyMask);
  const response = await createSecret(jsonRequest('http://localhost/api/secrets', {
    ciphertext: material.ciphertext, iv: material.iv, ttlHours: 1,
    passphraseRequired: true, passphraseSalt: proof.salt, passphraseVerifier: proof.verifier,
  }, ip));
  expect(response.status).toBe(200);
  const { id } = await response.json();
  const meta = await (await metadata(new Request(`http://localhost/api/retrieve/${id}`, { headers: { 'x-forwarded-for': ip } }), { params: Promise.resolve({ id }) })).json();
  return { id, proof, material, salt: meta.passphraseSalt as string };
}

describe.skipIf(!databaseUrl)('PostgreSQL passphrase-protected reveal (v2 masked keys)', () => {
  let ip = '';
  beforeAll(async () => { await db.$connect(); });
  beforeEach(async () => { ip = `198.51.100.${++ipCounter}`; await db.secret.deleteMany(); await db.secretRequest.deleteMany(); });
  afterEach(() => vi.unstubAllGlobals());
  afterAll(async () => { await db.secret.deleteMany(); await db.secretRequest.deleteMany(); await db.$disconnect(); });

  it('stores only the salt and verifier, never the key mask or link fragment', async () => {
    const { id, proof, material, salt } = await createProtected('db secret', PASS, ip);
    expect(salt).toBe(proof.salt);
    const row = await db.secret.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ passphraseRequired: true, passphraseSalt: proof.salt, passphraseVerifier: proof.verifier, status: 'ACTIVE' });
    const stored = JSON.stringify(row);
    expect(stored).not.toContain(bytesToBase64(proof.keyMask));
    expect(stored).not.toContain(material.keyFragment.slice(3));
  });

  it('counts a wrong passphrase at the server without burning, then reveals with the right one', async () => {
    const { id, material, salt } = await createProtected('production db password', PASS, ip);
    const fetcher = routeFetchToHandlers(ip);
    const params = { id, keyFragment: material.keyFragment, passphraseRequired: true, passphraseSalt: salt };

    await expect(retrieveAndDecryptSecret({ ...params, passphrase: 'wrong guess' })).rejects.toThrow('4 attempts remaining');
    expect(await db.secret.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'ACTIVE', passphraseAttempts: 1, ciphertext: material.ciphertext });

    expect(await retrieveAndDecryptSecret({ ...params, passphrase: PASS })).toEqual({ plaintext: 'production db password', note: null });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(await db.secret.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'OPENED', ciphertext: '', passphraseSalt: null, passphraseVerifier: null });
  });

  it('locks after five wrong passphrases so the right one can no longer release the ciphertext', async () => {
    const { id, material, salt } = await createProtected('locked secret', PASS, ip);
    routeFetchToHandlers(ip);
    const params = { id, keyFragment: material.keyFragment, passphraseRequired: true, passphraseSalt: salt };
    for (let i = 0; i < 5; i++) await expect(retrieveAndDecryptSecret({ ...params, passphrase: `guess ${i}` })).rejects.toThrow('Incorrect passphrase');
    await expect(retrieveAndDecryptSecret({ ...params, passphrase: PASS })).rejects.toThrow('locked');
    expect(await db.secret.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'ACTIVE', passphraseAttempts: 5 });
  });

  it('does not contact the server when the link fragment is malformed', async () => {
    const { id, salt } = await createProtected('intact secret', PASS, ip);
    const fetcher = routeFetchToHandlers(ip);
    await expect(retrieveAndDecryptSecret({ id, keyFragment: 'v2.truncated', passphraseRequired: true, passphraseSalt: salt, passphrase: PASS })).rejects.toThrow('has not been retrieved');
    expect(fetcher).not.toHaveBeenCalled();
    expect(await db.secret.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'ACTIVE', passphraseAttempts: 0 });
  });

  it('supports protected secrets submitted through a request page', async () => {
    await db.secretRequest.create({ data: { token: 'v2-request', label: 'Staging key', expiresAt: new Date(Date.now() + 3600_000) } });
    const proof = await createPassphraseProof(PASS);
    const material = await createSecretMaterial('requested key', proof.keyMask);
    const submitted = await submitToRequest(jsonRequest('http://localhost/api/requests/v2-request/submit', {
      ciphertext: material.ciphertext, iv: material.iv, passphraseRequired: true, passphraseSalt: proof.salt, passphraseVerifier: proof.verifier,
    }, ip), { params: Promise.resolve({ token: 'v2-request' }) });
    expect(submitted.status).toBe(200);
    const id = (await submitted.json()).revealUrl.split('/').pop();
    routeFetchToHandlers(ip);
    const result = await retrieveAndDecryptSecret({ id, keyFragment: material.keyFragment, passphraseRequired: true, passphraseSalt: proof.salt, passphrase: PASS });
    expect(result).toEqual({ plaintext: 'requested key', note: 'Staging key' });
  });

  it('still reveals legacy links (unversioned salt and SHA-256/XOR fragment)', async () => {
    const material = await createSecretMaterial('legacy secret');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('old passphrase')));
    const legacyFragment = bytesToBase64(Uint8Array.from(Buffer.from(material.keyFragment, 'base64'), (v, i) => v ^ hash[i]));
    const salt = Buffer.alloc(16, 7).toString('base64');
    const verifier = bytesToBase64(await derivePassphraseBits('old passphrase', new Uint8Array(Buffer.from(salt, 'base64')), 120_000));
    const row = await db.secret.create({ data: {
      ciphertext: material.ciphertext, iv: material.iv, expiresAt: new Date(Date.now() + 3600_000),
      passphraseRequired: true, passphraseSalt: salt, passphraseVerifier: verifier,
    } });
    routeFetchToHandlers(ip);
    const result = await retrieveAndDecryptSecret({ id: row.id, keyFragment: legacyFragment, passphraseRequired: true, passphraseSalt: salt, passphrase: 'old passphrase' });
    expect(result.plaintext).toBe('legacy secret');
  });
});
