# Architecture (v3.3)

Один vanilla-JS кодbase, два способа запуска. Next здесь — **хост + тонкий бэкенд**,
не React-переписывание UI (это осознанно: UI проверен, а «настоящий React» дал бы
нулевую пользу при большой цене).

```
src/app/page.jsx              'use client' страница: вставляет markup.js, грузит bundle.js
src/app/layout.jsx            html/head + CSP, reactStrictMode: true
src/app/api/github/[...path]  прокси к api.github.com (сквозные auth/accept/body)
src/app/api/scan              серверный секрет-сканер
src/app/api/health            детект бэкенда фронтом
src/lib/zg/modules/           ИСТОЧНИК ИСТИНЫ: vanilla-модули (util, i18n, api, zip,
                              scanner, ui, monaco, views-*, app) + markup.html + styles.css
src/lib/zg/bundle.js          GENERATED: склейка модулей (node build.mjs)
src/lib/zg/markup.js          GENERATED: разметка как JS-строка
src/lib/scanner.server.js     серверные правила сканера (те же, что клиентские)
build.mjs                     → bundle.js, markup.js, ../index.html (монолит)
```

Поток данных: браузер → (прокси | напрямую) → api.github.com. Токен — только в браузере
(память; опционально AES-GCM в localStorage). Сервер своего токена не хранит, телеметрии нет.

Порядок модулей в бандле — по имени файла (00→20); они classic-scripts с общим scope,
поэтому в Next идут одной склейкой, а редактируются как модули.

Тесты разработки: jsdom-смоуки (boot, все вкладки, tree/editor/preview/ack/never-push,
pre-merge блокеры, visibility, diff, i18n, zip-парсер, тела merge/replace/init).
