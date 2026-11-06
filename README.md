# Stash

Закладки с тегами, поиском, импортом, проверкой ссылок, API-токенами и безопасным входом.

**Стек:** Next.js 15 (App Router) · TypeScript (strict) · Auth.js v5 · Drizzle ORM · libSQL (локально файл SQLite, в проде Turso) · Zod · otpauth/qrcode (2FA).

## Запуск

```bash
npm install
cp .env.example .env        # Windows: Copy-Item .env.example .env
npm run db:push             # создаёт/обновляет таблицы
npm run dev                 # http://localhost:3000
```

`AUTH_SECRET` в `.env` — случайная строка:
`node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.

> **Обновление с прошлой версии.** `db:push` меняет таблицы (пароль становится необязательным, добавляются поля 2FA и статуса ссылок, уникальность URL). Если он ругается на существующие данные, а они тестовые, удалите `local.db` и запустите `db:push` заново.

## Возможности

| | |
|---|---|
| **Закладки** | добавление, редактирование, избранное, удаление, теги `#так`, пагинация, защита от дублей (уникальный URL на пользователя) |
| **Поиск** | полнотекстовый (SQLite FTS5) по названию, описанию, ссылке и тегам, префиксный: `доке` найдёт «Docker». `#тег` в строке поиска фильтрует по тегу: `react hooks #db #статьи` |
| **Импорт** | HTML-экспорт Chrome / Firefox / Safari и JSON. Папки браузера превращаются в теги, дубли пропускаются |
| **Экспорт** | JSON и HTML (читается браузерами) |
| **Проверка ссылок** | кнопка на дашборде + ежедневный cron. Битые помечаются, есть фильтр «Битые ссылки». 401/403/429 считаются «живыми» (сайт просто не пускает ботов) |
| **Bookmarklet** | кнопка для панели закладок: открывает окно сохранения с заполненными адресом и названием (Настройки) |
| **API-токены** | `Authorization: Bearer stash_…`, хранится только хэш, показывается один раз, до 10 штук |
| **Вход** | email + пароль, GitHub, Google, Discord |
| **2FA** | TOTP (любое приложение-аутентификатор) + 8 одноразовых recovery-кодов |
| **Защита от ботов** | Cloudflare Turnstile, honeypot-поле, rate-limit в БД |

## OAuth (GitHub, Google, Discord)

Кнопка появляется, только когда заданы оба значения провайдера. Callback URL у каждого: `<домен>/api/auth/callback/<github|google|discord>` (локально `http://localhost:3000/api/auth/callback/github`).

- GitHub: Settings → Developer settings → OAuth Apps → `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`
- Google: Cloud Console → APIs & Services → Credentials → OAuth client (Web) → `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`
- Discord: Developer Portal → Applications → OAuth2 → `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`

**Правила привязки аккаунтов.** Вход через провайдера требует подтверждённого email у провайдера. Если этот email уже занят аккаунтом **с паролем**, автоматической привязки нет — войдите паролем. Иначе можно было бы заранее зарегистрировать чужой email со своим паролем и получить доступ к аккаунту жертвы после её входа через Google. Для аккаунтов, созданных через провайдера, 2FA Stash не нужна: ею управляет провайдер.

## Защита входа и ботов

- Вход по паролю целиком проходит в server action: rate-limit (10 попыток на пару IP+email и 50 на IP за 15 минут), Turnstile, проверка пароля, затем второй фактор. После этого action выдаёт подписанный proof на 60 секунд, и только его принимает Credentials-провайдер. Прямой POST на `/api/auth/callback/credentials` ничего не даёт без подписи.
- Код 2FA: 5 попыток за 10 минут на аккаунт, один и тот же TOTP-код дважды не принимается. Секрет шифруется AES-256-GCM (ключ выводится из `AUTH_SECRET`), recovery-коды хранятся хэшами.
- Регистрация: 5 в час с одного IP + Turnstile + honeypot.
- API: 240 запросов в минуту на пользователя, перебор токенов ограничивается по IP.
- Turnstile включается, когда заданы `NEXT_PUBLIC_TURNSTILE_SITE_KEY` и `TURNSTILE_SECRET_KEY` (ключи бесплатные, dash.cloudflare.com → Turnstile). Для локальной проверки есть тестовые ключи, они указаны в `.env.example`.
- Rate-limit берёт IP из `X-Forwarded-For`. Это корректно за Vercel/Cloudflare; на голом сервере без прокси заголовок подделывается.
- **Смена `AUTH_SECRET` ломает уже настроенную 2FA** (не расшифровать секреты) и инвалидирует токены.

## Проверка ссылок и SSRF

Запросы идут с сервера, поэтому проверяющий код не ходит на приватные адреса (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7 и т. д.), каждый редирект проверяется заново, лимит 5 переходов и 8 секунд. Остаточный риск: между проверкой DNS и самим запросом возможен DNS rebinding.

Фоновая проверка: `vercel.json` запускает `/api/cron/check-links` раз в сутки. Задайте `CRON_SECRET` (Vercel передаёт его как Bearer).

## REST API

Cookie-сессия или `Authorization: Bearer stash_…`. Ответы JSON.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/bookmarks?q=&tag=&favorite=1&broken=1&page=1&limit=20` | список; в `q` слова ищутся полнотекстово, `#теги` фильтруют |
| POST | `/api/bookmarks` | `{ url, title, description?, tags? }` → 201, 409 если ссылка уже есть |
| PATCH | `/api/bookmarks/:id` | частичное обновление, в т. ч. `favorite` |
| DELETE | `/api/bookmarks/:id` | 204 |
| POST | `/api/bookmarks/check` | проверить до 25 устаревших ссылок → `{ checked, broken }` |
| POST | `/api/import` | multipart, поле `file` (.html или .json) → `{ total, added, skipped }` |
| GET | `/api/export?format=json\|html` | скачать все закладки |

Ошибки: `400` (с полями), `401`, `404`, `409`, `413`, `429`. Чужие закладки возвращают `404`.

## Структура

```
src/
  auth.ts                 Auth.js: OAuth-провайдеры, Credentials по подписанному proof
  db/schema.ts            users, accounts, api_tokens, rate_limits, bookmarks
  lib/
    bookmarks.ts          запросы (все с userId), FTS с запасным LIKE, импорт пачками
    fts.ts, search.ts     FTS5 (виртуальная таблица + триггеры), разбор «слова и #теги»
    totp.ts, crypto.ts    2FA, recovery-коды, подпись токенов, AES-GCM
    rate-limit.ts         атомарный upsert-счётчик в БД (работает на serverless)
    turnstile.ts          серверная проверка капчи
    link-check.ts, safe-fetch.ts   проверка ссылок, защита от SSRF
    import-export.ts      Netscape HTML и JSON
    tokens.ts, http.ts    API-токены, единая аутентификация API
  app/
    actions.ts            вход, регистрация, CRUD закладок
    settings/             2FA, токены, bookmarklet, импорт/экспорт
    save/                 окно bookmarklet
    api/…                 REST + cron
```

FTS5-индекс создаётся автоматически при первом поиске (`drizzle-kit` виртуальные таблицы не ведёт). Если индекс разошёлся с таблицей, он пересобирается сам; при любой ошибке поиск откатывается на обычный `LIKE`.

## Деплой

Vercel + Turso: задайте `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET`, `CRON_SECRET`, при желании OAuth и Turnstile; выполните `npm run db:push` один раз против Turso.

## Что дальше

Подтверждение email и сброс пароля, привязка провайдера к уже существующему аккаунту из настроек, WebAuthn/passkeys, автозаполнение названия по URL, тесты (Vitest + in-memory libSQL).
