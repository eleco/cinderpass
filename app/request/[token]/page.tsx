import type { Metadata } from 'next';
import { getRequest } from '@/lib/store';
import { RequestSubmitForm } from '@/components/forms';
import { SiteFooter } from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Send a secret',
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
    return <Notice title="Request not found" body="This link doesn't work. It may have been mistyped or removed." />;
  }
  if (request.state === 'closed') {
    return <Notice title="Link closed" body="This link has expired, or the answer has already been sent." />;
  }

  return (
    <main className="dest-shell">
      <div className="dest-container">
        <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
          <h1>Someone asked you for a secret</h1>
          <p className="muted">Your answer is locked on your device before it is sent. Only the person who asked can open it.</p>
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
