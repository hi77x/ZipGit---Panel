# Changelog

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
