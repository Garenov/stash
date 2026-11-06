import { and, asc, eq, isNull, lt, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { bookmarks } from "@/db/schema";
import { safeFetch } from "./safe-fetch";

export type LinkResult = {
  status: "ok" | "broken";
  httpStatus: number | null;
  error: string | null;
};

const HEADERS = {
  "user-agent": "StashLinkChecker/1.0 (bookmark manager)",
  accept: "*/*",
};

function describe(e: unknown): string {
  if (!(e instanceof Error)) return "ERROR";
  if (e.name === "TimeoutError") return "TIMEOUT";
  const cause = (e as Error & { cause?: { code?: string } }).cause;
  return (cause?.code ?? e.message).slice(0, 120);
}

export async function checkUrl(url: string): Promise<LinkResult> {
  try {
    let res = await safeFetch(url, { method: "HEAD", headers: HEADERS });
    if (res.status >= 400) {
      // многие серверы неверно отвечают на HEAD — перепроверяем GET'ом
      await res.body?.cancel();
      res = await safeFetch(url, { method: "GET", headers: HEADERS });
    }
    await res.body?.cancel();

    const s = res.status;
    // 401/403/429 — сайт жив, просто не пускает ботов
    if (s < 400 || s === 401 || s === 403 || s === 429 || s === 999) {
      return { status: "ok", httpStatus: s, error: null };
    }
    return { status: "broken", httpStatus: s, error: `HTTP ${s}` };
  } catch (e) {
    return { status: "broken", httpStatus: null, error: describe(e) };
  }
}

export type BatchResult = { checked: number; broken: number };

async function checkBatch(where: SQL | undefined, limit: number): Promise<BatchResult> {
  // сначала ни разу не проверенные (NULL идёт первым), затем самые давние
  const rows = await db
    .select({ id: bookmarks.id, url: bookmarks.url })
    .from(bookmarks)
    .where(where)
    .orderBy(asc(bookmarks.linkCheckedAt))
    .limit(limit);

  let next = 0;
  let broken = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++]!;
      const r = await checkUrl(row.url);
      if (r.status === "broken") broken++;
      await db
        .update(bookmarks)
        .set({
          linkStatus: r.status,
          httpStatus: r.httpStatus,
          linkError: r.error,
          linkCheckedAt: new Date(),
        })
        .where(eq(bookmarks.id, row.id));
    }
  };
  await Promise.all(Array.from({ length: Math.min(5, rows.length) }, worker));

  return { checked: rows.length, broken };
}

const staleBefore = (ms: number) =>
  or(isNull(bookmarks.linkCheckedAt), lt(bookmarks.linkCheckedAt, new Date(Date.now() - ms)));

/** Проверка устаревших ссылок одного пользователя (кнопка в интерфейсе, API). */
export function checkUserLinks(
  userId: string,
  opts: { limit?: number; staleMs?: number } = {},
): Promise<BatchResult> {
  return checkBatch(
    and(eq(bookmarks.userId, userId), staleBefore(opts.staleMs ?? 24 * 3600 * 1000)),
    opts.limit ?? 25,
  );
}

/** Фоновая проверка по всем пользователям (cron). */
export function checkAllStale(opts: { limit?: number; staleMs?: number } = {}): Promise<BatchResult> {
  return checkBatch(staleBefore(opts.staleMs ?? 7 * 24 * 3600 * 1000), opts.limit ?? 60);
}
