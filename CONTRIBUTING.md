# Contributing

Thank you for improving ZipToGit Pro.

## Development workflow

1. Create a focused branch from `main`.
2. Copy `.env.example` to `.env.local` and use a dedicated development OAuth App.
3. Keep GitHub traffic inside `src/server/github/client.ts` and domain services.
4. Add or update tests for behavior changes.
5. Run `npm run check` and the relevant Playwright scenarios.
6. Open a pull request with the problem, root cause, verification evidence, and security impact.

## Engineering rules

- TypeScript remains strict; do not use `any`, disabled checks, empty catches, or type assertions to hide a design error.
- Client Components must not import `src/server/**`, receive access tokens, or call GitHub directly.
- Route Handlers use the common API envelope and error mapper.
- ZIP policy changes must be enforced before any GitHub mutation and include negative tests.
- Treat endpoint-specific 404/409/422 responses as domain states, not generic crashes.
- Keep styles inside the existing semantic token system and verify 360, 390, 768, 1024, and 1440 pixel layouts.
- Production behavior cannot depend on mock data, static counters, or placeholder states.

## Pull request checklist

- [ ] lint, typecheck, tests, and production build pass
- [ ] new input has server-side Zod validation
- [ ] logs and responses contain no secret material
- [ ] mutations are explicit and not retried when the result is ambiguous
- [ ] loading, empty, permission, error, and success states remain distinguishable
- [ ] keyboard and responsive behavior were checked

By contributing, you agree that your work is provided under the repository's MIT license.
