import { SecretReader } from '@/components/forms';

export default async function SecretPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main className="container" style={{ paddingTop: '2rem' }}>
      <div className="card" style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1>Reveal secret</h1>
        <p className="muted">Open carefully. A successful retrieval burns this secret.</p>
        <SecretReader id={id} />
      </div>
    </main>
  );
}
