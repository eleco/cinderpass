import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';

export const metadata: Metadata = {
  title: 'One-Time Link — Share Secrets That Self-Destruct',
  description:
    'Generate a one-time link for any secret. Encrypted in the browser, destroyed on first open. No accounts, no storage of plaintext.',
};

export default function OneTimeLinkPage() {
  return (
    <LandingPage
      slug="one-time-link"
      subtitle="One-time secret links"
      title="A link that works once, then disappears."
      intro="Cinderpass generates one-time links for secrets, passwords, and credentials. The link is valid for a single retrieval. The moment it is opened, the content is decrypted in the recipient's browser and the record is permanently destroyed on the server."
      ctaLabel="Generate a one-time link — no account needed"
      features={[
        {
          title: 'Single-use by design',
          body: 'Each link can only be opened once. A second attempt returns an error. There is no way to re-open or replay a used link.',
        },
        {
          title: 'Key never stored on the server',
          body: 'The decryption key is embedded in the URL fragment — the part after #. Browsers never send fragments to servers, so Cinderpass cannot decrypt the content even if compelled to.',
        },
        {
          title: 'Atomic destruction',
          body: 'The burn is a single atomic database write. If two requests race to open the same link simultaneously, only one succeeds. The other receives an "already opened" response.',
        },
        {
          title: 'Configurable expiry',
          body: 'Set the link to expire after 1 hour, 24 hours, or 7 days. Expired links are inaccessible regardless of whether they were opened.',
        },
        {
          title: 'Destroy before delivery',
          body: 'Sent the link to the wrong person? A destroy token is generated with every link. Use it to burn the secret before anyone opens it.',
        },
        {
          title: 'Open source and verifiable',
          body: 'The full source code is public. The footer links to the exact commit running in production so you can verify the deployed code matches what is on GitHub.',
        },
      ]}
      faqs={[
        {
          q: 'What is a one-time link?',
          a: 'A one-time link is a URL that contains an encrypted payload and can only be decrypted once. After the first successful retrieval, the underlying record is permanently destroyed. Subsequent attempts to open the link return an error.',
        },
        {
          q: 'How is the one-time link different from a normal URL?',
          a: 'A normal URL can be opened unlimited times by anyone with access. A one-time link from Cinderpass burns on first open, meaning only the first person to open it can read the content. The decryption key is in the URL fragment and never touches the server.',
        },
        {
          q: 'What if I accidentally open the link myself?',
          a: 'The secret is burned. You will need to create a new one. This is by design — the moment the link is opened, the content is destroyed regardless of who opened it.',
        },
        {
          q: 'Can the link be forwarded?',
          a: 'Yes, and the security model accounts for this. Whoever opens the link first gets the secret. If you are concerned about forwarding, add a passphrase and share it separately — a forwarded link without the passphrase cannot be decrypted.',
        },
        {
          q: 'What happens if no one opens the link?',
          a: 'The link expires automatically after the TTL you selected (1 hour, 24 hours, or 7 days). Expired links are permanently inaccessible.',
        },
        {
          q: 'Is there an API for generating one-time links programmatically?',
          a: 'Yes. POST to /api/secrets with a ciphertext and IV (encrypted client-side) and you receive a share URL and a destroy token. Full API documentation is in the README on GitHub.',
        },
      ]}
    />
  );
}
