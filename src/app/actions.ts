"use server";

import { eq } from "drizzle-orm";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { enabledOAuth, signIn, signOut } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import * as repo from "@/lib/bookmarks";
import { signToken, verifyToken } from "@/lib/crypto";
import { getUserId } from "@/lib/http";
import { checkUserLinks } from "@/lib/link-check";
import { clientIp, rateLimit, tooMany } from "@/lib/rate-limit";
import { verifySecondFactor } from "@/lib/totp";
import { verifyTurnstile } from "@/lib/turnstile";
import { createUser, EmailTakenError, verifyPassword } from "@/lib/users";
import {
  bookmarkInput,
  loginSchema,
  parseTags,
  registerSchema,
  safePath,
} from "@/lib/validation";

export type FormState = {
  error?: string;
  fields?: Record<string, string[] | undefined>;
  ok?: boolean;
  /** после верного пароля у пользователя с 2FA: подписанный билет для шага с кодом */
  ticket?: string;
};

const BAD_LOGIN = "Неверный email или пароль";
const BOT_CHECK = "Не удалось пройти проверку на бота. Попробуйте ещё раз.";

async function requireUserId(): Promise<string> {
  const id = await getUserId();
  if (!id) throw new Error("Unauthorized");
  return id;
}

/** Единственное место, где выдаётся вход: подписанный proof на 60 секунд. */
async function finishLogin(userId: string, redirectTo: string): Promise<FormState> {
  try {
    await signIn("credentials", {
      proof: signToken({ typ: "login", uid: userId }, 60),
      redirectTo,
    });
  } catch (e) {
    // успешный вход бросает NEXT_REDIRECT — его пробрасываем дальше
    if (e instanceof AuthError) return { error: "Не удалось войти. Попробуйте ещё раз." };
    throw e;
  }
  return { ok: true };
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  if (form.get("hp_url")) return { error: BAD_LOGIN }; // honeypot: человек это поле не видит
  const redirectTo = safePath(form.get("callbackUrl"));
  const ticket = form.get("ticket");

  // Шаг 2: код из приложения-аутентификатора или recovery-код
  if (typeof ticket === "string" && ticket) {
    const t = verifyToken(ticket, "2fa");
    if (!t || typeof t.uid !== "string") {
      return { error: "Время входа истекло, начните заново." };
    }
    const lim = await rateLimit(`2fa:${t.uid}`, 5, 600);
    if (!lim.ok) return { error: tooMany(lim), ticket };

    const user = await db.query.users.findFirst({ where: eq(users.id, t.uid) });
    const code = String(form.get("code") ?? "");
    if (!user || !(await verifySecondFactor(user, code))) {
      return { error: "Неверный код", ticket };
    }
    return finishLogin(user.id, redirectTo);
  }

  // Шаг 1: email + пароль
  const parsed = loginSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: BAD_LOGIN };
  const { email, password } = parsed.data;

  const ip = await clientIp();
  const [byIp, byPair] = await Promise.all([
    rateLimit(`login:ip:${ip}`, 50, 900),
    rateLimit(`login:${ip}:${email}`, 10, 900),
  ]);
  if (!byIp.ok || !byPair.ok) return { error: tooMany(byIp.ok ? byPair : byIp) };

  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) {
    return { error: BOT_CHECK };
  }

  const user = await verifyPassword(email, password);
  if (!user) return { error: BAD_LOGIN };

  if (user.totpEnabled) {
    return { ticket: signToken({ typ: "2fa", uid: user.id }, 300) };
  }
  return finishLogin(user.id, redirectTo);
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  if (form.get("hp_url")) return { error: "Не удалось создать аккаунт" };

  const parsed = registerSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };

  const ip = await clientIp();
  const lim = await rateLimit(`register:${ip}`, 5, 3600);
  if (!lim.ok) return { error: tooMany(lim) };
  if (!(await verifyTurnstile(form.get("cf-turnstile-response"), ip))) {
    return { error: BOT_CHECK };
  }

  let userId: string;
  try {
    userId = (await createUser(parsed.data)).id;
  } catch (e) {
    if (e instanceof EmailTakenError) {
      return { fields: { email: ["Этот email уже зарегистрирован"] } };
    }
    throw e;
  }
  return finishLogin(userId, "/dashboard");
}

export async function oauthSignIn(form: FormData): Promise<void> {
  const provider = String(form.get("provider") ?? "");
  if (!enabledOAuth.some((p) => p.id === provider)) return;
  await signIn(provider, { redirectTo: safePath(form.get("callbackUrl")) });
}

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

/* ---------------------------------- закладки --------------------------------- */

function readBookmarkForm(form: FormData) {
  return bookmarkInput.safeParse({
    url: form.get("url"),
    title: form.get("title"),
    description: form.get("description") || undefined,
    tags: parseTags(String(form.get("tags") ?? "")),
  });
}

const DUPLICATE: FormState = { fields: { url: ["Эта ссылка уже сохранена"] } };

export async function addBookmark(_: FormState, form: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = readBookmarkForm(form);
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };

  try {
    await repo.createBookmark(userId, parsed.data);
  } catch (e) {
    if (e instanceof repo.DuplicateBookmarkError) return DUPLICATE;
    throw e;
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function editBookmark(
  id: string,
  _: FormState,
  form: FormData,
): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = readBookmarkForm(form);
  if (!parsed.success) return { fields: parsed.error.flatten().fieldErrors };

  try {
    const row = await repo.updateBookmark(userId, id, parsed.data);
    if (!row) return { error: "Закладка не найдена" };
  } catch (e) {
    if (e instanceof repo.DuplicateBookmarkError) return DUPLICATE;
    throw e;
  }
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function toggleFavorite(id: string): Promise<void> {
  await repo.toggleFavorite(await requireUserId(), id);
  revalidatePath("/dashboard");
}

export async function removeBookmark(id: string): Promise<void> {
  await repo.deleteBookmark(await requireUserId(), id);
  revalidatePath("/dashboard");
}

export type CheckState = { checked?: number; broken?: number; error?: string } | null;

export async function checkMyLinks(_prev: CheckState, _form?: FormData): Promise<CheckState> {
  const userId = await requireUserId();
  const lim = await rateLimit(`check:${userId}`, 6, 600);
  if (!lim.ok) return { error: tooMany(lim) };

  const result = await checkUserLinks(userId, { limit: 25 });
  revalidatePath("/dashboard");
  return result;
}
