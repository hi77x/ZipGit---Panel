# Contributing

Thanks for looking at a raw project.

> Contributions, security reviews, documentation fixes, and small improvements are welcome.

---

## Dev setup

**Requirements:** Node.js 18+

```bash
npm install
npm run dev
```

The UI source of truth is:

```text
src/lib/zg/modules/
```

After you change a module, markup, or CSS, rebuild the generated files:

```bash
node build.mjs
```

This regenerates:

```text
src/lib/zg/bundle.js
src/lib/zg/markup.js
../index.html
```

> **Do not hand-edit the generated files.**

---

## What helps most right now

The most useful contributions at this stage are:

- Token handling and the **Remember / unlock** flow
- **Upload Merge vs Replace** confirmations
- Secret scanner false positives / missed patterns
- Monolith vs Next.js mode drift
- README / i18n / accessibility fixes
- Screenshots of the running UI

---

## Pull requests

Please keep pull requests:

- **Small and reviewable**
- Focused on one change
- Clear about security-sensitive behavior

When relevant, explain the risk around:

- **Token handling**
- **File overwrites**
- **Proxy behavior**

### Code style

Match the existing **vanilla-JS** style in `src/lib/zg/modules/`.

> Do not rewrite the UI in React unless we agree that this is the goal.

### Language

English or Russian in the PR description is fine.

If you change UI copy, keep the corresponding strings in both:

- `en`
- `ru`

---

## Before opening a PR

Please check that:

- The project still builds.
- The generated files have been regenerated with `node build.mjs`.
- No secrets or credentials were added.
- Token-related changes have been reviewed carefully.
- Merge / Replace behavior is still explicit.
- Both language variants are updated when UI text changes.

Thanks for helping improve ZipToGit Pro.
