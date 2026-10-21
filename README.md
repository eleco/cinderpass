# Cinderpass

**Burn-after-read secret sharing for engineering and ops teams.**

Cinderpass gives teams a clean way to pass API keys, recovery codes, and one-off credentials without leaving plaintext in Slack threads, email chains, or ticket comments. Secrets are encrypted in the browser before they reach the server. The server never sees the plaintext or the raw decryption key.

---

## How it works

1. **Encrypt in the browser** — the secret is encrypted with AES-256-GCM before it leaves the sender's device.
2. **Key stays in the URL** — the decryption key fragment is appended after `#` in the share link. Browsers do not send URL fragments to servers, so Cinderpass cannot decrypt the secret.
3. **One read, then gone** — the first successful retrieval atomically clears the encrypted payload and sensitive metadata from the live database before returning the ciphertext to one recipient. Concurrent requests are serialized; only one wins.
4. **Passphrase layer** — new protected links wrap the random AES key with AES-256-GCM using a separately salted PBKDF2-SHA256 key (600,000 iterations). The browser authenticates the wrapped key before retrieval. The server independently locks a secret after five failed verification attempts, without consuming it.

---

## Features

- One-time secret links with configurable TTL (1h / 24h / 7d)
- Request flow — ask someone to submit a secret through a dedicated page
- Optional passphrase protection with server-side brute-force lockout
- Manual destroy — burn a secret you created before anyone opens it
- Per-instance rate limiting on direct creation, request creation, and retrieval metadata endpoints
- Hourly cron job to erase expired payloads and close expired requests
- Build provenance — footer badge links to the exact deployed commit
- Collapsible security model explainer on the reveal page

---

## Security model

| Layer | Detail |
|---|---|
| Encryption | AES-256-GCM, performed in the browser via Web Crypto API |
| Key storage | URL fragment only — never sent to the server |
| Passphrase | Versioned PBKDF2-SHA256, 600k iterations for new key wrapping and independent verifier proofs; five failed server checks lock the secret |
| Burn mechanism | PostgreSQL row lock plus atomic payload erasure — verification, attempts, and burn are serialized |
| Transport | HTTPS enforced via HSTS header |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Input validation | Ciphertext and IV validated for base64 format, IV length (12 bytes), and max size (64 KB) |
| Rate limiting | Per-instance/IP sliding window on direct create, request create, and metadata GET; not a global abuse limit |

The server stores ciphertext, IV, metadata, expiry, and a derived passphrase verifier. It cannot reconstruct the plaintext without the key fragment, which it never receives.

---


## Payload lifecycle and security upgrade

Retrieval and manual destruction clear ciphertext, IV, label/note, passphrase salt/verifier,
and destroy token in the same database transaction as the terminal status. Linked request
labels and notes are cleared too. IDs, relationships, status, attempt count, protection flag,
and timestamps remain as tombstones. Retrieval burns before the network response and browser
decryption: a lost response or damaged legacy key can make the secret unrecoverable.

Expiry blocks retrieval immediately. The hourly cron clears expired payloads; a retrieval
attempt on an expired secret also clears it. Operators must configure and monitor the cron.
Deletion here means removal from live database rows: database backups, WAL/PITR history,
provider logs, and copies held by recipients have separate retention policies. After
restoring a backup, run `npm run db:scrub` (it re-applies the 0005 erasure SQL, which is
idempotent) before exposing the restored database.

Migration `0005_erase_closed_payloads` scrubs historical closed and expired rows without
changing still-active links. Deploy it with this release (`npm run db:migrate`); the normal
build script also runs migrations. The migration does not erase provider backups.

New protected links store a random 16-byte salt on the server as `v2.<base64-salt>`. The
browser derives a master secret with PBKDF2-SHA256 (600,000 iterations) and expands it with
HKDF-SHA256 (empty salt) into two independent 32-byte values:

- `cinderpass:verifier:v2` → the verifier sent to the server and compared in constant time;
- `cinderpass:key-mask:v2` → a mask that never leaves the browser.

The fragment is `v2.<base64(key XOR mask)>`. It carries no authentication tag, so every
passphrase guess yields a plausible key. A guess can only be tested against the ciphertext,
which the server releases after a correct verifier, so the link alone gives no offline
oracle. Never send the mask or reuse the verifier as key material.

Unversioned fragments and verifier salts are read for compatibility: old protected links
retain SHA-256/XOR wrapping and 120,000-iteration verification until consumed or expired.
They cannot be upgraded without their key and passphrase; recreate sensitive existing links
for the new protection. Old open browser tabs should be refreshed after deployment.

Malformed fragments are rejected locally before the burn request. Passphrase correctness is
checked only by the server: five incorrect proofs lock the secret, even across concurrent
requests and different application instances, and a wrong passphrase never burns it.
Offline guessing requires both the link and a copy of the database (salt and verifier or
ciphertext); use a strong passphrase against that case.
Browser encryption protects stored data, not against a compromised server serving malicious
JavaScript or a compromised recipient device.

To run the real PostgreSQL lifecycle/concurrency tests, use a disposable local database:

```bash
DATABASE_URL=postgresql://review@127.0.0.1:55439/cinderpass_test npx prisma migrate deploy
TEST_DATABASE_URL=postgresql://review@127.0.0.1:55439/cinderpass_test npm test -- __tests__/integration
```

The Prisma 6 dependency uses a scoped `deepmerge-ts` 8 override to address its recursive
merge vulnerability without a Prisma major-version migration. Remove the override when
Prisma ships a compatible patched dependency.

The integration suite requires a localhost database whose name ends in `_test` and deletes
its test records. It is skipped when `TEST_DATABASE_URL` is unset.

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
| `GET` | `/api/cron/prune` | Erase expired payloads and close expired requests (called by Vercel Cron) |
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


## Optional informational-page analytics

Analytics is off by default. Configure `ANALYTICS_SCRIPT_URL`, `ANALYTICS_SITE_ID`, and
`ANALYTICS_SITE_ORIGIN` in your hosting provider's **production** environment, then rebuild
and deploy. The origin must exactly match the canonical HTTPS origin with no trailing slash.
Keep actual values in deployment settings or an ignored local environment file; commit only
empty examples. Forks and self-hosted installations remain untracked unless their operators opt in.

The local, auditable component sends pageviews directly to `/api/site-events` on the configured
script URL's origin. It does **not** load or execute that remote script. Collection is limited to
`/architecture`, `/faq`, `/one-time-link`, `/one-time-secret-alternatives`,
`/secure-password-sharing`, and `/send-secret-message`. The homepage (which contains the creation
forms), `/secret/*`, `/request/*`, API routes, and all unknown routes are excluded. This means the
dashboard measures informational-page traffic, not total product usage or conversions.

Only the configured site ID, random event UUID, allowlisted pathname, and external referring
hostname are sent, plus optional bounded `utm_source`, `utm_medium`, and `utm_campaign`
labels. `utm_id`, `utm_term`, `utm_content`, other query parameters, fragments, form
values, internal referrers, cookies, and browser storage are excluded. Do not put personal data in
campaign labels. Device/browser/OS categories may be inferred from request headers without storing
raw User-Agent strings. Global Privacy Control disables collection. The recipient still receives
normal network metadata such as the visitor's IP and User-Agent. Production CSP permits the
collector connection only on informational pages; sensitive pages retain `connect-src 'self'`.

Configuration is absent from committed source, but the rendered configuration and collection
requests are visible to visitors. The site ID is a public collection identifier, not dashboard
access credentials. Update your deployment's privacy information to describe enabled analytics.
