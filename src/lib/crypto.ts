import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

/** Отдельный ключ под каждую цель, чтобы подпись нельзя было использовать как шифр и наоборот. */
const key = (purpose: string) => createHmac("sha256", secret()).update(purpose).digest();

export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Подписанный короткоживущий токен (HMAC-SHA256). Поле `typ` защищает от подмены назначения. */
export function signToken(payload: { typ: string } & Record<string, unknown>, ttlSeconds: number): string {
  const body = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSeconds }),
  ).toString("base64url");
  const sig = createHmac("sha256", key("token")).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyToken(token: unknown, typ: string): Record<string, unknown> | null {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts as [string, string];
  const expected = createHmac("sha256", key("token")).update(body).digest("base64url");
  if (!safeEqual(sig, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
    if (data.typ !== typ) return null;
    if (typeof data.exp !== "number" || data.exp < Date.now() / 1000) return null;
    return data;
  } catch {
    return null;
  }
}

/** AES-256-GCM. Формат: iv.tag.ciphertext (base64url). Ключ выводится из AUTH_SECRET. */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key("encrypt"), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(payload: string): string {
  const parts = payload.split(".").map((p) => Buffer.from(p, "base64url"));
  const [iv, tag, enc] = parts;
  if (parts.length !== 3 || !iv || !tag || !enc) throw new Error("Bad ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", key("encrypt"), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
