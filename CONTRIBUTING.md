Contributing

Thanks for looking at a raw project.

Dev setup

npm install
npm run dev

The UI source of truth is src/lib/zg/modules/.

After you change a module, markup, or CSS:

node build.mjs

That regenerates:

src/lib/zg/bundle.js

src/lib/zg/markup.js

../index.html

Do not hand-edit the generated files.

What helps most right now

Token handling and the Remember / unlock flow

Upload Merge vs Replace confirmations

Secret scanner false positives / missed patterns

Monolith vs Next.js mode drift

README / i18n / accessibility fixes

Screenshots of the running UI

Pull requests

Keep the diff small and explain the risk (token, overwrite, proxy).

Match the existing vanilla-JS style in modules/. Do not rewrite the UI in React unless we agree that is the goal.

English or Russian in the PR description is fine.

UI strings should stay in both en and ru when you touch copy.
