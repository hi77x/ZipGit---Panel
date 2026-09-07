# ZipToGit Pro

ZipToGit Pro is a production-oriented Next.js application for importing a ZIP archive into a new GitHub repository as one clean root commit. It also provides repository overview, safe README rendering, recent activity, GitHub Pages configuration, and GitHub Actions controls.

The GitHub access token stays inside the encrypted Auth.js JWT session. It is never returned by `/api/auth/session`, embedded in React props, or stored in browser storage.

## What it does

- GitHub OAuth with `read:user user:email repo workflow` scopes
- private and public repository discovery through a server-side BFF
- streaming multipart upload to a unique temporary directory
- lazy ZIP metadata preflight before any GitHub mutation
- one root commit through GitHub's Git Data API, with a maximum of six concurrent blob writes
- GFM README rendering through GitHub with a safe local fallback
- normalized repository activity without exposing raw event payloads
- Pages disabled/configured/building/deployed/failed states
- workflow and run listing, dispatch, cancel, and re-run operations
- centralized typed errors, request IDs, rate-limit metadata, CSP, and security headers
- responsive desktop, tablet, and mobile navigation

## Requirements

- Node.js 22.12 or newer
- npm 10 or newer
- a GitHub OAuth App
- a Node host with writable temporary storage and support for requests lasting up to five minutes

Short-timeout serverless platforms should move `ImportService` to a durable worker. The service boundary is already isolated for that migration.

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Create a GitHub OAuth App and configure:

- Homepage URL: `http://localhost:3000`
- Authorization callback URL: `http://localhost:3000/api/auth/callback/github`

Fill the following values in `.env.local`:

```dotenv
AUTH_SECRET=generate-a-random-value-of-at-least-32-characters
AUTH_GITHUB_ID=your-oauth-client-id
AUTH_GITHUB_SECRET=your-oauth-client-secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Generate `AUTH_SECRET` with a cryptographically secure password generator. Never commit `.env.local`.

## Validation commands

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run test:e2e
```

`npm run check` runs lint, TypeScript, unit/integration tests, and the production build in sequence. Playwright is separate because it starts local application and mock GitHub servers.

## ZIP safety policy

Validation runs before the repository is created. The importer rejects traversal, absolute or drive-letter paths, NUL characters, duplicate or case-colliding paths, encrypted entries, symlinks, special files, `.git/**`, likely credentials, and archives exceeding configured limits.

The default exclusions are:

```text
.git/** node_modules/** .next/** dist/** build/** coverage/**
.turbo/** .cache/** *.log .DS_Store Thumbs.db
```

`.env.example` is allowed. `.env`, `.env.*`, private keys, SSH identity files, service-account JSON, and credential/secret filenames block the entire import before GitHub is changed.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for trust boundaries and the route/service map. See [SECURITY.md](./SECURITY.md) before operating a public deployment. Manual real-GitHub verification is documented in [docs/MANUAL_SMOKE_TEST.md](./docs/MANUAL_SMOKE_TEST.md).

## License

MIT. See [LICENSE](./LICENSE).
