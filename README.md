# Cinderpass

**Burn-after-read secret sharing for engineering and ops teams.**

Cinderpass gives teams a clean way to pass API keys, recovery codes, and one-off credentials without leaving plaintext in Slack threads, email chains, or ticket comments. Secrets are encrypted in the browser before they reach the server. The server never sees the plaintext or the raw decryption key.

---

## How it works

1. **Encrypt in the browser** — the secret is encrypted with AES-256-GCM before it leaves the sender's device.
2. **Key stays in the URL** — the decryption key fragment is appended after `#` in the share link. Browsers do not send URL fragments to servers, so Cinderpass cannot decrypt the secret.
3. **One read, then gone** — the first successful retrieval atomically deletes the encrypted payload and sensitive metadata from storage before returning the ciphertext to one recipient. Concurrent requests are serialized; only one wins.
4. **Passphrase layer** — new protected links wrap the random AES key with AES-256-GCM using a separately salted PBKDF2-SHA256 key (600,000 iterations). The browser authenticates the wrapped key before retrieval. The server independently locks a secret after five failed verification attempts, without consuming it.

---

## Features

- One-time secret links with configurable TTL (1h / 24h / 7d)
- Request flow — ask someone to submit a secret through a dedicated page
- Optional passphrase protection with server-side brute-force lockout
- Manual destroy — burn a secret you created before anyone opens it
- Per-instance rate limiting on direct creation, request creation, and retrieval metadata endpoints
- Expired payloads and requests are deleted automatically by Redis key expiry; no cron job
- Build provenance — footer badge links to the exact deployed commit
- Collapsible security model explainer on the reveal page

---

## Security model

| Layer | Detail |
|---|---|
| Encryption | AES-256-GCM, performed in the browser via Web Crypto API |
| Key storage | URL fragment only — never sent to the server |
| Passphrase | Versioned PBKDF2-SHA256, 600k iterations for new key wrapping and independent verifier proofs; five failed server checks lock the secret |
| Burn mechanism | One atomic Redis script per retrieval — verification, attempts, and deletion are serialized |
| Transport | HTTPS enforced via HSTS header |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy |
| Input validation | Ciphertext and IV validated for base64 format, IV length (12 bytes), and max size (64 KB) |
| Rate limiting | Per-instance/IP sliding window on direct create, request create, and metadata GET; not a global abuse limit |

The server stores ciphertext, IV, metadata, expiry, and a derived passphrase verifier. It cannot reconstruct the plaintext without the key fragment, which it never receives.

---


## Payload lifecycle and security upgrade

Cinderpass stores data in Redis (Upstash). A secret is one hash key whose expiry is set to the
link's TTL, so Redis deletes expired payloads itself. Retrieval and manual destruction delete the
key in the same atomic script that verifies the request, and the linked request (label and note)
is deleted right after. What remains is a small marker saying why the link closed (`opened`,
`destroyed` or `expired`), used to show the right message; it holds no payload and expires
24 hours after the link closes. Destroy tokens and passphrase verifiers are stored only as
SHA-256 hashes. Retrieval burns before the network response and browser decryption: a lost
response or damaged legacy key can make the secret unrecoverable.

Deletion here means removal from the live store: provider backups or snapshots, provider logs,
and copies held by recipients have separate retention policies.

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
Offline guessing requires both the link and a copy of the stored data (salt and ciphertext); use a strong passphrase against that case.
Browser encryption protects stored data, not against a compromised server serving malicious
JavaScript or a compromised recipient device.

The integration suite runs the storage scripts against a real Redis behind Upstash's REST
protocol. It flushes that database, requires a localhost URL, and is skipped when
`TEST_REDIS_URL` is unset:

```bash
docker network create cp-test
docker run -d --rm --name cp-redis --network cp-test redis:7-alpine
docker run -d --rm --name cp-srh --network cp-test -p 8079:80 -e SRH_MODE=env \
  -e SRH_TOKEN=test-token -e SRH_CONNECTION_STRING=redis://cp-redis:6379 hiett/serverless-redis-http
TEST_REDIS_URL=http://localhost:8079 npm test
```

## Local setup

```bash
cp .env.example .env
# Fill in KV_REST_API_URL and KV_REST_API_TOKEN in .env
npm install
npm run dev
```

For local development without an Upstash account, run the two containers from the test section
and use `KV_REST_API_URL=http://localhost:8079` with `KV_REST_API_TOKEN=test-token`.

Environment variables:

| Variable | Description |
|---|---|
| `KV_REST_API_URL` | Upstash Redis REST URL (`UPSTASH_REDIS_REST_URL` also works) |
| `KV_REST_API_TOKEN` | Upstash Redis REST token (`UPSTASH_REDIS_REST_TOKEN` also works) |
| `APP_URL` | Preferred canonical public base URL for links and metadata in deployed environments |
| `NEXT_PUBLIC_APP_URL` | Optional public base URL fallback; kept for client-visible configuration compatibility |

---

## Deploy

Production runs on DigitalOcean App Platform (London) from the spec in `.do/app.json`,
and redeploys on every push to `main`. Redis is a standalone Upstash database.

1. Put `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` and the Mailgun settings in a
   Git-ignored `.env.digitalocean.local`.
2. Run `node scripts/render-do-spec.mjs` to write `.do/app.secrets.local.json` (Git-ignored,
   mode 600), then `doctl apps update <app-id> --spec .do/app.secrets.local.json`
   (or `doctl apps create` for a new app).
3. There are no migrations or scheduled jobs.

The rate limiter reads the client IP from DigitalOcean's `do-connecting-ip` header. Behind
another proxy, make sure the first `X-Forwarded-For` entry cannot be set by clients.

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
| `GET` | `/api/version` | Returns deployed commit SHA and build time |

---

## Stack

- [Next.js](https://nextjs.org) 16 — App Router, React Server Components
- [Upstash Redis](https://upstash.com) — serverless Redis over HTTP; key expiry and Lua scripts
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — browser-native AES-256-GCM encryption
- DigitalOcean App Platform — hosting

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
