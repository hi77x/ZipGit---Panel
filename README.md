# ZipToGit Pro

**Early public release (v3.3).** A self-hosted GitHub control panel: manage repos, edit files, open PRs, and upload a ZIP or folder through the GitHub API — no `git` CLI.

This is raw on purpose. The code is public so other people can read it, run it locally, and review how tokens and uploads are handled.

[Features](#features) · [Quick start](#quick-start) · [Security](#security) · [Limitations](#honest-limitations) · [Contributing](#contributing)

---

## Why this exists

GitHub’s website is fine. This tool is for the cases where you want a local panel that can:

- push a ZIP or a folder into a new or existing repo without installing git
- scan for secrets before anything is committed
- edit files, open PRs, and look at actions/issues/releases from one screen

It is **not** a git client. There is no clone, pull, rebase, or local history.

---

## Quick start

**Requirements:** Node.js 18+

```bash
git clone https://github.com/hi77x/ZipGit---Panel.git
cd ZipGit---Panel
npm install
npm run dev
