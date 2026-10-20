import { describe, expect, it } from 'vitest';
import { createSecretMaterial, decryptSecretMaterial, resolveSecretKey } from '@/lib/crypto';
import { base64ToBytes, bytesToBase64 } from '@/lib/encoding';
import { createPassphraseProof, derivePassphraseSecrets } from '@/lib/passphrase';
import { hkdfSync, pbkdf2Sync } from 'node:crypto';

const PASS = 'correct horse battery staple';

describe('secret encryption', () => {
  it('roundtrips unicode and empty plaintext with independent random keys and IVs', async () => {
    for (const text of ['', '秘密 🔑 café\nsecond line']) {
      const a = await createSecretMaterial(text), b = await createSecretMaterial(text);
      expect(a.iv).not.toBe(b.iv);
      expect(a.keyFragment).not.toBe(b.keyFragment);
      expect(await decryptSecretMaterial({ ...a, key: await resolveSecretKey(a.keyFragment, null) })).toBe(text);
    }
  });
  it('masks new keys with an HKDF expansion of the server-salted PBKDF2 master', async () => {
    const proof = await createPassphraseProof(PASS);
    const a = await createSecretMaterial('secret', proof.keyMask);
    expect(a.keyFragment).toMatch(/^v2\.[A-Za-z0-9+/]{43}=$/);
    // Independent Node crypto check pins the protocol and work factor, rather
    // than merely checking that our encrypt/decrypt implementations agree.
    const master = pbkdf2Sync(PASS, Buffer.from(proof.salt.slice(3), 'base64'), 600_000, 32, 'sha256');
    const mask = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'cinderpass:key-mask:v2', 32));
    const verifier = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'cinderpass:verifier:v2', 32));
    expect(proof.verifier).toBe(verifier.toString('base64'));
    const raw = Uint8Array.from(Buffer.from(a.keyFragment.slice(3), 'base64'), (v, i) => v ^ mask[i]);
    expect(await decryptSecretMaterial({ ...a, key: raw })).toBe('secret');
    const key = await resolveSecretKey(a.keyFragment, { passphrase: PASS, keyMask: proof.keyMask });
    expect(await decryptSecretMaterial({ ...a, key })).toBe('secret');
  });
  it('gives a link holder no offline oracle for passphrase guesses', async () => {
    const proof = await createPassphraseProof(PASS);
    const a = await createSecretMaterial('secret', proof.keyMask);
    // A wrong guess still yields a well-formed 32-byte key; only the ciphertext,
    // released after the server's rate-limited proof check, can tell it apart.
    const guess = await derivePassphraseSecrets('wrong', proof.salt);
    const key = await resolveSecretKey(a.keyFragment, { passphrase: 'wrong', keyMask: guess.keyMask });
    expect(key).toHaveLength(32);
    await expect(decryptSecretMaterial({ ...a, key })).rejects.toThrow();
  });
  it('reads legacy XOR-protected links without generating new ones', async () => {
    const original = await createSecretMaterial('legacy secret');
    const raw = Buffer.from(original.keyFragment, 'base64');
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('old passphrase')));
    const legacy = bytesToBase64(Uint8Array.from(raw, (v, i) => v ^ hash[i]));
    const key = await resolveSecretKey(legacy, { passphrase: 'old passphrase', keyMask: null });
    expect(await decryptSecretMaterial({ ...original, key })).toBe('legacy secret');
  });
  it('rejects missing, malformed, truncated, unknown-version and mismatched keys', async () => {
    for (const fragment of ['', 'invalid', 'YQ==', 'v3.anything', 'v2.bad', `v2.${bytesToBase64(new Uint8Array(32))}`]) {
      await expect(resolveSecretKey(fragment, null)).rejects.toThrow();
    }
    const plain = await createSecretMaterial('secret');
    await expect(resolveSecretKey(plain.keyFragment, { passphrase: 'p', keyMask: new Uint8Array(32) })).rejects.toThrow();
    await expect(resolveSecretKey(plain.keyFragment, { passphrase: '', keyMask: null })).rejects.toThrow('requires a passphrase');
  });
  it('returns the raw key for an unprotected secret', async () => {
    const secret = await createSecretMaterial('secret');
    expect(await resolveSecretKey(secret.keyFragment, null)).toEqual(base64ToBytes(secret.keyFragment));
  });
});

describe('passphrase verification versions', () => {
  it('derives independent verifier and mask from one fresh salt per proof', async () => {
    const a = await createPassphraseProof('passphrase'), b = await createPassphraseProof('passphrase');
    expect(a.salt.startsWith('v2.')).toBe(true);
    expect(a.salt).not.toBe(b.salt);
    expect(a.verifier).not.toBe(bytesToBase64(a.keyMask));
  });
  it('continues to verify existing 120,000-iteration proofs', async () => {
    const salt = Buffer.alloc(16, 1).toString('base64');
    const secrets = await derivePassphraseSecrets('legacy', salt);
    expect(secrets.verifier).toBe(pbkdf2Sync('legacy', Buffer.from(salt, 'base64'), 120_000, 32, 'sha256').toString('base64'));
    expect(secrets.keyMask).toBeNull();
  });
});
