Security

ZipToGit Pro communicates with the GitHub API using your personal access token.

Treat your GitHub token like a password.

How the token is stored

Default mode

The token is stored only in browser memory for the current tab.

When you close the tab, the token is gone.

Remember mode

The optional Remember feature stores the token encrypted in localStorage.

The encryption uses:

AES-GCM for encryption.

PBKDF2 for key derivation.

120,000 PBKDF2 iterations.

A password entered by the user.

The password itself is never stored.

Additional protections

Automatic idle logout after 30 minutes.

Token masking in the UI.

Short five-second token reveal window.

Token values are redacted from UI messages, commits, and gists.

The application warns when it is running somewhere other than localhost.

Next.js proxy

In Next.js mode, ZipToGit Pro can use the local /api/github/* proxy.

The proxy forwards the Authorization header provided by the browser to the GitHub API.

The proxy does not store a server-side GitHub token.

The intended model is:

Browser
   │
   │ Authorization: Bearer <your token>
   ▼
Local Next.js proxy
   │
   │ Authorization: Bearer <your token>
   ▼
GitHub API

The proxy is intended to run locally or as part of your own self-hosted environment.

What not to do

Do not use delete_repo

Do not add the delete_repo permission to your token unless you fully understand and accept the risk of accidental repository deletion.

Repository deletion is available in the UI, but the token should normally not have permission to perform it.

Do not use Remember on shared computers

Do not enable Remember on a computer that other people can access.

Do not host a public instance

Do not deploy a public ZipToGit Pro instance and ask other users to paste their GitHub tokens into it.

This project is designed for local/self-hosted use with your own token.

Do not commit secrets

Never commit:

.env files

Private keys

PEM files

GitHub tokens

API keys

Passwords

Other credentials

The built-in scanner and Gitleaks CI are a backstop, not a guarantee.

Always review files before committing them.

Secret scanning

ZipToGit Pro includes a secret scanner intended to detect potentially sensitive values before they are committed.

The scanner should be treated as an additional safety layer, not as proof that a repository contains no secrets.

If a secret is detected:

Stop the upload/commit.

Remove the secret from the files.

Rotate/revoke the exposed credential if it has already been used or committed.

Review Git history if the secret was previously committed.

Reporting a vulnerability

Please report security issues responsibly.

Non-exploitable issues

If the issue is not capable of stealing, exposing, or misusing live user tokens, you may open a GitHub issue using the security label.

Token theft or misuse

If the vulnerability could steal or misuse a user's GitHub token, do not disclose it publicly.

Instead, contact the maintainer privately using the email address listed on the maintainer's GitHub profile.

Please include:

What the application does that it should not do.

Steps required to reproduce the issue locally.

Whether the issue affects:

Next.js mode

Monolith mode

Both modes

Any relevant logs or screenshots that do not contain secrets.

Never include an actual GitHub token, password, API key, or other credential in a vulnerability report.

Security philosophy

ZipToGit Pro intentionally keeps authentication simple:

The user supplies their own GitHub token.

The browser holds the token by default.

The local proxy does not maintain a separate server-side token.

Optional persistent storage is encrypted.

Secret scanning happens before uploads.

The project does not include telemetry.

This reduces the amount of infrastructure that needs to be trusted, but it does not eliminate the risks associated with using a personal GitHub token.

Always use the minimum token permissions necessary for the operations you need.
