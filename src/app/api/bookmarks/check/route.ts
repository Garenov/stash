import { NextResponse } from "next/server";
import { authenticate, tooManyRequests } from "@/lib/http";
import { checkUserLinks } from "@/lib/link-check";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST /api/bookmarks/check — проверяет до 25 давно не проверявшихся ссылок.
// Ответ: { checked, broken }. Вызывайте повторно, пока checked > 0.
export async function POST(req: Request) {
  const a = await authenticate(req);
  if (a instanceof NextResponse) return a;

  const lim = await rateLimit(`check:${a.userId}`, 6, 600);
  if (!lim.ok) return tooManyRequests(lim.retryAfter);

  return NextResponse.json(await checkUserLinks(a.userId, { limit: 25 }));
}
