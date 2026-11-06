import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks, type Bookmark } from "@/db/schema";
import type { BookmarkInput, BookmarkPatch, ListQuery } from "./validation";

/** Все запросы жёстко ограничены userId — чужие закладки недоступны. */

export async function listBookmarks(
  userId: string,
  f: Partial<ListQuery> = {},
): Promise<Bookmark[]> {
  const conds = [eq(bookmarks.userId, userId)];

  if (f.favorite) conds.push(eq(bookmarks.favorite, true));

  if (f.q) {
    const p = `%${f.q}%`;
    conds.push(
      or(
        like(bookmarks.title, p),
        like(bookmarks.url, p),
        like(bookmarks.description, p),
      )!,
    );
  }

  if (f.tag) {
    conds.push(
      sql`EXISTS (SELECT 1 FROM json_each(${bookmarks.tags}) WHERE value = ${f.tag})`,
    );
  }

  return db
    .select()
    .from(bookmarks)
    .where(and(...conds))
    .orderBy(desc(bookmarks.createdAt));
}

export async function createBookmark(
  userId: string,
  input: BookmarkInput,
): Promise<Bookmark> {
  const [row] = await db
    .insert(bookmarks)
    .values({
      userId,
      url: input.url,
      title: input.title,
      description: input.description || null,
      tags: input.tags,
    })
    .returning();
  return row!;
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
  const [row] = await db
    .update(bookmarks)
    .set({
      ...patch,
      description:
        patch.description === undefined ? undefined : patch.description || null,
    })
    .where(and(eq(bookmarks.id, id), eq(bookmarks.userId, userId)))
    .returning();
  return row;
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

export async function listTags(
  userId: string,
): Promise<{ tag: string; count: number }[]> {
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
