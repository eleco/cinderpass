import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'Send a Secret Message — End-to-End Encrypted, Burn After Reading',
  description:
    'Send a secret message that disappears after reading. Encrypted in your browser, destroyed on first open. No accounts, no plaintext storage.',
};

export default function SendSecretMessagePage() {
  return (
    <LandingPage
      slug="send-secret-message"
      subtitle="Send secret messages"
      title="Send a message that disappears after reading."
      intro="Cinderpass lets you send sensitive information as an encrypted, self-destructing message. The content is encrypted in your browser before it is stored. The recipient retrieves the message once; retrieval removes its encrypted contents from the live database."
      ctaLabel="Send a secret message — no account needed"
      features={[
        {
          title: 'Encrypted end-to-end',
          body: 'Messages are encrypted with AES-256-GCM in your browser. The server stores only ciphertext. Without the decryption key — which never leaves your browser — the message is unreadable to anyone, including us.',
        },
        {
          title: 'Destroyed after reading',
          body: 'The encrypted contents are removed from the live database on retrieval. The recipient can still save or copy the decrypted message.',
        },
        {
          title: 'No account required',
          body: 'Send a secret message in seconds without creating an account. Nothing is tied to your email address or identity.',
        },
        {
          title: 'Passphrase protection',
          body: 'Add a passphrase so only the intended recipient can decrypt the message. Send the link one way and the passphrase another — even if the link is intercepted, the message cannot be read.',
        },
        {
          title: 'Request messages securely',
          body: 'Need someone to send you something sensitive? Create a secure request page and share the link. They submit through an encrypted form — no message content passes through email or chat.',
        },
        {
          title: 'Choose how long it lasts',
          body: 'Set the message to expire after 1 hour, 24 hours, or 7 days if it is not opened. Expired messages are permanently inaccessible.',
        },
      ]}
      faqs={[
        {
          q: 'How is this different from sending a message over Signal or WhatsApp?',
          a: 'Signal and WhatsApp protect messages in transit but both parties retain copies. Cinderpass is for one-time delivery — the message exists exactly once. Retrieval removes its encrypted contents from the live database, while recipients can still retain their own copies.',
        },
        {
          q: 'Can the recipient save or screenshot the message?',
          a: 'Yes — once decrypted, the content is visible in the recipient\'s browser and they can copy or screenshot it. Cinderpass controls what the server stores, not what happens in someone\'s browser or device. For highly sensitive content, use a passphrase and communicate out of band.',
        },
        {
          q: 'Is the message truly gone after reading?',
          a: 'The encrypted payload is removed from the live database on retrieval. Cinderpass cannot retrieve it again. Provider backups have separate retention policies, and recipients may keep copies.',
        },
        {
          q: 'What if the recipient never opens the message?',
          a: 'The message expires after the TTL you selected (1 hour, 24 hours, or 7 days) and is permanently inaccessible after that.',
        },
        {
          q: 'Can I send a message to multiple people?',
          a: 'No — each link burns on first open. If you need multiple people to read the same content, create a separate link for each recipient.',
        },
        {
          q: 'Is there a character limit?',
          a: 'Messages are capped at 48 KB of plaintext — roughly 48,000 characters. This is sufficient for any note, token, key, or block of text.',
        },
      ]}
    />
  );
}
