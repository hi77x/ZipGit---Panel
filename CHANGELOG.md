# Changelog

## 3.3.0 — 2026-09-06
- Финальная структура: в рабочей области только `../index.html` (монолит) и этот проект.
- Бэкенд: same-origin прокси `/api/github/[...path]`, серверный `/api/scan`, `/api/health`;
  фронт автодетектит режим (probe 1.5 s), один код на оба способа запуска.
- CSP разрешает same-origin `/api`; `connect-src 'self'`.

## 3.2.0 — 2026-09-06
Безопасность и честность по итогам внешнего ревью.
- Токен: память по умолчанию; Remember — только AES-GCM (PBKDF2 120k, пароль не хранится),
  unlock-экран, авто-логаут 30 мин, маска `ghp_…xxxx` с показом на 5 с, redact во всех
  сообщениях/коммитах/gists, warning вне localhost, `delete_repo` исключён из рекомендации.
- Сканер: строки и severity в отчёте, действия exclude/mask/include/allowlist-per-repo,
  never-push (.env*, *.pem, id_rsa, credentials/serviceAccount) с явным ack,
  генерация `.env.example`, ссылка на Secret scanning alerts после пуша.
- Upload-мастер: ignore-правила, превью added/overwritten/removed, Replace запрещён без
  превью+ack, пуш по умолчанию в `upload/YYYY-MM-DD` + PR, прямой пуш — с ack,
  отмена пуша и retry батчей, >100 МБ исключаются, >50 МБ — LFS-предупреждение.
- Review: pre-merge правила PR (секреты=blocker, workflows-delete=blocker+ack,
  нет описания/большой diff=warning), review с approve/request changes и line-комментами,
  чеклист ревьюера, risky-паттерны (eval/innerHTML/chmod 777/ключ в URL).
- Удобство: Cmd/Ctrl+K палитра (репо/файлы/действия), dnd zip на карточку репо,
  Ctrl/Cmd+Enter = commit в редакторе, детект конфликтов remote при сохранении,
  rate-limit чип, человечные 401/403/404/secondary, UI-state в sessionStorage (не токен).
- Проект: CSP в монолите и Next-layout, reactStrictMode true, модули в репо (и в Next-проекте),
  gitleaks в CI, честные README/ARCHITECTURE, таблица скоупов.

## 3.1.0 — 2026-09-06
- Отдельная папка `ZipToGit-Next` (структура как у исходного архива).
- Visibility priv↔pub отдельной секцией с подтверждением.
- Issues, Releases+tags, Collaborators, star/watch/fork/clone, languages-bar,
  ahead/behind веток, глобальный поиск по GitHub.

## 3.0.0 — 2026-09-06
- Полный редизайн (спокойный glassmorphism без неона), heatmap как на GitHub, адаптив.
- File tree + Monaco (с фолбэком), PR (create/merge/diff), Actions (dispatch/runs),
  rename/move файлов, i18n EN/RU, модульная исходка + build.mjs + Next-оболочка.

## 2.0.0 — 2026-09-06
- Первый дашборд: overview/repos/files/upload (Merge+Replace)/branches/commits/pages/
  settings/gists/activity; секрет-сканер из v1; собственный ZIP-парсер.

## 1.x — исходный ZipToGit (Next.js wizard)
- ZIP/папка → новый или существующий репо через Git Data API, секрет-сканер, лицензии.
- См. `../ZipToGit_orig/`.
