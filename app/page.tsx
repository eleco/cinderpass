import { SecretCreateForm, SecretRequestForm } from '@/components/forms';
import { JsonLd } from '@/components/JsonLd';
import { HowItWorks } from '@/components/HowItWorks';
import { getConfiguredBaseUrl } from '@/lib/utils';
import { REPO_URL } from '@/lib/source';
import { SiteFooter } from '@/components/SiteFooter';

const base = getConfiguredBaseUrl();

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Cinderpass',
  url: base,
  applicationCategory: 'SecurityApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  description:
    'Send a private message that disappears after it is read: a door code, where you left the key, a Wi-Fi or account password. Encrypted in your browser. Free, no account needed.',
};

export default function HomePage() {
  return (
    <main className="site-shell">
      <JsonLd data={appSchema} />
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <div className="container page-stack">
        <div className="header">
          <div className="brand-cluster">
            <div className="badge badge-solid">Cinderpass</div>
            <div className="small muted">Private notes that disappear once they're read.</div>
          </div>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="header-pill">
            Open source ↗
          </a>
        </div>

        <section className="hero-grid">
          <div className="hero-copy">
            <h1>Tell someone a secret. Then it's gone.</h1>
            <p>
              Where you left the spare key. The door code. The Wi-Fi password. Where to meet.
              Write it here and you get a link to send. Your friend opens it once, and the
              message disappears. It won't sit in your texts, emails or chat history.
            </p>
            <div className="hero-tags">
              <span className="tag">Free</span>
              <span className="tag">No account or app</span>
              <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="tag">
                Open source on GitHub ↗
              </a>
            </div>
          </div>

          <div className="card form-card form-card-warm hero-form">
            <div className="card-header">
              <div className="card-accent">Send a secret</div>
              <h3>Write your message</h3>
            </div>
            <SecretCreateForm />
          </div>

          <div className="signal-strip hero-signals">
            <div className="signal-card">
              <strong>Only your friend can read it</strong>
              <span>The message is scrambled on your phone or computer before it is sent. We can't read it.</span>
            </div>
            <div className="signal-card">
              <strong>Read once, then gone</strong>
              <span>Once it's opened, it's deleted. If nobody opens it, it deletes itself anyway.</span>
            </div>
            <div className="signal-card">
              <strong>Sent it to the wrong person?</strong>
              <span>Delete the message yourself, any time before it's opened.</span>
            </div>
            <div className="signal-card">
              <strong>Open for anyone to check</strong>
              <span>
                All of the code is public on{' '}
                <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>, so
                security experts can check how it works.
              </span>
            </div>
          </div>
        </section>

        <section className="grid grid-top">
          <div className="hero-panel">
            <div className="hero-panel-top">
              <div>
                <div className="panel-kicker">How it works</div>
                <h2>Three steps. No trace.</h2>
              </div>
            </div>
            <HowItWorks />
            <div className="hero-panel-note">
              Want the technical details? Tap any step.
            </div>
          </div>

          <div className="card form-card form-card-cool">
            <div className="card-header">
              <div className="card-accent">Ask for a secret</div>
              <h3>Need someone to send you something?</h3>
            </div>
            <p className="muted">
              Make a link and send it to them. They type the answer on a private page, and only
              you get to read it.
            </p>
            <SecretRequestForm />
          </div>
        </section>

        <nav className="seo-links-strip">
          <a href="/send-secret-message">Send a secret message</a>
          <span aria-hidden="true">·</span>
          <a href="/secure-password-sharing">Share a password</a>
          <span aria-hidden="true">·</span>
          <a href="/one-time-link">One-time links</a>
          <span aria-hidden="true">·</span>
          <a href="/one-time-secret-alternatives">One-Time Secret alternatives</a>
          <span aria-hidden="true">·</span>
          <a href="/architecture">Architecture</a>
          <span aria-hidden="true">·</span>
          <a href="/faq">FAQ</a>
        </nav>

        <SiteFooter showHome={false} />
      </div>
    </main>
  );
}
