import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import { isExpired } from '@/lib/utils';
import { RequestSubmitForm } from '@/components/forms';

export const metadata: Metadata = {
  title: 'Submit secret — Cinderpass',
};

export default async function RequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await prisma.secretRequest.findUnique({ where: { token } });

  if (!request) {
    return (
      <main className="dest-shell">
        <div className="dest-container">
          <div className="dest-brand">
            <a href="/" className="badge badge-solid">Cinderpass</a>
          </div>
          <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
            <h1>Request not found</h1>
            <p className="muted">The request link is invalid or has been removed.</p>
          </div>
        </div>
      </main>
    );
  }

  const expired = request.status !== 'OPEN' || isExpired(request.expiresAt);

  return (
    <main className="dest-shell">
      <div className="dest-container">
        <div className="dest-brand">
          <a href="/" className="badge badge-solid">Cinderpass</a>
        </div>
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1>Submit secret securely</h1>
          <p className="muted">The plaintext is encrypted in your browser before it is sent.</p>
          <RequestSubmitForm
            token={token}
            label={request.label}
            note={request.note}
            expired={expired}
            expiresAt={request.expiresAt.toISOString()}
          />
        </div>
      </div>
    </main>
  );
}
