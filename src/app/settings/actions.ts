"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { users } from "@/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { getUserId } from "@/lib/http";
import { rateLimit, tooMany } from "@/lib/rate-limit";
import { createApiToken, revokeApiToken } from "@/lib/tokens";
import {
  checkCode,
  generateRecoveryCodes,
  newSecret,
  qrFor,
  verifySecondFactor,
} from "@/lib/totp";

async function requireUser() {
  const id = await getUserId();
  if (!id) throw new Error("Unauthorized");
  const user = await db.query.users.findFirst({ where: eq(users.id, id) });
  if (!user) throw new Error("Unauthorized");
  return user;
}

/* ----------------------------------- 2FA (TOTP) ----------------------------------- */

export type TotpSetupState = { error?: string; secret?: string; qr?: string };
export type TotpConfirmState = { error?: string; recoveryCodes?: string[] };
export type TotpDisableState = { error?: string };

/** Шаг 1: генерируем секрет. Пока код не подтверждён, 2FA не включена. */
export async function beginTotpSetup(
  _prev: TotpSetupState,
  _form?: FormData,
): Promise<TotpSetupState> {
  const user = await requireUser();
  if (!user.passwordHash) {
    return { error: "2FA защищает вход по паролю. Для входа через провайдера она не нужна." };
  }
  if (user.totpEnabled) return { error: "2FA уже включена" };

  const secret = newSecret();
  await db.update(users).set({ totpSecret: encrypt(secret) }).where(eq(users.id, user.id));
  return { secret, qr: await qrFor(secret, user.email) };
}

/** Шаг 2: пользователь вводит код — только после этого 2FA включается. */
export async function confirmTotp(
  _prev: TotpConfirmState,
  form: FormData,
): Promise<TotpConfirmState> {
  const user = await requireUser();
  if (user.totpEnabled) return { error: "2FA уже включена" };
  if (!user.totpSecret) return { error: "Начните настройку заново" };

  const lim = await rateLimit(`totp-setup:${user.id}`, 10, 600);
  if (!lim.ok) return { error: tooMany(lim) };

  const step = checkCode(decrypt(user.totpSecret), user.email, String(form.get("code") ?? ""));
  if (step === null) return { error: "Неверный код. Проверьте время на телефоне." };

  const { plain, hashes } = generateRecoveryCodes();
  await db
    .update(users)
    .set({ totpEnabled: true, totpLastStep: step, recoveryCodes: hashes })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return { recoveryCodes: plain };
}

export async function disableTotp(
  _prev: TotpDisableState,
  form: FormData,
): Promise<TotpDisableState> {
  const user = await requireUser();
  if (!user.totpEnabled) return {};

  const lim = await rateLimit(`totp-disable:${user.id}`, 5, 600);
  if (!lim.ok) return { error: tooMany(lim) };

  if (!(await verifySecondFactor(user, String(form.get("code") ?? "")))) {
    return { error: "Неверный код" };
  }
  await db
    .update(users)
    .set({ totpEnabled: false, totpSecret: null, totpLastStep: null, recoveryCodes: null })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
  return {};
}

/* ----------------------------------- API-токены ----------------------------------- */

export type TokenState = { error?: string; token?: string };

export async function createToken(_prev: TokenState, form: FormData): Promise<TokenState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 60);
  if (!name) return { error: "Введите название токена" };

  const lim = await rateLimit(`token-create:${user.id}`, 10, 3600);
  if (!lim.ok) return { error: tooMany(lim) };

  const result = await createApiToken(user.id, name);
  if ("error" in result) return { error: result.error };

  revalidatePath("/settings");
  return { token: result.token };
}

export async function revokeToken(id: string): Promise<void> {
  const user = await requireUser();
  await revokeApiToken(user.id, id);
  revalidatePath("/settings");
}
