'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { buildPageview, type AnalyticsConfig } from '@/lib/analytics';

export function InformationalPageview({ config }: { config: AnalyticsConfig }) {
  const pathname = usePathname();
  const lastPath = useRef<string | null>(null);
  useEffect(() => {
    function send(restored = false) {
      // Check the live location, not only the render's pathname, to handle navigation races.
      if (window.location.pathname !== pathname || (!restored && lastPath.current === pathname)) return;
      if (!window.crypto?.randomUUID) return;
      const gpc = (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;
      const payload = buildPageview(config, window.location, document.referrer, gpc, crypto.randomUUID());
      if (!payload) return;
      lastPath.current = pathname;
      void fetch(config.endpoint, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload),
        credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      }).catch(() => { /* Analytics must never interrupt the page. */ });
    }
    const pageShow = (event: PageTransitionEvent) => { if (event.persisted) send(true); };
    const visible = () => { if (document.visibilityState === 'visible') send(); };
    // Speculatively loaded pages should not count until visible.
    visible();
    window.addEventListener('pageshow', pageShow);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('pageshow', pageShow);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [pathname, config]);
  return null;
}
