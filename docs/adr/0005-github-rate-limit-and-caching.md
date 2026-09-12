# ADR 0005: GitHub rate limits, retries, and caching

## Context

RepoDeck makes many GitHub API calls per page: repository detail, trees, contents, contributors, commits, and audit downloads. GitHub enforces primary rate limits (per-hour quota with `x-ratelimit-*` headers) and secondary limits (abuse detection, often `403` with `Retry-After`). The previous transport retried only GET requests with a fixed exponential delay, ignored `Retry-After`, and had no documented caching strategy.

## Decision

**Retry policy (implemented).**

- Only idempotent GET requests are retried, up to three attempts.
- Retryable classes: network failure (`status 0`), `429`, `403` with `Retry-After`, and `5xx`.
- `Retry-After` is honored up to a 30-second cap; otherwise exponential backoff with bounded full jitter (250 ms base, 5 s cap).
- Mutations are never retried automatically because the request may already have been applied upstream.
- Malformed upstream payloads are classified distinctly (`GITHUB_SCHEMA_MISMATCH`, synthetic status `-2`) and never retried.
- External aborts propagate immediately and are not converted into retries.
- Retries are observable: `github_retry` logs plus the `repodeck.github.retries` metric.

**Conditional requests and caching (documented, deferred).**

- No response cache is implemented. A shared cache would key on URLs that contain private data and would need strict per-identity isolation, TTL bounds, and invalidation semantics. None of that exists today, so a naive cache is rejected.
- Request coalescing and `ETag`/`If-None-Match` conditional GETs are the planned optimization. The requirement for any future cache is recorded here: key by token hash + method + URL + accept, bound size and TTL, never serve a cached private response across identities.

**Fan-out protection (implemented).**

- Import blob writes: bounded concurrency (6) with cancellation and abort.
- Audit downloads: bounded concurrency (6), 400-file and 4 MB budgets, filtered binaries.
- Contributor and commit aggregation: page caps (2 pages) with explicit truncation flags.
- Search and notification calls: single requests per tab/page.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| No retries | Transient 5xx and network failures would surface as user-visible errors for no reason. |
| Retry mutations too | Duplicate refs, releases, or comments are worse than an honest failure; mutations are usually safe to retry by the user after an explicit result. |
| Global URL-keyed cache | Private repository data could leak between users; unacceptable. |
| Conditional cache now | Requires per-identity storage and semantics that do not exist; deferred with explicit requirements. |
| Client-side rendering of GitHub data | Would push token or proxy requirements into the browser, violating the architecture. |

## Consequences

- The API budget is spent predictably: retries are observable and bounded, and fan-out is capped.
- Transient failures self-heal for reads; writes stay explicit.
- A future cache has a written contract instead of an ad-hoc implementation.
- **Future work:** ETag-based conditional GETs, in-flight request coalescing, and optional per-identity TTL cache. These are tracked as P1 and must include identity-isolation tests.

## Status

Accepted (retry policy and fan-out bounds implemented; caching deferred with requirements).
