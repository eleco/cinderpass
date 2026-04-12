import type { Metadata } from 'next';
import { ArchitectureMap } from '@/components/ArchitectureMap';

export const metadata: Metadata = {
  title: 'Security Architecture',
  description:
    'How Cinderpass separates ciphertext from the decryption key: browser-side encryption, URL fragment key delivery, and one-time burn semantics.',
};

export default function ArchitecturePage() {
  return (
    <main className="dest-shell">
      <div className="dest-container landing-container architecture-page-container">
        <div className="dest-brand">
          <a href="/" className="badge badge-solid">Cinderpass</a>
        </div>

        <section className="landing-hero architecture-hero">
          <p className="eyebrow">Security architecture</p>
          <h1 className="landing-h1">The server stores ciphertext. The link carries the key boundary.</h1>
          <p className="landing-intro">
            Cinderpass is built so encryption and decryption happen in browsers, while the server
            only stores opaque encrypted blobs and one-time state. The architecture is less about
            fancy crypto primitives than about keeping the decryption key physically separate from
            what the server stores.
          </p>
        </section>

        <ArchitectureMap />

        <section className="landing-bottom-cta architecture-bottom-cta">
          <p>Need the full behavior details too?</p>
          <div className="architecture-bottom-links">
            <a href="/faq" className="landing-cta">Read the FAQ →</a>
            <a href="/" className="landing-cta architecture-secondary-cta">Create a one-time secret →</a>
          </div>
        </section>

        <footer className="footer" style={{ justifyContent: 'center', gap: '1rem' }}>
          <a href="/" className="version-badge">Home</a>
          <a href="/faq" className="version-badge">FAQ</a>
          <a href="/architecture" className="version-badge">Architecture</a>
        </footer>
      </div>
    </main>
  );
}
