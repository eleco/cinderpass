'use client';

import { FormEvent, useMemo, useState } from 'react';
import { createSecretMaterial, decryptSecretMaterial } from '@/lib/crypto';

type SecretCreateResponse = { url: string };
type RequestCreateResponse = { requestUrl: string };

type RetrievePayload = {
  ciphertext: string;
  iv: string;
  passphraseRequired: boolean;
  note: string | null;
  openedAt: string;
};

async function getResponseError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export function SecretCreateForm() {
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [note, setNote] = useState('');
  const [ttlHours, setTtlHours] = useState('24');
  const [resultUrl, setResultUrl] = useState('');
  const [status, setStatus] = useState('');
  const disabled = !secret.trim();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Encrypting in your browser...');
    setResultUrl('');

    try {
      const encrypted = await createSecretMaterial(secret, passphrase || undefined);
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          note,
          ttlHours: Number(ttlHours),
          passphraseRequired: Boolean(passphrase),
        }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Failed to create secret'));
      }
      const data = (await response.json()) as SecretCreateResponse;
      const url = `${data.url}#k=${encodeURIComponent(encrypted.keyFragment)}`;
      setResultUrl(url);
      setStatus('Ready. The server never saw the plaintext or the raw key fragment.');
      setSecret('');
      setPassphrase('');
      setNote('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something failed');
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div>
        <label className="label">Secret</label>
        <textarea value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Password, API key, recovery code..." />
      </div>
      <div className="row">
        <div>
          <label className="label">Passphrase (optional)</label>
          <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Adds another layer before decrypting" />
        </div>
        <div>
          <label className="label">Expiry</label>
          <select value={ttlHours} onChange={(e) => setTtlHours(e.target.value)}>
            <option value="1">1 hour</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Label (optional)</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: staging API token" maxLength={140} />
      </div>
      <button disabled={disabled}>Create one-time link</button>
      <p className="small muted">{status}</p>
      {resultUrl ? (
        <div className="output stack">
          <div className="badge">Share this full link once</div>
          <div className="code">{resultUrl}</div>
          <div className="copy-row">
            <button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(resultUrl)}>Copy link</button>
          </div>
        </div>
      ) : null}
    </form>
  );
}

export function SecretRequestForm() {
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [ttlHours, setTtlHours] = useState('24');
  const [requestUrl, setRequestUrl] = useState('');
  const [status, setStatus] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Creating request page...');
    setRequestUrl('');

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, note, ttlHours: Number(ttlHours) }),
      });
      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Failed to create request link'));
      }
      const data = (await response.json()) as RequestCreateResponse;
      setRequestUrl(data.requestUrl);
      setStatus('Request page ready. Send it to the other person.');
      setLabel('');
      setNote('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Something failed');
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div>
        <label className="label">What are you asking for?</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Example: Production VPN password" required maxLength={100} />
      </div>
      <div className="row">
        <div>
          <label className="label">Extra note (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Keep this concise" maxLength={140} />
        </div>
        <div>
          <label className="label">Expiry</label>
          <select value={ttlHours} onChange={(e) => setTtlHours(e.target.value)}>
            <option value="1">1 hour</option>
            <option value="24">24 hours</option>
            <option value="168">7 days</option>
          </select>
        </div>
      </div>
      <button>Create secure request page</button>
      <p className="small muted">{status}</p>
      {requestUrl ? (
        <div className="output stack">
          <div className="badge">Send this request link</div>
          <div className="code">{requestUrl}</div>
          <button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(requestUrl)}>Copy link</button>
        </div>
      ) : null}
    </form>
  );
}

export function SecretReader({ id }: { id: string }) {
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState('');
  const [secret, setSecret] = useState('');
  const [label, setLabel] = useState<string | null>(null);
  const keyFragment = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return hash.get('k') || '';
  }, []);

  async function reveal() {
    setStatus('Fetching encrypted secret...');
    setSecret('');
    try {
      if (!keyFragment) throw new Error('Missing decryption key fragment in the URL.');
      const response = await fetch(`/api/retrieve/${id}`, { method: 'POST' });
      const data = (await response.json()) as RetrievePayload | { error: string };
      if (!response.ok || 'error' in data) throw new Error('error' in data ? data.error : 'Unable to retrieve secret');
      const plaintext = await decryptSecretMaterial({
        ciphertext: data.ciphertext,
        iv: data.iv,
        keyFragment,
        passphrase: passphrase || undefined,
      });
      setLabel(data.note);
      setSecret(plaintext);
      setStatus('Secret opened. The server has now marked it as burned.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to decrypt secret');
    }
  }

  return (
    <div className="stack">
      <div className="notice small">This secret can be opened once. After retrieval, it is marked as destroyed.</div>
      <div>
        <label className="label">Passphrase if required</label>
        <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Leave blank if none" />
      </div>
      <button onClick={reveal}>Reveal secret</button>
      <p className="small muted">{status}</p>
      {secret ? (
        <div className="output stack">
          {label ? <div className="badge">{label}</div> : null}
          <div className="code">{secret}</div>
          <button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(secret)}>Copy secret</button>
        </div>
      ) : null}
    </div>
  );
}

export function RequestSubmitForm({ token, label, note, expired }: { token: string; label: string; note: string | null; expired: boolean }) {
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState('');
  const [doneUrl, setDoneUrl] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Encrypting and submitting...');
    setDoneUrl('');

    try {
      const encrypted = await createSecretMaterial(secret, passphrase || undefined);
      const response = await fetch(`/api/requests/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          note: label,
          passphraseRequired: Boolean(passphrase),
        }),
      });
      const data = (await response.json()) as { revealUrl?: string; error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Unable to submit secret');
      const fullUrl = `${data.revealUrl}#k=${encodeURIComponent(encrypted.keyFragment)}`;
      setDoneUrl(fullUrl);
      setStatus('Submitted. Send the reveal link back only to the requester.');
      setSecret('');
      setPassphrase('');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to submit');
    }
  }

  if (expired) {
    return <div className="notice error">This request is no longer open.</div>;
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="notice">
        <strong>{label}</strong>
        {note ? <div className="small muted" style={{ marginTop: 8 }}>{note}</div> : null}
      </div>
      <div>
        <label className="label">Secret to send</label>
        <textarea value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Paste the requested credential or token" required />
      </div>
      <div>
        <label className="label">Passphrase (optional)</label>
        <input value={passphrase} onChange={(e) => setPassphrase(e.target.value)} placeholder="Optional extra protection" />
      </div>
      <button disabled={!secret.trim()}>Submit securely</button>
      <p className="small muted">{status}</p>
      {doneUrl ? (
        <div className="output stack">
          <div className="badge">Return this reveal link to the requester</div>
          <div className="code">{doneUrl}</div>
          <button type="button" className="secondary" onClick={() => navigator.clipboard.writeText(doneUrl)}>Copy reveal link</button>
        </div>
      ) : null}
    </form>
  );
}
