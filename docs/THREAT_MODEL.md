# Threat model

Scope: the self-hosted RepoDeck server and its browser client. Deployment assumptions: HTTPS in production, a reverse proxy you control, and an operator who owns the GitHub account used for OAuth.

## Assets

| Asset | Why it matters |
| --- | --- |
| GitHub access token | Full read/write access to the scopes granted (`repo`, `workflow`, `notifications`) |
| Private repository content | Confidential source code and metadata |
| Imported archives | May contain proprietary code or live credentials |
| Secret-scan findings | Aggregating them reveals where credentials live |
| Mutation capability | File writes, merges, releases, Pages, and workflow dispatch |

## Trust boundaries

| Boundary | Notes |
| --- | --- |
| Browser → RepoDeck | Untrusted input; session cookie is the only credential |
| RepoDeck → GitHub | Token-bearing egress through one transport |
| ZIP parser (yauzl) | Parses attacker-controlled binary input |
| Markdown renderer | Untrusted repository text |
| Reverse proxy | Terminates TLS, forwards client headers |
| Telemetry exporter | Optional third-party egress when OTLP is configured |

## Threats and mitigations

| Threat | Mitigation | Residual risk |
| --- | --- | --- |
| Token exfiltration via XSS | Nonce CSP with `strict-dynamic`, sanitized Markdown, no `dangerouslySetInnerHTML` from repository content, token never in session payload or props (`src/server/auth/auth-config.test.ts`) | A browser or extension compromise remains out of scope. |
| Token leakage through logs or telemetry | Central redaction drops credential-shaped keys and nested payloads (`src/lib/logger.ts`); telemetry attributes use the same rules (`src/server/observability/telemetry.ts`); raw secret matches never leave the server (`toPublicFinding`) | A future contributor can add a new unsafe field name; reviewed by tests and PR checklist. |
| CSRF against mutations | Session cookie is `SameSite=Lax`; mutating BFF routes require same-origin JSON requests and `Content-Type`; Auth.js protects the OAuth flow with state | No per-request CSRF token exists for JSON BFF calls; `SameSite=Lax` blocks cross-site form posts. |
| Markdown XSS / stored XSS | HTML sanitizer with explicit allowlists, URL rewriting, host allowlist, no raw HTML in the fallback renderer | A sanitizer bypass would require an upstream CVE. |
| Open redirect after OAuth | Redirect callback restricts results to the application origin (`src/server/auth/auth-config.test.ts`) | None known. |
| SSRF via GitHub base URL | `GITHUB_API_BASE_URL` is operator-controlled environment, never user input; the client rejects absolute paths | An operator could point the server at a malicious host; that is a deployment decision. |
| ZIP path traversal / absolute paths / symlinks | Rejected in preflight before any mutation (`src/server/import/path-policy.ts`, tests) | None known. |
| Zip bombs / resource exhaustion | Compressed, per-file, and total uncompressed limits; file-count limit; bounded scan budgets; bounded blob concurrency and cancellation | 5,000 files / 250 MiB still consume worker memory; operators can lower limits. |
| Malicious filenames (control chars, collisions, case tricks) | Path normalization, NUL rejection, collision detection, sanitized display paths | Unicode homoglyph names remain visually confusing but harmless. |
| Credentials committed through import | Content-level secret scan before repository creation; critical/high findings block the import; unscannable credential files block; findings are masked (`src/server/import/secret-preflight.ts`) | A secret format not covered by the rules or hidden in a binary/skipped file can pass; scan truncation is surfaced, never reported as clean. |
| Privilege confusion (read-only user performs a write) | Server-side capability model derived from GitHub permissions; unknown permission data denies mutations (`src/server/authz/capabilities.ts`, fault-injection tests) | GitHub is the final authority; a permission change between check and mutation maps to a safe 403. |
| Stale permission state mid-session | Every request re-resolves the repository and recomputes capabilities; permission revocation is covered by a fault-injection test | Cached GitHub responses inside the client are limited to the current request. |
| Mass API fan-out / upstream abuse | Bounded concurrency (`p-limit`), per-operation budgets, pagination caps, request cancellation on failure; no user-controlled fan-out | Audit of a very large repository still spends up to the documented budget. |
| Supply-chain compromise | Lockfile installs, Dependabot, CodeQL, gitleaks, pinned GitHub Actions by SHA, dependency review, `npm audit` gate | npm ecosystem risk remains. |
| Reverse-proxy header spoofing | `trustHost` with operator-configured `NEXT_PUBLIC_APP_URL`; no client-provided redirect targets | Misconfigured proxies can produce wrong absolute URLs. |
| Telemetry egress of sensitive data | OTLP is opt-in; attributes with sensitive names are dropped; metrics use counts and severities | An operator-controlled collector still receives request metadata. |
| Unauthorized local access to the instance | OAuth-only authentication, no anonymous routes, `HttpOnly` cookies | Anyone with network access to an unauthenticated deployment can attempt OAuth; protect the host and use HTTPS. |

## Explicitly accepted limitations

1. **Repository shell cleanup.** Deleting a repository requires the broad `delete_repo` scope. By default a failed import can leave an empty repository, reported honestly as `cleanup_incomplete` with remediation.
2. **Unreferenced Git blobs.** Objects written before a failed tree/commit cannot be deleted through the API. They are invisible and garbage collected by GitHub.
3. **Secret rules are pattern-based.** Encoded, split, or encrypted secrets are not detected. The scan budget and truncation state are always disclosed.
4. **No at-rest application database.** Sessions are stateless JWTs; there is no server-side revocation list beyond GitHub token validity.
5. **Beta auth dependency.** Auth.js v5 has no stable release; the exact version is pinned and documented in ADR 0001 with a migration plan.
