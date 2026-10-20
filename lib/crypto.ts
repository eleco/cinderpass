import { base64ToBytes, bytesToBase64 } from './encoding';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const INVALID_KEY = 'The passphrase or decryption link is incorrect. The secret has not been retrieved.';

function xorInto<T extends Uint8Array>(target: T, mask: Uint8Array): T {
  for (let i = 0; i < target.length; i++) target[i] ^= mask[i];
  return target;
}

// keyMask comes from createPassphraseProof; the fragment then holds only key XOR mask.
export async function createSecretMaterial(secret: string, keyMask?: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(secret));
  const keyFragment = keyMask ? `v2.${bytesToBase64(xorInto(keyBytes, keyMask))}` : bytesToBase64(keyBytes);
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv), keyFragment };
}

// Validate the fragment and recover the raw key BEFORE the irreversible retrieve request.
// `protection` follows the server's protection flag, never incidental text in an input.
export async function resolveSecretKey(
  keyFragment: string,
  protection: { passphrase: string; keyMask: Uint8Array | null } | null,
): Promise<Uint8Array<ArrayBuffer>> {
  if (!keyFragment) throw new Error('Missing decryption key fragment in the URL.');
  if (protection && !protection.passphrase) throw new Error('This secret requires a passphrase.');
  try {
    if (keyFragment.startsWith('v2.')) {
      if (!protection?.keyMask) throw new Error('Protection mismatch');
      return xorInto(base64ToBytes(keyFragment.slice(3), 32), protection.keyMask);
    }
    const key = base64ToBytes(keyFragment, 32);
    if (protection) {
      if (protection.keyMask) throw new Error('Protection mismatch');
      // Read-only compatibility for legacy SHA-256/XOR links. Never create them.
      xorInto(key, new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(protection.passphrase))));
    }
    return key;
  } catch {
    throw new Error(INVALID_KEY);
  }
}

export async function decryptSecretMaterial(params: { ciphertext: string; iv: string; key: Uint8Array<ArrayBuffer> }) {
  const key = await crypto.subtle.importKey('raw', params.key, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(params.iv, 12) }, key, base64ToBytes(params.ciphertext),
  );
  return decoder.decode(plaintext);
}
