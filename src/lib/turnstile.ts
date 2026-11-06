/**
 * Cloudflare Turnstile. Включается, только если заданы оба ключа:
 * NEXT_PUBLIC_TURNSTILE_SITE_KEY и TURNSTILE_SECRET_KEY. Без них проверка пропускается (dev).
 */
export const turnstileEnabled = () =>
  Boolean(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

export async function verifyTurnstile(token: unknown, ip: string): Promise<boolean> {
  if (!turnstileEnabled()) return true;
  if (typeof token !== "string" || !token) return false;

  const body = new URLSearchParams({
    secret: process.env.TURNSTILE_SECRET_KEY!,
    response: token,
  });
  if (ip !== "unknown") body.set("remoteip", ip);

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(5000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false; // при сбое проверки не пускаем
  }
}
