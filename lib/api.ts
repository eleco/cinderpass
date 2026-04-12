import { NextResponse } from 'next/server';

export function requireDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return null;
  }

  return NextResponse.json(
    { error: 'Server is not configured: DATABASE_URL is missing.' },
    { status: 503 },
  );
}

export function logRouteError(route: string, error: unknown) {
  console.error(`[${route}]`, error);
}

const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
const BASE64URL_RE = /^[A-Za-z0-9_-]*={0,2}$/;

// Max ciphertext size: 64 KB of base64 ≈ 48 KB plaintext — enough for any
// credential or token, blocks storage-exhaustion abuse.
const MAX_CIPHERTEXT_B64_LENGTH = 87382; // ceil(65536 * 4/3)

// AES-GCM IV must be exactly 12 bytes → 16 base64 chars (with padding).
const VALID_IV_LENGTHS = new Set([16]);

export function validateCiphertextPayload(ciphertext: unknown, iv: unknown): string | null {
  if (typeof ciphertext !== 'string' || typeof iv !== 'string') {
    return 'ciphertext and iv must be strings';
  }
  if (!BASE64_RE.test(ciphertext) && !BASE64URL_RE.test(ciphertext)) {
    return 'ciphertext is not valid base64';
  }
  if (!BASE64_RE.test(iv) && !BASE64URL_RE.test(iv)) {
    return 'iv is not valid base64';
  }
  if (ciphertext.length > MAX_CIPHERTEXT_B64_LENGTH) {
    return 'ciphertext exceeds maximum allowed size';
  }
  if (!VALID_IV_LENGTHS.has(iv.replace(/=/g, '').length)) {
    return 'iv must be 12 bytes (AES-GCM)';
  }
  return null;
}
