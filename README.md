# Burnlink

Open-source one-time secret sharing for serious teams.

This MVP is built with Next.js App Router, Prisma, and Postgres. Secrets are encrypted in the browser with AES-GCM before upload. The server stores ciphertext only. The decryption key fragment stays in the URL fragment (`#k=...`), which is not sent to the server during normal HTTP requests.

## What this MVP does

- Create one-time secret links
- Burn secrets after first successful retrieval
- Optional passphrase on top of the URL key fragment
- Create request-secret pages for inbound secret collection
- Store ciphertext only on the server
- Deploy cleanly to Vercel with Postgres

## Important caveats

This is a good MVP, not a finished security product.

Still missing:
- rate limiting / abuse controls
- bot protection / CAPTCHA
- email notifications
- workspaces / auth / SSO
- hardened audit logging
- independent security review
- automated cleanup job for expired rows
- a stronger approach to race conditions for simultaneous retrieval attempts

## Local setup

```bash
cp .env.example .env
npm install
npx prisma migrate deploy
npm run dev
```

Set:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import the repo into Vercel.
3. Add a Postgres database through Vercel Marketplace or bring your own Postgres database.
4. Set `NEXT_PUBLIC_APP_URL` to your production domain.
5. Deploy.

Next.js supports App Router and is designed to deploy directly on Vercel.

## Suggested next features

- Slack / Teams sharing shortcut
- email or webhook on open / expiry
- org policies and branding
- workspace auth
- self-host admin dashboard
- expiration sweeper via Vercel Cron

## Security model in plain English

- Plaintext is encrypted in the browser.
- The server stores ciphertext, IV, metadata, and expiry.
- The decryption key fragment is appended after `#` in the URL and is therefore not part of the normal request path.
- Opening the secret triggers a single-use retrieval API that marks the row as opened/destroyed.
- If a passphrase is used, the client derives a second protection layer before decryption.

That is materially better than pasting secrets into chat, but you should not market it as enterprise-grade until it has gone through proper hardening and external review.
