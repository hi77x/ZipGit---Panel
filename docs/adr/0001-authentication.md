# ADR 0001: Production authentication

## Context

RepoDeck authenticates users through GitHub OAuth and keeps the GitHub access token server-side in an encrypted Auth.js JWT session cookie. The project originally shipped on `next-auth@5.0.0-beta.32`.

The hardening roadmap requires that the production path must not depend on a prerelease package without a documented reason. At the time of this decision:

- `npm view next-auth dist-tags` reports `latest: 4.24.15` and `beta: 5.0.0-beta.32`. No stable v5 exists.
- `next-auth@4.24.15` is stable and declares Next.js 16 peer support, but it is a previous major with a different App Router and middleware integration model (`getServerSession`, `withAuth`, `next-auth/react` for sign-out).
- `better-auth` is stable and supports Next.js 16, but its session store is database-backed or requires secondary storage. RepoDeck intentionally has no database.
- Implementing an OAuth/session layer by hand (for example with `openid-client`) is explicitly out of scope: it would mean owning cryptographic session management.

## Decision

Keep Auth.js v5 pinned to exactly `5.0.0-beta.32`, and harden the boundary around it:

- the provider requests only `read:user user:email repo workflow notifications`;
- the JWT callback stores the GitHub access token, and the session callback never copies it into the session payload;
- the session cookie is explicitly configured as `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` whenever `NEXT_PUBLIC_APP_URL` is HTTPS;
- the JWT session has an explicit 30-day maximum age;
- OAuth redirects are restricted to the application origin;
- the configuration is exported (`authConfig`) and covered by regression tests in `src/auth.test.ts`.

This is the documented escape hatch: the package is pinned exactly, the decision is recorded, compatibility tests exist, and the migration path is defined below.

## Alternatives considered

| Alternative | Why not |
| --- | --- |
| `next-auth@4` stable | Previous major in maintenance mode; migrating backwards mid-hardening changes the middleware/session integration without improving the token boundary. |
| `better-auth` | Requires persistent storage adapters; adding a database only for auth contradicts the project constraints. |
| Hand-rolled OIDC + session encryption | Prohibited by the roadmap and by ordinary engineering judgment. |

## Consequences

- The project continues to depend on a beta package. This is a known, documented risk, mitigated by exact pinning and a small, tested integration surface.
- Auth.js v5 is the ecosystem's current integration for Next.js App Router; security fixes continue to land on the beta line.
- Re-evaluation triggers: Auth.js v5 GA, a security advisory affecting the pinned version, or the GitHub App mode work (P1), which will also change credential acquisition.

## Migration plan

When a stable Auth.js v5 (or a clearly better stable alternative) exists:

1. upgrade the pinned version;
2. keep the exported `authConfig` contract and redirect allowlist;
3. re-run `src/auth.test.ts` plus the authenticated Playwright suites;
4. verify that `/api/auth/session` still contains no access token;
5. update this ADR and `docs/SECURITY.md`.

## Security and operability impact

- The GitHub token never leaves the server: it lives in the encrypted JWT cookie and the server request context only.
- A revoked or invalid GitHub token maps to `AUTH_RECONNECT_REQUIRED` and a re-authentication state instead of a generic 500.
- Cookie attributes are explicit and testable, so a future Auth.js upgrade cannot silently weaken them.

## Status

Accepted.
