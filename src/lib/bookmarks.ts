import { and, desc, eq, like, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, type Bookmark, type NewBookmark } from "@/db/schema";
import { isUniqueViolation } from "./db-errors";
import { ensureFts } from "./fts";
import { ftsQuery, parseSearch } from "./search";
import {
  normalizeTag,
  type BookmarkInput,
  type BookmarkPatch,
  type ListQuery,
} from "./validation";

export class DuplicateBookmarkError extends Error {
  constructor() {
    super("Bookmark with this URL already exists");
  }
}

/** Все запросы жёстко ограничены userId — чужие закладки недоступны. */

type Filters = Partial<Pick<ListQuery, "q" | "tag" | "favorite" | "broken" | "page" | "limit">>;

function buildWhere(userId: string, f: Filters, mode: "fts" | "like"): SQL {
  const conds: SQL[] = [eq(bookmarks.userId, userId)];
  if (f.favorite) conds.push(eq(bookmarks.favorite, true));
  if (f.broken) conds.push(eq(bookmarks.linkStatus, "broken"));

  const { words, tags } = parseSearch(f.q ?? "");
  if (f.tag) tags.push(normalizeTag(f.tag));

  for (const tag of new Set(tags.filter(Boolean))) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM json_each(${bookmarks.tags}) WHERE value = ${tag})`,
    );
  }

  if (words.length > 0) {
    if (mode === "fts") {
      conds.push(
        sql`"bookmarks"."rowid" IN (SELECT rowid FROM bookmarks_fts WHERE bookmarks_fts MATCH ${ftsQuery(words)})`,
      );
    } else {
      for (const w of words) {
        const p = `%${w}%`;
        conds.push(
          or(
            like(bookmarks.title, p),
            like(bookmarks.url, p),
            like(bookmarks.description, p),
            like(bookmarks.tags, p),
          )!,
        );
      }
    }
  }
  return and(...conds)!;
}

export async function listBookmarks(
  userId: string,
  f: Filters = {},
): Promise<{ items: Bookmark[]; total: number }> {
  const size = f.limit ?? 20;
  const page = Math.max(1, f.page ?? 1);

  const run = async (mode: "fts" | "like") => {
    const where = buildWhere(userId, f, mode);
    const [items, counted] = await Promise.all([
      db
        .select()
        .from(bookmarks)
        .where(where)
        .orderBy(desc(bookmarks.createdAt))
        .limit(size)
        .offset((page - 1) * size),
      db.select({ n: sql<number>`count(*)` }).from(bookmarks).where(where),
    ]);
    return { items, total: Number(counted[0]?.n ?? 0) };
  };

  if (parseSearch(f.q ?? "").words.length > 0) {
    try {
      await ensureFts();
      return await run("fts");
    } catch {
      return run("like"); // FTS недоступен — обычный поиск по подстроке
    }
  }
  return run("like");
}

export async function createBookmark(userId: string, input: BookmarkInput): Promise<Bookmark> {
  const [row] = await db
    .insert(bookmarks)
    .values({
      userId,
      url: input.url,
      title: input.title,
      description: input.description || null,
      tags: input.tags,
    })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new DuplicateBookmarkError();
  return row;
}

export async function updateBookmark(
  userId: string,
  id: string,
  patch: BookmarkPatch,
): Promise<Bookmark | undefined> {
  if (Object.keys(patch).length === 0) {
    return db.query.bookmarks.findFirst({
      where: and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)),
    });
  }

  const set: Partial<NewBookmark> = { ...patch };
  if (patch.description !== undefined) set.description = patch.description || null;
  if (patch.url !== undefined) {
    // ссылка изменилась — прежний результат проверки больше не актуален
    Object.assign(set, {
      linkStatus: "unknown",
      httpStatus: null,
      linkError: null,
      linkCheckedAt: null,
    });
  }

  try {
    const [row] = await db
      .update(bookmarks)
      .set(set)
      .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
      .returning();
    return row;
  } catch (e) {
    if (isUniqueViolation(e)) throw new DuplicateBookmarkError();
    throw e;
  }
}

export async function toggleFavorite(userId: string, id: string): Promise<void> {
  await db
    .update(bookmarks)
    .set({ favorite: sql`NOT ${bookmarks.favorite}` })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)));
}

export async function deleteBookmark(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .delete(bookmarks)
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning({ id: bookmarks.id });
  return rows.length > 0;
}

export async function listTags(userId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await db.all<{ tag: string; count: number }>(sql`
    SELECT value AS tag, COUNT(*) AS count
    FROM ${bookmarks}, json_each(${bookmarks.tags})
    WHERE ${bookmarks.userId} = ${userId}
    GROUP BY value
    ORDER BY count DESC, tag ASC
    LIMIT 30
  `);
  return rows.map((r) => ({ tag: String(r.tag), count: Number(r.count) }));
}

export function exportAll(userId: string): Promise<Bookmark[]> {
  return db
    .select()
    .from(bookmarks)
    .where(eq(bookmarks.userId, userId))
    .orderBy(desc(bookmarks.createdAt));
}

export type ImportRow = {
  url: string;
  title: string;
  description: string | null;
  tags: string[];
  favorite: boolean;
  createdAt?: Date;
};

/** Массовая вставка пачками; дубли по URL пропускаются. */
export async function importBookmarks(
  userId: string,
  items: ImportRow[],
): Promise<{ added: number; skipped: number }> {
  let added = 0;
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100).map((b) => ({ userId, ...b }));
    const rows = await db
      .insert(bookmarks)
      .values(chunk)
      .onConflictDoNothing()
      .returning({ id: bookmarks.id });
    added += rows.length;
  }
  return { added, skipped: items.length - added };
}
