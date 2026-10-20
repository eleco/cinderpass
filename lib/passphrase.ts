import { base64ToBytes, bytesToBase64 } from './encoding';

export const PASSPHRASE_ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 120_000;
const encoder = new TextEncoder();
const VERIFIER_INFO = encoder.encode('cinderpass:verifier:v2');
const KEY_MASK_INFO = encoder.encode('cinderpass:key-mask:v2');

export async function derivePassphraseBits(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = PASSPHRASE_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256));
}

async function expand(master: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey('raw', master, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info }, key, 256));
}

export type PassphraseSecrets = {
  /** Sent to the server, which compares it under the five-attempt lockout. */
  verifier: string;
  /** Never leaves the browser. Masks the AES key in v2 fragments; null for legacy salts. */
  keyMask: Uint8Array<ArrayBuffer> | null;
};

// The mask is unauthenticated on purpose: every guess yields a plausible key, so a guess can
// only be tested against the ciphertext, which the server releases after verifying the proof.
export async function derivePassphraseSecrets(passphrase: string, salt: string): Promise<PassphraseSecrets> {
  if (salt.startsWith('v2.')) {
    const master = await derivePassphraseBits(passphrase, base64ToBytes(salt.slice(3), 16));
    const [verifier, keyMask] = await Promise.all([expand(master, VERIFIER_INFO), expand(master, KEY_MASK_INFO)]);
    return { verifier: bytesToBase64(verifier), keyMask };
  }
  // Legacy links: 120,000-iteration verifier, SHA-256/XOR key wrapping handled in crypto.ts.
  const bits = await derivePassphraseBits(passphrase, base64ToBytes(salt, 16), LEGACY_ITERATIONS);
  return { verifier: bytesToBase64(bits), keyMask: null };
}

export async function createPassphraseProof(passphrase: string) {
  const salt = `v2.${bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))}`;
  const { verifier, keyMask } = await derivePassphraseSecrets(passphrase, salt);
  return { salt, verifier, keyMask: keyMask! };
}
