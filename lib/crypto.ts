const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function xorBytes(left: Uint8Array, right: Uint8Array): Uint8Array<ArrayBuffer> {
  const output = new Uint8Array(new ArrayBuffer(left.length));
  for (let index = 0; index < left.length; index += 1) {
    output[index] = left[index] ^ right[index];
  }
  return output;
}

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

export async function createSecretMaterial(secret: string, passphrase?: string) {
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const keyBytes = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(32)));
  const aesKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    textEncoder.encode(secret),
  );

  let keyFragment = bytesToBase64(keyBytes);

  if (passphrase) {
    const passphraseHash = await crypto.subtle.digest('SHA-256', textEncoder.encode(passphrase));
    const passphraseBytes = new Uint8Array(passphraseHash);
    const protectedBytes = xorBytes(keyBytes, passphraseBytes);
    keyFragment = bytesToBase64(protectedBytes);
  }

  return {
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    iv: bytesToBase64(iv),
    keyFragment,
  };
}

export async function decryptSecretMaterial(params: {
  ciphertext: string;
  iv: string;
  keyFragment: string;
  passphrase?: string;
}) {
  const ciphertext = base64ToBytes(params.ciphertext);
  const iv = base64ToBytes(params.iv);
  let keyBytes = base64ToBytes(params.keyFragment);

  if (params.passphrase) {
    const passphraseHash = await crypto.subtle.digest('SHA-256', textEncoder.encode(params.passphrase));
    const passphraseBytes = new Uint8Array(passphraseHash);
    keyBytes = xorBytes(keyBytes, passphraseBytes);
  }

  const aesKey = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext);

  return textDecoder.decode(plaintext);
}
