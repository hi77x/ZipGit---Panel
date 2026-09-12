# RepoDeck Senior+ Acceptance Report

Factual record of the hardening work performed against `SENIOR_PLUS_ROADMAP.md`. No claim in this report is made without a command result or a test reference.

## Build

Commands executed from a clean checkout on the local workstation (Node.js 20.17.0, Windows; CI uses Node.js 22.12):

| Command | Result |
| --- | --- |
| `npm ci` | Installed 589 packages from the lockfile in 55s, no errors |
| `npm run lint` | 0 errors, 1 pre-existing warning (`no-img-element` in `readme-viewer.tsx` fallback rendering) |
| `npm run typecheck` | Clean |
| `npm run test` | 26 test files, 148 tests, 0 failed, 0 skipped |
| `npm run test:coverage` | Passed all configured per-module thresholds |
| `npm run test:security` | 7 files, 74 tests, 0 failed |
| `npm run build` | Turbopack production build compiled successfully |
| `npm run test:e2e` | 16 tests passed against the production build with the mock GitHub server |
| `npm audit --omit=dev --audit-level=high` | 0 vulnerabilities |
| Production smoke (manual) | `/` returned 200 with the CSP nonce propagated to the theme script, `/api/health` returned 200 |
| CI on the validated revision | `quality-gate` success (checks + Playwright E2E on Ubuntu/Node 22.12), `secret-scan` success (gitleaks), `security` success (CodeQL + dependency audit) |

`npm run check:full` runs the full sequence and passed end to end after the final source changes.

## Test statistics

- Test files: 26
- Tests: 148 passed, 0 failed, 0 skipped
- Security regression subset: 74 tests
- Coverage provider: v8, domain scope (UI folders excluded; UI is covered by Playwright)

Coverage on critical modules (statements / branches / lines):

| Module | Stmts | Branch | Lines |
| --- | --- | --- | --- |
| `src/lib/diff.ts` | 90.1 | 80.0 | 96.5 |
| `src/lib/secret-rules.ts` | 87.9 | 64.7 | 100 |
| `src/lib/health.ts` | 100 | 72.4 | 100 |
| `src/lib/fuzzy.ts` | 97.4 | 92.0 | 100 |
| `src/lib/logger.ts` | 91.3 | 88.9 | 95.0 |
| `src/server/authz/capabilities.ts` | 97.5 | 100 | 96.6 |
| `src/server/auth/auth-config.ts` | 100 | 50.0 | 100 |
| `src/server/github/client.ts` | 91.0 | 88.2 | 95.5 |
| `src/server/github/errors.ts` | 91.7 | 71.0 | 93.8 |
| `src/server/import/import-service.ts` | 91.8 | 73.2 | 95.1 |
| `src/server/import/import-transaction.ts` | 80.8 | 66.7 | 84.0 |
| `src/server/import/secret-preflight.ts` | 67.1 | 50.0 | 71.4 |
| `src/server/import/path-policy.ts` | 91.8 | 83.3 | 100 |
| `src/server/import/git-object-writer.ts` | 100 | 100 | 100 |
| `src/server/import/zip-reader.ts` | 88.4 | 69.4 | 94.9 |
| `src/server/observability/telemetry.ts` | 94.9 | 85.7 | 96.9 |
| Project (domain scope) | 64.0 | 52.4 | 66.6 |

Thresholds are enforced in `vitest.config.ts`; `npm run test:coverage` fails when a critical module regresses.

## Import atomicity

Implemented as a typed transaction (`ImportTransaction`) with a stable `operationId`:

`RECEIVED → PREFLIGHTED → AUTHORIZED → REPOSITORY_CREATED → BLOBS_WRITING → TREE_CREATED → COMMIT_CREATED → REF_PUBLISHED → DEFAULT_BRANCH_CONFIGURED → COMPLETED`, failure enters `COMPENSATING`.

Fault-injection scenarios verified against a programmable GitHub server (`src/test/github-fault-server.ts`, `src/server/import/import-service.fault.test.ts`):

1. Valid archive completes and publishes exactly one branch after objects exist.
2. Credential content is rejected with zero GitHub mutations.
3. Clean content in a credential-looking filename imports successfully (content policy, not name policy).
4. Mid-upload failure stops queued blob writes and publishes no branch.
5. Tree creation failure publishes no branch.
6. Commit creation failure publishes no branch.
7. Ref creation failure publishes no branch.
8. Default-branch update failure deletes the ref created by the operation.
9. Cleanup enabled + deletable repository → `compensated`, repository removed.
10. Cleanup enabled + deletion refused → honest `cleanup_incomplete`.
11. Connection drop during upload → `cleanup_incomplete`, no branch.
12. Rate limit before creation → `failed` with `GITHUB_RATE_LIMITED`, nothing created.
13. Malformed upstream payload → distinct `GITHUB_SCHEMA_MISMATCH`, zero mutations.
14. Non-ZIP payload → rejected before any GitHub request.
15. Oversized/unscannable credential file → rejected with a `scan-budget` finding.

Rejection findings are masked; test `rejects credential content before any GitHub mutation` asserts the raw AWS-formatted value never appears in the serialized response.

## Rollback

Guaranteed:

- A ref created by a failed operation is deleted when the failure happens after publication.
- Queued blob writes are cancelled and in-flight requests are aborted after the first failure.
- An operation that never created a repository reports `failed` with nothing to clean up.
- Repository deletion, when explicitly enabled, only targets the repository created by the same operation.

Not guaranteed (reported honestly):

- A repository shell created before a failure cannot be deleted without `delete_repo`. The result is `cleanup_incomplete` with the repository URL and remediation.
- Unreferenced Git blobs written before a failure cannot be deleted through the API; they are invisible and garbage collected by GitHub.
- A concurrently created ref that RepoDeck did not observe is never deleted.

## Secret scanning

The import path reuses the Repo Radar secret engine (`src/lib/secret-rules.ts`) on archive text content before any GitHub mutation:

- 27 rule families: AWS, GitHub, GitLab, Google, OpenAI, Anthropic, Stripe, npm, PyPI, SendGrid, DigitalOcean, Shopify, Azure, private keys, Slack, Discord, Telegram, Mailgun, Twilio, Hugging Face, Square, database connection strings, basic-auth URLs, JWT, and generic high-entropy assignments.
- False-positive controls: placeholder filtering, Shannon entropy floor for generic assignments, per-line length guard.
- Budgets: files, per-file bytes, total bytes, findings cap (`IMPORT_MAX_SCAN_*`), binary skipping by extension and NUL sniffing.
- Masking: findings carry `masked`/`snippet` only; `toPublicFinding` strips the raw `match` from audit responses, and import findings are projected without it.
- Truncation is reported (`scan.truncated`), never presented as clean.
- CRITICAL/HIGH severities block; MEDIUM/LOW warn. There is deliberately no bypass switch.

## Authorization

One capability model (`src/server/authz/capabilities.ts`) derives roles from GitHub permission flags and maps them to named capabilities. Every mutation service calls `requireCapability(...)` before contacting GitHub; unknown/missing permissions and archived repositories deny dangerous mutations. UI hints use the same model but are not enforcement.

Verified by:

- `src/server/authz/capabilities.test.ts` — 27 role × capability expectations, archived and unknown-permission behavior, safe 403 errors.
- `src/server/services/capability-enforcement.test.ts` — read-only cannot write, triage cannot merge, push can write, archived denies, mid-session revocation denies, with zero mutation requests recorded.

Matrix: `docs/PERMISSIONS.md`. Decision: ADR 0003.

## Authentication

- Dependency: Auth.js `next-auth@5.0.0-beta.32`, pinned exactly. No stable v5 exists (`npm view next-auth dist-tags` → latest 4.24.15, beta 5.0.0-beta.32).
- Decision and migration plan: `docs/adr/0001-authentication.md`. Alternative `next-auth@4` was rejected as a backwards migration; `better-auth` requires persistent storage that RepoDeck intentionally does not have.
- Hardening: explicit `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure`-when-HTTPS cookie; 30-day JWT lifetime; redirect allowlist; access token stored only in the JWT and asserted absent from the session payload.
- Tests: `src/server/auth/auth-config.test.ts` — scope set (including `notifications`, excluding `delete_repo`), token isolation, external redirect blocking, cookie attributes.
- Revoked token: upstream 401 maps to `AUTH_RECONNECT_REQUIRED` (`src/server/github/errors.ts`, tested).

## Observability

- Structured JSON logs with a documented schema, central redaction, primitive-only values, truncation, and `LOG_LEVEL` filtering (`src/lib/logger.ts`, `src/lib/logger.test.ts`).
- Optional vendor-neutral OpenTelemetry: `@opentelemetry/api` in production, OTLP bootstrap in `src/instrumentation.ts` only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set; spans for HTTP, GitHub transport, import stages, and audits; metrics for requests, errors, GitHub calls/retries, import outcomes, and secret findings by severity.
- Low cardinality: routes are normalized buckets, GitHub labels use endpoint templates, secret metrics contain counts only. Attributes with sensitive names are dropped (`src/server/observability/telemetry.test.ts`).
- Health: `/api/health` and `/api/health/live` are liveness with version/commit; `/api/health/ready` validates local configuration and returns 503 with safe reasons. No GitHub dependency in readiness (`src/server/runtime-info.test.ts`).
- Correlation: one `requestId` per request end to end; one `operationId` per import across response, logs, and spans. Guide: `docs/DEBUGGING.md`.

## Security

- **gitleaks**: `secret-scan` workflow passed on the validated revision (SHA-pinned action).
- **CodeQL**: `security` workflow passed for `javascript-typescript` on the validated revision.
- **dependency review**: workflow added for pull requests, failing on high severity; exercised on the Dependabot PRs raised after this push.
- **npm audit**: `--omit=dev --audit-level=high` → 0 vulnerabilities; enforced in CI (`security` workflow) and verified green.
- **Malicious ZIP regression suite**: traversal, symlinks, encrypted entries, collisions, `.git`, overlong paths, malformed archives, and empty-after-exclusions all covered (`src/server/import/zip-reader.test.ts`).
- **Token leakage regression**: auth boundary test proves the access token is absent from the session payload; log/telemetry redaction tests prove credential-shaped keys are dropped.
- A real defect was found and fixed during this work: a ZIP with valid magic but a corrupt central directory leaked a raw parser error instead of `INVALID_ZIP`. The parser is now wrapped and the case is regression-tested.

## Docker

- Multi-stage Node 22 Alpine image, non-root `nextjs` user, standalone output, `HEALTHCHECK` on `/api/health`, no `.env` (dockerignored), `/tmp` volume in Compose, version/commit build args exposed as OCI labels and `REPODECK_COMMIT_SHA`.
- Image build and container smoke test are **blocked locally** because Docker is not installed on this workstation. The acceptance for this item is delegated to CI (`docker/build-push-action` in the release workflow) and must be verified on the first tagged release.

## Known limitations

1. Repository shell cleanup after a failed import requires `delete_repo` and is opt-in; default behavior is honest `cleanup_incomplete`.
2. Unreferenced Git blobs cannot be deleted through the GitHub API.
3. Secret detection is pattern/entropy based; encoded, split, or encrypted secrets can pass, and scan truncation is disclosed rather than blocking in all cases.
4. Service-level unit coverage is intentionally focused on failure semantics, authorization, and security code; low-level GitHub wiring is exercised through contract/fault tests and E2E rather than duplicated mock-heavy tests. Enforced aggregate thresholds are statements 62, branches 50, functions 68, lines 65; measured totals are 63.96 / 52.4 / 69.64 / 66.6, with per-module thresholds for every critical engine and transaction module.
5. Auth.js v5 remains a pinned beta; the migration trigger and plan are documented in ADR 0001.
6. Conditional GETs / response caching are designed but deferred (ADR 0005).
7. The audit content scan uses raw `contents` downloads with bounded concurrency; very large repositories hit the documented 400-file / 4 MB budget and report `truncated: true`.

## Blocked external validation

| Item | Reason | Planned verification |
| --- | --- | --- |
| Docker image build + container smoke test | Docker is not installed on the workstation | First CI release run / local Docker host |
| Real GitHub OAuth login and live mutations | No production OAuth credentials in this environment | Operator deployment; manual smoke test `docs/MANUAL_SMOKE_TEST.md` |
| GHCR image, SBOM, and GitHub Release | Requires pushing a `v*` tag | Tagged release |

`docs/manual-smoke` style guidance remains in `docs/MANUAL_SMOKE_TEST.md` for real-GitHub verification.

## Git

- Validated source revision: `62da18c2be218c50bff89ae3d785ff01761b6091` (all local commands above ran against this revision plus the final ZIP regression test/fix).
- CI-verified revision: `bab9c6fc056da558fb96992d2b3e3fbf3dcc9ed4` (`quality-gate`, `secret-scan`, and `security` all succeeded on GitHub Actions).
- Commits produced during this work:

| Commit | Scope |
| --- | --- |
| `a30eb93` | `feat(import)`: failure-atomic import with content secret preflight |
| `e93475b` | `feat(authz)`: server-side capability enforcement |
| `9fbf731` | `refactor(auth)`: hardened session boundary and ADR 0001 |
| `283c102` | `feat(obs)`: optional telemetry, metrics, hardened retries |
| `62da18c` | `ci`: coverage gates, accessibility checks, release pipeline |
| final | `docs`: threat model, permissions, debugging, ADRs, acceptance report (this file) |

The final commit SHA is the hash of the commit that adds this report to `main`; it is reported in the delivery message.

## Acceptance summary

| Gate | Status |
| --- | --- |
| Clean install + lint + typecheck + unit + build | Pass |
| Coverage thresholds | Pass |
| Security regression suite | Pass (74 tests) |
| E2E + accessibility (production build) | Pass (16 tests) |
| Import atomicity fault injection | Pass (15 scenarios) |
| Capability enforcement | Pass (matrix + fault tests) |
| Secret scanning before mutation | Pass (blocking + masking tests) |
| Token never in client payload / logs | Pass (auth + redaction tests) |
| Docker container smoke | Blocked externally (no Docker); CI-verified on release |
| Real GitHub end-to-end | Blocked externally (no credentials) |
