import './globals.css';
import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Space_Grotesk } from 'next/font/google';
import { getConfiguredBaseUrl } from '@/lib/utils';

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-display',
});

export const metadata: Metadata = {
  title: {
    default: 'Cinderpass — Secure One-Time Secret & Password Sharing',
    template: '%s — Cinderpass',
  },
  description:
    'Share passwords, API keys, and credentials with a one-time link. Encrypted in your browser. Burns after reading. Free and open source.',
  metadataBase: new URL(getConfiguredBaseUrl()),
  openGraph: {
    siteName: 'Cinderpass',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${spaceGrotesk.variable}`}>
        {children}
      </body>
    </html>
  );
}
