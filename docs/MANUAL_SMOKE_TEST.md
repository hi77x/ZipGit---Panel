# Manual GitHub smoke test

Use a dedicated GitHub account or organization and disposable repository names.

## OAuth and session

1. Open `/dashboard` without a cookie and confirm redirect to the landing page.
2. Sign in through the configured OAuth App and confirm the dashboard shows the real login.
3. Inspect page source, React props, local/session storage, and network responses; no access token may appear.
4. Revoke the OAuth authorization on GitHub and confirm the next request presents reconnect state.
5. Sign out and confirm the session cookie is removed.

## Import

1. Import a ZIP containing text, binary, executable, and empty files under one root folder.
2. Confirm one parentless commit, correct bytes/modes, default branch, and reported exclusions.
3. Confirm archives containing `../evil`, an absolute path, a symlink, encrypted entry, case collision, `.env.production`, or private key fail before repository creation.
4. Confirm a duplicate repository name is shown on the name field.
5. Interrupt a post-creation GitHub operation and confirm the partial repository is retained and linked.

## Repository tools

1. Open a repository with and without README; verify both states and relative links/images.
2. Verify GFM table, task list, code block, Cyrillic, and malicious HTML behavior.
3. Compare Activity actors/timestamps against GitHub.
4. Exercise Pages disabled, branch/workflow configuration, deployed, and failed states.
5. Dispatch a workflow, observe queued → in progress → completed polling, then test eligible cancel/re-run actions.

## Browser and layout

Check 1440×900, 1024×768, 768×1024, 390×844, and 360×800. Confirm no document-level horizontal scroll, local table/code scrolling, mobile focus trapping, Escape/backdrop close, visible focus, 200% zoom, styled scrollbar, and no CSP console violations.
