# Security

ZipToGit Pro talks to the GitHub API with **your personal access token**.

> **Treat that token like a password.**

---

## How the token is stored

### Default

- The token is kept **in memory for the current browser tab**.
- Close the tab and the token is gone.

### Remember

The optional **Remember** feature encrypts the token before storing it in `localStorage`.

It uses:

- **AES-GCM** for encryption
- **PBKDF2** for key derivation
- **120,000 iterations**
- A password you enter locally

The password itself is **not saved**.

### Session protections

- Idle logout after **30 minutes**
- Masked token display
- Five-second token reveal
- Token values redacted in UI messages, commits, and gists

---

## Next.js proxy

In Next.js mode, the application can use the local:

```text
/api/github/*
```

proxy.

The proxy forwards the browser's `Authorization` header to the GitHub API.

It **does not keep a server-side token**.

```text
Browser
   │
   │ Authorization: Bearer <your token>
   ▼
Local Next.js proxy
   │
   │ Authorization: Bearer <your token>
   ▼
GitHub API
```

The proxy is intended for local or self-hosted use.

---

## What not to do

### Do not add `delete_repo`

Do not put `delete_repo` on the token unless you fully accept the risk of accidental repository deletion.

The UI supports repository deletion, but this permission should normally remain disabled.

### Do not enable Remember on a shared computer

The Remember feature should not be used on a computer other people can access.

### Do not host a public instance

Do not host a public ZipToGit Pro instance and ask users to paste their GitHub tokens into it.

This project is intended for **local / self-hosted use with your own token**.

### Do not commit secrets

Never commit:

- `.env` files
- PEM files
- Private keys
- GitHub tokens
- API keys
- Passwords
- Other credentials

The built-in scanner and Gitleaks CI are a **backstop, not a guarantee**.

---

## Secret scanning

ZipToGit Pro includes a secret scanner intended to detect sensitive values before they are committed.

The scanner is an additional safety layer, not proof that a repository contains no secrets.

If a secret is detected:

1. **Stop** the upload or commit.
2. Remove the secret from the files.
3. Rotate or revoke the credential if it has already been exposed.
4. Review Git history if the secret was previously committed.

---

## Reporting a vulnerability

Please report security issues responsibly.

### Non-exploitable issues

Open a GitHub issue with the `security` label if the report is not exploitable against live user tokens.

### Token theft or misuse

If the bug can steal or misuse a token, **do not file a public issue**.

Email the maintainer through the address on the GitHub profile instead.

Please include:

- What the app does that it should not.
- Steps to reproduce locally.
- Whether **Next.js mode**, **monolith mode**, or **both** are affected.
- Relevant logs or screenshots that do not contain secrets.

> **Never include an actual GitHub token, password, API key, or other credential in a vulnerability report.**

---

## Security philosophy

ZipToGit Pro intentionally keeps authentication simple:

- The user supplies their own GitHub token.
- The browser holds the token by default.
- The local proxy does not maintain a separate server-side token.
- Optional persistent storage is encrypted.
- Secret scanning happens before uploads.
- The project has no telemetry.

This reduces the amount of infrastructure that needs to be trusted, but it does **not** eliminate the risks associated with using a personal GitHub token.

Always use the **minimum token permissions necessary** for the operations you need.
