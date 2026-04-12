import type { MetadataRoute } from 'next';
import { getConfiguredBaseUrl } from '@/lib/utils';

const base = getConfiguredBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/secret/', '/request/'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
