import { JsonLd } from '@/components/JsonLd';

type Faq = { q: string; a: string };
type Feature = { title: string; body: string };

export function LandingPage({
  title,
  subtitle,
  intro,
  features,
  faqs,
  ctaHref = '/',
  ctaLabel = 'Try it free — no account needed',
  slug,
}: {
  title: string;
  subtitle: string;
  intro: string;
  features: Feature[];
  faqs: Faq[];
  ctaHref?: string;
  ctaLabel?: string;
  slug: string;
}) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    url: `${base}/${slug}`,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };

  return (
    <main className="dest-shell">
      <JsonLd data={schema} />
      <div className="dest-container landing-container">
        <div className="dest-brand">
          <a href="/" className="badge badge-solid">Cinderpass</a>
        </div>

        {/* Hero */}
        <section className="landing-hero">
          <p className="eyebrow">{subtitle}</p>
          <h1 className="landing-h1">{title}</h1>
          <p className="landing-intro">{intro}</p>
          <a href={ctaHref} className="landing-cta">{ctaLabel} →</a>
        </section>

        {/* Features */}
        <section className="landing-features">
          {features.map((f) => (
            <div key={f.title} className="landing-feature">
              <strong>{f.title}</strong>
              <p>{f.body}</p>
            </div>
          ))}
        </section>

        {/* FAQ */}
        <section className="landing-faq-section">
          <h2 className="landing-h2">Common questions</h2>
          <div className="landing-faq-list">
            {faqs.map((f) => (
              <div key={f.q} className="landing-faq-item">
                <h3 className="landing-faq-q">{f.q}</h3>
                <p className="landing-faq-a">{f.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="landing-bottom-cta">
          <p>Ready to stop sharing passwords over Slack?</p>
          <a href={ctaHref} className="landing-cta">{ctaLabel} →</a>
        </section>

        <footer className="footer" style={{ justifyContent: 'center', gap: '1rem' }}>
          <a href="/" className="version-badge">Home</a>
          <a href="/faq" className="version-badge">FAQ</a>
        </footer>
      </div>
    </main>
  );
}
