import { z } from "zod";

/** "#Next.js" -> "next.js", "my tag" -> "my-tag" */
export function normalizeTag(t: string): string {
  return t.trim().toLowerCase().replace(/^#+/, "").replace(/\s+/g, "-").slice(0, 30);
}

/** "#react, db  статьи" -> ["react","db","статьи"] */
export function parseTags(input: string): string[] {
  return input.split(/[,\s]+/).map(normalizeTag).filter(Boolean);
}

/** Только относительные пути своего сайта — защита от open redirect. */
export function safePath(v: unknown, fallback = "/dashboard"): string {
  return typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\")
    ? v
    : fallback;
}

const email = z.string().trim().toLowerCase().email("Некорректный email").max(254);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Введите имя").max(80),
  email,
  // bcrypt обрезает вход на 72 байтах, поэтому лимит именно такой
  password: z.string().min(8, "Минимум 8 символов").max(72, "Максимум 72 символа"),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});

const tags = z
  .array(z.string().max(60))
  .max(10, "Не больше 10 тегов")
  .transform((list) => [...new Set(list.map(normalizeTag).filter(Boolean))]);

export const bookmarkInput = z.object({
  url: z
    .string()
    .trim()
    .max(2048)
    .url("Некорректный URL")
    .refine((u) => /^https?:\/\//i.test(u), "Разрешены только http(s) ссылки"),
  title: z.string().trim().min(1, "Введите название").max(200),
  description: z.string().trim().max(1000).optional(),
  tags: tags.default([]),
});

export const bookmarkPatch = bookmarkInput
  .partial()
  .extend({ favorite: z.boolean().optional() });

const flag = z
  .enum(["1", "true"])
  .optional()
  .transform((v) => v !== undefined);

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(60).optional(),
  favorite: flag,
  broken: flag,
  page: z.coerce.number().int().min(1).max(10000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type BookmarkInput = z.infer<typeof bookmarkInput>;
export type BookmarkPatch = z.infer<typeof bookmarkPatch>;
export type ListQuery = z.infer<typeof listQuery>;
