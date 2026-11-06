import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { apiTokens } from "@/db/schema";
import { randomToken, sha256 } from "./crypto";

const PREFIX = "stash_";
export const MAX_TOKENS_PER_USER = 10;

/** Возвращает токен в открытом виде ровно один раз — в БД остаётся только хэш. */
export async function createApiToken(
  userId: string,
  name: string,
): Promise<{ token: string } | { error: string }> {
  const existing = await db
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId));
  if (existing.length >= MAX_TOKENS_PER_USER) {
    return { error: `Не больше ${MAX_TOKENS_PER_USER} токенов` };
  }

  const token = PREFIX + randomToken(24);
  await db.insert(apiTokens).values({
    userId,
    name,
    prefix: token.slice(0, PREFIX.length + 4),
    tokenHash: sha256(token),
  });
  return { token };
}

export async function findUserIdByToken(raw: string): Promise<string | null> {
  if (!raw.startsWith(PREFIX)) return null;
  const row = await db.query.apiTokens.findFirst({
    where: eq(apiTokens.tokenHash, sha256(raw)),
  });
  if (!row) return null;

  // lastUsedAt обновляем не чаще раза в минуту, чтобы не писать на каждый запрос
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    void db
      .update(apiTokens)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiTokens.id, row.id))
      .catch(() => {});
  }
  return row.userId;
}

export function listApiTokens(userId: string) {
  return db
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      prefix: apiTokens.prefix,
      lastUsedAt: apiTokens.lastUsedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function revokeApiToken(userId: string, id: string): Promise<void> {
  await db.delete(apiTokens).where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId)));
}
