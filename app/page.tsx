import { SecretCreateForm, SecretRequestForm } from '@/components/forms';

export default function HomePage() {
  return (
    <main className="site-shell">
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="container page-stack">
        <div className="header">
          <div className="brand-cluster">
            <div className="badge badge-solid">Cinderpass</div>
            <div className="small muted">Fast, polished secret handoff for modern teams.</div>
          </div>
          <div className="header-pill">Ciphertext only</div>
        </div>

        <section className="hero-grid">
          <div className="hero-copy">
            <h1>Share sensitive credentials without leaving plaintext behind.</h1>
            <p>
              Cinderpass gives ops, support, and engineering teams a cleaner way to pass API keys,
              recovery codes, and one-off access without dropping sensitive data into inboxes,
              chats, or ticket threads.
            </p>
            <div className="hero-tags">
              <span className="tag">Browser-side encryption</span>
              <span className="tag">One-time reveal</span>
              <span className="tag">Request flow built in</span>
            </div>
            <div className="hero-metrics">
              <div className="metric-card">
                <strong>Fast handoff</strong>
                <span>Create a link in seconds and move on.</span>
              </div>
              <div className="metric-card">
                <strong>Cleaner trails</strong>
                <span>Keep plaintext out of Slack, docs, and support queues.</span>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="hero-panel-top">
              <div>
                <div className="panel-kicker">How it works</div>
                <h2>Credentials don't belong in chat.</h2>
              </div>
              <div className="status-pill">Live reveal flow</div>
            </div>
            <div className="flow-list">
              <div className="flow-step">
                <span>01</span>
                <div>
                  <strong>Wrap the secret</strong>
                  <p>Encrypt in the browser before anything reaches the server.</p>
                </div>
              </div>
              <div className="flow-step">
                <span>02</span>
                <div>
                  <strong>Share a single link</strong>
                  <p>The key fragment stays in the URL, separate from stored ciphertext.</p>
                </div>
              </div>
              <div className="flow-step">
                <span>03</span>
                <div>
                  <strong>Reveal once</strong>
                  <p>Passphrase checks succeed first, then the secret is burned after retrieval.</p>
                </div>
              </div>
            </div>
            <div className="hero-panel-note">
              Better than pasting tokens into chat. Light enough for startup teams that need the
              fix now.
            </div>
          </div>
        </section>

        <section className="signal-strip">
          <div className="signal-card">
            <strong>Zero plaintext storage</strong>
            <span>The server handles ciphertext and metadata, not the secret itself.</span>
          </div>
          <div className="signal-card">
            <strong>Passphrase-aware reveal</strong>
            <span>Wrong passphrases no longer consume the secret.</span>
          </div>
          <div className="signal-card">
            <strong>Made for real workflows</strong>
            <span>Direct send and request-based collection live in the same surface.</span>
          </div>
        </section>

        <section className="section-head">
          <div>
            <h2>Two flows. Same clean handoff.</h2>
          </div>
          <p className="muted">
            Send a secret immediately, or open a secure request page when you need someone else to
            hand credentials back to you.
          </p>
        </section>

        <section className="grid">
          <div className="card form-card form-card-warm">
            <div className="card-header">
              <div className="card-accent">Direct share</div>
              <h3>Create a one-time secret link</h3>
            </div>
            <p className="muted">Encrypt in the browser, store ciphertext on the server, and send a polished burn-after-read link.</p>
            <SecretCreateForm />
          </div>

          <div className="card form-card form-card-cool">
            <div className="card-header">
              <div className="card-accent">Inbound request</div>
              <h3>Create a secure request page</h3>
            </div>
            <p className="muted">Ask for a password or token through a dedicated handoff page instead of another messy back-and-forth.</p>
            <SecretRequestForm />
          </div>
        </section>

        <footer className="footer">
          <a
            href={`https://github.com/eleco/cinderpass/commit/${process.env.NEXT_PUBLIC_COMMIT_SHA}`}
            target="_blank"
            rel="noopener noreferrer"
            className="version-badge"
          >
            {process.env.NEXT_PUBLIC_COMMIT_SHA !== 'unknown'
              ? `build ${process.env.NEXT_PUBLIC_COMMIT_SHA?.slice(0, 7)}`
              : 'source'}
            {' ↗'}
          </a>
        </footer>
      </div>
    </main>
  );
}
