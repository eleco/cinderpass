import type { MetadataRoute } from 'next';

const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/architecture`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/secure-password-sharing`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/one-time-link`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/send-secret-message`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/one-time-secret-alternatives`, changeFrequency: 'monthly', priority: 0.9 },
  ];
}
