import { z } from "zod";

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
  .array(z.string().trim().toLowerCase().min(1).max(30))
  .max(10, "Не больше 10 тегов")
  .transform((list) => [...new Set(list)]);

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

export const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().trim().toLowerCase().max(30).optional(),
  favorite: z
    .enum(["1", "true"])
    .optional()
    .transform((v) => v !== undefined),
});

/** "react, Next.js,  react" -> ["react", "next.js"] */
export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export type BookmarkInput = z.infer<typeof bookmarkInput>;
export type BookmarkPatch = z.infer<typeof bookmarkPatch>;
export type ListQuery = z.infer<typeof listQuery>;
