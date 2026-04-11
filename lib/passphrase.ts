const textEncoder = new TextEncoder();

const PASS_PHRASE_ITERATIONS = 120_000;
const PASS_PHRASE_KEY_LENGTH = 256;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function derivePassphraseVerifier(passphrase: string, salt: string) {
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(salt),
      iterations: PASS_PHRASE_ITERATIONS,
      hash: 'SHA-256',
    },
    passphraseKey,
    PASS_PHRASE_KEY_LENGTH,
  );

  return bytesToBase64(new Uint8Array(bits));
}

export async function createPassphraseProof(passphrase: string) {
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))));

  return {
    salt,
    verifier: await derivePassphraseVerifier(passphrase, salt),
  };
}
