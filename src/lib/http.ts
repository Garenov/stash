import { NextResponse } from "next/server";
import type { ZodError } from "zod";
import { auth } from "@/auth";
import { clientIp, rateLimit } from "./rate-limit";
import { findUserIdByToken } from "./tokens";

/** Пользователь из сессии (для server actions и страниц). */
export async function getUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export const notFound = () => NextResponse.json({ error: "Not found" }, { status: 404 });

export const tooManyRequests = (retryAfter: number) =>
  NextResponse.json(
    { error: "Too many requests" },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );

export const badRequest = (e: ZodError) =>
  NextResponse.json(
    { error: "Validation failed", fields: e.flatten().fieldErrors },
    { status: 400 },
  );

/**
 * Аутентификация API: `Authorization: Bearer stash_...` или cookie-сессия.
 * Заодно ограничивает частоту запросов (240 в минуту на пользователя).
 * Если вернулся NextResponse — его нужно сразу отдать клиенту.
 */
export async function authenticate(
  req: Request,
): Promise<{ userId: string } | NextResponse> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];

  let userId: string | null;
  if (bearer) {
    userId = await findUserIdByToken(bearer);
  } else {
    userId = await getUserId();
  }
  if (!userId) {
    // неверные токены тоже ограничиваем по IP, чтобы их нельзя было перебирать
    if (bearer) {
      const lim = await rateLimit(`badtoken:${await clientIp(req.headers)}`, 30, 600);
      if (!lim.ok) return tooManyRequests(lim.retryAfter);
    }
    return unauthorized();
  }

  const lim = await rateLimit(`api:${userId}`, 240, 60);
  if (!lim.ok) return tooManyRequests(lim.retryAfter);
  return { userId };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
