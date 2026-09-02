# Security Policy

## Supported Versions

Currently, only the latest release on the `master` branch is supported with security updates.

## Reporting a Vulnerability

If you discover a security vulnerability within this project, please DO NOT open a public issue. Instead, send an email directly to the maintainers (add your security email here). We take security issues seriously and will respond promptly.

## Encryption Architecture

This application handles sensitive API keys (e.g., Resend keys) and Webhook secrets. 

**Keys are never stored in plaintext in the database.**

- When a user saves an API key or webhook secret, it is immediately encrypted using `AES-256-GCM`.
- The encryption utilizes a secure 32-byte master key stored in the `ENCRYPTION_KEY` environment variable. 
- The encrypted payload (Ciphertext + IV + Auth Tag) is stored in the database.
- Keys are only decrypted server-side at the exact moment they are needed to make an API call or verify a webhook signature.
- The decrypted key is never returned to the client in API responses (only the last 4 characters are exposed for UI identification).

## Key Rotation

If your `ENCRYPTION_KEY` is compromised, all stored API keys will become invalid if you change it.
Users will need to re-enter their API keys and webhook secrets from the Settings page. 
To rotate a Resend API key safely without downtime:
1. Generate a new API key in the Resend Dashboard.
2. In the Mailing Client Settings, delete the old provider key and add the new one.
3. Delete the old key from the Resend Dashboard.
