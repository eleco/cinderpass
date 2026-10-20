import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSecretMaterial } from '@/lib/crypto';
import { createPassphraseProof } from '@/lib/passphrase';
import { retrieveAndDecryptSecret } from '@/lib/reveal';
afterEach(() => vi.unstubAllGlobals());

describe('safe reveal orchestration', () => {
  it('reveals an unprotected secret despite accidental passphrase input', async () => {
    const encrypted = await createSecretMaterial('fixture secret');
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...encrypted, note: 'fixture' }));
    vi.stubGlobal('fetch', fetcher);
    expect(await retrieveAndDecryptSecret({ id: 'fixture', keyFragment: encrypted.keyFragment, passphraseRequired: false, passphraseSalt: null, passphrase: 'accidental' })).toEqual({ plaintext: 'fixture secret', note: 'fixture' });
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({});
  });
  it('never sends a burn request for malformed key fragments or a missing passphrase', async () => {
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(retrieveAndDecryptSecret({ id: 'fixture', keyFragment: 'bad-key', passphraseRequired: false, passphraseSalt: null, passphrase: '' })).rejects.toThrow();
    const proof = await createPassphraseProof('correct');
    const encrypted = await createSecretMaterial('protected', proof.keyMask);
    await expect(retrieveAndDecryptSecret({ id: 'fixture', keyFragment: encrypted.keyFragment, passphraseRequired: true, passphraseSalt: proof.salt, passphrase: '' })).rejects.toThrow('requires a passphrase');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('leaves passphrase checking to the server proof and decrypts on success', async () => {
    const proof = await createPassphraseProof('correct');
    const encrypted = await createSecretMaterial('protected', proof.keyMask);
    const params = { id: 'fixture', keyFragment: encrypted.keyFragment, passphraseRequired: true, passphraseSalt: proof.salt };
    const rejecting = vi.fn().mockResolvedValue(Response.json({ error: 'Incorrect passphrase. 4 attempts remaining.' }, { status: 403 }));
    vi.stubGlobal('fetch', rejecting);
    await expect(retrieveAndDecryptSecret({ ...params, passphrase: 'wrong' })).rejects.toThrow('4 attempts remaining');
    expect(JSON.parse(rejecting.mock.calls[0][1].body).passphraseVerifier).not.toBe(proof.verifier);
    const fetcher = vi.fn().mockResolvedValue(Response.json({ ...encrypted, note: null }));
    vi.stubGlobal('fetch', fetcher);
    expect((await retrieveAndDecryptSecret({ ...params, passphrase: 'correct' })).plaintext).toBe('protected');
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ passphraseVerifier: proof.verifier });
  });
});
