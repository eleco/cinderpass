import type { Metadata } from 'next';
import { JsonLd } from '@/components/JsonLd';
import { getConfiguredBaseUrl } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'One-Time Secret Alternatives in 2026',
  description:
    'Comparing the best One-Time Secret alternatives: Yopass, PrivateBin, Bitwarden Send, and Cinderpass. Encryption models, features, and honest trade-offs.',
};

const base = getConfiguredBaseUrl();

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  url: `${base}/one-time-secret-alternatives`,
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is One-Time Secret secure?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'One-Time Secret encrypts secrets at rest on its servers, so it is more secure than sending plaintext over email or Slack. However, the server receives your secret in plaintext over TLS and performs the encryption itself — meaning the server holds the decryption capability. This is server-side encryption, not end-to-end encryption.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can One-Time Secret read my secrets?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes, in principle. One-Time Secret uses server-side encryption. The plaintext secret travels to their server over TLS, where it is encrypted for storage. Because the server performs the encryption, it also holds the ability to decrypt. Their own documentation states: "Your secrets are securely encrypted on our servers." This differs from tools like Yopass, PrivateBin, Bitwarden Send, and Cinderpass, which encrypt in the browser before any data reaches the server.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the difference between One-Time Secret and Yopass?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yopass encrypts secrets in the browser using PGP/AES-256 before they reach the server, so the server never holds the decryption key. One-Time Secret encrypts on the server, meaning the server can decrypt. Both burn the secret on first read, but Yopass has a stronger confidentiality guarantee against a compromised or malicious server.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is the best free One-Time Secret alternative?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'For browser-side encryption with no account required, Cinderpass and Yopass are the strongest free alternatives. Cinderpass adds a request flow (ask someone to submit a secret to you), passphrase protection that does not burn the secret on wrong attempts, and a destroy-before-open token. All options listed here are free for basic use.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I self-host a One-Time Secret alternative?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. Yopass, PrivateBin, and Cinderpass are all open source and self-hostable. PrivateBin is the most widely self-hosted option. Cinderpass requires Node.js and PostgreSQL and can be deployed to any platform that supports Next.js.',
      },
    },
  ],
};

export default function OTSAlternativesPage() {
  return (
    <main className="dest-shell">
      <JsonLd data={faqSchema} />
      <div className="dest-container" style={{ maxWidth: 800 }}>

        <div className="dest-brand">
          <a href="/" className="badge badge-solid">Cinderpass</a>
        </div>

        <article style={{ display: 'grid', gap: '2rem' }}>

          {/* Header */}
          <header style={{ display: 'grid', gap: '0.75rem' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Guide · Updated 2026
            </div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.04em', fontSize: 'clamp(1.8rem, 5vw, 2.8rem)', lineHeight: 1.05 }}>
              One-Time Secret alternatives in 2026
            </h1>
            <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--muted)', lineHeight: 1.6 }}>
              One-Time Secret pioneered the burn-after-read category in 2012. Since then, the encryption
              model has moved on. Here is an honest comparison of the best alternatives — what each one
              actually does with your secret, verified from source code and documentation.
            </p>
          </header>

          {/* Why people look */}
          <section style={{ display: 'grid', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.5rem' }}>
              Why people look for alternatives
            </h2>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              One-Time Secret remains the most recognised tool in this category and still works well for
              casual use. But the original architecture has a meaningful limitation: encryption happens on
              the server, not in your browser. Your secret travels to their infrastructure in plaintext
              over TLS, and the server performs the encryption. That means the server can also perform
              the decryption — which is a different trust model from tools where the key never leaves
              your device.
            </p>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              Teams with stricter security requirements, or those sharing anything beyond low-sensitivity
              content, typically want browser-side encryption: the server stores only ciphertext and has
              no mechanism to decrypt it, regardless of who asks.
            </p>
          </section>

          {/* Criteria */}
          <section style={{ display: 'grid', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.5rem' }}>
              What to look for
            </h2>
            <p style={{ margin: 0, lineHeight: 1.7 }}>
              Not all burn-after-read tools are equivalent. These are the questions that separate a strong
              security model from a weaker one:
            </p>
            <ul style={{ margin: 0, paddingLeft: '1.4rem', display: 'grid', gap: '0.5rem', lineHeight: 1.7 }}>
              <li><strong>Where does encryption happen?</strong> Browser-side means the server only ever sees ciphertext. Server-side means the server received your plaintext.</li>
              <li><strong>Does the server hold the decryption key?</strong> If yes, a compromised or subpoenaed server can expose your secrets.</li>
              <li><strong>Does a wrong passphrase burn the secret?</strong> If so, a typo destroys the secret before the recipient ever sees it — a significant usability and security problem.</li>
              <li><strong>Can you request a secret, not just send one?</strong> Some workflows require collecting credentials from another person, not just sharing your own.</li>
              <li><strong>Can you destroy a link before it is opened?</strong> Essential if you sent a link to the wrong address.</li>
              <li><strong>Is the source code auditable?</strong> For a tool handling sensitive credentials, open source is a baseline trust requirement.</li>
            </ul>
          </section>

          {/* Comparison table */}
          <section style={{ display: 'grid', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.5rem' }}>
              Comparison at a glance
            </h2>
            <div style={{ overflowX: 'auto', borderRadius: '16px', border: '1px solid var(--border)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', minWidth: 600 }}>
                <thead>
                  <tr style={{ background: 'rgba(29,35,62,0.04)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Tool</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Encryption</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Server holds key</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Safe passphrase</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Request flow</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Destroy before open</th>
                    <th style={{ padding: '0.75rem 1rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }}>Open source</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: 'One-Time Secret', enc: 'Server', holdsKey: true, safePass: false, request: false, destroy: false, oss: true },
                    { name: 'Yopass', enc: 'Browser', holdsKey: false, safePass: false, request: false, destroy: false, oss: true },
                    { name: 'PrivateBin', enc: 'Browser', holdsKey: false, safePass: true, request: false, destroy: false, oss: true },
                    { name: 'Bitwarden Send', enc: 'Browser', holdsKey: false, safePass: true, request: false, destroy: true, oss: true },
                    { name: 'Cinderpass', enc: 'Browser', holdsKey: false, safePass: true, request: true, destroy: true, oss: true, highlight: true },
                  ].map((row, i) => (
                    <tr
                      key={row.name}
                      style={{
                        background: row.highlight ? 'rgba(255,107,61,0.06)' : i % 2 === 0 ? 'transparent' : 'rgba(29,35,62,0.02)',
                        fontWeight: row.highlight ? 600 : 400,
                      }}
                    >
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>{row.name}</td>
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', color: row.enc === 'Server' ? 'var(--muted)' : 'var(--success)' }}>{row.enc}</td>
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', color: row.holdsKey ? 'var(--danger)' : 'var(--success)' }}>{row.holdsKey ? 'Yes' : 'No'}</td>
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>{row.safePass ? '✓' : '–'}</td>
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>{row.request ? '✓' : '–'}</td>
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>{row.destroy ? '✓' : '–'}</td>
                      <td style={{ padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)' }}>{row.oss ? '✓' : '–'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--muted)', lineHeight: 1.5 }}>
              "Safe passphrase" means a wrong passphrase does not burn the secret. Verified from source code and official documentation, April 2026.
            </p>
          </section>

          {/* Tool breakdowns */}
          <section style={{ display: 'grid', gap: '1.75rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.5rem' }}>
              Each tool in detail
            </h2>

            {/* OTS */}
            <div style={{ display: 'grid', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '3px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>One-Time Secret</h3>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                The original. OTS launched in 2012 and established the burn-after-read pattern for an entire
                generation of security tools. It is reliable, widely known, and has a functioning API.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                The limitation is architectural: secrets are encrypted on the server, not in the browser.
                Two sources confirm this. First,{' '}
                <a href="https://docs.onetimesecret.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>their official documentation</a>{' '}
                states: <em>"Your secrets are securely encrypted on our servers."</em> Second, the{' '}
                <a href="https://github.com/onetimesecret/onetimesecret/blob/main/lib/onetime/models/secret.rb" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>open-source model code</a>{' '}
                shows a <code style={{ fontFamily: 'monospace', fontSize: '0.9em', background: 'rgba(29,35,62,0.06)', padding: '0.1em 0.3em', borderRadius: '4px' }}>decrypted_secret_value</code>{' '}
                method that decrypts stored ciphertext server-side — which only makes sense if the server
                also holds the encryption key. The passphrase is likewise handled as a transient server-side
                field. For teams sharing high-sensitivity credentials — API keys, database passwords, private
                keys — this means placing trust in OTS's infrastructure and operators, not just their TLS certificate.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Best for:</strong> Low-sensitivity one-time notes where server-side encryption is acceptable. Long-established integrations that use the OTS API.
              </p>
            </div>

            {/* Yopass */}
            <div style={{ display: 'grid', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '3px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Yopass</h3>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Yopass is a clean, open-source alternative from Johan Haals. Encryption happens in the
                browser using PGP/AES-256, and the decryption key is embedded in the URL fragment —
                never transmitted to the server. The server stores only ciphertext in Redis or Memcached.
                It is self-hostable and has a minimal, usable interface.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                The main limitation is that Yopass does not have passphrase protection beyond the URL key
                itself, and there is no mechanism to destroy a secret before it is opened.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Best for:</strong> Self-hosted deployments where you want browser-side encryption with minimal operational overhead.
              </p>
            </div>

            {/* PrivateBin */}
            <div style={{ display: 'grid', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '3px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>PrivateBin</h3>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                PrivateBin is a zero-knowledge paste bin — technically more pastebin than secret-sharing
                tool, but widely used for burn-after-read use cases. Encryption is AES-256-GCM in the
                browser, PBKDF2-SHA256 key derivation, key in the URL fragment. The passphrase is handled
                client-side, so a wrong passphrase does not destroy the secret. Self-hostable in PHP with
                no database required (filesystem or S3 storage).
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                PrivateBin supports expiry and burn-after-read but the interface is oriented toward pastes
                rather than credential handoffs. There is no request flow, no destroy token, and no
                purpose-built UI for sharing credentials vs. sharing text.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Best for:</strong> Self-hosted teams that want a proven, widely-audited codebase and are comfortable with the pastebin-style UX.
              </p>
            </div>

            {/* Bitwarden Send */}
            <div style={{ display: 'grid', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '3px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Bitwarden Send</h3>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Bitwarden Send is the most fully-featured option in this list — if you already use
                Bitwarden. Encryption is client-side using a seed-based key derivation scheme; the key
                lives in the URL fragment and never reaches the server. Password-protected sends use PBKDF2
                client-side. You can set an expiry, a view limit, and destroy a Send before it is opened.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                The catch: sending requires a Bitwarden account, and the recipient UI is tied to the
                Bitwarden ecosystem. There is no request flow for collecting credentials from someone
                else, and the tool is designed as an adjunct to a password manager rather than a
                standalone handoff surface.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Best for:</strong> Teams already on Bitwarden who want a native secure sharing flow without setting up a separate tool.
              </p>
            </div>

            {/* Cinderpass */}
            <div style={{ display: 'grid', gap: '0.75rem', padding: '1rem', borderRadius: '16px', border: '1px solid rgba(255,107,61,0.25)', background: 'rgba(255,107,61,0.04)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Cinderpass</h3>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Cinderpass was built specifically for the credential handoff workflow. Secrets are encrypted
                with AES-256-GCM in the browser; the decryption key lives in the URL fragment and never
                reaches the server. Passphrase protection uses PBKDF2-SHA256 client-side — a wrong
                passphrase increments a per-secret attempt counter (locked after 5 failures) but does not
                burn the secret. Every link includes a destroy token for pre-delivery revocation.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                The feature that sets it apart is the <strong>request flow</strong>: you can create a
                secure request page, share the URL with a colleague or contractor, and they submit
                credentials to you through an encrypted form — no back-and-forth in chat, no credentials
                in email. No account is required on either side.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7 }}>
                Honest caveats: Cinderpass is newer and has not yet had an independent security audit. The
                security model is auditable — the full source is on{' '}
                <a href="https://github.com/eleco/cinderpass" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>GitHub</a>{' '}
                and every deployed build links to its exact commit — but it has not been reviewed by
                an independent third party.
              </p>
              <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--muted)' }}>
                <strong style={{ color: 'var(--text)' }}>Best for:</strong> Teams that need browser-side encryption, a request flow, and no account requirement. A self-contained credential handoff surface.
              </p>
            </div>
          </section>

          {/* Which one */}
          <section style={{ display: 'grid', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.5rem' }}>
              Which one should you use?
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.4rem', display: 'grid', gap: '0.6rem', lineHeight: 1.7 }}>
              <li><strong>You need to collect credentials from someone, not just send them →</strong> Cinderpass (only tool with a request flow)</li>
              <li><strong>You are already on Bitwarden →</strong> Bitwarden Send (no extra tool needed)</li>
              <li><strong>You want to self-host on PHP with no database →</strong> PrivateBin</li>
              <li><strong>You want browser-side encryption, self-hosted, Go stack →</strong> Yopass</li>
              <li><strong>Server-side encryption is acceptable and you want the most battle-tested option →</strong> One-Time Secret</li>
              <li><strong>You need browser-side encryption with no account and a polished handoff UI →</strong> Cinderpass</li>
            </ul>
          </section>

          {/* FAQ */}
          <section style={{ display: 'grid', gap: '1rem' }}>
            <h2 style={{ margin: 0, fontFamily: 'var(--font-display)', letterSpacing: '-0.03em', fontSize: '1.5rem' }}>
              Frequently asked questions
            </h2>
            <div style={{ display: 'grid', gap: '1.25rem' }}>
              {faqSchema.mainEntity.map((item) => (
                <div key={item.name} style={{ display: 'grid', gap: '0.4rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{item.name}</h3>
                  <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--muted)' }}>{item.acceptedAnswer.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div style={{ display: 'grid', gap: '0.75rem', padding: '1.5rem', borderRadius: '20px', background: 'var(--surface)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <strong style={{ fontSize: '1.1rem' }}>Try Cinderpass — no account needed</strong>
            <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>
              Browser-side AES-256-GCM encryption, burn-after-read links, passphrase protection, and a request flow for collecting credentials from others.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href="/" className="btn btn-primary" style={{ width: 'auto' }}>Share a secret →</a>
              <a href="/secure-password-sharing" style={{ color: 'var(--muted)', fontSize: '0.9rem', display: 'flex', alignItems: 'center' }}>How it works →</a>
            </div>
          </div>

          {/* Internal links */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.5rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.9rem', color: 'var(--muted)' }}>
            <a href="/secure-password-sharing" style={{ color: 'var(--accent)' }}>Secure password sharing →</a>
            <a href="/one-time-link" style={{ color: 'var(--accent)' }}>One-time links →</a>
            <a href="/send-secret-message" style={{ color: 'var(--accent)' }}>Send a secret message →</a>
            <a href="/faq" style={{ color: 'var(--accent)' }}>FAQ →</a>
          </div>

        </article>
      </div>
    </main>
  );
}
