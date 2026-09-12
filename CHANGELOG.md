# Changelog

## 5.1.0

Senior+ hardening release. No visual redesign; the product now behaves predictably under failure.

- **Transactional import**: typed state machine, stable `operationId`, late branch publication, cancellation of queued blob writes, and honest `failed` / `compensated` / `cleanup_incomplete` outcomes with safe remediation. Optional repository cleanup stays behind `REPODECK_ALLOW_REPOSITORY_CLEANUP` (ADR 0002).
- **Content-level secret scanning before mutation**: the shared secret engine now scans archive text content with file and byte budgets, blocks critical/high findings and unscannable credential files, masks every finding, and surfaces truncated scans instead of reporting "clean". Raw matches are removed from the audit API too.
- **Server-side capability model**: one resolver maps GitHub permissions to roles and capabilities; every mutation service enforces it before contacting GitHub; unknown and archived states deny; UI hints follow the same model (`docs/PERMISSIONS.md`, ADR 0003).
- **Auth boundary hardening**: explicit HttpOnly/SameSite/Secure cookies, 30-day JWT lifetime, redirect allowlist, exported config with regression tests, and ADR 0001 documenting the pinned Auth.js beta and migration plan.
- **Observability**: documented log schema with redaction and truncation; optional OpenTelemetry traces/metrics via OTLP; per-request metrics; split liveness/readiness health endpoints with version and commit metadata (`docs/DEBUGGING.md`, ADR 0004).
- **GitHub resilience**: retry classes with bounded jitter, `Retry-After` support, no retries for mutations, distinct schema-mismatch signal, abort propagation, and request cancellation (ADR 0005).
- **Testing**: fault-injection GitHub server, 15 import atomicity scenarios, retry/abort tests, capability matrix and enforcement tests, auth boundary tests, log/telemetry redaction tests, coverage thresholds for critical modules, and Playwright + axe accessibility scans.
- **CI, supply chain, and releases**: SHA-pinned GitHub Actions, CodeQL, dependency review, `npm audit` gate, Dependabot, and a tag-driven release workflow with GHCR images, semver/sha tags, SBOM, and GitHub releases.
- **Contributor experience**: rewritten CONTRIBUTING with a first-contribution path, PR and issue templates, CODEOWNERS, and `npm run check:full`.
- **Threat model**: `docs/THREAT_MODEL.md` with assets, boundaries, mitigations, and accepted limitations.

## 5.0.0

- Rebranded ZipToGit Pro as **RepoDeck**, a full self-hosted command deck for GitHub.
- New black/white design system: glass sidebars, layered shadows, motion, dark/light/system themes, and a command palette on `Cmd/Ctrl+K`.
- Added an interactive **code explorer**: recursive file tree, self-written syntax highlighting, file editing, creation, and deletion as real GitHub commits, plus branch management.
- Added **commits and compare**: history grouped by day, commit detail pages, and review-grade unified diffs with path filtering, lazy large patches, and persisted viewed state.
- Added **Repo Radar**: weighted 14-check health score, 27-rule secret scanner with entropy scoring and remediation, language composition, contributor map, 12-month commit heatmap, and dependency inventory.
- Added **issues** and **pull requests**: triage, create, comment, close/reopen, reviews (comment/approve/request changes), files changed, and merge (merge/squash/rebase) with branch cleanup.
- Added **releases**, **notification inbox**, **global search** (repositories, code, issues), and **starred repositories**.
- Added a **mission-control dashboard** with repository metrics, language mix, and quick tools.
- Added a live GitHub API budget meter and request telemetry in the app shell.
- Added self-written engines with unit tests: unified diff parser, syntax tokenizer, secret rules, health scoring, manifest detection, and fuzzy search.
- Added universal local deployment: `start.ps1` / `start.sh` launchers, `npm run doctor`, `npm run setup`, multi-stage standalone Docker image, and Compose service with a `/tmp` volume.
- Hardened the OAuth scope with `notifications`, added the CSP request header for nonce propagation, and kept all mutations behind the BFF.
- Relaxed the Node engine floor to 20.17 with a pinned CJS-compatible `htmlparser2` override so local Windows setups run out of the box.

## 4.0.0

- Rebuilt the static JavaScript monolith as a strict TypeScript Next.js 16 application.
- Replaced browser PAT entry/storage with GitHub OAuth and server-only Auth.js JWT access.
- Removed the arbitrary GitHub proxy and introduced allowlisted BFF routes plus one typed GitHub client.
- Added safe streaming ZIP upload, lazy preflight, secret/path policies, and one-root-commit Git Data import.
- Added real repository discovery, README, activity, Pages, and Actions surfaces.
- Added contextual 404/409/422 mapping, empty 204 handling, request IDs, rate-limit metadata, and safe partial-import results.
- Added nonce CSP, security headers, responsive navigation, accessible feature states, tests, and production documentation.
