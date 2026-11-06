import { normalizeTag } from "./validation";

/**
 * Разбор строки поиска: `react hooks #db #статьи`
 *  - слова идут в полнотекстовый поиск (по началу слова);
 *  - слова с # — точная фильтрация по тегу (все указанные теги должны совпасть).
 */
export function parseSearch(q: string): { words: string[]; tags: string[] } {
  const words: string[] = [];
  const tags: string[] = [];

  for (const raw of q.split(/\s+/)) {
    if (!raw) continue;
    if (raw.startsWith("#")) {
      const tag = normalizeTag(raw);
      if (tag) tags.push(tag);
      continue;
    }
    // оставляем только буквы/цифры — это же защищает FTS-запрос от спецсинтаксиса
    for (const part of raw.replace(/[^\p{L}\p{N}]+/gu, " ").split(" ")) {
      if (part) words.push(part.toLowerCase());
    }
  }

  return { words: words.slice(0, 8), tags: tags.slice(0, 5) };
}

/** ["react","hook"] -> `"react"* "hook"*` (AND, префиксный поиск) */
export const ftsQuery = (words: string[]) => words.map((w) => `"${w}"*`).join(" ");
