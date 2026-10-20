# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Cinderpass, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

Instead, open a [private security advisory](https://github.com/eleco/cinderpass/security/advisories/new) on GitHub, or email the maintainer directly via the contact on the GitHub profile.

Include as much detail as possible:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix if you have one

You will receive a response within 72 hours. If the report is confirmed, a fix will be prioritised and you will be credited in the changelog unless you prefer to remain anonymous.

## Scope

The following are in scope:

- `cinderpass.com` and all subdomains
- The Cinderpass web application (this repository)
- The API endpoints under `/api/`

The following are out of scope:

- Denial of service attacks
- Social engineering
- Physical security

## Security Model

Cinderpass encrypts secrets before upload, keeping plaintext and decryption keys out of
normal server storage. This does not protect a browser from a compromised server serving
malicious JavaScript, browser extensions, or a compromised device.

- Payload encryption uses browser-generated random AES-256-GCM keys and 96-bit IVs.
- New protected links mask that key with an HKDF expansion of PBKDF2-SHA256 (600,000
  iterations, server-stored salt). The masked key has no authentication tag, so a link
  holder cannot test passphrase guesses offline.
- A verifier derived independently from the same PBKDF2 output authorizes server retrieval.
  PostgreSQL row locks serialize verification, the five-failure lockout, and the burn
  transaction. Offline guessing requires both the link and a copy of the database, so strong
  passphrases are still recommended.
- Retrieval and destruction clear encrypted payloads and sensitive metadata from live rows.
  Expiry is enforced immediately; expired payloads are cleared on attempted retrieval or by
  the hourly cron. Tombstone IDs, status, relationships, flags, counters, and timestamps remain.
- Backup/PITR/WAL and infrastructure-log retention are controlled by the hosting provider.
  Removing a live row value does not promise forensic erasure of historical storage.
- Retrieval commits the burn before browser decryption or successful network delivery.
  Lost responses and damaged legacy key fragments may be unrecoverable.
- Existing unversioned links retain their legacy SHA-256/XOR wrapping and 120,000-iteration
  PBKDF2 verifier. They remain readable until expired or consumed; recreate them to upgrade.
- Migration `0005_erase_closed_payloads` scrubs historical closed and expired rows. Operators
  must also apply equivalent scrubbing after restoring older database backups.

The full source is public. The build commit is informational provenance, not cryptographic
attestation that the server is serving that source. See the README for protocol and deployment details.
