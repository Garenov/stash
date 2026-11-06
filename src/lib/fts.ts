import { client } from "@/db";

/**
 * Полнотекстовый индекс FTS5 над bookmarks (external content + триггеры).
 * drizzle-kit не управляет виртуальными таблицами и триггерами, поэтому они
 * создаются здесь, идемпотентно, один раз на процесс при первом поиске.
 * Если FTS недоступен — вызывающий код откатывается на LIKE.
 */
let ensured: Promise<void> | null = null;

export function ensureFts(): Promise<void> {
  ensured ??= setup().catch((e) => {
    ensured = null; // попробуем снова при следующем поиске
    throw e;
  });
  return ensured;
}

async function setup(): Promise<void> {
  const existed =
    (await client.execute("SELECT 1 FROM sqlite_master WHERE name = 'bookmarks_fts'")).rows
      .length > 0;

  const statements = [
    `CREATE VIRTUAL TABLE IF NOT EXISTS bookmarks_fts USING fts5(
       title, description, url, tags,
       content='bookmarks', content_rowid='rowid',
       tokenize='unicode61 remove_diacritics 2')`,
    `CREATE TRIGGER IF NOT EXISTS bookmarks_fts_ai AFTER INSERT ON bookmarks BEGIN
       INSERT INTO bookmarks_fts(rowid, title, description, url, tags)
       VALUES (new.rowid, new.title, new.description, new.url, new.tags);
     END`,
    `CREATE TRIGGER IF NOT EXISTS bookmarks_fts_ad AFTER DELETE ON bookmarks BEGIN
       INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, description, url, tags)
       VALUES ('delete', old.rowid, old.title, old.description, old.url, old.tags);
     END`,
    `CREATE TRIGGER IF NOT EXISTS bookmarks_fts_au AFTER UPDATE OF title, description, url, tags ON bookmarks BEGIN
       INSERT INTO bookmarks_fts(bookmarks_fts, rowid, title, description, url, tags)
       VALUES ('delete', old.rowid, old.title, old.description, old.url, old.tags);
       INSERT INTO bookmarks_fts(rowid, title, description, url, tags)
       VALUES (new.rowid, new.title, new.description, new.url, new.tags);
     END`,
  ];
  for (const s of statements) await client.execute(s);

  // Индекс пересобираем, если он новый или разошёлся с таблицей
  // (например, drizzle-kit пересоздал bookmarks и триггеры пропали).
  let stale = !existed;
  if (existed) {
    const a = await client.execute("SELECT count(*) AS n FROM bookmarks");
    const b = await client.execute("SELECT count(*) AS n FROM bookmarks_fts_docsize");
    stale = Number(a.rows[0]?.n ?? 0) !== Number(b.rows[0]?.n ?? 0);
  }
  if (stale) await client.execute("INSERT INTO bookmarks_fts(bookmarks_fts) VALUES ('rebuild')");
}
