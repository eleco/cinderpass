const surfaces = [
  {
    title: 'Sender browser',
    eyebrow: 'Client-side encryption',
    points: [
      'Generates a fresh random 256-bit AES key with Web Crypto.',
      'Encrypts plaintext with AES-256-GCM before upload.',
      'Can optionally protect the key fragment with a passphrase.',
    ],
  },
  {
    title: 'Cinderpass server',
    eyebrow: 'Ciphertext storage',
    points: [
      'Receives ciphertext, IV, note, expiry, and burn state.',
      'Never receives plaintext or the raw decryption key.',
      'Marks the secret burned on first successful reveal.',
    ],
  },
  {
    title: 'Recipient browser',
    eyebrow: 'Client-side decryption',
    points: [
      'Reads the `#k` fragment locally from the shared link.',
      'Requests the encrypted payload using only the secret ID.',
      'Decrypts in-browser after passphrase verification if required.',
    ],
  },
] as const;

const transfers = [
  {
    title: 'Upload from sender to server',
    from: 'Sender browser',
    to: 'Cinderpass server',
    payload: 'ciphertext + IV + metadata',
    note: 'The plaintext and raw AES key never cross the network.',
    tone: 'warm',
  },
  {
    title: 'Shared link between people',
    from: 'Sender',
    to: 'Recipient',
    payload: '/secret/abc123#k=random-key',
    note: 'The secret ID points to the stored ciphertext. The `#k` fragment stays in the browser.',
    tone: 'deep',
  },
  {
    title: 'Reveal request from recipient to server',
    from: 'Recipient browser',
    to: 'Cinderpass server',
    payload: '/api/retrieve/:id',
    note: 'Browsers do not send URL fragments in HTTP requests, so the server never sees `#k`.',
    tone: 'cool',
  },
] as const;

export function ArchitectureMap() {
  return (
    <div className="architecture-page-stack">
      <section className="architecture-surfaces" aria-labelledby="architecture-surfaces-title">
        <div className="architecture-section-head">
          <div className="eyebrow">System surfaces</div>
          <h2 id="architecture-surfaces-title" className="landing-h2">Three places, three different trust boundaries.</h2>
        </div>

        <div className="architecture-surface-grid">
          {surfaces.map((surface) => (
            <article key={surface.title} className="architecture-surface-card">
              <div className="architecture-surface-eyebrow">{surface.eyebrow}</div>
              <h3>{surface.title}</h3>
              <ul className="architecture-list">
                {surface.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-transfers" aria-labelledby="architecture-transfers-title">
        <div className="architecture-section-head">
          <div className="eyebrow">Data movement</div>
          <h2 id="architecture-transfers-title" className="landing-h2">What moves, and what stays separated.</h2>
        </div>

        <div className="architecture-transfer-list">
          {transfers.map((transfer) => (
            <article key={transfer.title} className={`architecture-transfer-card architecture-transfer-${transfer.tone}`}>
              <div className="architecture-transfer-topline">{transfer.title}</div>
              <div className="architecture-transfer-route">
                <span>{transfer.from}</span>
                <span className="architecture-transfer-arrow" aria-hidden="true">→</span>
                <span>{transfer.to}</span>
              </div>
              <div className="architecture-transfer-payload">{transfer.payload}</div>
              <p>{transfer.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="architecture-split" aria-labelledby="architecture-split-title">
        <div className="architecture-section-head">
          <div className="eyebrow">Key separation</div>
          <h2 id="architecture-split-title" className="landing-h2">The design works because the two halves stay apart.</h2>
        </div>

        <div className="architecture-split-grid">
          <article className="architecture-split-card architecture-split-card-strong">
            <h3>Server-visible</h3>
            <ul className="architecture-list">
              <li>Secret ID</li>
              <li>Ciphertext</li>
              <li>IV</li>
              <li>Expiry, note, burn status</li>
              <li>Optional passphrase verifier data</li>
            </ul>
          </article>

          <article className="architecture-split-card architecture-split-card-accent">
            <h3>Browser-local only</h3>
            <ul className="architecture-list">
              <li>Plaintext before encryption</li>
              <li>Random 256-bit AES key</li>
              <li>`#k` URL fragment</li>
              <li>Recovered plaintext after decryption</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
