# ZipToGit Pro

**Early public release (v3.3).**

ZipToGit Pro is a self-hosted GitHub control panel for managing repositories, editing files, opening pull requests, and uploading ZIP archives or folders through the GitHub API — **without the `git` CLI**.

This project is intentionally raw. The code is public so other people can read it, run it locally, and review how tokens and uploads are handled.

**[Features](#features) · [Quick start](#quick-start) · [Security](#security) · [Limitations](#honest-limitations) · [Contributing](#contributing)**

---

## Why this exists

GitHub's website is fine. This tool is for cases where you want a local control panel that can:

* Push a ZIP archive or folder into a new or existing repository without installing Git.
* Scan files for secrets before anything is committed.
* Edit files and open pull requests.
* View Actions, issues, releases, branches, and other repository information from one screen.

It is **not a Git client**. There is no clone, pull, rebase, or local Git history.

---

## Quick start

**Requirements:** Node.js 18+

```bash
git clone https://github.com/hi77x/ZipGit---Panel.git
cd ZipGit---Panel
npm install
npm run dev
```

Open http://localhost:3000.

Paste a GitHub token into the UI. The token stays in the browser and is sent as an `Authorization` header on each request. The server never stores its own GitHub token.

---

## Two launch modes, one codebase

| Mode                    | How to run                                                                                              | Backend                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Next.js (this repo)** | `npm install && npm run dev` → http://localhost:3000                                                    | Same-origin proxy: `/api/github/*`, `/api/scan`, `/api/health` |
| **Monolith**            | Run `node build.mjs`, then open the generated `../index.html` or serve it with `python3 -m http.server` | Browser talks directly to `api.github.com`                     |

The UI probes `GET /api/health` with a 1.5-second timeout.

If the proxy is available, `gh()` switches to it. Otherwise, the application communicates directly with the GitHub API.

---

## Token scopes

Use either a **classic PAT** or a **fine-grained token** with the smallest permissions that match the features you actually use.

| Scope         | Needed for                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `repo`        | Private repositories, files, branches, pull requests, issues, releases, collaborators, Pages                              |
| `workflow`    | Dispatching GitHub Actions and pushing workflow files                                                                     |
| `gist`        | Gists                                                                                                                     |
| `delete_repo` | **Do not add this.** Repository deletion is supported in the UI, but this permission should remain disabled on the token. |

Create a token through [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens).

---

## Features

**Version 3.3**

* Dashboard with contribution-style heatmap.
* Repositories:

  * Create
  * Rename
  * Delete
  * Change visibility
  * Manage topics
  * Manage collaborators
* File tree with Monaco editor.
* Monaco CDN loading with a fallback editor.
* Rename and move files.
* Remote conflict detection.
* Upload wizard:

  * ZIP or folder uploads
  * Ignore rules
  * Preview of added, overwritten, and removed files
  * Merge or Replace modes
  * Explicit acknowledgement before destructive operations
  * Default branch `upload/YYYY-MM-DD` workflow
  * Pull request creation
  * Cancel and retry
  * Git LFS warnings
* Secret scanner:

  * Findings with severity
  * Never-push rules
  * Secret masking
  * `.env.example` suggestions
  * Per-repository allowlist
  * Links to GitHub secret-scanning alerts
* Branch management:

  * Ahead/behind status
  * Merge
* Pull requests:

  * Create
  * Review
  * Merge
  * Pre-merge rules
  * Line comments
  * Review checklist
* Issues.
* Commits and diffs.
* Releases and tags.
* GitHub Actions:

  * Dispatch workflows
  * View workflow runs
* GitHub Pages.
* Gists.
* Activity.
* Global search.
* `Cmd/Ctrl + K` command palette.
* English and Russian UI.
* Responsive layout.
* GitHub rate-limit indicator.
* Readable API errors.

---

## How the code is split

Edit the modules first, then rebuild the generated files:

```bash
node build.mjs
```

| Path                                    | Role                                                                                          |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| `src/lib/zg/modules/*`                  | Source of truth: vanilla JS, `markup.html`, and `styles.css`                                  |
| `src/lib/zg/bundle.js`                  | Generated bundle used by the Next.js page                                                     |
| `src/lib/zg/markup.js`                  | Generated markup string                                                                       |
| `../index.html`                         | Generated monolith written outside this repository by `build.mjs`                             |
| `src/app/api/github/[...path]/route.js` | Catch-all proxy to `api.github.com`; forwards method, body, `Accept`, and authorization       |
| `src/app/api/scan/route.js`             | Server-side secret scanner using `src/lib/scanner.server.js` and the same rules as the client |
| `src/app/api/health/route.js`           | Mode detection and version endpoint                                                           |

For more details, see:

* [`ARCHITECTURE.md`](./ARCHITECTURE.md) — architecture overview
* [`CHANGELOG.md`](./CHANGELOG.md) — project history

---

## Security

Read [`SECURITY.md`](./SECURITY.md) before using ZipToGit Pro with a real GitHub token.

### Short version

* By default, the token lives only in browser tab memory.
* Optional **Remember** mode stores the token encrypted with AES-GCM in `localStorage`.
* The encryption key is derived from your password using PBKDF2 with **120,000 iterations**.
* The password itself is never stored.
* Unlock screen protects the remembered token.
* Automatic logout after 30 minutes of inactivity.
* Tokens are masked as `ghp_…xxxx` with a five-second reveal window.
* Token values are redacted from UI messages, commits, and gists.
* The application warns when it is not running on localhost.
* CSP is configured in both the monolith and `src/app/layout.jsx`.
* `reactStrictMode: true`.
* Gitleaks runs in CI through `.github/workflows/secret-scan.yml`.
* Dependencies are pinned through the lockfile.
* No telemetry.

> **Important:** Do not deploy ZipToGit Pro as a public multi-user service. It is designed as a local/self-hosted tool for your own GitHub token.

---

## Honest limitations

* **Not Git:** no clone, pull, fetch, rebase, or submodule workflow.
* GitHub API rate limits still apply.
* Files larger than 100 MB cannot be pushed through this workflow; use Git LFS instead.
* No OAuth device flow. Implementing it would require an OAuth App and a server-side client secret.
* Monaco loads from a CDN. Offline usage falls back to the built-in editor.
* The generated monolith file is written to `../index.html`, not into this repository.
* The project is still early and does not yet have comprehensive in-repository tests.

---

## What to review

If you are reviewing the project, these are the most useful questions:

1. Can the token leak through the **Remember / unlock** flow?
2. Can the upload wizard overwrite repository contents without a clear acknowledgement?
3. Does the GitHub proxy forward anything it should not?

Security issues involving live user tokens should **not** be publicly disclosed. See [`SECURITY.md`](./SECURITY.md) for the reporting process.

---

## Status

**Public, MIT-licensed, and still rough.**

The core local workflows work, but expect sharp edges, missing tests, and UI changes as the project evolves.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Issues and pull requests are welcome.

Small, reviewable changes are preferred over large rewrites.

---

## License

MIT © 2026 CJ

See [`LICENSE`](./LICENSE) for the full license text.
