import { InformationalAnalytics } from '@/components/InformationalAnalytics';

export default function InformationalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<InformationalAnalytics /></>;
}
