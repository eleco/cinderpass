import { describe, it, expect } from 'vitest';
import { validateCiphertextPayload } from '@/lib/api';

// Valid 12-byte IV: 12 bytes → 16 base64 chars (with padding)
const VALID_IV = btoa(String.fromCharCode(...new Array(12).fill(0)));
// Valid small ciphertext
const VALID_CT = btoa('hello world encrypted');

describe('validateCiphertextPayload', () => {
  it('returns null for valid ciphertext and IV', () => {
    expect(validateCiphertextPayload(VALID_CT, VALID_IV)).toBeNull();
  });

  it('rejects non-string ciphertext', () => {
    expect(validateCiphertextPayload(123, VALID_IV)).toBe('ciphertext and iv must be strings');
    expect(validateCiphertextPayload(null, VALID_IV)).toBe('ciphertext and iv must be strings');
    expect(validateCiphertextPayload(undefined, VALID_IV)).toBe('ciphertext and iv must be strings');
  });

  it('rejects non-string IV', () => {
    expect(validateCiphertextPayload(VALID_CT, null)).toBe('ciphertext and iv must be strings');
    expect(validateCiphertextPayload(VALID_CT, 42)).toBe('ciphertext and iv must be strings');
  });

  it('rejects invalid base64 ciphertext', () => {
    expect(validateCiphertextPayload('not!valid@base64#', VALID_IV)).toBe('ciphertext is not valid base64');
  });

  it('rejects invalid base64 IV', () => {
    expect(validateCiphertextPayload(VALID_CT, 'not!valid@base64#')).toBe('iv is not valid base64');
  });

  it('rejects ciphertext exceeding 64KB base64 limit', () => {
    const oversized = 'A'.repeat(87383);
    expect(validateCiphertextPayload(oversized, VALID_IV)).toBe('ciphertext exceeds maximum allowed size');
  });

  it('accepts ciphertext at exactly the limit', () => {
    const atLimit = 'A'.repeat(87382);
    expect(validateCiphertextPayload(atLimit, VALID_IV)).toBeNull();
  });

  it('rejects IV that is not 12 bytes', () => {
    // 8 bytes → 12 base64 chars (without padding stripping gives wrong length)
    const shortIv = btoa(String.fromCharCode(...new Array(8).fill(0)));
    expect(validateCiphertextPayload(VALID_CT, shortIv)).toBe('iv must be 12 bytes (AES-GCM)');

    // 16 bytes → 24 base64 chars
    const longIv = btoa(String.fromCharCode(...new Array(16).fill(0)));
    expect(validateCiphertextPayload(VALID_CT, longIv)).toBe('iv must be 12 bytes (AES-GCM)');
  });

  it('accepts base64url encoded ciphertext', () => {
    const base64url = 'abc_def-123';
    expect(validateCiphertextPayload(base64url, VALID_IV)).toBeNull();
  });
});
