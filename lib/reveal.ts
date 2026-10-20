import { decryptSecretMaterial, resolveSecretKey } from './crypto';
import { derivePassphraseSecrets } from './passphrase';

export async function retrieveAndDecryptSecret(params: {
  id: string; keyFragment: string; passphraseRequired: boolean;
  passphraseSalt: string | null; passphrase: string;
}) {
  const { id, keyFragment, passphraseRequired, passphraseSalt, passphrase } = params;
  if (passphraseRequired && !passphraseSalt) throw new Error('Missing passphrase verification data. Reload the page.');
  if (passphraseRequired && !passphrase) throw new Error('This secret requires a passphrase.');
  // One PBKDF2 run yields both the server proof and the local key mask.
  const secrets = passphraseRequired ? await derivePassphraseSecrets(passphrase, passphraseSalt!) : null;
  // Never burn on malformed links or an accidental password supplied for an unprotected
  // secret. Passphrase correctness is checked only by the server's rate-limited proof.
  const key = await resolveSecretKey(keyFragment, secrets ? { passphrase, keyMask: secrets.keyMask } : null);
  const response = await fetch(`/api/retrieve/${id}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphraseVerifier: secrets?.verifier }), cache: 'no-store',
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || 'Unable to retrieve secret');
  const plaintext = await decryptSecretMaterial({ ciphertext: data.ciphertext, iv: data.iv, key });
  return { plaintext, note: data.note as string | null };
}
