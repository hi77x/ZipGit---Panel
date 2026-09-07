# Changelog

## 4.0.0

- Rebuilt the static JavaScript monolith as a strict TypeScript Next.js 16 application.
- Replaced browser PAT entry/storage with GitHub OAuth and server-only Auth.js JWT access.
- Removed the arbitrary GitHub proxy and introduced allowlisted BFF routes plus one typed GitHub client.
- Added safe streaming ZIP upload, lazy preflight, secret/path policies, and one-root-commit Git Data import.
- Added real repository discovery, README, activity, Pages, and Actions surfaces.
- Added contextual 404/409/422 mapping, empty 204 handling, request IDs, rate-limit metadata, and safe partial-import results.
- Added nonce CSP, security headers, responsive navigation, accessible feature states, tests, and production documentation.
