import type { Metadata } from 'next';
import { getRequest } from '@/lib/store';
import { RequestSubmitForm } from '@/components/forms';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Submit secret',
};

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main className="dest-shell">
      <div className="dest-container">
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1>{title}</h1>
          <p className="muted">{body}</p>
        </div>
      </div>
    </main>
  );
}

export default async function RequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const request = await getRequest(token);

  if (request.state === 'missing') {
    return <Notice title="Request not found" body="The request link is invalid or has been removed." />;
  }
  if (request.state === 'closed') {
    return <Notice title="Request closed" body="This request has expired or its secret has already been delivered." />;
  }

  return (
    <main className="dest-shell">
      <div className="dest-container">
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1>Submit secret securely</h1>
          <p className="muted">The plaintext is encrypted in your browser before it is sent.</p>
          <RequestSubmitForm
            token={token}
            label={request.label}
            note={request.note}
            expired={request.state === 'used'}
            expiresAt={request.expiresAt.toISOString()}
          />
        </div>
        <SiteFooter />
      </div>
    </main>
  );
}
