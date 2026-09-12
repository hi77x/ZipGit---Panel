<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# RepoDeck engineering conventions

RepoDeck is a self-hosted GitHub control plane built with Next.js 16 App Router, React 19, strict TypeScript, Zod v4, and a hand-written CSS design system.

## Hard rules

- No runtime dependencies may be added for features that can be implemented locally. All analysis engines live in `src/lib` and must stay dependency-free.
- Do not add code comments. The codebase is intentionally comment-free.
- Render GitHub data from the server whenever possible. Client Components call only the same-origin BFF through `apiRequest`.
- The GitHub access token must never leave the server. Do not pass it to props, JSON, or client state.

## Layers

- Routes: `src/app/api/github/**`; wrap handlers with `handleApi`, use `githubFor(context)`, finish with `syncRateLimit(context, github)`.
- Services: `src/server/services/*`; import `server-only`, validate repository access, map GitHub errors through `mapGitHubError`.
- Contracts: `src/shared/contracts/*`; every DTO crossing the server/client boundary lives here.
- UI: pages are Server Components under `src/app/(dashboard)`; interactive parts live in `src/features/*` with `"use client"`.
- Views render GitHub state; never invent counters, statuses, or timestamps.

## Styling

Use the classes in `src/app/globals.css` and components from `src/components/ui`. There is no Tailwind. Prefer tokens (`var(--surface-2)`, `var(--border)`, `var(--muted)`) over raw colors. Highlight code through `Tokens` from `src/components/code/code-viewer.tsx`, and diffs through `DiffViewer` from `src/components/diff/diff-viewer.tsx`.

## Verification

Run `npm run lint`, `npm run typecheck`, and `npm run test` before considering work complete. `npm run check` adds the production build. Engine changes in `src/lib` require unit tests.

`npm run check:full` is the authoritative local acceptance gate: lint, typecheck, coverage thresholds, security regression tests, production build, and Playwright E2E (including accessibility scans). Security-relevant changes must also run `npm run test:security`.

## Invariants

- All GitHub network calls go through `src/server/github/client.ts`.
- Every mutation is authorized with `requireCapability(...)` before contacting GitHub.
- Import publishes the branch ref only after all Git objects exist; compensation only touches side effects created by the operation.
- No raw secret, token, or repository content crosses the server boundary or enters logs/telemetry.
- Expensive fan-out uses bounded concurrency and explicit budgets.

