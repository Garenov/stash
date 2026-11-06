import { NextResponse } from "next/server";
import { safeEqual } from "@/lib/crypto";
import { checkAllStale } from "@/lib/link-check";

export const runtime = "nodejs";
export const maxDuration = 60;

// Вызывается по расписанию (см. vercel.json). Vercel Cron сам шлёт
// `Authorization: Bearer $CRON_SECRET`, если переменная CRON_SECRET задана.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });

  const given = req.headers.get("authorization") ?? "";
  if (!safeEqual(given, `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(await checkAllStale({ limit: 60 }));
}
