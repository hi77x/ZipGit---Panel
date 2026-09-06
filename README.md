# ZipToGit Pro v3.3 — финальная версия

Панель управления GitHub. Два способа запуска из одного кода:

| Способ | Команды | Бэкенд |
|---|---|---|
| **Next.js (этот проект)** | `npm install && npm run dev` (Node ≥ 18) → http://localhost:3000 | ✅ same-origin прокси `/api/github/*`, `/api/scan`, `/api/health` |
| **Монолит** | открыть `../index.html` (или `python3 -m http.server`) | ❌ браузер ходит в api.github.com напрямую |

Фронт сам детектирует бэкенд (`GET /api/health`, 1.5 s таймаут) и переключает
`gh()` на прокси — один код, два режима. Токен пользователя в обоих случаях остаётся
в браузере и передаётся per-request в `Authorization`; сервер своего токена не держит.

## Бэкенд

- `src/app/api/github/[...path]/route.js` — catch-all прокси к api.github.com
  (метод, body, accept, auth — сквозные; наружу — status + content-type + rate-заголовки).
- `src/app/api/scan/route.js` — серверный секрет-сканер (`src/lib/scanner.server.js`,
  те же правила, что и клиентские).
- `src/app/api/health/route.js` — детект режима + версия.

## Фронтенд

Vanilla-JS модули в `src/lib/zg/modules/*` (источник истины), склеиваются `node build.mjs`
в `src/lib/zg/bundle.js` (для Next-страницы) и `../index.html` (монолит).
Разметка — `modules/markup.html`, стили — `modules/styles.css`.

Возможности (v3.3): дашборд с heatmap; репо (create/rename/delete/visibility/topics/
collaborators); file tree + Monaco (с фолбэком) + rename/move + конфликты remote;
upload-мастер (ZIP/папка, ignore-правила, превью added/overwritten/removed, Merge/Replace
с ack, дефолт `upload/YYYY-MM-DD` + PR, cancel/retry, LFS-предупреждения); секрет-сканер
(строки, never-push, mask, .env.example, allowlist per-repo, ссылка на alerts);
branches (+ahead/behind, merge); PR (create/merge с pre-merge правилами, review с
line-комментами и чеклистом); issues; commits + diff; releases + tags; actions
(dispatch/runs); pages; gists; activity; глобальный поиск; Cmd/Ctrl+K; i18n EN/RU;
адаптив; rate-чип; человечные ошибки.

## Безопасность

- Токен: память вкладки по умолчанию; Remember — AES-GCM (PBKDF2 120k из пароля),
  unlock-экран, idle-logout 30 мин, маска с показом на 5 с, redact везде.
- CSP в монолите и в `layout.jsx`; `reactStrictMode: true`; gitleaks в CI
  (`.github/workflows/secret-scan.yml`); зависимости пиннованы + lockfile; без телеметрии.

## Честные ограничения

Не git (нет clone/pull/rebase); rate limits GitHub; файлы >100 МБ не проходят
(совет — LFS); нет OAuth device flow (нужен OAuth App + сервер с клиент-секретом);
Monaco с CDN (без сети — фолбэк). Полная история — в CHANGELOG.md, устройство — в ARCHITECTURE.md.

MIT.
