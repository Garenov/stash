import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";

export type RateResult = { ok: boolean; retryAfter: number };

/**
 * Фиксированное окно, состояние в БД — работает и на serverless (Vercel + Turso),
 * где память процесса не общая. Один атомарный upsert на вызов.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<RateResult> {
  const now = Date.now();
  const windowMs = windowSec * 1000;
  const cutoff = now - windowMs;

  const rows = await db.all<{ count: number; window_start: number }>(sql`
    INSERT INTO rate_limits (key, count, window_start) VALUES (${key}, 1, ${now})
    ON CONFLICT(key) DO UPDATE SET
      count = CASE WHEN window_start <= ${cutoff} THEN 1 ELSE count + 1 END,
      window_start = CASE WHEN window_start <= ${cutoff} THEN ${now} ELSE window_start END
    RETURNING count, window_start
  `);

  const row = rows[0];
  const count = Number(row?.count ?? 1);
  const start = Number(row?.window_start ?? now);

  // изредка чистим протухшие записи
  if (Math.random() < 0.01) {
    void db
      .run(sql`DELETE FROM rate_limits WHERE window_start < ${now - 24 * 3600 * 1000}`)
      .catch(() => {});
  }

  return {
    ok: count <= max,
    retryAfter: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
  };
}

/** IP клиента. Корректен за доверенным прокси (Vercel, Cloudflare), иначе заголовок подделывается. */
export async function clientIp(h?: Headers): Promise<string> {
  const hs = h ?? (await headers());
  return hs.get("x-forwarded-for")?.split(",")[0]?.trim() || hs.get("x-real-ip") || "unknown";
}

export const tooMany = (r: RateResult) =>
  `Слишком много попыток. Повторите через ${Math.max(1, Math.ceil(r.retryAfter / 60))} мин.`;
