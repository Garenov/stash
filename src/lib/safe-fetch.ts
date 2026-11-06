import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Защита от SSRF: проверка ссылок идёт с сервера, поэтому пользователь не должен
 * иметь возможности заставить его ходить во внутреннюю сеть или на metadata-эндпоинты.
 * Ограничение: между проверкой DNS и самим запросом остаётся окно для DNS rebinding.
 */

function isPrivateIPv4(ip: string): boolean {
  const [a = 0, b = 0] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast и зарезервированные
  );
}

function isPrivateIPv6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("::ffff:")) {
    const v4 = s.slice(7);
    return isIP(v4) === 4 ? isPrivateIPv4(v4) : true;
  }
  return /^f[cd]/.test(s) || /^fe[89ab]/.test(s); // ULA и link-local
}

export function isPublicIp(ip: string): boolean {
  const v = isIP(ip);
  if (v === 4) return !isPrivateIPv4(ip);
  if (v === 6) return !isPrivateIPv6(ip);
  return false;
}

export async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("UNSUPPORTED_PROTOCOL");
  }

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) {
    if (!isPublicIp(host)) throw new Error("BLOCKED_ADDRESS");
    return url;
  }
  if (/(^|\.)(localhost|local|internal|localdomain)$/.test(host.toLowerCase())) {
    throw new Error("BLOCKED_ADDRESS");
  }

  const addrs = await lookup(host, { all: true });
  if (addrs.length === 0 || addrs.some((a) => !isPublicIp(a.address))) {
    throw new Error("BLOCKED_ADDRESS");
  }
  return url;
}

/** fetch с ручным следованием редиректам: каждый переход проверяется заново. */
export async function safeFetch(
  raw: string,
  opts: { method?: "HEAD" | "GET"; headers?: HeadersInit; timeoutMs?: number } = {},
): Promise<Response> {
  let current = raw;
  for (let hop = 0; hop <= 5; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.headers,
      redirect: "manual",
      signal: AbortSignal.timeout(opts.timeoutMs ?? 8000),
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel();
      current = new URL(location, url).toString();
      continue;
    }
    return res;
  }
  throw new Error("TOO_MANY_REDIRECTS");
}
