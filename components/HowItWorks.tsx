'use client';

import { useState } from 'react';

const steps = [
  {
    n: '01',
    title: 'Wrap the secret',
    summary: 'Encrypt in the browser before anything reaches the server.',
    detail: (
      <>
        <p>
          When you type a secret and hit send, Cinderpass generates a random 256-bit key in your
          browser using the Web Crypto API. Your secret is encrypted with AES-256-GCM entirely
          on your device — the plaintext never leaves it.
        </p>
        <p>
          The server only ever receives the resulting ciphertext: an unreadable blob that cannot
          be reversed without the key. Even if the server were breached or subpoenaed, there is
          nothing readable to hand over.
        </p>
        <p>
          If you add a passphrase, a second key is derived from it using PBKDF2-SHA256 (120,000
          iterations) and applied on top. The passphrase itself is never stored anywhere.
        </p>
      </>
    ),
  },
  {
    n: '02',
    title: 'Share a single link',
    summary: 'The key fragment stays in the URL, separate from stored ciphertext.',
    detail: (
      <>
        <p>
          The share link has two parts: the secret ID (sent to the server on retrieval) and the
          decryption key (placed after the <code>#</code> character). The part after{' '}
          <code>#</code> is called the URL fragment — browsers intentionally never include it in
          HTTP requests.
        </p>
        <p>
          This means the server stores the ciphertext under the secret ID, but the key required
          to decrypt it is only in the link you send. The two halves are physically separated:
          one on the server, one only in the URL.
        </p>
        <p>
          A destroy token is also generated. Keep it if you need to burn the link before the
          recipient opens it — for example, if you sent it to the wrong address.
        </p>
      </>
    ),
  },
  {
    n: '03',
    title: 'Reveal once',
    summary: 'Passphrase checks succeed first, then the secret is burned after retrieval.',
    detail: (
      <>
        <p>
          When the recipient opens the link, their browser extracts the key from the URL fragment
          and fetches the ciphertext from the server. Decryption happens locally in their browser
          — the key is never sent to the server.
        </p>
        <p>
          The burn is atomic: the server marks the record as opened in a single database write
          that filters on <code>status = ACTIVE</code>. If two requests race simultaneously,
          only one can win. The second receives an "already opened" error — the ciphertext is
          only returned inside the same transaction that destroys it.
        </p>
        <p>
          If a passphrase was set, the recipient must enter it first. A wrong passphrase does
          not burn the secret — it increments a per-secret attempt counter and returns an error.
          After five wrong attempts the secret is permanently locked.
        </p>
      </>
    ),
  },
];

export function HowItWorks() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="flow-list">
      {steps.map((step, i) => {
        const isOpen = open === i;
        return (
          <div key={step.n} className="flow-step flow-step-expandable">
            <span>{step.n}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <button
                className="flow-step-btn"
                onClick={() => setOpen(prev => prev === i ? null : i)}
                aria-expanded={isOpen}
              >
                <strong>{step.title}</strong>
                <span className="flow-step-chevron" aria-hidden="true"
                  style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▾
                </span>
              </button>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.875rem', opacity: 0.75 }}>
                {step.summary}
              </p>
              {isOpen && (
                <div className="flow-step-detail">
                  {step.detail}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
