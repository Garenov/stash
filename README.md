# Stash

Небольшой full-stack сервис: закладки с тегами, поиском и избранным.

**Стек:** Next.js 15 (App Router) · TypeScript (strict) · Auth.js / NextAuth v5 (Credentials, JWT) · Drizzle ORM · libSQL (локально файл SQLite, в проде Turso) · Zod.

## Запуск

```bash
npm install
cp .env.example .env.local       # задайте AUTH_SECRET из команды ниже
node -p "require('node:crypto').randomBytes(32).toString('hex')"
npm run db:push                 # создаёт таблицы в local.db
npm run dev                     # http://localhost:3000
```

Скопируйте выведенное значение в `AUTH_SECRET` в `.env.local`. Не используйте пустое значение или секрет из примера.

## Turso вместо локального файла

```bash
turso db create stash
turso db show stash --url       # -> DATABASE_URL
turso db tokens create stash    # -> TURSO_AUTH_TOKEN
npm run db:push
```

Код не меняется — переключается только `.env`.

## Структура

```
src/
  auth.ts                  Auth.js: Credentials + bcrypt, JWT-сессия, id в session.user
  db/schema.ts             users, bookmarks (tags — JSON-массив, индекс по user+дата)
  db/index.ts              клиент libSQL + Drizzle
  lib/validation.ts        Zod-схемы (общие для API и форм)
  lib/bookmarks.ts         сервисный слой: все запросы ограничены userId
  lib/users.ts             регистрация, bcrypt(12), защита от гонки по email
  app/actions.ts           server actions: register, login, logout, CRUD закладок
  app/api/bookmarks/…      REST API
  app/{login,register,dashboard}
```

## REST API

Нужна сессия (cookie после входа через UI). Ответы JSON.

| Метод | Путь | Описание |
|---|---|---|
| GET | `/api/bookmarks?q=&tag=&favorite=1` | список с фильтрами |
| POST | `/api/bookmarks` | `{ url, title, description?, tags? }` → 201 |
| PATCH | `/api/bookmarks/:id` | частичное обновление, в т.ч. `favorite` |
| DELETE | `/api/bookmarks/:id` | 204 |

Ошибки: `400` (с полями), `401`, `404`. Чужие закладки возвращают `404`.

## Деплой

Vercel + Turso: задайте `DATABASE_URL`, `TURSO_AUTH_TOKEN`, `AUTH_SECRET` в переменных окружения.

## Что дальше

Rate-limit на вход и регистрацию, OAuth-провайдер (GitHub) рядом с Credentials, импорт закладок из браузера, тесты (Vitest + in-memory libSQL).
