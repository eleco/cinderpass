'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createSecretMaterial, decryptSecretMaterial } from '@/lib/crypto';
import { createPassphraseProof, derivePassphraseVerifier } from '@/lib/passphrase';

type SecretCreateResponse = { url: string; id: string; destroyToken: string };
type RequestCreateResponse = { requestUrl: string };

type RetrievePayload = {
  ciphertext: string;
  iv: string;
  passphraseRequired: boolean;
  passphraseSalt: string | null;
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

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function useCopyButton() {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return { copied, copy };
}

function PassphraseInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        type={visible ? 'text' : 'password'}
        style={{ paddingRight: '3rem' }}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="passphrase-toggle"
        aria-label={visible ? 'Hide passphrase' : 'Show passphrase'}
      >
        {visible ? '🙈' : '👁'}
      </button>
    </div>
  );
}

export function SecretCreateForm() {
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [note, setNote] = useState('');
  const [ttlHours, setTtlHours] = useState('24');
  const [resultUrl, setResultUrl] = useState('');
  const [secretId, setSecretId] = useState('');
  const [destroyToken, setDestroyToken] = useState('');
  const [destroyed, setDestroyed] = useState(false);
  const [destroyStatus, setDestroyStatus] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const { copied, copy } = useCopyButton();
  const disabled = !secret.trim();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Encrypting in your browser...');
    setIsError(false);
    setResultUrl('');

    try {
      const encrypted = await createSecretMaterial(secret, passphrase || undefined);
      const passphraseProof = passphrase ? await createPassphraseProof(passphrase) : null;
      const response = await fetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          note,
          ttlHours: Number(ttlHours),
          passphraseRequired: Boolean(passphrase),
          passphraseSalt: passphraseProof?.salt,
          passphraseVerifier: passphraseProof?.verifier,
        }),
      });

      if (!response.ok) {
        throw new Error(await getResponseError(response, 'Failed to create secret'));
      }
      const data = (await response.json()) as SecretCreateResponse;
      const url = `${data.url}#k=${encodeURIComponent(encrypted.keyFragment)}`;
      setResultUrl(url);
      setSecretId(data.id);
      setDestroyToken(data.destroyToken);
      setDestroyed(false);
      setDestroyStatus('');
      setStatus('');
      setSecret('');
      setPassphrase('');
      setNote('');
    } catch (error) {
      setIsError(true);
      setStatus(getErrorMessage(error, 'Something failed'));
    }
  }

  async function destroySecret() {
    if (!secretId || !destroyToken) return;
    setDestroyStatus('Destroying...');
    try {
      const response = await fetch(`/api/secrets/${secretId}/destroy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destroyToken }),
      });
      const data = (await response.json()) as { destroyed?: boolean; error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Unable to destroy');
      setDestroyed(true);
      setDestroyStatus('');
    } catch (error) {
      setDestroyStatus(getErrorMessage(error, 'Unable to destroy secret'));
    }
  }

  return (
    <form className="form-pinned" onSubmit={onSubmit}>
      <div className="form-fields">
        <div>
          <label className="label">Secret</label>
          <textarea value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Password, API key, recovery code..." />
        </div>
        <div className="row">
          <div>
            <label className="label">Passphrase (optional)</label>
            <PassphraseInput value={passphrase} onChange={setPassphrase} placeholder="" />
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
      </div>
      <button disabled={disabled}>Create one-time link</button>
      {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
      {resultUrl ? (
        <div className="output stack">
          {destroyed ? (
            <div className="notice-instruction notice-instruction-urgent">Secret destroyed. The link is now invalid.</div>
          ) : (
            <>
              <div className="notice-instruction">
                Send this link to the recipient. Once opened, it is permanently destroyed. Do not share it through the same channel as the secret it protects.
              </div>
              <div className="code">{resultUrl}</div>
              <div className="copy-row">
                <button type="button" className="secondary" onClick={() => copy(resultUrl)}>
                  {copied ? '✓ Copied' : 'Copy link'}
                </button>
                <button type="button" className="danger" onClick={destroySecret}>
                  Destroy secret
                </button>
              </div>
              {destroyStatus ? <p className="small error">{destroyStatus}</p> : null}
            </>
          )}
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
  const [isError, setIsError] = useState(false);
  const { copied, copy } = useCopyButton();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Creating request page...');
    setIsError(false);
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
      setStatus('');
      setLabel('');
      setNote('');
    } catch (error) {
      setIsError(true);
      setStatus(getErrorMessage(error, 'Something failed'));
    }
  }

  return (
    <form className="form-pinned" onSubmit={onSubmit}>
      <div className="form-fields">
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
      </div>
      <button>Create secure request page</button>
      {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
      {requestUrl ? (
        <div className="output stack">
          <div className="badge">Send this request link</div>
          <div className="code">{requestUrl}</div>
          <button type="button" className="secondary" onClick={() => copy(requestUrl)}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
    </form>
  );
}

export function SecretReader({ id }: { id: string }) {
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [secret, setSecret] = useState('');
  const [preLabel, setPreLabel] = useState<string | null>(null);
  const [label, setLabel] = useState<string | null>(null);
  const [passphraseRequired, setPassphraseRequired] = useState(false);
  const [passphraseSalt, setPassphraseSalt] = useState<string | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [confirmPending, setConfirmPending] = useState(false);
  const { copied, copy } = useCopyButton();

  const keyFragment = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return hash.get('k') || '';
  }, []);

  useEffect(() => {
    fetch(`/api/retrieve/${id}`)
      .then((r) => r.json())
      .then((data: { passphraseRequired?: boolean; passphraseSalt?: string | null; note?: string | null; error?: string }) => {
        if (data.error) {
          setIsError(true);
          setStatus(data.error);
        } else {
          setPassphraseRequired(Boolean(data.passphraseRequired));
          setPassphraseSalt(data.passphraseSalt ?? null);
          setPreLabel(data.note ?? null);
        }
        setMetaLoaded(true);
      })
      .catch(() => { setMetaLoaded(true); });
  }, [id]);

  async function reveal() {
    setStatus('Fetching encrypted secret...');
    setIsError(false);
    setSecret('');
    setConfirmPending(false);
    try {
      if (!keyFragment) throw new Error('Missing decryption key fragment in the URL.');
      if (passphraseRequired && !passphrase) throw new Error('This secret requires a passphrase. Enter it before revealing.');
      const passphraseVerifier =
        passphraseRequired && passphraseSalt
          ? await derivePassphraseVerifier(passphrase, passphraseSalt)
          : undefined;

      const response = await fetch(`/api/retrieve/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passphraseVerifier }),
      });
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
      setIsError(false);
      setStatus('Secret opened. The server has now marked it as burned.');
    } catch (error) {
      setIsError(true);
      setStatus(getErrorMessage(error, 'Unable to decrypt secret. The passphrase or reveal link is incorrect.'));
    }
  }

  function handleRevealClick() {
    if (!confirmPending) {
      setConfirmPending(true);
    } else {
      void reveal();
    }
  }

  const revealed = Boolean(secret);

  return (
    <div className="stack">
      {metaLoaded && preLabel && !revealed ? (
        <div className="notice">
          <div className="small muted" style={{ marginBottom: 4 }}>This secret is labelled</div>
          <strong>{preLabel}</strong>
        </div>
      ) : null}
      <div className="notice small">This secret can be opened once. After retrieval, it is permanently destroyed.</div>
      <div>
        <label className="label">
          Passphrase{passphraseRequired ? <span style={{ color: 'var(--danger)', marginLeft: 4 }}>required</span> : ' (if set)'}
        </label>
        <PassphraseInput
          value={passphrase}
          onChange={setPassphrase}
          placeholder=""
        />
      </div>
      <button onClick={handleRevealClick} disabled={revealed} className={confirmPending ? 'btn-confirm' : ''}>
        {confirmPending ? 'Tap again to confirm — this burns the secret' : 'Reveal secret'}
      </button>
      {confirmPending && !revealed ? (
        <button type="button" className="secondary" onClick={() => setConfirmPending(false)}>Cancel</button>
      ) : null}
      {status ? <p className={`small ${isError ? 'error' : 'success'}`}>{status}</p> : null}
      {secret ? (
        <div className="output stack">
          {label ? <div className="badge">{label}</div> : null}
          <div className="code">{secret}</div>
          <button type="button" className="secondary" onClick={() => copy(secret)}>
            {copied ? '✓ Copied' : 'Copy secret'}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function RequestSubmitForm({
  token,
  label,
  note,
  expired,
  expiresAt,
}: {
  token: string;
  label: string;
  note: string | null;
  expired: boolean;
  expiresAt: string;
}) {
  const [secret, setSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [doneUrl, setDoneUrl] = useState('');
  const { copied, copy } = useCopyButton();

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Encrypting and submitting...');
    setIsError(false);
    setDoneUrl('');

    try {
      const encrypted = await createSecretMaterial(secret, passphrase || undefined);
      const passphraseProof = passphrase ? await createPassphraseProof(passphrase) : null;
      const response = await fetch(`/api/requests/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          note: label,
          passphraseRequired: Boolean(passphrase),
          passphraseSalt: passphraseProof?.salt,
          passphraseVerifier: passphraseProof?.verifier,
        }),
      });
      const data = (await response.json()) as { revealUrl?: string; error?: string };
      if (!response.ok || data.error) throw new Error(data.error || 'Unable to submit secret');
      const fullUrl = `${data.revealUrl}#k=${encodeURIComponent(encrypted.keyFragment)}`;
      setDoneUrl(fullUrl);
      setStatus('');
      setSecret('');
      setPassphrase('');
    } catch (error) {
      setIsError(true);
      setStatus(getErrorMessage(error, 'Unable to submit'));
    }
  }

  const expiryLabel = (() => {
    const d = new Date(expiresAt);
    return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  })();

  if (expired) {
    return <div className="notice error">This request is no longer open.</div>;
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="notice">
        <strong>{label}</strong>
        {note ? <div className="small muted" style={{ marginTop: 6 }}>{note}</div> : null}
        <div className="small muted" style={{ marginTop: 6 }}>Expires {expiryLabel}</div>
      </div>
      <div>
        <label className="label">Secret to send</label>
        <textarea value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Paste the requested credential or token" required />
      </div>
      <div>
        <label className="label">Passphrase (optional)</label>
        <PassphraseInput value={passphrase} onChange={setPassphrase} placeholder="" />
      </div>
      <button disabled={!secret.trim()}>Submit securely</button>
      {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
      {doneUrl ? (
        <div className="output stack">
          <div className="notice-instruction notice-instruction-urgent">
            Send this reveal link back to the requester only. Do not share it through Slack, email threads, or anywhere the request itself was sent.
          </div>
          <div className="code">{doneUrl}</div>
          <button type="button" className="secondary" onClick={() => copy(doneUrl)}>
            {copied ? '✓ Copied' : 'Copy reveal link'}
          </button>
        </div>
      ) : null}
    </form>
  );
}
