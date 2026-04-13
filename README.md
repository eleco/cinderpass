# Cinderpass

**Burn-after-read secret sharing for engineering and ops teams.**

Cinderpass gives teams a clean way to pass API keys, recovery codes, and one-off credentials without leaving plaintext in Slack threads, email chains, or ticket comments. Secrets are encrypted in the browser before they reach the server. The server never sees the plaintext or the raw decryption key.

---

## How it works

1. **Encrypt in the browser** — the secret is encrypted with AES-256-GCM before it leaves the sender's device.
2. **Key stays in the URL** — the decryption key fragment is appended after `#` in the share link. Browsers do not send URL fragments to servers, so Cinderpass cannot decrypt the secret.
3. **One read, then gone** — the first successful retrieval atomically marks the secret as opened and destroyed. Concurrent requests race against a single database write; only one wins.
4. **Passphrase layer** — an optional passphrase adds a second encryption layer. Wrong attempts are counted per-secret and locked after 5 failures without consuming the secret.

---

## Features

- One-time secret links with configurable TTL (1h / 24h / 7d)
- Request flow — ask someone to submit a secret through a dedicated page
- Optional passphrase protection with server-side brute-force lockout
- Manual destroy — burn a secret you created before anyone opens it
- Rate limiting on all creation and retrieval endpoints
- Hourly cron job to mark expired records
- Build provenance — footer badge links to the exact deployed commit
- Collapsible security model explainer on the reveal page

---

## Security model

| Layer | Detail |
|---|---|
| Encryption | AES-256-GCM, performed in the browser via Web Crypto API |
| Key storage | URL fragment only — never sent to the server |
| Passphrase | PBKDF2-SHA256, 120k iterations; verifier stored server-side, wrong attempts locked after 5 |
| Burn mechanism | Atomic `UPDATE WHERE status='ACTIVE'` — concurrent reveals cannot both succeed |
| Transport | HTTPS enforced via HSTS header |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Input validation | Ciphertext and IV validated for base64 format, IV length (12 bytes), and max size (64 KB) |
| Rate limiting | Per-IP sliding window on create, request, and retrieve routes |

The server stores ciphertext, IV, metadata, expiry, and a derived passphrase verifier. It cannot reconstruct the plaintext without the key fragment, which it never receives.

---

## Local setup

```bash
cp .env.example .env
# Fill in DATABASE_URL in .env
npm install
npx prisma migrate deploy
npm run dev
```

`npm run dev` now checks Prisma migration status before booting Next.js. If you pull schema changes or switch to a different database, run `npm run db:migrate` first.

Required environment variables:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `APP_URL` | Preferred canonical public base URL for links and metadata in deployed environments |
| `NEXT_PUBLIC_APP_URL` | Optional public base URL fallback; kept for client-visible configuration compatibility |
| `CRON_SECRET` | Bearer token protecting `/api/cron/prune` (required in production) |
| `MAILGUN_API_KEY` | Mailgun API key for the contact form |
| `MAILGUN_DOMAIN` | Mailgun sending domain, e.g. `mg.cinderpass.com` |
| `MAILGUN_FROM_EMAIL` | Verified sender address used by Mailgun, e.g. `Cinderpass <contact@mg.cinderpass.com>` |
| `MAILGUN_API_BASE_URL` | Optional Mailgun API base URL; use `https://api.eu.mailgun.net` for EU regions |

Generate `CRON_SECRET` with:

```bash
openssl rand -hex 32
```

---

## Deploy to Vercel

1. Push the repo to GitHub and import it into Vercel.
2. Add a Postgres database via Vercel Marketplace or connect your own.
3. Set `APP_URL` to your production domain and `CRON_SECRET` to a random secret.
4. Deploy. Vercel picks up `vercel.json` and schedules the hourly prune job automatically.

---

## API

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/secrets` | Create a secret, returns share URL and destroy token |
| `POST` | `/api/secrets/:id/destroy` | Destroy a secret using its destroy token |
| `GET` | `/api/retrieve/:id` | Fetch metadata (passphrase required, label) without burning |
| `POST` | `/api/retrieve/:id` | Burn and retrieve ciphertext |
| `POST` | `/api/requests` | Create a secret request page |
| `POST` | `/api/requests/:token/submit` | Submit a secret in response to a request |
| `GET` | `/api/cron/prune` | Mark expired records (called by Vercel Cron) |
| `GET` | `/api/version` | Returns deployed commit SHA and build time |

---

## Stack

- [Next.js](https://nextjs.org) 16 — App Router, React Server Components
- [Prisma](https://prisma.io) — ORM with PostgreSQL
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — browser-native AES-256-GCM encryption
- Vercel — hosting and cron

---

## Roadmap

- Audit log (per-secret access history)
- Team workspaces and access control
- Email / webhook notification on open or expiry
- SSO (SAML / OIDC)
- Slack and Teams sharing shortcuts
- Self-hosted admin dashboard
- Independent security review

---

## License

MIT
