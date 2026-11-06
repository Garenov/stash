import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt, or, sql } from "drizzle-orm";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { decrypt, sha256 } from "./crypto";

const PERIOD = 30;

function totpFor(secretBase32: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: "Stash",
    label,
    algorithm: "SHA1",
    digits: 6,
    period: PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
}

export const newSecret = (): string => new OTPAuth.Secret({ size: 20 }).base32;

export function qrFor(secret: string, email: string): Promise<string> {
  return QRCode.toDataURL(totpFor(secret, email).toString(), { margin: 1, width: 220 });
}

/** Номер 30-секундного шага, на который пришёлся верный код (±1 шаг), или null. */
export function checkCode(secret: string, email: string, code: string): number | null {
  const token = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(token)) return null;
  const delta = totpFor(secret, email).validate({ token, window: 1 });
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / PERIOD) + delta;
}

const normalizeRecovery = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");

export function generateRecoveryCodes(count = 8): { plain: string[]; hashes: string[] } {
  const plain = Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString("hex");
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
  return { plain, hashes: plain.map((c) => sha256(normalizeRecovery(c))) };
}

/**
 * Проверяет второй фактор: 6-значный TOTP-код или recovery-код.
 * Если у пользователя 2FA не включена — true. TOTP-код нельзя использовать дважды.
 */
export async function verifySecondFactor(user: User, input: string): Promise<boolean> {
  if (!user.totpEnabled || !user.totpSecret) return true;

  const code = input.trim();
  if (/^\d{6}$/.test(code.replace(/\s/g, ""))) {
    const step = checkCode(decrypt(user.totpSecret), user.email, code);
    if (step === null) return false;
    // атомарно: шаг должен быть строго больше сохранённого
    const rows = await db
      .update(users)
      .set({ totpLastStep: step })
      .where(
        and(
          eq(users.id, user.id),
          or(isNull(users.totpLastStep), lt(users.totpLastStep, step)),
        ),
      )
      .returning({ id: users.id });
    return rows.length === 1;
  }

  const hash = sha256(normalizeRecovery(code));
  const list = user.recoveryCodes ?? [];
  if (!list.includes(hash)) return false;
  const rows = await db
    .update(users)
    .set({ recoveryCodes: list.filter((h) => h !== hash) })
    .where(
      and(
        eq(users.id, user.id),
        sql`EXISTS (SELECT 1 FROM json_each(${users.recoveryCodes}) WHERE value = ${hash})`,
      ),
    )
    .returning({ id: users.id });
  return rows.length === 1;
}
