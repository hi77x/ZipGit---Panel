# Contributing

Thank you for improving RepoDeck.

## First contribution path

1. Fork the repository and create a focused branch from `main`.
2. Run the zero-friction setup: `npm install && npm run setup && npm run doctor`.
3. Create a development GitHub OAuth App (callback: `http://localhost:3000/api/auth/callback/github`) and put the credentials in `.env.local`.
4. Start the app with `npm run dev`.
5. Run `npm run check` before opening a pull request. For UI or flow changes also run `npm run test:e2e`.

You can explore most of the codebase without GitHub credentials by reading the mock servers in `src/test/github-fault-server.ts` and `e2e/mock-github.mjs`; they implement the GitHub endpoints the tests rely on.

## Architecture quick map

```text
src/app          routes, Server Components, BFF handlers
src/components   design system, code/diff viewers, charts, shell
src/features     client feature components
src/lib          dependency-free engines (diff, syntax, secrets, health, fuzzy)
src/server       GitHub transport, services, authz, import, observability
src/shared       contracts and API envelope
docs             ADRs, permissions, debugging, threat model
```

Invariants that reviews enforce:

- all GitHub network calls go through `src/server/github/client.ts`;
- every mutation is authorized server-side (`src/server/authz/capabilities.ts`);
- no raw secret or repository content crosses the server boundary;
- import publishes the branch ref only after objects exist;
- expensive fan-out is bounded (see `src/server/import/constants.ts` and audit limits).

## Commands

| Command | Purpose |
| --- | --- |
| `npm run check` | lint + typecheck + unit tests + production build |
| `npm run check:full` | full local acceptance: adds coverage, security tests, and E2E |
| `npm run test:coverage` | unit tests with coverage thresholds |
| `npm run test:security` | secret scanning, import atomicity, and permission regression tests |
| `npm run test:e2e` | Playwright against the production build with mock GitHub |
| `npm run doctor` | environment diagnostics |

## Engineering rules

- TypeScript stays strict; do not use `any`, disabled checks, empty catches, or assertions to hide design errors.
- Client Components must not import `src/server/**`, receive access tokens, or call GitHub directly.
- New mutations must call `requireCapability(...)` before touching GitHub and add a negative test.
- ZIP policy and secret-scanning changes must be enforced before any GitHub mutation and include regression tests.
- Never log, return, or persist tokens, archive content, or raw credential matches.
- New failure paths must be typed: a stable code, a safe message, and an honest retryability flag.
- No new runtime dependency without a written justification and an ADR when the decision is architectural.

## Pull request checklist

- [ ] `npm run check` passes
- [ ] coverage thresholds still pass (`npm run test:coverage`)
- [ ] security-relevant changes ran `npm run test:security` and added regression tests
- [ ] new input has server-side Zod validation
- [ ] logs, telemetry, and responses contain no secret material
- [ ] mutations stay server-authorized and are not retried when the outcome is ambiguous
- [ ] loading, empty, permission, error, and success states remain distinguishable
- [ ] keyboard, focus, and responsive behavior were checked for UI changes

By contributing, you agree that your work is provided under the repository's MIT license.
