# Architecture

ZipToGit Pro is a server-first Next.js 16 App Router application.

```text
Server Components / narrow Client Components
                    │
                    ▼
       allowlisted Route Handlers (BFF)
                    │
           Auth.js JWT session
                    │
                    ▼
             domain services
           ╱                  ╲
typed GitHub fetch client   ZIP preflight/import
           │                  │
    GitHub REST API      temporary storage
```

## Boundaries

- `src/app`: routing, layouts, Server Components, and Route Handlers
- `src/features`: user-facing feature components and same-origin client requests
- `src/components`: reusable shell, controls, and feedback states
- `src/shared/contracts`: serializable DTO and Zod contracts
- `src/server/services`: repository, README, activity, Pages, and Actions use cases
- `src/server/github`: the only GitHub HTTP transport, error mapping, rate-limit parsing, and pagination
- `src/server/import`: archive policy, lazy preflight, Git object writing, and import orchestration
- `src/lib`: environment parsing, safe URLs, request IDs, and redacted structured logging

Client Components cannot import `src/server`. GitHub access tokens exist only in the encrypted Auth.js JWT cookie and server request context.

## API envelope

Every application API response contains `ok`, a request ID, and optional rate-limit metadata. Failures contain a stable domain code, safe message, field errors, and retryability. Endpoint services interpret contextual GitHub responses: README 404 is empty, Pages 404 is disabled after repository availability is confirmed, and repository 404 is unavailable/forbidden.

## Import transaction

The importer performs a complete metadata preflight before creating a repository. It then creates blobs with bounded concurrency, a root tree, a parentless root commit, a branch ref, and the default-branch setting. No per-file commits are used. If a post-creation step fails, the repository is retained and returned as a structured partial result.

## Deployment

The current import transport is a long Node HTTP request with temporary disk access. It is suitable for a normal Node host. A short-timeout serverless deployment must run the same `ImportService` in a durable worker and add persisted progress events without moving GitHub or ZIP logic into React or the route.
