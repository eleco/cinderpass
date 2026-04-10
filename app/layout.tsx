import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Burnlink',
  description: 'Open-source one-time secret sharing for serious teams.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
