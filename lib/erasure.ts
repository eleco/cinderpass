// Preserve only the tombstone needed to return a closed-link response.
// These assignments must be part of the same transaction as the status change.
export const ERASE_SECRET = {
  ciphertext: '', iv: '', note: null,
  passphraseSalt: null, passphraseVerifier: null, destroyToken: null,
} as const;
export const ERASE_REQUEST = { label: '', note: null } as const;
