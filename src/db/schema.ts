import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const users = sqliteTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  /** null — аккаунт создан через OAuth, пароля нет */
  passwordHash: text("password_hash"),
  /** TOTP-секрет, зашифрован AES-256-GCM (см. lib/crypto.ts) */
  totpSecret: text("totp_secret"),
  totpEnabled: integer("totp_enabled", { mode: "boolean" }).notNull().default(false),
  /** номер последнего использованного 30-секундного шага — защита от повтора кода */
  totpLastStep: integer("totp_last_step"),
  /** sha256-хэши неиспользованных recovery-кодов */
  recoveryCodes: text("recovery_codes", { mode: "json" }).$type<string[]>(),
  createdAt: createdAt(),
});

export const accounts = sqliteTable(
  "accounts",
  {
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("accounts_user_idx").on(t.userId),
  ],
);

export const apiTokens = sqliteTable(
  "api_tokens",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** первые символы токена — только для отображения в списке */
    prefix: text("prefix").notNull(),
    /** sha256 токена; сам токен не хранится */
    tokenHash: text("token_hash").notNull().unique(),
    lastUsedAt: integer("last_used_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

export const rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: integer("window_start").notNull(),
});

export const bookmarks = sqliteTable(
  "bookmarks",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    tags: text("tags", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .$defaultFn(() => []),
    favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
    linkStatus: text("link_status", { enum: ["unknown", "ok", "broken"] })
      .notNull()
      .default("unknown"),
    httpStatus: integer("http_status"),
    linkError: text("link_error"),
    linkCheckedAt: integer("link_checked_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("bookmarks_user_created_idx").on(t.userId, t.createdAt),
    uniqueIndex("bookmarks_user_url_uq").on(t.userId, t.url),
  ],
);

export type User = typeof users.$inferSelect;
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;
