# Security policy

## Supported version

Security fixes are maintained on the current `main` branch and the latest tagged release.

## Trust model

RepoDeck uses GitHub OAuth and an encrypted, `HttpOnly`, `SameSite=Lax` Auth.js JWT cookie. The GitHub access token is kept in the server-only JWT payload; it is never returned by `/api/auth/session`, embedded in React props, written to client storage, or logged. Client Components call only same-origin allowlisted API routes; they never call `api.github.com` or receive the token.

OAuth scopes are deliberately limited to what the feature set requires:

```text
read:user user:email repo workflow notifications
```

`delete_repo` is not requested. The authentication boundary, the pinned Auth.js version, and the migration plan are documented in [docs/adr/0001-authentication.md](docs/adr/0001-authentication.md). Deploy the application only on a host you trust with those credentials, and use HTTPS in production.

## Import boundary

An uploaded archive is untrusted input. The Node route streams it into a `mkdtemp` directory, enforces the compressed-size limit while receiving it, and removes the directory in `finally`.

Before any GitHub mutation, preflight and the content scanner reject:

- traversal, absolute paths, drive paths, NUL bytes, excessive path depth or length;
- encrypted entries, symlinks, and special files;
- duplicate and case-insensitive path collisions;
- `.git/**`;
- excessive file count, individual size, or total uncompressed size;
- credentials found in file contents (cloud keys, tokens, private keys, connection strings) at critical/high severity;
- credential files that cannot be scanned within the configured scan budget.

Files are read as bytes and sent as base64 Git blobs. Scanning is bounded by file and byte budgets, skips binaries, and returns masked findings only. Raw matches never leave the server: the public finding type removes the raw `match` field, and the audit API projects findings through a masking helper.

Import is transactional. See [docs/adr/0002-import-transaction.md](docs/adr/0002-import-transaction.md):

- the branch ref is published only after every required Git object exists;
- only side effects created by the current operation are compensated;
- a failed operation returns `failed`, `compensated`, or `cleanup_incomplete` honestly, with remediation;
- repository deletion is opt-in (`REPODECK_ALLOW_REPOSITORY_CLEANUP=true`) and never required.

## Authorization

Every mutation is authorized on the server through the capability model before GitHub is contacted. Capabilities are derived from the authenticated viewer's repository permissions; unknown or missing permission data denies dangerous mutations, and archived repositories are read-only. UI states are hints, not enforcement. The full matrix is in [docs/PERMISSIONS.md](docs/PERMISSIONS.md) and the decision is recorded in [docs/adr/0003-permission-model.md](docs/adr/0003-permission-model.md).

## README boundary

GitHub-rendered Markdown is sanitized with an explicit tag and attribute allowlist. Script, iframe, form, inline style, and event-handler content is removed. Relative links and images are rewritten to the selected repository/ref, and image hosts are allowlisted. The local `react-markdown` fallback does not enable raw HTML.

## Browser policy

Per-request CSP nonces protect application scripts. Production uses `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, and exact image origins. Responses also set nosniff, DENY framing, a restrictive Permissions Policy, strict referrer behavior, and production HTTPS HSTS.

## Logging, telemetry, and errors

Logs contain request identifiers, operation identifiers, and endpoint templates. Credential-shaped keys are dropped, nested payloads are discarded, and strings are truncated. Optional OpenTelemetry export follows the same rules: attributes with sensitive names are removed and secret metrics contain counts and severities only. API errors return a safe message and request ID without stack traces, upstream bodies, or temporary paths.

## Reporting a vulnerability

Do not open a public issue for an exploitable vulnerability. Use GitHub's private vulnerability reporting for this repository. Include the affected commit, reproduction steps, impact, and a redacted proof of concept. Never include a live token, cookie, OAuth code, private key, or an archive containing real credentials.
