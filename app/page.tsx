import { SecretCreateForm, SecretRequestForm } from '@/components/forms';

export default function HomePage() {
  return (
    <main className="container">
      <div className="header">
        <div className="badge">Burnlink</div>
        <div className="small muted">Open-source one-time secret sharing for serious teams</div>
      </div>

      <section className="hero">
        <h1>Share secrets once. Then they are gone.</h1>
        <p>
          Browser-side encryption, one-time retrieval, and a request-secret flow for support desks,
          MSPs, and engineering teams. The server stores ciphertext, not plaintext.
        </p>
      </section>

      <section className="grid">
        <div className="card">
          <h2>Create a one-time secret link</h2>
          <p className="muted">Encrypt in the browser, store ciphertext on the server, and share a burn-after-read link.</p>
          <SecretCreateForm />
        </div>

        <div className="card">
          <h2>Create a secure request page</h2>
          <p className="muted">Ask someone to send you a password or token through a one-time encrypted handoff.</p>
          <SecretRequestForm />
        </div>
      </section>

      <section className="grid" style={{ marginTop: '1.2rem' }}>
        <div className="card">
          <h3>How this MVP works</h3>
          <div className="stack small muted">
            <div>1. Secret is encrypted in the browser with AES-GCM.</div>
            <div>2. The decryption key fragment stays in the URL fragment, not in the database.</div>
            <div>3. The server returns ciphertext once, then marks the secret as opened and destroyed.</div>
          </div>
        </div>
        <div className="card">
          <h3>What still needs hardening</h3>
          <div className="stack small muted">
            <div>Rate limiting and bot protection.</div>
            <div>Email notifications, audit trail, team workspaces, and SSO.</div>
            <div>Independent security review before you pitch this as a serious trust product.</div>
          </div>
        </div>
      </section>

      <div className="footer small">
        Built for Vercel + Next.js App Router + Prisma/Postgres.
      </div>
    </main>
  );
}
