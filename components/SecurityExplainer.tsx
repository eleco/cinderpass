'use client';

import { useState } from 'react';

export function SecurityExplainer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="explainer">
      <button
        type="button"
        className="explainer-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>How is this secure?</span>
        <span className="explainer-chevron" style={{ transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>
      {open ? (
        <div className="explainer-body">
          <div className="explainer-row">
            <div className="explainer-num">1</div>
            <div>
              <strong>Encrypted in the sender's browser</strong>
              <p>The secret is encrypted with AES-256-GCM before it leaves the sender's device. The server only ever receives ciphertext — never the plaintext.</p>
            </div>
          </div>
          <div className="explainer-row">
            <div className="explainer-num">2</div>
            <div>
              <strong>The key never touches the server</strong>
              <p>The decryption key is stored only in the URL fragment (the part after <code>#</code>). Fragments are never sent to servers by browsers, so Cinderpass cannot decrypt the secret even if it wanted to.</p>
            </div>
          </div>
          <div className="explainer-row">
            <div className="explainer-num">3</div>
            <div>
              <strong>One read, then gone</strong>
              <p>The moment the secret is successfully decrypted, the server marks it as destroyed. The ciphertext remains in the database but is permanently inaccessible.</p>
            </div>
          </div>
          <div className="explainer-row">
            <div className="explainer-num">4</div>
            <div>
              <strong>Passphrase check without burning</strong>
              <p>If a passphrase was set, it is verified before the secret is opened. A wrong passphrase does not consume the secret — it just fails the check.</p>
            </div>
          </div>
          <div className="explainer-source">
            Source code at{' '}
            <a href="https://github.com/eleco/cinderpass" target="_blank" rel="noopener noreferrer">
              github.com/eleco/cinderpass
            </a>
            {process.env.NEXT_PUBLIC_COMMIT_SHA && process.env.NEXT_PUBLIC_COMMIT_SHA !== 'unknown' ? (
              <> — deployed from commit{' '}
                <a
                  href={`https://github.com/eleco/cinderpass/commit/${process.env.NEXT_PUBLIC_COMMIT_SHA}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {process.env.NEXT_PUBLIC_COMMIT_SHA.slice(0, 7)}
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
