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
    default: 'Cinderpass — Send a Secret Message That Disappears',
    template: '%s — Cinderpass',
  },
  description:
    'Send a private message that disappears after it is read: a door code, where you left the key, a Wi-Fi or account password. Encrypted in your browser. Free, no account needed.',
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
