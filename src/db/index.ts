import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// В dev переиспользуем клиент между hot-reload'ами.
const globalForDb = globalThis as unknown as { libsql?: Client };

export const client =
  globalForDb.libsql ??
  createClient({
    url: process.env.DATABASE_URL ?? "file:local.db",
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.libsql = client;

export const db = drizzle(client, { schema });
