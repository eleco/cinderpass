import type { Metadata } from 'next';
import { SecretReader } from '@/components/forms';
import { SecurityExplainer } from '@/components/SecurityExplainer';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Someone sent you a secret',
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
          <h1>Someone sent you a secret</h1>
          <p className="muted">It can only be opened once. After that, it's deleted for good.</p>
          <SecretReader id={id} />
        </div>
        <SecurityExplainer />
        <SiteFooter />
      </div>
    </main>
  );
}
