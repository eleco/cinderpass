import { getAnalyticsConfig } from '@/lib/analytics';
import { InformationalPageview } from './InformationalPageview';

export function InformationalAnalytics() {
  // Server-only configuration: forks are disabled unless their operator opts in.
  const config = getAnalyticsConfig(process.env);
  return config ? <InformationalPageview config={config} /> : null;
}
