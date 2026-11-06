import { defineConfig } from "drizzle-kit";

// Локально: file:local.db. Продакшен: libsql://<db>.turso.io + TURSO_AUTH_TOKEN.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
