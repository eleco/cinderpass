'use client';

import { useState } from 'react';
import { COMMIT_SHA, COMMIT_URL, REPO_URL } from '@/lib/source';

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
              <p>The decryption key is stored only in the URL fragment (the part after <code>#</code>). HTTP requests omit fragments. Stored data alone cannot decrypt the secret; the browser still trusts the JavaScript served by this site.</p>
            </div>
          </div>
          <div className="explainer-row">
            <div className="explainer-num">3</div>
            <div>
              <strong>One read, then gone</strong>
              <p>Retrieval removes the encrypted payload from the live database before sending it to your browser. Keep the result until you have copied it; a lost response cannot be retrieved again. Provider backups have separate retention policies.</p>
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
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
              github.com/eleco/cinderpass
            </a>
            {COMMIT_URL ? (
              <> — deployed from commit{' '}
                <a href={COMMIT_URL} target="_blank" rel="noopener noreferrer">
                  {COMMIT_SHA!.slice(0, 7)}
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
