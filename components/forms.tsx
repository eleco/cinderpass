'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { createSecretMaterial } from '@/lib/crypto';
import { createPassphraseProof } from '@/lib/passphrase';
import { retrieveAndDecryptSecret } from '@/lib/reveal';

type SecretCreateResponse = { url: string; id: string; destroyToken: string };
type RequestCreateResponse = { requestUrl: string };

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

const EXAMPLES = [
  { label: 'Where the key is', note: 'Where the key is', text: 'The spare key is ' },
  { label: 'Door code', note: 'Door code', text: 'The door code is ' },
  { label: 'Wi-Fi password', note: 'Wi-Fi', text: 'Wi-Fi name: \nPassword: ' },
  { label: 'Where to meet', note: 'Where to meet', text: "Let's meet at " },
  { label: 'A password', note: 'Login', text: 'Username: \nPassword: ' },
];

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
  const secretInput = useRef<HTMLTextAreaElement>(null);

  // Pick up anything typed before the page finished loading.
  useEffect(() => {
    if (secretInput.current?.value) setSecret(secretInput.current.value);
  }, []);

  function applyExample(example: (typeof EXAMPLES)[number]) {
    setSecret(example.text);
    if (!note) setNote(example.note);
    const input = secretInput.current;
    if (input) {
      input.focus();
      requestAnimationFrame(() => input.setSelectionRange(example.text.length, example.text.length));
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!secret.trim()) {
      setIsError(true);
      setStatus('Write your secret first.');
      secretInput.current?.focus();
      return;
    }
    setStatus('Locking your message...');
    setIsError(false);
    setResultUrl('');

    try {
      const passphraseProof = passphrase ? await createPassphraseProof(passphrase) : null;
      const encrypted = await createSecretMaterial(secret, passphraseProof?.keyMask);
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
        throw new Error(await getResponseError(response, 'Could not create the link'));
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
    setDestroyStatus('Deleting...');
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
      setDestroyStatus(getErrorMessage(error, 'Could not delete the message'));
    }
  }

  return (
    <form className="form-pinned" onSubmit={onSubmit}>
      <div className="form-fields">
        <div>
          <label className="label" htmlFor="secret-message">Your secret</label>
          {!secret ? (
            <div className="example-chips" role="group" aria-label="Ideas">
              {EXAMPLES.map((example) => (
                <button key={example.label} type="button" className="example-chip" onClick={() => applyExample(example)}>
                  {example.label}
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            id="secret-message"
            ref={secretInput}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder="Example: The spare key is under the blue flowerpot by the back door."
          />
        </div>
        <div className="row">
          <div>
            <label className="label">Extra password (optional)</label>
            <PassphraseInput value={passphrase} onChange={setPassphrase} placeholder="" />
            <p className="field-hint">They'll need it to open the message. Tell them in person or by phone.</p>
          </div>
          <div>
            <label className="label">Delete if not opened within</label>
            <select value={ttlHours} onChange={(e) => setTtlHours(e.target.value)}>
              <option value="1">1 hour</option>
              <option value="24">1 day</option>
              <option value="168">7 days</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Title (optional)</label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: Where the key is" maxLength={140} />
          <p className="field-hint">Shown before they open it, and not locked. Don't put the secret here.</p>
        </div>
      </div>
      <button>Create secret link</button>
      {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
      {resultUrl ? (
        <div className="output stack">
          {destroyed ? (
            <div className="notice-instruction notice-instruction-urgent">Message deleted. The link no longer works.</div>
          ) : (
            <>
              <div className="notice-instruction">
                Your link is ready. Send it to the person by text, email or chat. It works once: as soon as they open it, the message is deleted.
              </div>
              <div className="code">{resultUrl}</div>
              <div className="copy-row">
                <button type="button" className="secondary" onClick={() => copy(resultUrl)}>
                  {copied ? '✓ Copied' : 'Copy link'}
                </button>
                <button type="button" className="danger" onClick={destroySecret}>
                  Delete message
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
    setStatus('Creating your link...');
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
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Example: The gate code" required maxLength={100} />
        </div>
        <div className="row">
          <div>
            <label className="label">Note to them (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Example: Thanks!" maxLength={140} />
          </div>
          <div>
            <label className="label">Link works for</label>
            <select value={ttlHours} onChange={(e) => setTtlHours(e.target.value)}>
              <option value="1">1 hour</option>
              <option value="24">1 day</option>
              <option value="168">7 days</option>
            </select>
          </div>
        </div>
      </div>
      <button>Create request link</button>
      {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
      {requestUrl ? (
        <div className="output stack">
          <div className="badge">Send this link to them</div>
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
  const [metaRetryable, setMetaRetryable] = useState(false);
  const [metaAttempt, setMetaAttempt] = useState(0);
  const [confirmPending, setConfirmPending] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const revealing = useRef(false);
  const { copied, copy } = useCopyButton();

  const keyFragment = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return hash.get('k') || '';
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    // Clear everything tied to a previous secret (or attempt) before loading this one.
    setMetaLoaded(false);
    setMetaRetryable(false);
    setStatus('');
    setIsError(false);
    setPassphrase('');
    setSecret('');
    setLabel(null);
    setPreLabel(null);
    setPassphraseRequired(false);
    setPassphraseSalt(null);
    setConfirmPending(false);
    fetch(`/api/retrieve/${id}`, { signal: controller.signal, cache: 'no-store' })
      .then(async (r) => ({ httpStatus: r.status, data: await r.json() }))
      .then(({ httpStatus, data }: { httpStatus: number; data: { passphraseRequired?: boolean; passphraseSalt?: string | null; note?: string | null; error?: string } }) => {
        if (controller.signal.aborted) return;
        if (data.error) {
          setIsError(true);
          setStatus(data.error);
          // Rate limits and server errors are transient; not-found and already-opened are final.
          setMetaRetryable(httpStatus === 429 || httpStatus >= 500);
        } else {
          setPassphraseRequired(Boolean(data.passphraseRequired));
          setPassphraseSalt(data.passphraseSalt ?? null);
          setPreLabel(data.note ?? null);
          setMetaLoaded(true);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setIsError(true);
          setStatus('Unable to check this secret. Check your connection and try again.');
          setMetaRetryable(true);
        }
      });
    return () => controller.abort();
  }, [id, metaAttempt]);

  async function reveal() {
    if (!metaLoaded || revealing.current || secret) return;
    revealing.current = true;
    setIsRevealing(true);
    setStatus('Fetching encrypted secret...');
    setIsError(false);
    setSecret('');
    setConfirmPending(false);
    try {
      const result = await retrieveAndDecryptSecret({
        id, keyFragment, passphraseRequired, passphraseSalt, passphrase,
      });
      setLabel(result.note);
      setSecret(result.plaintext);
      setIsError(false);
      setStatus('Here it is. The message has now been deleted, so this link won\'t work again.');
    } catch (error) {
      setIsError(true);
      setStatus(getErrorMessage(error, 'Unable to decrypt secret. The passphrase or reveal link is incorrect.'));
    } finally {
      revealing.current = false;
      setIsRevealing(false);
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
          <div className="small muted" style={{ marginBottom: 4 }}>Title</div>
          <strong>{preLabel}</strong>
        </div>
      ) : null}
      <div className="notice small">You can only see this message once. Keep this page open until you've copied or noted it down.</div>
      {metaLoaded && passphraseRequired && !revealed ? <div>
        <label className="label">
          Enter the password they gave you
        </label>
        <PassphraseInput
          value={passphrase}
          onChange={setPassphrase}
          placeholder=""
        />
      </div> : null}
      <button onClick={handleRevealClick} disabled={!metaLoaded || revealed || isRevealing} className={confirmPending ? 'btn-confirm' : ''}>
        {confirmPending ? 'Tap again to open. You can only see it once' : 'Show the message'}
      </button>
      {confirmPending && !revealed ? (
        <button type="button" className="secondary" onClick={() => setConfirmPending(false)}>Cancel</button>
      ) : null}
      {status ? <p className={`small ${isError ? 'error' : 'success'}`}>{status}</p> : null}
      {!metaLoaded && metaRetryable ? (
        <button type="button" className="secondary" onClick={() => setMetaAttempt((n) => n + 1)}>Try again</button>
      ) : null}
      {secret ? (
        <div className="output stack">
          {label ? <div className="badge">{label}</div> : null}
          <div className="code">{secret}</div>
          <button type="button" className="secondary" onClick={() => copy(secret)}>
            {copied ? '✓ Copied' : 'Copy message'}
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
  const secretInput = useRef<HTMLTextAreaElement>(null);

  // Pick up anything typed before the page finished loading.
  useEffect(() => {
    if (secretInput.current?.value) setSecret(secretInput.current.value);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus('Locking and sending...');
    setIsError(false);
    setDoneUrl('');

    try {
      const passphraseProof = passphrase ? await createPassphraseProof(passphrase) : null;
      const encrypted = await createSecretMaterial(secret, passphraseProof?.keyMask);
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
        <label className="label">Your answer</label>
        <textarea ref={secretInput} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Type what they asked for" required />
      </div>
      <div>
        <label className="label">Extra password (optional)</label>
        <PassphraseInput value={passphrase} onChange={setPassphrase} placeholder="" />
        <p className="field-hint">They'll need it to open your answer. Tell them in person or by phone.</p>
      </div>
      <button>Send privately</button>
      {status ? <p className={`small ${isError ? 'error' : 'muted'}`}>{status}</p> : null}
      {doneUrl ? (
        <div className="output stack">
          <div className="notice-instruction notice-instruction-urgent">
            One last step: send this link back to the person who asked. It opens once, and only for whoever has the link.
          </div>
          <div className="code">{doneUrl}</div>
          <button type="button" className="secondary" onClick={() => copy(doneUrl)}>
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
    </form>
  );
}
