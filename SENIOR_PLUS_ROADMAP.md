# RepoDeck — Senior+ Production & Open-Source Hardening Roadmap

> Purpose: turn RepoDeck from a broad, impressive GitHub API client into a production-grade open-source engineering project whose quality is visible in failure handling, security, permissions, observability, testing, release discipline, and maintainability — not merely feature count.
>
> Agent communication with the project owner MUST be in Russian. Source code, public documentation, comments, commit messages, API names, and user-facing product copy should remain in English unless the surrounding file already uses another convention.

## 0. Mission

Do **not** add another large batch of GitHub screens just to increase feature count.

The next iteration must prove senior-level engineering through:

1. correct failure semantics and compensating actions;
2. least-privilege authorization and explicit capabilities;
3. content-aware security controls before destructive mutations;
4. production observability with useful telemetry;
5. stable authentication dependencies and hardened session behavior;
6. systematic test depth, fault injection, and formal acceptance criteria;
7. supply-chain and release engineering;
8. contributor-friendly architecture and decision records.

The target is not “replace github.com”. The target is: **a trustworthy self-hosted GitHub command deck that a competent engineer would be comfortable deploying, debugging, contributing to, and operating.**

---

## 1. Current baseline — preserve what is already good

Before modifying anything, inspect the current repository and preserve existing behavior unless this document explicitly changes it.

Existing strengths that MUST NOT be accidentally flattened or rewritten into weaker abstractions:

- server-first Next.js architecture;
- allowlisted BFF route handlers;
- service layer between routes and GitHub transport;
- shared DTO/contracts and Zod validation;
- centralized GitHub client;
- request IDs;
- timeouts and retry/backoff for safe GET operations;
- structured JSON logs;
- server-only GitHub tokens;
- bounded ZIP processing;
- diff/syntax/secret/health engines;
- unit tests + Playwright E2E;
- Docker/non-root deployment;
- CSP/security headers;
- current Repo Radar and code/review workflows.

### Current known gaps that this roadmap must close

- Import can leave a newly created repository behind after a mid-import failure.
- Import security needs a first-class content-level secret policy before GitHub mutation.
- Authorization is too implicit; UI and server need one explicit capability model.
- Current logs are useful but not sufficient production observability.
- Authentication currently depends on a prerelease `next-auth` package.
- Test presence is not the same as acceptance: critical failure paths need deterministic fault-injection coverage.
- CI/security/release processes should provide evidence, not badges.

---

# P0 — REQUIRED FOR “SENIOR+” CLAIM

P0 is complete only when **every acceptance criterion in section 10 passes**.

---

## 2. P0-A — Transactional import and rollback semantics

### Goal

An import must never expose a half-written repository state as if it were successful.

A network failure after blob 317/800, a GitHub 5xx, timeout, invalid ref, rate limit, or post-write failure must produce a deterministic and explainable result.

### Design requirements

Create an explicit import state machine / transaction journal in code.

Recommended stages:

```text
RECEIVED
  -> PREFLIGHTED
  -> AUTHORIZED
  -> REPOSITORY_CREATED
  -> BLOBS_WRITING
  -> TREE_CREATED
  -> COMMIT_CREATED
  -> REF_PUBLISHED
  -> DEFAULT_BRANCH_CONFIGURED
  -> COMPLETED

Any failure:
  -> COMPENSATING
  -> ROLLED_BACK | CLEANUP_INCOMPLETE
```

Do not infer state from exception text. Represent stages with typed values.

### Atomic publication rule

The visible Git branch/ref is the publication boundary.

- Create blobs/tree/commit before publishing the target branch when GitHub permits it.
- Never create or move the final branch ref until all required objects exist.
- If a ref was created and a later step fails, attempt to delete/restore that ref when safe.
- Never delete a pre-existing user branch or repository during rollback.
- Record whether every side effect was created by the current import operation.

### Repository cleanup and least privilege

Do **not** add broad repository-deletion permission by default just to make rollback look perfect.

Default behavior:

- use the minimum OAuth/GitHub permission set;
- guarantee **content atomicity**: no half-imported visible branch;
- if a newly created empty repository cannot be deleted with the currently granted permissions, return a structured `CLEANUP_INCOMPLETE` result with exact remediation;
- do not pretend full rollback occurred when the repository shell still exists.

Optional cleanup capability may delete a repository **only** when all of the following are true:

- the repository was created by the current import operation;
- the application has an explicitly granted deletion capability;
- owner/name still match the transaction journal;
- no unexpected branch/content/user activity appeared after creation;
- the action is covered by tests.

Never require `delete_repo`-equivalent permission merely to run RepoDeck.

### Import operation ID

Generate a stable `importOperationId` for each import.

Return it in:

- API response metadata;
- structured logs;
- traces;
- rollback/cleanup events;
- error details safe for the user.

### Failure result contract

Replace vague partial-success behavior with typed outcomes. Example domain outcomes:

- `IMPORT_FAILED_PREFLIGHT`
- `IMPORT_PERMISSION_DENIED`
- `IMPORT_RATE_LIMITED`
- `IMPORT_UPSTREAM_TIMEOUT`
- `IMPORT_ROLLED_BACK`
- `IMPORT_CLEANUP_INCOMPLETE`
- `IMPORT_COMPLETED`

Do not leak secrets, raw archive contents, auth tokens, or upstream response bodies.

### Tests required

Fault-inject failures at least at:

1. repository creation;
2. first blob;
3. middle blob;
4. final blob;
5. tree creation;
6. commit creation;
7. ref creation;
8. default branch update;
9. rollback ref deletion;
10. optional repository cleanup.

Assert final GitHub mock state, not only HTTP status.

---

## 3. P0-B — Real content-level secret scanning before mutation

### Goal

No archive should be pushed to GitHub before its text content has passed the same class of secret checks RepoDeck advertises in Repo Radar.

### Required architecture

Extract/reuse the existing secret detection engine behind a shared server-safe interface. Do not create a weaker second scanner specifically for imports.

Add an import preflight scanner that:

- scans eligible text files **before repository creation**;
- works with bounded memory;
- skips binary files using explicit detection;
- has file-size and total-byte budgets;
- uses rule-based detection + entropy where appropriate;
- returns masked findings only;
- records truncation honestly;
- cannot print detected raw secrets into logs/errors/UI;
- supports deterministic fixtures for tests without committing real credentials.

### Policy

Classify findings by severity.

Default policy:

- critical/high-confidence credentials: block import;
- medium/low-confidence findings: warn;
- scanner truncation: show a visible “scan incomplete” state, never “clean”.

If an override is implemented, it must be explicit and auditable. A generic “continue anyway” checkbox with no context is insufficient.

### Result UX

For each finding expose only safe fields such as:

- file path;
- line number when available;
- rule ID/type;
- severity;
- masked snippet;
- remediation hint.

Never return the complete matched credential.

### Coverage

Tests must include:

- common token formats;
- high-entropy false positives;
- `.env` and config files;
- binary files;
- huge files;
- many small files;
- secret split across unsupported boundaries — document limitation;
- archive scan budget exceeded;
- masking guarantees;
- log redaction guarantees.

---

## 4. P0-C — Explicit permission & capability model

### Goal

RepoDeck must know the difference between “the screen exists” and “this user can safely perform this operation”.

### Add a CapabilityService

Create one canonical capability model used by both server behavior and UI hints.

Example capabilities:

```ts
readRepository
readCode
writeCode
createBranch
deleteBranch
manageIssues
managePullRequests
mergePullRequest
manageReleases
readActions
runWorkflow
cancelWorkflow
managePages
runAudit
importRepository
manageRepository
optionalDeleteImportedRepository
```

Do not trust client-side disabled buttons as authorization.

### Capability inputs

Use the strongest available evidence, such as:

- authenticated identity;
- repository permissions returned by GitHub;
- organization access;
- granted OAuth/App scopes when reliably available;
- endpoint-specific constraints;
- GitHub response semantics.

Treat unknown capability as denied for dangerous mutations.

### Server enforcement

Every mutation service must enforce capabilities before performing the side effect.

A route that reaches GitHub and waits for a 403 for every authorization decision is not sufficient where permissions can be determined earlier.

Still map upstream 401/403 safely because permissions can change between checks.

### UI behavior

- Hide actions that are meaningless.
- Disable actions when discoverability is useful, with a clear reason.
- Never show a destructive action as available and only fail after click if the lack of permission was already known.

### Permission edge cases

Test:

- read-only collaborator;
- triage role;
- write role;
- maintain/admin;
- organization repository;
- private repository;
- archived repository;
- SSO/organization restriction response;
- token revoked during an active session;
- scope insufficient for Actions workflow mutation.

### Documentation

Add `docs/PERMISSIONS.md` with a human-readable matrix:

```text
RepoDeck feature -> GitHub permission/scope -> why required -> failure behavior
```

Prefer least privilege. Do not expand OAuth scopes without documenting the exact reason.

---

## 5. P0-D — Production observability

### Goal

When a user reports “import failed”, “GitHub is slow”, “Radar hangs”, or “merge gave an error”, the maintainer must be able to diagnose the class of failure without reproducing it locally and without seeing user secrets.

### Preserve structured logs, then formalize schema

Create documented log fields. At minimum:

```text
timestamp
level
service
operation
route
requestId
userHash (when useful)
repoHash or safe owner/repo identifiers according to privacy policy
importOperationId / auditOperationId
durationMs
upstreamStatus
errorCode
retryable
rateLimitRemaining
rateLimitResetAt
```

Do not log:

- access tokens;
- Authorization headers;
- cookies;
- file content;
- archive content;
- detected raw secrets;
- issue/PR bodies by default.

### OpenTelemetry

Add optional, vendor-neutral OpenTelemetry instrumentation.

Requirements:

- zero-config local development remains simple;
- telemetry export is disabled unless configured;
- support OTLP through environment variables;
- add spans around BFF requests, GitHub upstream requests, import stages, audit stages, and rollback;
- propagate `requestId` / operation IDs into span attributes where safe.

### Metrics

Expose/emit metrics suitable for RED-style operations:

- HTTP request count;
- request latency histogram;
- error count by stable error code;
- GitHub upstream latency/status;
- GitHub rate-limit remaining observations;
- GitHub retries/timeouts;
- import duration;
- imported file count/bytes buckets;
- import success/failure/rollback/cleanup-incomplete counts;
- secret scan findings by severity (count only, no content);
- audit duration/truncation count;
- expensive-operation concurrency.

### Health semantics

Split liveness and readiness semantics.

- liveness: process can answer requests;
- readiness: required local configuration/runtime is usable;
- do not make temporary GitHub downtime cause container restart loops.

Document the endpoints.

### Error correlation

Every user-visible unexpected error should include a safe request/operation identifier that can be matched to logs/traces.

---

## 6. P0-E — Remove prerelease authentication from the production path

### Goal

Production auth must not depend on a beta/prerelease package merely because it was convenient during the first sprint.

### Required migration

Replace the current prerelease authentication dependency with a maintained **stable** authentication/OAuth implementation compatible with the project runtime.

Acceptable direction:

1. a stable Auth.js / NextAuth release compatible with the current Next.js version; or
2. another mature stable OAuth/OIDC implementation with audited primitives.

Do not blindly downgrade frameworks or weaken security to satisfy the word “stable”. If compatibility requires a deliberate migration, document it and perform it cleanly.

### Security requirements

Preserve or improve:

- GitHub access token is server-only;
- token is never returned in the browser session payload;
- HttpOnly session cookies;
- Secure cookies in production;
- appropriate SameSite policy;
- CSRF/state protection;
- PKCE where supported by the chosen flow;
- session expiry/rotation policy;
- logout invalidates local session state;
- revoked/invalid GitHub token triggers a clear re-authentication path instead of generic 500;
- auth callback errors are mapped to user-safe states.

### Tests

Cover:

- successful login;
- rejected OAuth state;
- callback failure;
- expired/invalid session;
- revoked GitHub credential;
- logout;
- protected route redirect;
- no access token in serialized client session;
- secure-cookie behavior under production config.

### ADR

Create `docs/adr/0001-authentication.md` describing:

- chosen auth approach;
- alternatives considered;
- why the chosen dependency is acceptable;
- token/session threat model;
- upgrade policy.

---

## 7. P0-F — Resilience, concurrency, and upstream semantics

### GitHub client

Keep centralized transport but harden it.

Implement or explicitly document:

- retries only for idempotent/safe requests unless a mutation has an explicit safe retry strategy;
- exponential backoff with jitter;
- `Retry-After` support;
- primary and secondary GitHub rate-limit handling;
- timeout classification;
- abort propagation;
- response schema failures as a distinct observability signal;
- bounded response/body assumptions where relevant.

### Request coalescing / conditional reads

For expensive repeated GETs, consider a bounded cache or request coalescing layer.

Prefer GitHub conditional requests (`ETag` / `If-None-Match`) where useful to reduce API budget.

Any cache for private repository data must be isolated by authenticated identity/capability context and have bounded memory/TTL.

Do not add a global cache keyed only by URL.

### Concurrency budgets

Create central configuration/constants for expensive fan-out operations.

Examples:

- audit downloads;
- import blob writes;
- contributor/commit aggregation;
- search fan-out.

Use bounded concurrency and test that caps are respected.

### Optimistic concurrency

Preserve SHA-based file update safety and extend conflict handling so stale edits return a clear conflict state rather than silently overwriting newer GitHub content.

---

## 8. P0-G — Test strategy: from “tests exist” to engineering evidence

### Test pyramid

Maintain separate layers:

```text
unit
contract
service/integration against mock GitHub
route/BFF tests
browser E2E
security regression
fault injection
```

### Contract tests

For critical GitHub API mappings, test both expected and malformed upstream payloads.

A schema change should fail loudly and diagnostically.

### Route tests

Critical BFF mutations must verify:

- auth required;
- validation;
- permission enforcement;
- stable response envelope;
- request ID;
- rate-limit metadata;
- safe error mapping.

### Fault-injection mock GitHub

Upgrade the mock GitHub server so tests can declaratively inject:

- 401;
- 403 permission denied;
- primary rate limit;
- secondary rate limit;
- 404;
- 409/422 conflicts;
- 500/502;
- delayed response / timeout;
- connection reset if practical;
- malformed JSON/schema mismatch;
- failure after N successful blob writes.

### Coverage policy

Add coverage to CI, but do not optimize for a vanity percentage.

Minimum target:

- critical pure engines and transaction/security code: >= 90% branch coverage;
- server services and permission/error mapping: >= 85% branch coverage;
- overall project: establish a realistic non-decreasing baseline.

CI must fail on meaningful regression below configured thresholds.

Never add meaningless tests merely to raise coverage.

### Accessibility acceptance

Add automated accessibility checks for core flows with Playwright + axe (or equivalent stable tooling):

- landing/login;
- dashboard/navigation;
- repository overview;
- code explorer/editor;
- pull request review;
- import form + validation errors;
- Repo Radar findings.

No critical accessibility violations in acceptance flows.

---

## 9. P0-H — CI, security, supply chain, and releases

### CI quality gate

PR/main quality gate should include:

```text
npm ci
lint
typecheck
unit + contract + integration tests
coverage gate
production build
Playwright E2E
security regression tests
secret scan
```

Parallelize jobs where safe so quality does not become painfully slow.

### Dependency/security automation

Add only useful controls:

- Dependabot or Renovate config;
- dependency review on PRs when supported;
- CodeQL for JS/TS;
- high/critical dependency vulnerability gate with documented exceptions process;
- existing gitleaks scanning retained;
- pin or deliberately version third-party GitHub Actions;
- do not suppress findings globally to keep CI green.

### Release engineering

Create a reproducible release path:

- semantic version tag;
- changelog entry;
- GitHub Release;
- production Docker image to GHCR;
- version/commit SHA visible in health/about metadata;
- SBOM artifact for releases if practical;
- documented rollback to previous Docker tag.

Do not claim a release is reproducible unless CI actually builds it from the tag.

---

# P1 — HIGH-VALUE SENIOR+ OPEN-SOURCE IMPROVEMENTS

P1 starts only after P0 acceptance is green.

## 10. P1-A — GitHub App mode for least privilege

OAuth `repo` scope is convenient but broad.

Add an optional GitHub App deployment/auth mode so self-hosters can install RepoDeck only on selected repositories and grant granular permissions.

Requirements:

- OAuth mode may remain supported;
- GitHub App mode has a documented permission manifest;
- capability model works for both auth modes;
- installation token lifecycle remains server-only;
- do not duplicate domain services per auth mode — abstract credential acquisition, not business logic.

This is a strong open-source feature because teams can self-host without granting one OAuth token blanket access to every private repository.

---

## 11. P1-B — ADRs and architecture invariants

Add `docs/adr/`.

At minimum:

- `0001-authentication.md`
- `0002-import-transaction.md`
- `0003-permission-model.md`
- `0004-observability.md`
- `0005-github-rate-limit-and-caching.md`

Each ADR should contain:

```text
Context
Decision
Alternatives
Consequences
Security/operability impact
Status
```

Add architecture invariants to `ARCHITECTURE.md`, for example:

- client components never receive GitHub credentials;
- all GitHub network calls go through one transport boundary;
- every mutation is server-authorized;
- no unbounded archive or repository fan-out;
- no raw detected secrets cross the server boundary;
- every critical mutation has deterministic failure semantics.

---

## 12. P1-C — Contributor experience

Open-source senior quality includes making correct contribution easier than incorrect contribution.

Add/improve:

- `CONTRIBUTING.md` with local mock mode;
- architecture quick map;
- “first contribution” path;
- PR template with test/security checklist;
- issue templates for bug/feature/security redirection;
- `CODEOWNERS` where useful;
- deterministic fixture strategy;
- one-command `npm run check` remains authoritative;
- `npm run test:integration`, `test:e2e`, `test:security` discoverable;
- `docs/DEBUGGING.md` with request ID / trace correlation.

No documentation should claim behavior not covered by code/tests.

---

## 13. P1-D — Performance and API-budget engineering

Create benchmark/measurement tooling for the custom engines and expensive repository paths.

Measure at least:

- syntax tokenizer on large source files;
- unified diff parser on large patches;
- secret scanner throughput;
- Radar audit on small/medium/large mock repositories;
- ZIP preflight on many-file archives.

Track memory as well as wall time where practical.

Define budgets from measured baselines; do not invent arbitrary marketing numbers.

Add graceful degradation for very large repositories:

- sampling/truncation explicitly shown;
- cancel expensive work;
- avoid blocking navigation;
- avoid accidental thousands of GitHub API calls.

---

## 14. P1-E — Security threat model

Add `docs/THREAT_MODEL.md` covering:

### Assets

- GitHub access/install tokens;
- private repository content;
- imported archives;
- secret-scan findings;
- mutation capability.

### Trust boundaries

- browser -> RepoDeck;
- RepoDeck -> GitHub;
- ZIP parser;
- Markdown rendering;
- self-hosted reverse proxy;
- optional telemetry exporter.

### Threats

Include at least:

- token exfiltration;
- CSRF;
- XSS/Markdown injection;
- SSRF/open redirect;
- ZIP traversal / zip bombs;
- malicious filenames;
- secret leakage in logs;
- privilege confusion;
- stale permission state;
- mass API fan-out / denial of service;
- supply-chain compromise.

For every major threat link to the concrete mitigation or explicitly mark it unresolved.

---

# 15. Formal acceptance — Definition of Done

The project is **NOT** allowed to call this roadmap complete because “the code compiles”.

All P0 items require objective acceptance.

## Functional acceptance

- Existing repository browsing still works.
- Existing code editing still works.
- Issues/PR/releases/actions/pages flows used by existing E2E still work.
- Import success produces one correct published branch/commit history as designed.

## Import failure acceptance

For injected failure at every mutation stage:

- no half-imported visible branch remains;
- rollback state is deterministic;
- cleanup failures are reported honestly;
- no pre-existing repository state is deleted;
- operation ID correlates response/log/trace;
- retry guidance is correct.

## Secret acceptance

- content secrets are detected before GitHub repository mutation;
- raw secrets never appear in browser payloads, logs, snapshots, traces, or thrown public errors;
- truncated scan cannot display “clean”.

## Permission acceptance

For a matrix of read/triage/write/maintain/admin-style access:

- UI capability hints match server policy;
- server independently rejects forbidden mutations;
- changing permission mid-session results in a safe failure;
- archived/read-only repositories cannot be mutated by accident.

## Auth acceptance

- production dependency tree contains no intentionally selected beta/prerelease auth package;
- access token remains server-only;
- revoked credential produces re-auth flow;
- secure cookies and OAuth anti-forgery behavior have tests.

## Observability acceptance

Given one synthetic failed import, a maintainer can identify from telemetry:

```text
request ID
operation ID
failed stage
upstream status/error class
latency
retry count
rollback result
```

without seeing archive content or credentials.

## Quality acceptance

The required CI matrix passes from a clean checkout.

At minimum:

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:coverage
npm run build
npm run test:e2e
npm run test:security
```

If script names differ, document the final authoritative commands in README/CONTRIBUTING and keep `npm run check` as the one-command local quality gate.

## Security acceptance

- gitleaks passes;
- CodeQL has no unresolved high-severity finding introduced by this roadmap;
- dependency scan has no unexplained high/critical runtime vulnerability;
- malicious ZIP regression suite passes;
- auth/token leakage regression tests pass.

## Accessibility acceptance

- no critical automated accessibility failures in the defined core user journeys;
- keyboard-only navigation works for command palette, menus, dialogs, editor controls, import controls, and PR actions.

---

# 16. Required implementation order

Do not implement this as one giant rewrite.

Use this order:

```text
Phase 1  Baseline audit + failing tests for known gaps
Phase 2  Import state machine + rollback/content atomicity
Phase 3  Import content secret scan
Phase 4  Capability/permission model
Phase 5  Stable auth migration
Phase 6  Observability + health/readiness
Phase 7  GitHub resilience/rate-limit semantics
Phase 8  Test/fault-injection expansion + accessibility
Phase 9  CI/supply-chain/release hardening
Phase 10 Documentation, ADRs, final acceptance
```

Each phase must leave the repository buildable and reviewable.

Prefer small coherent commits.

Suggested commit style:

```text
test(import): cover partial upload rollback states
refactor(import): introduce typed import transaction stages
feat(import): publish branch only after complete object write
feat(security): scan archive content before repository mutation
feat(authz): add repository capability service
refactor(auth): migrate production auth to stable dependency
feat(obs): add optional OpenTelemetry spans and metrics
test(e2e): add permission and failure-path acceptance
ci(security): add CodeQL and dependency review
docs(adr): document transaction and auth decisions
```

---

# 17. Agent execution rules

The coding agent MUST follow these rules.

1. Read the existing implementation before editing.
2. Do not rewrite working systems merely to produce more diff.
3. Do not add a framework or dependency when a small existing abstraction is enough.
4. Do not add fake production abstractions that have no caller/test.
5. Every security control must have a regression test.
6. Every new error state must be typed and user-safe.
7. Every dangerous mutation must be authorized server-side.
8. No raw secrets/tokens in logs, telemetry, test snapshots, or UI.
9. Never widen OAuth permissions silently.
10. Never claim atomic rollback if cleanup can leave resources behind; expose `CLEANUP_INCOMPLETE` honestly.
11. Keep expensive operations bounded.
12. Preserve public behavior unless a roadmap item explicitly changes it.
13. Update docs in the same phase as behavior.
14. Run focused tests during development and full acceptance before the final commit.
15. If a requirement is impossible because of GitHub API semantics, do not fake it. Document the exact limitation, implement the safest available semantics, add a test, and explain it to the owner in Russian.
16. Do not mark a checklist item complete without evidence.

---

# 18. Final deliverables

P0 completion must leave these artifacts in the repository:

```text
docs/PERMISSIONS.md
docs/DEBUGGING.md
docs/THREAT_MODEL.md             # may be P1 if explicitly deferred
docs/adr/0001-authentication.md
docs/adr/0002-import-transaction.md
docs/adr/0003-permission-model.md
docs/adr/0004-observability.md
```

And code/tests for:

```text
Import transaction state machine
Import rollback/compensation
Content secret preflight
CapabilityService
Stable production auth
OTel-compatible observability
Liveness/readiness semantics
Fault-injection GitHub mock
Coverage/security/accessibility gates
Release metadata
```

At the end, produce `docs/SENIOR_PLUS_ACCEPTANCE_REPORT.md` containing:

- exact commit SHA;
- implemented phases;
- commands executed;
- test counts/results;
- coverage summary;
- E2E scenarios;
- security checks;
- known limitations;
- deferred P1 work;
- evidence that import rollback, secret scanning, auth, permissions, and observability were tested.

The report must be factual. Do not write “production ready”, “enterprise ready”, or “senior-level” as marketing claims without evidence tied to the acceptance criteria above.
