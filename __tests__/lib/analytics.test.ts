import { describe, it, expect } from 'vitest';
import { buildPageview, getAnalyticsConfig, INFORMATIONAL_PATHS } from '@/lib/analytics';
const env = { ANALYTICS_SCRIPT_URL: 'https://stats.example/tracker.js', ANALYTICS_SITE_ID: '11111111-1111-4111-8111-111111111111', ANALYTICS_SITE_ORIGIN: 'https://example.com' };
const config = getAnalyticsConfig(env)!;
describe('optional informational analytics', () => {
  it('is disabled without complete valid deployment configuration', () => {
    expect(getAnalyticsConfig({})).toBeNull();
    for (const key of Object.keys(env)) expect(getAnalyticsConfig({ ...env, [key]: '' })).toBeNull();
    expect(getAnalyticsConfig({ ...env, ANALYTICS_SCRIPT_URL: 'https://user:pass@stats.example/x' })).toBeNull();
    expect(getAnalyticsConfig({ ...env, ANALYTICS_SCRIPT_URL: 'javascript:alert(1)' })).toBeNull();
    expect(config.endpoint).toBe('https://stats.example/api/site-events');
  });
  it('never collects home, secret, request or unknown paths', () => {
    for (const pathname of ['/', '/secret/private-id', '/request/private-token', '/api/secrets', '/faq/private', '/unlisted']) {
      expect(buildPageview(config, { origin: config.origin, pathname }, '', false, 'event')).toBeNull();
    }
  });
  it('limits payloads to fixed informational paths and external referring hostnames', () => {
    for (const pathname of INFORMATIONAL_PATHS) {
      const location = { origin: config.origin, pathname, hash: '#key', search: '?secret=value' };
      const payload = buildPageview(config, location, 'https://search.example/private?token=hidden#fragment', false, 'event');
      expect(payload).toEqual({ siteId: config.siteId, eventId: 'event', path: pathname, referrer: 'search.example' });
    }
    expect(buildPageview(config, { origin: config.origin, pathname: '/faq' }, 'https://example.com/secret/id', false, 'event')?.referrer).toBe('');
  });
  it('respects GPC and excludes preview deployments and forks', () => {
    expect(buildPageview(config, { origin: config.origin, pathname: '/faq' }, '', true, 'event')).toBeNull();
    expect(buildPageview(config, { origin: 'https://preview.example', pathname: '/faq' }, '', false, 'event')).toBeNull();
  });
});
