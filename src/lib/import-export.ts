import { z } from "zod";
import type { Bookmark } from "@/db/schema";
import type { ImportRow } from "./bookmarks";
import { normalizeTag } from "./validation";

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ITEMS = 5000;

type RawItem = {
  url: string;
  title?: string | null;
  description?: string | null;
  tags?: string[];
  favorite?: boolean;
  createdAt?: Date;
};

/** Приводит запись к виду, пригодному для вставки; null — если ссылка невалидна. */
function clean(i: RawItem): ImportRow | null {
  const url = i.url.trim().slice(0, 2048);
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  const createdAt =
    i.createdAt && !Number.isNaN(i.createdAt.getTime()) && i.createdAt.getFullYear() >= 1995
      ? i.createdAt
      : undefined;

  return {
    url,
    title: (i.title ?? "").trim().slice(0, 200) || host,
    description: i.description?.trim().slice(0, 1000) || null,
    tags: [...new Set((i.tags ?? []).map(normalizeTag).filter(Boolean))].slice(0, 10),
    favorite: Boolean(i.favorite),
    createdAt,
  };
}

/* ------------------------------ HTML (Chrome/Firefox) ------------------------------ */

// Стандартные папки браузеров — как теги бесполезны.
const IGNORED_FOLDERS = new Set([
  "bookmarks",
  "bookmarks bar",
  "bookmarks toolbar",
  "bookmarks menu",
  "other bookmarks",
  "mobile bookmarks",
  "favorites",
  "favorites bar",
  "панель закладок",
  "меню закладок",
  "другие закладки",
  "мобильные закладки",
  "избранное",
  "панель избранного",
]);

function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeChar(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeChar(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function safeChar(code: number): string {
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function attr(attrs: string, name: string): string | undefined {
  const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  const v = m?.[1] ?? m?.[2];
  return v === undefined ? undefined : decodeEntities(v);
}

/**
 * Формат Netscape Bookmark File: <DL> — вложенный список, <H3> — имя папки, <A HREF> — ссылка.
 * Имена папок становятся тегами (в Stash папок нет), атрибут TAGS (Firefox) тоже учитывается.
 */
export function parseNetscapeHtml(html: string): ImportRow[] {
  const re = /<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi;
  const folders: (string | null)[] = [];
  let pending: string | null = null;
  const out: ImportRow[] = [];

  for (const m of html.matchAll(re)) {
    const closing = m[1] === "/";
    const tag = (m[2] ?? "").toLowerCase();
    const attrs = m[3] ?? "";
    const text = decodeEntities((m[4] ?? "").trim());

    if (tag === "dl") {
      if (closing) folders.pop();
      else {
        folders.push(pending);
        pending = null;
      }
    } else if (tag === "h3" && !closing) {
      pending = text;
    } else if (tag === "a" && !closing) {
      const url = attr(attrs, "href");
      if (!url) continue;

      const fromFolders = folders.filter(
        (f): f is string => !!f && !IGNORED_FOLDERS.has(f.toLowerCase()),
      );
      const fromAttr = attr(attrs, "tags")?.split(",") ?? [];
      const ts = Number(attr(attrs, "add_date"));

      const item = clean({
        url,
        title: text,
        tags: [...fromFolders, ...fromAttr],
        createdAt: Number.isFinite(ts) && ts > 0 ? new Date(ts * 1000) : undefined,
      });
      if (item) out.push(item);
    }
  }
  return out;
}

/* ------------------------------------- JSON ------------------------------------- */

const jsonItem = z.object({
  url: z.string(),
  title: z.string().nullish(),
  description: z.string().nullish(),
  tags: z.array(z.string()).optional(),
  favorite: z.boolean().optional(),
  createdAt: z.union([z.string(), z.number()]).optional(),
});

/** Принимает наш экспорт `{ bookmarks: [...] }` или просто массив записей. */
export function parseJson(text: string): ImportRow[] {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  const list = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { bookmarks?: unknown }).bookmarks)
      ? (data as { bookmarks: unknown[] }).bookmarks
      : [];

  const out: ImportRow[] = [];
  for (const raw of list) {
    const p = jsonItem.safeParse(raw);
    if (!p.success) continue;
    const { createdAt, ...rest } = p.data;
    const item = clean({ ...rest, createdAt: createdAt === undefined ? undefined : new Date(createdAt) });
    if (item) out.push(item);
  }
  return out;
}

export function parseImport(filename: string, text: string): ImportRow[] {
  const head = text.trimStart()[0];
  const looksJson = filename.toLowerCase().endsWith(".json") || head === "{" || head === "[";
  return looksJson ? parseJson(text) : parseNetscapeHtml(text);
}

/* ------------------------------------- экспорт ------------------------------------- */

export function toJson(items: Bookmark[]): string {
  return JSON.stringify(
    {
      version: 1,
      exportedAt: new Date().toISOString(),
      bookmarks: items.map((b) => ({
        url: b.url,
        title: b.title,
        description: b.description,
        tags: b.tags,
        favorite: b.favorite,
        createdAt: b.createdAt.toISOString(),
      })),
    },
    null,
    2,
  );
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Netscape HTML — его понимают Chrome, Firefox, Safari и большинство менеджеров закладок. */
export function toNetscapeHtml(items: Bookmark[]): string {
  const lines = items.map((b) => {
    const added = Math.floor(b.createdAt.getTime() / 1000);
    const tags = b.tags.length ? ` TAGS="${esc(b.tags.join(","))}"` : "";
    return `    <DT><A HREF="${esc(b.url)}" ADD_DATE="${added}"${tags}>${esc(b.title)}</A>`;
  });
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    ...lines,
    "</DL><p>",
    "",
  ].join("\n");
}
