# Security policy

## Supported version

Security fixes are maintained on the current `main` branch and latest tagged release.

## Trust model

ZipToGit Pro uses GitHub OAuth and an encrypted, `HttpOnly`, `SameSite=Lax` Auth.js JWT cookie. The GitHub access token is kept in the server-only JWT payload. Client Components call only same-origin allowlisted API routes; they never call `api.github.com` or receive the token.

The OAuth scopes are broad because repository creation, private repository reads, Pages, and Actions mutations require them:

```text
read:user user:email repo workflow
```

Deploy the application only on a host you trust with those credentials. Use HTTPS in production.

## ZIP boundary

An uploaded archive is untrusted input. The Node route streams it into a directory created by `mkdtemp`, enforces the compressed-size limit while receiving it, and removes the directory in `finally`.

Before repository creation, lazy ZIP preflight rejects:

- traversal, absolute paths, drive paths, NUL, excessive path depth or length
- encrypted entries, symlinks, and special files
- duplicate and case-insensitive path collisions
- `.git/**` and likely credential files
- excessive file count, individual size, or total uncompressed size

Files are read as bytes and sent as base64 Git blobs. Line endings and binary data are not transformed. A failure after repository creation never triggers repository deletion or a forced ref update.

## README boundary

GitHub-rendered Markdown is sanitized with an explicit tag and attribute allowlist. Script, iframe, form, inline style, and event-handler content is removed. Relative links and images are rewritten to the selected repository/ref. Image hosts are allowlisted. The local `react-markdown` fallback does not enable raw HTML.

## Browser policy

Per-request CSP nonces protect application scripts. Production uses `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and exact image origins. Responses also set nosniff, DENY framing, a restrictive Permissions Policy, strict referrer behavior, and production HTTPS HSTS.

## Logging and errors

Logs contain request identifiers and endpoint templates, never authorization headers, cookies, archive bytes, file contents, workflow input values, or OAuth codes. API errors return a safe message and request ID without stack traces or temporary paths.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub's private vulnerability reporting for this repository. Include the affected commit, reproduction steps, impact, and a redacted proof of concept. Never include a live token, cookie, OAuth code, private key, or archive containing real credentials.
