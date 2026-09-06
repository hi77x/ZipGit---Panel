# ZipToGit Pro

**Early public release · v3.3**

> A self-hosted GitHub control panel for managing repositories, editing files, opening pull requests, and uploading a ZIP or folder through the GitHub API — **no `git` CLI required**.

![License](https://img.shields.io/github/license/hi77x/ZipGit---Panel)
![GitHub release]([https://img.shields.io/github/v/release/hi77x/ZipGit---Panel](https://github.com/hi77x/ZipGit---Panel/releases/tag/v3.3.0))
![GitHub stars](https://img.shields.io/github/stars/hi77x/ZipGit---Panel?style=flat)
![GitHub issues](https://img.shields.io/github/issues/hi77x/ZipGit---Panel)

This project is intentionally raw. The code is public so other people can read it, run it locally, and review how tokens and uploads are handled.

**[Features](#features)** · **[Quick start](#quick-start)** · **[Security](#security)** · **[Limitations](#honest-limitations)** · **[Contributing](#contributing)**

---

## Why this exists

GitHub's website is fine. This tool is for the cases where you want a local panel that can:

- **Push a ZIP or folder** into a new or existing repository without installing Git.
- **Scan for secrets** before anything is committed.
- **Edit files**, open PRs, and look at Actions, issues, and releases from one screen.

It is **not a Git client**. There is no clone, pull, rebase, or local history.

---

## Quick start

**Requirements:** Node.js 18+

```bash
git clone https://github.com/hi77x/ZipGit---Panel.git
cd ZipGit---Panel
npm install
npm run dev
```

Open **http://localhost:3000**.

Paste a GitHub token into the UI. The token stays in the browser and is sent as an `Authorization` header on each request. The server never stores its own token.

---

## Two launch modes, one codebase

| Mode | How to run | Backend |
|---|---|---|
| **Next.js (this repo)** | `npm install && npm run dev` → `http://localhost:3000` | Same-origin proxy: `/api/github/*`, `/api/scan`, `/api/health` |
| **Monolith** | Run `node build.mjs`, then open the generated `../index.html` or serve it with `python3 -m http.server` | Browser talks directly to `api.github.com` |

The UI probes `GET /api/health` with a **1.5-second timeout**.

If the proxy is up, `gh()` switches to it. If not, it uses the GitHub API directly.

---

## Token scopes

Use a **classic PAT** or a **fine-grained token** with the smallest set that matches what you actually click.

| Scope | Needed for |
|---|---|
| `repo` | Private repos, files, branches, PRs, issues, releases, collaborators, Pages |
| `workflow` | Dispatching Actions / pushing workflow files |
| `gist` | Gists |
| `delete_repo` | **Do not add this.** Repo delete is supported in the UI but should stay off the token |

Create the token at [GitHub → Settings → Developer settings → Personal access tokens](https://github.com/settings/tokens).

---

## Features

### Dashboard

- Contribution-style heatmap
- Activity overview
- Rate-limit information

### Repositories

- Create repositories
- Rename repositories
- Delete repositories
- Change visibility
- Manage topics
- Manage collaborators

### Files & editor

- File tree
- Monaco editor
- CDN loading with a fallback editor
- Rename / move files
- Remote conflict detection

### Upload wizard

- ZIP or folder upload
- Ignore rules
- Preview of:
  - Added files
  - Overwritten files
  - Removed files
- **Merge** or **Replace** modes
- Explicit acknowledgement for destructive operations
- Default branch `upload/YYYY-MM-DD` + PR workflow
- Cancel / retry
- Git LFS warnings

### Secret scanner

- Findings with severity
- Never-push rules
- Secret masking
- `.env.example`
- Per-repo allowlist
- Links to GitHub secret-scanning alerts

### GitHub workflow

- Branches with ahead / behind information
- Branch merge
- Pull requests
  - Create
  - Merge
  - Pre-merge rules
  - Review
  - Line comments
  - Checklist
- Issues
- Commits + diffs
- Releases + tags
- Actions
  - Dispatch
  - Runs
- Pages
- Gists
- Activity
- Global search
- `Cmd/Ctrl + K` command palette

### UI

- English and Russian
- Responsive layout
- Rate-limit chip
- Readable API errors

---

## How the code is split

Edit modules, then rebuild the generated files:

```bash
node build.mjs
```

| Path | Role |
|---|---|
| `src/lib/zg/modules/*` | **Source of truth** — vanilla JS + `markup.html` + `styles.css` |
| `src/lib/zg/bundle.js` | Generated bundle for the Next.js page |
| `src/lib/zg/markup.js` | Generated markup string |
| `../index.html` | Generated monolith written outside this repo by `build.mjs` |
| `src/app/api/github/[...path]/route.js` | Catch-all proxy to `api.github.com` |
| `src/app/api/scan/route.js` | Server-side secret scanner |
| `src/app/api/health/route.js` | Mode detection + version |

The GitHub proxy passes through the request method, body, `Accept`, and authorization.

The server-side scanner uses `src/lib/scanner.server.js` with the same rules as the client.

Longer write-up: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

History: [`CHANGELOG.md`](./CHANGELOG.md)

---

## Security

Read [`SECURITY.md`](./SECURITY.md) before using this with a real token.

### Short version

- **Default:** token lives in tab memory only.
- **Remember:** AES-GCM encryption in `localStorage`.
- Encryption key is derived from your password using **PBKDF2 with 120,000 iterations**.
- The password is **not stored**.
- Unlock screen.
- **30-minute idle logout**.
- Masked token (`ghp_…xxxx`) with a five-second reveal.
- Token values are redacted in UI messages, commits, and gists.
- Warning when the app is not on localhost.
- CSP in the monolith and `src/app/layout.jsx`.
- `reactStrictMode: true`.
- Gitleaks in CI: `.github/workflows/secret-scan.yml`.
- Dependencies pinned via the lockfile.
- **No telemetry.**

> **Do not deploy this as a public multi-user service.**
>
> ZipToGit Pro is a local / self-hosted tool intended for use with your own token.

---

## Honest limitations

- **Not Git:** no clone, pull, fetch, rebase, or submodule workflow.
- GitHub API rate limits apply.
- Files over **100 MB** cannot be pushed this way; use Git LFS.
- No OAuth device flow. That would require an OAuth App and a server holding a client secret.
- Monaco loads from a CDN; offline you get the fallback editor.
- The generated monolith file is written to `../index.html`, not into this repository.

---

## Status

**Public · MIT-licensed · still rough**

Core local flows work. Expect sharp edges, missing tests in-repo, and UI that will change.

If you review the project, the useful questions are:

1. Can the token leak from the **Remember / unlock** path?
2. Can the upload wizard overwrite a repo without a clear acknowledgement?
3. Does the proxy forward anything it should not?

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Issues and PRs are welcome.

> Small, reviewable changes beat large rewrites.

---

## License

**MIT © 2026 CJ**

See [`LICENSE`](./LICENSE).
