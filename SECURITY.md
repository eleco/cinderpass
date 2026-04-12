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

Cinderpass is designed so that even a full server compromise cannot expose plaintext secrets:

- All secrets are encrypted with AES-256-GCM **in the browser** before reaching the server
- The decryption key lives only in the URL fragment (`#k=...`), which browsers never transmit to servers
- The server stores ciphertext and metadata only — never plaintext, never the decryption key
- Secrets are permanently destroyed after first retrieval (atomic single-write burn)
- Optional PBKDF2-SHA256 passphrase adds a second encryption layer

The full source code is public and the deployed build commit is linked in the application footer.
