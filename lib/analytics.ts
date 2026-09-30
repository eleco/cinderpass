export const INFORMATIONAL_PATHS = [
  '/architecture', '/faq', '/one-time-link', '/one-time-secret-alternatives',
  '/secure-password-sharing', '/send-secret-message',
] as const;

export type AnalyticsConfig = { endpoint: string; siteId: string; origin: string };

export function getAnalyticsConfig(env: Record<string, string | undefined>): AnalyticsConfig | null {
  const { ANALYTICS_SCRIPT_URL: script, ANALYTICS_SITE_ID: siteId, ANALYTICS_SITE_ORIGIN: origin } = env;
  if (!script || !siteId || !origin || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(siteId)) return null;
  try {
    const source = new URL(script), site = new URL(origin);
    if (source.protocol !== 'https:' || site.protocol !== 'https:' || source.username || source.password || site.username || site.password || site.origin !== origin || source.search || source.hash) return null;
    return { endpoint: new URL('/api/site-events', source).href, siteId, origin };
  } catch { return null; }
}

export function buildPageview(config: AnalyticsConfig, location: { origin: string; pathname: string }, referrer: string, gpc: boolean, eventId: string) {
  if (gpc || location.origin !== config.origin || !(INFORMATIONAL_PATHS as readonly string[]).includes(location.pathname)) return null;
  let referringHost = '';
  try {
    const url = new URL(referrer);
    if (['https:', 'http:'].includes(url.protocol) && url.hostname !== new URL(config.origin).hostname) referringHost = url.hostname;
  } catch { /* Missing referrers are normal. */ }
  return { siteId: config.siteId, eventId, path: location.pathname, referrer: referringHost };
}
