# Architecture

RepoDeck is a server-first Next.js 16 App Router application. It is a control plane over the GitHub API, not a code host and not a mirror.

```text
Server Components / Client Components
                    │
                    ▼
       allowlisted Route Handlers (BFF)
                    │
        Auth.js encrypted JWT session
                    │
                    ▼
              domain services
      ╱      │       │       │       ╲
  typed    content  issues  pulls   audit
  GitHub   +branch  +com-   +re-    (tree,
  client   writer   ments   leases  secrets,
     │                              health)
  GitHub REST API
```

## Boundaries

- `src/app`: routing, layouts, Server Components, and Route Handlers
- `src/features`: user-facing feature components and same-origin client requests
- `src/components`: design system, code viewer, diff viewer, charts, app shell, command palette
- `src/shared/contracts`: serializable DTO and Zod contracts, including the typed API envelope
- `src/server/services`: repository, README, activity, Pages, Actions, content, branch, commit, issue, pull, release, notification, search, and audit use cases
- `src/server/github`: the only GitHub HTTP transport, error mapping, rate-limit parsing, and pagination
- `src/server/import`: archive policy, lazy preflight, Git object writing, and import orchestration
- `src/lib`: self-written, dependency-free engines and helpers — unified diff parser, syntax tokenizer, secret rules, health scoring, manifest detection, fuzzy search, formatting, theme, URLs
- `src/components/diff`, `src/components/code`: rendering layers for the diff parser and tokenizer

Client Components never import `src/server`. GitHub access tokens exist only in the encrypted Auth.js JWT cookie and server request context.

## API envelope

Every application API response contains `ok`, a request ID, and optional rate-limit metadata. Failures contain a stable domain code, safe message, field errors, retryability, and optional details. Services interpret contextual GitHub responses — README 404 is empty, Pages 404 is disabled, repository 404 is unavailable/forbidden, compare 404 is a missing ref.

## Read paths

Server Components call services directly with the session token. Client components use the BFF when they need pagination, refetching, or mutations. Both paths share the same service layer, so no surface invents state.

## Write paths

Every mutation is validated with Zod, checks repository accessibility, and then calls the GitHub API:

- File writes use the Contents API and produce one commit per save.
- Branch creation uses the Git refs API; default-branch deletion is blocked in the service.
- Issues and comments use the Issues API; pull requests use the Pulls API, including reviews and merges.
- Releases use the Releases API.
- Notifications use the Notifications API with bulk-read limits.
- ZIP import uses the Git Data API with bounded concurrency and one root commit.

## Audit pipeline

`AuditService` is intentionally bounded to respect API budgets and request latency:

1. One recursive tree fetch (`git/trees?recursive=1`).
2. Blob selection with ignore lists (lockfiles, build output, minified assets, binaries, files over 512 KiB).
3. Raw content fetch with concurrency 6 up to 400 files / 4 MB.
4. Secret scan with masking and entropy checks.
5. Language, contributor, and 12-month activity aggregation.
6. Health scoring and recommendation generation.

Any cap that is hit sets `truncated: true` in the report.

## Import transaction

The importer performs a complete metadata preflight before creating a repository. It then creates blobs with bounded concurrency, a root tree, a parentless root commit, a branch ref, and the default-branch setting. No per-file commits are used. If a post-creation step fails, the repository is retained and returned as a structured partial result.

## Rendering engines

- `src/lib/diff.ts` parses unified patches into hunks with old/new line numbers, stats, and change classification.
- `src/lib/syntax.ts` tokenizes source into typed tokens for 60+ languages across code, HTML, CSS, JSON, YAML, Markdown, shell, SQL, and Python modes.
- `src/lib/secret-rules.ts` defines rule families, entropy scoring, masking, and severity summaries.
- `src/lib/health.ts` weights 14 checks into a 0–100 score with strengths and improvements.
- `src/components/diff/diff-viewer.tsx` persists reviewed-file state per pull request or commit via `useSyncExternalStore`.

## Deployment

- Node host: `npm run build` produces standalone output; `npm start` serves it.
- Docker: multi-stage Node 22 Alpine image, non-root runtime, `/tmp` volume for imports, `/api/health` health check.
- Launchers: `start.ps1` (Windows) and `start.sh` (macOS/Linux) handle setup, doctor, install, and run.
- Short-timeout serverless platforms should move `ImportService` and `AuditService` to durable workers; their boundaries are already isolated for that migration.

## Security headers

The proxy generates a per-request nonce, sets it on both the request and the CSP (`script-src 'self' 'nonce-…' 'strict-dynamic'`), and emits `Referrer-Policy`, `X-Content-Type-Options`, `X-Frame-Options`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, and HSTS in production.
