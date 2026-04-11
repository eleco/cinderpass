import type { Metadata } from 'next';
import { SecretReader } from '@/components/forms';
import { SecurityExplainer } from '@/components/SecurityExplainer';

export const metadata: Metadata = {
  title: 'Reveal secret — Cinderpass',
};

export default async function SecretPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="dest-shell">
      <div className="dest-container">
        <div className="dest-brand">
          <a href="/" className="badge badge-solid">Cinderpass</a>
        </div>
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1>Reveal secret</h1>
          <p className="muted">Open carefully. A successful retrieval burns this secret permanently.</p>
          <SecretReader id={id} />
        </div>
        <SecurityExplainer />
      </div>
    </main>
  );
}
