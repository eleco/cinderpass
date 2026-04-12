import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'Secure Password Sharing',
  description:
    'Share passwords and credentials securely with a one-time link. Encrypted in the browser, burned after reading. No accounts required.',
};

export default function SecurePasswordSharingPage() {
  return (
    <LandingPage
      slug="secure-password-sharing"
      subtitle="Secure password sharing"
      title="Stop sharing passwords over Slack and email."
      intro="Every time a password lands in a chat thread or inbox, it leaves a trail. Cinderpass encrypts credentials in your browser and generates a one-time link that burns the moment it is opened — leaving no plaintext behind anywhere."
      ctaLabel="Share a password securely — no account needed"
      features={[
        {
          title: 'Encrypted before it leaves your device',
          body: 'Passwords are encrypted with AES-256-GCM in your browser. The server stores ciphertext only. Even if the database were breached, there would be nothing readable.',
        },
        {
          title: 'Burns on first open',
          body: 'The link works exactly once. The moment the recipient decrypts the password, the server permanently destroys the record. Opening it twice is impossible.',
        },
        {
          title: 'No account, no tracking',
          body: 'Create a secure password sharing link in seconds with no sign-up. Nothing is tied to your identity.',
        },
        {
          title: 'Optional passphrase',
          body: 'Add a passphrase for a second layer of protection. Send the link over one channel and the passphrase over another — even a compromised link cannot be decrypted without it.',
        },
        {
          title: 'Request passwords securely',
          body: 'Need someone to share a password with you? Create a secure request page and send them the link. They submit through an encrypted form — no back-and-forth in chat.',
        },
        {
          title: 'Works for any credential',
          body: 'API keys, database passwords, SSH keys, recovery codes, two-factor backup codes — anything that should not live in a chat thread.',
        },
      ]}
      faqs={[
        {
          q: 'Is Cinderpass safe for sharing passwords?',
          a: 'Yes. Passwords are encrypted with AES-256-GCM in your browser before transmission. The server never receives the plaintext or the decryption key. The key fragment is placed in the URL hash, which browsers do not send to servers. Only the recipient with the full link can decrypt.',
        },
        {
          q: 'What happens to the password after it is opened?',
          a: 'The server atomically marks the secret as destroyed the moment the link is opened. The ciphertext remains in the database but is permanently inaccessible — the decryption key was never stored server-side.',
        },
        {
          q: 'Can I use this to share passwords with external contractors?',
          a: 'Yes. The recipient needs no account. They open the link, enter a passphrase if one was set, and the password decrypts in their browser. Nothing is stored in their account or any shared system.',
        },
        {
          q: 'What is the difference between this and a password manager?',
          a: 'A password manager stores passwords for ongoing access. Cinderpass is for one-time handoff — getting a credential from one person to another without leaving a trace. Use a password manager to store credentials; use Cinderpass to share them during onboarding, handover, or incident response.',
        },
        {
          q: 'Is there a size limit on what I can share?',
          a: 'Secrets are capped at 48 KB of plaintext. This covers any password, API key, certificate, or private key.',
        },
        {
          q: 'How long does the link stay active?',
          a: 'You choose: 1 hour, 24 hours, or 7 days. The link expires automatically if not opened within that window.',
        },
      ]}
    />
  );
}
